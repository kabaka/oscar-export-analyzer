/**
 * Canonical `WearableNight` per-night record + the `AlignedNight` produced by
 * aligning a `WearableNight` to an OSCAR CPAP summary night.
 *
 * This is the contract emitted by the ingestion worker (Phase 3) and consumed
 * by the analysis hook (Phase 4). It is a STANDALONE wearable-only record (one
 * per wearable main-sleep night, keyed by `nightKey = dateOfSleep`); it is
 * *aligned to* an OSCAR night at a later stage rather than nesting the two.
 *
 * The "absent" vs "insufficient" contract (§2.9 of the design doc):
 *   - absent:       source row does not exist → field `null`, NOT in
 *                   `coverage.insufficient[]`.
 *   - insufficient: source exists but fails its coverage gate → field `null`
 *                   AND the metric-group name appears in `coverage.insufficient[]`.
 *
 * No DOM / worker / IndexedDB access here — pure factories so the worker and
 * hook share one shape and the model is unit-testable in isolation.
 *
 * @module utils/wearable/wearableNight
 */

import { WINDOW_SOURCE } from '../../constants/wearableConstants.js';

/**
 * The metric-group keys that participate in the coverage-gating contract.
 * Aggregators push a group name here when a source exists but fails its gate.
 * @type {string[]}
 */
export const COVERAGE_GROUPS = ['spo2', 'hr', 'hrv', 'rr', 'snore', 'sleep'];

/**
 * Build an empty coverage/quality block (§1.11). Counts default to 0 and the
 * `insufficient`/`flags` arrays start empty; aggregators and the resolver fill
 * them in.
 *
 * @returns {object} A fresh coverage block.
 */
export function createCoverageBlock() {
  return {
    insufficient: [], // metric groups gated out for this night (§2.9)
    flags: [], // provenance/data-quality/sleep flags (§1.11)
    spo2ValidMinutes: 0,
    spo2SentinelMinutesRemoved: 0,
    hrvWindows: 0,
    snoreEpochs: 0,
    hrSamples: 0,
  };
}

/**
 * Build the window block (§1.0). `utcOffsetMinutes` is the resolved offset
 * (inference-primary, §3.2); `startUtc`/`endUtc` are derived from the
 * naive-local bounds and that offset.
 *
 * @param {object} args
 * @param {string|null} args.startLocal - ISO naive-local sleep start (no Z).
 * @param {string|null} args.endLocal - ISO naive-local sleep end (no Z).
 * @param {number|null} args.utcOffsetMinutes - Resolved offset (minutes east of UTC).
 * @param {string|null} [args.startUtc] - Derived UTC start (ISO with Z).
 * @param {string|null} [args.endUtc] - Derived UTC end (ISO with Z).
 * @returns {object} The window block.
 */
export function createWindow({
  startLocal = null,
  endLocal = null,
  utcOffsetMinutes = null,
  startUtc = null,
  endUtc = null,
} = {}) {
  return { startLocal, endLocal, utcOffsetMinutes, startUtc, endUtc };
}

/**
 * Construct a normalized `WearableNight`. Callers (aggregators, the night-keying
 * fold) pass already-computed metric sub-objects; absent groups are left `null`.
 *
 * Only the identity/keying block is required; every physiological group is
 * optional and defaults to `null` ("absent") so a sparse night is still a valid
 * record.
 *
 * @param {object} args
 * @param {string} args.nightKey - `YYYY-MM-DD` morning-of date (the canonical key).
 * @param {number} [args.logId] - Fitbit sleep log id.
 * @param {'stages'|'classic'} [args.sleepType] - Drives which stage fields populate.
 * @param {boolean} [args.isMainSleep] - Only `true` rows become a WearableNight.
 * @param {object} [args.window] - From {@link createWindow}.
 * @param {string} [args.windowSource] - Provenance of the offset (§1.0).
 * @param {number|null} [args.offsetDisagreementMin] - |inferred − hint| (§1.0).
 * @param {string[]} [args.sourceFiles] - Chunk file(s) this logId was read from.
 * @param {string} [args.deviceSource] - Device era string.
 * @param {object|null} [args.sleep] - Sleep architecture group (§1.1).
 * @param {object|null} [args.spo2] - SpO2 group (§1.2).
 * @param {object|null} [args.hr] - Heart-rate group (§1.3).
 * @param {object|null} [args.hrv] - HRV group (§1.4).
 * @param {object|null} [args.rr] - Respiratory-rate group (§1.5).
 * @param {object|null} [args.readiness] - Readiness pass-through (§1.6).
 * @param {object|null} [args.stress] - Stress pass-through (§1.7).
 * @param {object|null} [args.snore] - Snore group (§1.8).
 * @param {object|null} [args.activityPriorDay] - Prior-day activity totals (§1.9).
 * @param {object|null} [args.temp] - Temperature deviation (§1.10).
 * @param {object} [args.coverage] - From {@link createCoverageBlock}.
 * @param {object} [args.intraday] - Pointers to per-night detail arrays (§1.12).
 * @returns {object} The WearableNight record.
 */
