#!/usr/bin/env ruby
# frozen_string_literal: true

require "time"
require "yaml"

SCRIPT_DIR = File.expand_path(__dir__)
ROOT_DIR = File.expand_path("..", SCRIPT_DIR)
DEFAULT_CONFIG = File.join(SCRIPT_DIR, "submit_urls.yml")

def load_config(path)
  YAML.load_file(path)
end

def lastmod_for_html(path)
  content = File.read(path, encoding: "UTF-8")

  %w[article:modified_time article:published_time].each do |property|
    match = content.match(/#{Regexp.escape(property)}"\s+content="([^"]+)"/)
    next unless match

    return Time.parse(match[1]).utc.strftime("%Y-%m-%d")
  end

  basename = File.basename(path)
  if (match = basename.match(/^(\d{4})(\d{2})(\d{2})/))
    return "#{match[1]}-#{match[2]}-#{match[3]}"
  end

  File.mtime(path).utc.strftime("%Y-%m-%d")
rescue StandardError
  File.mtime(path).utc.strftime("%Y-%m-%d")
end

def loc_for(site_url, rel)
  rel = rel.to_s
  return "#{site_url}/" if rel == "/"

  "#{site_url}/#{rel.delete_prefix('/')}"
end

def collect_urls(config)
  site_url = config.fetch("site_url").chomp("/")
  generation = config.fetch("sitemap_generate")
  urls = []

  Array(generation["static"]).each do |entry|
    rel = entry.is_a?(Hash) ? entry.fetch("path") : entry
    path = rel == "/" ? File.join(ROOT_DIR, "index.html") : File.join(ROOT_DIR, rel.delete_prefix("/"))
    next unless File.exist?(path)

    urls << {
      loc: loc_for(site_url, rel),
      lastmod: lastmod_for_html(path)
    }
  end

  Array(generation["globs"]).each do |pattern|
    Dir.glob(File.join(ROOT_DIR, pattern)).sort.reverse_each do |path|
      rel = path.delete_prefix("#{ROOT_DIR}/")
      urls << {
        loc: loc_for(site_url, rel),
        lastmod: lastmod_for_html(path)
      }
    end
  end

  urls
end

def xml_escape(text)
  text.to_s
      .gsub("&", "&amp;")
      .gsub("<", "&lt;")
      .gsub(">", "&gt;")
      .gsub("\"", "&quot;")
      .gsub("'", "&apos;")
end

def build_xml(urls)
  lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
  ]

  urls.each do |entry|
    lines << "  <url>"
    lines << "    <loc>#{xml_escape(entry.fetch(:loc))}</loc>"
    lines << "    <lastmod>#{xml_escape(entry.fetch(:lastmod))}</lastmod>"
    lines << "  </url>"
  end

  lines << "</urlset>"
  "#{lines.join("\n")}\n"
end

config_path = ARGV.fetch(0, DEFAULT_CONFIG)
config = load_config(config_path)
urls = collect_urls(config)
output_path = File.join(ROOT_DIR, config.fetch("sitemap", "sitemap.xml"))

File.write(output_path, build_xml(urls))
puts "Wrote #{urls.size} URLs to #{output_path}"
