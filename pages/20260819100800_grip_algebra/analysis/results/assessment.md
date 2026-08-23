# Assessment of the executable hypothesis batteries

These conclusions apply to the declared scenarios in `scenarios.csv`. They do not calibrate the model against a performer. The assumptions and proofs for the formal battery are recorded in [`../FORMAL_DERIVATIONS.md`](../FORMAL_DERIVATIONS.md).

Ruby and Julia each calculate a 286-row formal battery: 147 phase measurements, 64 Bernoulli snapshot measurements, 66 one-bit first-passage expectations, and 9 Gaussian correction-band measurements. All 277 rational rows matched exactly across the two implementations, and all nine Gaussian rows matched within tolerance `1e-10`. This is an implementation check under shared assumptions, not independent evidence for those assumptions.

## Exact algebra

Exhaustive enumeration through eight objects reproduces `max(2^n - 2, 0)` mixed microstates. Searching the induced event graphs gives distinct thresholds:

| Property | First object count |
| --- | ---: |
| Mixed state exists | 2 |
| Circulation contained in the mixed region | 3 |
| A state survives one arbitrary release or capture without reaching a pure boundary | 4 |
| Such one-event-buffered states support circulation | 5 |
| Two-event-buffered states support circulation | 7 |

The count is a closed-form theorem; the executable graph search independently checks the connectivity and buffering claims for the enumerated range.

### One-bit null dynamics

The exact null process chooses one object uniformly and flips its retention bit at each event. Conditional on a uniformly selected mixed state, the probability that the next event reaches a homogeneous boundary is

`1 / (2^(n - 1) - 1)`.

Let `e_q` be the expected number of further flips needed to reach either homogeneous boundary from occupancy `q`. The exact recurrence is

`e_0 = e_n = 0` and `e_q = 1 + (q/n)e_(q-1) + ((n-q)/n)e_(q+1)`.

The tridiagonal recurrence and an independent binomial closed form agree for every interior occupancy from two through twelve objects. In particular, `e_1 = 2^(n - 1) - 1`. This is the expected number of mixed-state visits after the compulsory flip away from a boundary. A complete boundary-arrival-to-boundary-arrival excursion includes that entrance flip and therefore has expected length `2^(n - 1)` flips. A central start has expected first-passage times of 3 flips for three objects, `35/2` for five, `448/3` for eight, and `11416/5` for twelve. These quantities belong to the declared null process. They do not predict a performance until its event-selection law has been justified.

### Independent-retention null

For retention indicators that are mutually independent across objects at one stationary sample, with shared retention probability `p`, the exact snapshot probabilities are

`P_alpha = (1-p)^n`, `P_kappa = p^n`, and `P_Amphoteron = 1 - p^n - (1-p)^n`.

At `p = 1/2`, Amphoteron share is `3/4` for three objects, `15/16` for five, and `511/512` for ten. The sweep is symmetric around one half: replacing `p` by `1-p` exchanges alpha and kappa while preserving Amphoteron. At ten objects and `p = 1/2`, the microstate entropy is 10 bits but the three-sign macrostate entropy is only 0.02235 bits, leaving 9.97765 bits of conditional microstate information inside the coarse sign.

For `n >= 2`, the Amphoteron probability has its unique maximum at `p = 1/2`, where it equals the uniform combinatorial fraction `1 - 2^(1-n)`. Cross-object independence is what turns the state count into a snapshot probability. Stationarity makes this the expected time share; identifying it with a realized long-run share additionally requires ergodicity or another justified convergence result. It supplies no temporal entry or bout law. The phase sweep demonstrates why the limitation matters: equal marginal retention can produce sharply different joint macrostates and path fragmentation.

## Phase and flash timing

For the ideal three-ball cascade, Ruby's exact interval union gives

`P_alpha = max(1 - 2r, 0)`.

At the fixed 0.40 s beat interval, dwell ratios 0.25, 0.35, and 0.45 produce `P_alpha` of 0.50, 0.30, and 0.10. Each still enters alpha 2.5 times per second; only the bout duration changes, from 0.20 s to 0.12 s to 0.04 s. At and above `r = 0.50`, positive-duration alpha bouts disappear. Time share and entry rate are therefore separate variables even in the simplest regular cascade.

