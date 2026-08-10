# Shared Bench

**Published:** 23 June 2026, Helsinki
**Modified:** 10 August 2026
**Author:** amaaov
**Language:** English
**Manifesto:** [Collaborative Concurrent Extreme](20260608120000_manifesto_collaborative_concurrent_extreme.html)
**HTML:** [20260623140000_shared_bench_benchmark_en.html](20260623140000_shared_bench_benchmark_en.html)
**Licence:** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — credit Andrei Makarov / amaaov

---

Verified delivery, customer cost, and what concurrent workshop actually meters

The hypothesis on the whiteboard is falsifiable: the same one the [Collaborative Concurrent Extreme manifesto](20260608120000_manifesto_collaborative_concurrent_extreme.html) states as an exact formula. Can a shared workshop with visible concurrent participation produce verified results faster, with better quality and better recovery, without exploding cost and conflict? The benchmark’s candidate method is **Collaborative Concurrent Extreme (CCE)**: a visible shared bench with WIP-limited escalation from solo through pair, swarm, and set-based probes. The other nine patterns in the live viz are experimental controls and tail stressors. We ran the Shared Bench Delivery Benchmark across those contrasts, four usage heats, and a market×investment×marketing climate sweep (thirty-six seeded runs, twenty-one observed climate cells after marketing drift).

Live ecology

## Watch the product organism breathe

The grid is a small IT product — a tycoon board in the spirit of nineties programmer-life sims, only the engine is maths instead of sprites. Green is shipped feature, copper is task backlog, red is tech debt, teal filaments are collaboration hyphae. Default pattern is **CCE** — the [manifesto](20260608120000_manifesto_collaborative_concurrent_extreme.html) candidate — escalating solo → pair → swarm → set-based by patch; the other selects are controls. The customer watches a monthly red line; the team runs a prediction tool whose IQ rises with experience, hyphae, and strategic spend — publishing month-end forecasts for consumers, leads, bench burn, and market direction that get scored when the month closes.

Δdebt_unplanned ↑ forecast miss · neglect · consumers · scope creep · Δdebt_paid ↓ dev work · strategic · debt_weight → velocity ÷ · lead time = WIP ÷ throughput († = non-stationary) · CFR/MTTR = DORA-inspired proxies

I

## What the meter measures

Let N be team size (here six), P_dev and P_consult the hourly customer rates per worker class (by default €120 and €168), and q the minimum focused participation quantum of fifteen minutes. If you materially touched the task, you bill at least q even when the touch was theatrical; eight people hovering for five minutes each therefore incurs eight q units, a floor of €240 before any real work is counted. That rule exists because collaboration theater looks cheap until someone puts a rate on the wall.

For each task j we track initial declared scope S₀, discovered scope change ΔS over time, and verified time Tᵥ from first prompt to accepted result: implemented, tests pass, reviewed, integrated. Human effort H sums billed hours with the q rule. Customer bench cost C_bench equals Σ hoursᵢ × rateᵢ per agent. The customer also carries a monthly red line R — a budget ceiling reviewed every twenty-eight ticks. Total internal cost adds operative burn O and strategic spend S; the customer mood meter reacts to bench burn against R while OPEX stays off that dial. Verified velocity is accepted scope divided by calendar time.

C_bench = Σ max(q, hᵢⱼ) × rateᵢ · month burn vs R → customer mood · C_total = C_bench + OPEX + S_strategic

Little's Law still sits in the corner: WIP equals throughput times lead time. In the ecology model, WIP is visible as task backlog mass on the grid. Throughput is feature growth per tick, multiplied by team experience and morale when collaboration fruits, divided by debt weight when the customer did not plan for rot. When forecast miss climbs, the market turns volatile, or incident recovery is active, the live banner warns that lead time is illustrative only — the stationarity assumption broke. Operative costs run whether or not the bench touches work; strategic spend is the only passive debt relief — and it is thin unless investment climate allows it. When usage ρ crosses 0.9, the debt-spread rule turns calm rot into colony bloom. Forecast miss deposits unplanned debt clusters. Pair and work-stealing patterns that pay debt down raise velocity again; patterns that ignore debt accumulate weight for every future tick.

