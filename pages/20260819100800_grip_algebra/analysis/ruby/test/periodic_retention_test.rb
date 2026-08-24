require "minitest/autorun"
require_relative "../periodic_retention"
require_relative "../phase_sweep"

class PeriodicRetentionTest < Minitest::Test
  def test_cascade_phase_metrics_are_exact_below_the_half_dwell_threshold
    phase = GripAnalysis::CascadePhase.new(dwell_ratio: Rational(1, 4), beat_seconds: Rational(2, 5))

    assert_equal Rational(6, 5), phase.period_seconds
    assert_equal Rational(1, 2), phase.p_alpha
    assert_equal 3, phase.alpha_entry_count
    assert_equal Rational(5, 2), phase.alpha_entry_rate_hz
    assert_equal [Rational(1, 5)] * 3, phase.alpha_bout_lengths
  end

  def test_cascade_total_release_disappears_at_half_dwell
    half = GripAnalysis::CascadePhase.new(dwell_ratio: Rational(1, 2), beat_seconds: Rational(2, 5))
    long = GripAnalysis::CascadePhase.new(dwell_ratio: Rational(7, 10), beat_seconds: Rational(2, 5))

    [half, long].each do |phase|
      assert_equal 0, phase.p_alpha
      assert_equal 0, phase.alpha_entry_count
      assert_empty phase.alpha_bout_lengths
    end
  end

  def test_phase_counterexample_preserves_individual_duty_and_changes_total_release
    rows = GripAnalysis::PhaseCounterexample.rows(beat_seconds: Rational(2, 5))
    aligned = rows.fetch(:aligned)
    offset = rows.fetch(:half_cycle_offset)

    assert_equal Rational(3, 5), aligned.fetch(:individual_airborne_duty)
    assert_equal aligned.fetch(:individual_airborne_duty), offset.fetch(:individual_airborne_duty)
    assert_equal Rational(3, 5), aligned.fetch(:p_alpha)
    assert_equal Rational(1, 5), offset.fetch(:p_alpha)
    assert_equal [Rational(6, 5)], aligned.fetch(:alpha_bout_lengths)
    assert_equal [Rational(1, 5), Rational(1, 5)], offset.fetch(:alpha_bout_lengths)
  end

  def test_periodic_seam_is_one_bout_and_one_entry
    retention = GripAnalysis::PeriodicRetention.new(
      period: 1,
      held_intervals: [[Rational(1, 5), Rational(2, 5)]]
    )

    assert_equal [Rational(3, 5)], retention.alpha_bout_lengths
    assert_equal 1, retention.alpha_entry_count
  end

  def test_two_object_path_reports_all_macrostates_and_event_packet_turnover
    path = GripAnalysis::PeriodicGripPath.new(
      period: 2,
      held_intervals_by_object: [
        [[0, Rational(4, 5)]],
        [[Rational(4, 5), Rational(4, 5)]]
      ]
    )

    assert_equal Rational(1, 5), path.macrostate_share(:alpha)
    assert_equal Rational(4, 5), path.macrostate_share(:polymorphy)
    assert_equal 0, path.macrostate_share(:kappa)
    assert_equal [Rational(2, 5)], path.macrostate_bout_lengths(:alpha)
    assert_equal [Rational(8, 5)], path.macrostate_bout_lengths(:polymorphy)
    assert_equal 3, path.membership_change_packet_count
    assert_equal 4, path.membership_turnover_total
    assert_equal Rational(4, 3), path.mean_membership_turnover_per_packet
    assert_equal 2, path.maximum_membership_turnover_per_packet
    assert_equal 1, path.direct_singleton_swap_count
  end

  def test_phase_sweep_separates_equal_shares_from_bout_fragmentation
    rows = GripAnalysis::TwoObjectPhaseSweep.rows(beat_seconds: Rational(2, 5))
    touching = rows.find { |row| row.fetch(:phase_offset_fraction) == Rational(2, 5) }
    separated = rows.find { |row| row.fetch(:phase_offset_fraction) == Rational(1, 2) }
    uneven = rows.find { |row| row.fetch(:phase_offset_fraction) == Rational(9, 20) }

    assert_equal 21, rows.length
    rows.each do |row|
      assert_equal 1, row.fetch(:p_alpha) + row.fetch(:p_polymorphy) + row.fetch(:p_kappa)
    end
    assert_equal Rational(1, 5), touching.fetch(:p_alpha)
    assert_equal touching.fetch(:p_alpha), separated.fetch(:p_alpha)
    assert_equal Rational(4, 5), touching.fetch(:p_polymorphy)
    assert_equal touching.fetch(:p_polymorphy), separated.fetch(:p_polymorphy)
    assert_equal 1, touching.fetch(:alpha_entry_count)
    assert_equal 2, separated.fetch(:alpha_entry_count)
    assert_equal Rational(2, 5), touching.fetch(:alpha_maximum_bout_seconds)
    assert_equal Rational(1, 5), separated.fetch(:alpha_maximum_bout_seconds)
    assert_equal Rational(1, 100), uneven.fetch(:alpha_bout_variance_seconds_squared)
    assert_equal Rational(-4, 25), touching.fetch(:retention_covariance)
    assert_equal Rational(-2, 3), touching.fetch(:retention_correlation)
    assert_equal 1, touching.fetch(:direct_singleton_swap_count)
    assert_equal 0, separated.fetch(:direct_singleton_swap_count)
  end
end
