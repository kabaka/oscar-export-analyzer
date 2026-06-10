/**
 * Per-metric nightly aggregators (§2 of the design doc). Each takes a night's
 * already-window-restricted raw samples and produces the nightly stat sub-object
 * for {@link createWearableNight}, applying the metric's coverage gate and the
 * absent/insufficient contract (§2.9).
 *
 * Pure functions, no DOM/worker/IndexedDB. The caller (Phase 3 worker) is
 * responsible for window-restricting the high-frequency series FIRST (§2 rule 1);
 * these functions assume `samples` are already inside the night window.
 *
 * General rules honored here (§2):
 *   - missing minute ≠ zero (gaps reduce the coverage denominator, never imputed);
 *   - coverage gate before reporting (fail → `null` value + `insufficient`);
 *   - ignore NaN/empty rows.
 *
 * @module utils/wearable/aggregators
 */

import { quantile } from '../stats.js';
import {
  WEARABLE_COVERAGE,
  SPO2_SENTINEL_VALUE,
  SPO2_DESAT_THRESHOLD_90,
  SPO2_DESAT_THRESHOLD_88,
  SPO2_SUBSEVENTY_FLOOR,
  PCT_MEDIAN,
  PCT_P5,
  PCT_P10,
} from '../../constants/wearableConstants.js';

