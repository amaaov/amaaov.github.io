require_relative "passing_schedule"

module PassingAnalysis
  module Occupancy
    module_function

    def shares(schedule, dwell_ratio:)
      period = schedule.cycle_length
      dwell = schedule.hand_period * Rational(dwell_ratio)
      intervals = Hash.new { |table, object| table[object] = [] }
      schedule.cycle_tosses.each do |event|
        next if event.kind == "empty" || event.ball.nil?

        if event.kind == "hold"
          intervals[event.ball] << [event.beat, event.height]
        else
          intervals[event.ball] << [event.beat + event.height - dwell, dwell]
        end
      end
      segments = intervals.keys.sort.map do |object|
        intervals.fetch(object).flat_map { |start, length| split_interval(start, length, period) }
      end
      boundaries = ([0, period] + segments.flatten).uniq.sort
      occupancy_ticks = Array.new(schedule.ball_count + 1, 0.to_r)
      boundaries.each_cons(2) do |start, finish|
        held = segments.count do |object_segments|
          object_segments.any? { |held_start, held_finish| held_start <= start && finish <= held_finish }
        end
        occupancy_ticks[held] += finish - start
      end
      shares = occupancy_ticks.map { |ticks| ticks / period }
      {
        object_count: schedule.ball_count,
        occupancy_shares: shares,
        p_alpha: shares.first,
        p_polymorphy: shares[1...-1].sum(0.to_r),
        p_kappa: shares.last
      }
    end

    def body_shares(schedule, dwell_ratio:)
      period = schedule.cycle_length
      dwell = schedule.hand_period * Rational(dwell_ratio)
      intervals = Hash.new { |table, object| table[object] = [] }
      schedule.cycle_tosses.each do |event|
        next if event.kind == "empty" || event.ball.nil?

        if event.kind == "hold"
          intervals[event.ball] << [event.beat, event.height, event.from_body]
        else
          intervals[event.ball] << [event.beat + event.height - dwell, dwell, event.to_body]
        end
      end
      objects = intervals.keys.sort
      segments = objects.map do |object|
        intervals.fetch(object).flat_map do |start, length, body|
          split_interval(start, length, period).map { |held_start, held_finish| [held_start, held_finish, body] }
        end
      end
      boundaries = [0.to_r, period.to_r]
      segments.each do |object_segments|
        object_segments.each do |held_start, held_finish, _body|
          boundaries << held_start << held_finish
        end
      end
      boundaries = boundaries.uniq.sort
      body_ticks = Array.new(schedule.body_count) { Array.new(schedule.ball_count + 1, 0.to_r) }
      boundaries.each_cons(2) do |start, finish|
        held_by_body = Array.new(schedule.body_count, 0)
        segments.each do |object_segments|
          match = object_segments.find { |held_start, held_finish, _body| held_start <= start && finish <= held_finish }
          held_by_body[match[2]] += 1 if match
        end
        schedule.body_count.times do |body|
          body_ticks[body][held_by_body[body]] += finish - start
        end
      end
      body_ticks.map { |ticks| ticks.map { |count| count / period } }
    end

    def split_interval(start, length, period)
      return [] if length.zero?
      return [[0.to_r, period]] if length >= period

      normalized = start % period
      finish = normalized + length
      return [[normalized, finish]] if finish <= period

      [[normalized, period], [0.to_r, finish - period]]
    end
  end
end
