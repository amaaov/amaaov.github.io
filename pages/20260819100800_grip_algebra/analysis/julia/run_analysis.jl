# %% Load the stdlib-only analysis module.
include(joinpath(@__DIR__, "GripAnalysis.jl"))
using .GripAnalysis

# %% Resolve shared inputs and result paths.
const ANALYSIS_DIRECTORY = normpath(joinpath(@__DIR__, ".."))
const SCENARIOS_PATH = joinpath(ANALYSIS_DIRECTORY, "scenarios.csv")
const RESULTS_DIRECTORY = get(
    ENV, "GRIP_RESULTS_DIRECTORY", joinpath(ANALYSIS_DIRECTORY, "results"),
)
const RUBY_PHASE_PATH = joinpath(RESULTS_DIRECTORY, "phase_metrics.csv")
const HUMAN_OBSERVATIONS_PATH = joinpath(@__DIR__, "human_observations_template.csv")

# %% Execute model batteries, recovery diagnostics, and language cross-checks.
function main()
    summary = run_analysis(
        SCENARIOS_PATH, RESULTS_DIRECTORY, RUBY_PHASE_PATH, HUMAN_OBSERVATIONS_PATH,
    )
    println("mechanics_rows=$(summary.mechanics_rows)")
    println("reliability_rows=$(summary.reliability_rows)")
    println("reliability_benchmark_rows=$(summary.reliability_benchmark_rows)")
    println("matched_flight_rows=$(summary.matched_flight_rows)")
    println("tempo_dwell_rows=$(summary.tempo_dwell_rows)")
    println("noise_ablation_rows=$(summary.noise_ablation_rows)")
    println("dimensionless_collapse_rows=$(summary.dimensionless_collapse_rows)")
    println("formal_rows=$(summary.formal_rows)")
    println("formal_crosscheck_rows=$(summary.formal_crosscheck_rows)")
    println("formal_crosscheck_status=$(summary.formal_crosscheck_status)")
    println("viability_rows=$(summary.viability_rows)")
    println("viability_diagnostic_rows=$(summary.viability_diagnostic_rows)")
    println("crosscheck_rows=$(summary.crosscheck_rows)")
    println("human_result_class=$(summary.human_result_class)")
    println("human_analysis_status=$(summary.human_status)")
    summary.formal_crosscheck_status == "match" ||
        error("Ruby Julia formal derivation cross-check failed")
    return summary
end

if abspath(PROGRAM_FILE) == abspath(@__FILE__)
    main()
end
