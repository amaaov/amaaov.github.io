require "minitest/autorun"
require_relative "../formal_derivations"
require_relative "../formal_results"
require_relative "../phase_sweep"
require_relative "../one_bit_flip_null"

class FormalDerivationsTest < Minitest::Test
  def test_piecewise_phase_law_matches_interval_enumeration
    rows = GripAnalysis::TwoObjectPhaseSweep.rows(beat_seconds: Rational(2, 5))

    rows.each do |row|
      law = GripAnalysis::TwoObjectPhaseLaw.new(
        retention_duty: Rational(2, 5),
        phase_offset: row.fetch(:phase_offset_fraction)
      )
      period = row.fetch(:period_seconds)

      assert_equal row.fetch(:p_alpha), law.p_alpha
      assert_equal row.fetch(:p_amphoteron), law.p_amphoteron
      assert_equal row.fetch(:p_kappa), law.p_kappa
      assert_equal row.fetch(:alpha_entry_count), law.alpha_bout_count
      assert_equal row.fetch(:alpha_mean_bout_seconds), law.alpha_mean_bout_fraction * period
      assert_equal row.fetch(:alpha_maximum_bout_seconds), law.alpha_maximum_bout_fraction * period
      assert_equal row.fetch(:alpha_bout_variance_seconds_squared),
        law.alpha_bout_variance_fraction_squared * period**2
    end
  end

  def test_general_phase_law_matches_interval_engine_across_both_duty_regimes
    duties = (1..19).map { |index| Rational(index, 20) }
    phases = (0..20).map { |index| Rational(index, 40) }

    duties.product(phases).each do |retention_duty, phase_offset|
      law = GripAnalysis::TwoObjectPhaseLaw.new(
        retention_duty: retention_duty, phase_offset: phase_offset
      )
      path = GripAnalysis::PeriodicGripPath.new(
        period: 1,
        held_intervals_by_object: [
          [[0, retention_duty]], [[phase_offset, retention_duty]]
        ]
      )

      assert_equal path.macrostate_share(:alpha), law.p_alpha
      assert_equal path.macrostate_share(:amphoteron), law.p_amphoteron
      assert_equal path.macrostate_share(:kappa), law.p_kappa
      assert_equal path.macrostate_bout_lengths(:alpha).sort,
        law.alpha_bout_fractions.sort
    end
  end

  def test_phase_plateau_preserves_shares_while_alpha_splits
    touching = GripAnalysis::TwoObjectPhaseLaw.new(
      retention_duty: Rational(2, 5), phase_offset: Rational(2, 5)
    )
    separated = GripAnalysis::TwoObjectPhaseLaw.new(
      retention_duty: Rational(2, 5), phase_offset: Rational(1, 2)
    )

    assert_equal [Rational(1, 5), Rational(4, 5), 0], touching.macrostate_shares
    assert_equal touching.macrostate_shares, separated.macrostate_shares
    assert_equal [Rational(1, 5)], touching.alpha_bout_fractions
    assert_equal [Rational(1, 10), Rational(1, 10)], separated.alpha_bout_fractions

    long_duty = GripAnalysis::TwoObjectPhaseLaw.new(
      retention_duty: Rational(7, 10), phase_offset: Rational(2, 5)
    )
    assert_equal [0, Rational(3, 5), Rational(2, 5)], long_duty.macrostate_shares
    assert_empty long_duty.alpha_bout_fractions
  end

  def test_heterogeneous_bernoulli_product_law
    law = GripAnalysis::BernoulliTemporalLaw.new([
      Rational(1, 4), Rational(1, 2), Rational(3, 4)
    ])

    assert_equal Rational(3, 32), law.p_alpha
    assert_equal Rational(13, 16), law.p_amphoteron
    assert_equal Rational(3, 32), law.p_kappa
    assert_equal Rational(3, 2), law.expected_held_count
    assert_equal 1, law.p_alpha + law.p_amphoteron + law.p_kappa
  end

  def test_one_bit_expectations_satisfy_the_first_passage_recurrence
    (2..12).each do |object_count|
      process = GripAnalysis::OneBitFlipNull.new(object_count)
      assert_equal 0, process.closed_form_first_passage_steps(0)
      assert_equal 0, process.closed_form_first_passage_steps(object_count)
      (1...object_count).each do |held_count|
        assert_equal 0, process.first_passage_recurrence_residual(held_count)
        assert_equal process.first_passage_steps(held_count),
          process.first_passage_steps(object_count - held_count)
        assert_equal process.first_passage_steps(held_count),
          process.closed_form_first_passage_steps(held_count)
      end
      assert_equal process.first_passage_steps(1),
        process.mean_mixed_state_visits_per_excursion
      assert_equal process.mean_mixed_state_visits_per_excursion + 1,
        process.mean_boundary_return_flips
    end
  end

  def test_gaussian_correction_maximum_and_general_inner_radius_law
    half = GripAnalysis::GaussianCorrectionBand.new(inner_radius_fraction: Rational(1, 2))
    optimum = half.sigma_over_radius_at_maximum

    assert_in_delta Math.sqrt(3.0 / (8 * Math.log(2))), optimum, 1e-15
    assert_in_delta 0.32267456883476864, half.maximum_probability, 1e-14
    assert_in_delta 0, half.derivative(optimum), 1e-14
    assert_operator half.probability(optimum), :>, half.probability(optimum * 0.99)
    assert_operator half.probability(optimum), :>, half.probability(optimum * 1.01)

    [Rational(1, 4), Rational(3, 4)].each do |inner_fraction|
      band = GripAnalysis::GaussianCorrectionBand.new(inner_radius_fraction: inner_fraction)
      candidate = band.sigma_over_radius_at_maximum
      assert_in_delta 0, band.derivative(candidate), 1e-14
      assert_operator band.probability(candidate), :>, band.probability(candidate * 0.99)
      assert_operator band.probability(candidate), :>, band.probability(candidate * 1.01)
    end
  end

  def test_formal_measurement_battery_has_declared_scope
    rows = GripAnalysis::FormalResults.rows

    assert_equal 286, rows.length
    assert_equal %w[bernoulli_temporal gaussian_correction one_bit_first_passage two_object_phase],
      rows.map { |row| row.fetch(:derivation) }.uniq.sort
    assert rows.all? { |row| row.fetch(:result_class) == "model consequence" ||
      row.fetch(:result_class) == "theorem" }
    assert rows.all? { |row| !row.fetch(:assumption).empty? }
  end
end
