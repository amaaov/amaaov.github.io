# Grip Algebra executable analysis

This companion separates five kinds of result that the article must not collapse:

- `theorem`: an exact consequence of the declared finite algebra;
- `model consequence`: an analytic consequence of the ideal timing or mechanics model;
- `simulation estimate`: a numerical approximation under declared noise, grid, and control assumptions;
- `empirical estimate`: a statistical estimate from supplied human observations;
- `empirical unknown`: a human quantity for which this repository has no observations.

The browser court is not an input to this analysis. It is an illustration with normalized geometry and visual timing accommodations, whereas these calculations use physical seconds, fixed gravity, and explicit event intervals.

[`FORMAL_DERIVATIONS.md`](FORMAL_DERIVATIONS.md) gives the assumptions and calculus for the two-object phase law, Bernoulli stationary snapshot, uniform one-bit first passage, and Gaussian correction-band maximum. It also defines the independent Ruby–Julia measurement contract.

## Run

Ruby 2.6 or newer and Julia 1.12 or newer are sufficient; the workflow has no third-party packages.

```sh
cd pages/20260819100800_grip_algebra/analysis
ruby run_all.rb
```

The launcher runs both test suites, generates all CSVs in a temporary directory, and replaces the result files only after all generators succeed. The individual entry points are:

```sh
ruby ruby/test/run.rb
ruby ruby/generate.rb
julia --startup-file=no julia/test/runtests.jl
julia --startup-file=no julia/run_analysis.jl
julia --startup-file=no julia/generate.jl
```

## Shared scenario contract

`scenarios.csv` is the common Ruby–Julia input. The initial sweep is a uniform alternating two-hand siteswap `3`: three 0.12 kg objects, 0.40 s between throws, 9.81 m/s² gravity, and dwell ratio from 0.25 through 0.90. Siteswap `3` has a one-beat notation period; the three-beat field is the object/retention observation window. These are analysis settings, not measured population values.

For beat interval `b` and dwell ratio `r`, the model uses hand-cycle duration `2b`, dwell `2rb`, and flight time `(3-2r)b`. Held intervals are `[catch, release)`, flight intervals are `[release, next catch)`, and periodic observations are `[0,T)`. Simultaneous events form one packet, and the periodic seam is counted once.

The mechanics calculation assumes equal release and catch heights, negligible drag, complete mechanical periods, unchanged total vertical momentum, gravity as the only non-body vertical force, and zero body force during total akrateia. Its force values are lower bounds or a named half-sine pulse realization. Its energy value is outgoing vertical kinetic-energy throughput, not body work or metabolic power.

The reliability calculation uses a deliberately uncalibrated one-dimensional Gaussian landing-error model. It reports per-landing Wilson intervals, records the Julia version and random-number generator, and reuses the same seeded random draws across dwell settings. Its “correction” band is only a declared geometric proxy between a fraction `c` of the catch radius and the catch boundary. The configured reliability scenarios use `c = 1/2`; the formal battery also checks `c = 1/4` and `c = 3/4`.

The same Gaussian model also has an exact closed form. The benchmark output keeps that model consequence separate from the Monte Carlo estimate, reports their residual, and checks whether the exact value lies in each simulated Wilson interval. Matched-flight, tempo-by-dwell, noise-ablation, and dimensionless-collapse batteries are derived from the first configured scenario without changing `scenarios.csv`. They discriminate consequences of the declared model; they do not validate it against a performer.

The recovery calculation applies an RK4 transition map and a common-horizon controlled-predecessor recursion to the article's linear inverted-pendulum sketch. It checks four within-step samples for constraint escape and reports finite-horizon, finite-grid reach-avoid approximations at base and refined resolutions. A path can still cross a boundary between samples, and nearest-grid projection can create false safe loops or omit admissible controls, so these rows are sampled-time estimates rather than viability proofs.

The viability diagnostics vary state spacing, time step, horizon, within-step zero-control latency, and constraint-sampling count. Independent state and time refinements move the reported sets in opposing directions, so apparent agreement under coupled refinement is explicitly marked as sensitivity evidence rather than convergence evidence. These percentages stay in the analysis companion until a projection method produces independent conservative and optimistic numerical bounds.

