#!/usr/bin/env ruby
# frozen_string_literal: true

# Fetch and query a GitHub user activity timeline via gh, cached in SQLite.
#
#   usr/bin/github-user-activity sync --user LOGIN --since 2020-01-01
#   usr/bin/github-user-activity list --user LOGIN --since 2026-01-01
#   usr/bin/github-user-activity stats --user LOGIN

require "cgi"
require "date"
require "fileutils"
require "json"
require "open3"
require "optparse"
require "sqlite3"
require "time"
require "uri"

SCHEMA = <<~SQL
  CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY,
    user_login TEXT NOT NULL,
    source TEXT NOT NULL,
    event_type TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    actor TEXT,
    repo TEXT,
    title TEXT,
    url TEXT,
    summary TEXT,
    payload_json TEXT NOT NULL,
    fetched_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_activities_user_time
    ON activities(user_login, occurred_at);
  CREATE INDEX IF NOT EXISTS idx_activities_type
    ON activities(user_login, event_type);
  CREATE TABLE IF NOT EXISTS sync_coverage (
    user_login TEXT NOT NULL,
    source TEXT NOT NULL,
    covered_since TEXT NOT NULL,
    covered_until TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_login, source)
  );
SQL

DEFAULT_SOURCES = %w[events commits search stars].freeze
EVENTS_MAX_PAGES = 3 # GitHub caps the events timeline at ~300 items.
ROOT = File.expand_path("../..", __dir__) # repository root from usr/scripts

