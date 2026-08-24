require_relative "formal_derivations"

module GripAnalysis
  class IndependentRetentionNull
    attr_reader :object_count, :retention_probability

    def initialize(object_count:, retention_probability:)
      unless object_count.is_a?(Integer) && object_count.positive?
        raise ArgumentError, "object_count must be a positive integer"
      end

      probability = Rational(retention_probability)
      unless (0.to_r..1.to_r).cover?(probability)
        raise ArgumentError, "retention_probability must lie in [0, 1]"
      end

      @object_count = object_count
      @retention_probability = probability
      @temporal_law = BernoulliTemporalLaw.new([probability] * object_count)
    end

    def p_alpha
      @temporal_law.p_alpha
    end

    def p_kappa
      @temporal_law.p_kappa
    end

    def p_polymorphy
      @temporal_law.p_polymorphy
    end

    def expected_held_count
      @temporal_law.expected_held_count
    end

    def microstate_entropy_bits
      object_count * entropy_bits([retention_probability, 1 - retention_probability])
    end

    def macrostate_entropy_bits
      entropy_bits([p_alpha, p_polymorphy, p_kappa])
    end

    def conditional_information_loss_bits
      microstate_entropy_bits - macrostate_entropy_bits
    end

    private

    def entropy_bits(probabilities)
      -probabilities.sum(0.0) do |probability|
        probability.zero? ? 0.0 : probability.to_f * Math.log2(probability.to_f)
      end
    end
  end
end