Ia

## The manifesto pattern — Collaborative Concurrent Extreme

The [manifesto](20260608120000_manifesto_collaborative_concurrent_extreme.html) names *collaborative concurrent extreme* as an exact formula. The workshop it describes is the shared bench where nobody holds everything, unfinished material stays visible, and the team keeps patterns alive through timing, attention, awareness, recovery, and handoff — distinct from ticket-factory concurrency and from stacking everybody on every task. The simulation encodes that as one primary pattern (**CCE**) and nine controls to falsify it.

Each tick, each forager reads local patch signals: uncertainty (feedback, task mass, hyphae gap, forecast miss) and conflict risk (debt, overlap, recovery). The routing rule escalates — manifesto §12 in benchmark form:

low uncertainty + low conflict → solo or least-loaded
uneven load + visible trails → work-stealing
medium uncertainty or knowledge-transfer gap → pair
blocker / incident / high debt hotspot → swarm (timeboxed in the room)
high uncertainty + heavy task → set-based (2–4 parallel probes)
everybody × all tasks → tail control only (outside CCE)

CCE never selects the everybody stack. That pattern exists in the benchmark as a rare stress test — Brooks channels, invoice theater — to show what happens when “concurrent” collapses into undifferentiated touch. The manifesto wager (H6–H7 in the substrate) is that visible traces and escalation beat that collapse when handoff stays readable.

CCE = escalation · controls = solo · round-robin · least-loaded · work-stealing · pair · swarm · set-based · nobody · everybody

Ib

## Healthy product — six lenses, one operating band

The benchmark never shipped a single score called “healthy.” That was deliberate: ten patterns and four usage heats produce different winners on feature, debt paid, morale, and invoice. But a workshop still needs a falsifiable definition of *healthy product*: whether the colony is in an operating band the customer can sustain. The live meter above compresses six independent lenses into one index; each lane can be read alone when the composite disagrees with your intuition.

**Service** is customer trust in money terms: mood at or above pleased (0.58), monthly bench burn under ~78% of the red line, zero months over budget. A delighted CFO with rotting feature tissue is not healthy on this lane; a guarded mood with honest burn still is.

**Ecology** is product tissue quality: Bench-Q (feature mass relative to rot), global debt weight below ~0.55, and either paid-down rot or weight still contained. Shipped feature without debt payment can look green on the grid while weight drags every future tick — ecology reads that drag.

**Flow** is delivery throughput relative to backlog: feature velocity on the grid scale (not queue theory units), WIP drain time, and graduated stationarity when forecast miss rises — the Little's Law banner still marks when lead time is non-stationary, but moderate miss no longer zeros the lane.

**Team** is bounded concurrency: patterns that cap billable overlap (solo, round-robin, least-loaded, work-stealing, pair, swarm-on-hotspots, set-based probes, CCE) versus tail patterns that stack quanta (everybody) or zero them (nobody). Psych stress below Brooks saturation, morale and experience above floor, hyphae present enough for handoff.

**Reliability** is change safety in DORA-inspired proxies: synthetic change-failure rate below ~12%, mean time to recover below ~12 ticks when incidents fire, no active recovery window. High feature with frequent surprises is a stressed reliability lane even when morale stays high.

**Learning** is forecast integrity: prediction intelligence and low month-close error, beating the outside-view median bench burn when scored. A team that ships while lying on the forecast slide fails learning even inside the red line.

operating band · usage 0.55–0.92 · bounded pattern · tail = nobody · everybody · usage ≥ 1.05 · volatile miss

**Healthy (composite)**: index ≥ 0.64 · service ≥ 0.5 · ecology ≥ 0.38 · flow ≥ 0.32 · not tail

