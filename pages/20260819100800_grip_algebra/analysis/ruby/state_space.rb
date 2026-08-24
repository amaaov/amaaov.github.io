module GripAnalysis
  class StateSpace
    EMPTY = "∅"
    RELEASE = "α"
    HOLD = "κ"
    MIXED = "ακ"

    attr_reader :object_count

    def initialize(object_count)
      raise ArgumentError, "object_count must be a nonnegative integer" unless object_count.is_a?(Integer) && object_count >= 0

      @object_count = object_count
    end

    def states
      @states ||= (0...(2**object_count)).to_a.freeze
    end

    def classification(state)
      raise ArgumentError, "state lies outside this Boolean cube" unless states.include?(state)
      return EMPTY if object_count.zero?
      return RELEASE if state.zero?
      return HOLD if state == states.last

      MIXED
    end

    def macro_counts
      states.each_with_object(Hash.new(0)) do |state, counts|
        counts[classification(state)] += 1
      end
    end

    def mixed_states
      @mixed_states ||= states.select { |state| classification(state) == MIXED }.freeze
    end

    def mixed_count
      [2**object_count - 2, 0].max
    end

    def mixed_connected?
      graph_connected?(mixed_states)
    end

    def mixed_cycle?
      graph_cycle?(mixed_states)
    end

    def mixed_edge_count
      allowed = mixed_states.to_h { |state| [state, true] }
      mixed_states.sum do |state|
        neighbors(state, allowed).count { |neighbor| neighbor > state }
      end
    end

    def mixed_cycle_rank
      unless object_count >= 3 && mixed_connected?
        raise ArgumentError, "cycle rank here requires a connected mixed graph"
      end

      mixed_edge_count - mixed_states.length + 1
    end

    def boundary_distance(state)
      held = state.digits(2).count(1)
      [held, object_count - held].min
    end

    def max_boundary_distance
      mixed_states.map { |state| boundary_distance(state) }.max
    end

    def buffered_states(events)
      raise ArgumentError, "events must be a nonnegative integer" unless events.is_a?(Integer) && events >= 0

      mixed_states.select { |state| boundary_distance(state) > events }
    end

    def buffered_connected?(events)
      graph_connected?(buffered_states(events))
    end

    def buffered_cycle?(events)
      graph_cycle?(buffered_states(events))
    end

    def deepest_buffer_with_cycle
      distance = max_boundary_distance
      return unless distance&.positive?

      (0...distance).select { |events| buffered_cycle?(events) }.max
    end

    def self.first_buffer_n(events, object_counts)
      object_counts.find { |count| new(count).buffered_states(events).any? }
    end

    def self.first_buffered_cycle_n(events, object_counts)
      object_counts.find { |count| new(count).buffered_cycle?(events) }
    end

    private

    def neighbors(state, allowed)
      object_count.times.each_with_object([]) do |bit, matching|
        neighbor = state ^ (1 << bit)
        matching << neighbor if allowed.include?(neighbor)
      end
    end

    def graph_connected?(vertices)
      return false if vertices.empty?

      allowed = vertices.to_h { |state| [state, true] }
      seen = { vertices.first => true }
      queue = [vertices.first]
      until queue.empty?
        state = queue.shift
        neighbors(state, allowed).each do |neighbor|
          next if seen[neighbor]

          seen[neighbor] = true
          queue << neighbor
        end
      end
      seen.length == vertices.length
    end

    def graph_cycle?(vertices)
      allowed = vertices.to_h { |state| [state, true] }
      seen = {}
      visit = lambda do |state, parent|
        seen[state] = true
        neighbors(state, allowed).any? do |neighbor|
          next false if neighbor == parent

          seen[neighbor] || visit.call(neighbor, state)
        end
      end
      vertices.any? { |state| !seen[state] && visit.call(state, nil) }
    end
  end
end
