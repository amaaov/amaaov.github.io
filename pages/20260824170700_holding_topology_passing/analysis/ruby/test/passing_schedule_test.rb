require "minitest/autorun"
require_relative "../passing_notation"
require_relative "../passing_schedule"
require_relative "../passing_occupancy"
require_relative "../passing_fixtures"

class PassingScheduleTest < Minitest::Test
  def packet(notation, beat)
    PassingAnalysis::Scheduler.schedule(notation).cycle_tosses
      .select { |event| event.beat == beat }
      .map { |event| [event.from_hand, event.to_hand, event.height, event.kind] }
  end

  def test_ultimate_routes_right_hand_passes_to_the_partner_left
    schedule = PassingAnalysis::Scheduler.schedule("<3p|3p>")
    assert_equal 6, schedule.ball_count
    assert_equal 4, schedule.hand_count
    assert_equal [[1, 2, 3, "throw"], [3, 0, 3, "throw"]], packet("<3p|3p>", 0)
    assert_equal [[0, 3, 3, "throw"], [2, 1, 3, "throw"]], packet("<3p|3p>", 1)
    assert schedule.cycle_tosses.all?(&:pass)
  end

  def test_partitioned_cascade_never_leaves_its_body
    schedule = PassingAnalysis::Scheduler.schedule("<3|3>")
    assert_equal 6, schedule.ball_count
    refute schedule.cycle_tosses.any?(&:pass)
    assert_equal [[1, 0, 3, "throw"], [3, 2, 3, "throw"]], packet("<3|3>", 0)
  end

  def test_two_count_passes_on_even_beats
    schedule = PassingAnalysis::Scheduler.schedule("<3p 3|3p 3>")
    even = schedule.cycle_tosses.select { |event| event.beat.even? }
    odd = schedule.cycle_tosses.select { |event| event.beat.odd? }
    assert even.all?(&:pass)
    refute odd.any?(&:pass)
  end

  def test_seven_club_starts_on_opposite_hands
    assert_equal [[1, 2, 4, "throw"], [2, 3, 3, "throw"]], packet("<R|L><4xp|3><3|4xp>", 0)
    assert_equal [[0, 1, 3, "throw"], [3, 0, 4, "throw"]], packet("<R|L><4xp|3><3|4xp>", 1)
  end

  def test_six_object_unit_hand_occupancy_is_half_empty_and_half_two_held
    ["<3|3>", "<3p|3p>", "<3p 3|3p 3>"].each do |notation|
      occupancy = PassingAnalysis::Occupancy.shares(
        PassingAnalysis::Scheduler.schedule(notation),
        dwell_ratio: PassingAnalysis::DWELL_RATIO
      )
      assert_equal 6, occupancy.fetch(:object_count)
      assert_equal Rational(1, 2), occupancy.fetch(:p_alpha)
      assert_equal Rational(1, 2), occupancy.fetch(:p_polymorphy)
      assert_equal 0, occupancy.fetch(:p_kappa)
      assert_equal [Rational(1, 2), 0, Rational(1, 2), 0, 0, 0, 0], occupancy.fetch(:occupancy_shares)
    end
  end

  def test_seven_club_occupancy_matches_the_two_throw_packet_law
    occupancy = PassingAnalysis::Occupancy.shares(
      PassingAnalysis::Scheduler.schedule("<R|L><4xp|3><3|4xp>"),
      dwell_ratio: PassingAnalysis::DWELL_RATIO
    )
    assert_equal 7, occupancy.fetch(:object_count)
    assert_equal Rational(1, 2), occupancy.fetch(:p_alpha)
    assert_equal Rational(1, 2), occupancy.fetch(:p_polymorphy)
    assert_equal 0, occupancy.fetch(:p_kappa)
    assert_equal [Rational(1, 2), 0, Rational(1, 2), 0, 0, 0, 0, 0], occupancy.fetch(:occupancy_shares)
  end

  def test_each_body_holds_one_or_none_in_the_six_object_unit_hand_patterns
    ["<3|3>", "<3p|3p>", "<3p 3|3p 3>"].each do |notation|
      schedule = PassingAnalysis::Scheduler.schedule(notation)
      bodies = PassingAnalysis::Occupancy.body_shares(schedule, dwell_ratio: PassingAnalysis::DWELL_RATIO)
      bodies.each do |shares|
        assert_equal Rational(1, 2), shares[0]
        assert_equal Rational(1, 2), shares[1]
        assert_equal 0, shares.drop(2).sum
      end
    end
  end

  def test_solo_cascade_writing_is_rejected
    assert_raises(ArgumentError) { PassingAnalysis::Notation.parse("3") }
  end
end
