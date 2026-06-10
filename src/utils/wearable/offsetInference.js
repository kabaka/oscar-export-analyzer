/**
 * Per-night UTC-offset resolution (§3.2) — the load-bearing correctness fix.
 *
 * Window-fit **inference is the PRIMARY resolver**: it finds the UTC offset that
 * best lands the night's own UTC-stamped SpO2/HR samples inside the naive-local
 * sleep window. `UserSleeps_*.start_utc_offset` is demoted to an UNTRUSTED HINT
 * (`+00:00` is a placeholder for 88% of rows; any ≥15-min disagreement with the
 * inferred value discards the hint). Fallback chain: inferred → hint →
 * short carry-forward (inferred-only, ≤2 nights) → configured default.
 *
 * Why this is necessary: `UserSleeps.sleep_start` and `sleep-*.json.startTime`
 * are stored in the SAME mislabeled naive-local clock, so a `+00:00` offset
 * self-validates within the sleep tables yet mis-windows the real-`Z` UTC
 * physiological series by ~8h, capturing nearly zero real sleep-time data.
 *
 * Time representation: this module works in MINUTES. Naive-local timestamps are
 * converted to "wall-clock minutes" (offset-free); UTC samples are converted to
 * "UTC minutes". A candidate offset `off` shifts a UTC sample into candidate
 * local time as `utcMinutes + off`.
 *
 * Pure functions, no DOM/worker/IndexedDB.
 *
 * @module utils/wearable/offsetInference
 */

import {
  OFFSET_INFERENCE,
  WINDOW_SOURCE,
} from '../../constants/wearableConstants.js';

const MS_PER_MINUTE = 60000;

/**
 * Parse a naive-local ISO timestamp (no `Z`, no offset) into wall-clock minutes
 * since the epoch, treating the wall-clock fields as if they were UTC. This is
 * the offset-free reference frame the window bounds live in.
 *
 * @param {string|Date} ts - ISO `YYYY-MM-DDTHH:mm:ss` (naive-local) or Date.
 * @returns {number} Minutes since epoch in the wall-clock frame, or `NaN`.
 */
export function naiveLocalToMinutes(ts) {
  if (ts instanceof Date) return ts.getTime() / MS_PER_MINUTE;
  if (typeof ts !== 'string') return NaN;
  // Strip any trailing Z / offset so the wall-clock fields are read literally.
  const stripped = ts.replace(/(Z|[+-]\d{2}:?\d{2})$/, '');
  const m = stripped.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/,
  );
  if (!m) return NaN;
  const [, y, mo, d, h, mi, s] = m;
  const ms = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s ?? 0),
  );
  return ms / MS_PER_MINUTE;
}

/**
 * Parse a UTC timestamp (with `Z`) into minutes since the epoch.
 *
 * @param {string|Date|number} ts - ISO `...Z`, a Date, or epoch-ms number.
 * @returns {number} UTC minutes since epoch, or `NaN`.
 */
export function utcToMinutes(ts) {
  if (typeof ts === 'number') return ts / MS_PER_MINUTE;
  const d = ts instanceof Date ? ts : new Date(ts);
  const t = d.getTime();
  return Number.isFinite(t) ? t / MS_PER_MINUTE : NaN;
}

/**
 * Window-fit offset inference for one night (§3.2.1).
 *
 * Searches offsets in `[SEARCH_MIN, SEARCH_MAX]` at `SEARCH_STEP` resolution and
 * picks the one maximizing the fraction of the night's own UTC samples landing
 * inside `[startLocalMin, endLocalMin)`. Tie-break (within the same best frac):
 * (1) closest to `prevInferredOffset` (DST continuity), then (2) smallest |off|.
 *
 * @param {object} args
 * @param {number} args.startLocalMin - Naive-local window start, wall-clock minutes.
 * @param {number} args.endLocalMin - Naive-local window end, wall-clock minutes.
 * @param {number[]} args.utcSampleMinutes - UTC minutes for the night's own
 *   SpO2 (preferred) / HR samples.
 * @param {number|null} [args.prevInferredOffset] - Previous night's INFERRED offset.
 * @param {object} [opts] - Constant overrides (testing).
 * @returns {{offset:number|null, frac:number, inside:number, total:number,
 *   confident:boolean, unstable:boolean}} `confident` iff `frac ≥ MIN_INFER_FRAC`
 *   and there were enough samples; `offset` is `null` only when too few samples.
 */
