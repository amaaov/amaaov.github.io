# frozen_string_literal: true

require "bundler/setup"
require "fileutils"
require "json"
require "pathname"
require "stringio"
require "tmpdir"

REPO_ROOT = File.expand_path("..", __dir__)
$LOAD_PATH.unshift(File.join(REPO_ROOT, "usr", "scripts"))

require "polyrun/rspec"
Polyrun::RSpec.install_sharded_formatter_compat!
Polyrun::RSpec.install_failure_fragments!
Polyrun::RSpec.install_worker_ping!

def analysis_ruby_load_path(article_id)
  path = File.join(REPO_ROOT, "pages", article_id, "analysis", "ruby")
  $LOAD_PATH.unshift(path) unless $LOAD_PATH.include?(path)
  path
end

module SpecHelpers
  module_function

  def capture_stdio
    original_out = $stdout
    original_err = $stderr
    out = StringIO.new
    err = StringIO.new
    $stdout = out
    $stderr = err
    result = yield
    [result, out.string, err.string]
  ensure
    $stdout = original_out
    $stderr = original_err
  end
end

RSpec.configure do |config|
  config.expect_with :rspec do |expectations|
    expectations.include_chain_clauses_in_custom_matcher_descriptions = true
  end
  config.mock_with :rspec do |mocks|
    mocks.verify_partial_doubles = true
  end
  config.shared_context_metadata_behavior = :apply_to_host_groups
  config.filter_run_when_matching :focus
  config.example_status_persistence_file_path = "tmp/rspec_status.txt"
  config.disable_monkey_patching!
  config.order = :random
  Kernel.srand config.seed

  config.include SpecHelpers
end
