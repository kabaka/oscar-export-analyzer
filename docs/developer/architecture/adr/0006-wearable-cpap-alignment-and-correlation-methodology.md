# ADR-0006: Wearable↔CPAP Alignment & Correlation Methodology

**Date**: June 10, 2026
**Status**: Proposed

---

## Context

ADR-0003/0004/0005 establish that wearable data comes from a local Google Health export,
is aggregated to nightly `WearableNight` rollups in IndexedDB, and is read by date range
for the correlation views. This ADR fixes the **analytical methodology**: how a
`WearableNight` is keyed and aligned to a CPAP night, how raw high-frequency series are
aggregated into nightly statistics, and how the correlation engine computes and reports
relationships — plus the decision to **retire the existing fake/stubbed statistics code**
rather than carry it forward.

Key facts from the design docs ([`data-model-and-correlation.md`], [`data-catalog.md`]):

- **Night key.** `sleep-*.json` carries `dateOfSleep` (the morning-of label) and `logId`;
  OSCAR labels CPAP nights by morning date too — but conventions can differ by a day.
- **Chunk-file `logId` duplicates.** `sleep-*.json` are ~30-day chunk files and the boundary
  session is re-exported in **both** adjacent chunks: empirically **136 logIds appear in two
  files** with identical windows. Keyed naively by `dateOfSleep` this fakes **127 "split-sleep"
  nights**; after de-dup by `logId`, **zero** genuine split-sleep remain.
- **Timezone is the biggest correctness risk — and `UserSleeps` is the wrong primary source.**
  `sleep-*.json` times are **naive local (no offset)**; SpO2/HR CSVs are **UTC (`Z`)**.
  Windowing UTC series to a naive-local window requires a **per-night UTC offset**. The
  empirical review found `UserSleeps_*.start_utc_offset` is a **placeholder**: `+00:00` for
  **88%** of rows and wrong by >1 h for **96%** of evaluated nights — and it _self-validates_
  within the (also-naive-local) sleep tables, so trusting it mis-windows the real-`Z` UTC
  series by ~8 h. **Window-fit inference from the night's own UTC SpO2/HR series recovered the
  correct offset on 59/60 nights** and is therefore the primary source; `UserSleeps` is an
  untrusted hint. A single global offset is wrong across DST/travel.
- **The SpO2 50.0 sentinel.** ~15% of Minute-SpO2 rows are exactly `50.0` — an
  invalid/low-confidence floor, **not** real desaturation. Not filtering it fabricates severe
  desaturations and spurious AHI↔SpO2 correlations. (Empirically every sub-70 value in this
  export equals 50.0 today; a `<70` range cut is nonetheless **unsafe to ship** because it
  would delete genuine severe desaturations — the headline signal — so the filter is
  **sentinel-only**, §3.)
- **Existing stats code is partly fake.** In `fitbitSync.js`/`fitbitCorrelation.js`:
  `buildLinearRegression.predict()` returns `meanY + random noise` (a stub);
  `imputeMissingValues`/`regressionImputation` build on that; `grangerCausalityTest` uses
  hard-coded AR/VAR coefficients (`0.5*y + 0.3*x`) with a non-F "CDF"; and
  **`computeOscarFitbitCorrelations`** is a second, divergent correlation path with no
  BH/`n_eff`/coverage diagnostics. **Genuinely useful** and reusable: `spearmanCorrelation`
  (point estimate; p-path amended for ties), `crossCorrelation` (internal-only, positional +
  sign-flipped), `assignRanks`, `mannWhitneyUTest`, `pearson`, `quantile`, `normalQuantile`,
  **`computeAutocorrelation`** (now load-bearing for the effective-N correction), and the
  Student-t/incomplete-beta machinery. `partialCorrelation` is **limited-use** (Pearson r of
  residuals, no valid p-value, wrong df).
- **Non-overlapping date ranges.** Sleep exists from 2014, HR from 2016, SpO2/HRV/snore
  only from ~2020–2021, OSCAR from when therapy started. Pairs must be computed on the
  intersection, with per-pair `n` and date span reported.

