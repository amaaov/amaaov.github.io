formal_rational(value::Rational) = Rational{Int}(value)
formal_rational(value::Integer) = value // 1
formal_rational(value::AbstractFloat) = rationalize(Int, value)
positive_part(value) = max(value, zero(value))

function two_object_phase_law(retention_duty, phase_offset)
    duty = formal_rational(retention_duty)
    phase = formal_rational(phase_offset)
    0 < duty < 1 || throw(ArgumentError(
        "retention duty must lie in (0, 1)",
    ))
    0 <= phase <= 1 // 2 || throw(ArgumentError(
        "phase offset must lie in [0, 1/2]",
    ))
    p_kappa = positive_part(duty - phase) + positive_part(duty + phase - 1)
    p_alpha = positive_part(1 - duty - phase) + positive_part(phase - duty)
    p_amphoteron = 1 - p_alpha - p_kappa
    alpha_bout_fractions = filter(>(0), [
        phase - duty, 1 - duty - phase,
    ])
    alpha_mean = isempty(alpha_bout_fractions) ? 0 // 1 :
        sum(alpha_bout_fractions) / length(alpha_bout_fractions)
    alpha_variance = isempty(alpha_bout_fractions) ? 0 // 1 :
        sum((value - alpha_mean)^2 for value in alpha_bout_fractions) /
        length(alpha_bout_fractions)
    return (
        p_alpha, p_amphoteron, p_kappa,
        macrostate_shares=[p_alpha, p_amphoteron, p_kappa],
        alpha_bout_fractions,
        alpha_bout_count=length(alpha_bout_fractions),
        alpha_mean_bout_fraction=alpha_mean,
        alpha_maximum_bout_fraction=isempty(alpha_bout_fractions) ? 0 // 1 :
            maximum(alpha_bout_fractions),
        alpha_bout_variance_fraction_squared=alpha_variance,
    )
end

function bernoulli_temporal_law(retention_probabilities)
    probabilities = formal_rational.(retention_probabilities)
    isempty(probabilities) && throw(ArgumentError("at least one object is required"))
    all(0 <= probability <= 1 for probability in probabilities) || throw(
        ArgumentError("retention probabilities must lie in [0, 1]"),
    )
    p_alpha = prod(1 - probability for probability in probabilities)
    p_kappa = prod(probabilities)
    return (
        p_alpha, p_amphoteron=1 - p_alpha - p_kappa, p_kappa,
        expected_held_count=sum(probabilities),
    )
end

function one_bit_first_passage_steps(object_count::Integer)
    object_count >= 2 || throw(ArgumentError("object count must be at least two"))
    coefficients = Rational{Int}[1]
    constants = Rational{Int}[0]
    for held_count in 1:(object_count - 1)
        denominator = object_count - held_count
        push!(coefficients, held_count * coefficients[end] / denominator)
        push!(constants, (held_count * constants[end] - object_count) / denominator)
    end
    first_difference = -sum(constants) / sum(coefficients)
    differences = coefficients .* first_difference .+ constants
    expectations = Rational{Int}[0]
    for difference in differences
        push!(expectations, expectations[end] + difference)
    end
    return expectations
end

function one_bit_recurrence_residual(expectations, held_count::Integer)
    object_count = length(expectations) - 1
    1 <= held_count < object_count || throw(ArgumentError(
        "held count must be interior",
    ))
    return expectations[held_count + 1] - 1 -
        (held_count // object_count) * expectations[held_count] -
        ((object_count - held_count) // object_count) * expectations[held_count + 2]
end

function one_bit_closed_form_first_passage(object_count::Integer, held_count::Integer)
    object_count >= 2 || throw(ArgumentError("object count must be at least two"))
    0 <= held_count <= object_count || throw(ArgumentError(
        "held count must lie in 0..n",
    ))
    iszero(held_count) && return 0 // 1
    return sum((
        2^(object_count - 1) - sum(binomial(object_count, weight) for weight in 0:index)
    ) // binomial(object_count - 1, index) for index in 0:(held_count - 1); init=0 // 1)
end

normal_density(value) = exp(-(value^2) / 2) / sqrt(2pi)
normal_cdf(value) = 0.5 * ccall(
    (:erfc, Base.Math.libm), Cdouble, (Cdouble,), -value / sqrt(2),
)

function gaussian_correction_probability(sigma_over_radius, inner_radius_fraction)
    scale = Float64(sigma_over_radius)
    inner = Float64(inner_radius_fraction)
    scale > 0 || throw(ArgumentError("sigma over radius must be positive"))
    0 < inner < 1 || throw(ArgumentError("inner radius fraction must lie in (0, 1)"))
    return 2 * (normal_cdf(1 / scale) - normal_cdf(inner / scale))
end

function gaussian_correction_derivative(sigma_over_radius, inner_radius_fraction)
    scale = Float64(sigma_over_radius)
    inner = Float64(inner_radius_fraction)
    scale > 0 || throw(ArgumentError("sigma over radius must be positive"))
    0 < inner < 1 || throw(ArgumentError("inner radius fraction must lie in (0, 1)"))
    return 2 * (inner * normal_density(inner / scale) - normal_density(1 / scale)) /
        scale^2
end

function gaussian_correction_maximum(inner_radius_fraction)
    inner = Float64(inner_radius_fraction)
    0 < inner < 1 || throw(ArgumentError("inner radius fraction must lie in (0, 1)"))
    scale = sqrt((1 - inner^2) / (2log(1 / inner)))
    return (
        inner_radius_fraction=inner, sigma_over_radius=scale,
        maximum_probability=gaussian_correction_probability(scale, inner),
        derivative_at_maximum=gaussian_correction_derivative(scale, inner),
    )
end
