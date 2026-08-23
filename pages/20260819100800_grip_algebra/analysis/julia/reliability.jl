function sampling_standard_error(probability, trials)
    return sqrt(probability * (1 - probability) / trials)
end

function wilson_interval(probability, trials; z=1.959963984540054)
    denominator = 1 + z^2 / trials
    center = (probability + z^2 / (2 * trials)) / denominator
    half_width = z / denominator * sqrt(
        probability * (1 - probability) / trials + z^2 / (4 * trials^2),
    )
    return max(0, center - half_width), min(1, center + half_width)
end

function complementary_error_function(value)
    return ccall((:erfc, Base.Math.libm), Cdouble, (Cdouble,), value)
end

function gaussian_reliability_probabilities(
    position_noise_m, velocity_noise_m_s, flight_s, catch_radius_m,
)
    position_noise_m >= 0 || throw(ArgumentError("position noise must be nonnegative"))
    velocity_noise_m_s >= 0 || throw(ArgumentError("velocity noise must be nonnegative"))
    flight_s >= 0 || throw(ArgumentError("flight time must be nonnegative"))
    catch_radius_m > 0 || throw(ArgumentError("catch radius must be positive"))
    landing_error_sigma_m = hypot(position_noise_m, flight_s * velocity_noise_m_s)
    if iszero(landing_error_sigma_m)
        return (
            landing_error_sigma_m,
            standardized_catch_radius=Inf,
            clean_probability=1.0,
            correction_probability=0.0,
            drop_probability=0.0,
        )
    end
    scaled_radius = catch_radius_m / (sqrt(2) * landing_error_sigma_m)
    outside_correction_threshold = complementary_error_function(scaled_radius / 2)
    drop_probability = complementary_error_function(scaled_radius)
    return (
        landing_error_sigma_m,
        standardized_catch_radius=catch_radius_m / landing_error_sigma_m,
        clean_probability=1 - outside_correction_threshold,
        correction_probability=outside_correction_threshold - drop_probability,
        drop_probability,
    )
end

function gaussian_correction_band_maximum()
    maximum = gaussian_correction_maximum(1 / 2)
    return (
        result_class="model consequence",
        sigma_over_radius=maximum.sigma_over_radius,
        correction_probability=maximum.maximum_probability,
        correction_band="radius/2 < absolute error <= radius",
    )
end

function interval_contains(low, value, high)
    return low <= value <= high
end

function reliability(scenario::Scenario)
    flight_s = mechanics(scenario).flight_s
    correction_threshold_m = scenario.catch_radius_m / 2
    rng = MersenneTwister(scenario.seed)
    clean_count = 0
    correction_count = 0
    drop_count = 0
    for _ in 1:scenario.trials
        position_error = scenario.position_noise_m * randn(rng)
        velocity_error = scenario.velocity_noise_m_s * randn(rng)
        landing_error = abs(position_error + flight_s * velocity_error)
        if landing_error > scenario.catch_radius_m
            drop_count += 1
        elseif landing_error > correction_threshold_m
            correction_count += 1
        else
            clean_count += 1
        end
    end
    clean_probability = clean_count / scenario.trials
    correction_probability = correction_count / scenario.trials
    drop_probability = drop_count / scenario.trials
    clean_wilson_low, clean_wilson_high = wilson_interval(clean_probability, scenario.trials)
    correction_wilson_low, correction_wilson_high = wilson_interval(correction_probability, scenario.trials)
    drop_wilson_low, drop_wilson_high = wilson_interval(drop_probability, scenario.trials)
    exact = gaussian_reliability_probabilities(
        scenario.position_noise_m, scenario.velocity_noise_m_s,
        flight_s, scenario.catch_radius_m,
    )
    return (
        result_class="simulation estimate",
        scenario=scenario.name, trials=scenario.trials, seed=scenario.seed,
        julia_version=string(VERSION), rng_algorithm="Random.MersenneTwister",
        flight_s, position_noise_m=scenario.position_noise_m,
        velocity_noise_m_s=scenario.velocity_noise_m_s,
        landing_error_sigma_m=exact.landing_error_sigma_m,
        catch_radius_m=scenario.catch_radius_m, correction_threshold_m,
        clean_probability, clean_standard_error=sampling_standard_error(clean_probability, scenario.trials),
        clean_wilson_low, clean_wilson_high,
        correction_probability,
        correction_standard_error=sampling_standard_error(correction_probability, scenario.trials),
        correction_wilson_low, correction_wilson_high,
        drop_probability, drop_standard_error=sampling_standard_error(drop_probability, scenario.trials),
        drop_wilson_low, drop_wilson_high,
        error_assumption="one-dimensional landing error = independent Gaussian position + flight-time-scaled velocity error",
        correction_assumption="illustrative correction band is radius/2 < absolute error <= radius",
        draw_coupling="common random draws when seed and trial count match across scenarios",
        calibration_status="uncalibrated illustrative model",
        source_scope="standalone numerical model; browser animation is not an analysis input",
        exact_result_class="model consequence",
        standardized_catch_radius=exact.standardized_catch_radius,
        exact_clean_probability=exact.clean_probability,
        exact_correction_probability=exact.correction_probability,
        exact_drop_probability=exact.drop_probability,
        clean_residual=clean_probability - exact.clean_probability,
        correction_residual=correction_probability - exact.correction_probability,
        drop_residual=drop_probability - exact.drop_probability,
        exact_clean_within_wilson=interval_contains(
            clean_wilson_low, exact.clean_probability, clean_wilson_high,
        ),
        exact_correction_within_wilson=interval_contains(
            correction_wilson_low, exact.correction_probability, correction_wilson_high,
        ),
        exact_drop_within_wilson=interval_contains(
            drop_wilson_low, exact.drop_probability, drop_wilson_high,
        ),
    )
end


function reliability_benchmarks(reliability_results)
    correction_maximum = gaussian_correction_band_maximum()
    return [(
        result_class=result.exact_result_class,
        scenario=result.scenario,
        monte_carlo_result_class=result.result_class,
        trials=result.trials,
        seed=result.seed,
        flight_s=result.flight_s,
        landing_error_sigma_m=result.landing_error_sigma_m,
        standardized_catch_radius=result.standardized_catch_radius,
        catch_radius_m=result.catch_radius_m,
        exact_clean_probability=result.exact_clean_probability,
        monte_carlo_clean_probability=result.clean_probability,
        clean_residual=result.clean_residual,
        clean_wilson_low=result.clean_wilson_low,
        clean_wilson_high=result.clean_wilson_high,
        exact_clean_within_wilson=result.exact_clean_within_wilson,
        exact_correction_probability=result.exact_correction_probability,
        monte_carlo_correction_probability=result.correction_probability,
        correction_residual=result.correction_residual,
        correction_wilson_low=result.correction_wilson_low,
        correction_wilson_high=result.correction_wilson_high,
        exact_correction_within_wilson=result.exact_correction_within_wilson,
        exact_drop_probability=result.exact_drop_probability,
        monte_carlo_drop_probability=result.drop_probability,
        drop_residual=result.drop_residual,
        drop_wilson_low=result.drop_wilson_low,
        drop_wilson_high=result.drop_wilson_high,
        exact_drop_within_wilson=result.exact_drop_within_wilson,
        correction_maximum_sigma_over_radius=correction_maximum.sigma_over_radius,
        correction_maximum_probability=correction_maximum.correction_probability,
        exact_assumption=result.error_assumption,
        calibration_status=result.calibration_status,
    ) for result in reliability_results]
end