This ADR is analytical-correctness-critical; it should be validated by `@data-scientist`
and covered by `@testing-expert`.

---

## Decision

### 1. Night-keying: `logId` de-dup first, then `dateOfSleep` with ±1-day OSCAR reconciliation

- **De-dup by `logId` BEFORE per-night folding (first-writer-wins).** Because boundary sessions
  are re-exported in two adjacent chunk files (~136 logIds in two files), folding naively by
  `dateOfSleep` would **double** stage minutes / duration / window for ~127 nights and fake them
  as "split sleep." So the ingest **first** collapses sessions by `logId` (keep first, record
  extra `sourceFiles` for audit, assert identical window else flag `dup-window-mismatch`), then
  groups the distinct logIds by `nightKey`. This dedup is a mandatory, explicit, tested step
  (data-model rev2 §3.1).
- A `WearableNight` is emitted **only for `mainSleep == true`** sessions (naps excluded),
  keyed by `nightKey = dateOfSleep` (`YYYY-MM-DD`, the `nightDate` key in storage). `logId`
  joins to `sleep_score.csv.sleep_log_entry_id`. **Split-sleep merge fires only on ≥2
  _genuinely distinct_ logIds** sharing a `nightKey` (union window, sum stage minutes, flag
  `split-sleep`) — expected inert for this export, kept for other users'.
- **Alignment to OSCAR:** index wearable nights by `nightKey`; for each OSCAR row (keyed by
  its morning `Date`), try exact match, else try **±1 day** gated by an overlap requirement
  (`MIN_OVERLAP_HOURS = 4`, existing constant) to avoid stealing a neighbor's night.
  Matching is **one-to-one and greedy** (exact-first, then best overlap). Unmatched rows
  become `unmatchedOscar` (CPAP-only) or `unmatchedWearable` (wearable-only); both are kept
  for single-side analytics but excluded from cross-correlation. Output is an `AlignedNight`
  `{ nightKey, matchType, overlapHours, oscar{…}, wearable: WearableNight, quality{…} }`;
  `durationMismatch > 2h` is a **quality flag, not an exclusion** (exclusion is a
  correlation-time decision).

### 2. Per-night UTC-offset resolution — **inference-primary** (REVERSED from the prior draft)

> **This reverses the previous ADR-0006 decision.** The prior draft made
> `UserSleeps_*.start_utc_offset` the _preferred_ source with inference as a fallback. The
> empirical review proved that inverted and dangerous: `UserSleeps start_utc_offset` is
> `+00:00` for 88% of rows and wrong by >1 h for 96% of nights, yet it _self-validates_ inside
> the naive-local sleep tables — so it silently mis-windows the real-`Z` UTC SpO2/HR series by
> ~8 h. **Window-fit inference is now PRIMARY; `UserSleeps` is demoted to an untrusted hint.**
> See the Changelog.

`resolveOffset(nightKey)` returns `{ utcOffsetMinutes, windowSource, offsetDisagreementMin }`:

1. **`inferred` (PRIMARY).** Find the offset that maximizes the fraction of the night's **own
   UTC-stamped SpO2 (then HR) samples** that fall inside the naive-local sleep window. Search
   `offset ∈ [−840, +840] min` at **15-min** resolution (Fitbit offsets are whole 15-min
   multiples); require ≥ `MIN_INFER_SAMPLES` (=30) samples and ≥ `MIN_INFER_FRAC` (=0.5) inside
   the window. Tie-break toward the previous night's inferred offset (DST continuity), then the
   modal zone offset, then smaller `|off|`. (Recovered 59/60 Pacific/DST nights empirically.)
2. **`userSleeps-hint`.** Only when inference is unavailable (sparse samples) **and** the
   `UserSleeps` offset is **non-`+00:00`** (a real, non-placeholder value). Weak fallback;
   flag `offset-from-hint`.
3. **`carry-forward`.** The most recent **`inferred`** offset from a nearby night
   (≤ `MAX_CARRY_NIGHTS` = 2; never copies a hint or another carry-forward). Suspect — capped to
   avoid riding a stale offset through an uncovered DST/travel boundary (which would inject
   serially-correlated window error — §4). Flag `offset-carry-forward`.
