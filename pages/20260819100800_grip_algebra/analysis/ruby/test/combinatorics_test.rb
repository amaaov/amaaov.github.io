require "minitest/autorun"
require_relative "../combinatorics"
require_relative "../state_space"
require_relative "../formal_derivations"

class CombinatoricsTest < Minitest::Test
  def test_fubini_numbers_match_the_ordered_set_partitions_in_the_article
    assert_equal [1, 1, 3, 13, 75, 541],
      (0..5).map { |object_count| GripAnalysis::Combinatorics.fubini_number(object_count) }
  end

  def test_companion_release_count_is_size_biased
    combinatorics = GripAnalysis::Combinatorics

    assert_equal 0, combinatorics.companion_release_count([1, 1, 1, 1])
    assert_equal 1, combinatorics.companion_release_count([2, 2, 2])
    assert_equal 2, combinatorics.companion_release_count([3, 3])
    assert_equal Rational(2, 3), combinatorics.companion_release_count([2, 1])
  end

  def test_interior_counts_and_cycle_rank_match_enumerated_mixed_graphs
    combinatorics = GripAnalysis::Combinatorics

    [4, 5, 6].zip([6, 20, 50]).each do |object_count, interior_count|
      space = GripAnalysis::StateSpace.new(object_count)
      assert_equal interior_count, combinatorics.interior_state_count(object_count, 1)
      assert_equal interior_count, space.buffered_states(1).length
    end

    [3, 4, 5].zip([1, 11, 41]).each do |object_count, cycle_rank|
      space = GripAnalysis::StateSpace.new(object_count)
      assert space.mixed_connected?
      assert_equal cycle_rank, combinatorics.mixed_cycle_rank(object_count)
      assert_equal cycle_rank, space.mixed_cycle_rank
    end
  end

  def test_half_phase_cascade_alpha_share_is_the_force_bound_occupancy
    [Rational(1, 5), Rational(1, 4), Rational(2, 5)].each do |dwell|
      law = GripAnalysis::TwoObjectPhaseLaw.new(
        retention_duty: dwell,
        phase_offset: Rational(1, 2)
      )

      assert_equal 1 - 2 * dwell, law.p_alpha
      assert_equal Rational(3, 1 - law.p_alpha), Rational(3, 2 * dwell)
    end
  end
end
