#!/usr/bin/env ruby
# frozen_string_literal: true

require "cgi"
require "fileutils"
require "json"
require "net/http"
require "optparse"
require "rexml/document"
require "set"
require "time"
require "uri"

# Audit which sitemap / pages/*.html URLs appear in public search indexes.
#
# Engines block scrapers (CAPTCHA / empty JS shells). This script uses
# DuckDuckGo HTML (often Bing-backed) with strict result-link parsing so the
# query string echoing in the page is not counted as a hit.
#
# Usage:
#   ruby scripts/audit_index.rb
#   ruby scripts/audit_index.rb --pages-only --delay 1.2
#   ruby scripts/audit_index.rb --json tmp/index_audit.json
#   ruby scripts/audit_index.rb --missing-only
#   ruby scripts/audit_index.rb --url https://amaaov.github.io/pages/foo.html
#   ruby scripts/audit_index.rb --show-history
#
# Default state (gitignored under tmp/):
#   tmp/seo_audit/latest.json
#   tmp/seo_audit/history.ndjson
#   tmp/seo_audit/runs/<timestamp>.json
#   tmp/seo_audit/missing.txt

SCRIPT_DIR = File.expand_path(__dir__)
ROOT_DIR = File.expand_path("..", SCRIPT_DIR)
DEFAULT_SITEMAP = File.join(ROOT_DIR, "sitemap.xml")
DEFAULT_ROBOTS = File.join(ROOT_DIR, "robots.txt")
DEFAULT_PAGES_DIR = File.join(ROOT_DIR, "pages")
DEFAULT_STATE_DIR = File.join(ROOT_DIR, "tmp", "seo_audit")
DDG_HTML = "https://html.duckduckgo.com/html/"
USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 " \
  "(KHTML, like Gecko) Version/17.5 Safari/605.1.15"
STATUSES = %w[indexed missing blocked unknown error skipped].freeze

Result = Struct.new(
  :url,
  :status,
  :source,
  :n_results,
  :detail,
  keyword_init: true
)

