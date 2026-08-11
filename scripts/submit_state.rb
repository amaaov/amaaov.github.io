# frozen_string_literal: true

require "fileutils"
require "json"
require "time"

# Local submit ledger for scripts/submit_urls.rb.
# Tracks per-URL × channel attempts so reruns can skip fresh successes
# and retry rate-limited / failed URLs.
#
# Layout (default tmp/seo_submit/):
#   ledger.json       per-URL channel timestamps/status
#   latest.json       last run summary
#   history.ndjson    append-only run summaries
#   retry_queue.txt   URLs needing retry (any channel rate_limited/error)

class SubmitLedger
  DEFAULT_DIR = File.expand_path("../tmp/seo_submit", __dir__)
  DEFAULT_SKIP_DAYS = {
    "indexnow" => 7,
    "archive_org" => 30,
    "archive_today" => 30,
    "ghostarchive" => 30,
    "bing" => 7,
    "brave" => 14,
    "websub" => 1,
    "sitemap_ping" => 1,
    "default" => 7
  }.freeze

  attr_reader :dir, :entries, :run_events

  def self.from_config(config, options = {})
    section = (config["submit_state"] || {}).transform_keys(&:to_s)
    enabled = options.fetch(:state, section.fetch("enabled", true))
    return NullLedger.new unless enabled

    dir = File.expand_path(section.fetch("dir", "tmp/seo_submit"), File.expand_path("..", __dir__))
    skip = DEFAULT_SKIP_DAYS.merge(stringify_keys(section["skip_within_days"] || {}))
    new(dir, skip_within_days: skip, force: options[:force])
  end

  def self.stringify_keys(hash)
    hash.each_with_object({}) { |(k, v), acc| acc[k.to_s] = v }
  end

  def initialize(dir, skip_within_days: DEFAULT_SKIP_DAYS, force: false)
    @dir = dir
    @skip_within_days = skip_within_days
    @force = force
    @entries = {}
    @run_events = []
    @run_started_at = Time.now.utc
    load!
  end

  def ledger_path
    File.join(@dir, "ledger.json")
  end

  def load!
    return unless File.exist?(ledger_path)

    data = JSON.parse(File.read(ledger_path))
    @entries = data.fetch("entries", {})
  rescue JSON::ParserError
    warn "submit state: corrupt ledger at #{ledger_path}; starting fresh"
    @entries = {}
  end

  def channel_family(channel)
    channel.to_s.split(":", 2).first
  end

  def skip_days_for(channel)
    family = channel_family(channel)
    (@skip_within_days[channel.to_s] ||
      @skip_within_days[family] ||
      @skip_within_days["default"] ||
      DEFAULT_SKIP_DAYS["default"]).to_f
  end

  def last_ok_at(url, channel)
    stamp = @entries.dig(url, channel.to_s, "last_ok_at")
    return nil if stamp.nil? || stamp.empty?

    Time.parse(stamp)
  rescue ArgumentError
    nil
  end

  def fresh?(url, channel)
    return false if @force

    ok_at = last_ok_at(url, channel)
    return false if ok_at.nil?

    days = skip_days_for(channel)
    return false if days <= 0

    (Time.now.utc - ok_at) < (days * 24 * 60 * 60)
  end

  def filter(urls, channel:)
    due = []
    skipped = []
    urls.each do |url|
      if fresh?(url, channel)
        skipped << url
      else
        due << url
      end
    end
    { due: due, skipped: skipped }
  end

  def record(url, channel:, status:, detail: nil, http: nil)
    channel = channel.to_s
    url_entry = (@entries[url] ||= {})
    ch = (url_entry[channel] ||= {
      "ok_count" => 0,
      "fail_count" => 0
    })
    now = Time.now.utc.iso8601
    ch["last_attempt_at"] = now
    ch["last_status"] = status.to_s
    ch["last_detail"] = detail
    ch["last_http"] = http
    if status.to_s == "ok"
      ch["last_ok_at"] = now
      ch["ok_count"] = ch.fetch("ok_count", 0) + 1
    else
      ch["fail_count"] = ch.fetch("fail_count", 0) + 1
    end
    @run_events << {
      "url" => url,
      "channel" => channel,
      "status" => status.to_s,
      "detail" => detail,
      "http" => http,
      "at" => now
    }
    ch
  end

  def record_many(urls, channel:, status:, detail: nil, http: nil)
    urls.each { |url| record(url, channel: channel, status: status, detail: detail, http: http) }
  end

  def retry_urls(channels: nil)
    wanted = channels&.map(&:to_s)
    urls = []
    @entries.each do |url, by_channel|
      by_channel.each do |channel, meta|
        next if wanted && !wanted.any? { |c| channel == c || channel.start_with?("#{c}:") }

        status = meta["last_status"].to_s
        next unless %w[error rate_limited].include?(status)

        urls << url
      end
    end
    urls.uniq.sort
  end

  def persist!(extra: {})
    FileUtils.mkdir_p(@dir)
    finished = Time.now.utc

    ledger_payload = {
      "updated_at" => finished.iso8601,
      "entries" => @entries
    }
    File.write(ledger_path, JSON.pretty_generate(ledger_payload))

    counts = Hash.new(0)
    @run_events.each { |e| counts[e["status"]] += 1 }
    by_channel = Hash.new { |h, k| h[k] = Hash.new(0) }
    @run_events.each { |e| by_channel[e["channel"]][e["status"]] += 1 }

    summary = {
      "started_at" => @run_started_at.iso8601,
      "finished_at" => finished.iso8601,
      "force" => @force,
      "event_count" => @run_events.size,
      "status_counts" => counts,
      "by_channel" => by_channel,
      "retry_queue_size" => retry_urls.size,
      "skip_within_days" => @skip_within_days
    }.merge(extra)

    File.write(File.join(@dir, "latest.json"), JSON.pretty_generate(summary.merge("events" => @run_events)))
    File.open(File.join(@dir, "history.ndjson"), "a") { |f| f.puts(JSON.generate(summary)) }

    retry_list = retry_urls
    File.write(File.join(@dir, "retry_queue.txt"), retry_list.empty? ? "" : "#{retry_list.join("\n")}\n")

    warn "submit state: #{ledger_path}"
    warn "submit state: latest + history + retry_queue (#{retry_list.size} URL(s))"
    summary
  end

  def show(limit: 30)
    puts "Submit ledger: #{ledger_path}"
    puts "URLs tracked: #{@entries.size}"
    puts "Retry queue: #{retry_urls.size}"
    rows = []
    @entries.each do |url, by_channel|
      by_channel.each do |channel, meta|
        rows << [meta["last_attempt_at"].to_s, meta["last_status"].to_s, channel, url, meta["last_detail"]]
      end
    end
    rows.sort.reverse.first(limit).each do |at, status, channel, url, detail|
      puts format("%s  %-12s  %-28s  %s%s", at, status, channel, url, detail ? "  (#{detail})" : "")
    end
  end
end

class NullLedger
  def filter(urls, channel:)
    { due: urls, skipped: [] }
  end

  def record(*)
    nil
  end

  def record_many(*)
    nil
  end

  def persist!(*)
    nil
  end

  def retry_urls(*)
    []
  end

  def show(*)
    puts "submit state disabled"
  end

  def force
    false
  end
end
