module GripAnalysis
  class PeriodicGripPath
    MACROSTATES = %i[alpha amphoteron kappa].freeze

    attr_reader :object_count, :period

    def initialize(period:, held_intervals_by_object:)
      @period = Rational(period)
      raise ArgumentError, "period must be positive" unless @period.positive?
      unless held_intervals_by_object.is_a?(Array) && held_intervals_by_object.any?
        raise ArgumentError, "at least one object is required"
      end

      @object_count = held_intervals_by_object.length
      @segments_by_object = held_intervals_by_object.map do |intervals|
        intervals.flat_map do |start, length|
          duration = Rational(length)
          raise ArgumentError, "held duration must be nonnegative" if duration.negative?

          split_interval(Rational(start), duration)
        end
      end
    end

    def macrostate_share(macrostate)
      macrostate_bout_lengths(macrostate).sum(0.to_r) / period
    end

    def occupancy_shares
      @occupancy_shares ||= Array.new(object_count + 1, 0.to_r).tap do |shares|
        membership_segments.each do |segment|
          shares[segment.fetch(:held_objects).length] += segment.fetch(:length) / period
        end
      end.freeze
    end

    def airborne_pair_exposure
      occupancy_shares.each_with_index.sum(0.to_r) do |share, held_count|
        airborne_count = object_count - held_count
        share * airborne_count * (airborne_count - 1) / 2
      end
    end

    def macrostate_bout_lengths(macrostate)
      validate_macrostate!(macrostate)
      matching = macrostate_segments.select { |segment| segment.fetch(:macrostate) == macrostate }
      return [] if matching.empty?
      return [period] if matching.length == 1 && matching.first.fetch(:length) == period

      lengths = matching.map { |segment| segment.fetch(:length) }
      if macrostate_segments.first.fetch(:macrostate) == macrostate &&
          macrostate_segments.last.fetch(:macrostate) == macrostate
        lengths[0] += lengths.pop
      end
      lengths.sort
    end

    def macrostate_entry_count(macrostate)
      lengths = macrostate_bout_lengths(macrostate)
      return 0 if lengths.empty? || lengths == [period]

      lengths.length
    end

    def macrostate_entry_rate_hz(macrostate)
      macrostate_entry_count(macrostate) / period
    end

    def macrostate_bout_statistics(macrostate)
      lengths = macrostate_bout_lengths(macrostate)
      return { count: 0, mean: 0.to_r, maximum: 0.to_r, variance: 0.to_r } if lengths.empty?

      mean = lengths.sum(0.to_r) / lengths.length
      variance = lengths.sum(0.to_r) { |length| (length - mean)**2 } / lengths.length
      { count: lengths.length, mean: mean, maximum: lengths.max, variance: variance }
    end

    def membership_change_packet_count
      membership_events.length
    end

    def membership_turnover_total
      membership_events.sum(0) { |event| event.fetch(:turnover) }
    end

    def mean_membership_turnover_per_packet
      return 0.to_r if membership_events.empty?

      Rational(membership_turnover_total, membership_change_packet_count)
    end

    def maximum_membership_turnover_per_packet
      membership_events.map { |event| event.fetch(:turnover) }.max || 0
    end

    def direct_singleton_swap_count
      membership_events.count do |event|
        before = event.fetch(:before)
        after = event.fetch(:after)
        before.length == 1 && after.length == 1 && before != after
      end
    end

    private

    def split_interval(start, length)
      return [] if length.zero?
      return [[0.to_r, period]] if length >= period

      normalized = start % period
      finish = normalized + length
      return [[normalized, finish]] if finish <= period

      [[normalized, period], [0.to_r, finish - period]]
    end

    def membership_segments
      @membership_segments ||= begin
        boundaries = ([0.to_r, period] + @segments_by_object.flatten(1)).flatten.uniq.sort
        atomic_segments = boundaries.each_cons(2).map do |start, finish|
          held_objects = @segments_by_object.each_index.select do |object_index|
            @segments_by_object.fetch(object_index).any? do |held_start, held_finish|
              held_start <= start && finish <= held_finish
            end
          end.freeze
          { start: start, finish: finish, length: finish - start, held_objects: held_objects }
        end
        merge_adjacent(atomic_segments, :held_objects)
      end
    end

    def macrostate_segments
      @macrostate_segments ||= begin
        segments = membership_segments.map do |segment|
          held_count = segment.fetch(:held_objects).length
          macrostate = if held_count.zero?
            :alpha
          elsif held_count == object_count
            :kappa
          else
            :amphoteron
          end
          segment.merge(macrostate: macrostate)
        end
        merge_adjacent(segments, :macrostate)
      end
    end

    def merge_adjacent(segments, field)
      segments.each_with_object([]) do |segment, merged|
        if merged.empty? || merged.last.fetch(field) != segment.fetch(field)
          merged << segment.dup
        else
          merged.last[:finish] = segment.fetch(:finish)
          merged.last[:length] += segment.fetch(:length)
        end
      end
    end

    def membership_events
      @membership_events ||= if membership_segments.length == 1
        []
      else
        membership_segments.each_index.each_with_object([]) do |index, events|
          before = membership_segments.fetch(index).fetch(:held_objects)
          after = membership_segments.fetch((index + 1) % membership_segments.length).fetch(:held_objects)
          turnover = (before - after).length + (after - before).length
          events << { before: before, after: after, turnover: turnover } if turnover.positive?
        end
      end
    end

    def validate_macrostate!(macrostate)
      return if MACROSTATES.include?(macrostate)

      raise ArgumentError, "unknown macrostate: #{macrostate}"
    end
  end
end