4. **`default-fallback`.** A single configured default, last resort; flag
   `offset-default-fallback`. (Recommended alternative: **drop the night from UTC-series stats**
   — mark `insufficient` — rather than guess a default.)

**`UserSleeps` as untrusted hint + disagreement check:** `+00:00` is always treated as missing.
When both an inferred offset and a non-`+00:00` hint exist, compute
`offsetDisagreementMin = |inferred − hint|`; if `≥ 15 min`, **keep the inferred value**, discard
the hint, flag `offset-disagreement`. The hint may serve as a sanity bound but **never overrides
inference**. Sleep/offset sources are ingested **first** (Phase A — ADR-0004) so the offset is
resolved before any UTC series is windowed. This per-night offset is the single most important
alignment control. Non-`inferred` provenance feeds the attenuation warning (§4).

### 3. Aggregation & validity filters (window-restrict → filter → gate → aggregate)

General rules: window-restrict high-frequency series first; **a missing minute is missing,
not zero** for physiological metrics (gaps shrink the coverage denominator, never imputed to
0); cast string-typed numeric values with NaN guards; **coverage-gate before reporting** —
a metric that fails its gate is `null` **and** its group is pushed to
`coverage.insufficient[]`, which is distinct from "absent" (source/row simply does not
exist). This absent-vs-insufficient contract must survive into the dashboard.

- **SpO2 — sentinel-only filter (the `<70` clause is REMOVED):** `valid = rows where
value !== 50.0`. **No `>=70` clause.** Although every sub-70 value in this export equals 50.0
  _today_, a `>=70` range cut is not equivalent in principle — it would delete the entire
  `[1,70)` range, and for this tool's population (CPAP users, often severe OSA) a genuine
  calibrated nadir of 64–69% during an under-treated night is **the single most clinically
  important data point** and the direct correlate of high AHI. The range cut would silently
  delete real deep desaturations, bias `minPct`/`p5Pct` upward, zero `pctTimeBelow88`, and
  **attenuate the headline AHI↔SpO2 ρ toward 0** — the opposite of the feature's goal. So:
  - Compute `meanPct/medianPct/p5Pct`, `minPct` **post-filter only** (never raw min),
    `pctTimeBelow90`, `pctTimeBelow88`, `validMinutes`. Gate `MIN_SPO2_VALID_MIN = 120`.
  - **Log `sentinelMinutesRemoved` per night** (count of in-window `=== 50.0` minutes). Track
    `subSeventyNonSentinelMinutes` (rows with `1 ≤ value < 70 AND value !== 50.0`, expected 0);
    any `> 0` raises a `spo2-sub70-nonsentinel` **data-quality flag** and is **never
    auto-deleted**. A tighter cutoff than the sentinel may be added only after a PHI-safe
    count-only validation across many files confirms the `[1,70)`-non-50.0 set is empty.
  - The sentinel removal itself remains **non-negotiable**: without dropping 50.0, ~15% of
    minutes fabricate severe desaturations and produce spurious strong AHI↔SpO2 correlations.
- **Sleeping HR:** stream raw `heart_rate-*.json`, restrict to window, `confidence > 0`,
  gate `MIN_HR_SAMPLES = 300`; emit min/avg/max/p10; downsample to 1-min for drill-down;
  never retain the full series. Resting HR from daily `resting_heart_rate-*.json`.
- **HRV/Respiratory/Snore/Readiness/Stress/Temperature/Activity:** per the formulas and
  coverage gates in the data-model design (§2.2–2.8), including unit care
  (respiratory rate is **breaths/min**, never the milli-breaths/min variant; temperature
  stays °C). Readiness keys to the same `nightKey` (morning date); stress's ±1-day mapping
  is stored raw and resolved in the alignment pass (assumption to pin — see below).