**Guarded**: index 0.52–0.64 · one lane weak · still teachable

**Stressed / critical**: index < 0.55 · debt weight or psych dominates

**Tail overlay**: nobody · everybody · usage overload · volatile + high miss — rare stress outside default routing

**Contrast-ready**: hyphae + set-based or high experience — joint pattern read for next move

**Weights**: service 22% · ecology 20% · team 18% · flow 16% · reliability 12% · learning 12%

Multiple solutions stay valuable: pair may top score while least-loaded tops debt paid while work-stealing and CCE top experience. Health is the joint contrast — which lanes are green together. Run two patterns side by side in the live viz; when service and ecology diverge from team and flow, you have a routing decision.

II

## The organism

An average product with consultants on it behaves less like a ticket line and more like an ant nest crossed with mycelium. Tasks are not assigned from above alone; they grow where feedback meets collaboration trails. A standup, a review thread, a customer reply, a production alert: each deposits signal. When signal touches hyphae, the hyphae fruit into tasks. Developers forage along those trails, consume task mass, and convert it into feature tissue. The conversion is lossy. Work produces more work: scope creep spawns neighboring tasks like budding hyphae. Consultants forage slower but leave more spores.

Consumers enter from the edges as usage grows. They seek feature density, eat it, and excrete debt the customer never forecast — unplanned load from success without investment. Debt accrues when nobody works the bench, when forecast misses, when scope creep buds into rot instead of tasks, when tight runway skips platform spend. It drops only when developers deliberately pay it down or strategic in-house investment funds relief; shipped feature alone does not erase it. Debt spreads under usage heat like mold, and it weighs on every forager: global debt mass drags velocity even on clean cells.

We encoded this in Elixir on a 40×28 grid, 280 ticks per run, six developers, two consultants, consumer count scaling with usage and market. Each run samples market, investment, and marketing; fourteen event types can fire when forecasts miss. **Collaborative Concurrent Extreme** is the manifesto candidate — per-patch escalation through solo, least-loaded, pair, swarm, and set-based modes. The other nine patterns are fixed metabolisms for contrast: solo ignores trails; round-robin rotates without reading hyphae load; least-loaded chases local minima; work-stealing follows hyphae-task gradients; pair bonds deposit thicker filaments on complex cells; swarm converges on debt hotspots; set-based runs parallel probes; everybody stacks six billable quanta per touch (tail only); nobody leaves the bench cold. The Elixir module is `shared_bench_simulation.exs`; it writes `simulation_results.json` from 160 pattern×usage runs plus a thirty-six-run climate sweep that collapses to twenty-one observed cells.

IIb

## Pattern atlas at usage 0.7

At calm usage the leaderboard is not a single winner repeated ten ways. **Pair** tops score at **0.563** with psych **0.40**. **Least-loaded** pays the most debt down (**€1,746**) while scoring **0.489**. CCE scores **0.533** with psych **0.51**. Round-robin posts morale **0.42** and debt mass **23k** with zero paid.

Set-based exploration bills heavy bench-C (**€133k**) with debt weight still climbing — parallel probes scatter unplanned rot. Pair pays **€1,697** of rot on complex cells. Nobody accrues unplanned debt to **70k** mass with **€0** payment while total cost on OPEX alone reaches **€184k**.

**Score leader**: pair · 0.563 · feat 6.0k · paid €1,697

**Debt paid leader**: least_loaded · €1,746 paid · weight on 21.6k mass

**CCE (manifesto)**: score 0.533 · paid €1,159 · psych 0.51

**Round-robin**: morale 0.42 · debt 23k · rotation without payment

**Set-based**: parallel tax · bench €133k · paid €0

**Everybody**: psych 1.12 · bench €552k · Brooks channels

ten patterns · same grid · different filament/debt/morale signatures

IIc

## Tech debt as unplanned weight

