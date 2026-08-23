function scenario_variant(
    scenario::Scenario;
    name=scenario.name,
    beat_seconds=scenario.beat_seconds,
    dwell_ratio=scenario.dwell_ratio,
    position_noise_m=scenario.position_noise_m,
    velocity_noise_m_s=scenario.velocity_noise_m_s,
    catch_radius_m=scenario.catch_radius_m,
)
    return Scenario(
        name, scenario.protocol_kind, scenario.siteswap,
        scenario.object_count, scenario.hand_count,
        scenario.siteswap_period_beats, scenario.observation_period_beats,
        scenario.phase_fraction, scenario.object_mass_kg, scenario.gravity_m_s2,
        beat_seconds, dwell_ratio, position_noise_m, velocity_noise_m_s,
        catch_radius_m, scenario.trials, scenario.seed,
    )
end

function hypothesis_measurements(scenario::Scenario)
    mechanical = mechanics(scenario)
    reliability_estimate = reliability(scenario)
    return (
        result_class=reliability_estimate.result_class,
        mechanics_result_class=mechanical.result_class,
        exact_result_class=reliability_estimate.exact_result_class,
        scenario=scenario.name,
        beat_seconds=scenario.beat_seconds,
        beat_frequency_hz=1 / scenario.beat_seconds,
        dwell_ratio=scenario.dwell_ratio,
        flight_s=mechanical.flight_s,
        dwell_s=mechanical.dwell_s,
        rho_alpha=mechanical.rho_alpha,
        alpha_entry_rate_hz=iszero(mechanical.rho_alpha) ? 0.0 : 1 / scenario.beat_seconds,
        alpha_bout_s=mechanical.rho_alpha * scenario.beat_seconds,
        active_fraction=mechanical.active_fraction,
        throw_height_m=mechanical.throw_height_m,
        launch_energy_j=mechanical.launch_energy_j,
        launch_energy_throughput_w=mechanical.launch_energy_throughput_w,
        peak_lower_bound_n=mechanical.peak_lower_bound_n,
        rms_lower_bound_n=mechanical.rms_lower_bound_n,
        position_noise_m=scenario.position_noise_m,
        velocity_noise_m_s=scenario.velocity_noise_m_s,
        landing_error_sigma_m=reliability_estimate.landing_error_sigma_m,
        catch_radius_m=scenario.catch_radius_m,
        standardized_catch_radius=reliability_estimate.standardized_catch_radius,
        trials=scenario.trials,
        seed=scenario.seed,
        clean_probability=reliability_estimate.clean_probability,
        correction_probability=reliability_estimate.correction_probability,
        drop_probability=reliability_estimate.drop_probability,
        exact_clean_probability=reliability_estimate.exact_clean_probability,
        exact_correction_probability=reliability_estimate.exact_correction_probability,
        exact_drop_probability=reliability_estimate.exact_drop_probability,
        clean_residual=reliability_estimate.clean_residual,
        correction_residual=reliability_estimate.correction_residual,
        drop_residual=reliability_estimate.drop_residual,
        exact_clean_within_wilson=reliability_estimate.exact_clean_within_wilson,
        exact_correction_within_wilson=reliability_estimate.exact_correction_within_wilson,
        exact_drop_within_wilson=reliability_estimate.exact_drop_within_wilson,
        calibration_status=reliability_estimate.calibration_status,
        hypothesis_scope="model discrimination under declared assumptions; not empirical validation",
    )
end

function matched_flight_sweep(
    base_scenario::Scenario;
    dwell_ratios=[0.25, 0.5, 0.9],
    flight_s=0.8,
)
    flight_s > 0 || throw(ArgumentError("matched flight time must be positive"))
    return [begin
        beat_seconds = flight_s / (3 - 2 * dwell_ratio)
        scenario = scenario_variant(
            base_scenario;
            name="matched_flight_r$(dwell_ratio)", beat_seconds, dwell_ratio,
        )
        merge((
            battery="matched_flight",
            hypothesis="dwell changes alpha exposure and mechanics at fixed modeled flight risk",
            target_flight_s=flight_s,
        ), hypothesis_measurements(scenario))
    end for dwell_ratio in dwell_ratios]
end

function tempo_dwell_sweep(
    base_scenario::Scenario;
    beat_seconds=[0.25, 0.4, 0.6],
    dwell_ratios=[0.25, 0.45, 0.6],
)
    return [begin
        scenario = scenario_variant(
            base_scenario;
            name="tempo_$(beat)_dwell_$(dwell_ratio)",
            beat_seconds=beat, dwell_ratio,
        )
        merge((
            battery="tempo_dwell",
            hypothesis="tempo and dwell have separable timing, mechanics, and modeled reliability effects",
        ), hypothesis_measurements(scenario))
    end for dwell_ratio in dwell_ratios for beat in beat_seconds]
end

function noise_ablation_sweep(
    base_scenario::Scenario;
    dwell_ratios=[0.25, 0.5, 0.9],
)
    noise_cases = [
        (name="combined", position=base_scenario.position_noise_m,
         velocity=base_scenario.velocity_noise_m_s),
        (name="position_only", position=base_scenario.position_noise_m, velocity=0.0),
        (name="velocity_only", position=0.0, velocity=base_scenario.velocity_noise_m_s),
    ]
    return [begin
        scenario = scenario_variant(
            base_scenario;
            name="noise_$(noise_case.name)_r$(dwell_ratio)", dwell_ratio,
            position_noise_m=noise_case.position,
            velocity_noise_m_s=noise_case.velocity,
        )
        merge((
            battery="noise_ablation",
            hypothesis="the modeled dwell gradient is identified by flight-time-scaled velocity noise",
            noise_case=noise_case.name,
        ), hypothesis_measurements(scenario))
    end for noise_case in noise_cases for dwell_ratio in dwell_ratios]
end

function dimensionless_collapse_sweep(base_scenario::Scenario)
    base_mechanics = mechanics(base_scenario)
    base_sigma = hypot(
        base_scenario.position_noise_m,
        base_mechanics.flight_s * base_scenario.velocity_noise_m_s,
    )
    base_sigma > 0 || throw(ArgumentError("collapse battery requires nonzero landing noise"))
    cases = [
        (name="baseline", position=base_scenario.position_noise_m,
         velocity=base_scenario.velocity_noise_m_s, radius=base_scenario.catch_radius_m),
        (name="scaled_spatial", position=2 * base_scenario.position_noise_m,
         velocity=2 * base_scenario.velocity_noise_m_s,
         radius=2 * base_scenario.catch_radius_m),
        (name="position_only_equivalent", position=base_sigma,
         velocity=0.0, radius=base_scenario.catch_radius_m),
        (name="velocity_only_equivalent", position=0.0,
         velocity=base_sigma / base_mechanics.flight_s,
         radius=base_scenario.catch_radius_m),
    ]
    return [begin
        scenario = scenario_variant(
            base_scenario;
            name="collapse_$(collapse_case.name)",
            position_noise_m=collapse_case.position,
            velocity_noise_m_s=collapse_case.velocity,
            catch_radius_m=collapse_case.radius,
        )
        merge((
            battery="dimensionless_collapse",
            hypothesis="Gaussian reliability probabilities collapse by catch radius over landing-error sigma",
            collapse_case=collapse_case.name,
        ), hypothesis_measurements(scenario))
    end for collapse_case in cases]
end
