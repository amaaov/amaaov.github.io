require "minitest/autorun"
require_relative "../independent_retention_null"

class IndependentRetentionNullTest < Minitest::Test
  PROBABILITIES = [Rational(1, 10), Rational(1, 4), Rational(1, 2), Rational(3, 4), Rational(9, 10)].freeze

  def test_exact_macrostate_partition_and_expected_occupancy
    model = GripAnalysis::IndependentRetentionNull.new(object_count: 3, retention_probability: Rational(1, 4))

    assert_equal Rational(27, 64), model.p_alpha
    assert_equal Rational(9, 16), model.p_amphoteron
    assert_equal Rational(1, 64), model.p_kappa
    assert_equal 1, model.p_alpha + model.p_amphoteron + model.p_kappa
    assert_equal Rational(3, 4), model.expected_held_count

    [3, 5, 10].product(PROBABILITIES).each do |object_count, probability|
      candidate = GripAnalysis::IndependentRetentionNull.new(
        object_count: object_count,
        retention_probability: probability
      )
      assert_equal 1, candidate.p_alpha + candidate.p_amphoteron + candidate.p_kappa
    end
  end

  def test_complementary_retention_probabilities_exchange_only_the_pure_poles
    complementary_pairs = [
      [Rational(1, 10), Rational(9, 10)],
      [Rational(1, 4), Rational(3, 4)]
    ]
    [3, 5, 10].product(complementary_pairs).each do |object_count, probabilities|
      low_probability, high_probability = probabilities
      low = GripAnalysis::IndependentRetentionNull.new(
        object_count: object_count,
        retention_probability: low_probability
      )
      high = GripAnalysis::IndependentRetentionNull.new(
        object_count: object_count,
        retention_probability: high_probability
      )

      assert_equal low.p_alpha, high.p_kappa
      assert_equal low.p_kappa, high.p_alpha
      assert_equal low.p_amphoteron, high.p_amphoteron
      assert_in_delta low.microstate_entropy_bits, high.microstate_entropy_bits, 1e-12
      assert_in_delta low.macrostate_entropy_bits, high.macrostate_entropy_bits, 1e-12
    end
  end

  def test_half_retention_maximizes_amphoteron_on_the_sweep
    [3, 5, 10].each do |object_count|
      models = PROBABILITIES.map do |probability|
        GripAnalysis::IndependentRetentionNull.new(
          object_count: object_count,
          retention_probability: probability
        )
      end
      half = models.find { |model| model.retention_probability == Rational(1, 2) }

      assert_equal models.map(&:p_amphoteron).max, half.p_amphoteron
    end
  end

  def test_macrostate_aggregation_cannot_increase_entropy
    [3, 5, 10].product(PROBABILITIES).each do |object_count, probability|
      model = GripAnalysis::IndependentRetentionNull.new(
        object_count: object_count,
        retention_probability: probability
      )

      assert_operator model.microstate_entropy_bits, :>=, model.macrostate_entropy_bits
      assert_operator model.conditional_information_loss_bits, :>=, 0
      assert_in_delta model.microstate_entropy_bits - model.macrostate_entropy_bits,
        model.conditional_information_loss_bits, 1e-12
    end
  end
end
