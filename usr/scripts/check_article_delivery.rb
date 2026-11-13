#!/usr/bin/env ruby
# frozen_string_literal: true

require "fileutils"
require "json"
require "optparse"
require "pathname"
require "tmpdir"
require "time"

module ArticleDelivery
  module_function

  def main(argv = ARGV)
    options = { budget: Pathname("article-delivery-budget.json"), reports: Pathname("tmp/article-delivery") }
    OptionParser.new do |parser|
      parser.banner = "Stage the article editions and check their file-byte budget."
      parser.on("--budget PATH", "Budget JSON path") { |path| options[:budget] = Pathname(path) }
      parser.on("--reports PATH", "Report directory") { |path| options[:reports] = Pathname(path) }
    end.parse!(argv)

    started = Time.now.utc.iso8601
    begin
      budget = JSON.parse(options[:budget].read)
      root = options[:budget].expand_path.dirname
      ceiling = budget.fetch("ceiling_bytes")
      paths = budget.fetch("paths")
      artifact = budget.fetch("artifact")
      raise "The artifact must have a name." unless artifact.is_a?(String) && !artifact.empty?
      unless ceiling.is_a?(Integer) && ceiling.positive? && paths.is_a?(Array) && !paths.empty?
        raise "A positive ceiling and non-empty paths list are required."
      end

      files = paths.map { |path| (root / path).expand_path }
      raise "An artifact path must occur once." if files.map(&:to_s).uniq.size != files.size
      files.each do |path|
        raise "Every artifact must be a file inside the checkout." unless path.file? && path.to_s.start_with?("#{root}/")
      end

      size = files.sum(&:size)
      duration = nil
      if size <= ceiling
        Dir.mktmpdir("article-staging-") do |temporary|
          begin_at = Process.clock_gettime(Process::CLOCK_MONOTONIC)
          files.each do |path|
            target = Pathname(temporary) / path.relative_path_from(root)
            FileUtils.mkdir_p(target.dirname)
            FileUtils.cp(path, target)
          end
          duration = Process.clock_gettime(Process::CLOCK_MONOTONIC) - begin_at
        end
      end

      run = ENV["GITHUB_RUN_ID"]
      repository = ENV.fetch("GITHUB_REPOSITORY", "amaaov/amaaov.github.io")
      common = {
        "artifact" => artifact,
        "started_at" => started,
        "finished_at" => Time.now.utc.iso8601,
        "repository" => repository,
        "run_identity" => run || "local:#{started}",
        "run_url" => (run ? "https://github.com/#{repository}/actions/runs/#{run}" : nil),
        "workflow" => ENV.fetch("GITHUB_WORKFLOW", "local"),
        "job" => ENV.fetch("GITHUB_JOB", "local"),
        "step" => "stage-static-article",
        "runner_class" => ENV.fetch("DELIVERY_RUNNER_CLASS", "local")
      }
      records = {
        "size" => common.merge(
          "kind" => "size",
          "metric" => "file_bytes",
          "file_bytes" => size,
          "ceiling_bytes" => ceiling
        ),
        "build-timing" => common.merge(
          "kind" => "build-timing",
          "metric" => "static_staging_wall_seconds",
          "wall_seconds" => duration,
          "status" => (duration.nil? ? "skipped-size-gate" : "staged")
        )
      }
      FileUtils.mkdir_p(options[:reports])
      records.each do |name, record|
        serialized = JSON.generate(record.sort.to_h)
        (options[:reports] / "#{name}.json").write("#{serialized}\n")
        puts serialized
      end
      size <= ceiling ? 0 : 1
    rescue Errno::ENOENT, Errno::EACCES, JSON::ParserError, KeyError, TypeError, RuntimeError => error
      warn "Article delivery refused: #{error}"
      2
    end
  end
end

exit ArticleDelivery.main if $PROGRAM_NAME == __FILE__