## Hypothesis batteries

The exact two-object phase law covers one contiguous circular retention interval per object for every duty `0 < d < 1` and shortest phase offset `0 <= phi <= 1/2`. Its positive-part form handles both short- and long-duty regimes. The published sweep keeps each object retained for two fifths of a five-beat period and varies phase from zero through one half in steps of one fortieth. It emits the full alpha, Polymorphy, and kappa occupancy signature; entry rates; bout means, maxima, and variances; equal-marginal retention correlation; and identity-change packet turnover. Exact tests compare the general law with independent circular-interval enumeration on both sides of `d = 1/2`.

The one-bit null process chooses one of `n` bits uniformly at each event and flips it. Its boundary-transition probability and first-passage recurrence are exact consequences of that declared stochastic law. Starting from the first mixed state after a boundary departure, the expected number of mixed-state visits is `2^(n - 1) - 1`; the complete boundary-arrival-to-boundary-arrival count includes the compulsory entrance flip and is `2^(n - 1)`. The recurrence, its closed form, symmetry, and every interior start through twelve objects are checked exactly. These are reference values for later event models, not claims about observed juggling.

The independent-retention null treats each object's retention indicator at one stationary sample as a mutually independent Bernoulli variable. The shared-`p` sweep emits the exact three-macrostate distribution and expected occupancy for three, five, and ten objects across five values of `p`, together with the microstate entropy, macrostate entropy, and conditional information discarded by the macrostate projection. A heterogeneous case checks the general product law with object-specific probabilities. Stationarity identifies an expected time share; convergence of a realized long-run share additionally requires ergodicity or another justified law of large numbers. The snapshot law alone identifies no entry rate, bout distribution, or first-passage time. Coordination and phase should be read as departures from this null, not absorbed into it.

The formal battery implements these three exact laws and the Gaussian correction maximum independently in Ruby and Julia. Each language emits 286 measurements: 147 phase, 64 Bernoulli, 66 first-passage, and 9 Gaussian rows. The cross-check compares 277 rational rows by canonical fraction and the nine Gaussian rows numerically with tolerance `1e-10`. Agreement verifies implementations under the declared assumptions; it does not validate the models against a performer.

The Ruby siteswap comparison uses the transparent periodic action protocol in `siteswap_protocols.csv`. It covers `3`, `55500`, `441`, `531`, `2[22]`, `([44],4)(0,0)([22],2)`, and `5(2,4)1` at a shared `0.40 s` beat and dwell ratio `1/4`. For every non-hold action, flight is exactly `(height - 2r)` beats; declared same-hand hold-2 actions remain retained. The fixture records object identity, source and target hand, multiplex socket, explicit empty actions, and the compiled prop-and-hand routing cycle stored as `protocol_cycle_beats`. The Ruby loader rejects broken height sums, object cycles, hand continuity, or duplicate sockets before calculating any result.

These exact interval outputs are consequences of that timing protocol. The adjacent comparison questions are labelled untested empirical hypotheses: no row establishes performer effort, correction demand, or error risk. Airborne-pair exposure is the time average of the number of unordered airborne object pairs, and release concentration is `sum R(R-1) / sum R` over non-hold release packets.

Julia independently reconstructs circular held intervals and occupancy segments from the same declarative fixture. It does not call or import the Ruby implementation. The cross-check compares all 31 shared deterministic metrics as exact integers, Booleans, fractions, or fraction arrays for every scenario. Agreement tests the two implementations of the declared model; it is not evidence that the model predicts human performance.

The Julia batteries use these controls:

- matched flight: dwell `0.25`, `0.50`, and `0.90` with flight fixed at `0.80 s`;
- tempo by dwell: beat intervals `0.25`, `0.40`, and `0.60 s` crossed with dwell `0.25`, `0.45`, and `0.60`;
- noise ablation: combined, position-only, and velocity-only error at dwell `0.25`, `0.50`, and `0.90`;
- dimensionless collapse: four parameterizations with the same catch-radius-to-landing-error ratio;
- viability diagnostics: independent discretization axes, horizons from `0.5` to `4 s`, within-step latency from zero to one full step, and one, four, or eight constraint samples.

