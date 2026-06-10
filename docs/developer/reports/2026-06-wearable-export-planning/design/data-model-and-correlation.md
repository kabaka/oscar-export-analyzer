# WearableNight Data Model, Alignment & Correlation Engine — Design

**Status:** Design proposal (feeds an ADR). **Author:** data-scientist subagent. **Date:** 2026-06-10.
**Revision:** rev2 (2026-06-10) — adversarial-review remediation; see Revision log below.

---

## Revision log (adversarial review)

This revision (rev2) addresses BLOCKER/MAJOR findings from the **empirical red-team**
(`../review/empirical-redteam.md`, data-validated against the real export) and the **statistical
red-team** (`../review/stats-redteam.md`). Each change is keyed to its finding.

| #   | Finding (severity)                                                    | Change in this rev                                                                                                                                                                                                                                                                                                                                                      |
| --- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **UTC-offset resolver inverted** (BLOCKER, empirical)                 | §3.2 rewritten: **window-fit inference is now the PRIMARY resolver**; `UserSleeps_*.start_utc_offset` demoted to an _untrusted hint_ (`+00:00` and any ≥15 min disagreement treated as **missing**). Full fallback chain, inference objective, ±-min search range, tie-breaking, and per-night provenance flags specified. Carry-forward demoted below fresh inference. |
| 2   | **Sleep chunk-file boundary duplicates** (MAJOR, empirical)           | §3.1 adds an explicit **logId de-dup (first-writer-wins) step before per-night folding**; split-sleep merge re-scoped to **genuinely distinct logIds** only. New identity field `sourceFiles`.                                                                                                                                                                          |
| 3   | **SpO2 `<70` clause can delete the headline signal** (BLOCKER, stats) | §2.1 + §1.2 + §5: default filter is now **sentinel-only (`value === 50.0`)**; the `< 70` clause is **removed from the spec**. Per-night logging of sentinel-removed minutes + a count-only validation gate before any tighter cutoff.                                                                                                                                   |
| 4   | **Serial correlation / non-independence** (BLOCKER, stats)            | New §4.3a: **effective-N correction** (`n_eff` from lag-1 autocorrelations, reusing `computeAutocorrelation`), p recomputed at `df = n_eff − 2`; optional moving-block bootstrap CI; serial-correlation warning.                                                                                                                                                        |
| 5   | **Hidden multiplicity** (MAJOR, stats)                                | §4.4 rewritten: **only lag-0 is inferential**; lag profile is descriptive-only. BH family = **all session tests** (pairs × group contrasts), counted explicitly. §4.1 freezes the primary pair list as a **versioned pre-registered constant**.                                                                                                                         |
| 6   | **Coverage-gating MNAR selection bias** (MAJOR, stats)                | New §4.6a: report kept-vs-dropped AHI/SpO2/HRV distributions + Mann-Whitney selection test + relaxed-gate sensitivity analysis.                                                                                                                                                                                                                                         |
| 7   | **Spearman ties + `crossCorrelation`** (MAJOR, stats)                 | §4.2: **permutation p-value** (or Kendall τ-b) when ties are heavy. §4.2 + §4.4: `nightlyLagCorrelation` (date-dense) is the **sole** lag path; `crossCorrelation` marked internal/positional; explicit lag-sign convention + sign test.                                                                                                                                |
| 8   | **Retire fake stats (+ extend)** (CONFIRMED, stats)                   | §0 + §4.8: retire `grangerCausalityTest`, `buildLinearRegression`/`predict()`, `imputeMissingValues`/`regressionImputation`, **and `computeOscarFitbitCorrelations`** (divergent second path — consumers listed). `partialCorrelation` marked **limited-use** (no valid p-value; wrong df).                                                                             |
| 9   | **Plausibility canary reframe** (MINOR, stats)                        | §4.7: canary reframed as a **one-sided gross wrong-sign tripwire only** (not a correctness/alignment control); EPAP↔minSpO2 excluded from the wrong-sign rule; separate **attenuation/coverage warning** added.                                                                                                                                                        |
| 10  | **Effect-size bands provenance** (MINOR, stats)                       | §4.1 bands now tagged **[lit]** (literature-grounded) vs **[heur]** (heuristic/clinical-judgment); bands for pairs 5/8/10/12 softened.                                                                                                                                                                                                                                  |

> **Provenance note:** the empirical review validated these against the real export but reproduced
> **no health values** — only counts/prevalences. This doc continues to use synthetic illustrative
> numbers only.

**Scope:** Canonical normalized per-night wearable record, raw→nightly aggregation formulas, the
night-keying/alignment algorithm against OSCAR CPAP nights, the correlation engine, and the
intraday drill-down model — for the Google Health (Fitbit) **export** ingestion path replacing the
retired Fitbit OAuth integration.

**Grounding:** Every source-file reference and gotcha here traces to
`../data-catalog.md` (§2 canonical-source map, §3 volume, §3b sleep alignment, §4 gotchas, §5 v1
scope). Where this doc says "catalog §X" it means that file. No real export values appear here; all
numeric examples are synthetic.

**PHI:** All parsing is local/in-browser. PII directories (`Your Profile`, `UserDemographicData`,
GPS/location) are never ingested (catalog §5).

---

## 0. Relationship to existing code

The OAuth-era model (`src/utils/fitbitModels.js` `createNightlyRecord`, `fitbitSync.js`,
`fitbitCorrelation.js`) is a useful **starting vocabulary** but is **not** the target model:

- It nests everything under `record.fitbit.*` + `record.oscar.*` as a _joined_ record. We instead
  define a standalone **`WearableNight`** (wearable-only) that is _aligned to_ an OSCAR night at a
  later stage, producing an `AlignedNight`. This separation matters because the export has many
  wearable nights with **no** CPAP night and vice-versa, and because aggregation/validity is a
  property of the wearable data alone.
- The OAuth model's `calculateSleepDate` (noon-split heuristic, single global `timezoneOffset`) is
  **insufficient** for the export: the export gives us an authoritative `dateOfSleep` label and
  **per-night UTC offsets** (`UserSleeps_*.csv`). We replace the heuristic with explicit fields
  (catalog §3b, §4.2).
- **Reuse as-is:** `spearmanCorrelation` (point estimate; **p-value path amended for ties**, §4.2),
  `assignRanks`, the Student-t / incomplete-beta machinery in `fitbitCorrelation.js`; `pearson`,
  `quantile`, `mannWhitneyUTest`, `normalQuantile`, **and `computeAutocorrelation`** (now load-bearing
  for the effective-N correction, §4.3a) in `src/utils/stats.js`.
- **Reuse internal-only:** `crossCorrelation` (`stats.js`) is **positional and lag-sign-flipped**
  (confirmed: docstring says "positive lag: y leads x" but it emits `lag: -lag` at line ~199, and it
  `slice`s by array index, not by date). It must **not** be called directly on gappy nightly series.
  Wrap it behind `nightlyLagCorrelation` (§4.2/§4.4), which is the sole public lag entry point.

- **RETIRE (do not reuse, remove or hide — these are fake or divergent):**
  - `buildLinearRegression(...).predict()` (`fitbitSync.js` ~L453–467) — returns
    `meanY + (Math.random()−0.5)*0.1*meanY`, i.e. **random noise around the mean, no coefficients**.
  - `regressionImputation` (`fitbitSync.js` ~L300) + `imputeMissingValues` (`~L265`) — consume that
    stub; **model-based imputation of a dependent physiological variable before correlating inflates
    ρ** and is statistically invalid here. Use **pairwise deletion, never imputation** (§4.6).
  - `grangerCausalityTest` (`fitbitCorrelation.js` ~L239–323) — its `fitVectorAutoregression`
    "prediction" is hard-coded `0.5*y[i−1] + 0.3*x[i−1]` (~L537) and `fDistributionCDF` falls back to
    `1 − exp(−f/2)` (~L681), which is **not an F CDF**. The F-test on those residuals is meaningless.
  - **`computeOscarFitbitCorrelations` (`fitbitCorrelation.js` ~L332)** — a **second, divergent
    correlation path** that reads the old joined `record.fitbit.*` / `record.oscar.*` shape, applies no
    BH/`n_eff`/coverage diagnostics, and is superseded by the new pair-runner (§4.9). Retire it rather
    than leave two paths that disagree. **Consumers to migrate first** (grepped 2026-06-10):
    `src/utils/fitbitAnalysis.js` (import L14, call L95), `src/hooks/useFitbitAnalysis.js` (doc refs
    L165/L224 — pair shape consumer), and its tests in `fitbitCorrelation.test.js`. `imputeMissingValues`
    is also called from `fitbitAnalysis.js` L90 — remove that call when migrating.
- **Limited-use (do NOT surface a p-value):** `partialCorrelation` (`stats.js` ~L1630) returns a bare
  **Pearson** r of residuals — **no p-value and no df correction** (correct df is `n − p − 2`). It is
  also Pearson, inconsistent with the rank-based rationale used everywhere else. Allowed only as a
  point-estimate "advanced" diagnostic, clearly labeled "no significance test"; do not feed it a
  reused 2-var Spearman p. If a partial p is ever required, implement a rank-based partial at
  `df = n − p − 2` (out of v1 scope).

---

## 1. Canonical `WearableNight` data model

