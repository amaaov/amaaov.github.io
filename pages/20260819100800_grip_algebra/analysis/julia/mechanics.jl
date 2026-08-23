function mechanics(scenario::Scenario)
    validate_scenario(scenario)
    scenario.protocol_kind == "steady_periodic" || error("mechanics model requires a steady periodic protocol")
    scenario.siteswap == "3" || error("mechanics model requires siteswap 3")
    scenario.object_count == 3 || error("mechanics model requires three objects")
    scenario.hand_count == 2 || error("mechanics model requires two hands")
    scenario.siteswap_period_beats == 1 || error("siteswap 3 requires a one-beat notation period")
    scenario.observation_period_beats == 3 || error("mechanics model requires a three-beat observation period")
    scenario.phase_fraction == 0.5 || error("rho_alpha formula requires half-cycle hand phasing")
    hand_cycle_s = 2 * scenario.beat_seconds
    flight_s = (scenario.object_count / scenario.hand_count - scenario.dwell_ratio) * hand_cycle_s
    dwell_s = scenario.dwell_ratio * hand_cycle_s
    rho_alpha = max(1 - 2 * scenario.dwell_ratio, 0)
    active_fraction = 1 - rho_alpha
    active_fraction > 0 || error("finite-force periodic cycle requires positive contact time")
    gravity = scenario.gravity_m_s2
    throw_height_m = gravity * flight_s^2 / 8
    launch_energy_j = scenario.object_mass_kg * gravity * throw_height_m
    total_weight_n = scenario.object_count * scenario.object_mass_kg * gravity
    peak_lower_bound_n = total_weight_n / active_fraction
    rms_lower_bound_n = total_weight_n / sqrt(active_fraction)
    half_sine_peak_n = pi * total_weight_n / (2 * active_fraction)
    half_sine_rms_n = half_sine_peak_n * sqrt(active_fraction / 2)
    return (
        result_class="model consequence", scenario=scenario.name,
        protocol_kind=scenario.protocol_kind, siteswap=scenario.siteswap,
        siteswap_period_beats=scenario.siteswap_period_beats,
        observation_period_beats=scenario.observation_period_beats,
        phase_fraction=scenario.phase_fraction,
        object_count=scenario.object_count,
        hand_count=scenario.hand_count, object_mass_kg=scenario.object_mass_kg,
        gravity_m_s2=gravity, beat_seconds=scenario.beat_seconds,
        dwell_ratio=scenario.dwell_ratio,
        hand_cycle_s, flight_s, dwell_s, rho_alpha, active_fraction,
        throw_height_m, launch_energy_j,
        launch_energy_throughput_w=launch_energy_j / scenario.beat_seconds,
        total_weight_n, peak_lower_bound_n, rms_lower_bound_n,
        half_sine_peak_n, half_sine_rms_n,
        kinematic_assumption="uniform three-ball two-hand cascade; half-cycle hand phase; equal release/catch height; negligible drag",
        force_assumption="complete periods; repeated vertical momentum; gravity only non-body vertical force; force zero in alpha",
        half_sine_assumption="nonnegative half-sine body force over the active contact fraction",
        energy_scope="outgoing vertical kinetic-energy throughput; not body work or metabolic cost",
        source_scope="standalone numerical model; browser animation is not an analysis input",
    )
end
