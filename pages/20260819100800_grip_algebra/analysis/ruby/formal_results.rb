require_relative "formal_derivations"
require_relative "one_bit_flip_null"

module GripAnalysis
  module FormalResults
    module_function

    PHASE_OFFSETS = (0..20).map { |index| Rational(index, 40) }.freeze
    RETENTION_PROBABILITIES = [
      Rational(1, 10), Rational(1, 4), Rational(1, 2),
      Rational(3, 4), Rational(9, 10)
    ].freeze
    INNER_RADIUS_FRACTIONS = [Rational(1, 4), Rational(1, 2), Rational(3, 4)].freeze

    def rows
      phase_rows + bernoulli_rows + first_passage_rows + gaussian_rows
    end

    def phase_rows
      PHASE_OFFSETS.flat_map do |phase_offset|
        law = TwoObjectPhaseLaw.new(
          retention_duty: Rational(2, 5), phase_offset: phase_offset
        )
        metrics = {
          p_alpha: law.p_alpha,
          p_polymorphy: law.p_polymorphy,
          p_kappa: law.p_kappa,
          alpha_entry_count: law.alpha_bout_count,
          alpha_mean_bout_fraction: law.alpha_mean_bout_fraction,
          alpha_maximum_bout_fraction: law.alpha_maximum_bout_fraction,
          alpha_bout_variance_fraction_squared: law.alpha_bout_variance_fraction_squared
        }
        metric_rows(
          "two_object_phase", "d=2/5;phase=#{fraction(phase_offset)}", metrics,
          "two contiguous circular retention intervals; shortest phase in [0, 1/2]",
          "model consequence"
        )
      end
    end

    def bernoulli_rows
      iid_cases = [3, 5, 10].product(RETENTION_PROBABILITIES).map do |count, probability|
        ["n=#{count};rho=#{fraction(probability)}", [probability] * count]
      end
      cases = iid_cases + [["rho=1/4|1/2|3/4", [Rational(1, 4), Rational(1, 2), Rational(3, 4)]]]
      cases.flat_map do |case_id, probabilities|
        law = BernoulliTemporalLaw.new(probabilities)
        metric_rows(
          "bernoulli_temporal", case_id,
          {
            p_alpha: law.p_alpha, p_polymorphy: law.p_polymorphy,
            p_kappa: law.p_kappa, expected_held_count: law.expected_held_count
          },
          "mutually independent Bernoulli retention indicators at one stationary sample",
          "model consequence"
        )
      end
    end

    def first_passage_rows
      (2..12).flat_map do |object_count|
        process = OneBitFlipNull.new(object_count)
        (1...object_count).map do |held_count|
          measurement(
            "one_bit_first_passage", "n=#{object_count};q=#{held_count}",
            "expected_steps", process.first_passage_steps(held_count),
            "one uniformly selected bit flips per event; boundaries are absorbing for the clock",
            "theorem"
          )
        end
      end
    end

    def gaussian_rows
      INNER_RADIUS_FRACTIONS.flat_map do |inner_fraction|
        law = GaussianCorrectionBand.new(inner_radius_fraction: inner_fraction)
        scale = law.sigma_over_radius_at_maximum
        metric_rows(
          "gaussian_correction", "inner=#{fraction(inner_fraction)}",
          {
            sigma_over_radius_at_maximum: scale,
            maximum_correction_probability: law.maximum_probability,
            derivative_at_maximum: law.derivative(scale)
          },
          "one-dimensional centered Gaussian error; correction band cR < |X| <= R",
          "model consequence"
        )
      end
    end

    def metric_rows(derivation, case_id, metrics, assumption, result_class)
      metrics.map do |metric, value|
        measurement(derivation, case_id, metric.to_s, value, assumption, result_class)
      end
    end

    def measurement(derivation, case_id, metric, value, assumption, result_class)
      {
        derivation: derivation, case_id: case_id, metric: metric,
        value: value.to_f, exact_value: exact(value), result_class: result_class,
        assumption: assumption
      }
    end

    def exact(value)
      return fraction(value) if value.is_a?(Rational)
      return value.to_s if value.is_a?(Integer)

      ""
    end

    def fraction(value)
      rational = Rational(value)
      rational.denominator == 1 ? rational.numerator.to_s :
        "#{rational.numerator}/#{rational.denominator}"
    end
  end
end