Tech debt in the model is not a static red stain. It accrues when the customer did not forecast load, did not invest to resolve rot, and developers did not work the bench — and it drops only when someone deliberately pays it down or strategic in-house spend funds thin relief. Shipped feature alone no longer erases debt; that was the old lie that kept velocity charts cheerful while the grid rotted underneath.

Accrual channels: consumers eating unplanned success, forecast-miss clusters, scope creep budding into debt instead of tasks, ambient neglect multiplied by pattern (nobody ×2.2, solo ×1.35), tight runway ×1.25. Spread kicks in when usage exceeds 0.9 and three neighbors rot. Relief channels: least-loaded pays down **€1,746** per run at usage 0.7; pair **€1,697**; work-stealing **€1,435**; CCE **€1,159**; swarm **€554**; strategic platform spend spreads micro-relief every tick. Nobody accrues debt mass **70k**, pays **€0** — the customer meter reads zero while weight crushes every future tick.

Debt weight is global: total rot mass drags yield on every cell, not only where the infection shows. At usage 0.7, least-loaded carries weight on **21.6k** mass while paying the most debt; CCE sits near **18.4k** with substantial payment. The colony can look busy on feature while weight tells the truth about tomorrow's velocity.

**Debt paid leader**: least_loaded · €1,746 paid · 21.6k mass

**Neglect colony**: nobody · €0 paid · 70k mass · €184k total

**Routing with payment**: cce · €1,159 paid · escalates and still pays rot

**Spread rule**: usage ≥ 0.9 · three debt neighbors · bloom accelerates

III

## When usage is still calm

At usage 0.7, solo serial totals **€228k** with psych **0.12** and experience **0.93** — one forager, debt accruing while solo pays nothing down. Work-stealing totals **€247k** with experience **0.96** and **€1,435** debt paid. Pair pays **€1,697** of unplanned debt and leads score. Least-loaded pays the most (**€1,746**). Everybody bills **€552k** bench-C with psych **1.12** — Brooks coordination theater.

Nobody remains the cruel control: **€0 bench-C**, debt mass **70k**, **€184k** total on OPEX alone. Pair leads score at **0.563**; CCE follows at **0.533**. The variation is which pattern matches the patch and whether anyone invests in the rot the customer never forecast.

**Score leader**: pair · 0.563 · debt paid €1,697

**Experience leaders**: cce / work_stealing · exp 0.96 · trails with payment

**Debt paid leader**: least_loaded · €1,746 paid · fires have a bill

**Neglect control**: nobody · €0 bench · €184k total · debt 70k

IV

## Usage heat and debt bloom

Usage is not one dial with one story. Work-stealing debt mass runs **~21k–23k** across usage levels while debt weight stays above **0.55**; morale peaks at 0.9 then crashes at overload. CCE keeps debt near **23k** with modest paid amounts — routing contains spread better than ignoring rot. At usage 0.9, everybody pins debt at the grid ceiling while swarm still pays down more than work-stealing.

Under the spread rule at usage ≥ 0.9, unplanned accrual accelerates when three neighbors rot. Set-based and round-robin accumulate the highest masses at overload because probes scatter infection. Swarm clusters on hotspots: high weight, but also the highest debt paid. Lifecycle frames show debt and feature moving in opposite phases — tick 100 feature 5163 debt 8575; tick 230 feature 3311 debt 14335 — rot and delivery trade places across the run, not only at the end.

**Debt weight band**: 0.53–0.65 at usage 0.7 · global velocity drag

**Swarm under heat**: €917 paid at 0.7 · pays rot · still heavy

**Lifecycle dip**: t=230 · feat 3311 · debt 14335 · market bear

**Spread threshold**: usage ≥ 0.9 · three neighbors · accrual ×1.8

V

## Consultants, alignment, psychology

