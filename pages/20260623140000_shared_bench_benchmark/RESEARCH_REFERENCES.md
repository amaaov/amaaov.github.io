# Shared Bench simulation — research alignment

This document maps the Shared Bench ecology simulation (`shared_bench_simulation.exs`, `shared_bench_article.js`) to published software-engineering and adjacent research. The model is a **pedagogical falsification toy**, not a calibrated predictive engine. Alignment is judged on whether mechanisms point in the same direction as evidence, not on numerical fit.

**Status key:** Aligned · Partial · Metaphor · Misaligned

---

## Executive summary

| Area | Verdict | Notes |
|------|---------|-------|
| WIP / throughput / lead time (Little's Law) | Partial | Backlog ↔ WIP is sound; stability assumption violated; lead time not explicit |
| DORA / delivery performance | Partial | Quality + instability in frame; four DORA metrics not operationalised |
| Technical debt | Partial | Repayment + accrual match metaphor; spread/bloom is poetic |
| Pair / swarm / everybody patterns | Partial | Effort & coordination directionally right; complexity moderation missing |
| Brooks / coordination overhead | Aligned | `everybody` × `q` bills coordination theater |
| Forecast miss / planning fallacy | Aligned | Surprise events on plan miss; ~30% overrun literature |
| Prediction intelligence | Partial | Naive vs signal blend ≈ inside/outside view; IQ formula is bespoke |
| Developer morale / experience | Partial | Maps to SPACE **S**atisfaction; not validated scales |
| Customer mood / red line | Metaphor | Loss-aversion billing psychology; no SE paper |
| Hyphae / trails | Metaphor | Stigmergy in FLOSS; grid is not codebase |
| Work-stealing label | Misaligned | Not Blumofe–Leiserson deque scheduling |

**Top fixes (implementation):** see [§ Suggested fixes](#suggested-fixes).

---

## Construct-by-construct

### 1. Little's Law (WIP = throughput × lead time)

**Article claim:** Task backlog mass is WIP; feature growth per tick is throughput; Little's Law sits in the corner.

**Research:** Little (1961); applied to software/Kanban in Reinertsen, Anderson, and others. Requires a **stable** system over the measurement window: average arrival ≈ departure rate, consistent WIP definition.

| Implementation | Research |
|----------------|----------|
| `task` grid sum = WIP | ✓ Valid proxy for queue depth |
| `feature` delta / tick = throughput | Partial — mixes delivery with grid physics |
| No `lead_time` meter | ✗ Should be `WIP / throughput` or cycle-time distribution |
| Debt events, market shocks | ✗ Break stationarity |

**Verdict:** Partial.

**Fixes:** Export `lead_time_est = peak_task / max(feature_velocity, ε)`; document non-stationarity; optionally WIP-limit pattern that caps `task` spawn when backlog > threshold (Kanban).

**References:** [L1], [L2], [L3].

---

### 2. DORA metrics (Accelerate)

**Article claim:** Raw speed is fake if instability grows; same frame as DORA (throughput vs change fail / recovery).

**Research:** Forsgren, Humble & Kim (*Accelerate*, 2018); annual [DORA State of DevOps reports](https://dora.dev). Four metrics: deployment frequency, lead time for changes, change failure rate, time to restore.

| Simulation meter | DORA metric |
|------------------|-------------|
| Feature velocity | Rough throughput proxy |
| `quality = feat/(feat+debt×1.2)` | Not CFR |
| Surprise / security events | Could proxy incidents — not linked to deploys |
| No MTTR | Missing |
| `stability` from debt ratio | Ad hoc, not recovery time |

**Verdict:** Partial — **framing** aligned, **operationalisation** not.

**Fixes:** Map `surprise_events` + debt spikes → synthetic CFR; add `recovery_ticks` after incidents for MTTR; rename prose "DORA-like" unless metrics are added.

**References:** [D1], [D2], [D3].

---

### 3. Technical debt

**Article claim:** Debt accrues when unplanned; drops only via deliberate dev work or strategic spend; shipped feature alone does not erase it.

**Research:** Cunningham (1992) — debt from immature code, **repaid by refactoring** [TD1]. Li, Avgeriou & Liang (2015) — TDM lifecycle: identify, measure, prioritize, repay, monitor [TD2]. Dagstuhl seminar definition (2016) widely cited in follow-on work [TD3].

| Implementation | Literature |
|----------------|------------|
| `debt_paid` via dev fix branches | ✓ Repayment channel |
| Accrual from consumers, forecast miss, neglect | ✓ Unplanned / externalised debt |
| No feature→debt auto-decay | ✓ Matches "consolidation required" |
| Debt **spread** at usage ≥ 0.9 | Metaphor — not in Li taxonomy |
| `debt_weight` global drag | Plausible "interest" — not empirically calibrated |

**Verdict:** Partial — core metaphor **aligned**; spatial spread is **pedagogical**.

**Fixes:** Tag debt cells with type (`code`, `architecture`, `operational`) per Li et al.; tie strategic spend to **measurement** activity not just passive relief; cite Cunningham in article § IIc.

**References:** [TD1]–[TD5].

---

### 4. Collaboration patterns

#### Pair programming

**Research:** Hannay et al. (2009) meta-analysis — quality ↑ (small), duration ↓ on **simple** tasks, effort ↑ (~2×); quality ↑ on **complex** tasks at cost of effort [PP1]. Arisholm et al. (2007) — benefits mainly for juniors on complex systems [PP2].

| Sim | Evidence |
|-----|----------|
| `participants: 2`, thicker hyphae | Effort ↑ — aligned |
| No task-complexity gate | ✗ Should boost yield only when local `task+debt` high |

**Verdict:** Partial.

#### Everybody / meeting theater

**Research:** Brooks (1975) — communication channels `n(n−1)/2`; adding people to late projects makes them later [BR1]. Scholtes et al. (2016) — Ringelmann effect in OSS [BR2].

| Sim | Evidence |
|-----|----------|
| `participants: 6`, bill × 6 × `q` | ✓ Extreme coordination-cost caricature |
| `psych` stress | ✓ Directionally Brooks |

**Verdict:** Aligned as **deliberate exaggeration** (label in prose).

#### Work-stealing

**Research:** Blumofe & Leiserson (1999) — deque-based steal from busiest worker [WS1].

| Sim | Evidence |
|-----|----------|
| Gradient follow on hyphae/task | Different mechanism — **trail foraging**, not deque steal |

**Verdict:** Misaligned **name**; aligned as **foraging heuristic**.

**Fix:** Rename to `trail_stealing` in docs or add footnote; keep label in UI with tooltip.

**References:** [PP1], [PP2], [BR1], [BR2], [WS1].

---

### 5. Forecast miss, planning fallacy, prediction

**Article / sim:** Forecast miss triggers events; prediction IQ blends naive extrapolation with signal model; month-close scoring.

**Research:** Kahneman & Tversky — planning fallacy [PF1]. Jørgensen — software effort overruns ~30%, expert estimation vs models [PF2]. **Outside view** (reference class forecasting) improves estimates [PF1].

| Implementation | Research |
|----------------|----------|
| `forecast_miss_peak` | ✓ Plan vs actual |
| Events on miss | ✓ Unplanned work injection |
| `prediction_intelligence` | Partial — bespoke blend, not reference-class forecasting |
| Patron mood floor | Pedagogical — loss aversion [PF3] |

**Verdict:** Partial / aligned on **miss → surprise**; prediction IQ needs disclaimer.

**Fixes:** Add optional **reference-class** baseline (rolling median of past months); log prediction error vs outside view separately from plan miss.

**References:** [PF1]–[PF3].

---

### 6. SPACE framework (developer productivity)

**Research:** Forsgren et al. (2021) — five dimensions; never single-metric productivity [SP1].

| SPACE dimension | Sim meters |
|-----------------|------------|
| **S**atisfaction | `morale`, `experience` |
| **P**erformance | `quality`, `feature_mass`, composite `score` |
| **A**ctivity | `billable_h`, hyphae — caution: activity ≠ productivity |
| **C**ommunication | `hyphae`, `collab_events`, patterns |
| **E**fficiency / flow | `debt_weight` drag, backlog |
| Customer mood | Separate — client, not developer (good) |

**Verdict:** Partial — multidimensional spirit **aligned**; composite score overweighting cost is not in SPACE.

**Fix:** Document SPACE mapping in article; avoid ranking individuals; keep activity non-target.

**References:** [SP1].

---

### 7. Ecology metaphor (hyphae, consumers, stigmergy)

**Research:** Bolici, Howison & Crowston — stigmergic coordination via shared artifacts in FLOSS [ST1]. Heylighen — traces in medium stimulate next action [ST2]. Ant-colony / mycelium analogies are **not** quantitative SE models.

| Sim layer | Real analogue |
|-----------|---------------|
| `hyphae` deposits | PR threads, CI status, code history |
| `feedback` → `task` | Issues, alerts, support tickets |
| `consumers` eating feature | Production load, success-driven demand |
| Spatial spread rules | Poetic — not empirical |

**Verdict:** Metaphor — **useful for teaching**, not evidence.

**References:** [ST1], [ST2].

---

### 8. Billing quantum `q` and customer mood

**Research:** Time-and-materials with minimum billable increment is industry practice (15‑minute quantum in article). Customer satisfaction in outsourced work: price fairness, budget adherence (marketing / IS literature) — not coded as `moodFloor`.

| Sim | Notes |
|-----|-------|
| `max(q, hours) × rate` | ✓ Models minimum-touch billing |
| Patron tiers / red line | Pedagogical tycoon meter |
| Generous floor while under budget | Aligns with **loss aversion** — overspend hurts more than underspend helps [PF3] |

**Verdict:** Metaphor + partial behavioural economics.

**Fix:** Cite loss aversion in § Va; do not claim empirical patron personas.

**References:** [PF3], [BE1].

---

## Suggested fixes

### Priority A — correctness vs cited literature

1. ~~**Add explicit lead time**~~ — `lead_time ≈ task_backlog / feature_velocity`; live viz + JSON export.
2. ~~**DORA proxies**~~ — `synthetic_cfr = surprise_events / change_attempts`; MTTR via per-event recovery ticks after surprises.
3. ~~**Pair complexity gate**~~ — pair yield ×1.18 above grid median complexity, ×0.85 below (Hannay 2009).
4. **Rename work-stealing** in research docs to "trail-gradient foraging"; footnote Blumofe–Leiserson distinction in article.
5. **Debt typing** — optional enum on accrual (`neglect`, `consumer`, `forecast`, `scope`) for Li-aligned reporting.

### Priority B — calibration & teaching

6. ~~**Little's Law stability banner**~~ — live banner when forecast miss, volatile market, or recovery active.
7. ~~**Outside-view prediction**~~ — rolling 3-month median bench burn baseline; IQ blends signal skill + beat-outside-view gain.
8. ~~**Brooks channel count**~~ — `everybody` psych uses n(n−1)/(2×36) + overlap (JS + Elixir).
9. ~~**Re-run Elixir**~~ — refresh `simulation_results.json`; article prose synced to latest batch run.

### Priority C — polish

10. ~~**Link research doc**~~ — article § VIII links `RESEARCH_REFERENCES.md`.
11. ~~**references.bib**~~ — `pages/20260623140000_shared_bench_benchmark/references.bib`.
12. ~~**SPACE dimension tags**~~ — `data-space` on live metric cells (P/A/C/E/S).

---

## Bibliography

### Queueing & flow

- <a id="L1"></a>**[L1]** Little, J. D. C. (1961). A proof for the queuing formula: \(L = \lambda W\). *Operations Research*, 9(3), 383–387.
- **[L2]** Reinertsen, D. (2009). *The Principles of Product Development Flow*. Celeritas.
- **[L3]** Anderson, D. J. (2010). *Kanban*. Blue Hole Press.

### DORA / DevOps performance

- <a id="D1"></a>**[D1]** Forsgren, N., Humble, J., & Kim, G. (2018). *Accelerate: The Science of Lean Software and DevOps*. IT Revolution.
- **[D2]** Google Cloud / DORA. *Accelerate State of DevOps Reports*. https://dora.dev/research/
- **[D3]** Forsgren, N., et al. (2022). *2022 Accelerate State of DevOps Report* (PDF). https://dora.dev/research/2022/dora-report/

### Technical debt

- <a id="TD1"></a>**[TD1]** Cunningham, W. (1992). The WyCash portfolio management system. *Addendum to the Proc. OOPSLA 1992*. http://c2.com/doc/oopsla92.html
- **[TD2]** Li, Z., Avgeriou, P., & Liang, P. (2015). A systematic mapping study on technical debt and its management. *Journal of Systems and Software*, 101, 193–220. https://doi.org/10.1016/j.jss.2014.12.027
- **[TD3]** Dagstuhl Seminar (2016). Managing technical debt in software engineering (report). Summarised in [TD4].
- **[TD4]** Avgeriou, P., et al. (2024). Technical debt management: The road ahead. *arXiv:2403.06484*. https://arxiv.org/abs/2403.06484
- **[TD5]** Fowler, M. Technical debt (bliki). https://martinfowler.com/bliki/TechnicalDebt.html

### Pair programming & team scale

- <a id="PP1"></a>**[PP1]** Hannay, J. E., Dybå, T., Arisholm, E., & Sjøberg, D. I. K. (2009). The effectiveness of pair programming: A meta-analysis. *Information and Software Technology*, 51(7), 1110–1122. https://doi.org/10.1016/j.infsof.2009.02.001
- **[PP2]** Arisholm, E., Gallis, H., Dybå, T., & Sjøberg, D. I. K. (2007). Evaluating pair programming with respect to system complexity and programmer expertise. *IEEE Transactions on Software Engineering*, 33(2). https://doi.org/10.1109/TSE.2007.17
- <a id="BR1"></a>**[BR1]** Brooks, F. P. (1975). *The Mythical Man-Month*. Addison-Wesley.
- **[BR2]** Scholtes, I., et al. (2016). From Aristotle to Ringelmann: Team productivity and coordination in OSS. *Empirical Software Engineering*. https://doi.org/10.1007/s10664-016-9463-8
- <a id="WS1"></a>**[WS1]** Blumofe, R. D., & Leiserson, C. E. (1999). Scheduling multithreaded computations by work stealing. *Journal of the ACM*, 46(5), 720–748.

### Estimation & forecasting

- <a id="PF1"></a>**[PF1]** Buehler, R., Griffin, D., & Ross, M. (1994). Exploring the "planning fallacy". *Journal of Personality and Social Psychology*, 67(3), 366–381.
- **[PF2]** Jørgensen, M. (2006). Prediction of overoptimistic predictions. *Simula Research Laboratory / Hedmark University* (TR). https://web-backend.simula.no/sites/default/files/publications/Jorgensen.2006.1.pdf
- **[PF3]** Kahneman, D., & Tversky, A. (1979). Prospect theory: An analysis of decision under risk. *Econometrica*, 47(2), 263–291.

### Productivity frameworks

- <a id="SP1"></a>**[SP1]** Forsgren, N., Storey, M.-A., Maddila, C., Zimmermann, T., Houck, B., & Butler, J. (2021). The SPACE of developer productivity. *ACM Queue*, 19(1). https://queue.acm.org/detail.cfm?id=3454124

### Stigmergy & coordination

- <a id="ST1"></a>**[ST1]** Bolici, F., Howison, J., & Crowston, K. (2016). Stigmergic coordination in FLOSS development teams. *Computer Supported Cooperative Work*, 25(1). https://doi.org/10.1007/s10606-015-9223-3
- **[ST2]** Heylighen, F. (2016). Stigmergy as a universal coordination mechanism. *Cognitive Systems Research*. https://doi.org/10.1016/j.cogsys.2015.12.002

### Behavioural economics (customer meter)

- <a id="BE1"></a>**[BE1]** Kahneman, D. (2011). *Thinking, Fast and Slow*. Farrar, Straus and Giroux. (Planning fallacy, loss aversion — ch. 19, 26.)

---

## How to cite this simulation

> Shared Bench Delivery Benchmark ecology simulation (amaaov, 2026). Pedagogical agent-based model for workshop collaboration, cost, and debt couplings. Not validated for production forecasting. Research mapping: `pages/20260623140000_shared_bench_benchmark/RESEARCH_REFERENCES.md`.

---

*Last reviewed: 2026-06-23. Revisit after material simulation changes (DORA metrics, lead time, pair gating).*
