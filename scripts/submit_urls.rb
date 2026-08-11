#!/usr/bin/env ruby
# frozen_string_literal: true

require "fileutils"
require "json"
require "net/http"
require "rexml/document"
require "time"
require "uri"
require "yaml"
require_relative "submit_state"

SCRIPT_DIR = File.expand_path(__dir__)
ROOT_DIR = File.expand_path("..", SCRIPT_DIR)
DEFAULT_CONFIG = File.join(SCRIPT_DIR, "submit_urls.yml")
CREDENTIALS_DIR = File.join(ROOT_DIR, ".submit_urls")
BING_OAUTH_FILE = File.join(CREDENTIALS_DIR, "bing_oauth.json")
ARCHIVE_CREDENTIALS_FILE = File.join(CREDENTIALS_DIR, "archive_org.json")
PLAYWRIGHT_DIR = File.join(SCRIPT_DIR, "playwright")
PLAYWRIGHT_SCRIPT = File.join(PLAYWRIGHT_DIR, "submit.mjs")
ARCHIVE_DEFAULT_ENDPOINT = "https://web.archive.org/save"
ARCHIVE_DEFAULT_RATE_LIMIT_SECONDS = 5
ARCHIVE_ORG_429_BACKOFF_SECONDS = 60
ARCHIVE_ORG_MAX_RETRIES = 3
BING_AUTHORIZE_URL = "https://www.bing.com/webmasters/oauth/authorize"
BING_TOKEN_URL = "https://www.bing.com/webmasters/oauth/token"
BING_REFRESH_URL = "https://www.bing.com/webmasters/token"
INDEXNOW_DEFAULT_ENDPOINT = "https://api.indexnow.org/indexnow"
INDEXNOW_DEFAULT_ENDPOINTS = [
  INDEXNOW_DEFAULT_ENDPOINT,
  "https://www.bing.com/indexnow",
  "https://yandex.com/indexnow",
  "https://search.seznam.cz/indexnow",
  "https://indexnow.yep.com/indexnow",
  "https://indexnow.amazonbot.amazon/indexnow"
].freeze
INDEXNOW_BATCH_SIZE = 10_000
BING_BATCH_SIZE = 500
WEBSUB_DEFAULT_HUBS = [
  "https://pubsubhubbub.appspot.com/",
  "https://pubsubhubbub.superfeedr.com/"
].freeze
BRAVE_SUBMIT_PAGE = "https://search.brave.com/submit-url"
ARCHIVE_TODAY_HOSTS = %w[
  archive.ph archive.md archive.li archive.vn archive.fo archive.today archive.is
].freeze
ARCHIVE_TODAY_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " \
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
ARCHIVE_TODAY_DEFAULT_RATE_LIMIT_SECONDS = 15
GHOSTARCHIVE_BASE = "https://ghostarchive.org"
GHOSTARCHIVE_SEARCH = "#{GHOSTARCHIVE_BASE}/search"
GHOSTARCHIVE_DEFAULT_RATE_LIMIT_SECONDS = 8
GHOSTARCHIVE_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " \
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
GHOSTARCHIVE_ARCHIVE_HREF = %r{href=["'](/archive/[A-Za-z0-9]+|https?://ghostarchive\.org/archive/[A-Za-z0-9]+)["']}i

def usage
  <<~HELP
    Usage:
      #{File.basename($PROGRAM_NAME)} submit [options] [URL ...]
      #{File.basename($PROGRAM_NAME)} auth bing
      #{File.basename($PROGRAM_NAME)} ping-sitemap
      #{File.basename($PROGRAM_NAME)} show-state

    Submit changed or sitemap URLs to IndexNow (relay + engines), WebSub hubs,
    Internet Archive, archive.today, Ghost Archive, Brave Search
    (manual/open/playwright), and optionally Bing Webmaster API.

    Local state (default on) lives under tmp/seo_submit/:
      ledger.json  per-URL × channel last ok/fail
      latest.json  last run summary + events
      history.ndjson
      retry_queue.txt

    Options for submit:
      --config PATH     Config file (default: scripts/submit_urls.yml)
      --sitemap         Submit all <loc> URLs from configured sitemap
      --file PATH       Read URLs from file (one per line)
      --stdin           Read URLs from stdin (one per line)
      --verify          Keep only URLs that respond with HTTP 200 or 301
      --dry-run         Print actions without sending requests
      --force           Ignore skip_within_days freshness window
      --no-state        Do not read/write submit ledger
      --retry-failed    Only URLs in ledger retry queue (error/rate_limited)
      --indexnow-only   Skip archives, Brave, and Bing
      --archive-only    Skip IndexNow, WebSub, archive.today, Ghost Archive, Brave, Bing
      --archive-today-only  Skip IndexNow, WebSub, archive.org, Ghost Archive, Brave, Bing
      --ghostarchive-only   Skip IndexNow, WebSub, archive.org, archive.today, Brave, Bing
      --brave-only      Skip IndexNow, WebSub, archives, and Bing
      --bing-only       Skip IndexNow, WebSub, archives, and Brave
      --playwright-only Skip IndexNow/WebSub/archives/Bing; run Playwright providers only

    Setup:
      1. Copy scripts/submit_urls.yml.example to scripts/submit_urls.yml
      2. Host IndexNow key file at site root (see indexnow.key in config)
      3. Optional Archive.org: copy scripts/archive_org.json.example to .submit_urls/archive_org.json
         (or set IA_S3_ACCESS_KEY and IA_S3_SECRET_KEY; keys from https://archive.org/account/s3.php)
      4. Optional Bing OAuth: register app in Bing Webmaster Tools, fill client_id/secret, run `auth bing`
      5. Optional archive.today: set archive_today.enabled (rate-limited; may hit CAPTCHA)
      6. Optional Ghost Archive: set ghostarchive.enabled (Playwright; Cloudflare may need --headed)
      7. Optional Brave: set brave.enabled; mode=manual|open|request|playwright
      8. Playwright (no-API UIs): cd scripts/playwright && npm install && npx playwright install chromium
  HELP
end

def load_config(path)
  abort "Config not found: #{path}\nCopy scripts/submit_urls.yml.example to scripts/submit_urls.yml" unless File.exist?(path)

  YAML.load_file(path)
end

def parse_urls_from_sitemap(path)
  doc = REXML::Document.new(File.read(path))
  REXML::XPath.match(doc, "//loc").map(&:text).compact
end

def normalize_urls(urls, site_url)
  base = site_url.chomp("/")
  urls.map(&:strip).reject(&:empty?).map do |url|
    url.start_with?("http") ? url : "#{base}#{url.start_with?('/') ? '' : '/'}#{url}"
  end.uniq
end

def verify_urls(urls)
  urls.select do |url|
    uri = URI(url)
    response = Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https", open_timeout: 10, read_timeout: 10) do |http|
      http.head(uri.request_uri)
    end
    [200, 301].include?(response.code.to_i)
  rescue StandardError => e
    warn "skip #{url}: #{e.message}"
    false
  end
end

def post_json(uri, payload, headers = {})
  request = Net::HTTP::Post.new(uri)
  request["Content-Type"] = "application/json; charset=utf-8"
  headers.each { |key, value| request[key] = value }
  request.body = JSON.generate(payload)

  Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https", open_timeout: 30, read_timeout: 60) do |http|
    http.request(request)
  end
end

def post_form(uri, params, headers = {})
  request = Net::HTTP::Post.new(uri)
  request["Content-Type"] = "application/x-www-form-urlencoded"
  headers.each { |key, value| request[key] = value }
  request.body = URI.encode_www_form(params)

  Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https", open_timeout: 30, read_timeout: 120) do |http|
    http.request(request)
  end
end

def get_request(uri, headers = {}, cookies: {})
  request = Net::HTTP::Get.new(uri)
  headers.each { |key, value| request[key] = value }
  request["Cookie"] = cookie_header(cookies) unless cookies.empty?

  Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https", open_timeout: 30, read_timeout: 60) do |http|
    http.request(request)
  end
end

def cookie_header(cookies)
  cookies.map { |name, value| "#{name}=#{value}" }.join("; ")
end

def merge_cookies(cookies, response)
  merged = cookies.dup
  response.get_fields("set-cookie")&.each do |cookie|
    name, value = cookie.split(";", 2).first.split("=", 2)
    merged[name] = value if name && value
  end
  merged
end

def archive_today_uniform(url)
  url.to_s.strip.gsub(" ", "_")
end

def archive_today_extract_submitid(html)
  match = html.match(/name="submitid"[^>]*value="([^"]+)"/)
  match&.captures&.first
end

def archive_today_pick_host(config)
  archive = config.fetch("archive_today", {})
  hosts = archive.fetch("hosts", ARCHIVE_TODAY_HOSTS)
  headers = { "User-Agent" => ARCHIVE_TODAY_USER_AGENT }

  hosts.each do |host|
    uri = URI("https://#{host}/")
    puts "archive.today: probing #{host}"
    response = get_request(uri, headers)
    next unless response.is_a?(Net::HTTPSuccess)

    submitid = archive_today_extract_submitid(response.body)
    next if submitid.nil? || submitid.empty?

    puts "  using #{host}"
    return [host, submitid, merge_cookies({}, response)]
  rescue StandardError => e
    warn "  #{host}: #{e.message}"
  end

  nil
end

def archive_today_timemap_count(url, host)
  uri = URI("https://#{host}/timemap/#{archive_today_uniform(url)}")
  response = get_request(uri, { "User-Agent" => ARCHIVE_TODAY_USER_AGENT })
  return 0 if response.code.to_i == 204

  response.is_a?(Net::HTTPSuccess) ? response.body.lines.count { |line| line.start_with?("http") } : 0
rescue StandardError
  0
end

def archive_today_saved_location(response)
  refresh = response["Refresh"]
  return refresh.split(";url=", 2)[1] if refresh&.include?(";url=")

  location = response["Location"]
  return location if location && !location.empty?

  nil
end

def submit_archive_today_url(host, submitid, cookies, url, dry_run:)
  endpoint = URI("https://#{host}/submit/")
  params = { "submitid" => submitid, "url" => url }
  headers = {
    "User-Agent" => ARCHIVE_TODAY_USER_AGENT,
    "Origin" => "https://#{host}",
    "Referer" => "https://#{host}/"
  }

  puts "archive.today: #{url}"
  if dry_run
    puts "  POST #{endpoint}"
    puts "  #{params.inspect}"
    return true
  end

  response = post_form(endpoint, params, headers.merge("Cookie" => cookie_header(cookies)))
  code = response.code.to_i
  puts "  HTTP #{code} #{response.message}"

  if code == 503
    warn "  rate limited (archive.today often returns 503 instead of 429)"
    return false
  end

  saved = archive_today_saved_location(response)
  if saved
    puts "  archived: #{saved}"
    return true
  end

  warn "  #{response.body[0, 300]}" unless response.is_a?(Net::HTTPSuccess)
  false
end

def note_skips(channel, skipped)
  return if skipped.nil? || skipped.empty?

  puts "#{channel}: skipped #{skipped.size} fresh URL(s) (within skip_within_days; use --force to override)"
end

def ghostarchive_normalize_href(href)
  return nil if href.nil? || href.empty?
  return nil unless href.include?("/archive/")
  return nil if href.include?("/replay/")

  if href.start_with?("/")
    "#{GHOSTARCHIVE_BASE}#{href}"
  elsif href.start_with?("http://ghostarchive.org")
    href.sub("http://", "https://")
  elsif href.start_with?("https://ghostarchive.org")
    href
  end
end

def ghostarchive_find_existing(url)
  uri = URI(GHOSTARCHIVE_SEARCH)
  uri.query = URI.encode_www_form("term" => url)
  response = get_request(uri, { "User-Agent" => GHOSTARCHIVE_USER_AGENT })
  return nil unless response.is_a?(Net::HTTPSuccess)

  response.body.to_enum(:scan, GHOSTARCHIVE_ARCHIVE_HREF).map { Regexp.last_match(1) }.each do |href|
    archive_url = ghostarchive_normalize_href(href)
    return archive_url if archive_url
  end
  nil
rescue StandardError
  nil
end

def submit_ghostarchive(config, urls, dry_run:, ledger: NullLedger.new)
  archive = config.fetch("ghostarchive", {})
  return if archive.fetch("enabled", false) != true

  rate_limit = archive.fetch("rate_limit_seconds", GHOSTARCHIVE_DEFAULT_RATE_LIMIT_SECONDS).to_f
  skip_existing = archive.fetch("skip_if_archived", true)
  max_urls = archive.fetch("max_urls", 0).to_i
  urls = urls.first(max_urls) if max_urls.positive?

  filtered = ledger.filter(urls, channel: "ghostarchive")
  note_skips("Ghost Archive", filtered[:skipped])
  filtered[:skipped].each { |url| ledger.record(url, channel: "ghostarchive", status: "skipped", detail: "fresh") }
  urls = filtered[:due]
  return if urls.empty?

  due = []
  urls.each do |url|
    if skip_existing && !dry_run
      existing = ghostarchive_find_existing(url)
      if existing
        puts "Ghost Archive: #{url}"
        puts "  already archived: #{existing}"
        ledger.record(url, channel: "ghostarchive", status: "ok", detail: "already_archived:#{existing}")
        next
      end
    end
    due << url
  end
  return if due.empty?

  ok = submit_via_playwright(
    "ghostarchive",
    due,
    dry_run: dry_run,
    submit_page: archive.fetch("submit_page", "#{GHOSTARCHIVE_BASE}/"),
    delay: rate_limit,
    headed: archive.fetch("headed", false),
    slow_mo: archive.fetch("slow_mo_ms", 0).to_i,
    timeout_ms: archive.fetch("timeout_ms", 60_000).to_i,
    results_path: archive["results_path"]
  )
  status = ok || dry_run ? "ok" : "error"
  ledger.record_many(due, channel: "ghostarchive", status: status, detail: "playwright")
end

def submit_archive_today(config, urls, dry_run:, ledger: NullLedger.new)
  archive = config.fetch("archive_today", {})
  return if archive.fetch("enabled", false) != true

  rate_limit = archive.fetch("rate_limit_seconds", ARCHIVE_TODAY_DEFAULT_RATE_LIMIT_SECONDS).to_f
  skip_existing = archive.fetch("skip_if_archived", true)
  max_urls = archive.fetch("max_urls", 0).to_i
  urls = urls.first(max_urls) if max_urls.positive?

  filtered = ledger.filter(urls, channel: "archive_today")
  note_skips("archive.today", filtered[:skipped])
  filtered[:skipped].each { |url| ledger.record(url, channel: "archive_today", status: "skipped", detail: "fresh") }
  urls = filtered[:due]
  return if urls.empty?

  if dry_run
    host = archive.fetch("hosts", ARCHIVE_TODAY_HOSTS).first
    urls.each do |url|
      puts "archive.today: #{url}"
      puts "  POST https://#{host}/submit/"
      puts "  {\"submitid\" => \"...\", \"url\" => \"#{url}\"}"
    end
    return
  end

  host_info = archive_today_pick_host(config)
  if host_info.nil?
    warn "archive.today: skipped (no responding host; DNS or service outage)"
    ledger.record_many(urls, channel: "archive_today", status: "error", detail: "no_host")
    return
  end

  host, submitid, cookies = host_info

  urls.each_with_index do |url, index|
    sleep(rate_limit) if index.positive? && !dry_run

    if skip_existing && !dry_run
      count = archive_today_timemap_count(url, host)
      if count.positive?
        puts "archive.today: #{url}"
        puts "  skipped (#{count} existing snapshot(s))"
        ledger.record(url, channel: "archive_today", status: "ok", detail: "already_archived:#{count}")
        next
      end
    end

    success = submit_archive_today_url(host, submitid, cookies, url, dry_run: dry_run)
    if success
      ledger.record(url, channel: "archive_today", status: "ok")
    else
      ledger.record(url, channel: "archive_today", status: "rate_limited", detail: "submit_failed", http: 503)
      sleep(rate_limit * 4) unless dry_run
    end
  end
end

def submit_brave(config, urls, dry_run:, ledger: NullLedger.new)
  brave = config.fetch("brave", {})
  return if brave.fetch("enabled", false) != true

  max_urls = brave.fetch("max_urls", 10).to_i
  urls = urls.first(max_urls) if max_urls.positive?
  mode = brave.fetch("mode", "manual")
  endpoint = brave["endpoint"]
  rate_limit = brave.fetch("rate_limit_seconds", 2).to_f
  submit_page = brave.fetch("submit_page", BRAVE_SUBMIT_PAGE)

  filtered = ledger.filter(urls, channel: "brave")
  note_skips("Brave", filtered[:skipped])
  filtered[:skipped].each { |url| ledger.record(url, channel: "brave", status: "skipped", detail: "fresh") }
  urls = filtered[:due]
  return if urls.empty?

  if mode == "playwright"
    ok = submit_via_playwright(
      "brave",
      urls,
      dry_run: dry_run,
      submit_page: submit_page,
      delay: brave.fetch("rate_limit_seconds", 3).to_f,
      headed: brave.fetch("headed", false),
      slow_mo: brave.fetch("slow_mo_ms", 0).to_i,
      timeout_ms: brave.fetch("timeout_ms", 30_000).to_i,
      results_path: brave["results_path"]
    )
    status = ok || dry_run ? "ok" : "error"
    ledger.record_many(urls, channel: "brave", status: status, detail: "playwright")
    return
  end

  if mode == "open"
    puts "Brave: opening #{submit_page}"
    if dry_run
      puts "  open #{submit_page}"
    elsif RUBY_PLATFORM.include?("darwin")
      system("open", submit_page)
    else
      warn "Brave open mode needs macOS `open` or set brave.mode to manual"
    end
    ledger.record_many(urls, channel: "brave", status: "ok", detail: "open_ui")
    return
  end

  if mode == "request" && endpoint && !endpoint.empty?
    uri = URI(endpoint)
    urls.each_with_index do |url, index|
      sleep(rate_limit) if index.positive? && !dry_run
      params = brave.fetch("params", { "url" => url })
      params = params.merge("url" => url) unless params.key?("url")

      puts "Brave: #{url} -> #{uri}"
      if dry_run
        puts "  #{params.inspect}"
        next
      end

      response = post_form(uri, params, brave.fetch("headers", {}))
      puts "  HTTP #{response.code} #{response.message}"
      ok = [200, 202, 204].include?(response.code.to_i)
      warn "  #{response.body[0, 300]}" unless ok
      ledger.record(url, channel: "brave", status: ok ? "ok" : "error", http: response.code.to_i)
    end
    return
  end

  puts "Brave: no public submit API; use #{submit_page} manually for each URL"
  puts "  tip: set brave.mode: playwright after scripts/playwright npm install"
  urls.each do |url|
    puts "  #{url}"
  end
  ledger.record_many(urls, channel: "brave", status: "ok", detail: "manual_list")
end

def which_command(name)
  ENV["PATH"].to_s.split(File::PATH_SEPARATOR).each do |dir|
    candidate = File.join(dir, name)
    return candidate if File.executable?(candidate)
  end
  nil
end

def submit_via_playwright(provider, urls, dry_run:, submit_page: nil, delay: 3.0, headed: false, slow_mo: 0, timeout_ms: 30_000, results_path: nil)
  abort "Playwright helper missing: #{PLAYWRIGHT_SCRIPT}" unless File.exist?(PLAYWRIGHT_SCRIPT)

  node = which_command("node")
  abort "node not found on PATH (needed for Playwright submit)" if node.nil?

  unless Dir.exist?(File.join(PLAYWRIGHT_DIR, "node_modules", "playwright"))
    abort "Playwright deps missing. Run:\n  cd #{PLAYWRIGHT_DIR} && npm install && npx playwright install chromium"
  end

  require "tempfile"
  Tempfile.create(["playwright-urls", ".txt"]) do |file|
    urls.each { |url| file.puts(url) }
    file.flush

    cmd = [
      node,
      PLAYWRIGHT_SCRIPT,
      "--provider", provider,
      "--urls-file", file.path,
      "--delay", delay.to_s,
      "--timeout", timeout_ms.to_s
    ]
    cmd += ["--submit-page", submit_page] if submit_page && !submit_page.empty?
    cmd << "--headed" if headed
    cmd += ["--slow-mo", slow_mo.to_s] if slow_mo.positive?
    cmd << "--dry-run" if dry_run
    if results_path && !results_path.empty?
      path = File.expand_path(results_path, ROOT_DIR)
      FileUtils.mkdir_p(File.dirname(path))
      cmd += ["--results", path]
    end

    puts "Playwright: #{provider} (#{urls.size} URL(s))"
    puts "  #{cmd.join(' ')}" if dry_run
    return true if dry_run

    ok = system(*cmd)
    warn "Playwright submit exited non-zero for #{provider}" unless ok
    ok
  end
end

def submit_playwright_providers(config, urls, dry_run:, ledger: NullLedger.new)
  section = config.fetch("playwright", {})
  return if section.fetch("enabled", false) != true

  providers = section.fetch("providers", [])
  return if providers.nil? || providers.empty?

  providers.each do |entry|
    entry = entry.transform_keys(&:to_s)
    name = entry.fetch("name")
    channel = "playwright:#{name}"
    max_urls = entry.fetch("max_urls", section.fetch("max_urls", 0)).to_i
    batch = max_urls.positive? ? urls.first(max_urls) : urls
    filtered = ledger.filter(batch, channel: channel)
    note_skips(channel, filtered[:skipped])
    filtered[:skipped].each { |url| ledger.record(url, channel: channel, status: "skipped", detail: "fresh") }
    due = filtered[:due]
    next if due.empty?

    ok = submit_via_playwright(
      name,
      due,
      dry_run: dry_run,
      submit_page: entry["submit_page"],
      delay: entry.fetch("rate_limit_seconds", section.fetch("rate_limit_seconds", 3)).to_f,
      headed: entry.fetch("headed", section.fetch("headed", false)),
      slow_mo: entry.fetch("slow_mo_ms", section.fetch("slow_mo_ms", 0)).to_i,
      timeout_ms: entry.fetch("timeout_ms", section.fetch("timeout_ms", 30_000)).to_i,
      results_path: entry["results_path"] || section["results_path"]
    )
    ledger.record_many(due, channel: channel, status: (ok || dry_run ? "ok" : "error"), detail: "playwright")
  end
end

def load_archive_credentials(config)
  archive = config.fetch("archive_org", {})
  access_key = ENV["IA_S3_ACCESS_KEY"] || archive["access_key"]
  secret_key = ENV["IA_S3_SECRET_KEY"] || archive["secret_key"]

  if access_key.to_s.empty? || secret_key.to_s.empty?
    return nil unless File.exist?(ARCHIVE_CREDENTIALS_FILE)

    data = JSON.parse(File.read(ARCHIVE_CREDENTIALS_FILE))
    access_key = data["access_key"] || data["s3_access_key"]
    secret_key = data["secret_key"] || data["s3_secret_key"]
  end

  return nil if access_key.to_s.empty? || secret_key.to_s.empty?

  { "access_key" => access_key, "secret_key" => secret_key }
end

def archive_auth_header(credentials)
  { "Authorization" => "LOW #{credentials.fetch('access_key')}:#{credentials.fetch('secret_key')}" }
end

def poll_archive_status(job_id, credentials, archive)
  status_uri = URI("#{archive.fetch('endpoint', ARCHIVE_DEFAULT_ENDPOINT).chomp('/')}/status/#{job_id}")
  headers = { "Accept" => "application/json" }.merge(archive_auth_header(credentials))
  max_attempts = archive.fetch("status_poll_attempts", 30).to_i
  interval = archive.fetch("status_poll_seconds", 2).to_f

  max_attempts.times do |attempt|
    sleep(interval) if attempt.positive?

    response = get_request(status_uri, headers)
    unless response.is_a?(Net::HTTPSuccess)
      warn "  status check failed: HTTP #{response.code}"
      return
    end

    data = JSON.parse(response.body)
    status = data["status"]
    puts "  status=#{status}"

    case status
    when "success"
      timestamp = data["timestamp"]
      original_url = data["original_url"]
      puts "  archived: https://web.archive.org/web/#{timestamp}/#{original_url}"
      return
    when "error"
      warn "  #{data['message'] || data['status_ext'] || data}"
      return
    end
  end

  warn "  timed out waiting for capture"
rescue JSON::ParserError
  warn "  invalid status response"
end

def submit_archive_org(config, urls, dry_run:, ledger: NullLedger.new)
  archive = config.fetch("archive_org", {})
  return if archive.fetch("enabled", false) != true

  credentials = load_archive_credentials(config)
  if credentials.nil?
    warn "archive_org: skipped (no credentials; copy scripts/archive_org.json.example to .submit_urls/archive_org.json)"
    return
  end

  endpoint = URI(archive.fetch("endpoint", ARCHIVE_DEFAULT_ENDPOINT))
  rate_limit = archive.fetch("rate_limit_seconds", ARCHIVE_DEFAULT_RATE_LIMIT_SECONDS).to_f
  wait = archive.fetch("wait_for_status", false)
  backoff = archive.fetch("rate_limit_backoff_seconds", ARCHIVE_ORG_429_BACKOFF_SECONDS).to_f
  max_retries = archive.fetch("max_retries", ARCHIVE_ORG_MAX_RETRIES).to_i
  options = archive.fetch("options", {}).transform_keys(&:to_s).transform_values(&:to_s)

  filtered = ledger.filter(urls, channel: "archive_org")
  note_skips("Archive.org", filtered[:skipped])
  filtered[:skipped].each { |url| ledger.record(url, channel: "archive_org", status: "skipped", detail: "fresh") }
  urls = filtered[:due]
  return if urls.empty?

  urls.each_with_index do |url, index|
    sleep(rate_limit) if index.positive? && !dry_run

    params = options.merge("url" => url)
    headers = { "Accept" => "application/json" }.merge(archive_auth_header(credentials))

    puts "Archive.org: #{url}"
    if dry_run
      puts "  POST #{endpoint}"
      puts "  #{params.inspect}"
      next
    end

    attempt = 0
    loop do
      response = post_form(endpoint, params, headers)
      code = response.code.to_i
      puts "  HTTP #{code} #{response.message}"

      if code == 429
        attempt += 1
        detail = begin
          JSON.parse(response.body)["message"]
        rescue StandardError
          "session_limit"
        end
        if attempt <= max_retries
          warn "  rate limited; backoff #{backoff}s (retry #{attempt}/#{max_retries})"
          sleep(backoff)
          next
        end
        warn "  #{response.body}"
        ledger.record(url, channel: "archive_org", status: "rate_limited", detail: detail, http: 429)
        break
      end

      unless response.is_a?(Net::HTTPSuccess)
        warn "  #{response.body}"
        ledger.record(url, channel: "archive_org", status: "error", detail: response.message, http: code)
        break
      end

      begin
        data = JSON.parse(response.body)
      rescue JSON::ParserError
        warn "  invalid JSON: #{response.body[0, 200]}"
        ledger.record(url, channel: "archive_org", status: "error", detail: "invalid_json", http: code)
        break
      end

      job_id = data["job_id"]
      if job_id.nil?
        puts "  #{data}"
        ledger.record(url, channel: "archive_org", status: "error", detail: "no_job_id", http: code)
        break
      end

      puts "  job_id=#{job_id}"
      poll_archive_status(job_id, credentials, archive) if wait
      ledger.record(url, channel: "archive_org", status: "ok", detail: "job_id=#{job_id}", http: code)
      break
    end
  end
end

def indexnow_endpoints(config)
  indexnow = config.fetch("indexnow", {})
  endpoints = indexnow["endpoints"]
  if endpoints.nil? || endpoints.empty?
    single = indexnow["endpoint"]
    return [single] if single && !single.empty?

    return INDEXNOW_DEFAULT_ENDPOINTS
  end

  endpoints
end

def indexnow_success?(response)
  code = response.code.to_i
  code == 200 || code == 202
end

def indexnow_channel(endpoint_url)
  host = URI(endpoint_url).host
  "indexnow:#{host}"
end

def submit_indexnow(config, urls, dry_run:, ledger: NullLedger.new)
  indexnow = config.fetch("indexnow", {})
  return if indexnow.fetch("enabled", true) == false

  key = indexnow["key"]
  host = indexnow["host"] || URI(config.fetch("site_url")).host
  key_location = indexnow["key_location"] || "#{config.fetch('site_url').chomp('/')}/#{key}.txt"
  batch_size = indexnow.fetch("batch_size", INDEXNOW_BATCH_SIZE).to_i

  abort "indexnow.key missing in config" if key.nil? || key.empty?

  indexnow_endpoints(config).each do |endpoint_url|
    channel = indexnow_channel(endpoint_url)
    filtered = ledger.filter(urls, channel: channel)
    note_skips(channel, filtered[:skipped])
    filtered[:skipped].each { |url| ledger.record(url, channel: channel, status: "skipped", detail: "fresh") }
    due = filtered[:due]
    next if due.empty?

    endpoint = URI(endpoint_url)
    due.each_slice(batch_size).with_index(1) do |batch, index|
      payload = {
        "host" => host,
        "key" => key,
        "keyLocation" => key_location,
        "urlList" => batch
      }

      puts "IndexNow batch #{index}: #{batch.size} URL(s) -> #{endpoint}"
      if dry_run
        puts JSON.pretty_generate(payload)
        next
      end

      response = post_json(endpoint, payload)
      puts "  HTTP #{response.code} #{response.message}"
      if indexnow_success?(response)
        ledger.record_many(batch, channel: channel, status: "ok", http: response.code.to_i)
      else
        warn "  #{response.body[0, 300]}"
        ledger.record_many(batch, channel: channel, status: "error", detail: response.message, http: response.code.to_i)
      end
    end
  end
end

def submit_websub(config, dry_run:, ledger: NullLedger.new)
  websub = config.fetch("websub", {})
  return if websub.fetch("enabled", true) == false

  feed_url = websub["feed_url"] || "#{config.fetch('site_url').chomp('/')}/feed.xml"
  hubs = websub.fetch("hubs", WEBSUB_DEFAULT_HUBS)

  hubs.each do |hub_url|
    channel = "websub:#{URI(hub_url).host}"
    filtered = ledger.filter([feed_url], channel: channel)
    if filtered[:due].empty?
      note_skips(channel, filtered[:skipped])
      filtered[:skipped].each { |url| ledger.record(url, channel: channel, status: "skipped", detail: "fresh") }
      next
    end

    endpoint = URI(hub_url)
    params = { "hub.mode" => "publish", "hub.url" => feed_url }
    puts "WebSub publish: #{feed_url} -> #{endpoint}"
    if dry_run
      puts "  #{params.inspect}"
      next
    end

    response = post_form(endpoint, params)
    puts "  HTTP #{response.code} #{response.message}"
    ok = [200, 202, 204].include?(response.code.to_i)
    warn "  #{response.body[0, 300]}" unless ok
    ledger.record(feed_url, channel: channel, status: ok ? "ok" : "error", http: response.code.to_i)
  end
end

def load_bing_tokens
  return nil unless File.exist?(BING_OAUTH_FILE)

  JSON.parse(File.read(BING_OAUTH_FILE))
end

def save_bing_tokens(tokens)
  FileUtils.mkdir_p(CREDENTIALS_DIR)
  File.write(BING_OAUTH_FILE, JSON.pretty_generate(tokens))
  File.chmod(0o600, BING_OAUTH_FILE)
end

def bing_form_post(uri, params)
  request = Net::HTTP::Post.new(uri)
  request["Content-Type"] = "application/x-www-form-urlencoded"
  request.body = URI.encode_www_form(params)

  Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https", open_timeout: 30, read_timeout: 60) do |http|
    http.request(request)
  end
end

def refresh_bing_access_token(config, tokens)
  bing = config.fetch("bing", {})
  response = bing_form_post(
    URI(BING_REFRESH_URL),
    {
      "client_id" => bing.fetch("client_id"),
      "client_secret" => bing.fetch("client_secret"),
      "grant_type" => "refresh_token",
      "refresh_token" => tokens.fetch("refresh_token")
    }
  )

  abort "Bing token refresh failed: HTTP #{response.code} #{response.body}" unless response.is_a?(Net::HTTPSuccess)

  data = JSON.parse(response.body)
  tokens["access_token"] = data.fetch("access_token")
  tokens["expires_at"] = Time.now.to_i + data.fetch("expires_in", 3600).to_i
  save_bing_tokens(tokens)
  tokens
end

def bing_access_token(config)
  bing = config.fetch("bing", {})
  abort "bing.client_id and bing.client_secret required in config" if bing["client_id"].to_s.empty? || bing["client_secret"].to_s.empty?

  tokens = load_bing_tokens
  abort "Bing OAuth not set up. Run: #{File.basename($PROGRAM_NAME)} auth bing" if tokens.nil?

  if tokens["expires_at"].to_i <= Time.now.to_i + 60
    tokens = refresh_bing_access_token(config, tokens)
  end

  tokens.fetch("access_token")
end

def submit_bing(config, urls, dry_run:, ledger: NullLedger.new)
  bing = config.fetch("bing", {})
  return if bing.fetch("enabled", false) != true

  site_url = config.fetch("site_url")
  batch_size = bing.fetch("batch_size", BING_BATCH_SIZE).to_i
  endpoint = URI("https://www.bing.com/webmaster/api.svc/json/SubmitUrlBatch")

  filtered = ledger.filter(urls, channel: "bing")
  note_skips("Bing", filtered[:skipped])
  filtered[:skipped].each { |url| ledger.record(url, channel: "bing", status: "skipped", detail: "fresh") }
  urls = filtered[:due]
  return if urls.empty?

  access_token = bing_access_token(config) unless dry_run

  urls.each_slice(batch_size).with_index(1) do |batch, index|
    payload = {
      "siteUrl" => site_url,
      "urlList" => batch
    }

    puts "Bing batch #{index}: #{batch.size} URL(s)"
    if dry_run
      puts JSON.pretty_generate(payload)
      next
    end

    response = post_json(endpoint, payload, { "Authorization" => "Bearer #{access_token}" })
    puts "  HTTP #{response.code} #{response.message}"
    if response.is_a?(Net::HTTPSuccess)
      ledger.record_many(batch, channel: "bing", status: "ok", http: response.code.to_i)
    else
      warn "  #{response.body}"
      ledger.record_many(batch, channel: "bing", status: "error", detail: response.message, http: response.code.to_i)
    end
  end
end

def ping_sitemap(config, dry_run:)
  ping = config.fetch("sitemap_ping", {})
  return if ping.fetch("enabled", true) == false

  sitemap_url = "#{config.fetch('site_url').chomp('/')}/#{config.fetch('sitemap', 'sitemap.xml')}"
  endpoints = ping.fetch("endpoints", ["https://www.bing.com/ping?sitemap="])

  endpoints.each do |template|
    target = URI("#{template}#{URI.encode_www_form_component(sitemap_url)}")
    puts "Sitemap ping: #{target}"
    next if dry_run

    response = Net::HTTP.get_response(target)
    puts "  HTTP #{response.code} #{response.message}"
  end
end

def run_auth_bing(config)
  require "webrick"

  bing = config.fetch("bing", {})
  client_id = bing["client_id"]
  client_secret = bing["client_secret"]
  redirect_uri = bing.fetch("redirect_uri", "http://127.0.0.1:8765/callback")

  abort "Set bing.client_id and bing.client_secret in config first" if client_id.to_s.empty? || client_secret.to_s.empty?

  auth_uri = URI(BING_AUTHORIZE_URL)
  auth_uri.query = URI.encode_www_form(
    response_type: "code",
    client_id: client_id,
    redirect_uri: redirect_uri,
    scope: bing.fetch("scope", "webmaster.manage")
  )

  code = nil
  server = WEBrick::HTTPServer.new(Port: URI(redirect_uri).port, BindAddress: "127.0.0.1", Logger: WEBrick::Log.new($stderr, WEBrick::BasicLog::FATAL))
  server.mount_proc URI(redirect_uri).path do |req, res|
    if req.query["error"]
      res.status = 400
      res.body = "Authorization failed: #{req.query['error']}"
      server.shutdown
    elsif req.query["code"]
      code = req.query["code"]
      res.status = 200
      res["Content-Type"] = "text/plain"
      res.body = "Bing authorization complete. You can close this tab."
      Thread.new { sleep 1; server.shutdown }
    else
      res.status = 400
      res.body = "Missing authorization code"
      server.shutdown
    end
  end

  puts "Open this URL in your browser:\n#{auth_uri}"
  server.start
  abort "No authorization code received" if code.nil?

  response = bing_form_post(
    URI(BING_TOKEN_URL),
    {
      "client_id" => client_id,
      "client_secret" => client_secret,
      "code" => code,
      "grant_type" => "authorization_code",
      "redirect_uri" => redirect_uri
    }
  )

  abort "Token exchange failed: HTTP #{response.code} #{response.body}" unless response.is_a?(Net::HTTPSuccess)

  data = JSON.parse(response.body)
  tokens = {
    "access_token" => data.fetch("access_token"),
    "refresh_token" => data.fetch("refresh_token"),
    "expires_at" => Time.now.to_i + data.fetch("expires_in", 3600).to_i
  }
  save_bing_tokens(tokens)
  puts "Saved Bing OAuth tokens to #{BING_OAUTH_FILE}"
end

def parse_submit_options(args)
  options = {
    sitemap: false,
    file: nil,
    stdin: false,
    verify: false,
    dry_run: false,
    force: false,
    state: true,
    retry_failed: false,
    indexnow_only: false,
    archive_only: false,
    archive_today_only: false,
    ghostarchive_only: false,
    brave_only: false,
    bing_only: false,
    playwright_only: false,
    config: DEFAULT_CONFIG,
    urls: []
  }

  until args.empty?
    case args.first
    when "--config" then options[:config] = args[1]; args.shift(2)
    when "--sitemap" then options[:sitemap] = true; args.shift
    when "--file" then options[:file] = args[1]; args.shift(2)
    when "--stdin" then options[:stdin] = true; args.shift
    when "--verify" then options[:verify] = true; args.shift
    when "--dry-run" then options[:dry_run] = true; args.shift
    when "--force" then options[:force] = true; args.shift
    when "--no-state" then options[:state] = false; args.shift
    when "--retry-failed" then options[:retry_failed] = true; args.shift
    when "--indexnow-only" then options[:indexnow_only] = true; args.shift
    when "--archive-only" then options[:archive_only] = true; args.shift
    when "--archive-today-only" then options[:archive_today_only] = true; args.shift
    when "--ghostarchive-only" then options[:ghostarchive_only] = true; args.shift
    when "--brave-only" then options[:brave_only] = true; args.shift
    when "--bing-only" then options[:bing_only] = true; args.shift
    when "--playwright-only" then options[:playwright_only] = true; args.shift
    when "-h", "--help" then puts usage; exit 0
    else
      options[:urls] << args.shift
    end
  end

  options
end

def collect_urls(options, ledger: nil)
  config = load_config(options[:config])
  urls = options[:urls].dup

  if options[:retry_failed]
    abort "submit state disabled; cannot use --retry-failed" if ledger.nil? || ledger.is_a?(NullLedger)

    queue_path = File.join(ledger.dir, "retry_queue.txt")
    queued = ledger.retry_urls
    if File.exist?(queue_path)
      queued |= File.readlines(queue_path, chomp: true).map(&:strip).reject(&:empty?)
    end
    urls.concat(queued)
    puts "Retry queue: #{queued.size} URL(s)"
  elsif options[:sitemap] || (urls.empty? && !options[:file] && !options[:stdin])
    sitemap_path = File.join(ROOT_DIR, config.fetch("sitemap", "sitemap.xml"))
    abort "Sitemap not found: #{sitemap_path}" unless File.exist?(sitemap_path)
    urls.concat(parse_urls_from_sitemap(sitemap_path))
  end

  if options[:file]
    abort "File not found: #{options[:file]}" unless File.exist?(options[:file])
    urls.concat(File.readlines(options[:file], chomp: true))
  end

  urls.concat($stdin.each_line.map(&:chomp)) if options[:stdin]

  urls = normalize_urls(urls, config.fetch("site_url"))
  urls = verify_urls(urls) if options[:verify]
  abort "No URLs to submit" if urls.empty?

  [config, urls]
end

def main(argv)
  command = argv.shift || "submit"

  case command
  when "submit"
    options = parse_submit_options(argv)
    config_for_state = load_config(options[:config])
    ledger = SubmitLedger.from_config(config_for_state, state: options[:state], force: options[:force])
    config, urls = collect_urls(options, ledger: ledger)

    puts "Submitting #{urls.size} URL(s)"
    if options[:playwright_only]
      submit_brave(config, urls, dry_run: options[:dry_run], ledger: ledger)
      submit_playwright_providers(config, urls, dry_run: options[:dry_run], ledger: ledger)
    else
      unless options[:bing_only] || options[:archive_only] || options[:archive_today_only] || options[:ghostarchive_only] || options[:brave_only]
        submit_indexnow(config, urls, dry_run: options[:dry_run], ledger: ledger)
        submit_websub(config, dry_run: options[:dry_run], ledger: ledger)
      end
      unless options[:indexnow_only] || options[:bing_only] || options[:brave_only] || options[:archive_today_only] || options[:ghostarchive_only]
        submit_archive_org(config, urls, dry_run: options[:dry_run], ledger: ledger)
      end
      unless options[:indexnow_only] || options[:bing_only] || options[:brave_only] || options[:archive_only] || options[:ghostarchive_only]
        submit_archive_today(config, urls, dry_run: options[:dry_run], ledger: ledger)
      end
      unless options[:indexnow_only] || options[:bing_only] || options[:brave_only] || options[:archive_only] || options[:archive_today_only]
        submit_ghostarchive(config, urls, dry_run: options[:dry_run], ledger: ledger)
      end
      unless options[:indexnow_only] || options[:archive_only] || options[:archive_today_only] || options[:ghostarchive_only] || options[:bing_only]
        submit_brave(config, urls, dry_run: options[:dry_run], ledger: ledger)
        submit_playwright_providers(config, urls, dry_run: options[:dry_run], ledger: ledger)
      end
      unless options[:indexnow_only] || options[:archive_only] || options[:archive_today_only] || options[:ghostarchive_only] || options[:brave_only]
        submit_bing(config, urls, dry_run: options[:dry_run], ledger: ledger)
      end
    end

    if options[:state] && !options[:dry_run]
      ledger.persist!(extra: { "url_count" => urls.size, "dry_run" => false })
    end
  when "show-state"
    config = load_config(DEFAULT_CONFIG)
    ledger = SubmitLedger.from_config(config, state: true, force: false)
    ledger.show
  when "auth"
    sub = argv.shift
    abort usage unless sub == "bing"

    config = load_config(DEFAULT_CONFIG)
    run_auth_bing(config)
  when "ping-sitemap"
    dry_run = argv.include?("--dry-run")
    config = load_config(DEFAULT_CONFIG)
    ping_sitemap(config, dry_run: dry_run)
  when "-h", "--help", "help"
    puts usage
  else
    abort "Unknown command: #{command}\n\n#{usage}"
  end
end

main(ARGV) if __FILE__ == $PROGRAM_NAME