One record per wearable **main-sleep night**, keyed by `dateOfSleep` (the morning-of label, see §3).
Types are JS; units explicit. `null` = metric absent for this night; a metric present but failing
its coverage gate is represented by the value `null` **plus** an entry in `coverage.insufficient[]`
(§2.9) so "absent" and "insufficient data" are distinguishable.

Priority: **M** = v1 MUST-HAVE (catalog §5), **N** = nice-to-have (later).

### 1.0 Identity / keying block (M)

| Field                   | Type                                                         | Units             | Source (catalog §2)                                                           | Computation                                                                                                                                                                              |
| ----------------------- | ------------------------------------------------------------ | ----------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nightKey`              | string                                                       | `YYYY-MM-DD`      | `sleep-*.json.dateOfSleep`                                                    | Primary join label = morning-of date. The single canonical key.                                                                                                                          |
| `logId`                 | number                                                       | —                 | `sleep-*.json.logId`                                                          | Joins to `Sleep Score/sleep_score.csv.sleep_log_entry_id`.                                                                                                                               |
| `sleepType`             | `'stages'                                                    | 'classic'`        | —                                                                             | `sleep-*.json.type`                                                                                                                                                                      | Drives which stage fields are populated (catalog §3b.5, §4.9). |
| `isMainSleep`           | boolean                                                      | —                 | `sleep-*.json.mainSleep`                                                      | Only `true` rows become a `WearableNight`; naps excluded (§3).                                                                                                                           |
| `window`                | `{startLocal, endLocal, utcOffsetMinutes, startUtc, endUtc}` | ISO / min         | `sleep-*.json.startTime/endTime` + resolver (§3.2)                            | The naive-local sleep window plus the **inferred** offset and derived UTC bounds (§3.2).                                                                                                 |
| `windowSource`          | `'inferred'                                                  | 'userSleeps-hint' | 'carry-forward'                                                               | 'default-fallback'`                                                                                                                                                                      | —                                                              | —   | Provenance of `utcOffsetMinutes` (§3.2). **`inferred` is the expected primary value**; non-`inferred` values surface alignment risk and feed the attenuation warning (§4.7). |
| `offsetDisagreementMin` | number\|null                                                 | min               | —                                                                             | `\|inferredOffset − userSleepsHint\|` when both exist; ≥15 ⇒ hint discarded, `coverage.flags += 'offset-disagreement'` (§3.2).                                                           |
| `sourceFiles`           | string[]                                                     | —                 | —                                                                             | The `sleep-*.json` chunk file(s) this `logId` was read from. Length >1 ⇒ a **boundary duplicate** was collapsed at the logId-dedup step (§3.1); recorded for audit, never double-folded. |
| `deviceSource`          | string                                                       | —                 | `UserSleeps_*.data_source` / `Physical Activity_GoogleData` `data source` col | Device era (Pixel Watch vs older) — explains sampling-density and feature availability (catalog §0.2, §3.1).                                                                             |

### 1.1 Sleep architecture (M)

| Field                                                      | Type         | Units | Source                                                  | Computation                                                                                                                                                                |
| ---------------------------------------------------------- | ------------ | ----- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sleep.timeInBedMin`                                       | number       | min   | `sleep-*.json.timeInBed`                                | Direct.                                                                                                                                                                    |
| `sleep.asleepMin`                                          | number       | min   | `.minutesAsleep`                                        | Direct.                                                                                                                                                                    |
| `sleep.awakeMin`                                           | number       | min   | `.minutesAwake`                                         | Direct.                                                                                                                                                                    |
| `sleep.onsetLatencyMin`                                    | number       | min   | `.minutesToFallAsleep`                                  | Sleep onset latency.                                                                                                                                                       |
| `sleep.wasoMin`                                            | number       | min   | derived                                                 | Wake-After-Sleep-Onset = `minutesAwake − minutesToFallAsleep − minutesAfterWakeup` (clamp ≥0). For `classic` nights WASO = `restless+awake` minutes from `levels.summary`. |
| `sleep.efficiencyPct`                                      | number       | %     | `.efficiency`                                           | Device-reported (`minutesAsleep/timeInBed`-ish). Validate 0–100.                                                                                                           |
| `sleep.deepMin`                                            | number\|null | min   | `.levels.summary.deep.minutes`                          | `null` for `classic`.                                                                                                                                                      |
| `sleep.lightMin`                                           | number\|null | min   | `.levels.summary.light.minutes`                         | `null` for `classic`.                                                                                                                                                      |
| `sleep.remMin`                                             | number\|null | min   | `.levels.summary.rem.minutes`                           | `null` for `classic`.                                                                                                                                                      |
| `sleep.wakeMin`                                            | number\|null | min   | `.levels.summary.wake.minutes`                          | `null` for `classic`.                                                                                                                                                      |
| `sleep.deepPct/lightPct/remPct`                            | number\|null | %     | derived                                                 | `stageMin / asleepMin × 100` (REM/deep/light over **asleep**, not time-in-bed).                                                                                            |
| `sleep.remPeriods`                                         | number\|null | count | `.levels.data`                                          | Count of contiguous REM runs (REM fragmentation proxy).                                                                                                                    |
| `sleep.score`                                              | number\|null | 0–100 | `Sleep Score/sleep_score.csv.overall_score` via `logId` | Join on `logId`.                                                                                                                                                           |
| `sleep.compositionScore/revitalizationScore/durationScore` | number\|null | 0–100 | `sleep_score.csv`                                       | Subscores. **N** (nice-to-have).                                                                                                                                           |
| `sleep.restlessness`                                       | number\|null | —     | `sleep_score.csv.restlessness`                          | **N**.                                                                                                                                                                     |

### 1.2 SpO2 (M)

Source: `Oxygen Saturation (SpO2)/Minute SpO2 - *.csv` (per-minute, UTC `Z`) filtered to the night
window, **after the 50.0 sentinel-only filter** (catalog §4.3; see §2.1 for why the previous `< 70`
clause was removed). `Daily SpO2 - *.csv` used only as a cross-check, not the primary nightly value.

