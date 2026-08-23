module GripAnalysis
  class OneBitFlipNull
    attr_reader :object_count

    def initialize(object_count)
      unless object_count.is_a?(Integer) && object_count >= 2
        raise ArgumentError, "object_count must be an integer of at least two"
      end

      @object_count = object_count
    end

    def mixed_state_count
      2**object_count - 2
    end

    def boundary_hit_probability_from_uniform_mixed
      Rational(2, mixed_state_count)
    end

    def mean_mixed_excursion_steps
      Rational(2**(object_count - 1) - 1)
    end

    alias mean_mixed_state_visits_per_excursion mean_mixed_excursion_steps

    def mean_boundary_return_flips
      Rational(2**(object_count - 1))
    end

    def central_start_held_count
      object_count / 2
    end

    def central_boundary_distance
      [central_start_held_count, object_count - central_start_held_count].min
    end

    def central_first_passage_steps
      first_passage_steps_by_held_count.fetch(central_start_held_count)
    end

    def first_passage_steps(held_count)
      unless held_count.is_a?(Integer) && (0..object_count).cover?(held_count)
        raise ArgumentError, "held count must lie in 0..n"
      end
      return 0.to_r if held_count.zero? || held_count == object_count

      first_passage_steps_by_held_count.fetch(held_count)
    end

    def first_passage_recurrence_residual(held_count)
      unless held_count.is_a?(Integer) && (1...object_count).cover?(held_count)
        raise ArgumentError, "interior held count must lie in 1...n"
      end

      first_passage_steps(held_count) - 1 -
        Rational(held_count, object_count) * first_passage_steps(held_count - 1) -
        Rational(object_count - held_count, object_count) * first_passage_steps(held_count + 1)
    end

    def closed_form_first_passage_steps(held_count)
      unless held_count.is_a?(Integer) && (0..object_count).cover?(held_count)
        raise ArgumentError, "held count must lie in 0..n"
      end

      (0...held_count).sum(0.to_r) do |index|
        cumulative_states = (0..index).sum { |weight| binomial(object_count, weight) }
        Rational(
          2**(object_count - 1) - cumulative_states,
          binomial(object_count - 1, index)
        )
      end
    end

    private

    def binomial(total, selected)
      selection = [selected, total - selected].min
      (1..selection).reduce(1) do |product, index|
        product * (total - selection + index) / index
      end
    end

    def first_passage_steps_by_held_count
      @first_passage_steps_by_held_count ||= begin
        interior_count = object_count - 1
        modified_upper = Array.new(interior_count, 0.to_r)
        modified_right = Array.new(interior_count, 0.to_r)

        interior_count.times do |index|
          held_count = index + 1
          lower = index.zero? ? 0.to_r : -Rational(held_count, object_count)
          upper = index == interior_count - 1 ? 0.to_r : -Rational(object_count - held_count, object_count)
          denominator = 1.to_r - lower * (index.zero? ? 0.to_r : modified_upper.fetch(index - 1))
          modified_upper[index] = upper / denominator
          modified_right[index] = (
            1.to_r - lower * (index.zero? ? 0.to_r : modified_right.fetch(index - 1))
          ) / denominator
        end

        solutions = Array.new(interior_count, 0.to_r)
        solutions[-1] = modified_right.last
        (interior_count - 2).downto(0) do |index|
          solutions[index] = modified_right.fetch(index) - modified_upper.fetch(index) * solutions.fetch(index + 1)
        end
        (1...object_count).to_h { |held_count| [held_count, solutions.fetch(held_count - 1)] }
      end
    end
  end
end