- **Default coverage thresholds** (`MIN_SPO2_VALID_MIN=120`, `MIN_HR_SAMPLES=300`,
  `MIN_HRV_COVERAGE=0.5`, `MIN_SNORE_EPOCHS=120`, `MIN_ASLEEP_MIN=180`, reusing
  `MIN_NIGHTS_FOR_ANALYSIS=7`) are documented constants, tunable, owned by `@data-scientist`.

### 4. Correlation engine

- **Frozen, pre-registered pair list.** The hypothesis pairs are a **versioned constant**
  (`PAIR_REGISTRY_VERSION`, emitted in engine output) **frozen before looking at this user's
  data**, split into a **primary** family (pairs 1–4, 6, 7, 9: AHI↔SpO2/HRV/HR/snore/efficiency,
  usage↔readiness) and an **exploratory** family. Each pair carries an expected sign and a
  plausible |ρ| band tagged **[lit]** (literature-grounded) or **[heur]** (heuristic). Editing
  the primary list to chase significance is blocked at review. **Single-subject caveat:** with
  one user, all findings are **hypothesis-generating, not confirmatory** — stated in the UI.
- **Default method: Spearman ρ, with a tie-aware p-value (amended).** `spearmanCorrelation`'s
  point estimate is reused as-is, but its t-based p (`df = n−2`, **no tie correction**) is
  **anticonservative** on this heavily-tied data (integer-ish SpO2, readiness LOW/MED/HIGH, AHI
  clustered at small integers, snore in 0.5 steps). When any value's multiplicity exceeds 20% of
  n in either series, switch that pair to a **two-sided permutation p** (`B ≥ 2000`); for
  inherently low-cardinality y prefer **Kendall τ-b**. Report which p method was used per pair.
- **Effective-N correction for serial correlation (mandatory).** Consecutive nights are
  autocorrelated (a cold, a pressure change, travel persist over many nights; carry-forward
  offsets worsen it), so treating nights as i.i.d. makes the t/permutation p and BH
  **anticonservative** — the precise failure mode that yields _confident, wrong_ claims. For
  every pair, reuse `computeAutocorrelation` for lag-1 `r1x`/`r1y`, compute
  `n_eff = clamp(n·(1−r1x·r1y)/(1+r1x·r1y), 2, n)`, and recompute the p at **`df = n_eff − 2`**.
  Show both naive and `n_eff` p; **BH operates on the `n_eff`-adjusted p.** A moving-block
  bootstrap CI (block ≈ 7 nights) is recommended for the headline primary pairs and, if shown,
  leads over the p. Warn `serial-correlation` when `max(r1x,r1y) > 0.3`.
- **Lag analysis — `nightlyLagCorrelation` is the SOLE lag path; only lag-0 is inferential.**
  `crossCorrelation` is internal-only (positional `slice`, and sign-flipped vs its own docstring),
  so it is **wrapped** by a new `nightlyLagCorrelation(seriesByDate_x, seriesByDate_y, maxLag)`
  that builds a **calendar-dense array first**, then does date-correct pairwise-deletion Spearman
  per lag. **Lag-sign convention (single source of truth):** positive lag `k` pairs x at night
  `d` with y at night `d+k`. `maxLag ≤ 7`. **Only lag-0 enters inference**; the lag profile
  (lags ≠ 0) is **descriptive only**, never a significance-tested "peak."
- **Group contrasts:** Mann-Whitney U (`mannWhitneyUTest`, reused) with **pinned thresholds**
  (constants owned by `@data-scientist`, _not_ user sliders) — e.g. HRV on high-AHI (≥15) vs
  low-AHI (<5), readiness on adherent (≥4h) vs not — with rank-biserial effect size. Each group
  test **counts toward the BH family.**
- **Partial correlation: limited-use, no p-value.** `partialCorrelation` returns a bare Pearson
  r of residuals (wrong df, not rank-based) — offered only as a point-estimate "advanced"
  diagnostic explicitly labeled "no significance test"; it carries **no p** and does **not**
  enter the BH family.
- **Missing data: pairwise deletion, no imputation** (default). Imputing a dependent
  physiological variable before correlating inflates ρ and is statistically invalid here; never
  feed imputed values into a correlation p-value.
