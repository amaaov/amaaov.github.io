require "minitest/autorun"
require_relative "../siteswap_protocol"
require_relative "../siteswap_comparison"

class SiteswapComparisonTest < Minitest::Test
  PROTOCOLS_PATH = File.expand_path("../../siteswap_protocols.csv", __dir__)
  REQUIRED_NOTATIONS = [
    "3", "55500", "441", "531", "2[22]",
    "([44],4)(0,0)([22],2)", "5(2,4)1"
  ].freeze

  def setup
    @protocols = GripAnalysis::SiteswapProtocol.load_csv(PROTOCOLS_PATH)
    @rows = GripAnalysis::SiteswapComparison.rows(@protocols)
  end

  def test_fixture_covers_the_curated_protocols_at_one_declared_timing
    assert_equal REQUIRED_NOTATIONS, @protocols.map(&:notation)
    assert @protocols.all? { |protocol| protocol.object_count == 3 }
    assert @protocols.all? { |protocol| protocol.beat_seconds == Rational(2, 5) }
    assert @protocols.all? { |protocol| protocol.dwell_ratio == Rational(1, 4) }
    assert @protocols.all?(&:valid_conservation?)
  end

  def test_async_packet_timing_changes_alpha_but_height_order_does_not
    cascade = row("3")
    clustered = row("55500")
    four_four_one = row("441")
    five_three_one = row("531")

    assert_equal Rational(1, 2), cascade.fetch(:p_alpha)
    assert_equal Rational(7, 10), clustered.fetch(:p_alpha)
    assert_equal cascade.fetch(:occupancy_shares), four_four_one.fetch(:occupancy_shares)
    assert_equal cascade.fetch(:occupancy_shares), five_three_one.fetch(:occupancy_shares)
    assert_equal 1, cascade.fetch(:max_release_packet)
    assert_equal 0, cascade.fetch(:release_concentration)
  end

  def test_hold_and_sync_protocols_expose_opposite_boundary_occupancy
    hold = row("2[22]")
    synchronous = row("([44],4)(0,0)([22],2)")

    assert_equal [0, 0, 0, 1], hold.fetch(:occupancy_shares)
    assert_equal 0, hold.fetch(:max_release_packet)
    assert_equal 2, hold.fetch(:max_action_packet)
    assert_equal Rational(7, 12), synchronous.fetch(:p_alpha)
    assert_equal Rational(5, 12), synchronous.fetch(:p_kappa)
    assert_equal Rational(7, 4), synchronous.fetch(:airborne_pair_exposure)
    assert_equal 3, synchronous.fetch(:max_release_packet)
    assert_equal 2, synchronous.fetch(:release_concentration)
  end

  def test_hybrid_retention_signature_and_alpha_bouts_are_exact
    hybrid = row("5(2,4)1")

    assert_equal [Rational(1, 4), Rational(5, 8), Rational(1, 8), 0],
      hybrid.fetch(:occupancy_shares)
    assert_equal Rational(1, 4), hybrid.fetch(:p_alpha)
    assert_equal Rational(3, 4), hybrid.fetch(:p_polymorphy)
    assert_equal 4, hybrid.fetch(:alpha_entry_count)
    assert_equal [Rational(1, 5)] * 4, hybrid.fetch(:alpha_bout_lengths_seconds)
    assert_equal 2, hybrid.fetch(:max_action_packet)
    assert_equal 1, hybrid.fetch(:max_release_packet)
  end

  def test_rows_separate_model_results_from_empirical_hypotheses
    @rows.each do |row|
      assert_equal "model consequence", row.fetch(:result_class)
      assert_equal "untested empirical hypothesis", row.fetch(:empirical_status)
      refute_empty row.fetch(:model_assumption)
      refute_empty row.fetch(:comparison_hypothesis)
    end
  end

  def test_every_row_preserves_the_occupancy_partition
    @rows.each do |row|
      assert_equal 1, row.fetch(:occupancy_shares).sum
      assert_equal 1,
        row.fetch(:p_alpha) + row.fetch(:p_polymorphy) + row.fetch(:p_kappa)
      assert_operator row.fetch(:airborne_pair_exposure), :>=, 0
    end
  end

  def test_protocol_rejects_a_broken_object_cycle
    protocol = @protocols.first
    actions = protocol.actions.map(&:dup)
    actions.first.height = 2

    error = assert_raises(ArgumentError) do
      GripAnalysis::SiteswapProtocol.new(
        scenario: protocol.scenario,
        notation: protocol.notation,
        timing_family: protocol.timing_family,
        notation_period_beats: protocol.notation_period_beats,
        protocol_cycle_beats: protocol.protocol_cycle_beats,
        object_count: protocol.object_count,
        hand_count: protocol.hand_count,
        beat_seconds: protocol.beat_seconds,
        dwell_ratio: protocol.dwell_ratio,
        hold_twos: protocol.hold_twos,
        actions: actions
      )
    end
    assert_match(/object conservation/, error.message)
  end

  private

  def row(notation)
    @rows.find { |candidate| candidate.fetch(:notation) == notation }
  end
end