Two consultants walk the same grid as six developers. They consume tasks at 0.65× efficiency but spawn tasks at 0.35× probability versus 0.12× for developers. They bill at their own hourly rate — default €168 versus €120 for devs — as an explicit line item on shared hours. Morale and experience are per-agent state: collaboration on hyphae-rich cells raises both; debt rot and idle bench lower them. Work yield scales with (0.65 + 0.35×experience)×(0.75 + 0.25×morale), so a team that fruits well gets faster and happier over generations, measurably by tick 200.

Operative costs dominate the total meter when customer billable stays low: nobody still burns OPEX while developers idle. Strategic spend in loose capital climates funds in-house platform bets that accelerate experience; in bull markets the world skill benchmark rises and under-investment widens the skill gap, hurting lead conversion. Training cuts and hiring freezes hit morale directly. Acquisition interest lifts it. These are meters for what an average product room feels like when finance sees only bench-C and misses the people and burn underneath.

hyphae + pairing → experience ↑ morale ↑ → yield ↑ · skill gap vs world → conversion ↓ · OPEX runs always

Va

## Customer tycoon meter — red line and mood

Think of the nineties shareware shelf: Programmer Life, city builders, monopoly boards where you watched cash counters tick while the machine you built either printed money or ate it. This benchmark is the same genre with honest arithmetic. The customer is the player staring at a monthly red line. Developers and consultants bill separate hourly rates. Every twenty-eight ticks the sim closes a month: if bench burn crossed the red line, mood drops; if delivery stayed strong under budget, mood rises. Debt weight, forecast miss, and everybody-pattern invoice theater all feed the same mood meter — frustrated, guarded, pleased, delighted.

Mood is not decoration. A pleased customer converts pipeline leads faster; a frustrated one throttles conversion even when marketing keeps depositing signal. Loss aversion bites harder than symmetric gain — overspend on the red line hurts trust more than underspend repairs it (Kahneman & Tversky; see [references.bib](20260623140000_shared_bench_benchmark/references.bib)). Try the live presets: Tight CFO sets a low red line and higher dev rates; Happy patron stretches budget and discounts rates — with a **pleased floor (0.58)** while monthly bench burn stays under ~78% of red line, so a generous CFO stays pleased even after hundreds of ticks if the invoice stays small. Consultant shock keeps dev pricing flat but doubles consultant hourly — the month bar turns red fast if swarm or pair pulls consultants into hot cells.

The Elixir sweep crosses three red lines (€28k, €45k, €72k) with three dev rates (€95, €120, €150) at **CCE** and usage 0.7. Its delighted corner, a **€120/h dev rate with a €72k ceiling**, reaches mood **0.877** with peak month burn of **€21.0k**; the frustrated floor pairs **€150/h with a €45k red line** and reaches mood **0.326**, because debt weight and forecast miss erode trust faster than a generous ceiling repairs it. Mid rate plus mid ceiling (€120 dev, €45k red) lands at **0.369** frustrated with peak month **€20.8k**. Pattern choice still matters in the live viz: everybody can please the room on morale while the red-line bar pulses over budget.

month_close: burn/R → mood Δ · debt_weight · forecast_miss · everybody theater · mood → lead conversion

**Delighted corner**: dev €120 · red €72k · mood 0.877 · peak month €21.0k

**Frustrated floor**: dev €150 · red €45k · mood 0.326 · debt drag with invoice pressure

**Try in live viz**: Tight CFO vs Happy patron vs Consultant shock — watch red line bar

**Mood bands**: <0.42 frustrated · 0.58+ pleased · 0.72+ delighted

Vc

## Market prediction by intelligence

The ecology is also a prediction tool. Every tick the team publishes a rolling month-end forecast: consumer count, pipeline leads, bench burn, market direction. Forecast quality blends a naive extrapolation with a signal model that reads marketing, conversion, usage, and pattern stress — and an **outside-view baseline**, the rolling three-month median bench burn (reference-class forecasting). Prediction intelligence is 65% signal-model skill plus 35% improvement over that outside-view median at month close.