export function inferUtcOffset(
  { startLocalMin, endLocalMin, utcSampleMinutes, prevInferredOffset = null },
  opts = {},
) {
  const {
    SEARCH_MIN = OFFSET_INFERENCE.SEARCH_MIN,
    SEARCH_MAX = OFFSET_INFERENCE.SEARCH_MAX,
    SEARCH_STEP = OFFSET_INFERENCE.SEARCH_STEP,
    MIN_INFER_SAMPLES = OFFSET_INFERENCE.MIN_INFER_SAMPLES,
    MIN_INFER_FRAC = OFFSET_INFERENCE.MIN_INFER_FRAC,
  } = opts;

  const samples = (utcSampleMinutes || []).filter((v) => Number.isFinite(v));
  const total = samples.length;
  if (total < MIN_INFER_SAMPLES) {
    return {
      offset: null,
      frac: 0,
      inside: 0,
      total,
      confident: false,
      unstable: false,
    };
  }

  let best = null;
  for (let off = SEARCH_MIN; off <= SEARCH_MAX; off += SEARCH_STEP) {
    let inside = 0;
    for (const s of samples) {
      const local = s + off;
      if (local >= startLocalMin && local < endLocalMin) inside += 1;
    }
    const frac = inside / total;
    if (best === null || frac > best.frac) {
      best = { offset: off, frac, inside };
    } else if (frac === best.frac) {
      // Tie-break: prefer closeness to previous inferred offset, then |off|.
      const prev = Number.isFinite(prevInferredOffset) ? prevInferredOffset : 0;
      const curDist = Math.abs(off - prev);
      const bestDist = Math.abs(best.offset - prev);
      if (
        curDist < bestDist ||
        (curDist === bestDist && Math.abs(off) < Math.abs(best.offset))
      ) {
        best = { offset: off, frac, inside };
      }
    }
  }

  // Modal cross-check (§3.2.1): the modal (windowStart − sampleStart) rounded to
  // the step should agree with the argmax within one step, else mark unstable.
  const modal = modalOffset(samples, startLocalMin, SEARCH_STEP);
  const unstable =
    Number.isFinite(modal) && Math.abs(modal - best.offset) > SEARCH_STEP;

  return {
    offset: best.offset,
    frac: best.frac,
    inside: best.inside,
    total,
    confident: best.frac >= MIN_INFER_FRAC,
    unstable,
  };
}

/**
 * Cheap modal cross-check: the most common `(startLocalMin − sampleMinute)`
 * rounded to `step`. Used only to set the `offset-infer-unstable` flag.
 * @private
 */
function modalOffset(samples, startLocalMin, step) {
  const counts = new Map();
  for (const s of samples) {
    const raw = startLocalMin - s;
    const rounded = Math.round(raw / step) * step;
    counts.set(rounded, (counts.get(rounded) || 0) + 1);
  }
  let mode = NaN;
  let modeCount = -1;
  for (const [off, c] of counts) {
    if (c > modeCount) {
      modeCount = c;
      mode = off;
    }
  }
  return mode;
}

/**
 * Resolve the per-night offset via the full fallback chain (§3.2.2–§3.2.3).
 *
 * @param {object} args
 * @param {number} args.startLocalMin - Naive-local window start (wall-clock min).
 * @param {number} args.endLocalMin - Naive-local window end (wall-clock min).
 * @param {number[]} args.utcSampleMinutes - The night's own UTC sample minutes.
 * @param {number|null} [args.userSleepsHintMin] - UserSleeps `start_utc_offset`
 *   in minutes (or `null` if absent). `0` is the placeholder ⇒ treated as missing.
 * @param {number|null} [args.prevInferredOffset] - Previous night's inferred offset.
 * @param {number} [args.nightsSincePrevInferred] - Gap (in nights) to the last
 *   inferred offset, for the carry-forward cap.
 * @param {object} [opts] - Constant overrides.
 * @returns {{utcOffsetMinutes:number, windowSource:string,
 *   offsetDisagreementMin:number|null, flags:string[]}}
 *   The resolved offset, its provenance, the hint disagreement, and any
 *   coverage flags ('offset-from-hint', 'offset-carry-forward',
 *   'offset-default-fallback', 'offset-disagreement', 'offset-infer-unstable').
 */
