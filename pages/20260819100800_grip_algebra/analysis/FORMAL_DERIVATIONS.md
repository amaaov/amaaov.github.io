# Formal derivations for Grip Algebra

This note states the assumptions and calculus behind the formal measurement battery. Ruby and Julia implement the laws independently. Their agreement checks the implementations of the declared models; it does not show that any stochastic null, timing idealization, or landing-error model describes a performer.

Write \([x]_+=\max(x,0)\). Fractions are exact unless a section explicitly introduces a floating-point Gaussian calculation.

## Two-object circular phase law

Normalize one period to length one. Each of two labelled objects is retained on one contiguous circular interval of length \(d\), where \(0<d<1\). Put the first interval at phase zero and the second at the shortest circular offset \(\phi\in[0,1/2]\). Event endpoints have zero duration and do not affect the shares.

The overlap of the two retained intervals is kappa, the uncovered part of the circle is alpha, and the symmetric difference is Amphoteron. Direct interval geometry gives

\[
P_\kappa=[d-\phi]_+ + [d+\phi-1]_+,
\]

\[
P_\alpha=[1-d-\phi]_+ + [\phi-d]_+,
\qquad
P_{\mathrm{Amph}}=1-P_\alpha-P_\kappa.
\]

For short retention duty, \(0<d\le 1/2\), this becomes

\[
(P_\alpha,P_{\mathrm{Amph}},P_\kappa)=
\begin{cases}
(1-d-\phi,\,2\phi,\,d-\phi), & 0\le\phi\le d,\\
(1-2d,\,2d,\,0), & d\le\phi\le1/2.
\end{cases}
\]

For long retention duty, \(1/2\le d<1\), the dual law is

\[
(P_\alpha,P_{\mathrm{Amph}},P_\kappa)=
\begin{cases}
(1-d-\phi,\,2\phi,\,d-\phi), & 0\le\phi\le1-d,\\
(0,\,2-2d,\,2d-1), & 1-d\le\phi\le1/2.
\end{cases}
\]

The positive alpha-bout fractions are precisely the positive members of

\[
\{\phi-d,\ 1-d-\phi\}.
\]

This retains information that the three shares discard. In the configured slice \(d=2/5\), the shares reach \((1/5,4/5,0)\) at \(\phi=2/5\) and then remain fixed. At that breakpoint alpha has one bout of length \(1/5\); at \(\phi=1/2\) it has two bouts of length \(1/10\). Equal macrostate shares therefore do not determine fragmentation.

The executable law accepts the full domain \(0<d<1\). Tests compare it with independent circular-interval enumeration over duties \(1/20,\ldots,19/20\) and offsets \(0,1/40,\ldots,1/2\). The published formal-result slice retains \(d=2/5\) so it can be compared directly with the existing phase sweep.

## Bernoulli stationary snapshot

At a fixed sampled time, let the retention indicators be mutually independent Bernoulli variables with possibly unequal probabilities

\[
\Pr(B_i=1)=p_i.
\]

Cross-object independence at that time gives

\[
P_\alpha=\prod_{i=1}^n(1-p_i),\qquad
P_\kappa=\prod_{i=1}^n p_i,
\]

\[
P_{\mathrm{Amph}}=1-\prod_{i=1}^n(1-p_i)-\prod_{i=1}^n p_i,
\qquad
E[q]=\sum_{i=1}^n p_i.
\]

For the identically distributed case \(p_i=p\),

\[
P_{\mathrm{Amph}}(p)=1-p^n-(1-p)^n.
\]

For \(n\ge2\),

\[
P_{\mathrm{Amph}}'(p)=n\left[(1-p)^{n-1}-p^{n-1}\right]
\]

vanishes only at \(p=1/2\), while

\[
P_{\mathrm{Amph}}''(p)=-n(n-1)
\left[(1-p)^{n-2}+p^{n-2}\right]<0
\]

through the interior. The unique maximum is therefore

\[
P_{\mathrm{Amph}}^{\max}=1-2^{1-n}.
\]

This is the exact condition under which the uniform combinatorial fraction of mixed bit vectors becomes a probability at a sampled time. The formula itself requires no independence across different times.

Stationarity makes the snapshot probability independent of the sampling time and makes it the expected time share. Identifying it with an observed long-run time share requires an ergodic assumption or another justified law of large numbers. Entry rates, bout lengths, and first-passage times remain unidentified until a temporal transition law is supplied. The Bernoulli result must therefore be described as a stationary snapshot null, not as a complete process model.

## Uniform one-bit first passage

Now declare a temporal null process. At each discrete event, one of \(n\) bits is selected uniformly and flipped. If \(q\) bits are retained, the occupancy decreases with probability \(q/n\) and increases with probability \((n-q)/n\).

Let \(e_q\) be the expected number of further flips required to reach either homogeneous boundary, starting at occupancy \(q\). Then

\[
e_0=e_n=0,
\]

\[
e_q=1+\frac qn e_{q-1}+\frac{n-q}{n}e_{q+1},
\qquad 1\le q\le n-1.
\]

Writing \(\Delta_q=e_q-e_{q-1}\) reduces the system to

\[
(n-q)\Delta_{q+1}-q\Delta_q=-n,
\qquad
\sum_{q=1}^{n}\Delta_q=0.
\]