export function createWearableNight({
  nightKey,
  logId = null,
  sleepType = null,
  isMainSleep = true,
  window = createWindow(),
  windowSource = WINDOW_SOURCE.DEFAULT_FALLBACK,
  offsetDisagreementMin = null,
  sourceFiles = [],
  deviceSource = null,
  sleep = null,
  spo2 = null,
  hr = null,
  hrv = null,
  rr = null,
  readiness = null,
  stress = null,
  snore = null,
  activityPriorDay = null,
  temp = null,
  coverage = createCoverageBlock(),
  intraday = null,
} = {}) {
  return {
    // 1.0 identity / keying
    nightKey,
    logId,
    sleepType,
    isMainSleep,
    window,
    windowSource,
    offsetDisagreementMin,
    sourceFiles,
    deviceSource,
    // physiological groups (null = absent)
    sleep,
    spo2,
    hr,
    hrv,
    rr,
    readiness,
    stress,
    snore,
    activityPriorDay,
    temp,
    // 1.11 coverage / quality + 1.12 intraday handles
    coverage,
    intraday,
  };
}

/**
 * Parse OSCAR summary-row fields used by alignment/correlation into a flat
 * numeric object (§3.4 `oscar` block). Mirrors `normalizeOscarRecord` but lives
 * with the wearable contract so the AlignedNight shape is owned in one place.
 *
 * @param {object} row - A parsed OSCAR summary CSV row.
 * @returns {object} `{ ahi, centralAhi, obstructiveAhi, hypopneaAhi, medianEpap,
 *   ipap, meanPressure, maxPressure, usageHours, leakPercent }` (NaN where absent).
 */
export function parseOscarSummaryRow(row) {
  const num = (v) => {
    const parsed = parseFloat(v);
    return Number.isFinite(parsed) ? parsed : NaN;
  };
  const totalTimeHours = num(row['Total Time']);
  return {
    ahi: num(row.AHI),
    centralAhi: num(row['Central AHI']),
    obstructiveAhi: num(row['Obstructive AHI']),
    hypopneaAhi: num(row['Hypopnea AHI']),
    medianEpap: num(row['Median EPAP']),
    ipap: num(row['Median IPAP']),
    meanPressure: num(row['Mean Pressure']),
    maxPressure: num(row['Max Pressure']),
    usageHours: totalTimeHours,
    leakPercent: num(row['Leak Rate Median']),
  };
}

/**
 * Construct an `AlignedNight` (§3.4) — the unit consumed by the correlation
 * engine. Pairs one parsed OSCAR `oscar` block with one `WearableNight`.
 *
 * @param {object} args
 * @param {string} args.nightKey - The shared night key.
 * @param {'exact'|'shifted+1'|'shifted-1'} args.matchType - Reconciliation type.
 * @param {number} args.overlapHours - Window/usage overlap.
 * @param {object} args.oscar - From {@link parseOscarSummaryRow}.
 * @param {object} args.wearable - A WearableNight.
 * @returns {object} The AlignedNight record.
 */
export function createAlignedNight({
  nightKey,
  matchType,
  overlapHours,
  oscar,
  wearable,
}) {
  const usageHours = oscar?.usageHours;
  const asleepMin = wearable?.sleep?.asleepMin;
  const durationMismatchHours =
    Number.isFinite(usageHours) && Number.isFinite(asleepMin)
      ? Math.abs(usageHours - asleepMin / 60)
      : null;
  return {
    nightKey,
    matchType,
    overlapHours,
    oscar,
    wearable,
    quality: {
      overlapHours,
      durationMismatchHours,
      windowSource: wearable?.windowSource ?? null,
      flags: wearable?.coverage?.flags ?? [],
    },
  };
}
