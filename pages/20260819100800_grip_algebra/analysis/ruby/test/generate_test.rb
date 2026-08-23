require "csv"
require "minitest/autorun"
require "tmpdir"
require_relative "../generate"

class GenerateTest < Minitest::Test
  ANALYSIS_DIRECTORY = File.expand_path("../..", __dir__)

  def test_generator_emits_the_curated_siteswap_comparison
    Dir.mktmpdir("grip-ruby-results") do |results_directory|
      GripAnalysis::Generate.run(
        analysis_directory: ANALYSIS_DIRECTORY,
        results_directory: results_directory
      )
      rows = CSV.read(
        File.join(results_directory, "siteswap_hypotheses_ruby.csv"),
        headers: true
      )

      assert_equal 7, rows.length
      assert_equal "model consequence", rows.first.fetch("result_class")
      assert_equal "untested empirical hypothesis", rows.first.fetch("empirical_status")
      assert_equal "1/2", rows.first.fetch("p_alpha_exact")

      formal_rows = CSV.read(
        File.join(results_directory, "formal_derivations_ruby.csv"),
        headers: true
      )
      assert_equal 286, formal_rows.length
      assert_equal "two_object_phase", formal_rows.first.fetch("derivation")
      assert_equal "3/5", formal_rows.first.fetch("exact_value")
    end
  end
end