- **MNAR coverage-bias diagnostics.** Coverage gating is **not** missing-at-random: a night the
  user tossed/removed the mask yields less valid SpO2/HRV **and** plausibly a worse
  physiological night, so dropping it restricts range and **attenuates** the headline ρ. Per
  pair, report `nKept`/`nDroppedInsufficient`, kept-vs-dropped AHI/SpO2/HRV summaries (median +
  IQR, PHI-safe), a **Mann-Whitney selection test** on AHI (dropped vs kept), and a
  **relaxed-gate sensitivity** recompute (e.g. SpO2 gate → 60 min); flag `coverage-selection` /
  `coverage-sensitive` accordingly. The 120-min gate buys percentile stability, not
  unbiasedness — say so.
- **Minimum-n gating:** per pair require `n_valid ≥ MIN_CORRELATION_SAMPLE_SIZE = 10` after
  pairwise deletion; whole-analysis gate `≥ 7` aligned nights. Always report per-pair `n` and
  date span so a ρ from 12 nights is not shown as equal to one from 800.
- **Multiple comparisons: Benjamini-Hochberg over the FULL session family.** The family is **not
  just the 12 pairs**: it is (number of pair **lag-0** Spearman tests run) **+** (number of MW
  group-contrast tests run), surfaced as a visible "tests run: N" denominator. Removing the
  lag-peak inflation at the source (only lag-0 is inferential) avoids ~15-tests-per-pair
  laundering; partial correlations carry no p so they are excluded. BH at **q = 0.05** within the
  frozen **primary** family; the **exploratory** family uses **q = 0.10 labeled "exploratory
  only"** or no significance badges. BH operates on the `n_eff`-adjusted p. BH (not Bonferroni)
  preserves power for biomedical screens.
- **Plausibility canary — reframed as a one-sided gross wrong-sign tripwire only (NOT a
  correctness/alignment control).** The old framing (`|ρ|≥0.5 & q<0.05 & wrong sign`) caught only
  the rare _loud_ failure (a sign flip) and was **blind to the common quiet one** — attenuation
  toward zero from a wrong offset / over-aggressive filter / coverage selection — yet its silence
  falsely implied "alignment is fine." Reframed into two independent checks:
  1. **Gross wrong-sign tripwire (one-sided, narrow):** fire only when `sign(ρ)` contradicts the
     expected sign **and** `|ρ| ≥ 0.5` **and** `pValueAdj < 0.05`, presented as _"gross wrong-sign
     — likely a data/wiring bug, investigate."_ **Exclude the two-sided pairs 5 (AHI↔RR) and
     8 (EPAP↔minSpO2)** — EPAP↔minSpO2 is confounded by indication, so a negative ρ is plausibly
     real. Silence is **not** evidence of correct alignment.
  2. **Attenuation / coverage warning (the check the old canary missed):** for each primary pair,
     raise `attenuation-risk` when gating loss is high (coverage-selection test fires or
     `nDroppedInsufficient / total > 0.3`) **or** non-`inferred` offsets exceed 20% of
     contributing nights.

### 5. Retire the fake/invalid statistics code

**Do not carry forward** the stubbed/invalid/divergent functions:

- **`grangerCausalityTest`** (hard-coded AR/VAR coefficients `0.5*y+0.3*x`; non-F "CDF") —
  **removed/hidden for v1**; never surfaced as causal evidence. Reintroduce only as a real
  least-squares VAR behind its own review.
- **`buildLinearRegression`** (`predict()` returns `meanY + random noise`) and the
  **`imputeMissingValues`/`regressionImputation`** (plus `knnImputation`/`meanImputation`) built
  on it — **removed.** Imputation is off by default (pairwise deletion); if a complete-case
  matrix is ever wanted, use **listwise deletion**, never model-based imputation.
