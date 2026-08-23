@testset "viability sensitivity diagnostics" begin
    rows = viability_diagnostics()
    @test !isempty(rows)
    @test all(row.result_class == "simulation estimate" for row in rows)
    @test all(row.reporting_role == "numerical diagnostic" for row in rows)
    @test all(row.diagnostic_status == "sensitivity diagnostic; not convergence evidence" for row in rows)
    @test Set(row.diagnostic_family for row in rows) == Set([
        "discretization", "horizon", "control_latency", "constraint_sampling",
    ])

    discretization = Dict(
        row.variant => row for row in rows if row.diagnostic_family == "discretization"
    )
    @test Set(keys(discretization)) == Set([
        "base", "state_grid_refined", "time_step_refined", "coupled_refined",
    ])
    base = discretization["base"]
    state_grid_refined = discretization["state_grid_refined"]
    time_step_refined = discretization["time_step_refined"]
    coupled_refined = discretization["coupled_refined"]
    @test all(row.regime == "freewheel" for row in values(discretization))
    @test state_grid_refined.theta_step_rad == base.theta_step_rad / 2
    @test state_grid_refined.omega_step_rad_s == base.omega_step_rad_s / 2
    @test state_grid_refined.time_step_s == base.time_step_s
    @test time_step_refined.theta_step_rad == base.theta_step_rad
    @test time_step_refined.omega_step_rad_s == base.omega_step_rad_s
    @test time_step_refined.time_step_s == base.time_step_s / 2
    @test coupled_refined.theta_step_rad == base.theta_step_rad / 2
    @test coupled_refined.omega_step_rad_s == base.omega_step_rad_s / 2
    @test coupled_refined.time_step_s == base.time_step_s / 2
    @test sign(state_grid_refined.recovery_from_outside_fraction_change) !=
          sign(time_step_refined.recovery_from_outside_fraction_change)
    @test abs(coupled_refined.recovery_from_outside_fraction_change) <
          min(
              abs(state_grid_refined.recovery_from_outside_fraction_change),
              abs(time_step_refined.recovery_from_outside_fraction_change),
          )
    @test all(occursin("coupled refinement masks", row.diagnostic_finding)
              for row in values(discretization))

    horizon_rows = [row for row in rows if row.diagnostic_family == "horizon"]
    @test Set(row.variant for row in horizon_rows) == Set([
        "horizon_0_5_s", "horizon_1_s", "horizon_2_s", "horizon_4_s",
    ])
    @test Set(row.regime for row in horizon_rows) ==
          Set(["direct", "freewheel", "impossible"])
    @test all(row.horizon_steps == round(Int, row.horizon_s / row.time_step_s)
              for row in horizon_rows)
    for regime in ("direct", "freewheel", "impossible")
        regime_rows = sort(
            [row for row in horizon_rows if row.regime == regime], by=row -> row.horizon_s,
        )
        @test issorted(
            [row.viability_fraction for row in regime_rows], rev=true,
        )
    end

    latency_rows = [row for row in rows if row.diagnostic_family == "control_latency"]
    @test Set(row.control_latency_s for row in latency_rows) == Set([0.0, 0.0125, 0.025, 0.05])
    @test Set(row.regime for row in latency_rows) ==
          Set(["direct", "freewheel", "impossible"])
    @test all(0 <= row.control_latency_s <= row.time_step_s for row in latency_rows)
    @test all(occursin("within-step", row.diagnostic_warning) for row in latency_rows)

    sampling_rows = [row for row in rows if row.diagnostic_family == "constraint_sampling"]
    @test Set(row.constraint_samples_per_step for row in sampling_rows) == Set([1, 4, 8])
    @test all(row.regime == "freewheel" for row in sampling_rows)
    @test all(row.theta_step_rad == base.theta_step_rad &&
              row.omega_step_rad_s == base.omega_step_rad_s &&
              row.time_step_s == base.time_step_s for row in sampling_rows)
end

@testset "within-step control latency semantics" begin
    immediate = GripAnalysis.delayed_sampled_step(
        0.1, -0.2, 1.6, 0.05, 0.45, 1.2; samples=4, control_latency_s=0.0,
    )
    ordinary = GripAnalysis.sampled_step(0.1, -0.2, 1.6, 0.05, 0.45, 1.2; samples=4)
    fully_delayed = GripAnalysis.delayed_sampled_step(
        0.1, -0.2, 1.6, 0.05, 0.45, 1.2; samples=4, control_latency_s=0.05,
    )
    zero_control = GripAnalysis.sampled_step(0.1, -0.2, 0.0, 0.05, 0.45, 1.2; samples=4)

    @test immediate == ordinary
    @test fully_delayed == zero_control
    @test_throws ArgumentError GripAnalysis.delayed_sampled_step(
        0.1, -0.2, 1.6, 0.05, 0.45, 1.2; control_latency_s=0.06,
    )
    @test_throws ArgumentError GripAnalysis.sampled_step(
        0.1, -0.2, 1.6, 0.05, 0.45, 1.2; samples=0,
    )
end