module GithubUserActivity
  module_function

  def utc_now
    Time.now.utc.iso8601
  end

  def parse_when(value)
    return nil if value.nil?

    text = value.strip
    return "#{text}T00:00:00Z" if text.match?(/\A\d{4}-\d{2}-\d{2}\z/)
    return text if text.end_with?("Z") || text.match?(/[+-]\d{2}:\d{2}\z/)

    raise ArgumentError, "Use YYYY-MM-DD or ISO-8601, got #{value.inspect}"
  end

  def day_bound(value, end_of_day: false)
    return nil if value.nil?

    parsed = parse_when(value)
    return "#{value.strip}T23:59:59Z" if end_of_day && value.strip.match?(/\A\d{4}-\d{2}-\d{2}\z/)

    parsed
  end

  def default_db(user)
    File.join(ROOT, "tmp", "github-activity", "#{user}.sqlite")
  end

  def connect(path)
    FileUtils.mkdir_p(File.dirname(path))
    db = SQLite3::Database.new(path)
    db.results_as_hash = true
    db.execute_batch(SCHEMA)
    db
  end

  def run_gh(args, runner: nil)
    return runner.call(args) if runner

    output, status = Open3.capture2e("gh", *args)
    output = output.to_s.force_encoding("UTF-8")
    output = output.encode("UTF-8", invalid: :replace, undef: :replace) unless output.valid_encoding?
    raise "gh failed (#{status.exitstatus}): #{output.strip}" unless status.success?

    text = output.strip
    return nil if text.empty?

    payload = JSON.parse(text)
    if payload.is_a?(Hash) && payload["message"] && !payload.key?("items")
      raise "gh api error: #{payload["message"]}"
    end
    payload
  rescue JSON::ParserError
    raise unless args.include?("--jq")

    text
  end

  def expect_array!(payload, label)
    return [] if payload.nil?
    return payload if payload.is_a?(Array)

    raise "expected array from #{label}, got #{payload.class}: #{payload.inspect[0, 200]}"
  end

  def expect_search!(payload)
    payload = {} if payload.nil?
    raise "gh api error: #{payload["message"]}" if payload.is_a?(Hash) && payload["message"] && !payload.key?("items")
    raise "expected search object, got #{payload.class}" unless payload.is_a?(Hash)

    items = payload["items"]
    raise "search response missing items: #{payload.inspect[0, 200]}" if items.nil?

    items
  end

  def resolve_user(explicit, runner: nil)
    return explicit if explicit && !explicit.empty?

    payload = run_gh(%w[api user], runner: runner)
    login = payload.is_a?(Hash) ? payload["login"] : nil
    raise "Could not resolve GitHub login; pass --user" if login.nil? || login.empty?

    login
  end

  def activity_row(id:, user:, source:, event_type:, occurred_at:, actor:, repo:, title:, url:, summary:, payload:)
    {
      "id" => id,
      "user_login" => user,
      "source" => source,
      "event_type" => event_type,
      "occurred_at" => occurred_at,
      "actor" => actor,
      "repo" => repo,
      "title" => title,
      "url" => url,
      "summary" => summary,
      "payload_json" => JSON.generate(payload),
      "fetched_at" => utc_now
    }
  end

  def upsert_activities(db, rows)
    inserted = 0
    sql = <<~SQL
      INSERT INTO activities (
        id, user_login, source, event_type, occurred_at, actor, repo,
        title, url, summary, payload_json, fetched_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        event_type=excluded.event_type,
        occurred_at=excluded.occurred_at,
        actor=excluded.actor,
        repo=excluded.repo,
        title=excluded.title,
        url=excluded.url,
        summary=excluded.summary,
        payload_json=excluded.payload_json,
        fetched_at=excluded.fetched_at
    SQL
    keys = %w[
      id user_login source event_type occurred_at actor repo
      title url summary payload_json fetched_at
    ]
    db.transaction do
      rows.each do |row|
        exists = db.get_first_value("SELECT 1 FROM activities WHERE id = ?", row["id"])
        db.execute(sql, row.values_at(*keys))
        inserted += 1 if exists.nil?
      end
    end
    inserted
  end

  def coverage_row(db, user, source)
    db.get_first_row(
      "SELECT covered_since, covered_until FROM sync_coverage WHERE user_login=? AND source=?",
      [user, source]
    )
  end

  def coverage_contains?(db, user, source, since, until_at)
    return false if since.nil?

    row = coverage_row(db, user, source)
    return false if row.nil?

    want_until = until_at || utc_now
    row["covered_since"] <= since && row["covered_until"] >= want_until
  end

  def resolve_sync_window(db, user, source, since, until_at, force:)
    return [since, until_at] if since || force

    row = coverage_row(db, user, source)
    return [since, until_at] if row.nil?

    [row["covered_until"], until_at]
  end

  def mark_coverage(db, user, source, since, until_at)
    new_since = since || "1970-01-01T00:00:00Z"
    new_until = until_at || utc_now
    row = coverage_row(db, user, source)
    if row
      new_since = [row["covered_since"], new_since].min
      new_until = [row["covered_until"], new_until].max
    end
    db.execute(<<~SQL, [user, source, new_since, new_until, utc_now])
      INSERT INTO sync_coverage (user_login, source, covered_since, covered_until, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_login, source) DO UPDATE SET
        covered_since=excluded.covered_since,
        covered_until=excluded.covered_until,
        updated_at=excluded.updated_at
    SQL
  end

  def in_range?(occurred_at, since, until_at)
    return false if since && occurred_at < since
    return false if until_at && occurred_at > until_at

    true
  end

  def normalize_event(user, event)
    repo = event.dig("repo", "name")
    payload = event["payload"] || {}
    title = nil
    url = nil
    summary = event["type"]
    case event["type"]
    when "PushEvent"
      commits = payload["commits"] || []
      summary = "push #{commits.length} commit(s) to #{payload['ref']}"
    when "IssuesEvent", "PullRequestEvent"
      entity = payload["issue"] || payload["pull_request"] || {}
      title = entity["title"]
      url = entity["html_url"]
      summary = "#{payload['action']} #{event['type']}"
    when "IssueCommentEvent", "PullRequestReviewCommentEvent", "CommitCommentEvent"
      comment = payload["comment"] || {}
      url = comment["html_url"]
      body = (comment["body"] || "").strip.tr("\n", " ")
      summary = body[0, 120]
      title = (payload["issue"] || payload["pull_request"] || {})["title"]
    when "WatchEvent"
      summary = "starred #{repo}"
      url = repo ? "https://github.com/#{repo}" : nil
    when "CreateEvent"
      summary = "created #{payload['ref_type']} #{payload['ref']}".strip
    end
    activity_row(
      id: "event:#{event['id']}",
      user: user,
      source: "events",
      event_type: event["type"] || "UnknownEvent",
      occurred_at: event["created_at"],
      actor: event.dig("actor", "login"),
      repo: repo,
      title: title,
      url: url,
      summary: summary,
      payload: event
    )
  end

  def normalize_search_item(user, item)
    is_pr = item.key?("pull_request")
    repo_url = item["repository_url"].to_s
    repo = repo_url.split("/")[-2, 2]&.join("/")
    activity_row(
      id: "search:#{item['id']}",
      user: user,
      source: "search",
      event_type: is_pr ? "PullRequest" : "Issue",
      occurred_at: item["created_at"],
      actor: item.dig("user", "login"),
      repo: repo,
      title: item["title"],
      url: item["html_url"],
      summary: item["state"],
      payload: item
    )
  end

  def normalize_star(user, item)
    repo = item["repo"] || item
    full_name = repo["full_name"]
    starred_at = item["starred_at"] || repo["updated_at"]
    activity_row(
      id: "star:#{repo['id']}:#{starred_at}",
      user: user,
      source: "stars",
      event_type: "Star",
      occurred_at: starred_at,
      actor: user,
      repo: full_name,
      title: full_name,
      url: repo["html_url"],
      summary: "starred #{full_name}",
      payload: item
    )
  end

  def normalize_commit(user, item)
    repo = item.dig("repository", "full_name")
    message = item.dig("commit", "message").to_s.split("\n", 2).first
    occurred = item.dig("commit", "author", "date") || item.dig("commit", "committer", "date")
    # Search returns +02:00 style stamps; normalize to UTC Z for range filters.
    occurred_at = Time.parse(occurred).utc.iso8601
    activity_row(
      id: "commit:#{item['sha']}",
      user: user,
      source: "commits",
      event_type: "Commit",
      occurred_at: occurred_at,
      actor: item.dig("author", "login") || user,
      repo: repo,
      title: message,
      url: item["html_url"],
      summary: message,
      payload: item
    )
  end

  def sync_events(db, user, since, until_at, runner: nil)
    # Events are roughly newest-first but not strictly ordered, so do not
    # early-stop on the first row older than --since.
    rows = []
    page = 1
    loop do
      path = "users/#{CGI.escape(user)}/events?per_page=100&page=#{page}"
      batch = expect_array!(run_gh(["api", path], runner: runner), path)
      break if batch.empty?

      batch.each do |event|
        occurred = event["created_at"].to_s
        next unless in_range?(occurred, since, until_at)

        rows << normalize_event(user, event)
      end
      break if batch.length < 100 || page >= EVENTS_MAX_PAGES

      page += 1
    end
    upsert_activities(db, rows)
  end

  def each_search_page(query, runner: nil)
    page = 1
    loop do
      encoded = CGI.escape(query)
      items = expect_search!(
        run_gh(["api", "search/issues?q=#{encoded}&per_page=100&page=#{page}"], runner: runner)
      )
      break if items.empty?

      yield items
      break if items.length < 100 || page >= 10

      page += 1
    end
  end

  def sync_search(db, user, since, until_at, runner: nil)
    since_day = (since || "2008-01-01")[0, 10]
    until_day = (until_at || Date.today.iso8601)[0, 10]
    rows = []
    each_search_page("author:#{user} created:#{since_day}..#{until_day}", runner: runner) do |items|
      items.each do |item|
        occurred = item["created_at"].to_s
        rows << normalize_search_item(user, item) if in_range?(occurred, since, until_at)
      end
    end
    # PRs/issues touched in-range even if authored earlier.
    each_search_page(
      "involves:#{user} updated:#{since_day}..#{until_day}",
      runner: runner
    ) do |items|
      items.each do |item|
        updated = item["updated_at"].to_s
        next unless in_range?(updated, since, until_at)

        row = normalize_search_item(user, item)
        row["id"] = "search-touch:#{item['id']}"
        row["occurred_at"] = updated
        row["summary"] = [item["state"], "updated"].compact.join(" ")
        rows << row
      end
    end
    upsert_activities(db, rows)
  end

  def sync_commits(db, user, since, until_at, runner: nil)
    since_day = (since || "2008-01-01")[0, 10]
    until_day = (until_at || Date.today.iso8601)[0, 10]
    query = CGI.escape("author:#{user} author-date:#{since_day}..#{until_day}")
    rows = []
    page = 1
    loop do
      payload = run_gh(
        [
          "api",
          "search/commits?q=#{query}&per_page=100&page=#{page}",
          "-H",
          "Accept: application/vnd.github+json"
        ],
        runner: runner
      )
      items = expect_search!(payload)
      break if items.empty?

      items.each do |item|
        row = normalize_commit(user, item)
        rows << row if in_range?(row["occurred_at"], since, until_at)
      end
      break if items.length < 100 || page >= 10

      page += 1
    end
    upsert_activities(db, rows)
  end

  def sync_stars(db, user, since, until_at, runner: nil)
    rows = []
    page = 1
    loop do
      batch = expect_array!(
        run_gh(
          [
            "api",
            "users/#{CGI.escape(user)}/starred?per_page=100&page=#{page}",
            "-H",
            "Accept: application/vnd.github.star+json"
          ],
          runner: runner
        ),
        "starred"
      )
      break if batch.empty?

      stop = false
      batch.each do |item|
        row = normalize_star(user, item)
        occurred = row["occurred_at"].to_s
        if since && occurred < since
          stop = true
          next
        end
        next if until_at && occurred > until_at

        rows << row if in_range?(occurred, since, until_at)
      end
      break if stop || batch.length < 100 || page >= 20

      page += 1
    end
    upsert_activities(db, rows)
  end

  SYNCERS = {
    "events" => method(:sync_events),
    "commits" => method(:sync_commits),
    "search" => method(:sync_search),
    "stars" => method(:sync_stars)
  }.freeze

  def query_activities(db, user, since:, until_at:, event_type:, source:, limit:)
    clauses = ["user_login = ?"]
    params = [user]
    if since
      clauses << "occurred_at >= ?"
      params << since
    end
    if until_at
      clauses << "occurred_at <= ?"
      params << until_at
    end
    if event_type
      clauses << "event_type = ?"
      params << event_type
    end
    if source
      clauses << "source = ?"
      params << source
    end
    params << limit
    db.execute(<<~SQL, params)
      SELECT id, source, event_type, occurred_at, actor, repo, title, url, summary
      FROM activities
      WHERE #{clauses.join(' AND ')}
      ORDER BY occurred_at ASC, id ASC
      LIMIT ?
    SQL
  end

  def sync_required?(db_path, user, since, until_at, sources, force: false)
    return true if force
    return true unless File.file?(db_path)

    db = connect(db_path)
    return true if db.get_first_value("SELECT 1 FROM activities WHERE user_login = ?", user).nil?
    return false if since.nil?

    sources.any? { |source| !coverage_contains?(db, user, source, since, until_at) }
  ensure
    db&.close
  end

  def sync_into(db, user, since, until_at, sources, force:, runner: nil)
    totals = {}
    sources.each do |source|
      raise ArgumentError, "Unknown source #{source.inspect}" unless SYNCERS.key?(source)

      if !force && coverage_contains?(db, user, source, since, until_at)
        totals[source] = "skipped-covered"
        next
      end
      window_since, window_until = resolve_sync_window(
        db, user, source, since, until_at, force: force
      )
      added = SYNCERS[source].call(db, user, window_since, window_until, runner: runner)
      span = db.get_first_row(
        "SELECT MIN(occurred_at) AS min_at, MAX(occurred_at) AS max_at FROM activities WHERE user_login=? AND source=?",
        [user, source]
      )
      cover_since = since || window_since || span&.dig("min_at") || utc_now
      cover_until = until_at || window_until || span&.dig("max_at") || utc_now
      mark_coverage(db, user, source, cover_since, cover_until)
      totals[source] = added
    end
    totals
  end

  def cmd_sync(options, runner: nil)
    user = resolve_user(options[:user], runner: runner)
    since = day_bound(options[:since])
    until_at = day_bound(options[:until], end_of_day: true)
    db_path = options[:db] || default_db(user)
    sources = options[:sources] || DEFAULT_SOURCES
    db = connect(db_path)
    totals = sync_into(
      db, user, since, until_at, sources, force: options[:force], runner: runner
    )
    puts JSON.generate({ "user" => user, "db" => db_path, "added" => totals })
    0
  ensure
    db&.close
  end

  def format_range(since, until_at)
    from = since || "…"
    to = until_at || "…"
    "#{from} .. #{to}"
  end

  def print_rows(rows, format, since: nil, until_at: nil)
    case format
    when "json"
      puts JSON.pretty_generate(rows)
    when "ndjson"
      rows.each { |row| puts JSON.generate(row) }
    else
      if rows.empty?
        puts "(no activities)"
      else
        rows.each do |row|
          title = row["title"] || row["summary"] || ""
          printf(
            "%s  %-28s  %-40s  %s\n",
            row["occurred_at"],
            row["event_type"],
            row["repo"] || "-",
            title[0, 80]
          )
        end
      end
    end
    warn "github-user-activity: #{rows.length} row(s) in #{format_range(since, until_at)}"
  end

  def cmd_list(options, runner: nil)
    user = resolve_user(options[:user], runner: runner)
    since = day_bound(options[:since])
    until_at = day_bound(options[:until], end_of_day: true)
    db_path = options[:db] || default_db(user)
    sources = options[:sources] || DEFAULT_SOURCES
    force = options[:force]
    if sync_required?(db_path, user, since, until_at, sources, force: force)
      warn "github-user-activity: syncing #{user} into #{db_path}"
      sync_db = connect(db_path)
      begin
        totals = sync_into(
          sync_db, user, since, until_at, sources, force: force, runner: runner
        )
        warn "github-user-activity: sync added #{JSON.generate(totals)}"
      ensure
        sync_db.close
      end
    end

    list_db = connect(db_path)
    begin
      rows = query_activities(
        list_db,
        user,
        since: since,
        until_at: until_at,
        event_type: options[:type],
        source: options[:source],
        limit: options[:limit] || 500
      )
      print_rows(rows, options[:format], since: since, until_at: until_at)
      0
    ensure
      list_db.close
    end
  end

  def cmd_stats(options, runner: nil)
    user = resolve_user(options[:user], runner: runner)
    db_path = options[:db] || default_db(user)
    raise Errno::ENOENT, "No cache at #{db_path}; run sync first" unless File.file?(db_path)

    db = connect(db_path)
    counts = db.execute(<<~SQL, [user])
      SELECT event_type, COUNT(*) AS count
      FROM activities WHERE user_login = ?
      GROUP BY event_type ORDER BY count DESC, event_type
    SQL
    coverage = db.execute(
      "SELECT source, covered_since, covered_until, updated_at FROM sync_coverage WHERE user_login=?",
      [user]
    )
    puts JSON.pretty_generate(
      "user" => user,
      "db" => db_path,
      "counts" => counts,
      "coverage" => coverage
    )
    0
  ensure
    db&.close
  end

  def parse_argv(argv)
    command = nil
    options = {
      sources: DEFAULT_SOURCES.dup,
      format: "table",
      limit: 500,
      force: false
    }
    global = OptionParser.new do |opts|
      opts.banner = "Usage: github-user-activity [sync|list|stats] [options]"
      opts.on("-h", "--help", "Show help") do
        puts opts
        puts <<~MORE

          Commands:
            sync   Fetch activity into the local SQLite cache
            list   List activity (syncs first when cache/range is missing)
            stats  Show cache counts and coverage
        MORE
        exit 0
      end
    end

    args = argv.dup
    global.order!(args)
    command = args.shift
    raise OptionParser::ParseError, "command required: sync, list, or stats" if command.nil?

    parser = OptionParser.new do |opts|
      opts.banner = "Usage: github-user-activity #{command} [options]"
      opts.on("--user LOGIN", "GitHub login (default: gh api user)") { |v| options[:user] = v }
      opts.on("--db PATH", "SQLite path") { |v| options[:db] = v }
      case command
      when "sync"
        opts.on("--since DATE", "Lower bound YYYY-MM-DD or ISO-8601") { |v| options[:since] = v }
        opts.on("--until DATE", "Upper bound YYYY-MM-DD or ISO-8601") { |v| options[:until] = v }
        opts.on("--sources LIST", "Comma list: events,commits,search,stars") do |v|
          options[:sources] = v.split(",").map(&:strip)
        end
        opts.on("--force", "Refetch even if range is covered") { options[:force] = true }
      when "list"
        opts.on("--since DATE") { |v| options[:since] = v }
        opts.on("--until DATE") { |v| options[:until] = v }
        opts.on("--type TYPE", "Filter event_type") { |v| options[:type] = v }
        opts.on("--source SOURCE", "Filter source") { |v| options[:source] = v }
        opts.on("--sources LIST", "Sources for auto-sync") do |v|
          options[:sources] = v.split(",").map(&:strip)
        end
        opts.on("--force", "Re-sync even when the range looks covered") { options[:force] = true }
        opts.on("--limit N", Integer) { |v| options[:limit] = v }
        opts.on("--format FMT", %w[table json ndjson]) { |v| options[:format] = v }
      when "stats"
        # common flags only
      else
        raise OptionParser::ParseError, "unknown command #{command.inspect}"
      end
    end
    parser.parse!(args)
    [command, options]
  end

  def main(argv = ARGV, runner: nil)
    command, options = parse_argv(argv)
    case command
    when "sync" then cmd_sync(options, runner: runner)
    when "list" then cmd_list(options, runner: runner)
    when "stats" then cmd_stats(options, runner: runner)
    else
      raise OptionParser::ParseError, "unknown command #{command.inspect}"
    end
  rescue OptionParser::ParseError, ArgumentError, RuntimeError, Errno::ENOENT, JSON::ParserError => error
    warn "github-user-activity: #{error.message}"
    1
  end
end

exit GithubUserActivity.main if $PROGRAM_NAME == __FILE__