- **`computeOscarFitbitCorrelations`** — **ADDED to the retirement list.** It is a second,
  divergent correlation path reading the old joined `record.fitbit.*`/`record.oscar.*` shape with
  no BH/`n_eff`/coverage diagnostics, superseded by the new pair-runner. Retire it rather than
  ship two paths that disagree; **migrate its consumers first** (`fitbitAnalysis.js`,
  `useFitbitAnalysis.js`, and `fitbitCorrelation.test.js`).
- **`partialCorrelation`** — **limited-use, not retired:** point estimate only, **no valid
  p-value** (wrong df, Pearson on ranks-rationale data); allowed behind "advanced," labeled "no
  significance test."

**Reuse as-is** (rename only to drop the "fitbit" misnomer): `spearmanCorrelation` (point
estimate), `assignRanks`, `mannWhitneyUTest`, `pearson`, `quantile`, `normalQuantile`,
**`computeAutocorrelation`**, Student-t/incomplete-beta. **Reuse internal-only:**
`crossCorrelation` (wrapped by `nightlyLagCorrelation` only). **Add** (small, unit-tested):
`benjaminiHochberg`, `nightlyLagCorrelation` (date-dense, lag-sign-correct), tie-aware
permutation p / Kendall τ-b, the `n_eff`-adjusted p, optional moving-block bootstrap CI, the
pair-runner (n-gate + n_eff + BH-over-full-family + wrong-sign tripwire + attenuation warning +
MNAR diagnostics), and the coverage-gated aggregators.

### 6. Persistence posture for derived PHI: unencrypted, with consent

The aligned/correlation inputs are **derived PHI** (sleep architecture, oxygenation, HR
signals). Consistent with ADR-0005 §6, they are persisted (as the ADR-0004 rollups)
**unencrypted, gated by explicit consent, matching the existing CPAP baseline** — this ADR
reaffirms that posture for the analytical layer and **formalizes it explicitly** rather than
leaving it as the prior de-facto, undocumented practice.

---

## Consequences

### Positive

- **Correct alignment across DST/travel** via **inference-primary** per-night offsets
  (recovered 59/60 nights empirically) with recorded provenance, and robust OSCAR
  reconciliation via ±1-day overlap-gated matching. The `+00:00` `UserSleeps` placeholder trap
  is neutralized.
- **No double-counted nights** — `logId` de-dup before folding eliminates the ~127 fake
  split-sleep nights that chunk-file boundaries created.
- **Trustworthy SpO2 stats without deleting real signal** — the mandatory **sentinel-only**
  50.0 filter prevents fabricated desaturations _and_ preserves genuine severe desaturations
  (the headline AHI correlate the prior `<70` clause would have erased).
- **Statistically honest reporting** — tie-aware Spearman/Kendall, **`n_eff` correction** for
  serial correlation, pairwise deletion, n-gating, **BH over the full session family**,
  lag-0-only inference, **MNAR coverage-bias diagnostics**, effect-size-led interpretation, and
  a narrow wrong-sign tripwire + attenuation warning; no p-hacking, no causal overclaiming.
- **Removes correctness/credibility hazards** — fake regression/imputation/Granger **and** the
  divergent `computeOscarFitbitCorrelations` path can no longer mislead users or future agents.
- **Maximal reuse** of proven correlation/alignment math; only honest, small additions.

### Negative

- **More conservative findings.** FDR over the full family + `n_eff` + n-gates + pairwise
  deletion surface fewer "significant" correlations than the naive approach — correct, but may
  feel sparse, especially on short overlaps where many pairs are gated out.
- **Lost (fake) features.** Granger "causality," imputation, and the second correlation path
  disappear; some users may have perceived them as capabilities (they were not real).
- **Offset/stress-mapping residual risk.** When inference fails (sparse UTC samples), carry-
  forward (≤2 nights, inferred-only) or default-fallback is a flagged heuristic — better to
  drop the night from UTC-series stats; the stress ±1-day convention still needs an empirical
  pin (below).
- **Implementation/testing burden.** The aggregators, the inference-primary offset resolver,
  the `logId`-dedup step, the pair-runner (n_eff + BH-full-family + MNAR + tie-aware p), and the
  date-dense lag wrapper need careful edge-case tests (boundary-dup vs genuine split, DST night,
  inferred-vs-hint disagreement, all-sentinel + real-sub-70 SpO2, n=9 vs 10, hand-computed BH,
  AR(1) `n_eff`, heavy-tie permutation, lag-sign +2, MNAR selection).
