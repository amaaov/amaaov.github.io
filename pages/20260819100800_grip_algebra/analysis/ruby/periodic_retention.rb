module GripAnalysis
  class PeriodicRetention
    attr_reader :period

    def initialize(period:, held_intervals:)
      @period = Rational(period)
      raise ArgumentError, "period must be positive" unless @period.positive?

      @held_intervals = held_intervals.map do |start, length|
        interval = [Rational(start), Rational(length)]
        raise ArgumentError, "held duration must be nonnegative" if interval.last.negative?

        interval
      end
    end

    def alpha_bout_lengths
      coverage = merged_coverage
      return [period] if coverage.empty?
      return [] if coverage == [[0, period]]

      gaps = coverage.each_cons(2).each_with_object([]) do |(left, right), matching|
        length = right.first - left.last
        matching << length if length.positive?
      end
      wrap = period - coverage.last.last + coverage.first.first
      gaps << wrap if wrap.positive?
      gaps.sort
    end

    def p_alpha
      alpha_bout_lengths.sum(0.to_r) / period
    end

    def alpha_entry_count
      coverage = merged_coverage
      return 0 if coverage.empty? || alpha_bout_lengths.empty?

      alpha_bout_lengths.length
    end

    def alpha_entry_rate_hz
      alpha_entry_count / period
    end

    private

    def merged_coverage
      @merged_coverage ||= begin
        segments = @held_intervals.flat_map { |start, length| split_interval(start, length) }.sort_by(&:first)
        segments.each_with_object([]) do |segment, merged|
          if merged.empty? || segment.first > merged.last.last
            merged << segment.dup
          else
            merged.last[1] = [merged.last.last, segment.last].max
          end
        end
      end
    end

    def split_interval(start, length)
      return [] if length.zero?
      return [[0.to_r, period]] if length >= period

      normalized = start % period
      finish = normalized + length
      return [[normalized, finish]] if finish <= period

      [[normalized, period], [0.to_r, finish - period]]
    end
  end

  class CascadePhase
    attr_reader :beat_seconds, :dwell_ratio, :period_seconds

    def initialize(dwell_ratio:, beat_seconds:)
      @dwell_ratio = Rational(dwell_ratio)
      @beat_seconds = Rational(beat_seconds)
      raise ArgumentError, "dwell_ratio must lie in [0, 1]" unless (0..1).cover?(@dwell_ratio)
      raise ArgumentError, "beat_seconds must be positive" unless @beat_seconds.positive?

      @period_seconds = 3 * @beat_seconds
      held_duration = 2 * @dwell_ratio * @beat_seconds
      intervals = 3.times.map { |phase| [phase * @beat_seconds - held_duration, held_duration] }
      @retention = PeriodicRetention.new(period: @period_seconds, held_intervals: intervals)
    end

    def p_alpha
      @retention.p_alpha
    end

    def alpha_entry_count
      @retention.alpha_entry_count
    end

    def alpha_entry_rate_hz
      @retention.alpha_entry_rate_hz
    end

    def alpha_bout_lengths
      @retention.alpha_bout_lengths
    end
  end

  module PhaseCounterexample
    module_function

    def rows(beat_seconds:)
      beat = Rational(beat_seconds)
      period = 5 * beat
      held = 2 * beat
      {
        aligned: metrics(period, [[0, held], [0, held]]),
        half_cycle_offset: metrics(period, [[0, held], [period / 2, held]])
      }
    end

    def metrics(period, intervals)
      retention = PeriodicRetention.new(period: period, held_intervals: intervals)
      {
        period_seconds: period,
        individual_airborne_duty: Rational(3, 5),
        p_alpha: retention.p_alpha,
        alpha_entry_count: retention.alpha_entry_count,
        alpha_entry_rate_hz: retention.alpha_entry_rate_hz,
        alpha_bout_lengths: retention.alpha_bout_lengths
      }
    end
  end
end
