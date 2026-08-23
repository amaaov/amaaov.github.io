require "csv"
require "fileutils"
require_relative "results"
require_relative "siteswap_protocol"
require_relative "siteswap_comparison"
require_relative "formal_results"

module GripAnalysis
  module Generate
    module_function

    ALGEBRA_HEADERS = %i[
      object_count state_count empty_count alpha_count kappa_count mixed_count mixed_formula
      mixed_graph_connected mixed_graph_cycle max_boundary_distance one_event_buffer_state_count
      one_event_buffer_exists one_event_buffer_connected one_event_buffered_cycle
      deepest_buffer_with_cycle first_mixed_connected_n first_mixed_cycle_n first_one_event_buffer_n
      first_one_event_buffered_cycle_n first_two_event_buffered_cycle_n result_class
    ].freeze
    PHASE_HEADERS = %i[
      scenario protocol_kind siteswap siteswap_period_beats observation_period_beats phase_fraction
      dwell_ratio beat_seconds period_seconds p_alpha alpha_entry_count
      alpha_entry_rate_hz alpha_bout_count alpha_bout_lengths_seconds result_class
    ].freeze
    COUNTEREXAMPLE_HEADERS = %i[
      configuration object_count phase_offset_fraction individual_airborne_duty period_beats beat_seconds
      period_seconds p_alpha alpha_entry_count alpha_entry_rate_hz alpha_bout_lengths result_class
    ].freeze
    PHASE_SWEEP_HEADERS = %i[
      object_count phase_offset_fraction individual_retention_duty individual_airborne_duty
      period_beats beat_seconds period_seconds p_alpha p_amphoteron p_kappa retention_covariance
      retention_correlation alpha_entry_count alpha_entry_rate_hz alpha_bout_count
      alpha_mean_bout_seconds alpha_maximum_bout_seconds alpha_bout_variance_seconds_squared
      amphoteron_entry_count amphoteron_entry_rate_hz amphoteron_bout_count
      amphoteron_mean_bout_seconds amphoteron_maximum_bout_seconds
      amphoteron_bout_variance_seconds_squared kappa_entry_count kappa_entry_rate_hz kappa_bout_count
      kappa_mean_bout_seconds kappa_maximum_bout_seconds kappa_bout_variance_seconds_squared
      membership_change_packet_count membership_turnover_total mean_membership_turnover_per_packet
      maximum_membership_turnover_per_packet direct_singleton_swap_count result_class
    ].freeze
    ONE_BIT_NULL_HEADERS = %i[
      object_count mixed_state_count process_assumption stationary_source_assumption
      boundary_hit_probability_from_uniform_mixed
      stationary_mean_mixed_state_visits_per_excursion stationary_mean_boundary_return_flips
      central_start_held_count central_boundary_distance central_first_passage_steps result_class
    ].freeze
    INDEPENDENT_RETENTION_NULL_HEADERS = %i[
      object_count retention_probability process_assumption p_alpha p_amphoteron p_kappa
      expected_held_count microstate_entropy_bits macrostate_entropy_bits
      conditional_information_loss_bits result_class
    ].freeze
    SITESWAP_HYPOTHESIS_HEADERS = %i[
      scenario notation timing_family object_count hand_count notation_period_beats
      protocol_cycle_beats beat_seconds dwell_ratio hold_twos period_seconds
      scheduled_packet_count active_packet_count empty_packet_count throw_action_count
      hold_action_count release_packet_count capture_packet_count max_action_packet
      max_release_packet max_capture_packet release_concentration occupancy_shares
      p_alpha p_amphoteron p_kappa mean_normalized_retention airborne_pair_exposure
      alpha_entry_count alpha_entry_rate_hz alpha_bout_count alpha_bout_lengths_seconds
      alpha_mean_bout_seconds alpha_maximum_bout_seconds model_assumption
      comparison_hypothesis empirical_status result_class
    ].freeze
    FORMAL_DERIVATION_HEADERS = %i[
      derivation case_id metric value exact_value result_class assumption
    ].freeze

    def run(analysis_directory: File.expand_path("..", __dir__), results_directory: nil)
      scenarios = Scenario.load_csv(File.join(analysis_directory, "scenarios.csv"))
      results_directory ||= ENV["GRIP_RESULTS_DIRECTORY"] || File.join(analysis_directory, "results")
      FileUtils.mkdir_p(results_directory)

      write_csv(File.join(results_directory, "algebra.csv"), ALGEBRA_HEADERS, Results.algebra_rows(0..8))
      write_exact_csv(File.join(results_directory, "phase_metrics.csv"), PHASE_HEADERS, Results.phase_rows(scenarios))
      beats = scenarios.map(&:beat_seconds).uniq
      raise ArgumentError, "phase counterexample requires one shared beat duration" unless beats.length == 1

      write_exact_csv(
        File.join(results_directory, "phase_counterexamples.csv"),
        COUNTEREXAMPLE_HEADERS,
        Results.counterexample_rows(beats.first)
      )
      write_exact_csv(
        File.join(results_directory, "phase_sweep.csv"),
        PHASE_SWEEP_HEADERS,
        Results.phase_sweep_rows(beats.first)
      )
      write_exact_csv(
        File.join(results_directory, "one_bit_null.csv"),
        ONE_BIT_NULL_HEADERS,
        Results.one_bit_null_rows(2..12)
      )
      write_exact_csv(
        File.join(results_directory, "independent_retention_null.csv"),
        INDEPENDENT_RETENTION_NULL_HEADERS,
        Results.independent_retention_null_rows
      )
      protocols = SiteswapProtocol.load_csv(File.join(analysis_directory, "siteswap_protocols.csv"))
      write_exact_csv(
        File.join(results_directory, "siteswap_hypotheses_ruby.csv"),
        SITESWAP_HYPOTHESIS_HEADERS,
        SiteswapComparison.rows(protocols)
      )
      write_csv(
        File.join(results_directory, "formal_derivations_ruby.csv"),
        FORMAL_DERIVATION_HEADERS,
        FormalResults.rows
      )
    end

    def write_csv(path, headers, rows)
      CSV.open(path, "w", write_headers: true, headers: headers) do |csv|
        rows.each { |row| csv << headers.map { |header| serialize(row.fetch(header)) } }
      end
    end

    def write_exact_csv(path, headers, rows)
      exact_fields = headers.select do |header|
        rows.any? { |row| row.fetch(header).is_a?(Rational) || row.fetch(header).is_a?(Array) }
      end
      exact_headers = headers.flat_map { |header| exact_fields.include?(header) ? [header, "#{header}_exact".to_sym] : [header] }
      CSV.open(path, "w", write_headers: true, headers: exact_headers) do |csv|
        rows.each do |row|
          csv << headers.flat_map do |header|
            value = row.fetch(header)
            exact_fields.include?(header) ? [serialize(value), exact(value)] : [serialize(value)]
          end
        end
      end
    end

    def serialize(value)
      return value.map { |entry| decimal(entry) }.join(";") if value.is_a?(Array)
      return decimal(value) if value.is_a?(Rational)
      return decimal(value) if value.is_a?(Float)

      value
    end

    def exact(value)
      return value.map { |entry| fraction(entry) }.join(";") if value.is_a?(Array)
      return fraction(value) if value.is_a?(Rational)

      value
    end

    def decimal(value)
      format("%.12g", value.to_f)
    end

    def fraction(value)
      value.denominator == 1 ? value.numerator.to_s : "#{value.numerator}/#{value.denominator}"
    end
  end
end

GripAnalysis::Generate.run if $PROGRAM_NAME == __FILE__
