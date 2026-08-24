module GripAnalysis
  module Combinatorics
    module_function

    def fubini_number(object_count)
      unless object_count.is_a?(Integer) && object_count >= 0
        raise ArgumentError, "object count must be a nonnegative integer"
      end

      values = [1]
      (1..object_count).each do |size|
        values << (1..size).sum { |block_size| binomial(size, block_size) * values.fetch(size - block_size) }
      end
      values.fetch(object_count)
    end

    def companion_release_count(packet_sizes)
      sizes = Array(packet_sizes)
      unless sizes.all? { |size| size.is_a?(Integer) && size >= 0 }
        raise ArgumentError, "packet sizes must be nonnegative integers"
      end

      total = sizes.sum
      return 0.to_r if total.zero?

      Rational(sizes.sum { |size| size * (size - 1) }, total)
    end

    def interior_state_count(object_count, buffer_events)
      unless object_count.is_a?(Integer) && object_count >= 0
        raise ArgumentError, "object count must be a nonnegative integer"
      end
      unless buffer_events.is_a?(Integer) && buffer_events >= 0
        raise ArgumentError, "buffer events must be a nonnegative integer"
      end

      (0..object_count).sum do |held|
        next 0 if [held, object_count - held].min <= buffer_events

        binomial(object_count, held)
      end
    end

    def mixed_cycle_rank(object_count)
      unless object_count.is_a?(Integer) && object_count >= 3
        raise ArgumentError, "connected mixed graph starts at three objects"
      end

      (object_count - 2) * 2**(object_count - 1) - 2 * object_count + 3
    end

    def binomial(total, selected)
      return 0 if selected.negative? || selected > total

      selection = [selected, total - selected].min
      (1..selection).reduce(1) do |product, index|
        product * (total - selection + index) / index
      end
    end
  end
end
