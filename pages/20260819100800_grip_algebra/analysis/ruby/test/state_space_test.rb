require "minitest/autorun"
require_relative "../state_space"

class StateSpaceTest < Minitest::Test
  def test_exhaustive_macro_counts_match_the_closed_form_through_eight_objects
    (0..8).each do |object_count|
      space = GripAnalysis::StateSpace.new(object_count)
      expected_mixed = [2**object_count - 2, 0].max

      assert_equal 2**object_count, space.states.length
      assert_equal expected_mixed, space.mixed_states.length
      assert_equal expected_mixed, space.mixed_count
      assert_equal 1, space.macro_counts.fetch(object_count.zero? ? "∅" : "α")
      assert_equal(object_count.zero? ? 0 : 1, space.macro_counts.fetch("κ", 0))
    end
  end

  def test_macrostates_keep_empty_and_pure_boundaries_distinct
    assert_equal "∅", GripAnalysis::StateSpace.new(0).classification(0)
    assert_equal "α", GripAnalysis::StateSpace.new(3).classification(0b000)
    assert_equal "κ", GripAnalysis::StateSpace.new(3).classification(0b111)
    assert_equal "ακ", GripAnalysis::StateSpace.new(3).classification(0b101)
  end

  def test_connectivity_cycles_and_boundary_distance_are_computed_from_graphs
    refute GripAnalysis::StateSpace.new(2).mixed_connected?
    refute GripAnalysis::StateSpace.new(2).mixed_cycle?
    assert GripAnalysis::StateSpace.new(3).mixed_connected?
    assert GripAnalysis::StateSpace.new(3).mixed_cycle?

    assert_equal [nil, nil, 1, 1, 2, 2, 3, 3, 4],
      (0..8).map { |count| GripAnalysis::StateSpace.new(count).max_boundary_distance }
  end

  def test_one_event_buffer_and_buffered_cycle_have_different_thresholds
    refute GripAnalysis::StateSpace.new(3).buffered_states(1).any?
    assert GripAnalysis::StateSpace.new(4).buffered_states(1).any?
    refute GripAnalysis::StateSpace.new(4).buffered_connected?(1)
    refute GripAnalysis::StateSpace.new(4).buffered_cycle?(1)
    assert GripAnalysis::StateSpace.new(5).buffered_connected?(1)
    assert GripAnalysis::StateSpace.new(5).buffered_cycle?(1)

    assert_equal 4, GripAnalysis::StateSpace.first_buffer_n(1, 0..8)
    assert_equal 5, GripAnalysis::StateSpace.first_buffered_cycle_n(1, 0..8)
    assert_equal 7, GripAnalysis::StateSpace.first_buffered_cycle_n(2, 0..8)
  end
end
