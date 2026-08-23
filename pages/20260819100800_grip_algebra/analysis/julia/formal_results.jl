const FORMAL_PHASE_OFFSETS = collect(0:20) .// 40
const FORMAL_RETENTION_PROBABILITIES = [1 // 10, 1 // 4, 1 // 2, 3 // 4, 9 // 10]
const FORMAL_INNER_RADIUS_FRACTIONS = [1 // 4, 1 // 2, 3 // 4]

formal_fraction(value::Integer) = string(value)
formal_fraction(value::Rational) = denominator(value) == 1 ?
    string(numerator(value)) : "$(numerator(value))/$(denominator(value))"
formal_exact(value::Integer) = formal_fraction(value)
formal_exact(value::Rational) = formal_fraction(value)
formal_exact(value::AbstractFloat) = ""

function formal_measurement(
    derivation, case_id, metric, value, assumption, result_class,
)
    return (
        derivation, case_id, metric, value=Float64(value),
        exact_value=formal_exact(value), result_class, assumption,
    )
end

function formal_metric_rows(
    derivation, case_id, metrics, assumption, result_class,
)
    return [formal_measurement(
        derivation, case_id, string(metric), value, assumption, result_class,
    ) for (metric, value) in pairs(metrics)]
end

function formal_phase_rows()
    return reduce(vcat, [begin
        law = two_object_phase_law(2 // 5, phase)
        metrics = (
            p_alpha=law.p_alpha,
            p_amphoteron=law.p_amphoteron,
            p_kappa=law.p_kappa,
            alpha_entry_count=law.alpha_bout_count,
            alpha_mean_bout_fraction=law.alpha_mean_bout_fraction,
            alpha_maximum_bout_fraction=law.alpha_maximum_bout_fraction,
            alpha_bout_variance_fraction_squared=
                law.alpha_bout_variance_fraction_squared,
        )
        formal_metric_rows(
            "two_object_phase", "d=2/5;phase=$(formal_fraction(phase))", metrics,
            "two contiguous circular retention intervals; shortest phase in [0, 1/2]",
            "model consequence",
        )
    end for phase in FORMAL_PHASE_OFFSETS])
end

function formal_bernoulli_rows()
    iid_cases = [("n=$(count);rho=$(formal_fraction(probability))",
                  fill(probability, count))
                 for count in [3, 5, 10]
                 for probability in FORMAL_RETENTION_PROBABILITIES]
    cases = vcat(iid_cases, [(
        "rho=1/4|1/2|3/4", [1 // 4, 1 // 2, 3 // 4],
    )])
    return reduce(vcat, [begin
        law = bernoulli_temporal_law(probabilities)
        formal_metric_rows(
            "bernoulli_temporal", case_id,
            (
                p_alpha=law.p_alpha, p_amphoteron=law.p_amphoteron,
                p_kappa=law.p_kappa, expected_held_count=law.expected_held_count,
            ),
            "mutually independent Bernoulli retention indicators at one stationary sample",
            "model consequence",
        )
    end for (case_id, probabilities) in cases])
end

function formal_first_passage_rows()
    return [begin
        expectations = one_bit_first_passage_steps(object_count)
        formal_measurement(
            "one_bit_first_passage", "n=$(object_count);q=$(held_count)",
            "expected_steps", expectations[held_count + 1],
            "one uniformly selected bit flips per event; boundaries are absorbing for the clock",
            "theorem",
        )
    end for object_count in 2:12 for held_count in 1:(object_count - 1)]
end

function formal_gaussian_rows()
    return reduce(vcat, [begin
        maximum = gaussian_correction_maximum(inner)
        formal_metric_rows(
            "gaussian_correction", "inner=$(formal_fraction(inner))",
            (
                sigma_over_radius_at_maximum=maximum.sigma_over_radius,
                maximum_correction_probability=maximum.maximum_probability,
                derivative_at_maximum=maximum.derivative_at_maximum,
            ),
            "one-dimensional centered Gaussian error; correction band cR < |X| <= R",
            "model consequence",
        )
    end for inner in FORMAL_INNER_RADIUS_FRACTIONS])
end

function formal_derivation_rows()
    return vcat(
        formal_phase_rows(), formal_bernoulli_rows(),
        formal_first_passage_rows(), formal_gaussian_rows(),
    )
end