| Field                               | Type         | Units    | Computation (post-filter, §2.1)                                                                                                                                                             |
| ----------------------------------- | ------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `spo2.meanPct`                      | number\|null | %        | mean of valid minute values in window                                                                                                                                                       |
| `spo2.medianPct`                    | number\|null | %        | 50th pct                                                                                                                                                                                    |
| `spo2.minPct`                       | number\|null | %        | min of valid values (**after** sentinel filter — critical, §4.3)                                                                                                                            |
| `spo2.p5Pct`                        | number\|null | %        | 5th pct (robust "low" alternative to raw min)                                                                                                                                               |
| `spo2.pctTimeBelow90`               | number\|null | %        | fraction of valid minutes <90, ×100                                                                                                                                                         |
| `spo2.pctTimeBelow88`               | number\|null | %        | fraction <88 (clinical desaturation threshold), ×100                                                                                                                                        |
| `spo2.odiEstimate`                  | number\|null | events/h | **N** — estimated desaturation index; defer (true ODI needs ≥3–4% dip detection on a denser signal than 1/min; mark approximate).                                                           |
| `spo2.validMinutes`                 | number       | min      | count of valid minutes (the coverage denominator)                                                                                                                                           |
| `spo2.sentinelMinutesRemoved`       | number       | min      | count of in-window minutes dropped by the `=== 50.0` sentinel filter (logged per night, §2.1). Surfaced in `coverage` for audit.                                                            |
| `spo2.subSeventyNonSentinelMinutes` | number       | min      | count of in-window minutes with `1 ≤ value < 70 AND value !== 50.0` — **expected 0** in this export; any `> 0` raises a data-quality flag and is **never** auto-deleted (§2.1, finding #3). |

### 1.3 Heart rate (M)

Sleeping HR derived from raw `Global Export Data/heart_rate-*.json` (`MM/DD/YY` local, has
`confidence`), **streamed + aggregated on ingest**, restricted to the sleep window (catalog §3.2,
§3.1). Resting HR from `resting_heart_rate-*.json` (daily).

| Field               | Type                                 | Units | Computation                                                                                                        |
| ------------------- | ------------------------------------ | ----- | ------------------------------------------------------------------------------------------------------------------ |
| `hr.restingBpm`     | number\|null                         | bpm   | daily RHR for `nightKey` (or `nightKey`-derived calendar date) from `resting_heart_rate-*.json`                    |
| `hr.sleepingMinBpm` | number\|null                         | bpm   | min of window samples (confidence>0)                                                                               |
| `hr.sleepingAvgBpm` | number\|null                         | bpm   | mean of window samples                                                                                             |
| `hr.sleepingMaxBpm` | number\|null                         | bpm   | max of window samples                                                                                              |
| `hr.sleepingP10Bpm` | number\|null                         | bpm   | 10th pct — robust nadir                                                                                            |
| `hr.timeInZones`    | `{below, fatBurn, cardio, peak}` min | min   | `Global Export Data/time_in_heart_rate_zones-*.json` daily (whole-day, not window). **N** for nightly correlation. |

### 1.4 HRV (M)

| Field             | Type         | Units | Source                                               | Computation                                                                    |
| ----------------- | ------------ | ----- | ---------------------------------------------------- | ------------------------------------------------------------------------------ |
| `hrv.rmssdMs`     | number\|null | ms    | `Daily Heart Rate Variability Summary - *.csv.rmssd` | Nightly RMSSD. Tolerate parenthesized date suffix `- 2020-11-(15).csv` (§4.9). |
| `hrv.nremhrBpm`   | number\|null | bpm   | `Daily HRV Summary.nremhr`                           | Non-REM HR.                                                                    |
| `hrv.entropy`     | number\|null | —     | `Daily HRV Summary.entropy`                          | Sample entropy.                                                                |
| `hrv.coveragePct` | number\|null | %     | from `Details` 5-min rows                            | Mean coverage across the night's 5-min windows; gate (§2.4).                   |

### 1.5 Respiratory rate (M)

| Field                                          | Type         | Units       | Source                                                                                                                                                                  |
| ---------------------------------------------- | ------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| `rr.nightlyBrpm`                               | number\|null | breaths/min | `Daily Respiratory Rate Summary - *.csv.daily_respiratory_rate`                                                                                                         |
| `rr.deepBrpm / lightBrpm / remBrpm / fullBrpm` | number\|null | breaths/min | `Respiratory Rate Summary - *.csv` per-stage. **breaths/min** — never the milli-breaths/min `Physical Activity_GoogleData` variant (catalog §4.8). **N** for per-stage. |
| `rr.signalToNoise`                             | number\|null | —           | `Respiratory Rate Summary.*_signal_to_noise`                                                                                                                            | Quality gate. **N**. |

### 1.6 Readiness (M, daily)

| Field                                       | Type         | Units | Source (`Daily Readiness Score - *.csv`)                        |
| ------------------------------------------- | ------------ | ----- | --------------------------------------------------------------- | --- | ----------------- |
| `readiness.score`                           | number\|null | 0–100 | `readiness_score_value`                                         |
| `readiness.state`                           | `'LOW'       | 'MED' | 'HIGH'`                                                         | —   | `readiness_state` |
| `readiness.activitySub / sleepSub / hrvSub` | number\|null | —     | `activity_subcomponent / sleep_subcomponent / hrv_subcomponent` |

> Readiness is a _prior-day-into-morning_ composite. Key it to the **same `nightKey`** (its `date`
> field is the morning date) — it is the morning readiness reflecting that night.

### 1.7 Stress (M, daily)

| Field                                                        | Type         | Units | Source (`Stress Score.csv`)                                               |
| ------------------------------------------------------------ | ------------ | ----- | ------------------------------------------------------------------------- |
| `stress.score`                                               | number\|null | —     | `STRESS_SCORE` (skip rows where `CALCULATION_FAILED` truthy)              |
| `stress.sleepPoints / responsivenessPoints / exertionPoints` | number\|null | —     | respective `*_POINTS` (store raw, optionally normalize by `MAX_*_POINTS`) |
| `stress.status`                                              | string\|null | —     | `STATUS`                                                                  |

> `Stress Score.DATE` is the day the stress score describes. Map to the **preceding** night's
> `nightKey` (stress score is computed for a day using the _prior_ night's sleep among inputs) — but
> because the catalog does not pin the exact convention, store `stress.refDate` raw and resolve the
> ±1 mapping in the same reconciliation pass as alignment (§3), flagging the assumption for the ADR.

### 1.8 Snore / noise (M)

Source: `Snore and Noise Detect/Snore Details - *.csv` (per-30-s, ISO no-Z local), restricted to
window.

| Field                    | Type         | Units | Computation (§2.6)                          |
| ------------------------ | ------------ | ----- | ------------------------------------------- | ------ |
| `snore.snoreMinutes`     | number\|null | min   | (# 30-s epochs with `snore_label==1`) × 0.5 |
| `snore.snorePctOfSleep`  | number\|null | %     | `snoreMinutes / asleepMin × 100`            |
| `snore.meanDba`          | number\|null | dBA   | mean `mean_dba` over window epochs          |
| `snore.maxDba`           | number\|null | dBA   | max `max_dba`                               |
| `snore.totalSnoreEvents` | number\|null | count | Σ `snoring_events_number`                   | **N**. |

### 1.9 Activity (prior-day) (M, daily totals)

Daily totals from `Global Export Data/steps-*.json` etc. (per-minute string values → sum) + AZM dir.
**These are deliberately prior-day** confounders: key activity to the day _before_ `nightKey`
(daytime activity affects that night's sleep). Store as `activityPriorDay.*`.

| Field                            | Type         | Units | Source                                                                 |
| -------------------------------- | ------------ | ----- | ---------------------------------------------------------------------- |
| `activityPriorDay.steps`         | number\|null | count | Σ `steps-*.json` values for `nightKey−1` (cast string→number, §4.7)    |
| `activityPriorDay.azmMinutes`    | number\|null | min   | Σ `Active Zone Minutes (AZM)/*.csv.total_minutes` for `nightKey−1`     |
| `activityPriorDay.activeMinutes` | number\|null | min   | `very+moderately+lightly_active_minutes-*.json` daily for `nightKey−1` |

### 1.10 Temperature (M, nightly deviation)

| Field                 | Type         | Units         | Source                                                                                                                                                                                                                                                        |
| --------------------- | ------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `temp.skinDeviationC` | number\|null | °C (relative) | `Temperature/Computed Temperature.nightly_temperature` (baseline-relative); long-range fallback `Physical Activity_GoogleData/body_temperature_*` (catalog §2 Temperature; §4.9 the `Temperature/` dir stops 2024-06). Units °C — do not auto-convert (§4.8). |

### 1.11 Coverage / quality block (M)

```js
coverage: {
  insufficient: ['spo2', 'hrv'],   // metric groups gated out for this night (§2.9)
  spo2ValidMinutes: 412,
  spo2SentinelMinutesRemoved: 73,  // minutes dropped by the ===50.0 sentinel filter (§2.1)
  hrvWindows: 78,
  snoreEpochs: 880,
  hrSamples: 19340,
  // offset/window provenance flags (§3.2): 'offset-from-hint', 'offset-carry-forward',
  //   'offset-default-fallback', 'offset-disagreement', 'offset-infer-unstable';
  // data-quality: 'spo2-sub70-nonsentinel'; sleep: 'classic-sleep', 'split-sleep',
  //   'dup-window-mismatch', 'large-duration-mismatch'
  flags: ['classic-sleep', 'offset-carry-forward', 'large-duration-mismatch'],
}
```

### 1.12 Optional intraday handles (M for sleep+SpO2, else N)

Pointers to per-night detail arrays (§5), stored separately (IndexedDB) and lazy-loaded, **not** in
the nightly correlation store: `intraday.hypnogramRef`, `intraday.spo2MinuteRef`,
`intraday.hrvFiveMinRef`, `intraday.snoreThirtySecRef`, `intraday.hrMinuteRef`.

---

## 2. Aggregation formulas & validity filters

General rules:

1. **Window-restrict first** (§3) for all high-frequency series, then filter, then aggregate.
2. **Missing minute ≠ zero** for physiological metrics (catalog §4.13). Gaps reduce the coverage
   denominator; they are not imputed to 0.
3. **Coverage gate before reporting.** If a metric fails its minimum-coverage threshold, the nightly
   value is `null` and the group name is pushed to `coverage.insufficient[]`.
4. All aggregates ignore `NaN`/empty/sentinel rows; cast string values (`steps/distance/calories`)
   with `Number(...)` and drop `NaN`/empty (catalog §4.7).

### 2.1 SpO2 — **sentinel-only filter** (the highest-risk filter; finding #3, BLOCKER)

```
raw   = minuteRows where startUtc ≤ ts < endUtc            // window restrict (UTC series)
valid = raw where value !== 50.0                           // SENTINEL-ONLY (catalog §4.3)
                                                            // NO >=70 clause — see rationale below
gate:   len(valid) >= MIN_SPO2_VALID_MIN (=120 min)        // else spo2.* = null, mark insufficient
meanPct       = mean(valid.value)
medianPct     = quantile(valid.value, 0.5)
minPct        = min(valid.value)                            // post-filter min, never raw
p5Pct         = quantile(valid.value, 0.05)
pctTimeBelow90 = 100 * count(valid.value < 90) / len(valid)
pctTimeBelow88 = 100 * count(valid.value < 88) / len(valid)
validMinutes  = len(valid)

// --- logging / validation (mandatory) ---
sentinelMinutesRemoved      = count(raw where value === 50.0)            // log per night
subSeventyNonSentinelMinutes = count(raw where 1 <= value < 70 AND value !== 50.0)
if subSeventyNonSentinelMinutes > 0:
    coverage.flags += 'spo2-sub70-nonsentinel'                          // data-quality flag, do NOT drop
```

> **Why sentinel-only (the `< 70` clause is REMOVED).** The previous spec dropped
> `value < 70` as "belt-and-suspenders," reasoning that _every_ sub-70 value in this export is exactly
> 50.0. The empirical review confirms that **is true for this export today** (300 files / 145,931 rows:
> every sub-70 value == 50.0; the `>= 70` clause is redundant _here_). But the clause is **not safe to
> ship**:
>
> - It is **not equivalent** to the sentinel filter in principle — `!== 50.0` removes one floor value;
>   `>= 70` deletes an entire range `[1, 70)`.
> - For this tool's exact population — CPAP users, often **severe OSA** — a genuine calibrated nadir of
>   64–69% during an under-treated night is **the single most clinically important data point of the
>   night** and the direct physiological correlate of high AHI. The `>= 70` clause would **silently
>   delete real deep desaturations**, biasing `minPct`/`p5Pct` upward, zeroing `pctTimeBelow88` exactly
>   where it should spike, and **attenuating the headline AHI↔SpO2 ρ toward 0** — the opposite of the
>   feature's goal.
> - Therefore: **default to sentinel-only.** Log `sentinelMinutesRemoved` per night so a reviewer can
>   see how much the floor removed. A tighter cutoff must never be added without a **count-only**
>   validation pass (report counts of values in `[1, 70)` excluding exactly 50.0 across many files;
>   PHI-safe — counts only, never values) confirming the set is empty, _and_ a per-night
>   `subSeventyNonSentinelMinutes == 0` assertion in the aggregator.
>
> **The sentinel removal itself remains non-negotiable:** without dropping 50.0, ~15% of minutes
> (catalog §4.3) fabricate severe desaturations → `minPct` collapses to ~50 and `pctTimeBelow90`
> explodes, producing spurious strong AHI↔SpO2 correlations. Sentinel-only keeps that protection while
> never risking a real desaturation.

### 2.2 Sleeping HR (raw 67M-row stream)

```
samples = hrRows where startUtc ≤ ts < endUtc AND confidence > 0   // raw is MM/DD/YY local → convert
gate:    len(samples) >= MIN_HR_SAMPLES (=300)                     // ~ allow sparse older devices
sleepingMinBpm = min ; sleepingAvgBpm = mean ; sleepingMaxBpm = max
sleepingP10Bpm = quantile(samples, 0.10)
```

> HR must be **streamed/chunked in the Web Worker**; only window-restricted samples are retained
> transiently to compute these five scalars + the optional 1-min downsample (§5). Never hold the full
> series (catalog §3.1, §3.2, §5 cross-cutting).

### 2.3 HRV nightly

```
rmssdMs/nremhrBpm/entropy = direct from Daily HRV Summary row for nightKey
coveragePct = mean(Details rows.coverage in window)
gate: rmssd present AND coveragePct >= MIN_HRV_COVERAGE (=0.5) else null+insufficient
```

### 2.4 Respiratory rate — direct nightly values; per-stage gated by `signal_to_noise` if present.

### 2.5 Snore

```
epochs = snoreRows (30s) in window
gate: len(epochs) >= MIN_SNORE_EPOCHS (=120 ⇒ 1h) else null
snoreMinutes = 0.5 * count(epochs.snore_label == 1)
meanDba = mean(epochs.mean_dba) ; maxDba = max(epochs.max_dba)
```

### 2.6 Readiness / stress / temperature — single-row daily metrics; no aggregation, only sentinel

checks (`CALCULATION_FAILED`, empty rows, catalog §4.11) and ±1-day key mapping (§1.6–1.7, §1.10).

### 2.7 Activity daily totals — sum per-minute string values for the prior calendar day; cast & drop

non-numeric (catalog §4.7). Treat all-zero days as a valid 0 (steps legitimately can be 0), unlike
physiological gaps.

### 2.8 Minimum-coverage thresholds (defaults — document for tuning; ADR)

| Metric group                   | Constant                              | Default   | Rationale                                                                     |
| ------------------------------ | ------------------------------------- | --------- | ----------------------------------------------------------------------------- |
| SpO2                           | `MIN_SPO2_VALID_MIN`                  | 120 min   | ≥2h valid gives stable percentiles; below that `minPct`/`pctBelow` are noisy. |
| HR sleeping                    | `MIN_HR_SAMPLES`                      | 300       | ~5 min at older 1/s-ish cadence; permissive to keep classic-era nights.       |
| HRV                            | `MIN_HRV_COVERAGE`                    | 0.5       | <50% window coverage → unreliable RMSSD.                                      |
| Snore                          | `MIN_SNORE_EPOCHS`                    | 120 (1h)  | shorter windows over-/under-state snore%.                                     |
| Sleep night validity           | `MIN_ASLEEP_MIN`                      | 180 (3h)  | matches existing `SLEEP_DURATION_MIN`=3h (constants/fitbit.js).               |
| Night inclusion in correlation | `DATA_LIMITS.MIN_NIGHTS_FOR_ANALYSIS` | 7 (reuse) | existing constant.                                                            |

### 2.9 "Insufficient" vs "absent" — explicit contract

- **Absent:** source file/row does not exist for `nightKey` → field `null`, **not** in
  `coverage.insufficient`.
- **Insufficient:** source exists but fails coverage gate → field `null` **and** group name in
  `coverage.insufficient[]`. Correlation/UI can then say "5 nights had SpO2 data but too little to
  use" vs "no SpO2 device". This distinction must survive into the dashboard.

---

## 3. Night-keying & alignment algorithm

**Goal:** map each OSCAR CPAP summary row (labeled by morning date `Date`, columns
`Date/AHI/Median EPAP/Total Time/…` per `csvValidation.js`) to at most one `WearableNight`, and
resolve the per-night UTC offset needed to window-filter UTC series. This is the **biggest
correctness risk** (catalog §3b, §4.2).

### 3.1 Build wearable nights — **dedup by `logId` first** (finding #2, MAJOR)

`sleep-*.json` are ~30-day **chunk** files and the boundary session is re-exported in **both** adjacent
chunks: empirically **136 logIds appear in exactly two files** with identical windows. Keyed naively by
`dateOfSleep` this fakes **127 "split-sleep" nights**; after de-dup by `logId`, **zero** genuine
split-sleep remain. Folding without dedup would **double** stage minutes / duration / window for those
~127 nights (~3% of nights), poisoning every correlation they enter. So dedup is a mandatory,
**explicit, tested** ingest step that runs **before** any per-night folding.

```
// STEP 1 — read all sessions across all chunk files, dedup by logId (first-writer-wins)
byLogId = Map()                                   // logId -> session
for each file in sleep-*.json (deterministic order, e.g. by filename):
    for each session in file:
        if session.mainSleep != true: continue    // naps excluded (catalog §3b.4)
        if byLogId.has(session.logId):
            // boundary duplicate: keep first, just record provenance
            byLogId.get(session.logId).sourceFiles.push(file)
            // assert identical window (start/end/dateOfSleep) — else flag 'dup-window-mismatch'
            continue
        session.sourceFiles = [file]
        byLogId.set(session.logId, session)
dedupedSessions = byLogId.values()                // distinct logIds only

// STEP 2 — group distinct logIds by nightKey, then fold
for each nightKey, group in groupBy(dedupedSessions, s => s.dateOfSleep):
    if group.length == 1:
        s = group[0]
        startLocal = parseNaiveLocal(s.startTime) ; endLocal = parseNaiveLocal(s.endTime)
        offset = resolveOffset(nightKey, group)    // §3.2 (inference-primary)
        emit WearableNight(nightKey, s.logId, s.type, window{...}, sourceFiles=s.sourceFiles, ...)
    else:
        // GENUINE split sleep ONLY: >1 DISTINCT logId sharing a nightKey (none in this export)
        mergeSplitSleep(group)                     // union window (min start, max end), sum stage minutes
        coverage.flags += 'split-sleep'
```

- **De-dup is keyed on `logId`, not `dateOfSleep`.** Boundary duplicates (same `logId` in two files)
  are collapsed to one record; their extra `sourceFiles` are recorded for audit, never re-folded.
- **Split-sleep merge fires only on ≥2 _distinct_ logIds** sharing a `nightKey`. The path is kept for
  other users' exports but is expected to be inert for this one.
- **Regression test (hand to testing-expert):** feed two synthetic chunk files sharing one boundary
  `logId` with identical windows; assert the night's `timeInBed`/stage minutes are counted **once** and
  `sourceFiles.length == 2`.

### 3.2 Per-night UTC-offset resolution (`resolveOffset`) — **inference-primary** (finding #1, BLOCKER)

**Why the previous design was inverted.** The earlier spec made `UserSleeps_*.start_utc_offset` the
_preferred_ source. Empirically that field is a **placeholder**: it is `+00:00` for **88%** of rows and
**wrong by >1 h for 96%** of evaluated nights. The trap is that `UserSleeps.sleep_start` is stored in
the **same mislabeled-local clock** as the `sleep-*.json` `startTime` (both naive-local), so a `+00:00`
offset **self-validates within the sleep tables** (Δ≈0) yet completely fails to convert the
**real-`Z` UTC** SpO2/HR series — mis-windowing them by ~8 h and capturing essentially zero real
sleep-time data on those nights. Window-fit inference, by contrast, recovered the correct offset on
**59/60** nights (US-Pacific, DST-varying, ~90.6% SpO2-in-window). **So inference is now primary and
`UserSleeps` is demoted to an untrusted hint.**

The resolver returns `{ utcOffsetMinutes, windowSource, offsetDisagreementMin }`.

#### 3.2.1 PRIMARY — window-fit inference from the night's own UTC series

Use the night's own UTC-stamped samples (SpO2 preferred — recorded only during sleep; HR as
secondary) to find the offset that best lands them inside the naive-local sleep window.

```
INFER_OFFSET(nightKey, naiveStartLocal, naiveEndLocal):
    # candidate UTC samples: SpO2 (then HR) rows in the ±18h neighborhood of nightKey
    samples = utcSamplesNear(nightKey, hours=18)          # SpO2 first; fall back to HR if <MIN_INFER_SAMPLES
    if len(samples) < MIN_INFER_SAMPLES (=30): return MISS  # too sparse to infer this night

    windowMin = naiveStartLocal ; windowMax = naiveEndLocal   # treated as offset-free wall-clock
    best = null
    # SEARCH RANGE: offset ∈ [-840, +840] min (±14h), STEP 15 min  (covers all real zones incl. DST)
    for off in range(-840, +840, step=15):
        # shift each UTC sample into candidate-local time, count those inside the sleep window
        inside = count(s in samples where windowMin <= (s.utcTime + off) < windowMax)
        frac   = inside / len(samples)
        track (off, frac, inside)
    # OBJECTIVE: maximize frac (fraction of the night's own UTC samples inside the local window)
    # TIE-BREAK (within 1pp of the max frac, or exact frac ties):
    #   1. prefer the offset closest to the previous night's INFERRED offset (DST continuity),
    #   2. then the offset closest to the standard zone offset implied by the modal solution,
    #   3. then the smaller |off|.
    best = argmax_with_tiebreak(...)
    if best.frac < MIN_INFER_FRAC (=0.5): return LOW_CONFIDENCE(best.off)  # see fallback chain
    return { off: best.off, source: 'inferred' }
```

- **Objective:** maximize the fraction of the night's own UTC samples that fall inside the naive-local
  `[startLocal, endLocal]` window. Equivalent modal form (cheaper, used as a cross-check): the modal
  `(localStart − utcSampleStart)` rounded to 15 min. The two must agree within one step or
  `coverage.flags += 'offset-infer-unstable'`.
- **Search range** `±840 min` at **15-min** resolution (Fitbit offsets are always whole 15-min
  multiples; 15 min is also the empirical rounding that recovered 59/60 nights).
- **Per-night, never global.** A DST/travel boundary changes the inferred offset on exactly the night
  it occurs — which is the whole point of inferring per night.

#### 3.2.2 FALLBACK CHAIN (in order; record `windowSource`)

1. **`inferred`** (§3.2.1) when `frac ≥ MIN_INFER_FRAC`. Expected path for the vast majority of nights.
2. **`userSleeps-hint`** — only if inference is unavailable (sparse samples) **and** the UserSleeps
   `start_utc_offset` for this night is **non-`+00:00`** (a real, non-placeholder offset). Treat as a
   weak fallback, `coverage.flags += 'offset-from-hint'`.
3. **`carry-forward`** — the most recent **`inferred`** offset from a _nearby_ night
   (within `MAX_CARRY_NIGHTS = 2`). `coverage.flags += 'offset-carry-forward'`.
   > **Prefer fresh inference over stale carry-forward.** Carry-forward across an **uncovered
   > DST/travel boundary** applies one wrong offset to a _run_ of consecutive nights — systematic,
   > directional bias plus **spurious autocorrelation** in the aggregates that compounds the
   > effective-N problem (§4.3a). So carry-forward is capped at 2 nights, only ever copies an
   > **inferred** value (never a hint or another carry-forward), and is **suspect, not merely flagged**.
4. **`default-fallback`** — a single configured default offset, last resort only.
   `coverage.flags += 'offset-default-fallback'`. Nights resolved this way should be treated as
   alignment-suspect and feed the attenuation warning (§4.7).

#### 3.2.3 `UserSleeps` as untrusted hint + disagreement check

- `+00:00` from UserSleeps is **always treated as missing** (it is the placeholder, 88% of rows).
- When **both** an inferred offset and a non-`+00:00` UserSleeps hint exist, compute
  `offsetDisagreementMin = |inferred − hint|`. If `≥ 15 min`, **keep the inferred value**, discard the
  hint, and set `coverage.flags += 'offset-disagreement'`. UserSleeps may serve as a _sanity bound_
  (e.g. reject an inferred offset implying an impossible zone) but **never overrides inference**.

#### 3.2.4 Constants

| Constant                  | Default         | Rationale                                                                        |
| ------------------------- | --------------- | -------------------------------------------------------------------------------- |
| `OFFSET_SEARCH_MIN/MAX`   | −840 / +840 min | ±14 h covers all real IANA offsets incl. DST extremes.                           |
| `OFFSET_SEARCH_STEP`      | 15 min          | Fitbit offsets are whole 15-min multiples; matches the empirical rounding.       |
| `MIN_INFER_SAMPLES`       | 30              | below this, a single night's UTC series is too sparse to localize the window.    |
| `MIN_INFER_FRAC`          | 0.5             | require ≥50% of the night's UTC samples inside the window to trust inference.    |
| `MAX_CARRY_NIGHTS`        | 2               | cap carry-forward span to avoid riding through an uncovered DST/travel boundary. |
| `OFFSET_DISAGREEMENT_MIN` | 15 min          | hint discarded if it differs from inference by ≥ this.                           |

#### 3.2.5 Fixture tests (hand to testing-expert; all synthetic)

- A `+00:00`-reporting night whose synthetic SpO2/HR series is physically Pacific must resolve to
  ≈ −480/−420 min with `windowSource === 'inferred'` (**not** `'userSleeps-hint'`).
- A DST-transition night must infer a different offset than its neighbor (no carry-forward bleed).
- Carry-forward across a synthetic uncovered DST boundary must **not** apply the stale offset beyond
  `MAX_CARRY_NIGHTS`, and must flag `offset-carry-forward`.
- An inferred-vs-hint disagreement of ≥15 min must keep the inferred value and flag
  `offset-disagreement`.
- A sparse night (<`MIN_INFER_SAMPLES`) with a non-`+00:00` hint falls back to `'userSleeps-hint'`.

> **Re-validate coverage gates after this fix.** `MIN_SPO2_VALID_MIN`/`MIN_HR_SAMPLES` etc. (§2.8) were
> reasoned about assuming correct windows; with inference-primary windows now correct on ~all nights,
> confirm the gates still behave (a previously-mis-windowed night may now pass/fail differently).

### 3.3 Reconcile with OSCAR night labeling (±1 day)

OSCAR labels a night by the **morning** date (matches Fitbit `dateOfSleep`) **most** of the time, but
conventions can differ by a day (catalog §3b.1). Algorithm:

```
index wearableNights by nightKey (Map)
for each oscarRow (key = oscarRow.Date):
    cand = wearable[oscarKey]                       // exact
    if !cand: for d in [-1, +1]:                    // ±1-day reconciliation
                  c = wearable[oscarKey + d days]
                  if c and overlapHours(oscarRow, c) >= MIN_OVERLAP: cand = c; break
    if cand:
        ov = overlapHours(oscarRow, cand)           // via window vs OSCAR Total Time/session
        align(oscarRow, cand, matchType ∈ {exact, shifted+1, shifted-1}, overlapHours=ov)
    else:
        unmatchedOscar.push(oscarRow)
unmatchedWearable = wearableNights not consumed
```

- **Exact preferred over shifted**; a shifted match requires the overlap gate (`MIN_OVERLAP_HOURS=4`,
  existing constant) to avoid stealing a neighbor's night.
- **One-to-one:** once a `WearableNight` is consumed it cannot match another OSCAR row (greedy by
  exact-first, then by best overlap), mirroring the de-dup intent in `fitbitSync.js` but driven by
  `dateOfSleep` rather than the noon heuristic.
- **`classic` nights:** align normally; downstream features that need stage minutes degrade
  gracefully (fields `null`, `coverage.flags += 'classic-sleep'`) — not an error (catalog §3b.5).
- **Missing wearable night:** OSCAR row → `unmatchedOscar` (CPAP-only night; still usable for
  CPAP-internal analytics, excluded from cross-correlation).
- **Missing CPAP night:** `WearableNight` → `unmatchedWearable` (wearable-only).

### 3.4 `AlignedNight` output shape

```js
{
  nightKey, matchType, overlapHours,
  oscar: { ahi, centralAhi?, obstructiveAhi?, hypopneaAhi?, medianEpap, ipap?, usageHours,
           leakPercent?, ... },        // parsed from OSCAR summary row (Median EPAP, Total Time→hours)
  wearable: WearableNight,
  quality: { overlapHours, durationMismatchHours, windowSource, flags: [...] }
}
```

`durationMismatchHours = |usageHours − asleepMin/60|`; flag `>2h` (mirrors existing
`validateAlignment`, but as a _quality flag_, not an exclusion — exclusion is a correlation-time
decision, §4).

### 3.5 Pseudocode contract & edge cases (for the testing-expert to cover)

- Empty either side → empty aligned set, full unmatched lists, no throw.
- All naps (no `mainSleep`) → zero wearable nights.
- **Boundary duplicate** (same `logId` in two chunk files) → collapsed to one night, counted once,
  `sourceFiles.length == 2` (§3.1).
- **Genuine split sleep** (≥2 _distinct_ logIds, same `nightKey`) → merged once.
- Inference impossible (sparse UTC samples) and no non-`+00:00` hint → `carry-forward` (≤2 nights) or
  `default-fallback`, every such night flagged and treated alignment-suspect (§3.2.2, §4.7).
- OSCAR `Date` non-parseable → `unmatchedOscar` with reason, no throw.
- DST night (23h/25h local day) → window still correct because the offset is **inferred per-night**
  (§3.2.1), and carry-forward will not bleed a stale offset across the boundary (§3.2.2).

---

## 4. Correlation engine design

### 4.1 Metric pairs — **frozen, pre-registered constant** (findings #5, #10)

The pair list is a **versioned constant** owned by data-scientist and **frozen before looking at this
user's data** (`PAIR_REGISTRY_VERSION`, emitted in the engine output, §4.9). It carries a comment
_"pre-registered — do not edit to chase significance."_ Per-family BH (§4.4) is only defensible if the
**primary** family is fixed in advance; reviewers (`code-quality-enforcer` / `readiness-reviewer`)
should block edits to the primary list that lack a documented rationale. **Single-subject caveat:** with
one user, "pre-registration" is weak; **all findings are hypothesis-generating, not confirmatory** —
state this in the UI.

Each pair carries an **expected sign** and a **plausible |ρ| band**. Each band is tagged for provenance:
**[lit]** = grounded in published OSA physiology (between-patient literature; see caveat below);
**[heur]** = heuristic / clinical-judgment, **not** a cited magnitude. The bands feed only the
_one-sided wrong-sign tripwire_ (§4.7), never a "this is real" claim.

| #   | CPAP (x)    | Wearable (y)          | Expected sign                    | Plausible \|ρ\| | Tag    | Clinical rationale                                                                                                                                                                                                                                        |
| --- | ----------- | --------------------- | -------------------------------- | --------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | AHI         | `spo2.minPct`         | −                                | 0.2–0.5         | [lit]  | More apneas → deeper desaturations.                                                                                                                                                                                                                       |
| 2   | AHI         | `spo2.pctTimeBelow90` | +                                | 0.2–0.5         | [lit]  | Apnea burden ↔ hypoxic burden.                                                                                                                                                                                                                           |
| 3   | AHI         | `hrv.rmssdMs`         | −                                | 0.2–0.5         | [lit]  | Apnea ↑ sympathetic tone, ↓ RMSSD.                                                                                                                                                                                                                        |
| 4   | AHI         | `hr.sleepingAvgBpm`   | +                                | 0.2–0.5         | [lit]  | Apnea arousals raise sleeping HR.                                                                                                                                                                                                                         |
| 5   | AHI         | `rr.nightlyBrpm`      | **±** (uncertain)                | 0.0–0.3         | [heur] | On _treated_ nights residual AHI is low and RR is dominated by fitness/illness/anxiety; sign may be ~0 or negative. **Excluded from the wrong-sign tripwire.**                                                                                            |
| 6   | AHI         | `snore.snoreMinutes`  | +                                | 0.2–0.5         | [lit]  | Residual obstruction ↔ snoring.                                                                                                                                                                                                                          |
| 7   | AHI         | `sleep.efficiencyPct` | −                                | 0.2–0.4         | [lit]  | Apneas fragment sleep.                                                                                                                                                                                                                                    |
| 8   | Median EPAP | `spo2.minPct`         | **± (confounded by indication)** | 0.0–0.4         | [heur] | EPAP is _titrated to severity_: higher EPAP often marks **more severe** disease, which can invert the naive "pressure splints airway → better O₂" expectation. A negative ρ here is plausibly **real**. **Excluded from the wrong-sign tripwire** (§4.7). |
| 9   | Usage hours | `readiness.score`     | +                                | 0.1–0.4         | [heur] | Adherence ↔ next-day readiness.                                                                                                                                                                                                                          |
| 10  | Usage hours | `hrv.rmssdMs`         | + (weak)                         | 0.0–0.3         | [heur] | Within-subject nightly usage↔next-morning HRV is weak and lag-confounded; expect ~0.                                                                                                                                                                     |
| 11  | Leak %      | `sleep.efficiencyPct` | −                                | 0.1–0.3         | [heur] | Leaks disrupt sleep (if leak col present).                                                                                                                                                                                                                |
| 12  | AHI         | `stress.score`        | + (weak)                         | 0.0–0.3         | [heur] | Fitbit stress score is partly **derived from sleep/HRV** → risk of **circularity** (non-independent constructs); not a clean external correlate.                                                                                                          |

> **All bands are between-night within a single subject**, where effect sizes are typically _smaller and
> noisier_ than the between-patient literature the [lit] tags borrow from. Treat the magnitudes as
> directional priors, not clinical thresholds. Pairs 1–4, 6, 7 (the primary core) are the well-grounded
> ones; 5, 8, 10, 12 are deliberately softened and 5/8 carry two-sided expectations.

Pairs 1–4, 6, 7, 9 are **primary** (pre-registered); the rest are **exploratory** and labeled as
such in the UI (affects multiple-comparison correction, §4.4).

### 4.2 Statistical methods (what to use when)

- **Default: Spearman ρ** (`spearmanCorrelation`, point estimate reused as-is) for every pair —
  physiological data is non-normal, monotonic, outlier-prone. **But the p-value path is amended for
  ties (finding #7a):** `spearmanCorrelation` derives p from `t = ρ·√((n−2)/(1−ρ²))` at `df=n−2`
  **without tie correction**. The wearable data is heavily tied (integer-ish SpO2 %; readiness
  `LOW/MED/HIGH`; AHI clustered at 0 and small integers; snore-minutes in 0.5 steps), so the t-p is
  **anticonservative**. Therefore:
  - **Detect heavy ties:** if any value's multiplicity exceeds **20%** of n in _either_ series, switch
    that pair's p to a **two-sided permutation p-value** — shuffle `y` `B≥2000` times, recompute ρ,
    `p = (1 + #{|ρ_perm| ≥ |ρ_obs|}) / (B + 1)`. Assumption-free and robust to ties.
  - For inherently ordinal/low-cardinality `y` (readiness state, AHI buckets) prefer **Kendall τ-b**
    (tie-aware) as an alternative reported statistic.
  - The permutation/τ-b p then feeds `n_eff` adjustment (§4.3a) and BH (§4.4). Always report which p
    method was used per pair. **Test:** a heavily-tied fixture must yield permutation p ≥ naive t-p.
- **Mann-Whitney U** (`mannWhitneyUTest`, reuse) for **group contrasts** with **pinned thresholds**
  (constants owned by data-scientist, _not_ user-facing sliders — §4.4): compare `hrv.rmssdMs` on
  **high-AHI (AHI≥15)** vs **low (AHI<5)** nights, or readiness on **adherent (≥4h)** vs non-adherent.
  Report rank-biserial effect size alongside U. Each group test **counts toward the BH family** (§4.4).
  _(MW exact-DP precision caveat: verify exact mode against a reference near n≈28 with ties, or cap
  exact mode at n≤20 and use the tie-corrected normal approx above — finding #7d/6d.)_
- **Partial correlation** (`partialCorrelation`, **limited-use** per §0) — point-estimate diagnostic
  only, **no p-value** (its df is wrong and it is Pearson, not rank-based). Behind the "advanced"
  toggle, labeled "no significance test."
- **Lag analysis — `nightlyLagCorrelation` is the SOLE public lag path (finding #7b).**
  `crossCorrelation` (`stats.js`) is **positional** (`slice` by array index, not date) **and
  sign-flipped** (emits `lag: -lag` while its docstring claims "positive lag: y leads x"). Calling it
  directly on a gappy nightly series silently misaligns lags and inverts cause/effect in the UI. So:
  - Implement `nightlyLagCorrelation(seriesByDate_x, seriesByDate_y, maxLag)` that **builds a
    calendar-dense array first** (one slot per date over the union span; missing dates = `NaN`), then
    for each lag does **pairwise deletion** of `NaN` pairs and a date-correct Spearman.
  - **Lag-sign convention (defined here, single source of truth):** **positive lag `k` means x at night
    `d` is paired with y at night `d + k`** — i.e. "does today's AHI relate to HRV `k` nights _later_."
    Re-derive this in the wrapper; do **not** copy `crossCorrelation`'s flipped label. Document it once
    in the wrapper's docstring.
  - Keep `maxLag` small (**≤7 nights**). **Test:** construct `y = x` shifted by **+2 calendar nights**
    with deliberate gaps; assert the wrapper reports its peak at lag **+2** with the correct sign.
  - **Inference rule (finding #5):** **only lag-0 is inferential.** The lag profile (lags ≠ 0) is
    reported **descriptively** (a curve), never as a significance-tested peak. See §4.4.
- **Granger / VAR — RETIRED (finding #8).** `grangerCausalityTest` is a stub (hard-coded AR
  coefficients `0.5*y+0.3*x`; non-F "CDF"). Remove/hide; never surface as causal evidence.

### 4.3 Minimum-n gating

- Per pair: require `n_valid ≥ DATA_LIMITS.MIN_CORRELATION_SAMPLE_SIZE` (=10, existing) **after**
  pairwise deletion; below that return `{correlation:null, reason:'insufficient-n', n}`.
  `spearmanCorrelation` already returns `NaN` for `n<3`; we add the n≥10 gate at the engine layer.
- Whole-analysis gate: `≥ MIN_NIGHTS_FOR_ANALYSIS` (=7) aligned nights, else show "not enough
  overlapping nights" instead of any correlations.

### 4.3a Serial-correlation / effective-N correction (finding #3, BLOCKER)

Every inferential test in this engine otherwise treats nights as i.i.d., but **consecutive nights are
autocorrelated** (a cold, a pressure change, a new mask, travel, an alcohol stretch all persist over
many nights — the project already ships `computeAutocorrelation`/`computePartialAutocorrelation` for
exactly this reason). Positive autocorrelation in **both** x and y inflates the apparent information
content: the variance of ρ̂ is understated, so the naive t/permutation p and the BH-FDR built on it are
**anticonservative** — the precise failure mode that yields _confident, wrong_ medical-adjacent claims.
Carry-forward offsets (§3.2.2) make this worse by injecting serially-correlated window error.

**Mandatory correction — report `n_eff` and an autocorrelation-adjusted p for every pair:**

```
# x, y are the pairwise-complete, date-ordered nightly series for this pair
r1x = lag1Autocorr(x)        # reuse computeAutocorrelation(x, maxLag=1).values[1].autocorrelation
r1y = lag1Autocorr(y)        # same for y; treat NaN as 0
rho_ratio = (1 - r1x*r1y) / (1 + r1x*r1y)
n_eff = clamp(n * rho_ratio, 2, n)          # effective sample size
# recompute the SAME test statistic's p at the reduced df:
#   Spearman/τ path: p_adj = 2*(1 - studentTCDF(|t|, n_eff - 2)),  t computed from rho as usual
#   (for the permutation path, scale the reference t-df to n_eff-2 for the reported adjusted p)
report { rho, n, n_eff, r1x, r1y, pValue (naive), pValueAdj (n_eff), method }
if max(r1x, r1y) > 0.3:  warnings += 'serial-correlation: p adjusted via n_eff (n_eff < n)'
```

- **Both naive-n and n_eff p are shown**; BH (§4.4) operates on **`pValueAdj`**, not the naive p.
- Constants: lag-1 only (cheapest defensible correction); `SERIAL_WARN_R1 = 0.3`.
- **Optional (recommended for headline pairs): moving-block bootstrap CI.** Resample contiguous
  night-blocks of length `BLOCK_LEN ≈ 7`, recompute ρ per resample, report the 2.5/97.5 percentile CI as
  the headline interval (respects serial structure better than any t-CI). If shown, the bootstrap CI
  leads and the p is demoted.
- **Test (hand to testing-expert):** inject AR(1) noise (ρ≈0.4) into a synthetic pair; assert
  `n_eff < n`, `pValueAdj > pValue`, and the serial-correlation warning fires.
- This is also an enforcement of the "effect size governs the headline, not p" principle: when
  autocorrelation is high, lead with effect size + `n_eff` + offset provenance, not the badge.

### 4.4 Multiple-comparisons correction — **Benjamini-Hochberg over the FULL family** (finding #5)

The real family is **not** "12 pairs." Hidden multiplicity inflates it: selecting the **peak over ~15
lags** per pair, MW **group contrasts** (each with a researcher-chosen threshold), partial-corr toggles,
and re-runs on date-range changes. BH applied only to the 12 pairs badly under-counts the denominator.
Decisions for this engine:

- **Lags are not multiplicity-laundered:** **only lag-0 is inferential** (§4.2). The lag profile is
  **descriptive only** — never report a selection-inflated "peak lag" as significant. (This removes the
  ~15-tests-per-pair inflation at the source rather than correcting for it.)
- **Count ALL session tests into the family:** the BH family size `m` = (number of pair lag-0 Spearman
  tests actually run) **+** (number of MW group-contrast tests run). Surface a visible **"tests run: N"**
  counter so the user sees the true denominator. Partial correlations carry **no p-value** (§0/§4.2) so
  they do not enter the family.
- **Pinned thresholds:** group-contrast cutoffs (AHI≥15 / AHI<5, adherence≥4h) are **constants owned by
  data-scientist**, _not_ user-facing sliders, so they cannot become a garden-of-forking-paths knob.
- **Per-family BH, but honest:** BH at **q=0.05** within the **primary** family (frozen list, §4.1).
  For the **exploratory** family, given the small screen + hidden multiplicity, either use **q=0.10
  clearly labeled "exploratory only"** or present exploratory results **without significance badges**.
- Algorithm (new util `benjaminiHochberg(pValues, q)`): sort p ascending; `pᵢ` significant iff
  `pᵢ ≤ (i/m)·q`; report raw `pValueAdj` (the n_eff-adjusted p from §4.3a) and `qValue` per test.
- **Single-subject caveat surfaced in UI:** even with BH and a frozen family, one user's data is
  hypothesis-generating, not confirmatory (§4.1).

### 4.5 Non-overlapping date ranges

SpO2/HRV/snore exist only from ~2020–2021 onward (catalog §1.3–1.10), HR from 2016, sleep from 2014,
OSCAR from whenever therapy started. The engine must:

- Compute each pair on the **intersection** of dates where _both_ metrics are non-null (pairwise
  deletion, §4.6), and **report the per-pair `n` and date span** so a ρ from 12 nights isn't shown
  next to one from 800 as equals.
- Never union across canonical sources for the same metric (no double-counting; catalog §4.10).

### 4.6 Missing-data handling — **pairwise deletion, no imputation (default)**

- Each pair uses only nights where both x and y are finite (Spearman already filters NaN pairs).
- **Imputation off by default.** The existing `imputeMissingValues` is a stub (random-noise
  regression) and imputing a _dependent physiological_ variable before correlating it **inflates**
  correlation — statistically invalid here. If a future "complete-case matrix" view is wanted, use
  listwise deletion across the chosen metrics, never model-based imputation, and never feed imputed
  values into a correlation p-value.

### 4.6a Coverage-gating is MNAR selection bias — make it visible (finding #6, MAJOR)

The coverage gates (§2.8) drop low-coverage nights per pair, and that missingness is almost certainly
**not at random**: a night the user tossed/turned, removed the mask, or had the watch slip yields
**less** valid SpO2/HRV coverage **and** plausibly a worse physiological night (higher AHI, more
arousals). Dropping it removes the **bad tail** of the joint distribution → **range restriction →
attenuates** the headline AHI↔(SpO2/HRV) ρ toward 0, stacking with the offset (#1) and the (now-fixed)
filter (#3) biases. The sign of the bias is data-dependent, so it must be **surfaced, not assumed**.

Per pair, the engine reports and the UI surfaces:

- `nDroppedInsufficient` and `nKept`.
- **Kept-vs-dropped distributions** of x (**AHI**) and of the gated y (**SpO2 / HRV**): report
  median + IQR for each group (PHI-safe summaries, not raw values).
- **Mann-Whitney selection test** on **AHI: dropped-for-insufficiency vs kept**. If dropped nights have
  systematically higher AHI (`p < 0.05`), emit
  `warnings += 'coverage-selection: dropped nights have higher AHI; ρ may be attenuated'`.
- **Relaxed-gate sensitivity analysis:** recompute each headline pair with a relaxed gate
  (e.g. `MIN_SPO2_VALID_MIN` → 60 min) and report whether ρ moves materially
  (`|Δρ| > SENSITIVITY_DELTA = 0.1` ⇒ `warnings += 'coverage-sensitive result'`).
- Document the trade-off: gates buy **percentile stability** at the cost of **selection bias**; the
  120-min default (~25% of an 8 h night) is chosen for stability, **not** for unbiasedness — say so.
  (A coverage-as-covariate partial-correlation variant is possible but out of v1 scope; §0.)

### 4.7 Plausibility canary — **one-sided gross wrong-sign tripwire only** (finding #9, reframed)

**The previous framing was unsound.** A canary that fires only on `|ρ|≥0.5 & q<0.05 & wrong sign`
catches the **rare loud** failure (a sign flip) but is **blind to the common quiet one**: the typical
consequence of a wrong offset, an over-aggressive filter, or coverage selection is **attenuation toward
zero** (regression dilution), which the canary never sees. Worse, its silence implied "alignment is
fine" — **false confidence**. It is **not** a correctness/alignment control and must not be labeled one.

Reframed into two independent checks:

1. **Gross wrong-sign tripwire (one-sided, narrow):** fire **only** when `sign(ρ)` contradicts a pair's
   expected sign **and** `|ρ| ≥ 0.5` **and** `pValueAdj < 0.05`, and present it strictly as _"gross
   wrong-sign — likely a data/wiring bug, investigate before reporting."_ Explicitly **not** evidence of
   correct alignment when silent.
   - **Exclude two-sided pairs from this rule:** pairs **5 (AHI↔RR)** and **8 (EPAP↔minSpO2)** have
     legitimately uncertain/invertible signs (§4.1; EPAP↔minSpO2 is **confounded by indication** — a
     negative ρ is plausibly _real_). A wrong-signed result on these is **not** flagged.
   - Do not gate solely on `q<0.05` for the "this is a finding" claim; tie findings to effect size +
     `n_eff` + offset provenance (§4.3a).
2. **Attenuation / coverage-driven warning (the check the old canary was missing):** for each **primary**
   pair, raise `warnings += 'attenuation-risk'` when the contributing nights have **high gating loss**
   (§4.6a selection test fires, or `nDroppedInsufficient / (nKept+nDroppedInsufficient) > 0.3`) **or** a
   high share of **non-`inferred` offsets** (`carry-forward`/`default-fallback` > 20% of contributing
   nights, §3.2). This is the realistic alignment-/filter-bug signature and complements the wrong-sign
   tripwire's blind spot.

Effect-size bands (negligible <0.1, small 0.1, medium 0.3, large 0.5) are reused for _interpretation_
only and **never** as a significance gate.

### 4.8 Reuse vs add vs retire — summary

| Reuse as-is                                                                                                                                                                    | Reuse internal-only                                           | Add (new, small, unit-tested)                                                                                                                                                                                                                                                                                                                                                                                  | **Retire / limited-use**                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `spearmanCorrelation` (point estimate), `mannWhitneyUTest`, `pearson`, `quantile`, `assignRanks`, Student-t/incomplete-beta, **`computeAutocorrelation`** (for `n_eff`, §4.3a) | `crossCorrelation` (positional + sign-flipped — wrapped only) | `benjaminiHochberg(pVals,q)`; `nightlyLagCorrelation` (date-dense, lag-sign-correct wrapper); tie-aware **permutation p** + optional **Kendall τ-b**; **`n_eff`-adjusted p** (§4.3a); optional **moving-block bootstrap CI**; the pair-runner (n-gate + n_eff + BH-over-full-family + canary + attenuation warning); coverage-gated aggregators (§2); coverage-selection MW + relaxed-gate sensitivity (§4.6a) | **RETIRE:** `grangerCausalityTest`, `buildLinearRegression`/`predict()`, `regressionImputation`/`imputeMissingValues`, **`computeOscarFitbitCorrelations`** (divergent path; migrate `fitbitAnalysis.js`/`useFitbitAnalysis.js` first). **LIMITED-USE:** `partialCorrelation` (point estimate only, no p-value). |

### 4.9 Engine output shape

```js
{
  pairRegistryVersion: 'v1',                 // frozen pre-registered family (§4.1)
  familySize: 14,                            // ALL session tests counted (pairs lag-0 + group tests), §4.4
  testsRun: 14,                              // visible "tests run: N" denominator
  pairs: [{
    x, y, family:'primary'|'exploratory', expectedSign, bandTag:'lit'|'heur',
    rho, effectSize, dateSpan:{from,to},
    n, nEff, r1x, r1y,                        // serial-correlation diagnostics (§4.3a)
    pMethod:'t'|'permutation'|'kendall',      // tie handling (§4.2)
    pValue,                                   // naive (df = n-2)
    pValueAdj,                                // n_eff-adjusted (df = n_eff-2) — BH operates on THIS
    qValue, survivesFDR,
    bootstrapCI?:{ lo, hi, blockLen },        // optional moving-block CI (§4.3a)
    coverage:{ nKept, nDroppedInsufficient, keptAhi:{median,iqr}, droppedAhi:{median,iqr},
               selectionMW_p, relaxedGateRho, deltaRho },   // MNAR diagnostics (§4.6a)
    offsetProvenance:{ inferredPct, carryForwardPct, defaultFallbackPct },  // §3.2
    lagProfile?:[{ lag, rho }],               // DESCRIPTIVE only; lag-0 is the sole inferential point (§4.4)
    flags:[ 'gross-wrong-sign'?, 'attenuation-risk'?, 'serial-correlation'?,
            'coverage-sensitive'?, 'coverage-selection'? ]
  }],
  groupTests: [{ name:'HRV: high-AHI(≥15) vs low-AHI(<5)', U, p, qValue, rankBiserial, nA, nB }],
  nAlignedNights, familyQThresholds:{ primary:0.05, exploratory:0.10 },
  warnings: [...],                            // engine-level (e.g. coverage-selection, attenuation-risk)
  singleSubjectCaveat: true                   // findings are hypothesis-generating, not confirmatory (§4.1)
}
```

---

## 5. Intraday drill-down model (single-night detail)

Stored separately from the nightly correlation store (IndexedDB, lazy-loaded by `nightKey`); never
loaded for the whole history at once (catalog §3.2 column (b), §5). All series are pre-clipped to the
night window and pre-filtered.

| View                  | Shape                                   | Source (post §2 filter)                                                                       | Notes                                                                                                    |
| --------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------- | ----------------------------------------- | -------- | -------------------------------------------------------------- |
| **Hypnogram**         | `[{tStartLocal, tEndLocal, stage:'deep' | 'light'                                                                                       | 'rem'                                                                                                    | 'wake'}]`                          | `sleep-*.json.levels.data` (+`shortData` for brief epochs) | For `classic`, stages collapse to `asleep | restless | awake`. The reference timeline for overlaying everything else. |
| **SpO2 minute**       | `[{tLocal, pct}]`                       | Minute SpO2 in window, **after `===50.0` sentinel drop only** (§2.1)                          | Gaps left as gaps (no interpolation). Real sub-70 nadirs are **retained** and shaded. Shade `<90`/`<88`. |
| **HRV 5-min**         | `[{tLocal, rmssd, coverage}]`           | HRV `Details` in window                                                                       | Drop low-coverage points or render faded.                                                                |
| **Snore 30-s**        | `[{tLocal, meanDba, maxDba, snore:0     | 1}]`                                                                                          | `Snore Details` in window                                                                                | Render as a snore-band + dBA line. |
| **Sleeping-HR 1-min** | `[{tLocal, bpm}]`                       | raw HR window-restricted, **downsampled to 1/min** (mean of sub-minute samples, confidence>0) | Downsample during ingest; never store 2–5s raw.                                                          |

Cross-view contract: a single shared **local time axis** = the night window `[startLocal, endLocal]`;
all series carry `tLocal` (the **inferred** offset already applied, §3.2) so charts overlay without
per-series TZ math. This is what makes the alignment offset pay off twice — once for nightly stats,
once for the overlay. (See `medical-data-visualization` skill for hypnogram/overlay conventions and
accessibility: colorblind-safe stage palette, banded thresholds, dual-axis labeling.)

---

## 6. Open decisions for the ADR

1. **Offset fallback policy** is now **resolved by §3.2:** inference-primary; UserSleeps demoted to an
   untrusted hint (`+00:00`/≥15 min disagreement = missing); carry-forward (≤2 nights, inferred-only)
   below fresh inference; configured default last. _Remaining ADR choice:_ the value of the
   `default-fallback` offset and whether to instead **drop** a night from UTC-series stats when even
   inference fails. Recommend drop-from-UTC-stats (mark `insufficient`) over a guessed default.
2. **Stress/readiness ±1-day key convention** — still needs one empirical check against a few known
   nights (no real values in this doc); pick a convention and pin it. **Acceptance gate**, not post-hoc.
3. **Whether to surface partial-correlation / lag / group-contrast** in v1 or behind an "advanced"
   flag. Recommend: Spearman (lag-0) + `n_eff` + BH-over-full-family + canary/attenuation warnings in v1
   core; MW group-contrast (pinned thresholds) in v1; partial correlation behind advanced **without a
   p-value**; lag profile descriptive-only; Granger retired.
4. **ODI estimation** from 1/min SpO2 — defer (signal too coarse for true 3–4% dip ODI; mark
   approximate if shown).
5. **Effective-N method** — lag-1 `n_eff` is the v1 default (§4.3a); whether to also ship the
   moving-block bootstrap CI for headline pairs in v1 or defer is an ADR call. Recommend ship for the
   primary family.

> **Acceptance gates (load-bearing assumptions that must be verified PHI-safely _before_ "Accepted",
> not treated as tuning):** (a) inference-primary offset recovers Pacific on the `+00:00` nights
> [validated: 59/60]; (b) logId-dedup eliminates the fake split-sleep nights [validated: 127→0];
> (c) sub-70 SpO2 values are exactly 50.0 by count-only check before any cutoff tighter than the
> sentinel is ever added [validated today; re-check on new exports]; (d) OSCAR↔`dateOfSleep` ±1-day
> labeling; (e) stress/readiness ±1-day mapping.

---

## 7. Validation plan (hand-off to testing-expert / oscar-test-data-generation)

- **Aggregation unit tests** with synthetic shapes: SpO2 night where 15% of minutes are 50.0 →
  assert `minPct`/`pctTimeBelow90` ignore them and `sentinelMinutesRemoved` is logged; a synthetic
  **real sub-70 (e.g. 66%) non-sentinel** minute must be **retained** (not deleted) and must set
  `subSeventyNonSentinelMinutes>0` + the `spo2-sub70-nonsentinel` flag (finding #3); empty/single
  point/all-sentinel nights → `null` + `insufficient`.
- **Offset/alignment tests (finding #1):** `+00:00`-reporting Pacific night resolves to `inferred`
  ≈ −480/−420 (not `userSleeps-hint`); DST-transition night infers a different offset than its
  neighbor; carry-forward does not bleed past `MAX_CARRY_NIGHTS`; inferred-vs-hint ≥15 min keeps
  inferred + flags `offset-disagreement`; sparse night with non-`+00:00` hint → `userSleeps-hint`.
- **Dedup tests (finding #2):** two chunk files sharing a boundary `logId` → night counted once,
  `sourceFiles.length==2`; two **distinct** logIds same `nightKey` → genuine split-sleep merge.
- **Engine tests:** n-gate boundary (n=9 vs 10); BH over the **full family** against a hand-computed
  example; **AR(1) fixture** asserts `n_eff < n` and `pValueAdj > pValue` + serial-correlation warning
  (finding #3/§4.3a); **heavy-tie fixture** asserts permutation p ≥ naive t-p (finding #7a);
  **lag-sign fixture** (`y = x` shifted +2 calendar nights with gaps) asserts peak at lag +2, correct
  sign, via `nightlyLagCorrelation` only (finding #7b); **MNAR fixture** where dropped nights have
  higher AHI asserts the coverage-selection warning + relaxed-gate Δρ reported (finding #6); gross
  wrong-sign tripwire fires on an injected strong wrong-signed pair **but not** on pairs 5/8
  (finding #9); pairwise deletion across non-overlapping date ranges.
- **No real export values** in any fixture (catalog PHI note; `oscar-privacy-boundaries` skill).

```

```