- **Wrong-sign tripwire is narrow by design.** It catches only gross sign flips and is silent
  on the common attenuation failure — which is exactly why the separate attenuation/coverage
  warning exists; its silence must never be read as "alignment is fine."

### Mitigations

- Record `windowSource` (`inferred`/`userSleeps-hint`/`carry-forward`/`default-fallback`),
  `offsetDisagreementMin`, and coverage flags on every night so the UI can warn on
  non-`inferred` offsets and degraded (classic-sleep) nights, and feed the attenuation warning.
- Report per-pair `n`, `n_eff`, date span, and offset provenance prominently; let effect size +
  `n_eff` + provenance govern the headline, not the p/badge alone.
- Full edge-case validation plan handed to `@testing-expert` (design §7), all fixtures
  **synthetic** (no real export values; `oscar-privacy-boundaries`/`oscar-test-data-generation`).
- Keep retired functions out of the shipped surface; if Granger/VAR is wanted later, do it as
  a real implementation behind its own review.

---

## Alternatives Considered

### Alternative A: Keep the existing stats code (Granger, regression imputation) as-is

- **Pros:** No deletion churn; preserves apparent feature breadth; less new code.
- **Cons:** The functions are **fake** (random-noise predictions, hard-coded VAR
  coefficients) — shipping them presents fabricated results as analysis, the worst possible
  outcome for a medical-adjacent tool.
- **Why not chosen:** Knowingly surfacing fake statistics is unacceptable; honesty requires
  retiring or reimplementing them.

### Alternative B: Bonferroni correction instead of Benjamini-Hochberg

- **Pros:** Simpler; strong family-wise error control.
- **Cons:** Over-conservative for an exploratory biomedical correlation screen with ~12
  pairs; destroys power, hiding real effects.
- **Why not chosen:** BH-FDR is the standard for exploratory screens and preserves power
  while controlling false discoveries; applied per-family it protects pre-registered
  hypotheses appropriately.

### Alternative C: Model-based imputation to maximize usable n

- **Pros:** Larger effective sample; fewer gated-out pairs.
- **Cons:** Imputing dependent physiological variables before correlation **inflates**
  correlation and invalidates p-values; the only available imputation here is a random-noise
  stub.
- **Why not chosen:** Statistically invalid; pairwise deletion is the correct default.

### Alternative D: Single global timezone offset (the old `calculateSleepDate` heuristic)

- **Pros:** Trivial; no per-night resolution.
- **Cons:** Wrong across DST and travel — mis-windows every UTC series for affected nights,
  corrupting nightly aggregates.
- **Why not chosen:** A per-night offset is recoverable by inference from the night's own UTC
  series; using one global offset reintroduces the biggest correctness risk the rework can avoid.

### Alternative E: Trust `UserSleeps_*.start_utc_offset` as the primary offset (the prior draft)

- **Pros:** A single labeled field; no search/inference code; was the prior ADR decision.
- **Cons:** Empirically a **placeholder** — `+00:00` for 88% of rows, wrong by >1 h for 96% of
  nights — that self-validates inside the naive-local sleep tables while mis-windowing the
  real-`Z` UTC series by ~8 h. Trusting it captures essentially zero real sleep-time SpO2/HR on
  those nights.
- **Why not chosen:** It is the inverted decision the empirical review overturned. Inference is
  primary; `UserSleeps` is an untrusted hint (§2). **This reverses the prior ADR-0006 choice.**

---

## Settled by the Empirical Review (acceptance gates, validated 2026-06-10)

- **Inference-primary offset recovers the true zone** — validated 59/60 Pacific/DST nights;
  `UserSleeps +00:00` placeholder confirmed (88% of rows). Re-check on new exports.