Low intelligence sticks to momentum and noise; high intelligence leans on observable drivers. At each month close the sim scores prediction error against actuals. Bad predictions raise unforecasted-event chance alongside the static customer plan miss. Customer mood also punishes prediction error — a CFO who was told calm burn and got swarm theater loses trust even inside the red line. Composite score now rewards low average prediction error: a team that reads its own colony beats a team that only ships feature while lying on the forecast slide.

In the live viz the teal chart tracks intelligence (upper half) and scored error (lower half) across month closes; the readout strip shows predicted versus live consumers, leads, bench €, and market call. At usage 0.7 the sweep ranks **everybody** highest on IQ (**0.377**) even with high scored month error (**1.34**) — collaboration theater still reads the room while bankrupting the red line. **CCE** posts the lowest scored error (**0.216**) among mid-IQ patterns; round-robin sits near IQ **0.317** with team miss **1.93**. Pair and work-stealing sit in the middle; nobody flatlines intelligence because no hyphae means no collective sensor.

IQ = 0.65×signal + 0.35×beat outside-view · pred = naive×(1−IQ) + signal×IQ · month_close → error → events · SPACE tags on live metrics

**Intelligence feeds**: experience · hyphae · in-house strategic · collaboration

**Predicts each month**: consumers · leads · bench burn · market

**Bad pred →**: surprise events ↑ · customer mood ↓

**Live chart**: teal IQ · red error · bars act vs pred consumers

Vb

## Climate lattice

Market, investment, and marketing begin as a thirty-six-run climate sweep on **CCE** at usage 0.7; marketing can drift during the run, so the checked-in batch reports **twenty-one** observed climate cells. The highest score (**0.589**) lands on **sideways market, loose capital, marketing 0.8** — bench-C €94k, forecast miss 1.24, eight surprise events. The lowest score in this batch (**0.461**) is **bear market, loose capital, marketing ~0.1**: bench-C €81k, nine events. Bear plus neutral runway with quiet marketing still scores **0.532** with bench-C €88k.

Bear plus loose capital with aggressive marketing stacks surprise events while bull plus tight runway with marketing 0.2 still bills bench-C in the mid-seventies with elevated debt mass. Volatile market adds drift mid-run; lifecycle samples show debt climbing past feature by tick 230. Climate is not backdrop. It changes conversion, wages, strategic pressure, and which unforecasted events fire when the pipeline chart lied.

**Climate score peak**: sideways · loose · mkt 0.8 · score 0.589 · miss 1.24

**Climate score floor**: bear · loose · mkt ~0.1 · score 0.461 · events 9

**Quiet burn**: bear · neutral · mkt 0 · bench €88k · score 0.532

bear + quiet marketing → score ↑ · bull + loose → skill gap ↑ strategic chase ↑

VI

## Extreme colonies

The simulation extremes at usage 0.7 read like parables, each a different failure mode. **Nobody**: €184k total on €0 bench, morale 0.10, hyphae 0, debt 70k. **Everybody**: €724k total, bench €552k, psych 1.12 — filament without handoff. **Set-based**: €320k total, bench €133k — parallel tax. **Swarm**: debt 16.8k calm, paid €554 — fires have a bill. **Round-robin**: debt 23k, mor 0.42 — rotation feels fair, meter disagrees.

At usage 1.15 the debt leaders diverge: set-based 110743, round-robin 110677, least-loaded 106467, work-stealing 82469. Same spread rule, different foraging geometry. Security fog peaks when debt is high and features are consumed faster than verified. Performance collapse tracks local debt threshold on foragers. The bad outcomes are coupled and pattern-specific. They arrive as colonies with different shapes.

VII

## Routing as ecology

