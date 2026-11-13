#!/usr/bin/env ruby
# frozen_string_literal: true

require "fileutils"
require "json"
require "minitest/autorun"
require "pathname"
require "stringio"
require "tmpdir"
require_relative "check_article_delivery"

class ArticleDeliveryTest < Minitest::Test
  def setup
    @root = Pathname(Dir.mktmpdir)
    (@root / "page.html").binwrite("12345")
    (@root / "art.svg").binwrite("123")
    @budget = @root / "budget.json"
    @reports = @root / "reports"
  end

  def teardown
    FileUtils.remove_entry(@root)
  end

  def run_gate(ceiling: 8, paths: nil)
    @budget.write(
      JSON.generate(
        "artifact" => "test-edition",
        "ceiling_bytes" => ceiling,
        "paths" => paths.nil? ? ["page.html", "art.svg"] : paths
      )
    )
    original_out = $stdout
    original_err = $stderr
    $stdout = StringIO.new
    $stderr = StringIO.new
    ArticleDelivery.main(["--budget", @budget.to_s, "--reports", @reports.to_s])
  ensure
    $stdout = original_out
    $stderr = original_err
  end

  def test_exact_ceiling_stages_and_reports_separate_metrics
    assert_equal 0, run_gate
    size = JSON.parse((@reports / "size.json").read)
    timing = JSON.parse((@reports / "build-timing.json").read)
    assert_equal 8, size["file_bytes"]
    assert_equal "file_bytes", size["metric"]
    assert_equal "static_staging_wall_seconds", timing["metric"]
    assert_operator timing["wall_seconds"], :>=, 0
    assert_equal size["run_identity"], timing["run_identity"]
    [size, timing].each do |record|
      %w[started_at finished_at repository workflow job step runner_class].each do |field|
        assert record[field]
      end
    end
  end

  def test_over_ceiling_refuses_staging
    assert_equal 1, run_gate(ceiling: 7)
    timing = JSON.parse((@reports / "build-timing.json").read)
    assert_equal "skipped-size-gate", timing["status"]
    assert_nil timing["wall_seconds"]
  end

  def test_missing_artifact_refuses_incomplete_measurement
    assert_equal 2, run_gate(paths: ["missing.html"])
    refute @reports.exist?
  end

  def test_path_outside_checkout_is_refused
    assert_equal 2, run_gate(paths: ["../outside.html"])
  end

  def test_duplicate_artifact_is_refused
    assert_equal 2, run_gate(paths: ["page.html", "page.html"])
  end

  def test_invalid_budget_is_refused
    assert_equal 2, run_gate(ceiling: -1)
    assert_equal 2, run_gate(paths: [])
  end
end
