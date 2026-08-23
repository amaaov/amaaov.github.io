module GripAnalysis

using LinearAlgebra
using Printf
using Random
using Statistics

include("scenarios.jl")
include("siteswap_protocols.jl")
include("siteswap_hypotheses.jl")
include("siteswap_output.jl")
include("siteswap_crosscheck.jl")
include("mechanics.jl")
include("formal_derivations.jl")
include("formal_results.jl")
include("formal_crosscheck.jl")
include("reliability.jl")
include("hypothesis_batteries.jl")
include("viability.jl")
include("viability_diagnostics.jl")
include("human_analysis.jl")
include("output.jl")

export Scenario,
       crosscheck_rho,
       bernoulli_temporal_law,
       dimensionless_collapse_sweep,
       formal_derivation_rows,
       formal_derivation_crosscheck_rows,
       gaussian_correction_derivative,
       gaussian_correction_maximum,
       gaussian_correction_probability,
       gaussian_correction_band_maximum,
       gaussian_reliability_probabilities,
       matched_flight_sweep,
       mechanics,
       noise_ablation_sweep,
       read_human_observations,
       read_scenarios,
       reliability,
       reliability_benchmarks,
       one_bit_first_passage_steps,
       one_bit_closed_form_first_passage,
       one_bit_recurrence_residual,
       read_siteswap_protocols,
       run_analysis,
       SITESWAP_EXACT_METRICS,
       SiteswapAction,
       SiteswapProtocol,
       generate_siteswap_analysis,
       siteswap_crosscheck_rows,
       siteswap_hypothesis_rows,
       tempo_dwell_sweep,
       two_object_phase_law,
       validate_siteswap_protocol,
       viability_diagnostics,
       viability_summaries,
       within_person_regression,
       write_csv

end