## Outputs

- `algebra.csv`: exhaustive state counts and searched connectivity, circulation, and buffering thresholds for zero through eight objects.
- `phase_metrics.csv`: exact `P_alpha`, entry rate, and bout durations for the dwell sweep.
- `phase_counterexamples.csv`: equal per-object airborne duty with different relative phase.
- `phase_sweep.csv`: exact full-macrostate, fragmentation, correlation, and identity-turnover metrics across phase.
- `one_bit_null.csv`: exact one-bit null-process boundary and first-passage quantities.
- `independent_retention_null.csv`: exact stationary independent-retention macrostate probabilities and entropy comparison.
- `formal_derivations_ruby.csv`: Ruby's 286-row formal phase, Bernoulli, first-passage, and Gaussian battery.
- `formal_derivations_julia.csv`: Julia's independent form of the same 286 measurements.
- `formal_derivation_crosscheck.csv`: keyed exact-rational and tolerance-declared comparisons between the two formal batteries.
- `siteswap_hypotheses_ruby.csv`: exact cross-pattern packet, occupancy, alpha-bout, and airborne-pair metrics under the declared Ruby interval protocol, with empirical questions kept explicitly untested.
- `siteswap_hypotheses_julia.csv`: the independently calculated Julia form of the same exact protocol metrics and separately labelled empirical questions.
- `siteswap_crosscheck.csv`: per-scenario agreement over all shared exact Ruby and Julia siteswap metrics, with any mismatched field named.
- `mechanics.csv`: flight, height, force-bound, pulse, and launch-throughput sweeps.
- `reliability.csv`: seeded catch outcomes with exact Gaussian benchmarks and sampling uncertainty.
- `reliability_benchmarks.csv`: compact exact-versus-Monte-Carlo comparison and correction-band maximum.
- `matched_flight.csv`: controlled flight-time comparison across dwell.
- `tempo_dwell.csv`: factorial tempo and dwell comparison.
- `noise_ablations.csv`: position- and velocity-error sensitivity comparison.
- `dimensionless_collapse.csv`: equal standardized-catch-radius comparison.
- `viability_summary.csv`: base/refined finite-horizon viability, target-inclusive capture, and recovery-from-outside counts for three control regimes.
- `viability_diagnostics.csv`: independent numerical sensitivity, horizon, latency, and constraint-sampling rows.
- `crosscheck.csv`: independent Ruby interval and Julia formula agreement for `P_alpha`.
- `human_analysis.csv`: either a fitted within-person model or an explicit no-observations status.

## Publication boundary

The formal phase, Bernoulli, and one-bit results may support later article revisions when their assumptions fit the surrounding argument. The Gaussian probabilities remain analysis-only because their error and correction geometry is uncalibrated. Numerical viability, capture, latency, and recovery percentages also remain excluded from the article until a projection method supplies independent inner and outer bounds for spatial projection, integration, and between-sample constraint error.

## Human measurements

`julia/human_observations_template.csv` is intentionally empty. Add one row per participant and condition, keeping outcomes in long form through `outcome_name` and `outcome_value`. A useful design must vary phase as well as dwell so `p_alpha`, `nu_alpha_hz`, and dwell are not deterministically interchangeable. The unit-bearing control columns record object mass, throw height, beat frequency, relative phase, catch compliance in m/N, and correction rate in Hz. Object and hand counts are recorded too.

The included within-person regression is a transparent first pass with homoskedastic standard errors and no p-values. Participant-constant controls are absorbed automatically; remaining collinearity stops the fit with an explicit status. A publishable study should predeclare exclusions and outcomes, calibrate the measurement model, inspect nonlinearities, and use participant-aware uncertainty suited to its design.

## Jupyter

Jupyter and IJulia are not installed locally, so the authoritative Julia artifact is `julia/run_analysis.jl`. Its `# %%` sections are ordinary Julia comments: the file runs from top to bottom in Julia and cell-aware editors can execute sections without hidden notebook state. If the project later adopts IJulia, these same calls can become notebook cells without duplicating the model.
