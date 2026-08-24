require_relative "periodic_grip_path"

module GripAnalysis
  module SiteswapComparison
    module_function

    MODEL_ASSUMPTION = "exact periodic intervals; non-hold flight=(height-2*dwell)*beat; declared hold-2 actions remain retained"
    EMPIRICAL_STATUS = "untested empirical hypothesis"
    HYPOTHESES = {
      "3" => "Test whether alpha exposure and bout structure predict correction or error beyond throw labels.",
      "55500" => "Test whether clustered empty beats increase correction demand beyond matched dwell and tempo.",
      "441" => "Test whether throw-height order changes effort despite a matched aggregate retention signature.",
      "531" => "Test whether throw-height order changes effort despite a matched aggregate retention signature.",
      "2[22]" => "Test whether modeled full retention lowers error while increasing persistent hand load.",
      "([44],4)(0,0)([22],2)" => "Test whether three-object release and catch packets raise correlated catch error.",
      "5(2,4)1" => "Test whether hybrid packet switching changes error after controlling for modeled retention."
    }.freeze

    def rows(protocols)
      protocols.map { |protocol| row(protocol) }
    end

    def row(protocol)
      path = grip_path(protocol)
      occupancy = path.occupancy_shares
      alpha_bouts = path.macrostate_bout_lengths(:alpha)
      alpha_statistics = path.macrostate_bout_statistics(:alpha)
      action_packets = grouped_positive_actions(protocol)
      release_packets = protocol.throws.group_by(&:beat)
      capture_packets = protocol.throws.group_by { |action| capture_beat(protocol, action) }
      {
        scenario: protocol.scenario,
        notation: protocol.notation,
        timing_family: protocol.timing_family,
        object_count: protocol.object_count,
        hand_count: protocol.hand_count,
        notation_period_beats: protocol.notation_period_beats,
        protocol_cycle_beats: protocol.protocol_cycle_beats,
        beat_seconds: protocol.beat_seconds,
        dwell_ratio: protocol.dwell_ratio,
        hold_twos: protocol.hold_twos,
        period_seconds: protocol.protocol_cycle_beats * protocol.beat_seconds,
        scheduled_packet_count: protocol.packets.length,
        active_packet_count: action_packets.length,
        empty_packet_count: protocol.packets.count { |_beat, actions| actions.all? { |action| action.kind == "empty" } },
        throw_action_count: protocol.throws.length,
        hold_action_count: protocol.holds.length,
        release_packet_count: release_packets.length,
        capture_packet_count: capture_packets.length,
        max_action_packet: maximum_packet_size(action_packets),
        max_release_packet: maximum_packet_size(release_packets),
        max_capture_packet: maximum_packet_size(capture_packets),
        release_concentration: release_concentration(release_packets, protocol.throws.length),
        occupancy_shares: occupancy,
        p_alpha: occupancy.first,
        p_polymorphy: occupancy[1...-1].sum(0.to_r),
        p_kappa: occupancy.last,
        mean_normalized_retention: normalized_retention(occupancy, protocol.object_count),
        airborne_pair_exposure: path.airborne_pair_exposure,
        alpha_entry_count: path.macrostate_entry_count(:alpha),
        alpha_entry_rate_hz: path.macrostate_entry_rate_hz(:alpha),
        alpha_bout_count: alpha_bouts.length,
        alpha_bout_lengths_seconds: alpha_bouts,
        alpha_mean_bout_seconds: alpha_statistics.fetch(:mean),
        alpha_maximum_bout_seconds: alpha_statistics.fetch(:maximum),
        model_assumption: MODEL_ASSUMPTION,
        comparison_hypothesis: HYPOTHESES.fetch(protocol.notation),
        empirical_status: EMPIRICAL_STATUS,
        result_class: "model consequence"
      }
    end

    def grip_path(protocol)
      beat = protocol.beat_seconds
      intervals = protocol.held_intervals_by_object.map do |object_intervals|
        object_intervals.map { |start, length| [start * beat, length * beat] }
      end
      PeriodicGripPath.new(
        period: protocol.protocol_cycle_beats * beat,
        held_intervals_by_object: intervals
      )
    end

    def grouped_positive_actions(protocol)
      protocol.positive_actions.group_by(&:beat)
    end

    def capture_beat(protocol, action)
      (action.beat + protocol.flight_beats(action)) % protocol.protocol_cycle_beats
    end

    def maximum_packet_size(packets)
      packets.values.map(&:length).max || 0
    end

    def release_concentration(packets, throw_count)
      return 0.to_r if throw_count.zero?

      Rational(packets.values.sum { |packet| packet.length * (packet.length - 1) }, throw_count)
    end

    def normalized_retention(occupancy, object_count)
      occupancy.each_with_index.sum(0.to_r) { |share, held_count| share * held_count } / object_count
    end
  end
end