The phase counterexample keeps each of two objects airborne for 3/5 of its cycle. Aligned phases give `P_alpha = 3/5` with one 1.20 s bout per 2.00 s period. A half-cycle offset gives `P_alpha = 1/5` with two 0.20 s bouts. Per-object duty is unchanged, while both aggregate time share and entry rate change. A mean dwell value cannot reconstruct the retention path.

The extended phase sweep now reconstructs all three macrostates and the identity-bearing path. At normalized offsets `2/5` and `1/2`, both paths have

`(P_alpha, P_Amphoteron, P_kappa) = (1/5, 4/5, 0)`

and equal-marginal retention correlation `-2/3`. Their temporal structures still differ. Offset `2/5` has one 0.40 s alpha bout and one direct singleton swap; offset `1/2` has two 0.20 s alpha bouts and no direct singleton swap. At offset `9/20`, the two alpha bouts are unequal, with maximum 0.30 s and population variance `1/100 s^2`. Macrostate shares, entry count, bout tail, and identity turnover therefore form distinct measurements.

The general law explains the breakpoint. For two circular retention intervals with duty `d` and shortest phase offset `phi`,

`P_kappa = [d-phi]_+ + [d+phi-1]_+`

and

`P_alpha = [1-d-phi]_+ + [phi-d]_+`, with `P_Amphoteron = 1-P_alpha-P_kappa`.

For `d <= 1/2`, separation up to `phi = d` converts kappa into Amphoteron; beyond that point the three shares plateau while alpha can split into two bouts. For `d >= 1/2`, the dual breakpoint is `phi = 1-d`: alpha disappears and the remaining kappa and Amphoteron shares plateau. Exact enumeration agrees with this law across both duty regimes.

## Mechanics

Selected rows from the fixed-siteswap, fixed-tempo sweep are:

| Dwell ratio | `P_alpha` | Flight (s) | Throw height above release (m) | Peak-force lower bound (N) | Vertical launch-energy throughput (W) |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 0.25 | 0.50 | 1.00 | 1.226 | 7.063 | 3.609 |
| 0.45 | 0.10 | 0.84 | 0.865 | 3.924 | 2.546 |
| 0.50 | 0.00 | 0.80 | 0.785 | 3.532 | 2.310 |
| 0.90 | 0.00 | 0.48 | 0.283 | 3.532 | 0.831 |

The objective relationship is a lower bound: under the stated periodic momentum and force-support assumptions, peak upward body force is at least `Mg / (1 - P_alpha)` and RMS force is at least `Mg / sqrt(1 - P_alpha)`. More total-release time compresses the required support impulse into less contact time. The half-sine columns show one compliant force-pulse realization, not measured force.

This sweep cannot isolate an alpha effect. Reducing dwell at fixed siteswap and tempo also lengthens flight and increases throw height and outgoing launch energy. Conversely, from dwell 0.50 to 0.90, `P_alpha` remains zero while launch throughput falls from 2.310 W to 0.831 W. Thus `P_alpha` is neither a complete mechanical-cost variable nor a fatigue measure.

The matched-flight battery removes one part of that confounding. Holding modeled flight at 0.80 s gives the same 0.7848 m throw height and exact Gaussian drop probability 0.28865 at dwell 0.25, 0.50, and 0.90. Across those rows, `P_alpha` moves from 0.50 to zero, the peak-force lower bound moves from 7.063 N to 3.532 N, and launch-energy throughput moves from 2.887 W to 1.386 W. Beat interval necessarily changes from 0.32 to 0.667 s, so this comparison isolates flight and height but not tempo.

The tempo-by-dwell battery confirms a different separation. At fixed dwell, changing tempo preserves `P_alpha` and the force bounds while changing alpha entry rate, bout duration, flight, height, launch throughput, and modeled landing risk. These are consequences of the ideal timing and ballistic assumptions, not evidence that slower or faster juggling has a general physiological effect.

## Reliability model

Under the declared, uncalibrated Gaussian landing-error model, estimated per-landing drop probability falls from 0.390 at dwell 0.25 (95% Wilson interval 0.383–0.397) to 0.292 at dwell 0.50 (0.286–0.299) and 0.095 at dwell 0.90 (0.091–0.099). The decline continues after `P_alpha` has become zero because the assumed velocity error accumulates over flight time.

