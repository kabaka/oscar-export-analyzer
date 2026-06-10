/**
 * Wearable↔OSCAR night alignment (§3.3–3.5).
 *
 * Replaces the OAuth-era `alignOscarFitbitNights` (which assumed the Web-API
 * daily shape and a noon-split heuristic). Here we align each OSCAR CPAP summary
 * row — labeled by its morning date `Date` — to at most one `WearableNight`
 * keyed by `nightKey = dateOfSleep`, with ±1-day overlap-gated reconciliation.
 * NO imputation; the correlation engine does pairwise/complete-case deletion.
 *
 * Match precedence: exact `nightKey` first; then a shifted (±1-day) candidate,
 * but only if window/usage overlap clears `MIN_OVERLAP_HOURS` (so a shifted
 * match can't steal a neighbor's night). One-to-one: a consumed WearableNight
 * cannot match a second OSCAR row.
 *
 * Pure functions, no DOM/worker/IndexedDB.
 *
 * @module utils/wearable/alignment
 */

import { ALIGNMENT } from '../../constants/wearableConstants.js';
import { parseOscarSummaryRow, createAlignedNight } from './wearableNight.js';
import { naiveLocalToMinutes } from './offsetInference.js';

const MINUTES_PER_HOUR = 60;
const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})/;

/**
 * Extract a `YYYY-MM-DD` key from an OSCAR `Date` value without timezone drift.
 * Returns `''` for unparseable input (the row becomes `unmatchedOscar`).
 *
 * @param {string|Date} value - OSCAR `Date`.
 * @returns {string} The date key, or `''`.
 */
export function oscarDateKey(value) {
  if (typeof value === 'string') {
    const m = value.match(DATE_KEY_RE);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  if (value instanceof Date && !isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  return '';
}

/** Shift a `YYYY-MM-DD` key by `deltaDays` (UTC-safe). @private */
function shiftKey(key, deltaDays) {
  const m = key.match(DATE_KEY_RE);
  if (!m) return '';
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/**
 * Overlap (hours) between an OSCAR row and a WearableNight. The OSCAR session is
 * anchored at the wearable window start (we lack OSCAR clock times in the
 * summary), so this compares durations: `min(usageHours, asleepHours)` when both
 * are present, else falls back to whichever duration exists. This mirrors the
 * existing `validateAlignment` intent.
 *
 * @param {object} oscar - Parsed OSCAR block.
 * @param {object} wearable - A WearableNight.
 * @returns {number} Overlap hours (≥0).
 */
export function overlapHours(oscar, wearable) {
  const usageHours = oscar?.usageHours;
  const asleepMin = wearable?.sleep?.asleepMin;
  const windowStart = wearable?.window?.startLocal;
  const windowEnd = wearable?.window?.endLocal;

  let wearableHours = null;
  if (Number.isFinite(asleepMin)) {
    wearableHours = asleepMin / MINUTES_PER_HOUR;
  } else if (windowStart && windowEnd) {
    const span =
      naiveLocalToMinutes(windowEnd) - naiveLocalToMinutes(windowStart);
    if (Number.isFinite(span) && span > 0)
      wearableHours = span / MINUTES_PER_HOUR;
  }

  if (Number.isFinite(usageHours) && Number.isFinite(wearableHours)) {
    return Math.max(0, Math.min(usageHours, wearableHours));
  }
  if (Number.isFinite(wearableHours)) return Math.max(0, wearableHours);
  if (Number.isFinite(usageHours)) return Math.max(0, usageHours);
  return 0;
}

/**
 * Align OSCAR summary rows to WearableNights (§3.3). Produces `AlignedNight`s
 * plus the unmatched sets on both sides.
 *
 * @param {object[]} oscarRows - Parsed OSCAR summary CSV rows (with `Date`).
 * @param {object[]} wearableNights - WearableNight records (from the fold).
 * @param {object} [opts]
 * @param {number} [opts.minOverlapHours] - Overlap gate for shifted matches.
 * @returns {{ aligned: object[], unmatchedOscar: object[],
 *   unmatchedWearable: object[], statistics: object }}
 */
export function alignWearableToOscar(
  oscarRows,
  wearableNights,
  { minOverlapHours = ALIGNMENT.MIN_OVERLAP_HOURS } = {},
) {
  if (!Array.isArray(oscarRows) || !Array.isArray(wearableNights)) {
    throw new Error('alignWearableToOscar: inputs must be arrays');
  }

  // Index wearable nights by nightKey (one record per key after the fold).
  const byKey = new Map();
  for (const w of wearableNights) {
    if (w?.nightKey) byKey.set(w.nightKey, w);
  }

  const consumed = new Set();
  const aligned = [];
  const unmatchedOscar = [];
  const matchTypes = {};

  for (const row of oscarRows) {
    const key = oscarDateKey(row?.Date);
    if (!key) {
      unmatchedOscar.push({ row, reason: 'unparseable-date' });
      continue;
    }
    const oscar = parseOscarSummaryRow(row);

    let chosen = null;
    let matchType = null;
    let ov = 0;

    // Exact match preferred.
    const exact = byKey.get(key);
    if (exact && !consumed.has(exact.nightKey)) {
      chosen = exact;
      matchType = 'exact';
      ov = overlapHours(oscar, exact);
    } else {
      // ±1-day reconciliation, overlap-gated; pick the better-overlapping side.
      let bestCand = null;
      let bestOv = -1;
      let bestType = null;
      for (const delta of [-1, 1]) {
        const cand = byKey.get(shiftKey(key, delta));
        if (!cand || consumed.has(cand.nightKey)) continue;
        const candOv = overlapHours(oscar, cand);
        if (candOv >= minOverlapHours && candOv > bestOv) {
          bestOv = candOv;
          bestCand = cand;
          bestType = delta === 1 ? 'shifted+1' : 'shifted-1';
        }
      }
      if (bestCand) {
        chosen = bestCand;
        matchType = bestType;
        ov = bestOv;
      }
    }

    if (chosen) {
      consumed.add(chosen.nightKey);
      matchTypes[matchType] = (matchTypes[matchType] || 0) + 1;
      aligned.push(
        createAlignedNight({
          nightKey: chosen.nightKey,
          matchType,
          overlapHours: ov,
          oscar,
          wearable: chosen,
        }),
      );
    } else {
      unmatchedOscar.push({ row, reason: 'no-wearable-night' });
    }
  }

  const unmatchedWearable = wearableNights.filter(
    (w) => w?.nightKey && !consumed.has(w.nightKey),
  );

  return {
    aligned,
    unmatchedOscar,
    unmatchedWearable,
    statistics: {
      oscarTotal: oscarRows.length,
      wearableTotal: wearableNights.length,
      alignedCount: aligned.length,
      matchRate: aligned.length / Math.max(oscarRows.length, 1),
      matchTypes,
    },
  };
}

/**
 * Flag a duration mismatch on an AlignedNight (§3.4) — a quality flag, NOT an
 * exclusion (exclusion is a correlation-time decision).
 *
 * @param {object} alignedNight - From {@link createAlignedNight}.
 * @param {object} [opts]
 * @param {number} [opts.thresholdHours] - Flag when mismatch exceeds this.
 * @returns {boolean} `true` if `large-duration-mismatch` applies.
 */
export function hasLargeDurationMismatch(
  alignedNight,
  { thresholdHours = ALIGNMENT.DURATION_MISMATCH_FLAG_HOURS } = {},
) {
  const d = alignedNight?.quality?.durationMismatchHours;
  return Number.isFinite(d) && d > thresholdHours;
}