CCE reads local uncertainty and conflict each tick, then escalates — the manifesto routing rule as a living scheduler. High debt or active recovery → swarm movement. Uncertainty ≥ 4 with heavy task → set-based probes. Medium uncertainty or thin hyphae on dense task → pair. Routine patch with uneven load → least-loaded; uneven load with visible trails → work-stealing. Calm low-risk cells → solo serial. It scores **0.533** at usage 0.7 with psych **0.51** in the current batch — against swarm psych **0.66** and everybody **1.12** as contrasts. Total **€291k** sits near round-robin **€265k** and below set-based **€320k** on the same grid. Pair tops score (**0.563**) as a control when patches mix debt and task — a useful joint read beside escalation.

# CCE escalation (manifesto §12 → ecology)
uncertainty, conflict ← patch feedback · task · hyphae · debt · recovery
blocker / debt hotspot → swarm
uncertainty ≥ 4 → set-based (2–4 probes)
uncertainty ≥ 2.8 or handoff gap → pair
uneven load → least-loaded or work-stealing
calm routine → solo
everybody × task → never in CCE — tail control only

Timeboxes from the earlier benchmark still apply in the room: pair for thirty to ninety minutes, swarm for fifteen to sixty, set-based only when ambiguity earns parallel exploration. The grid shows why. Left unchecked, hyphae fill the board whether or not feature follows.

VIII

## Running the colony

Run the Elixir ecology: `elixir shared_bench_simulation.exs`. It implements the [manifesto](20260608120000_manifesto_collaborative_concurrent_extreme.html) escalation rule as pattern `:cce` and nine fixed controls. Expect several minutes for 160 runs (10 patterns × 4 usage levels × 4 repetitions) plus a thirty-six-run climate sweep (twenty-one observed cells after marketing drift). Output includes per-pattern aggregates with operative and strategic splits, experience and morale averages, lifecycle samples with market phase per tick, consultant-effect rows at usage 0.9, and climate leaderboard. The browser grid exposes the same dimensions: pattern, usage, market, investment, marketing — combinatorial play across one continuous demo surface.

Try the variations the article cannot exhaust: set-based at usage 1.15 for debt bloom; bear market with quiet marketing for score; everybody with aggressive marketing for psych theater; nobody to watch OPEX run alone; pair versus work-stealing for experience-versus-morale tradeoffs. Neither simulation claims predictive precision for your sprint. They make the couplings visible across patterns, climates, and cost layers so the workshop choice is falsifiable before the quarter ends.

Research mapping (which mechanisms align with Little's Law, DORA, technical-debt literature, pair-programming meta-analyses, Brooks coordination, planning fallacy, SPACE, and stigmergy) plus suggested fixes: [RESEARCH_REFERENCES.md](20260623140000_shared_bench_benchmark/RESEARCH_REFERENCES.md) · BibTeX: [references.bib](20260623140000_shared_bench_benchmark/references.bib).

IX

## What stayed on the bench

I turn off the projector. The grid on screen still pulses: teal where we met, red where they ate, copper where the backlog fruits again. The numbers are not a verdict on whether people should care about each other. They are a meter for how caring metabolizes: collaboration laying trails, trails spawning tasks, tasks becoming feature and more tasks, consumers turning success into debt as usage climbs.

The [manifesto](20260608120000_manifesto_collaborative_concurrent_extreme.html) wager survives only if the hyphae are real: partial work readable enough that another forager can continue cold, building experience and morale that compound. Otherwise the colony fills with filament and rot, and the simulation's everybody pattern bills **€724 thousand total** — mostly bench theater — while work-stealing totals **€247 thousand** with experience near **0.96**.

OPEX + strategic + bench-C = total · ten patterns · twenty-one climate cells · four usage heats

Pair wins score when patches mix debt and task. Work-stealing and CCE win experience when trails fruit with payment. Least-loaded wins debt paid at calm usage. Set-based and round-robin win debt mass at overload. Everybody wins filament and loses handoff — tail only. Nobody wins only bench-C. Solo wins psych silence. Swarm pays fires without leading score. **CCE** wins routing economy by escalating mode by patch across the run. The consumers are still walking in from the edges. The climate select is still on bear.
