require "minitest/autorun"
require_relative "../one_bit_flip_null"

class OneBitFlipNullTest < Minitest::Test
  def test_exact_stationary_boundary_and_excursion_quantities
    (2..12).each do |object_count|
      process = GripAnalysis::OneBitFlipNull.new(object_count)

      assert_equal 1,
        process.boundary_hit_probability_from_uniform_mixed *
          process.mean_mixed_state_visits_per_excursion
    end
  end

  def test_exact_central_first_passage_expectations
    expected = {
      2 => Rational(1),
      3 => Rational(3),
      5 => Rational(35, 2),
      8 => Rational(448, 3),
      12 => Rational(11_416, 5)
    }

    expected.each do |object_count, steps|
      process = GripAnalysis::OneBitFlipNull.new(object_count)

      assert_equal object_count / 2, process.central_start_held_count
      assert_equal steps, process.central_first_passage_steps
    end
  end

  def test_null_process_requires_a_nontrivial_mixed_region
    error = assert_raises(ArgumentError) { GripAnalysis::OneBitFlipNull.new(1) }

    assert_match(/at least two/, error.message)
  end
end
