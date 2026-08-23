const GRAVITY_OVER_LENGTH = 5.2

function control_values(regime)
    regime == "direct" && return collect(-4.0:0.4:4.0)
    regime == "freewheel" && return collect(-0.8:0.4:4.0)
    regime == "impossible" && return collect(-0.4:0.4:0.4)
    error("unknown control regime: $regime")
end

function rk4_step(theta, omega, control, dt)
    derivative(state_theta, state_omega) =
        (state_omega, GRAVITY_OVER_LENGTH * state_theta + control)
    k1_theta, k1_omega = derivative(theta, omega)
    k2_theta, k2_omega = derivative(
        theta + dt * k1_theta / 2, omega + dt * k1_omega / 2,
    )
    k3_theta, k3_omega = derivative(
        theta + dt * k2_theta / 2, omega + dt * k2_omega / 2,
    )
    k4_theta, k4_omega = derivative(theta + dt * k3_theta, omega + dt * k3_omega)
    return (
        theta + dt * (k1_theta + 2k2_theta + 2k3_theta + k4_theta) / 6,
        omega + dt * (k1_omega + 2k2_omega + 2k3_omega + k4_omega) / 6,
    )
end

function sampled_step(theta, omega, control, dt, theta_limit, omega_limit; samples=4)
    samples > 0 || throw(ArgumentError("constraint samples must be positive"))
    sample_dt = dt / samples
    for _ in 1:samples
        theta, omega = rk4_step(theta, omega, control, sample_dt)
        abs(theta) <= theta_limit && abs(omega) <= omega_limit || return nothing
    end
    return theta, omega
end

function delayed_sampled_step(
    theta, omega, control, dt, theta_limit, omega_limit;
    samples=4, control_latency_s=0.0,
)
    samples > 0 || throw(ArgumentError("constraint samples must be positive"))
    0 <= control_latency_s <= dt ||
        throw(ArgumentError("control latency must be between zero and the time step"))
    control_latency_s == 0 && return sampled_step(
        theta, omega, control, dt, theta_limit, omega_limit; samples,
    )

    checkpoints = collect(range(0.0, dt; length=samples + 1))
    push!(checkpoints, control_latency_s)
    sort!(checkpoints)
    unique!(checkpoints)
    for index in 1:(length(checkpoints) - 1)
        start_time = checkpoints[index]
        segment_dt = checkpoints[index + 1] - start_time
        segment_control = start_time < control_latency_s ? 0.0 : control
        theta, omega = rk4_step(theta, omega, segment_control, segment_dt)
        abs(theta) <= theta_limit && abs(omega) <= omega_limit || return nothing
    end
    return theta, omega
end

function grid_index(value, values)
    value < first(values) - eps(Float64) && return 0
    value > last(values) + eps(Float64) && return 0
    step = values[2] - values[1]
    return clamp(round(Int, (value - first(values)) / step) + 1, 1, length(values))
end

function successors(
    theta_values, omega_values, controls, dt;
    samples=4, control_latency_s=0.0,
)
    table = Array{CartesianIndex{2}}(undef, length(theta_values), length(omega_values), length(controls))
    outside = CartesianIndex(0, 0)
    theta_limit = maximum(abs, theta_values)
    omega_limit = maximum(abs, omega_values)
    for theta_index in eachindex(theta_values), omega_index in eachindex(omega_values)
        theta = theta_values[theta_index]
        omega = omega_values[omega_index]
        for control_index in eachindex(controls)
            transition = delayed_sampled_step(
                theta, omega, controls[control_index], dt, theta_limit, omega_limit;
                samples, control_latency_s,
            )
            if transition === nothing
                table[theta_index, omega_index, control_index] = outside
                continue
            end
            next_theta, next_omega = transition
            next_theta_index = grid_index(next_theta, theta_values)
            next_omega_index = grid_index(next_omega, omega_values)
            table[theta_index, omega_index, control_index] =
                next_theta_index == 0 || next_omega_index == 0 ? outside :
                CartesianIndex(next_theta_index, next_omega_index)
        end
    end
    return table
