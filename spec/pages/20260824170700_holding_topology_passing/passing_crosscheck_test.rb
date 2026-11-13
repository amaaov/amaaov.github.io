# frozen_string_literal: true

require "minitest/autorun"
analysis_ruby_load_path = File.expand_path("../../../pages/20260824170700_holding_topology_passing/analysis/ruby", __dir__)
$LOAD_PATH.unshift(analysis_ruby_load_path) unless $LOAD_PATH.include?(analysis_ruby_load_path)
require "generate"


class PassingCrosscheckTest < Minitest::Test
  JULIA_CSV = File.expand_path("../../results/occupancy_julia.csv", __dir__)
  RUBY_COLUMNS = PassingAnalysis::Generate::COLUMNS

  def test_ruby_and_julia_interval_plants_agree_on_the_fixtures
    ruby_rows = PassingAnalysis::Generate.rows
    julia_rows = CSV.read(JULIA_CSV, headers: true)
    assert_equal ruby_rows.length, julia_rows.length
    ruby_rows.each_with_index do |ruby_row, index|
      julia_row = julia_rows[index]
      RUBY_COLUMNS.each do |column|
        assert_equal ruby_row.fetch(column.to_sym).to_s, julia_row.fetch(column), "#{ruby_row[:scenario]} #{column}"
      end
    end
  end
end
