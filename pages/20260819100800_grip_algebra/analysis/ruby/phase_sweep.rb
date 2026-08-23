require_relative "periodic_grip_path"

module GripAnalysis
  module TwoObjectPhaseSweep
    module_function

    DEFAULT_PHASE_OFFSETS = (0..20).map { |index| Rational(index, 40) }.freeze

    def rows(beat_seconds:, phase_offsets: DEFAULT_PHASE_OFFSETS)
      beat = Rational(beat_seconds)
      raise ArgumentError, "beat_seconds must be positive" unless beat.positive?

      period = 5 * beat
      held_duration = 2 * beat
      individual_retention_duty = held_duration / period
      phase_offsets.map do |phase_offset_fraction|
        offset = Rational(phase_offset_fraction)
        unless (0.to_r..Rational(1, 2)).cover?(offset)
          raise ArgumentError, "phase offset must lie in [0, 1/2]"
        end

        path = PeriodicGripPath.new(
          period: period,
          held_intervals_by_object: [[[0, held_duration]], [[offset * period, held_duration]]]
        )
        macrostate_metrics(path).merge(
          object_count: 2,
          phase_offset_fraction: offset,
          individual_retention_duty: individual_retention_duty,
          individual_airborne_duty: 1 - individual_retention_duty,
          period_beats: 5,
          beat_seconds: beat,
          period_seconds: period,
          retention_covariance: path.macrostate_share(:kappa) - individual_retention_duty**2,
          retention_correlation: (
            path.macrostate_share(:kappa) - individual_retention_duty**2
          ) / (individual_retention_duty * (1 - individual_retention_duty)),
          membership_change_packet_count: path.membership_change_packet_count,
          membership_turnover_total: path.membership_turnover_total,
          mean_membership_turnover_per_packet: path.mean_membership_turnover_per_packet,
          maximum_membership_turnover_per_packet: path.maximum_membership_turnover_per_packet,
          direct_singleton_swap_count: path.direct_singleton_swap_count
        )
      end
    end

    def macrostate_metrics(path)
      PeriodicGripPath::MACROSTATES.each_with_object({}) do |macrostate, metrics|
        statistics = path.macrostate_bout_statistics(macrostate)
        metrics["p_#{macrostate}".to_sym] = path.macrostate_share(macrostate)
        metrics["#{macrostate}_entry_count".to_sym] = path.macrostate_entry_count(macrostate)
        metrics["#{macrostate}_entry_rate_hz".to_sym] = path.macrostate_entry_rate_hz(macrostate)
        metrics["#{macrostate}_bout_count".to_sym] = statistics.fetch(:count)
        metrics["#{macrostate}_mean_bout_seconds".to_sym] = statistics.fetch(:mean)
        metrics["#{macrostate}_maximum_bout_seconds".to_sym] = statistics.fetch(:maximum)
        metrics["#{macrostate}_bout_variance_seconds_squared".to_sym] = statistics.fetch(:variance)
      end
    end
  end
end
