const VIABILITY_BASE_PARAMETERS = (
    theta_step=0.05, omega_step=0.15, dt=0.05, horizon_s=2.0,
    constraint_samples_per_step=4, control_latency_s=0.0,
)

function viability_diagnostic_parameters(;
    theta_step=VIABILITY_BASE_PARAMETERS.theta_step,
    omega_step=VIABILITY_BASE_PARAMETERS.omega_step,
    dt=VIABILITY_BASE_PARAMETERS.dt,
    horizon_s=VIABILITY_BASE_PARAMETERS.horizon_s,
    constraint_samples_per_step=VIABILITY_BASE_PARAMETERS.constraint_samples_per_step,
    control_latency_s=VIABILITY_BASE_PARAMETERS.control_latency_s,
)
    return (;
        theta_step, omega_step, dt, horizon_s,
        constraint_samples_per_step, control_latency_s,
    )
end

function viability_diagnostic_row(
    summary, reference;
    diagnostic_family, diagnostic_warning, diagnostic_finding,
)
    return (
        result_class="simulation estimate", reporting_role="numerical diagnostic",
        diagnostic_family,
        variant=summary.resolution, regime=summary.regime,
        reference_variant=reference.resolution,
        grid_points=summary.grid_points,
        viability_count=summary.viability_count,
        viability_fraction=summary.viability_fraction,
        viability_fraction_change=
            summary.viability_fraction - reference.viability_fraction,
        capture_count=summary.capture_count,
        capture_fraction=summary.capture_fraction,
        capture_fraction_change=summary.capture_fraction - reference.capture_fraction,
        target_count=summary.target_count,
        target_fraction=summary.target_fraction,
        recovery_from_outside_count=summary.recovery_from_outside_count,
        recovery_from_outside_fraction=summary.recovery_from_outside_fraction,
        recovery_from_outside_fraction_change=
            summary.recovery_from_outside_fraction -
            reference.recovery_from_outside_fraction,
        theta_step_rad=summary.theta_step_rad,
        omega_step_rad_s=summary.omega_step_rad_s,
        time_step_s=summary.time_step_s,
        horizon_s=summary.horizon_s,
        horizon_steps=summary.horizon_steps,
        control_latency_s=summary.control_latency_s,
        constraint_samples_per_step=summary.constraint_samples_per_step,
        diagnostic_status="sensitivity diagnostic; not convergence evidence",
        diagnostic_warning, diagnostic_finding,
        approximation=summary.approximation,
    )
end

function viability_diagnostic_family(
    diagnostic_family, specifications, reference_variant;
    diagnostic_warning, diagnostic_finding="",
)
    summaries = [
        viability_summary(
            specification.regime, specification.variant, specification.parameters,
        ) for specification in specifications
    ]
    rows = NamedTuple[]
    for summary in summaries
        reference_index = findfirst(
            candidate -> candidate.regime == summary.regime &&
                candidate.resolution == reference_variant,
            summaries,
        )
        reference_index === nothing && error(
            "missing $reference_variant reference for $(summary.regime) $diagnostic_family diagnostic",
        )
        push!(rows, viability_diagnostic_row(
            summary, summaries[reference_index];
            diagnostic_family, diagnostic_warning, diagnostic_finding,
        ))
    end
    return rows
end

function discretization_diagnostics()
    specifications = [
        (regime="freewheel", variant="base", parameters=viability_diagnostic_parameters()),
        (
            regime="freewheel", variant="state_grid_refined",
            parameters=viability_diagnostic_parameters(theta_step=0.025, omega_step=0.075),
        ),
        (
            regime="freewheel", variant="time_step_refined",
            parameters=viability_diagnostic_parameters(dt=0.025),
        ),
        (
            regime="freewheel", variant="coupled_refined",
            parameters=viability_diagnostic_parameters(
                theta_step=0.025, omega_step=0.075, dt=0.025,
            ),
        ),
    ]
    initial_rows = viability_diagnostic_family(
        "discretization", specifications, "base";
        diagnostic_warning=
            "independent-axis sweep; coupled agreement can conceal opposing discretization effects",
    )
    by_variant = Dict(row.variant => row for row in initial_rows)
    state_change = by_variant["state_grid_refined"].recovery_from_outside_fraction_change
    time_change = by_variant["time_step_refined"].recovery_from_outside_fraction_change
    coupled_change = by_variant["coupled_refined"].recovery_from_outside_fraction_change
    cancellation_detected = sign(state_change) != sign(time_change) &&
        abs(coupled_change) < min(abs(state_change), abs(time_change))
    diagnostic_finding = cancellation_detected ?
        "coupled refinement masks opposing independent discretization effects" :
        "no coupled-refinement cancellation detected in this sweep"
    return [merge(row, (; diagnostic_finding)) for row in initial_rows]
end

function horizon_diagnostics()
    horizon_settings = [
        ("horizon_0_5_s", 0.5), ("horizon_1_s", 1.0),
        ("horizon_2_s", 2.0), ("horizon_4_s", 4.0),
    ]
    specifications = [
        (
            regime, variant,
            parameters=viability_diagnostic_parameters(horizon_s=horizon_seconds),
        ) for regime in ("direct", "freewheel", "impossible")
          for (variant, horizon_seconds) in horizon_settings
    ]
    return viability_diagnostic_family(
        "horizon", specifications, "horizon_2_s";
        diagnostic_warning=
            "finite-horizon sensitivity only; not an infinite-horizon viability kernel",
    )
end

function control_latency_diagnostics()
    latency_settings = [
        ("latency_0_s", 0.0), ("latency_0_0125_s", 0.0125),
        ("latency_0_025_s", 0.025), ("latency_0_05_s", 0.05),
    ]
    specifications = [
        (
            regime, variant,
            parameters=viability_diagnostic_parameters(control_latency_s=latency_seconds),
        ) for regime in ("direct", "freewheel", "impossible")
          for (variant, latency_seconds) in latency_settings
    ]
    return viability_diagnostic_family(
        "control_latency", specifications, "latency_0_s";
        diagnostic_warning=
            "within-step zero-control delay; not a state-augmented actuator-delay model",
    )
end

function constraint_sampling_diagnostics()
    sample_settings = [("samples_1", 1), ("samples_4", 4), ("samples_8", 8)]
    specifications = [
        (
            regime="freewheel", variant,
            parameters=viability_diagnostic_parameters(
                constraint_samples_per_step=samples,
            ),
        ) for (variant, samples) in sample_settings
    ]
    return viability_diagnostic_family(
        "constraint_sampling", specifications, "samples_4";
        diagnostic_warning=
            "sample-count sensitivity only; crossings between samples remain possible",
    )
end

function viability_diagnostics()
    return vcat(
        discretization_diagnostics(),
        horizon_diagnostics(),
        control_latency_diagnostics(),
        constraint_sampling_diagnostics(),
    )
end
