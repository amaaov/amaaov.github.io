#!/usr/bin/env ruby
# frozen_string_literal: true

require "fileutils"
require "json"
require "net/http"
require "rexml/document"
require "uri"
require "yaml"

SCRIPT_DIR = File.expand_path(__dir__)
ROOT_DIR = File.expand_path("..", SCRIPT_DIR)
DEFAULT_CONFIG = File.join(SCRIPT_DIR, "submit_urls.yml")
CREDENTIALS_DIR = File.join(ROOT_DIR, ".submit_urls")
BING_OAUTH_FILE = File.join(CREDENTIALS_DIR, "bing_oauth.json")
ARCHIVE_CREDENTIALS_FILE = File.join(CREDENTIALS_DIR, "archive_org.json")
ARCHIVE_DEFAULT_ENDPOINT = "https://web.archive.org/save"
ARCHIVE_DEFAULT_RATE_LIMIT_SECONDS = 5
BING_AUTHORIZE_URL = "https://www.bing.com/webmasters/oauth/authorize"
BING_TOKEN_URL = "https://www.bing.com/webmasters/oauth/token"
BING_REFRESH_URL = "https://www.bing.com/webmasters/token"
INDEXNOW_DEFAULT_ENDPOINT = "https://api.indexnow.org/indexnow"
INDEXNOW_BATCH_SIZE = 10_000
BING_BATCH_SIZE = 500

def usage
  <<~HELP
    Usage:
      #{File.basename($PROGRAM_NAME)} submit [options] [URL ...]
      #{File.basename($PROGRAM_NAME)} auth bing
      #{File.basename($PROGRAM_NAME)} ping-sitemap

    Submit changed or sitemap URLs to IndexNow, Internet Archive, and optionally Bing.

    Options for submit:
      --config PATH     Config file (default: scripts/submit_urls.yml)
      --sitemap         Submit all <loc> URLs from configured sitemap
      --file PATH       Read URLs from file (one per line)
      --stdin           Read URLs from stdin (one per line)
      --verify          Keep only URLs that respond with HTTP 200 or 301
      --dry-run         Print actions without sending requests
      --indexnow-only   Skip Archive.org and Bing
      --archive-only    Skip IndexNow and Bing
      --bing-only       Skip IndexNow and Archive.org

    Setup:
      1. Copy scripts/submit_urls.yml.example to scripts/submit_urls.yml
      2. Host IndexNow key file at site root (see indexnow.key in config)
      3. Optional Archive.org: copy scripts/archive_org.json.example to .submit_urls/archive_org.json
         (or set IA_S3_ACCESS_KEY and IA_S3_SECRET_KEY; keys from https://archive.org/account/s3.php)
      4. Optional Bing OAuth: register app in Bing Webmaster Tools, fill client_id/secret, run `auth bing`
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

def get_request(uri, headers = {})
  request = Net::HTTP::Get.new(uri)
  headers.each { |key, value| request[key] = value }

  Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https", open_timeout: 30, read_timeout: 60) do |http|
    http.request(request)
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

def submit_archive_org(config, urls, dry_run:)
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
  options = archive.fetch("options", {}).transform_keys(&:to_s).transform_values(&:to_s)

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

    response = post_form(endpoint, params, headers)
    puts "  HTTP #{response.code} #{response.message}"
    unless response.is_a?(Net::HTTPSuccess)
      warn "  #{response.body}"
      next
    end

    begin
      data = JSON.parse(response.body)
    rescue JSON::ParserError
      warn "  invalid JSON: #{response.body[0, 200]}"
      next
    end

    job_id = data["job_id"]
    if job_id.nil?
      puts "  #{data}"
      next
    end

    puts "  job_id=#{job_id}"
    poll_archive_status(job_id, credentials, archive) if wait
  end
end

def submit_indexnow(config, urls, dry_run:)
  indexnow = config.fetch("indexnow", {})
  return if indexnow.fetch("enabled", true) == false

  key = indexnow["key"]
  host = indexnow["host"] || URI(config.fetch("site_url")).host
  key_location = indexnow["key_location"] || "#{config.fetch('site_url').chomp('/')}/#{key}.txt"
  endpoint = URI(indexnow.fetch("endpoint", INDEXNOW_DEFAULT_ENDPOINT))
  batch_size = indexnow.fetch("batch_size", INDEXNOW_BATCH_SIZE).to_i

  abort "indexnow.key missing in config" if key.nil? || key.empty?

  urls.each_slice(batch_size).with_index(1) do |batch, index|
    payload = {
      "host" => host,
      "key" => key,
      "keyLocation" => key_location,
      "urlList" => batch
    }

    puts "IndexNow batch #{index}: #{batch.size} URL(s) -> #{endpoint}"
    next puts JSON.pretty_generate(payload) if dry_run

    response = post_json(endpoint, payload)
    puts "  HTTP #{response.code} #{response.message}"
    warn "  #{response.body}" unless response.is_a?(Net::HTTPSuccess)
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

def submit_bing(config, urls, dry_run:)
  bing = config.fetch("bing", {})
  return if bing.fetch("enabled", false) != true

  site_url = config.fetch("site_url")
  batch_size = bing.fetch("batch_size", BING_BATCH_SIZE).to_i
  endpoint = URI("https://www.bing.com/webmaster/api.svc/json/SubmitUrlBatch")
  access_token = bing_access_token(config) unless dry_run

  urls.each_slice(batch_size).with_index(1) do |batch, index|
    payload = {
      "siteUrl" => site_url,
      "urlList" => batch
    }

    puts "Bing batch #{index}: #{batch.size} URL(s)"
    next puts JSON.pretty_generate(payload) if dry_run

    response = post_json(endpoint, payload, { "Authorization" => "Bearer #{access_token}" })
    puts "  HTTP #{response.code} #{response.message}"
    warn "  #{response.body}" unless response.is_a?(Net::HTTPSuccess)
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
    indexnow_only: false,
    archive_only: false,
    bing_only: false,
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
    when "--indexnow-only" then options[:indexnow_only] = true; args.shift
    when "--archive-only" then options[:archive_only] = true; args.shift
    when "--bing-only" then options[:bing_only] = true; args.shift
    when "-h", "--help" then puts usage; exit 0
    else
      options[:urls] << args.shift
    end
  end

  options
end

def collect_urls(options)
  config = load_config(options[:config])
  urls = options[:urls].dup

  if options[:sitemap] || urls.empty? && !options[:file] && !options[:stdin]
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
    config, urls = collect_urls(options)

    puts "Submitting #{urls.size} URL(s)"
    unless options[:bing_only] || options[:archive_only]
      submit_indexnow(config, urls, dry_run: options[:dry_run])
    end
    unless options[:indexnow_only] || options[:bing_only]
      submit_archive_org(config, urls, dry_run: options[:dry_run])
    end
    unless options[:indexnow_only] || options[:archive_only]
      submit_bing(config, urls, dry_run: options[:dry_run])
    end
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
