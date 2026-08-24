module GripAnalysis
  class TwoObjectPhaseLaw
    attr_reader :retention_duty, :phase_offset

    def initialize(retention_duty:, phase_offset:)
      @retention_duty = Rational(retention_duty)
      @phase_offset = Rational(phase_offset)
      unless retention_duty.positive? && retention_duty < 1
        raise ArgumentError, "retention duty must lie in (0, 1)"
      end
      unless (0.to_r..Rational(1, 2)).cover?(phase_offset)
        raise ArgumentError, "phase offset must lie in [0, 1/2]"
      end
    end

    def p_kappa
      positive_part(retention_duty - phase_offset) +
        positive_part(retention_duty + phase_offset - 1)
    end

    def p_alpha
      positive_part(1 - retention_duty - phase_offset) +
        positive_part(phase_offset - retention_duty)
    end

    def p_polymorphy
      1 - p_alpha - p_kappa
    end

    def macrostate_shares
      [p_alpha, p_polymorphy, p_kappa]
    end

    def alpha_bout_fractions
      [
        phase_offset - retention_duty,
        1 - retention_duty - phase_offset
      ].select(&:positive?)
    end

    def alpha_bout_count
      alpha_bout_fractions.length
    end

    def alpha_mean_bout_fraction
      mean(alpha_bout_fractions)
    end

    def alpha_maximum_bout_fraction
      alpha_bout_fractions.max || 0.to_r
    end

    def alpha_bout_variance_fraction_squared
      values = alpha_bout_fractions
      return 0.to_r if values.empty?

      average = mean(values)
      values.sum(0.to_r) { |value| (value - average)**2 } / values.length
    end

    private

    def positive_part(value)
      [value, 0.to_r].max
    end

    def mean(values)
      return 0.to_r if values.empty?

      values.sum(0.to_r) / values.length
    end
  end

  class BernoulliTemporalLaw
    attr_reader :retention_probabilities

    def initialize(retention_probabilities)
      probabilities = retention_probabilities.map { |probability| Rational(probability) }
      raise ArgumentError, "at least one object is required" if probabilities.empty?
      unless probabilities.all? { |probability| (0.to_r..1.to_r).cover?(probability) }
        raise ArgumentError, "retention probabilities must lie in [0, 1]"
      end

      @retention_probabilities = probabilities.freeze
    end

    def p_alpha
      retention_probabilities.reduce(1.to_r) { |product, probability| product * (1 - probability) }
    end

    def p_kappa
      retention_probabilities.reduce(1.to_r, :*)
    end

    def p_polymorphy
      1 - p_alpha - p_kappa
    end

    def expected_held_count
      retention_probabilities.sum(0.to_r)
    end
  end

  class GaussianCorrectionBand
    attr_reader :inner_radius_fraction

    def initialize(inner_radius_fraction:)
      @inner_radius_fraction = Float(inner_radius_fraction)
      unless inner_radius_fraction.positive? && inner_radius_fraction < 1
        raise ArgumentError, "inner radius fraction must lie in (0, 1)"
      end
    end

    def probability(sigma_over_radius)
      scale = Float(sigma_over_radius)
      raise ArgumentError, "sigma over radius must be positive" unless scale.positive?

      2 * (normal_cdf(1 / scale) - normal_cdf(inner_radius_fraction / scale))
    end

    def derivative(sigma_over_radius)
      scale = Float(sigma_over_radius)
      raise ArgumentError, "sigma over radius must be positive" unless scale.positive?

      2 * (
        inner_radius_fraction * normal_density(inner_radius_fraction / scale) -
        normal_density(1 / scale)
      ) / scale**2
    end

    def sigma_over_radius_at_maximum
      Math.sqrt(
        (1 - inner_radius_fraction**2) /
        (2 * Math.log(1 / inner_radius_fraction))
      )
    end

    def maximum_probability
      probability(sigma_over_radius_at_maximum)
    end

    private

    def normal_cdf(value)
      (1 + Math.erf(value / Math.sqrt(2))) / 2
    end

    def normal_density(value)
      Math.exp(-(value**2) / 2) / Math.sqrt(2 * Math::PI)
    end
  end
end