/** Mean of a numeric array (assumes non-empty). @private */
function mean(values) {
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

/**
 * Result of an aggregator that gated out: a `null` group value plus the bookkeeping
 * the caller needs to record an "insufficient" entry. Returned by the SpO2/HR/etc.
 * aggregators so the night-folding step can push `group` to `coverage.insufficient[]`.
 * @private
 */
function insufficient(group, extra = {}) {
  return { value: null, insufficientGroup: group, ...extra };
}

/**
 * Aggregate SpO2 for one night (§2.1) — the highest-risk filter.
 *
 * Filter is **sentinel-only**: drop `value === 50.0`. There is deliberately NO
 * `>= 70` cut — a genuine calibrated nadir of 64–69% on an under-treated night
 * is the single most clinically important data point and must be retained
 * (finding #3, BLOCKER). Any non-sentinel value in `[1, 70)` is a data-quality
 * red flag, surfaced via `spo2-sub70-nonsentinel`, but NEVER auto-deleted.
 *
 * @param {Array<{value:number}>} samples - In-window per-minute SpO2 rows.
 * @param {object} [opts]
 * @param {number} [opts.minValidMinutes] - Coverage gate override (sensitivity).
 * @returns {{value: object|null, insufficientGroup?: string, flags: string[],
 *   sentinelMinutesRemoved: number, subSeventyNonSentinelMinutes: number, validMinutes: number}}
 *   `value` is the spo2 sub-object or `null` when gated/absent.
 */
export function aggregateSpO2(
  samples,
  { minValidMinutes = WEARABLE_COVERAGE.MIN_SPO2_VALID_MIN } = {},
) {
  const flags = [];
  if (!Array.isArray(samples) || samples.length === 0) {
    // absent (no source rows) — not insufficient
    return {
      value: null,
      flags,
      sentinelMinutesRemoved: 0,
      subSeventyNonSentinelMinutes: 0,
      validMinutes: 0,
    };
  }

  let sentinelMinutesRemoved = 0;
  let subSeventyNonSentinelMinutes = 0;
  const valid = [];
  for (const row of samples) {
    const v = Number(row?.value);
    if (!Number.isFinite(v)) continue;
    if (v === SPO2_SENTINEL_VALUE) {
      sentinelMinutesRemoved += 1;
      continue; // SENTINEL-ONLY drop
    }
    if (v >= 1 && v < SPO2_SUBSEVENTY_FLOOR) {
      // real low value that is NOT the sentinel — retain it, flag it
      subSeventyNonSentinelMinutes += 1;
    }
    valid.push(v);
  }
  if (subSeventyNonSentinelMinutes > 0) {
    flags.push('spo2-sub70-nonsentinel');
  }

  const base = {
    flags,
    sentinelMinutesRemoved,
    subSeventyNonSentinelMinutes,
    validMinutes: valid.length,
  };

  if (valid.length < minValidMinutes) {
    return { ...insufficient('spo2'), ...base };
  }

  const below90 = valid.filter((v) => v < SPO2_DESAT_THRESHOLD_90).length;
  const below88 = valid.filter((v) => v < SPO2_DESAT_THRESHOLD_88).length;

  return {
    ...base,
    value: {
      meanPct: mean(valid),
      medianPct: quantile(valid, PCT_MEDIAN),
      minPct: Math.min(...valid), // post-filter min, never raw (§4.3)
      p5Pct: quantile(valid, PCT_P5),
      pctTimeBelow90: (100 * below90) / valid.length,
      pctTimeBelow88: (100 * below88) / valid.length,
      validMinutes: valid.length,
      sentinelMinutesRemoved,
      subSeventyNonSentinelMinutes,
      odiEstimate: null, // deferred (§1.2 N)
    },
  };
}

/**
 * Aggregate sleeping HR for one night (§2.2). Samples must already be
 * window-restricted; only `confidence > 0` rows count.
 *
 * @param {Array<{value:number, confidence?:number}>} samples - In-window HR rows.
 * @param {object} [opts]
 * @param {number|null} [opts.restingBpm] - Daily RHR pass-through.
 * @param {number} [opts.minSamples] - Coverage gate override.
 * @returns {{value: object|null, insufficientGroup?: string, sampleCount: number}}
 */
export function aggregateHeartRate(
  samples,
  { restingBpm = null, minSamples = WEARABLE_COVERAGE.MIN_HR_SAMPLES } = {},
) {
  if (!Array.isArray(samples) || samples.length === 0) {
    return { value: null, sampleCount: 0 };
  }
  const vals = [];
  for (const row of samples) {
    const v = Number(row?.value);
    const conf = row?.confidence;
    if (!Number.isFinite(v)) continue;
    if (conf != null && !(conf > 0)) continue; // drop confidence==0 when present
    vals.push(v);
  }
  if (vals.length < minSamples) {
    return { ...insufficient('hr'), sampleCount: vals.length };
  }
  return {
    sampleCount: vals.length,
    value: {
      restingBpm: Number.isFinite(restingBpm) ? restingBpm : null,
      sleepingMinBpm: Math.min(...vals),
      sleepingAvgBpm: mean(vals),
      sleepingMaxBpm: Math.max(...vals),
      sleepingP10Bpm: quantile(vals, PCT_P10),
      sampleCount: vals.length,
    },
  };
}

/**
 * Aggregate nightly HRV (§2.3). Daily-summary values are direct; the gate is on
 * `Details` window coverage.
 *
 * @param {object} args
 * @param {number|null} [args.rmssdMs] - Nightly RMSSD.
 * @param {number|null} [args.nremhrBpm] - Non-REM HR.
 * @param {number|null} [args.entropy] - Sample entropy.
 * @param {number|null} [args.coveragePct] - Mean coverage across 5-min windows (0–1).
 * @param {number} [args.windowCount] - Number of contributing 5-min windows.
 * @param {object} [opts]
 * @param {number} [opts.minCoverage] - Coverage gate override.
 * @returns {{value: object|null, insufficientGroup?: string, windowCount: number}}
 */
export function aggregateHRV(
  {
    rmssdMs = null,
    nremhrBpm = null,
    entropy = null,
    coveragePct = null,
    windowCount = 0,
  } = {},
  { minCoverage = WEARABLE_COVERAGE.MIN_HRV_COVERAGE } = {},
) {
  if (rmssdMs == null || !Number.isFinite(rmssdMs)) {
    return { value: null, windowCount }; // absent
  }
  if (!Number.isFinite(coveragePct) || coveragePct < minCoverage) {
    return { ...insufficient('hrv'), windowCount };
  }
  return {
    windowCount,
    value: {
      rmssdMs,
      nremhrBpm: Number.isFinite(nremhrBpm) ? nremhrBpm : null,
      entropy: Number.isFinite(entropy) ? entropy : null,
      coveragePct,
    },
  };
}

/**
 * Aggregate respiratory rate (§2.4) — direct nightly values, no aggregation.
 * Per-stage values are pass-throughs (gated upstream by signal-to-noise if present).
 *
 * @param {object} args
 * @param {number|null} [args.nightlyBrpm] - Daily respiratory rate (breaths/min).
 * @param {object|null} [args.perStage] - `{deepBrpm, lightBrpm, remBrpm, fullBrpm}`.
 * @param {number|null} [args.signalToNoise] - Quality value.
 * @returns {{value: object|null}}
 */
export function aggregateRespiratoryRate({
  nightlyBrpm = null,
  perStage = null,
  signalToNoise = null,
} = {}) {
  if (!Number.isFinite(nightlyBrpm) && perStage == null) {
    return { value: null };
  }
  return {
    value: {
      nightlyBrpm: Number.isFinite(nightlyBrpm) ? nightlyBrpm : null,
      deepBrpm: perStage?.deepBrpm ?? null,
      lightBrpm: perStage?.lightBrpm ?? null,
      remBrpm: perStage?.remBrpm ?? null,
      fullBrpm: perStage?.fullBrpm ?? null,
      signalToNoise: Number.isFinite(signalToNoise) ? signalToNoise : null,
    },
  };
}

/** Minutes per snore epoch (30-second epochs → 0.5 min). @private */
const SNORE_EPOCH_MINUTES = 0.5;

/**
 * Aggregate snore/noise for one night (§2.5). Each epoch is a 30-second window.
 *
 * @param {Array<{snore_label?:number, mean_dba?:number, max_dba?:number}>} epochs
 * @param {object} [opts]
 * @param {number|null} [opts.asleepMin] - For snore-% of sleep.
 * @param {number} [opts.minEpochs] - Coverage gate override.
 * @returns {{value: object|null, insufficientGroup?: string, epochCount: number}}
 */
export function aggregateSnore(
  epochs,
  { asleepMin = null, minEpochs = WEARABLE_COVERAGE.MIN_SNORE_EPOCHS } = {},
) {
  if (!Array.isArray(epochs) || epochs.length === 0) {
    return { value: null, epochCount: 0 };
  }
  if (epochs.length < minEpochs) {
    return { ...insufficient('snore'), epochCount: epochs.length };
  }
  let snoreEpochs = 0;
  const dbaMeans = [];
  const dbaMaxes = [];
  for (const e of epochs) {
    if (Number(e?.snore_label) === 1) snoreEpochs += 1;
    const m = Number(e?.mean_dba);
    if (Number.isFinite(m)) dbaMeans.push(m);
    const mx = Number(e?.max_dba);
    if (Number.isFinite(mx)) dbaMaxes.push(mx);
  }
  const snoreMinutes = snoreEpochs * SNORE_EPOCH_MINUTES;
  return {
    epochCount: epochs.length,
    value: {
      snoreMinutes,
      snorePctOfSleep:
        Number.isFinite(asleepMin) && asleepMin > 0
          ? (snoreMinutes / asleepMin) * 100
          : null,
      meanDba: dbaMeans.length ? mean(dbaMeans) : null,
      maxDba: dbaMaxes.length ? Math.max(...dbaMaxes) : null,
    },
  };
}

/**
 * Pass-through daily readiness (§2.6). No aggregation; only presence handling.
 *
 * @param {object|null} row - `{score, state, activitySub, sleepSub, hrvSub}`.
 * @returns {{value: object|null}}
 */
export function aggregateReadiness(row) {
  if (row == null) return { value: null };
  return {
    value: {
      score: Number.isFinite(row.score) ? row.score : null,
      state: row.state ?? null,
      activitySub: Number.isFinite(row.activitySub) ? row.activitySub : null,
      sleepSub: Number.isFinite(row.sleepSub) ? row.sleepSub : null,
      hrvSub: Number.isFinite(row.hrvSub) ? row.hrvSub : null,
    },
  };
}

/**
 * Pass-through daily stress (§2.6). Skips CALCULATION_FAILED rows upstream;
 * `refDate` is stored raw for the ±1-day key resolution (§1.7).
 *
 * @param {object|null} row - `{score, sleepPoints, responsivenessPoints,
 *   exertionPoints, status, refDate}`.
 * @returns {{value: object|null}}
 */
export function aggregateStress(row) {
  if (row == null) return { value: null };
  return {
    value: {
      score: Number.isFinite(row.score) ? row.score : null,
      sleepPoints: Number.isFinite(row.sleepPoints) ? row.sleepPoints : null,
      responsivenessPoints: Number.isFinite(row.responsivenessPoints)
        ? row.responsivenessPoints
        : null,
      exertionPoints: Number.isFinite(row.exertionPoints)
        ? row.exertionPoints
        : null,
      status: row.status ?? null,
      refDate: row.refDate ?? null,
    },
  };
}

/**
 * Pass-through prior-day activity totals (§2.7). All-zero days are a VALID 0
 * (steps can legitimately be 0), unlike physiological gaps.
 *
 * @param {object|null} row - `{steps, azmMinutes, activeMinutes}`.
 * @returns {{value: object|null}}
 */
export function aggregateActivity(row) {
  if (row == null) return { value: null };
  return {
    value: {
      steps: Number.isFinite(row.steps) ? row.steps : null,
      azmMinutes: Number.isFinite(row.azmMinutes) ? row.azmMinutes : null,
      activeMinutes: Number.isFinite(row.activeMinutes)
        ? row.activeMinutes
        : null,
    },
  };
}

/**
 * Pass-through nightly temperature deviation (§1.10, §2.6). Units °C relative —
 * never auto-converted.
 *
 * @param {object|null} row - `{skinDeviationC}`.
 * @returns {{value: object|null}}
 */
export function aggregateTemperature(row) {
  if (row == null || !Number.isFinite(row.skinDeviationC)) {
    return { value: null };
  }
  return { value: { skinDeviationC: row.skinDeviationC } };
}