end

function controlled_predecessor(target, transition_table)
    predecessor = falses(size(target))
    outside = CartesianIndex(0, 0)
    for state in CartesianIndices(target)
        for control_index in axes(transition_table, 3)
            next_state = transition_table[state[1], state[2], control_index]
            if next_state != outside && target[next_state]
                predecessor[state] = true
                break
            end
        end
    end
    return predecessor
end

function finite_horizon_masks(target, transition_table, steps)
    viable = trues(size(target))
    recovery = falses(size(target))
    for _ in 1:steps
        recovery_target = (target .& viable) .| recovery
        recovery = controlled_predecessor(recovery_target, transition_table)
        viable = controlled_predecessor(viable, transition_table)
    end
    viable_target = target .& viable
    recovery .&= .!target
    capture = viable_target .| recovery
    return viable, capture, viable_target, recovery
end

function finite_horizon_sets(
    regime; theta_step, omega_step, dt, horizon_s,
    constraint_samples_per_step=4, control_latency_s=0.0,
)
    theta_values = collect(-0.45:theta_step:0.45)
    omega_values = collect(-1.2:omega_step:1.2)
    steps = round(Int, horizon_s / dt)
    transition_table = successors(
        theta_values, omega_values, control_values(regime), dt;
        samples=constraint_samples_per_step, control_latency_s,
    )
    target = falses(length(theta_values), length(omega_values))
    for theta_index in eachindex(theta_values), omega_index in eachindex(omega_values)
        target[theta_index, omega_index] =
            abs(theta_values[theta_index]) <= 0.05 && abs(omega_values[omega_index]) <= 0.15
    end
    viable, capture, viable_target, recovery =
        finite_horizon_masks(target, transition_table, steps)
    return viable, capture, viable_target, recovery,
        length(theta_values) * length(omega_values), steps
end

function viability_summary(regime, resolution, parameters)
    viable, capture, viable_target, recovery, grid_points, steps =
        finite_horizon_sets(regime; parameters...)
    viability_count = count(viable)
    capture_count = count(capture)
    target_count = count(viable_target)
    recovery_from_outside_count = count(recovery)
    return (
        result_class="simulation estimate", regime, resolution,
        grid_points, viability_count, viability_fraction=viability_count / grid_points,
        capture_count, capture_fraction=capture_count / grid_points,
        target_count, target_fraction=target_count / grid_points,
        recovery_from_outside_count,
        recovery_from_outside_fraction=recovery_from_outside_count / grid_points,
        theta_step_rad=parameters.theta_step, omega_step_rad_s=parameters.omega_step,
        time_step_s=parameters.dt, horizon_s=parameters.horizon_s, horizon_steps=steps,
        theta_limit_rad=0.45, omega_limit_rad_s=1.2,
        target_theta_rad=0.05, target_omega_rad_s=0.15,
        gravity_over_length_s2=GRAVITY_OVER_LENGTH,
        control_acceleration_values_rad_s2=join(control_values(regime), ";"),
        constraint_samples_per_step=get(parameters, :constraint_samples_per_step, 4),
        control_latency_s=get(parameters, :control_latency_s, 0.0),
        approximation="finite-horizon sampled-time nearest-grid controlled predecessor with RK4",
        source_scope="standalone numerical model; browser animation is not an analysis input",
    )
end

function viability_summaries(; include_refinement=false)
    base = (theta_step=0.05, omega_step=0.15, dt=0.05, horizon_s=2.0)
    rows = [viability_summary(regime, "base", base) for regime in ("direct", "freewheel", "impossible")]
    if include_refinement
        refined = (theta_step=0.025, omega_step=0.075, dt=0.025, horizon_s=2.0)
        append!(rows, [viability_summary(regime, "refined", refined) for regime in ("direct", "freewheel", "impossible")])
    end
    return rows
end
