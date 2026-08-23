@testset "exact Gaussian reliability benchmark" begin
    probabilities = gaussian_reliability_probabilities(1.0, 0.0, 3.0, 1.0)
    @test probabilities.landing_error_sigma_m == 1.0
    @test probabilities.standardized_catch_radius == 1.0
    @test probabilities.clean_probability ≈ 0.3829249225480262 atol=1e-14
    @test probabilities.correction_probability ≈ 0.2997645695890596 atol=1e-14
    @test probabilities.drop_probability ≈ 0.3173105078629141 atol=1e-14
    @test probabilities.clean_probability + probabilities.correction_probability +
          probabilities.drop_probability ≈ 1

    no_noise = gaussian_reliability_probabilities(0.0, 0.0, 1.0, 0.035)
    @test no_noise.clean_probability == 1
    @test no_noise.correction_probability == 0
    @test no_noise.drop_probability == 0
    @test no_noise.standardized_catch_radius == Inf

    correction_maximum = gaussian_correction_band_maximum()
    @test correction_maximum.result_class == "model consequence"
    @test correction_maximum.sigma_over_radius ≈ sqrt(3 / (8log(2)))
    @test correction_maximum.correction_probability ≈ 0.32267456883476864 atol=1e-14

    results = reliability.(read_scenarios(SCENARIOS_PATH))
    @test all(result.exact_result_class == "model consequence" for result in results)
    @test all(result.clean_residual ==
              result.clean_probability - result.exact_clean_probability for result in results)
    @test all(result.correction_residual ==
              result.correction_probability - result.exact_correction_probability for result in results)
    @test all(result.drop_residual ==
              result.drop_probability - result.exact_drop_probability for result in results)
    @test all(result.exact_clean_within_wilson &&
              result.exact_correction_within_wilson &&
              result.exact_drop_within_wilson for result in results)

    benchmark_rows = reliability_benchmarks(results)
    @test length(benchmark_rows) == length(results)
    @test all(row.result_class == "model consequence" for row in benchmark_rows)
    @test all(row.monte_carlo_result_class == "simulation estimate" for row in benchmark_rows)
    @test all(row.correction_maximum_sigma_over_radius ≈
              correction_maximum.sigma_over_radius for row in benchmark_rows)
    @test all(row.correction_maximum_probability ≈
              correction_maximum.correction_probability for row in benchmark_rows)
end

@testset "matched-flight dwell battery" begin
    base = first(read_scenarios(SCENARIOS_PATH))
    rows = matched_flight_sweep(base; dwell_ratios=[0.25, 0.5, 0.9], flight_s=0.8)
    @test length(rows) == 3
    @test all(row.flight_s ≈ 0.8 for row in rows)
    @test [row.rho_alpha for row in rows] ≈ [0.5, 0.0, 0.0]
    @test all(row.exact_drop_probability ≈ first(rows).exact_drop_probability for row in rows)
    @test all(row.drop_probability == first(rows).drop_probability for row in rows)
    @test issorted([row.launch_energy_throughput_w for row in rows]; rev=true)
    @test all(row.result_class == "simulation estimate" for row in rows)
    @test all(row.mechanics_result_class == "model consequence" for row in rows)
end

@testset "tempo-by-dwell battery" begin
    base = first(read_scenarios(SCENARIOS_PATH))
    rows = tempo_dwell_sweep(base; beat_seconds=[0.25, 0.5], dwell_ratios=[0.25, 0.6])
    @test length(rows) == 4
    low_dwell = filter(row -> row.dwell_ratio == 0.25, rows)
    @test length(low_dwell) == 2
    @test only(unique(row.rho_alpha for row in low_dwell)) == 0.5
    @test only(unique(row.peak_lower_bound_n for row in low_dwell)) ≈
          first(low_dwell).peak_lower_bound_n
    @test first(low_dwell).flight_s < last(low_dwell).flight_s
    @test first(low_dwell).exact_drop_probability < last(low_dwell).exact_drop_probability
    @test first(low_dwell).alpha_entry_rate_hz > last(low_dwell).alpha_entry_rate_hz
    @test first(low_dwell).alpha_bout_s < last(low_dwell).alpha_bout_s
end

@testset "noise-ablation battery" begin
    base = first(read_scenarios(SCENARIOS_PATH))
    rows = noise_ablation_sweep(base; dwell_ratios=[0.25, 0.5, 0.9])
    @test length(rows) == 9
    @test Set(row.noise_case for row in rows) ==
          Set(["combined", "position_only", "velocity_only"])
    position_only = filter(row -> row.noise_case == "position_only", rows)
    velocity_only = filter(row -> row.noise_case == "velocity_only", rows)
    @test all(row.exact_drop_probability ≈
              first(position_only).exact_drop_probability for row in position_only)
    @test first(velocity_only).exact_drop_probability > last(velocity_only).exact_drop_probability
    @test all(row.calibration_status == "uncalibrated illustrative model" for row in rows)
end

@testset "dimensionless reliability collapse battery" begin
    base = first(read_scenarios(SCENARIOS_PATH))
    rows = dimensionless_collapse_sweep(base)
    @test length(rows) == 4
    @test all(row.standardized_catch_radius ≈
              first(rows).standardized_catch_radius for row in rows)
    @test all(row.exact_clean_probability ≈ first(rows).exact_clean_probability for row in rows)
    @test all(row.exact_correction_probability ≈
              first(rows).exact_correction_probability for row in rows)
    @test all(row.exact_drop_probability ≈ first(rows).exact_drop_probability for row in rows)
    @test all(row.exact_drop_within_wilson for row in rows)
    @test Set(row.collapse_case for row in rows) == Set([
        "baseline", "scaled_spatial", "position_only_equivalent",
        "velocity_only_equivalent",
    ])
end