Iterating the difference recurrence and imposing the boundary sum gives

\[
\Delta_q=
\frac{2^{n-1}-\sum_{w=0}^{q-1}\binom nw}
{\binom{n-1}{q-1}},
\qquad 1\le q\le n.
\]

Summing the differences from one to \(q\) gives the exact closed form

\[
e_q=\sum_{j=0}^{q-1}
\frac{2^{n-1}-\sum_{w=0}^{j}\binom nw}
{\binom{n-1}{j}},
\qquad 0\le q\le n,
\]

where the sum is empty when \(q=0\). It also makes the symmetry \(e_q=e_{n-q}\) explicit through the recurrence and boundary conditions.

The excursion count has an important off-by-one distinction. A flip from a homogeneous boundary necessarily enters occupancy one or \(n-1\). Starting at that first mixed state,

\[
e_1=2^{n-1}-1
\]

is both the expected number of further flips to a boundary and the expected number of mixed-state visits in the boundary-to-boundary excursion. Counting from one homogeneous-boundary arrival through the compulsory entrance flip to the next homogeneous-boundary arrival gives

\[
1+e_1=2^{n-1}
\]

flips. The smaller quantity must not be called the full boundary-return time.

For a microstate drawn uniformly from the mixed region, the probability that its next flip reaches a homogeneous boundary is

\[
\frac{2}{2^n-2}=\frac{1}{2^{n-1}-1}.
\]

These expectations belong only to the uniform one-bit event law. Simultaneous packets, object-specific flip rates, siteswap constraints, or state-dependent selection produce different recurrences.

## Gaussian correction-band maximum

Let the one-dimensional landing error satisfy \(X\sim N(0,\sigma^2)\). Let \(R>0\) be a declared catch radius and let the illustrative correction band be

\[
cR<|X|\le R,
\qquad 0<c<1.
\]

With \(u=\sigma/R\), standard normal distribution function \(\Phi\), and density \(\phi\), the correction probability is

\[
C_c(u)=2\left[\Phi(1/u)-\Phi(c/u)\right].
\]

Its derivative is

\[
C_c'(u)=\frac{2}{u^2}
\left[c\phi(c/u)-\phi(1/u)\right].
\]

The probability tends to zero as \(u\to0\) and as \(u\to\infty\). To locate the derivative's zero, observe that

\[
\log\frac{c\phi(c/u)}{\phi(1/u)}
=\log c+\frac{1-c^2}{2u^2}.
\]

The right-hand side decreases strictly from positive infinity to \(\log c<0\), proving that the derivative changes sign exactly once. Therefore the global maximum occurs at

\[
u_*=\sqrt{\frac{1-c^2}{2\log(1/c)}}.
\]

For the configured half-radius threshold, \(c=1/2\),

\[
\frac{\sigma_*}{R}=\sqrt{\frac{3}{8\log2}}
\approx0.7355342550,
\]

\[
C_{1/2}(u_*)\approx0.3226745688.
\]

This maximum concerns a deliberately uncalibrated geometric band. The ratio \(\sigma/R\) is not a dwell ratio, and its optimum is not an optimum juggling dwell. The Gaussian calculation remains analysis-only unless landing-error geometry and correction behavior are calibrated independently.

## Executable measurement contract

Ruby and Julia each construct the same 286-row formal battery:

- 147 phase measurements: 21 offsets times seven metrics;
- 64 Bernoulli measurements: fifteen shared-probability cases and one heterogeneous case, each with four metrics;
- 66 first-passage measurements: every interior occupancy for \(n=2,\ldots,12\);
- 9 Gaussian measurements: three inner-radius fractions times three metrics.

The first 277 rows use rational arithmetic and carry canonical fraction strings. Their cross-language comparison is exact. The nine Gaussian rows are compared numerically with tolerance \(10^{-10}\). `formal_derivation_crosscheck.csv` keys every comparison by derivation, case, and metric; missing, duplicate, or altered cases cannot silently count as agreement.

The three generated artifacts are:

- `results/formal_derivations_ruby.csv`;
- `results/formal_derivations_julia.csv`;
- `results/formal_derivation_crosscheck.csv`.

An integrated run is acceptable only when both language outputs contain 286 rows and all 286 cross-check rows report `match`. This is an implementation criterion, not empirical validation.

The integrated run on 2026-08-23 met that criterion. `ruby run_all.rb` completed 36 Ruby tests with 2,400 assertions and 21 Julia test sets with 434 passing checks, regenerated both 286-row formal outputs, and reported 286 matching formal cross-check rows. The Julia Gaussian test also compared the half-radius analytic maximum with a 200,000-point numerical grid and located it within one grid step.

## Publication boundary

The phase, Bernoulli, and one-bit laws can support later article improvements because they sharpen distinctions already present in Grip Algebra. They should enter the article only with their assumptions and with the Bernoulli snapshot/process distinction intact.

The Gaussian probabilities remain in this analysis companion because the landing-error model is uncalibrated. Finite-grid viability and capture percentages also remain analysis-only. The current nearest-grid projection can both invent and omit admissible transitions; publication of numerical viability percentages requires independently computed conservative and optimistic bounds that include projection, integration, and constraint-crossing error.
