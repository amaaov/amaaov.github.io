using Test

include(joinpath(@__DIR__, "..", "GripAnalysis.jl"))
using .GripAnalysis

const SCENARIOS_PATH = normpath(joinpath(@__DIR__, "..", "..", "scenarios.csv"))

@testset "scenario input" begin
    scenarios = read_scenarios(SCENARIOS_PATH)
    @test length(scenarios) == 8
    @test all(scenario.object_count == 3 for scenario in scenarios)
    @test all(scenario.hand_count == 2 for scenario in scenarios)
    @test all(scenario.protocol_kind == "steady_periodic" for scenario in scenarios)
    @test all(scenario.siteswap_period_beats == 1 for scenario in scenarios)
    @test all(scenario.observation_period_beats == 3 for scenario in scenarios)
    mktemp() do invalid_path, stream
        lines = readlines(SCENARIOS_PATH)
        fields = split(lines[2], ',')
        fields[11] = "0"
        println(stream, lines[1])
        println(stream, join(fields, ','))
        close(stream)
        @test_throws ArgumentError read_scenarios(invalid_path)
    end
end

@testset "uniform cascade mechanics" begin
    scenario = first(read_scenarios(SCENARIOS_PATH))
    result = mechanics(scenario)
    @test result.hand_cycle_s ≈ 2 * scenario.beat_seconds
    @test result.flight_s ≈
          (scenario.object_count / scenario.hand_count - scenario.dwell_ratio) * result.hand_cycle_s
    @test result.dwell_s ≈ scenario.dwell_ratio * result.hand_cycle_s
    @test result.rho_alpha ≈ max(1 - 2 * scenario.dwell_ratio, 0)
    @test result.throw_height_m ≈ scenario.gravity_m_s2 * result.flight_s^2 / 8
    @test result.launch_energy_throughput_w ≈
          result.launch_energy_j / scenario.beat_seconds
    @test result.half_sine_peak_n > result.peak_lower_bound_n
    @test result.half_sine_rms_n > result.rms_lower_bound_n
    @test result.result_class == "model consequence"
    @test result.phase_fraction == 0.5
    @test result.siteswap_period_beats == 1
    @test result.observation_period_beats == 3
end

@testset "seeded landing reliability" begin
    scenarios = read_scenarios(SCENARIOS_PATH)
    first_run = reliability.(scenarios)
    second_run = reliability.(scenarios)
    @test first_run == second_run
    @test all(result.clean_probability + result.correction_probability +
              result.drop_probability ≈ 1 for result in first_run)
    @test all(0 <= result.drop_standard_error <= 0.5 for result in first_run)
    @test all(result.drop_wilson_low <= result.drop_probability <=
              result.drop_wilson_high for result in first_run)
    @test first(first_run).drop_probability > last(first_run).drop_probability
    @test first(first_run).correction_threshold_m ≈
          first(scenarios).catch_radius_m / 2
    @test all(result.calibration_status == "uncalibrated illustrative model" for result in first_run)
end

include("hypothesis_batteries_test.jl")
include("formal_derivations_test.jl")
include("combinatorics_test.jl")
include("siteswap_hypotheses_test.jl")

@testset "discretized recovery ordering" begin
    summaries = viability_summaries()
    by_regime = Dict(summary.regime => summary for summary in summaries)
    direct = by_regime["direct"]
    freewheel = by_regime["freewheel"]
    impossible = by_regime["impossible"]
    @test 0 < impossible.viability_count < impossible.grid_points
    @test 0 < impossible.capture_count <= impossible.viability_count
    @test direct.viability_count > freewheel.viability_count > impossible.viability_count
    @test direct.capture_count > freewheel.capture_count > impossible.capture_count
    @test all(summary.capture_count == summary.target_count +
              summary.recovery_from_outside_count for summary in summaries)
    @test impossible.recovery_from_outside_count == 0
    @test all(summary.approximation == "finite-horizon sampled-time nearest-grid controlled predecessor with RK4" for summary in summaries)
    @test all(summary.constraint_samples_per_step == 4 for summary in summaries)
    @test all(summary.theta_step_rad > 0 && summary.omega_step_rad_s > 0 &&
              summary.time_step_s > 0 for summary in summaries)
    refined = viability_summaries(include_refinement=true)
    @test Set(summary.resolution for summary in refined) == Set(["base", "refined"])
    @test all(summary.horizon_s > 0 for summary in refined)
end

@testset "common-horizon recovery semantics" begin
    outside = CartesianIndex(0, 0)
    transitions = fill(outside, 1, 3, 1)
    transitions[1, 1, 1] = CartesianIndex(1, 2)
    transitions[1, 2, 1] = CartesianIndex(1, 3)
    target = falses(1, 3)
    target[1, 2] = true
    viable, capture, viable_target, recovery =
        GripAnalysis.finite_horizon_masks(target, transitions, 2)

    @test viable[1, 1]
    @test recovery[1, 1]
    @test capture[1, 1]
    @test !viable_target[1, 2]
    @test !recovery[1, 2]
    @test GripAnalysis.sampled_step(0.44, 1.2, 4.0, 0.05, 0.45, 1.2) === nothing
end

include("viability_diagnostics_test.jl")

@testset "optional Ruby cross-check" begin
    scenarios = read_scenarios(SCENARIOS_PATH)
    missing = crosscheck_rho(scenarios, joinpath(@__DIR__, "missing.csv"))
    @test length(missing) == length(scenarios)
    @test all(row.status == "ruby-result-missing" for row in missing)
end

include("human_and_runner_test.jl")