This Gaussian model has an exact solution. All eight configured exact clean, correction, and drop probabilities lie inside their Monte Carlo Wilson intervals. The largest absolute drop residual is 0.00365. For a general correction band `cR < |X| <= R`, write `u = sigma/R`. Its probability is `C_c(u) = 2[Phi(1/u)-Phi(c/u)]` and its unique maximum occurs at

`u_* = sqrt((1-c^2)/(2 log(1/c)))`.

For the configured `c = 1/2`, the maximum occurs at `sigma/R = 0.7355342550`, where correction probability is `0.3226745688`. This ratio is not a dwell ratio and does not identify an optimum juggling dwell.

The ablation identifies the source of the modeled dwell gradient. With velocity noise removed, exact drop probability is `1.214e-5` at every tested dwell. With position noise removed, it falls from 0.3816 at dwell 0.25 to 0.0683 at dwell 0.90. The four dimensionless-collapse cases have identical exact probabilities whenever catch radius divided by landing-error sigma is held fixed. Individual 20,000-trial estimates need not be identical, and some correction or clean intervals miss the exact value at their nominal coverage.

These are consequences of the chosen one-dimensional independent Gaussian law, not predictions of human drop rates. The exact benchmark makes the present simulation auditable; a richer correlated or multidimensional model would be required before Monte Carlo adds substantive physical behavior. Gaussian probability projections remain analysis-only and are excluded from the article until the landing-error and correction geometry is calibrated independently.

## Recovery and Transition Value

The numerical fractions in this section are internal diagnostics. They are excluded from the article pending independent conservative and optimistic projection bounds.

The common two-second controlled-predecessor approximation preserves the ordering expected from the declared control sets:

| Regime | Viable, base | Viable, refined | Capture basin, base | Capture basin, refined | Recovery from outside, base | Recovery from outside, refined |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Direct | 0.858 | 0.884 | 0.858 | 0.884 | 0.830 | 0.863 |
| Freewheel | 0.693 | 0.698 | 0.173 | 0.173 | 0.146 | 0.152 |
| Impossible | 0.412 | 0.389 | 0.028 | 0.020 | 0.000 | 0.000 |

The capture basin includes states already in the target. “Recovery from outside” removes them, matching the article's stricter requirement that recovery begin outside the target and arrive later. Under the declared impossible-control grid, no outside state reaches the target while satisfying the approximation, although a larger viability set survives the two-second horizon.

The qualitative authority ordering survives the declared base and coupled-refined runs. Independent refinement, however, exposes strong numerical sensitivity. For freewheel recovery from outside, the base fraction is 0.1455, state-grid-only refinement gives 0.5111, time-step-only refinement gives 0.1053, and coupled refinement gives 0.1523. The apparent base-to-coupled agreement conceals opposing discretization effects.

The horizon diagnostic reaches a nearest-grid fixed point by one second for freewheel and impossible control and by two seconds for direct control. That plateau is not an infinite-horizon viability proof. Within-step zero-control latency reduces the direct recovery fraction from 0.8297 with no delay to zero when delay occupies the full 0.05 s decision step; freewheel recovery likewise falls from 0.1455 to zero. This is a scheduled within-step delay, not a state-augmented actuator model. One, four, and eight constraint samples happen to give the same freewheel rows at the base grid, but crossings between samples remain possible.

The authority ordering is suitable as a qualitative model finding. Exact basin percentages, latency response, and recovery thresholds are not ready for an article claim until spatial projection, integration, and between-sample constraint errors are enclosed independently. Nearest-grid sensitivity is not an inner or outer viability bound.

## Fatigue remains unmeasured

There are no human observations, so `human_analysis.csv` correctly records `empirical unknown` and `not_run_no_human_observations`. The current run establishes contact-load concentration as a rational candidate mechanism, but no correlation with oxygen demand, perceived exertion, heart rate, or fatigue.

The exact phase and matched-flight controls are now available as numerical designs. The next physical comparison should implement the phase manipulation while preserving each object's trajectory, mass, flight time, and dwell, then measure whether aggregate `p_alpha`, `nu_alpha_hz`, bout tails, or identity turnover predicts contact load. A within-person experiment can later regress physiological or perceived-effort outcomes on those variables while recording object count and mass, height, beat frequency, dwell, phase, catch compliance, and correction rate.