- **`logId`-dedup eliminates the fake split-sleep nights** — validated 127 → 0.
- **Sub-70 SpO2 values are exactly 50.0 today** (300 files / 145,931 rows). This makes the
  sentinel filter sufficient; it does **not** make a `<70` cut safe to ship (§3). Any cut
  tighter than the sentinel requires a fresh PHI-safe count-only re-check first.

## Assumptions to Verify

- **OSCAR night labeling matches Fitbit `dateOfSleep` (morning date) most of the time**, with
  occasional ±1-day differences — the basis for the reconciliation. Validate against known
  nights with `@data-scientist`.
- **Stress `DATE` → night mapping (±1 day).** The catalog does not pin whether
  `Stress Score.DATE` refers to the night before or the day of; store raw and **empirically
  pin one convention** against a few known nights before finalizing (acceptance gate).
- **Coverage thresholds** (120 min SpO2, 300 HR samples, 0.5 HRV coverage, etc.) are
  reasonable defaults — `@data-scientist` to confirm/tune; re-validate after the
  inference-primary offset fix (windows differ on previously-mis-windowed nights).
- **`nightlyLagCorrelation` builds a calendar-dense series correctly** — `crossCorrelation`
  slices positionally and emits a sign-flipped lag, so the wrapper must build the date-indexed
  dense array and re-derive the lag-sign convention or it would silently misalign/invert lags.

---

## References

- [ADR-0003](0003-replace-fitbit-oauth-with-local-export-ingestion.md),
  [ADR-0004](0004-ingest-and-aggregate-wearable-data-to-indexeddb.md),
  [ADR-0005](0005-wearable-export-file-access-and-privacy-boundary.md)
- Design: [`design/data-model-and-correlation.md`](../../reports/2026-06-wearable-export-planning/design/data-model-and-correlation.md) (rev2, §0–7),
  [`data-catalog.md`](../../reports/2026-06-wearable-export-planning/data-catalog.md) (§3b, §4, §5),
  both archived under `docs/developer/reports/2026-06-wearable-export-planning/`.
- The empirical and statistics red-team review notes that informed this methodology
  were ephemeral working documents and were not retained; their conclusions are folded
  into the archived design doc above and into this ADR.
- Code to reuse/rename: `src/utils/fitbitCorrelation.js` (→ `wearableCorrelation.js`),
  `src/utils/fitbitSync.js` (→ `wearableSync.js`, delete imputation block — ADR-0003),
  `src/utils/fitbitAnalysis.js` (→ `wearableAnalysis.js`), `src/utils/stats.js`
  (incl. `computeAutocorrelation`), `src/constants/fitbit.js` (→ `wearableConstants.js`),
  `src/constants/dataLimits` (existing thresholds).
- Skills: `oscar-statistical-validation`, `oscar-test-data-generation`,
  `medical-data-visualization`.

---

## Approval

**Decision Maker**: Project maintainer
**Recommended Reviewers**: @data-scientist (primary), @testing-expert, @frontend-developer, @readiness-reviewer
**Status**: Proposed — awaiting review and acceptance.

---

## Changelog

| Date       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Author          |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| 2026-06-10 | Initial ADR drafted                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | @adr-specialist |
| 2026-06-10 | Revised after **adversarial review 2026-06-10** (empirical + stats red-teams). **REVERSED the offset-source priority:** window-fit inference is now PRIMARY; `UserSleeps start_utc_offset` demoted to an untrusted hint (`+00:00`/≥15-min disagreement = missing) — previously it was preferred. Also: added `logId` de-dup before folding (kills ~127 fake split-sleep nights); SpO2 filter is now **sentinel-only** (`==50.0`), removed the `<70` clause (it would delete real severe desaturations); added **`n_eff`** serial-correlation correction; lag-0-only inference with BH over the **full session family**; added MNAR coverage-bias diagnostics, tie-aware Spearman p, date-dense `nightlyLagCorrelation` as sole lag path; **added `computeOscarFitbitCorrelations` to retirement**, marked `partialCorrelation` limited-use; reframed the plausibility canary to a one-sided wrong-sign tripwire + attenuation warning (EPAP↔minSpO2 excluded). | @adr-specialist |
