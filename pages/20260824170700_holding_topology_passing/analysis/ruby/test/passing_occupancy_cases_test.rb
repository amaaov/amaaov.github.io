require "minitest/autorun"
require_relative "../passing_fixtures"
require_relative "../passing_schedule"
require_relative "../passing_occupancy"
require_relative "../passing_four_hand"

class PassingOccupancyCasesTest < Minitest::Test
  DWELL = PassingAnalysis::DWELL_RATIO

  def shares(notation, grammar: "jl")
    schedule = grammar == "4hs" ?
      PassingAnalysis::FourHand.schedule(notation) :
      PassingAnalysis::Scheduler.schedule(notation)
    PassingAnalysis::Occupancy.shares(schedule, dwell_ratio: DWELL)
  end

  def test_four_club_hold_stays_in_kappa
    occupancy = shares("<2|2>")
    assert_equal 4, occupancy.fetch(:object_count)
    assert_equal 0, occupancy.fetch(:p_alpha)
    assert_equal 0, occupancy.fetch(:p_polymorphy)
    assert_equal 1, occupancy.fetch(:p_kappa)
  end

  def test_two_club_one_count_alternates_empty_and_all_held
    occupancy = shares("<1p|1p>")
    assert_equal [Rational(1, 2), 0, Rational(1, 2)], occupancy.fetch(:occupancy_shares)
  end

  def test_zip_and_flash_jobs_have_distinct_occupancy_vectors
    assert_equal [0, 0, Rational(1, 2), Rational(1, 2)],
      shares("<1p 2|2 1p>").fetch(:occupancy_shares)
    assert_equal [0, 0, Rational(3, 4), 0, Rational(1, 4)],
      shares("<2p 2|2p 2>").fetch(:occupancy_shares)
    assert_equal [Rational(1, 6), 0, Rational(2, 3), 0, Rational(1, 6)],
      shares("<2p 2p 2|2p 2p 2>").fetch(:occupancy_shares)
    assert_equal [0, 0, Rational(3, 8), 0, Rational(5, 8)],
      shares("<2p 2 2 2|2p 2 2 2>").fetch(:occupancy_shares)
    assert_equal [Rational(3, 4), 0, Rational(1, 4), 0, 0],
      shares("<4 0|4 0>").fetch(:occupancy_shares)
  end

  def test_six_club_pps_keeps_the_two_throw_packet_law
    occupancy = shares("<3p 3p 3|3p 3p 3>")
    assert_equal [Rational(1, 2), 0, Rational(1, 2), 0, 0, 0, 0], occupancy.fetch(:occupancy_shares)
  end

  def test_three_body_uniform_threes_are_a_packet_of_three
    ["<3p2|3p3|3p1>", "<3p2|3p3|3p1><3|3|3>", "<3p2 3 3p3 3|3p1 3 3 3|3 3 3p1 3>"].each do |notation|
      occupancy = shares(notation)
      assert_equal 9, occupancy.fetch(:object_count)
      assert_equal Rational(1, 2), occupancy.fetch(:p_alpha)
      assert_equal Rational(1, 2), occupancy.fetch(:p_polymorphy)
      assert_equal 0, occupancy.fetch(:p_kappa)
      assert_equal Rational(1, 2), occupancy.fetch(:occupancy_shares)[3]
    end
  end

  def test_triangle_with_zips_can_hold_every_object
    occupancy = shares("<2p2|2p3|2p1><2|2|2>")
    assert_equal 6, occupancy.fetch(:object_count)
    assert_equal Rational(1, 4), occupancy.fetch(:p_kappa)
    assert_equal [0, 0, 0, Rational(3, 4), 0, 0, Rational(1, 4)], occupancy.fetch(:occupancy_shares)
  end

  def test_four_hand_seven_holds_exactly_one_club
    schedule = PassingAnalysis::FourHand.schedule("7")
    occupancy = PassingAnalysis::Occupancy.shares(schedule, dwell_ratio: DWELL)
    assert_equal 4, schedule.hand_period
    assert_equal 7, occupancy.fetch(:object_count)
    assert_equal 0, occupancy.fetch(:p_alpha)
    assert_equal 1, occupancy.fetch(:p_polymorphy)
    assert_equal 0, occupancy.fetch(:p_kappa)
    assert_equal Rational(1, 1), occupancy.fetch(:occupancy_shares)[1]
    assert_equal 0, occupancy.fetch(:occupancy_shares)[2]
  end

  def test_four_hand_named_jobs_use_one_throw_per_beat
    assert_equal [0, 0, 0, 1, 0, 0], shares("744", grammar: "4hs").fetch(:occupancy_shares)
    occupancy = shares("77466", grammar: "4hs")
    assert_equal 6, occupancy.fetch(:object_count)
    assert_equal [0, Rational(2, 5), Rational(3, 5), 0, 0, 0, 0], occupancy.fetch(:occupancy_shares)
    assert_equal [0, 1, 0, 0, 0, 0], shares("77722", grammar: "4hs").fetch(:occupancy_shares)
    assert_equal 7, shares("966", grammar: "4hs").fetch(:object_count)
    assert_equal Rational(1, 1), shares("966", grammar: "4hs").fetch(:occupancy_shares)[1]
  end
end
