@testset "within-person human-outcome template" begin
    empty_result = within_person_regression(NamedTuple[]; outcome_name="contact_load")
    @test empty_result.status == "not_run_no_human_observations"

    observations = NamedTuple[]
    for participant_index in 1:3, observation_index in 1:6
        p_alpha = 0.04 * observation_index + 0.01 * participant_index
        nu_alpha = 0.08 * observation_index^2 + 0.02 * participant_index * observation_index
        tempo_hz = 1 + 0.01 * observation_index^3 + 0.03 * participant_index
        outcome = 10 * participant_index + 2p_alpha - 0.5nu_alpha + 0.3tempo_hz
        push!(observations, (
            participant="p$(participant_index)", outcome_name="contact_load",
            outcome_value=outcome, p_alpha=p_alpha, nu_alpha_hz=nu_alpha,
            beat_frequency_hz=tempo_hz,
            object_count=3.0,
        ))
    end
    fit = within_person_regression(
        observations; outcome_name="contact_load", controls=[:beat_frequency_hz, :object_count],
    )
    @test fit.status == "ok"
    @test fit.result_class == "empirical estimate"
    @test fit.predictors == [:p_alpha, :nu_alpha_hz, :beat_frequency_hz]
    @test fit.absorbed_controls == [:object_count]
    @test fit.coefficients ≈ [2.0, -0.5, 0.3] atol=1e-8
    @test length(fit.standard_errors) == 3
    @test fit.residual_dof == 12

    singular_rows = [
        (participant="p1", outcome_name="RPE", outcome_value=1.0,
         p_alpha=0.2, nu_alpha_hz=0.4, object_count=3.0),
        (participant="p1", outcome_name="RPE", outcome_value=2.0,
         p_alpha=0.3, nu_alpha_hz=0.5, object_count=3.0),
        (participant="p2", outcome_name="RPE", outcome_value=1.5,
         p_alpha=0.2, nu_alpha_hz=0.4, object_count=3.0),
        (participant="p2", outcome_name="RPE", outcome_value=2.5,
         p_alpha=0.3, nu_alpha_hz=0.5, object_count=3.0),
    ]
    singular = within_person_regression(
        singular_rows; outcome_name="RPE", controls=[:object_count],
    )
    @test singular.status == "not_run_singular_within_person_design"
    @test singular.observations == 4
    @test singular.participants == 2
end

@testset "cell-friendly runner writes separated result classes" begin
    mktempdir() do result_directory
        ruby_phase_path = normpath(joinpath(
            @__DIR__, "..", "..", "results", "phase_metrics.csv",
        ))
        human_template = normpath(joinpath(
            @__DIR__, "..", "human_observations_template.csv",
        ))
        summary = run_analysis(
            SCENARIOS_PATH, result_directory, ruby_phase_path, human_template,
        )
        @test summary.human_status == "not_run_no_human_observations"
        @test Set(readdir(result_directory)) == Set([
            "mechanics.csv", "reliability.csv", "reliability_benchmarks.csv",
            "matched_flight.csv", "tempo_dwell.csv", "noise_ablations.csv",
            "dimensionless_collapse.csv", "viability_summary.csv",
            "formal_derivations_julia.csv", "formal_derivation_crosscheck.csv",
            "viability_diagnostics.csv", "crosscheck.csv", "human_analysis.csv",
        ])
        @test summary.reliability_benchmark_rows == 8
        @test summary.matched_flight_rows == 3
        @test summary.tempo_dwell_rows == 9
        @test summary.noise_ablation_rows == 9
        @test summary.dimensionless_collapse_rows == 4
        @test summary.formal_rows == 286
        @test summary.formal_crosscheck_rows == 286
        @test summary.formal_crosscheck_status == "match"
        @test summary.viability_diagnostic_rows == 31
        @test occursin("model consequence", read(joinpath(result_directory, "mechanics.csv"), String))
        @test occursin("simulation estimate", read(joinpath(result_directory, "reliability.csv"), String))
        @test occursin(
            "model consequence",
            read(joinpath(result_directory, "reliability_benchmarks.csv"), String),
        )
        @test occursin(
            "not empirical validation",
            read(joinpath(result_directory, "dimensionless_collapse.csv"), String),
        )
        @test occursin("refined", read(joinpath(result_directory, "viability_summary.csv"), String))
        viability_diagnostics_output = read(
            joinpath(result_directory, "viability_diagnostics.csv"), String,
        )
        @test occursin("numerical diagnostic", viability_diagnostics_output)
        @test occursin("not convergence evidence", viability_diagnostics_output)
        human_output = read(joinpath(result_directory, "human_analysis.csv"), String)
        @test occursin("empirical unknown", human_output)
        @test occursin("not_run_no_human_observations", human_output)
    end
end

@testset "runner analyzes supplied human outcomes one at a time" begin
    mktempdir() do directory
        human_path = joinpath(directory, "human.csv")
        open(human_path, "w") do stream
            println(stream, "participant,outcome_name,outcome_value,p_alpha,nu_alpha_hz,beat_frequency_hz")
            for participant_index in 1:3, observation_index in 1:6
                p_alpha = 0.04 * observation_index + 0.01 * participant_index
                nu_alpha = 0.08 * observation_index^2 + 0.02 * participant_index * observation_index
                tempo_hz = 1 + 0.01 * observation_index^3 + 0.03 * participant_index
                outcome = 10 * participant_index + 2p_alpha - 0.5nu_alpha + 0.3tempo_hz
                println(stream, "p$(participant_index),contact_load,$outcome,$p_alpha,$nu_alpha,$tempo_hz")
            end
        end
        result_directory = joinpath(directory, "results")
        summary = run_analysis(
            SCENARIOS_PATH, result_directory, joinpath(directory, "missing-phase.csv"),
            human_path; human_controls=[:beat_frequency_hz],
        )
        @test summary.human_status == "ok"
        @test summary.human_result_class == "empirical estimate"
        output = read(joinpath(result_directory, "human_analysis.csv"), String)
        @test occursin("contact_load", output)
        @test occursin("empirical estimate", output)
        @test occursin("p_alpha", output)
        @test occursin("nu_alpha_hz", output)
        @test !occursin("not_run_no_human_observations", output)
    end
end