export function resolveOffset(
  {
    startLocalMin,
    endLocalMin,
    utcSampleMinutes,
    userSleepsHintMin = null,
    prevInferredOffset = null,
    nightsSincePrevInferred = Infinity,
  },
  opts = {},
) {
  const {
    PLACEHOLDER_OFFSET_MIN = OFFSET_INFERENCE.PLACEHOLDER_OFFSET_MIN,
    DISAGREEMENT_MIN = OFFSET_INFERENCE.DISAGREEMENT_MIN,
    MAX_CARRY_NIGHTS = OFFSET_INFERENCE.MAX_CARRY_NIGHTS,
    DEFAULT_OFFSET_MIN = OFFSET_INFERENCE.DEFAULT_OFFSET_MIN,
  } = opts;

  const flags = [];

  // UserSleeps hint is untrusted: the placeholder (0 / +00:00) is always missing.
  const hint =
    Number.isFinite(userSleepsHintMin) &&
    userSleepsHintMin !== PLACEHOLDER_OFFSET_MIN
      ? userSleepsHintMin
      : null;

  const inferred = inferUtcOffset(
    { startLocalMin, endLocalMin, utcSampleMinutes, prevInferredOffset },
    opts,
  );

  // 1) PRIMARY — confident inference.
  if (inferred.offset != null && inferred.confident) {
    if (inferred.unstable) flags.push('offset-infer-unstable');
    let offsetDisagreementMin = null;
    if (hint != null) {
      offsetDisagreementMin = Math.abs(inferred.offset - hint);
      if (offsetDisagreementMin >= DISAGREEMENT_MIN) {
        // Keep inferred, discard hint, flag the disagreement (§3.2.3).
        flags.push('offset-disagreement');
      }
    }
    return {
      utcOffsetMinutes: inferred.offset,
      windowSource: WINDOW_SOURCE.INFERRED,
      offsetDisagreementMin,
      flags,
    };
  }

  // 2) HINT — inference unavailable but a real (non-placeholder) hint exists.
  if (hint != null) {
    flags.push('offset-from-hint');
    return {
      utcOffsetMinutes: hint,
      windowSource: WINDOW_SOURCE.USERSLEEPS_HINT,
      offsetDisagreementMin: null,
      flags,
    };
  }

  // 3) CARRY-FORWARD — most recent INFERRED offset within MAX_CARRY_NIGHTS.
  if (
    Number.isFinite(prevInferredOffset) &&
    nightsSincePrevInferred <= MAX_CARRY_NIGHTS
  ) {
    flags.push('offset-carry-forward');
    return {
      utcOffsetMinutes: prevInferredOffset,
      windowSource: WINDOW_SOURCE.CARRY_FORWARD,
      offsetDisagreementMin: null,
      flags,
    };
  }

  // 4) DEFAULT — last resort; alignment-suspect.
  flags.push('offset-default-fallback');
  return {
    utcOffsetMinutes: DEFAULT_OFFSET_MIN,
    windowSource: WINDOW_SOURCE.DEFAULT_FALLBACK,
    offsetDisagreementMin: null,
    flags,
  };
}

/**
 * Derive UTC window bounds (ISO `...Z`) from naive-local bounds + a resolved
 * offset. `startUtc = startLocal − offset`.
 *
 * @param {number} startLocalMin - Wall-clock minutes.
 * @param {number} endLocalMin - Wall-clock minutes.
 * @param {number} offsetMin - Resolved offset (minutes east of UTC).
 * @returns {{startUtc:string, endUtc:string}} ISO strings with `Z`.
 */
export function deriveUtcBounds(startLocalMin, endLocalMin, offsetMin) {
  const startUtc = new Date((startLocalMin - offsetMin) * MS_PER_MINUTE);
  const endUtc = new Date((endLocalMin - offsetMin) * MS_PER_MINUTE);
  return { startUtc: startUtc.toISOString(), endUtc: endUtc.toISOString() };
}
