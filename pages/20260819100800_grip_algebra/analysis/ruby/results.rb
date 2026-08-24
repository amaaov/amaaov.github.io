require "csv"
require_relative "state_space"
require_relative "periodic_retention"
require_relative "phase_sweep"
require_relative "one_bit_flip_null"
require_relative "independent_retention_null"

module GripAnalysis
  Scenario = Struct.new(
    :name,
    :protocol_kind,
    :siteswap,
    :object_count,
    :hand_count,
    :siteswap_period_beats,
    :observation_period_beats,
    :phase_fraction,
    :beat_seconds,
    :dwell_ratio,
    keyword_init: true
  ) do
    def self.load_csv(path)
      CSV.read(path, headers: true).map do |row|
        new(
          name: row.fetch("name"),
          protocol_kind: row.fetch("protocol_kind"),
          siteswap: row.fetch("siteswap"),
          object_count: Integer(row.fetch("object_count")),
          hand_count: Integer(row.fetch("hand_count")),
          siteswap_period_beats: Rational(row.fetch("siteswap_period_beats")),
          observation_period_beats: Rational(row.fetch("observation_period_beats")),
          phase_fraction: Rational(row.fetch("phase_fraction")),
          beat_seconds: Rational(row.fetch("beat_seconds")),
          dwell_ratio: Rational(row.fetch("dwell_ratio"))
        )
      end
    end
  end

  module Results
    module_function

    def algebra_rows(object_counts)
      first_mixed_connected = object_counts.find { |count| StateSpace.new(count).mixed_connected? }
      first_mixed_cycle = object_counts.find { |count| StateSpace.new(count).mixed_cycle? }
      first_buffer = StateSpace.first_buffer_n(1, object_counts)
      first_buffered_cycle = StateSpace.first_buffered_cycle_n(1, object_counts)
      first_two_event_cycle = StateSpace.first_buffered_cycle_n(2, object_counts)
      object_counts.map do |object_count|
        space = StateSpace.new(object_count)
        counts = space.macro_counts
        one_event_states = space.buffered_states(1)
        {
          object_count: object_count,
          state_count: space.states.length,
          empty_count: counts.fetch(StateSpace::EMPTY, 0),
          alpha_count: counts.fetch(StateSpace::RELEASE, 0),
          kappa_count: counts.fetch(StateSpace::HOLD, 0),
          mixed_count: space.mixed_states.length,
          mixed_formula: space.mixed_count,
          mixed_graph_connected: space.mixed_connected?,
          mixed_graph_cycle: space.mixed_cycle?,
          max_boundary_distance: space.max_boundary_distance,
          one_event_buffer_state_count: one_event_states.length,
          one_event_buffer_exists: one_event_states.any?,
          one_event_buffer_connected: space.buffered_connected?(1),
          one_event_buffered_cycle: space.buffered_cycle?(1),
          deepest_buffer_with_cycle: space.deepest_buffer_with_cycle,
          first_mixed_connected_n: first_mixed_connected,
          first_mixed_cycle_n: first_mixed_cycle,
          first_one_event_buffer_n: first_buffer,
          first_one_event_buffered_cycle_n: first_buffered_cycle,
          first_two_event_buffered_cycle_n: first_two_event_cycle,
          result_class: "theorem"
        }
      end
    end

    def phase_rows(scenarios)
      scenarios.map do |scenario|
        validate_cascade!(scenario)
        phase = CascadePhase.new(dwell_ratio: scenario.dwell_ratio, beat_seconds: scenario.beat_seconds)
        {
          scenario: scenario.name,
          protocol_kind: scenario.protocol_kind,
          siteswap: scenario.siteswap,
          siteswap_period_beats: scenario.siteswap_period_beats,
          observation_period_beats: scenario.observation_period_beats,
          phase_fraction: scenario.phase_fraction,
          dwell_ratio: scenario.dwell_ratio,
          beat_seconds: scenario.beat_seconds,
          period_seconds: phase.period_seconds,
          p_alpha: phase.p_alpha,
          alpha_entry_count: phase.alpha_entry_count,
          alpha_entry_rate_hz: phase.alpha_entry_rate_hz,
          alpha_bout_count: phase.alpha_bout_lengths.length,
          alpha_bout_lengths_seconds: phase.alpha_bout_lengths,
          result_class: "model consequence"
        }
      end
    end

    def counterexample_rows(beat_seconds)
      PhaseCounterexample.rows(beat_seconds: beat_seconds).map do |configuration, metrics|
        metrics.merge(
          configuration: configuration.to_s,
          phase_offset_fraction: configuration == :aligned ? 0.to_r : Rational(1, 2),
          object_count: 2,
          period_beats: 5,
          beat_seconds: Rational(beat_seconds),
          result_class: "model consequence"
        )
      end
    end

    def phase_sweep_rows(beat_seconds)
      TwoObjectPhaseSweep.rows(beat_seconds: beat_seconds).map do |row|
        row.merge(result_class: "model consequence")
      end
    end

    def one_bit_null_rows(object_counts)
      object_counts.map do |object_count|
        process = OneBitFlipNull.new(object_count)
        {
          object_count: object_count,
          mixed_state_count: process.mixed_state_count,
          process_assumption: "independent uniform bit choice per event",
          stationary_source_assumption: "uniform hypercube stationary law conditioned on the mixed region",
          boundary_hit_probability_from_uniform_mixed: process.boundary_hit_probability_from_uniform_mixed,
          stationary_mean_mixed_state_visits_per_excursion:
            process.mean_mixed_state_visits_per_excursion,
          stationary_mean_boundary_return_flips: process.mean_boundary_return_flips,
          central_start_held_count: process.central_start_held_count,
          central_boundary_distance: process.central_boundary_distance,
          central_first_passage_steps: process.central_first_passage_steps,
          result_class: "theorem"
        }
      end
    end

    def independent_retention_null_rows(
      object_counts: [3, 5, 10],
      retention_probabilities: [Rational(1, 10), Rational(1, 4), Rational(1, 2), Rational(3, 4), Rational(9, 10)]
    )
      object_counts.product(retention_probabilities).map do |object_count, retention_probability|
        model = IndependentRetentionNull.new(
          object_count: object_count,
          retention_probability: retention_probability
        )
        {
          object_count: object_count,
          retention_probability: retention_probability,
          process_assumption: "stationary mutually independent Bernoulli retention",
          p_alpha: model.p_alpha,
          p_polymorphy: model.p_polymorphy,
          p_kappa: model.p_kappa,
          expected_held_count: model.expected_held_count,
          microstate_entropy_bits: model.microstate_entropy_bits,
          macrostate_entropy_bits: model.macrostate_entropy_bits,
          conditional_information_loss_bits: model.conditional_information_loss_bits,
          result_class: "model consequence"
        }
      end
    end

    def validate_cascade!(scenario)
      valid = scenario.protocol_kind == "steady_periodic" &&
        scenario.siteswap == "3" && scenario.object_count == 3 &&
        scenario.hand_count == 2 && scenario.siteswap_period_beats == 1 &&
        scenario.observation_period_beats == 3 && scenario.phase_fraction == Rational(1, 2)
      raise ArgumentError, "#{scenario.name} is not the configured three-ball cascade" unless valid
    end
  end
end