def usage
  <<~HELP
    Usage:
      #{File.basename($PROGRAM_NAME)} [options]

    Check sitemap (and optional pages/*.html) URLs for public search visibility
    via DuckDuckGo HTML site: queries. Prints indexed / missing / blocked /
    unknown, plus local crawlability notes (robots, noindex, sitemap parity).

    Options:
      --sitemap PATH       Sitemap path (default: sitemap.xml at repo root)
      --pages-dir PATH     pages/ directory for parity + noindex scan
      --pages-only         Only audit URLs under /pages/
      --url URL            Audit a single URL (repeatable)
      --file PATH          Extra URLs, one per line
      --delay SECONDS      Sleep between network checks (default: 1.0)
      --skip-network       Local checks only (parity, noindex, robots)
      --skip-listing       Skip site-wide site:amaaov…/pages/ listing pass
      --json PATH          Also write full report JSON to PATH
      --missing-only       Print only not-confirmed URLs (one per line)
      --submit-list PATH   Write missing URLs for scripts/submit_urls.rb --file
      --state-dir PATH     History dir (default: tmp/seo_audit)
      --no-history         Do not write latest/history/runs under state-dir
      --show-history [N]   Print last N history lines (default 20) and exit
      -h, --help           Show help

    Statuses:
      indexed   exact URL appeared as a DDG result link, or in site: listing
      missing   exact site:URL returned no result links
      blocked   HTTP 403/202 challenge / anomaly page
      error     request failed
      unknown   response ambiguous
      skipped   --skip-network

    History files (default on):
      <state-dir>/latest.json      full last report
      <state-dir>/history.ndjson   one summary object per run
      <state-dir>/runs/<ts>.json   full snapshot per run
      <state-dir>/missing.txt      last not-confirmed URL list

    Not a Search Console substitute. Use missing list with Bing URL submit or:
      ruby scripts/submit_urls.rb submit --file PATH --bing-only
  HELP
end

def parse_options(argv)
  options = {
    sitemap: DEFAULT_SITEMAP,
    pages_dir: DEFAULT_PAGES_DIR,
    pages_only: false,
    urls: [],
    file: nil,
    delay: 1.0,
    skip_network: false,
    skip_listing: false,
    json: nil,
    missing_only: false,
    submit_list: nil,
    state_dir: DEFAULT_STATE_DIR,
    history: true,
    show_history: nil
  }

  parser = OptionParser.new do |opts|
    opts.banner = usage
    opts.on("--sitemap PATH") { |v| options[:sitemap] = File.expand_path(v) }
    opts.on("--pages-dir PATH") { |v| options[:pages_dir] = File.expand_path(v) }
    opts.on("--pages-only") { options[:pages_only] = true }
    opts.on("--url URL") { |v| options[:urls] << v }
    opts.on("--file PATH") { |v| options[:file] = File.expand_path(v) }
    opts.on("--delay SECONDS", Float) { |v| options[:delay] = v }
    opts.on("--skip-network") { options[:skip_network] = true }
    opts.on("--skip-listing") { options[:skip_listing] = true }
    opts.on("--json PATH") { |v| options[:json] = File.expand_path(v) }
    opts.on("--missing-only") { options[:missing_only] = true }
    opts.on("--submit-list PATH") { |v| options[:submit_list] = File.expand_path(v) }
    opts.on("--state-dir PATH") { |v| options[:state_dir] = File.expand_path(v) }
    opts.on("--no-history") { options[:history] = false }
    opts.on("--show-history [N]") { |v| options[:show_history] = (v || 20).to_i }
    opts.on("-h", "--help") { puts usage; exit 0 }
  end
  parser.parse!(argv)
  options
end

def normalize_url(url)
  url.to_s.strip.sub(%r{/\z}, "")
end

def parse_sitemap_locs(path)
  abort "Sitemap not found: #{path}" unless File.exist?(path)

  doc = REXML::Document.new(File.read(path))
  REXML::XPath.match(doc, "//loc").map { |node| normalize_url(node.text) }.compact.uniq
end

def page_html_urls(pages_dir, site_host: "amaaov.github.io")
  Dir.glob(File.join(pages_dir, "*.html")).sort.map do |path|
    normalize_url("https://#{site_host}/pages/#{File.basename(path)}")
  end
end

def noindex?(path)
  return false unless File.exist?(path)

  body = File.read(path, encoding: "UTF-8")
  !!(body =~ /name=["']robots["'][^>]*content=["'][^"']*noindex/i ||
     body =~ /content=["'][^"']*noindex[^"']*["'][^>]*name=["']robots["']/i)
end

def local_path_for_url(url, root: ROOT_DIR)
  uri = URI(url)
  rel = uri.path.to_s.sub(%r{\A/}, "")
  rel = "index.html" if rel.empty?
  File.join(root, rel)
end

def robots_notes(path)
  notes = []
  unless File.exist?(path)
    notes << "robots.txt missing"
    return notes
  end

  text = File.read(path)
  notes << "robots.txt has no Sitemap: line" unless text.match?(/^Sitemap:\s*\S+/i)
  notes << "robots.txt Disallow may block crawlers" if text.match?(/^\s*Disallow:\s*\/\s*$/i)
  notes << "robots.txt present" if notes.empty?
  notes
end

def http_get(url, headers: {})
  uri = URI(url)
  request = Net::HTTP::Get.new(uri)
  request["User-Agent"] = USER_AGENT
  request["Accept"] = "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8"
  request["Accept-Language"] = "en-US,en;q=0.9"
  request["Referer"] = "https://duckduckgo.com/"
  headers.each { |key, value| request[key] = value }

  Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https", open_timeout: 20, read_timeout: 30) do |http|
    http.request(request)
  end
end

def decode_uddg(href)
  return nil if href.nil? || href.empty?

  href = CGI.unescapeHTML(href)
  if (match = href.match(/[?&]uddg=([^&]+)/))
    return CGI.unescape(match[1])
  end

  href.start_with?("http") ? href : nil
rescue StandardError
  nil
end

def extract_ddg_result_urls(html)
  urls = []

  html.scan(/class="result__a"[^>]*href="([^"]+)"/i) do |href,|
    decoded = decode_uddg(href)
    urls << decoded if decoded
  end

  html.scan(/class="result__url"[^>]*href="([^"]+)"/i) do |href,|
    decoded = decode_uddg(href)
    urls << decoded if decoded
  end

  # Absolute result links that already point at the site (rare in DDG HTML).
  html.scan(%r{https://amaaov\.github\.io/[^"'&\s<>]+}).each do |url|
    urls << url
  end

  urls.map { |u| normalize_url(u.split("#", 2).first) }.uniq
end

def blocked_response?(response, html)
  code = response.code.to_i
  return true if [403, 429, 202].include?(code)

  low = html.downcase
  low.include?("anomaly") ||
    low.include?("captcha") ||
    low.include?("unusual traffic") ||
    low.include?("verify you are human")
end

def ddg_search(query)
  uri = URI(DDG_HTML)
  uri.query = URI.encode_www_form("q" => query)
  response = http_get(uri)
  html = response.body.to_s
  {
    response: response,
    html: html,
    urls: extract_ddg_result_urls(html),
    blocked: blocked_response?(response, html)
  }
end

def url_in_results?(target, result_urls)
  target = normalize_url(target)
  result_urls.any? { |u| u == target || u.start_with?("#{target}/") || u.start_with?("#{target}?") }
end

def sleep_delay(seconds)
  sleep(seconds) if seconds.positive?
end

def listing_hits(site_query, delay:)
  hits = Set.new
  data = ddg_search(site_query)
  return [:blocked, hits, data] if data[:blocked]

  data[:urls].each { |u| hits << u if u.include?("/pages/") }
  # One follow-up page if DDG returns a next offset form (best-effort).
  if data[:html] =~ /name="s"\s+value="(\d+)"/
    sleep_delay(delay)
    offset = Regexp.last_match(1)
    uri = URI(DDG_HTML)
    uri.query = URI.encode_www_form("q" => site_query, "s" => offset)
    response = http_get(uri)
    html = response.body.to_s
    unless blocked_response?(response, html)
      extract_ddg_result_urls(html).each { |u| hits << u if u.include?("/pages/") }
    end
  end

  [:ok, hits, data]
end

def check_exact(url, delay:, retries: 2)
  attempt = 0
  data = nil

  loop do
    sleep_delay(delay)
    data = ddg_search("site:#{url}")
    break unless data[:blocked]
    break if attempt >= retries

    attempt += 1
    backoff = delay * (2**attempt)
    warn "  blocked #{url} (HTTP #{data[:response].code}); retry #{attempt}/#{retries} after #{backoff}s"
    sleep_delay(backoff)
  end

  if data[:blocked]
    return Result.new(url: url, status: "blocked", source: "ddg_exact", n_results: 0, detail: "HTTP #{data[:response].code}")
  end

  if url_in_results?(url, data[:urls])
    return Result.new(url: url, status: "indexed", source: "ddg_exact", n_results: data[:urls].size, detail: nil)
  end

  if data[:urls].empty?
    return Result.new(url: url, status: "missing", source: "ddg_exact", n_results: 0, detail: "no result links")
  end

  Result.new(
    url: url,
    status: "unknown",
    source: "ddg_exact",
    n_results: data[:urls].size,
    detail: "results present but exact URL absent: #{data[:urls].first(3).join(', ')}"
  )
rescue StandardError => e
  Result.new(url: url, status: "error", source: "ddg_exact", n_results: 0, detail: e.message)
end

def collect_targets(options)
  targets = options[:urls].map { |u| normalize_url(u) }

  if options[:file]
    abort "File not found: #{options[:file]}" unless File.exist?(options[:file])
    targets.concat(File.readlines(options[:file], chomp: true).map { |u| normalize_url(u) })
  end

  if targets.empty?
    targets = parse_sitemap_locs(options[:sitemap])
  end

  targets = targets.select { |u| u.include?("/pages/") } if options[:pages_only]
  targets.reject(&:empty?).uniq
end

def local_audit(options, targets)
  sitemap_locs = File.exist?(options[:sitemap]) ? parse_sitemap_locs(options[:sitemap]) : []
  page_urls = Dir.exist?(options[:pages_dir]) ? page_html_urls(options[:pages_dir]) : []

  sitemap_pages = sitemap_locs.select { |u| u.include?("/pages/") }.to_set
  page_set = page_urls.to_set

  missing_from_sitemap = (page_set - sitemap_pages).to_a.sort
  orphan_in_sitemap = (sitemap_pages - page_set).to_a.sort

  noindex_urls = []
  targets.each do |url|
    path = local_path_for_url(url)
    noindex_urls << url if noindex?(path)
  end

  {
    robots: robots_notes(DEFAULT_ROBOTS),
    sitemap_count: sitemap_locs.size,
    pages_html_count: page_urls.size,
    missing_from_sitemap: missing_from_sitemap,
    orphan_in_sitemap: orphan_in_sitemap,
    noindex: noindex_urls
  }
end

def audit_network(targets, options)
  results = {}
  listing = Set.new

  unless options[:skip_listing]
    warn "DDG site listing: site:amaaov.github.io/pages/"
    status, hits, = listing_hits("site:amaaov.github.io/pages/", delay: options[:delay])
    if status == :blocked
      warn "  listing blocked; continuing with exact checks only"
    else
      listing = hits
      warn "  listing hits: #{listing.size}"
      listing.each do |url|
        next unless targets.include?(url)

        results[url] = Result.new(
          url: url,
          status: "indexed",
          source: "ddg_listing",
          n_results: 1,
          detail: "present in site:amaaov.github.io/pages/ results"
        )
      end
    end
  end

  pending = targets.reject { |u| results.key?(u) }
  warn "Exact site:URL checks: #{pending.size}"
  pending.each_with_index do |url, index|
    warn "  [#{index + 1}/#{pending.size}] #{url}" if ((index + 1) % 10).zero? || index.zero?
    result = check_exact(url, delay: options[:delay])
    # If listing already had it, keep indexed; exact missing should not demote listing hits.
    results[url] = result
  end

  targets.map { |url| results[url] || Result.new(url: url, status: "unknown", source: "none", n_results: 0, detail: nil) }
end

def group_by_status(results)
  grouped = Hash.new { |h, k| h[k] = [] }
  results.each { |r| grouped[r.status] << r.url }
  grouped
end

def print_report(local, results, options, delta: nil)
  grouped = group_by_status(results)
  missing = not_confirmed_urls(results)
  indexed = grouped.fetch("indexed", []).uniq.sort

  if options[:missing_only]
    missing.each { |url| puts url }
    return missing
  end

  puts "Local crawlability"
  local[:robots].each { |note| puts "  - #{note}" }
  puts "  - sitemap URLs: #{local[:sitemap_count]}"
  puts "  - pages/*.html: #{local[:pages_html_count]}"
  puts "  - pages missing from sitemap: #{local[:missing_from_sitemap].size}"
  local[:missing_from_sitemap].each { |u| puts "      #{u}" }
  puts "  - sitemap orphans (no local html): #{local[:orphan_in_sitemap].size}"
  local[:orphan_in_sitemap].each { |u| puts "      #{u}" }
  puts "  - noindex among targets: #{local[:noindex].size}"
  local[:noindex].each { |u| puts "      #{u}" }
  puts

  puts "Search visibility (#{results.size} URL(s))"
  STATUSES.each do |status|
    urls = grouped.fetch(status, [])
    next if urls.empty?

    puts "  #{status}: #{urls.size}"
  end
  puts

  if delta
    puts "Delta vs previous latest"
    puts "  newly indexed: #{delta['newly_indexed'].size}"
    delta["newly_indexed"].each { |u| puts "      #{u}" }
    puts "  newly missing: #{delta['newly_missing'].size}"
    delta["newly_missing"].each { |u| puts "      #{u}" }
    puts "  status changes: #{delta['status_changes'].size}"
    delta["status_changes"].first(20).each do |change|
      puts "      #{change['url']}: #{change['from']} -> #{change['to']}"
    end
    puts "  … #{delta['status_changes'].size - 20} more" if delta["status_changes"].size > 20
    puts
  end

  puts "Confirmed indexed (#{indexed.size})"
  indexed.each { |u| puts "  #{u}" }
  puts

  puts "Not confirmed — Bing submit candidates (#{missing.size})"
  missing.each { |u| puts "  #{u}" }
  puts
  puts "Note: public site: checks are approximate. Prefer Bing Webmaster / Search Console for ground truth."
  puts "Sitemap hint: https://amaaov.github.io/sitemap.xml"

  missing
end

def status_counts(results)
  counts = STATUSES.to_h { |s| [s, 0] }
  results.each { |r| counts[r.status] = counts.fetch(r.status, 0) + 1 }
  counts
end

def not_confirmed_urls(results)
  results
    .select { |r| %w[missing unknown blocked error].include?(r.status) }
    .map(&:url)
    .uniq
    .sort
end

def results_payload(results)
  results.map do |r|
    {
      "url" => r.url,
      "status" => r.status,
      "source" => r.source,
      "n_results" => r.n_results,
      "detail" => r.detail
    }
  end
end

def build_report(local, results, options, generated_at:)
  counts = status_counts(results)
  missing = not_confirmed_urls(results)
  {
    "generated_at" => generated_at,
    "method" => "duckduckgo_html_site_query",
    "options" => {
      "pages_only" => options[:pages_only],
      "skip_network" => options[:skip_network],
      "skip_listing" => options[:skip_listing]
    },
    "counts" => counts,
    "targets" => results.size,
    "not_confirmed" => missing.size,
    "coverage_ratio" => results.empty? ? nil : (counts["indexed"].to_f / results.size).round(4),
    "parity_ok" => local[:missing_from_sitemap].empty? && local[:orphan_in_sitemap].empty?,
    "issues" => {
      "missing_from_sitemap" => local[:missing_from_sitemap],
      "orphan_in_sitemap" => local[:orphan_in_sitemap],
      "noindex" => local[:noindex],
      "robots" => local[:robots]
    },
    "local" => {
      "robots" => local[:robots],
      "sitemap_count" => local[:sitemap_count],
      "pages_html_count" => local[:pages_html_count],
      "missing_from_sitemap" => local[:missing_from_sitemap],
      "orphan_in_sitemap" => local[:orphan_in_sitemap],
      "noindex" => local[:noindex]
    },
    "results" => results_payload(results)
  }
end

def history_summary(report)
  {
    "at" => report["generated_at"],
    "targets" => report["targets"],
    "indexed" => report.dig("counts", "indexed"),
    "missing" => report.dig("counts", "missing"),
    "blocked" => report.dig("counts", "blocked"),
    "unknown" => report.dig("counts", "unknown"),
    "error" => report.dig("counts", "error"),
    "skipped" => report.dig("counts", "skipped"),
    "not_confirmed" => report["not_confirmed"],
    "coverage_ratio" => report["coverage_ratio"],
    "parity_ok" => report["parity_ok"],
    "pages_html_count" => report.dig("local", "pages_html_count"),
    "sitemap_count" => report.dig("local", "sitemap_count"),
    "missing_from_sitemap" => report.dig("local", "missing_from_sitemap")&.size.to_i,
    "orphan_in_sitemap" => report.dig("local", "orphan_in_sitemap")&.size.to_i,
    "noindex" => report.dig("local", "noindex")&.size.to_i,
    "skip_network" => report.dig("options", "skip_network")
  }
end

def load_previous_latest(state_dir)
  path = File.join(state_dir, "latest.json")
  return nil unless File.exist?(path)

  JSON.parse(File.read(path))
rescue JSON::ParserError
  nil
end

def url_status_map(report)
  return {} unless report && report["results"]

  report["results"].each_with_object({}) do |row, acc|
    acc[row["url"]] = row["status"]
  end
end

def compute_delta(previous, current)
  return nil if previous.nil?

  prev = url_status_map(previous)
  curr = url_status_map(current)
  newly_indexed = []
  newly_missing = []
  status_changes = []

  (prev.keys | curr.keys).each do |url|
    from = prev[url]
    to = curr[url]
    next if from == to

    status_changes << { "url" => url, "from" => from, "to" => to } if from && to
    newly_indexed << url if to == "indexed" && from != "indexed"
    newly_missing << url if %w[missing unknown blocked error].include?(to) && from == "indexed"
  end

  {
    "previous_at" => previous["generated_at"],
    "newly_indexed" => newly_indexed.sort,
    "newly_missing" => newly_missing.sort,
    "status_changes" => status_changes.sort_by { |c| c["url"] }
  }
end

def write_json(path, payload)
  FileUtils.mkdir_p(File.dirname(path))
  File.write(path, JSON.pretty_generate(payload))
  warn "Wrote JSON report: #{path}"
end

def persist_history(state_dir, report, missing)
  FileUtils.mkdir_p(File.join(state_dir, "runs"))

  latest_path = File.join(state_dir, "latest.json")
  history_path = File.join(state_dir, "history.ndjson")
  now = Time.now.utc
  stamp = now.strftime("%Y%m%dT%H%M%S") + format("%06d", now.usec) + "Z"
  run_path = File.join(state_dir, "runs", "#{stamp}.json")
  missing_path = File.join(state_dir, "missing.txt")

  File.write(latest_path, JSON.pretty_generate(report))
  File.write(run_path, JSON.pretty_generate(report))
  File.open(history_path, "a") { |f| f.puts(JSON.generate(history_summary(report))) }
  File.write(missing_path, missing.empty? ? "" : "#{missing.join("\n")}\n")

  warn "Wrote state: #{latest_path}"
  warn "Appended history: #{history_path}"
  warn "Wrote run snapshot: #{run_path}"
  warn "Wrote missing list: #{missing_path}"
end

def show_history(state_dir, limit)
  path = File.join(state_dir, "history.ndjson")
  abort "No history yet: #{path}" unless File.exist?(path)

  lines = File.readlines(path, chomp: true).reject(&:empty?)
  slice = lines.last(limit)
  puts "SEO audit history (last #{slice.size} of #{lines.size}) — #{path}"
  slice.each do |line|
    row = JSON.parse(line)
    puts format(
      "%s  targets=%-3s indexed=%-3s missing=%-3s blocked=%-3s unknown=%-3s error=%-3s coverage=%s parity=%s",
      row["at"],
      row["targets"],
      row["indexed"],
      row["missing"],
      row["blocked"],
      row["unknown"],
      row["error"],
      row["coverage_ratio"].nil? ? "-" : format("%.0f%%", row["coverage_ratio"] * 100),
      row["parity_ok"]
    )
  rescue JSON::ParserError
    puts line
  end
end

def main(argv)
  options = parse_options(argv)

  if options[:show_history]
    show_history(options[:state_dir], options[:show_history])
    return
  end

  targets = collect_targets(options)
  abort "No URLs to audit" if targets.empty?

  local = local_audit(options, targets)
  generated_at = Time.now.utc.iso8601

  results =
    if options[:skip_network]
      targets.map { |url| Result.new(url: url, status: "skipped", source: "local", n_results: 0, detail: nil) }
    else
      audit_network(targets, options)
    end

  previous = options[:history] ? load_previous_latest(options[:state_dir]) : nil
  report = build_report(local, results, options, generated_at: generated_at)
  delta = compute_delta(previous, report)
  report["delta"] = delta if delta

  missing = print_report(local, results, options, delta: delta)

  persist_history(options[:state_dir], report, missing) if options[:history]
  write_json(options[:json], report) if options[:json]

  if options[:submit_list]
    FileUtils.mkdir_p(File.dirname(options[:submit_list]))
    File.write(options[:submit_list], missing.empty? ? "" : "#{missing.join("\n")}\n")
    warn "Wrote submit list (#{missing.size}): #{options[:submit_list]}"
    warn "Next: ruby scripts/submit_urls.rb submit --file #{options[:submit_list]} --bing-only"
  elsif options[:history]
    warn "Submit list also at: #{File.join(options[:state_dir], 'missing.txt')}"
  end
end

main(ARGV) if __FILE__ == $PROGRAM_NAME
