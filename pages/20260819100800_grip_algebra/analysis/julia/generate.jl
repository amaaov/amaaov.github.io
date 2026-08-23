include(joinpath(@__DIR__, "GripAnalysis.jl"))
using .GripAnalysis

const SITESWAP_ANALYSIS_DIRECTORY = normpath(joinpath(@__DIR__, ".."))
const SITESWAP_PROTOCOLS_PATH = joinpath(SITESWAP_ANALYSIS_DIRECTORY, "siteswap_protocols.csv")
const SITESWAP_RESULTS_DIRECTORY = get(
    ENV, "GRIP_RESULTS_DIRECTORY", joinpath(SITESWAP_ANALYSIS_DIRECTORY, "results"),
)
const RUBY_SITESWAP_RESULTS_PATH = joinpath(
    SITESWAP_RESULTS_DIRECTORY, "siteswap_hypotheses_ruby.csv",
)

function main()
    summary = generate_siteswap_analysis(
        SITESWAP_PROTOCOLS_PATH, SITESWAP_RESULTS_DIRECTORY, RUBY_SITESWAP_RESULTS_PATH,
    )
    println("siteswap_rows=$(summary.siteswap_rows)")
    println("siteswap_crosscheck_rows=$(summary.crosscheck_rows)")
    println("siteswap_crosscheck_status=$(summary.crosscheck_status)")
    summary.crosscheck_status == "match" || error("Ruby Julia siteswap cross-check failed")
    return summary
end

if abspath(PROGRAM_FILE) == abspath(@__FILE__)
    main()
end
