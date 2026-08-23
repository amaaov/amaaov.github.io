require "minitest/autorun"
require_relative "../results"

class ResultsTest < Minitest::Test
  SCENARIOS_PATH = File.expand_path("../../scenarios.csv", __dir__)

  def test_shared_scenarios_load_exact_numeric_inputs
    scenarios = GripAnalysis::Scenario.load_csv(SCENARIOS_PATH)
    first = scenarios.first

    assert_equal 8, scenarios.length
    assert_equal "cascade_r025", first.name
    assert_equal "steady_periodic", first.protocol_kind
    assert_equal 3, first.object_count
    assert_equal Rational(1, 1), first.siteswap_period_beats
    assert_equal Rational(3, 1), first.observation_period_beats
    assert_equal Rational(2, 5), first.beat_seconds
    assert_equal Rational(1, 4), first.dwell_ratio
  end

  def test_result_rows_preserve_computed_thresholds_and_phase_metrics
    algebra = GripAnalysis::Results.algebra_rows(0..8)
    four = algebra.find { |row| row.fetch(:object_count) == 4 }
    five = algebra.find { |row| row.fetch(:object_count) == 5 }

    assert four.fetch(:one_event_buffer_exists)
    refute four.fetch(:one_event_buffered_cycle)
    assert five.fetch(:one_event_buffered_cycle)
    assert_equal 5, five.fetch(:first_one_event_buffered_cycle_n)
    assert_equal 3, five.fetch(:first_mixed_connected_n)
    assert_equal 3, five.fetch(:first_mixed_cycle_n)
    assert_equal 7, five.fetch(:first_two_event_buffered_cycle_n)

    scenarios = GripAnalysis::Scenario.load_csv(SCENARIOS_PATH)
    phase = GripAnalysis::Results.phase_rows(scenarios).first
    assert_equal Rational(1, 2), phase.fetch(:p_alpha)
    assert_equal Rational(1, 2), phase.fetch(:phase_fraction)
    assert_equal Rational(3, 1), phase.fetch(:observation_period_beats)
    assert_equal 3, phase.fetch(:alpha_entry_count)
    assert_equal "model consequence", phase.fetch(:result_class)
  end

  def test_new_hypothesis_rows_retain_exact_phase_and_null_process_metrics
    phase_sweep = GripAnalysis::Results.phase_sweep_rows(Rational(2, 5))
    half_offset = phase_sweep.last

    assert_equal Rational(1, 2), half_offset.fetch(:phase_offset_fraction)
    assert_equal Rational(1, 5), half_offset.fetch(:p_alpha)
    assert_equal Rational(4, 5), half_offset.fetch(:p_amphoteron)
    assert_equal 0, half_offset.fetch(:p_kappa)
    assert_equal 2, half_offset.fetch(:alpha_bout_count)

    null_rows = GripAnalysis::Results.one_bit_null_rows(2..5)
    five_objects = null_rows.last
    assert_equal "independent uniform bit choice per event", five_objects.fetch(:process_assumption)
    assert_equal Rational(1, 15), five_objects.fetch(:boundary_hit_probability_from_uniform_mixed)
    assert_equal 15, five_objects.fetch(:stationary_mean_mixed_state_visits_per_excursion)
    assert_equal 16, five_objects.fetch(:stationary_mean_boundary_return_flips)
    assert_equal Rational(35, 2), five_objects.fetch(:central_first_passage_steps)
    assert_equal "theorem", five_objects.fetch(:result_class)
  end

  def test_independent_retention_rows_declare_the_null_and_preserve_exact_probabilities
    rows = GripAnalysis::Results.independent_retention_null_rows
    half = rows.find do |row|
      row.fetch(:object_count) == 5 && row.fetch(:retention_probability) == Rational(1, 2)
    end

    assert_equal 15, rows.length
    assert_equal "stationary mutually independent Bernoulli retention", half.fetch(:process_assumption)
    assert_equal Rational(1, 32), half.fetch(:p_alpha)
    assert_equal Rational(15, 16), half.fetch(:p_amphoteron)
    assert_equal Rational(1, 32), half.fetch(:p_kappa)
    assert_equal Rational(5, 2), half.fetch(:expected_held_count)
    assert_equal "model consequence", half.fetch(:result_class)
  end
end
