/**
 * Wearable↔CPAP correlation engine (§4).
 *
 * A pair-runner over the frozen pre-registered primary family + exploratory
 * family (see {@link module:utils/wearable/pairRegistry}). For each pair it:
 *   - extracts the pairwise-complete, date-ordered nightly series (NO imputation);
 *   - computes Spearman ρ (reusing the validated `spearmanCorrelation`);
 *   - uses a TIE-AWARE p (two-sided permutation when ties are heavy, else the
 *     reused Student-t p) — §4.2;
 *   - applies an EFFECTIVE-N correction for serial correlation (`n_eff` from
 *     lag-1 autocorrelations, p recomputed at df = n_eff − 2) — §4.3a;
 *   - reports MNAR coverage diagnostics (kept-vs-dropped AHI/SpO2 distributions,
 *     a Mann-Whitney selection test, relaxed-gate sensitivity) — §4.6a;
 *   - reports a DESCRIPTIVE lag profile via `nightlyLagCorrelation` (lag-0 is
 *     the SOLE inferential point) — §4.2/§4.4;
 *   - emits a reframed plausibility canary: a one-sided gross wrong-sign tripwire
 *     plus an attenuation/coverage warning — §4.7.
 * Benjamini-Hochberg FDR runs over the FULL session family (pair lag-0 tests +
 * group-contrast tests), operating on the n_eff-adjusted p — §4.4.
 *
 * Reuses the GOOD primitives (`spearmanCorrelation`, `mannWhitneyUTest`,
 * `computeAutocorrelation`, `quantile`, `studentTCDF`). The positional,
 * sign-flipped `crossCorrelation` (wearableCorrelation.js) is deliberately NOT
 * called: `nightlyLagCorrelation` here reimplements a date-dense, NaN-deleting,
 * single-convention lag profile so the sign-flip/positional bugs cannot leak in.
 * Retired fakes (Granger, regression imputation, `computeOscarFitbitCorrelations`)
 * are NOT used.
 *
 * Pure functions, no DOM/worker/IndexedDB.
 *
 * @module utils/wearable/correlationEngine
 */

import { spearmanCorrelation, studentTCDF } from '../wearableCorrelation.js';
import {
  mannWhitneyUTest,
  computeAutocorrelation,
  quantile,
} from '../stats.js';
import {
  CORRELATION_ENGINE,
  EFFECT_BANDS,
  DATA_LIMITS,
  PCT_MEDIAN,
} from '../../constants/wearableConstants.js';
import {
  PAIR_REGISTRY,
  GROUP_CONTRASTS,
  PAIR_REGISTRY_VERSION,
} from './pairRegistry.js';

/** Quartiles for IQR. @private */
const Q1 = 0.25;
const Q3 = 0.75;
const TWO = 2;

/* ===========================================================================
 * Small statistical building blocks
 * =========================================================================== */

/**
 * Benjamini-Hochberg FDR over a family of p-values (§4.4). Returns, per input
 * index, whether it survives and its BH q-value, using the standard step-up:
 * sort ascending, `pᵢ` significant iff `pᵢ ≤ (i/m)·q`, then enforce monotone
 * q-values.
 *
 * @param {number[]} pValues - The family of p-values (the n_eff-adjusted p).
 * @param {number} q - The target FDR level (e.g. 0.05).
 * @returns {Array<{index:number, p:number, qValue:number, significant:boolean}>}
 *   One entry per input index (original order preserved).
 */
export function benjaminiHochberg(pValues, q) {
  const m = pValues.length;
  const out = pValues.map((p, index) => ({
    index,
    p,
    qValue: NaN,
    significant: false,
  }));
  if (m === 0) return out;

  // Only finite p-values participate; NaNs never survive.
  const ordered = out
    .filter((e) => Number.isFinite(e.p))
    .sort((a, b) => a.p - b.p);
  const mEff = ordered.length;
  if (mEff === 0) return out;

  // Raw BH q per rank, then enforce monotone non-decreasing from the top.
  let minQ = Infinity;
  for (let i = mEff - 1; i >= 0; i--) {
    const rank = i + 1;
    const rawQ = (ordered[i].p * mEff) / rank;
    minQ = Math.min(minQ, rawQ);
    ordered[i].qValue = Math.min(1, minQ);
  }
  // Largest rank with p ≤ (rank/m)·q is the cutoff; everything ≤ it is significant.
  let cutoffRank = 0;
  for (let i = 0; i < mEff; i++) {
    const rank = i + 1;
    if (ordered[i].p <= (rank / mEff) * q) cutoffRank = rank;
  }
  for (let i = 0; i < mEff; i++) {
    ordered[i].significant = i + 1 <= cutoffRank;
  }
  return out;
}

/**
 * Detect heavy ties: `true` if any value's multiplicity exceeds
 * `HEAVY_TIE_FRACTION` of n in EITHER series (§4.2). Heavy ties make the
 * Student-t Spearman p anticonservative, so we switch to a permutation p.
 *
 * @param {number[]} x
 * @param {number[]} y
 * @param {number} [fraction] - Multiplicity threshold (default from constants).
 * @returns {boolean}
 */
export function hasHeavyTies(
  x,
  y,
  fraction = CORRELATION_ENGINE.HEAVY_TIE_FRACTION,
) {
  const n = x.length;
  if (n === 0) return false;
  const overThreshold = (arr) => {
    const counts = new Map();
    for (const v of arr) counts.set(v, (counts.get(v) || 0) + 1);
    let maxMult = 0;
    for (const c of counts.values()) maxMult = Math.max(maxMult, c);
    return maxMult / n > fraction;
  };
  return overThreshold(x) || overThreshold(y);
}

/**
 * Two-sided permutation p-value for Spearman ρ (§4.2). Shuffles `y` `B` times,
 * recomputes ρ, and returns `(1 + #{|ρ_perm| ≥ |ρ_obs|}) / (B + 1)`.
 * Assumption-free and robust to ties.
 *
 * @param {number[]} x - Pairwise-complete series.
 * @param {number[]} y - Pairwise-complete series.
 * @param {object} [opts]
 * @param {number} [opts.B] - Replicate count.
 * @param {() => number} [opts.rng] - RNG for shuffling (injectable for tests).
 * @returns {number} Permutation p-value in `(0, 1]`.
 */
export function permutationSpearmanP(
  x,
  y,
  { B = CORRELATION_ENGINE.PERMUTATION_B, rng = Math.random } = {},
) {
  const obs = Math.abs(spearmanCorrelation(x, y).correlation);
  if (!Number.isFinite(obs)) return NaN;
  const yShuffled = y.slice();
  let atLeast = 0;
  for (let b = 0; b < B; b++) {
    // Fisher-Yates shuffle of y.
    for (let i = yShuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = yShuffled[i];
      yShuffled[i] = yShuffled[j];
      yShuffled[j] = tmp;
    }
    const r = Math.abs(spearmanCorrelation(x, yShuffled).correlation);
    if (Number.isFinite(r) && r >= obs) atLeast += 1;
  }
  return (1 + atLeast) / (B + 1);
}

/**
 * Effective sample size from lag-1 autocorrelations (§4.3a):
 * `n_eff = clamp(n · (1 − r1x·r1y)/(1 + r1x·r1y), 2, n)`.
 * Reuses `computeAutocorrelation`; NaN autocorrelations are treated as 0.
 *
 * @param {number[]} x - Date-ordered pairwise-complete series.
 * @param {number[]} y - Date-ordered pairwise-complete series.
 * @returns {{nEff:number, r1x:number, r1y:number}}
 */
export function effectiveN(x, y) {
  const lag1 = (arr) => {
    const acf = computeAutocorrelation(arr, 1).values;
    const entry = acf.find((e) => e.lag === 1);
    const r = entry?.autocorrelation;
    return Number.isFinite(r) ? r : 0;
  };
  const r1x = lag1(x);
  const r1y = lag1(y);
  const n = x.length;
  const ratio = (1 - r1x * r1y) / (1 + r1x * r1y);
  const nEff = Math.max(TWO, Math.min(n, n * ratio));
  return { nEff, r1x, r1y };
}

/**
 * Two-sided Student-t p-value for a correlation `rho` at `df` degrees of freedom
 * (df may be fractional, e.g. `n_eff − 2`). Reuses the exported `studentTCDF`.
 * @private
 */
function tPFromRho(rho, df) {
  if (!Number.isFinite(rho) || !Number.isFinite(df) || df <= 0) return NaN;
  if (Math.abs(rho) >= 0.999999999) return 0;
  const denom = 1 - rho * rho;
  if (denom <= 0) return NaN;
  const t = rho * Math.sqrt(df / denom);
  const p = 2 * (1 - studentTCDF(Math.abs(t), df));
  return Number.isFinite(p) ? Math.min(Math.max(p, 0), 1) : NaN;
}

/**
 * Date-dense lag correlation wrapper (§4.2/§4.4) — the SOLE public lag entry
 * point. Builds a calendar-dense array over the union date span (missing dates
 * = NaN), then for each lag does pairwise deletion and a date-correct Spearman.
 *
 * LAG-SIGN CONVENTION (single source of truth): **positive lag `k` pairs x at
 * night `d` with y at night `d + k`** — "does today's x relate to y `k` nights
 * later." This is re-derived here and intentionally does NOT inherit
 * `crossCorrelation`'s flipped/positional `lag` label (which is internal-only).
 *
 * @param {Map<string, number>|Array<[string, number]>} seriesX - x by `YYYY-MM-DD`.
 * @param {Map<string, number>|Array<[string, number]>} seriesY - y by `YYYY-MM-DD`.
 * @param {number} [maxLag] - Max |lag| nights (kept small, ≤7).
 * @returns {Array<{lag:number, rho:number, n:number}>} The descriptive lag profile.
 */
export function nightlyLagCorrelation(
  seriesX,
  seriesY,
  maxLag = CORRELATION_ENGINE.MAX_LAG_NIGHTS,
) {
  const mapX = seriesX instanceof Map ? seriesX : new Map(seriesX);
  const mapY = seriesY instanceof Map ? seriesY : new Map(seriesY);
  const allKeys = new Set([...mapX.keys(), ...mapY.keys()]);
  if (allKeys.size === 0) return [];

  // Build a calendar-dense ordered date list over the union span.
  const sorted = [...allKeys].sort();
  const dates = denseDateRange(sorted[0], sorted[sorted.length - 1]);
  const xArr = dates.map((d) => (mapX.has(d) ? mapX.get(d) : NaN));
  const yArr = dates.map((d) => (mapY.has(d) ? mapY.get(d) : NaN));

  const profile = [];
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    const px = [];
    const py = [];
    for (let i = 0; i < dates.length; i++) {
      const j = i + lag; // x at date i paired with y at date i+lag (positive ⇒ y later)
      if (j < 0 || j >= dates.length) continue;
      const xv = xArr[i];
      const yv = yArr[j];
      if (Number.isFinite(xv) && Number.isFinite(yv)) {
        px.push(xv);
        py.push(yv);
      }
    }
    const rho = px.length >= 3 ? spearmanCorrelation(px, py).correlation : NaN;
    profile.push({ lag, rho, n: px.length });
  }
  return profile;
}

/** Build a dense inclusive list of `YYYY-MM-DD` from `start` to `end`. @private */
function denseDateRange(start, end) {
  const out = [];
  const parse = (s) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  let t = parse(start);
  const last = parse(end);
  const MS_DAY = 86400000;
  // Guard against pathological spans.
  const MAX_DAYS = 5000;
  let count = 0;
  while (t <= last && count < MAX_DAYS) {
    const dt = new Date(t);
    out.push(
      `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`,
    );
    t += MS_DAY;
    count += 1;
  }
  return out;
}

/* ===========================================================================
 * Value accessors over AlignedNight
 * =========================================================================== */

/** Read a dotted path from an object, returning NaN if any hop is missing. @private */
function getPath(obj, path) {
  let cur = obj;
  for (const key of path.split('.')) {
    if (cur == null) return NaN;
    cur = cur[key];
  }
  return Number.isFinite(cur) ? cur : NaN;
}

/** Read the x (OSCAR) value for a pair from an AlignedNight. @private */
function getX(aligned, xKey) {
  return getPath(aligned.oscar, xKey);
}

/** Read the y (wearable) value for a pair from an AlignedNight. @private */
function getY(aligned, yPath) {
  return getPath(aligned.wearable, yPath);
}

/** Map an AlignedNight's nightKey. @private */
function nightKeyOf(aligned) {
  return aligned.nightKey ?? aligned.wearable?.nightKey ?? null;
}

/** Effect-size band label (interpretation only — never a sig gate). @private */
function effectBand(absR) {
  if (!Number.isFinite(absR)) return 'unknown';
  if (absR >= EFFECT_BANDS.LARGE) return 'large';
  if (absR >= EFFECT_BANDS.MEDIUM) return 'medium';
  if (absR >= EFFECT_BANDS.SMALL) return 'small';
  return 'negligible';
}

/** Median + IQR summary (PHI-safe). @private */
function medianIqr(values) {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return { median: null, iqr: null, n: 0 };
  return {
    median: quantile(finite, PCT_MEDIAN),
    iqr: quantile(finite, Q3) - quantile(finite, Q1),
    n: finite.length,
  };
}

/* ===========================================================================
 * MNAR coverage diagnostics (§4.6a)
 * =========================================================================== */

/**
 * Coverage-selection diagnostics for one pair. Compares AHI (and the gated y)
 * between nights KEPT for the pair vs nights DROPPED because the y metric was
 * gated out (present-but-insufficient). A Mann-Whitney selection test on AHI
 * flags whether dropped nights had systematically higher AHI (range restriction
 * that attenuates ρ toward 0).
 *
 * @param {object[]} aligned - All aligned nights.
 * @param {string} xKey - OSCAR metric (AHI etc.).
 * @param {string} yPath - Wearable metric path; its group drives the gate.
 * @returns {{nKept:number, nDroppedInsufficient:number,
 *   keptAhi:object, droppedAhi:object, selectionMW_p:number}}
 */
export function coverageSelectionDiagnostics(aligned, xKey, yPath) {
  const group = yPath.split('.')[0];
  const keptAhi = [];
  const droppedAhi = [];
  for (const a of aligned) {
    const xv = getX(a, xKey);
    const yv = getY(a, yPath);
    const insufficient =
      a.wearable?.coverage?.insufficient?.includes(group) ?? false;
    if (Number.isFinite(xv) && Number.isFinite(yv)) {
      keptAhi.push(xv);
    } else if (insufficient && Number.isFinite(xv)) {
      droppedAhi.push(xv);
    }
  }
  let selectionMW_p = NaN;
  if (keptAhi.length >= 1 && droppedAhi.length >= 1) {
    selectionMW_p = mannWhitneyUTest(droppedAhi, keptAhi).p;
  }
  return {
    nKept: keptAhi.length,
    nDroppedInsufficient: droppedAhi.length,
    keptAhi: medianIqr(keptAhi),
    droppedAhi: medianIqr(droppedAhi),
    selectionMW_p,
  };
}

/* ===========================================================================
 * The pair runner
 * =========================================================================== */

/**
 * Run one pair end-to-end (point estimate + tie-aware p + n_eff + lag profile +
 * MNAR + canary inputs). FDR/q-values are filled by {@link runCorrelationEngine}
 * after the full family is assembled.
 *
 * @param {object} pair - A {@link PAIR_REGISTRY} entry.
 * @param {object[]} aligned - All aligned nights.
 * @param {object} [opts]
 * @param {() => number} [opts.rng] - RNG for permutation p (injectable).
 * @param {(aligned:object[], yPath:string) => object[]} [opts.relaxedRebuild] -
 *   Optional hook returning aligned nights recomputed under a relaxed coverage
 *   gate, for the sensitivity Δρ (§4.6a). When absent, sensitivity is skipped.
 * @returns {object} The per-pair result (without q/FDR).
 */
export function runPair(pair, aligned, { rng = Math.random } = {}) {
  const { x: xKey, y: yPath } = pair;

  // Pairwise-complete, date-ordered series.
  const rows = aligned
    .map((a) => ({
      key: nightKeyOf(a),
      x: getX(a, xKey),
      y: getY(a, yPath),
    }))
    .filter((r) => Number.isFinite(r.x) && Number.isFinite(r.y) && r.key)
    .sort((a, b) => (a.key < b.key ? -1 : 1));

  const n = rows.length;
  const dateSpan =
    n > 0
      ? { from: rows[0].key, to: rows[n - 1].key }
      : { from: null, to: null };

  if (n < DATA_LIMITS.MIN_CORRELATION_SAMPLE_SIZE) {
    return {
      id: pair.id,
      x: xKey,
      y: yPath,
      family: pair.family,
      expectedSign: pair.expectedSign,
      bandTag: pair.bandTag,
      twoSided: !!pair.twoSided,
      rho: null,
      effectSize: 'insufficient-n',
      dateSpan,
      n,
      nEff: n,
      r1x: NaN,
      r1y: NaN,
      pMethod: 'none',
      pValue: NaN,
      pValueAdj: NaN,
      reason: 'insufficient-n',
      flags: [],
    };
  }

  const xArr = rows.map((r) => r.x);
  const yArr = rows.map((r) => r.y);

  const { correlation: rho } = spearmanCorrelation(xArr, yArr);

  // Tie-aware p: permutation when ties are heavy, else Student-t.
  const heavyTies = hasHeavyTies(xArr, yArr);
  let pValue;
  let pMethod;
  if (heavyTies) {
    pValue = permutationSpearmanP(xArr, yArr, { rng });
    pMethod = 'permutation';
  } else {
    pValue = tPFromRho(rho, n - TWO);
    pMethod = 't';
  }

  // Effective-N correction (serial correlation).
  const { nEff, r1x, r1y } = effectiveN(xArr, yArr);
  // Adjusted p at df = nEff − 2 (scale the same statistic to the reduced df).
  const pValueAdj = tPFromRho(rho, nEff - TWO);

  // Descriptive lag profile (lag-0 is the sole inferential point).
  const seriesX = rows.map((r) => [r.key, r.x]);
  const seriesY = rows.map((r) => [r.key, r.y]);
  const lagProfile = nightlyLagCorrelation(seriesX, seriesY);

  // MNAR coverage diagnostics.
  const coverage = coverageSelectionDiagnostics(aligned, xKey, yPath);

  const flags = [];
  if (Math.max(r1x, r1y) > CORRELATION_ENGINE.SERIAL_WARN_R1) {
    flags.push('serial-correlation');
  }
  // Coverage-selection: dropped nights have systematically higher AHI.
  if (
    Number.isFinite(coverage.selectionMW_p) &&
    coverage.selectionMW_p < CORRELATION_ENGINE.Q_PRIMARY &&
    coverage.droppedAhi.median != null &&
    coverage.keptAhi.median != null &&
    coverage.droppedAhi.median > coverage.keptAhi.median
  ) {
    flags.push('coverage-selection');
  }

  return {
    id: pair.id,
    x: xKey,
    y: yPath,
    family: pair.family,
    expectedSign: pair.expectedSign,
    bandTag: pair.bandTag,
    twoSided: !!pair.twoSided,
    rho,
    effectSize: effectBand(Math.abs(rho)),
    dateSpan,
    n,
    nEff,
    r1x,
    r1y,
    pMethod,
    pValue,
    pValueAdj,
    coverage,
    lagProfile,
    flags,
  };
}

/**
 * Apply the plausibility canary (§4.7) to a completed pair result: the one-sided
 * gross wrong-sign tripwire and the attenuation/coverage warning. Mutates and
 * returns `result.flags`.
 *
 * @param {object} result - A pair result (post-FDR; needs `survivesFDR`/`pValueAdj`).
 * @param {object[]} aligned - All aligned nights (for offset provenance).
 * @returns {object} The same result with canary flags applied.
 */
export function applyCanary(result, aligned) {
  const { GROSS_WRONG_SIGN_RHO, ATTENUATION_SHARE, NON_INFERRED_SHARE } =
    CORRELATION_ENGINE;

  // 1) Gross wrong-sign tripwire — only for one-sided pairs.
  if (
    !result.twoSided &&
    Number.isFinite(result.rho) &&
    Number.isFinite(result.pValueAdj) &&
    Math.abs(result.rho) >= GROSS_WRONG_SIGN_RHO &&
    result.pValueAdj < CORRELATION_ENGINE.Q_PRIMARY
  ) {
    const observedSign = result.rho < 0 ? '-' : '+';
    if (
      (result.expectedSign === '+' || result.expectedSign === '-') &&
      observedSign !== result.expectedSign
    ) {
      result.flags.push('gross-wrong-sign');
    }
  }

  // 2) Attenuation / coverage-driven warning — PRIMARY pairs only.
  if (result.family === 'primary') {
    const cov = result.coverage || {};
    const totalCov = (cov.nKept || 0) + (cov.nDroppedInsufficient || 0);
    const gatingLoss = totalCov > 0 ? cov.nDroppedInsufficient / totalCov : 0;
    const selectionFires = result.flags.includes('coverage-selection');

    // Offset-provenance share among the pair's contributing nights.
    const provenance = offsetProvenance(aligned, result.x, result.y);
    const nonInferredShare =
      provenance.carryForwardPct + provenance.defaultFallbackPct;

    if (
      selectionFires ||
      gatingLoss > ATTENUATION_SHARE ||
      nonInferredShare > NON_INFERRED_SHARE
    ) {
      result.flags.push('attenuation-risk');
    }
    result.offsetProvenance = provenance;
  }

  return result;
}

/**
 * Offset-provenance shares among the nights that actually contribute to a pair
 * (both x and y finite) (§3.2 → §4.7).
 *
 * @param {object[]} aligned - All aligned nights.
 * @param {string} xKey - OSCAR metric.
 * @param {string} yPath - Wearable metric path.
 * @returns {{inferredPct:number, carryForwardPct:number, defaultFallbackPct:number, n:number}}
 */
export function offsetProvenance(aligned, xKey, yPath) {
  let n = 0;
  let inferred = 0;
  let carry = 0;
  let dflt = 0;
  for (const a of aligned) {
    if (!Number.isFinite(getX(a, xKey)) || !Number.isFinite(getY(a, yPath))) {
      continue;
    }
    n += 1;
    const src = a.wearable?.windowSource;
    if (src === 'inferred') inferred += 1;
    else if (src === 'carry-forward') carry += 1;
    else if (src === 'default-fallback') dflt += 1;
    // 'userSleeps-hint' counts as neither inferred nor a hard fallback here.
  }
  const div = n > 0 ? n : 1;
  return {
    inferredPct: inferred / div,
    carryForwardPct: carry / div,
    defaultFallbackPct: dflt / div,
    n,
  };
}

/* ===========================================================================
 * Group contrasts (Mann-Whitney) (§4.4)
 * =========================================================================== */

/**
 * Run a pinned group contrast (§4.4). Splits aligned nights by the pinned
 * threshold and runs Mann-Whitney on the metric, reporting U, p, and the
 * rank-biserial effect size.
 *
 * @param {object} contrast - A {@link GROUP_CONTRASTS} entry.
 * @param {object[]} aligned - All aligned nights.
 * @returns {object} `{name, family, metric, U, p, rankBiserial, nA, nB}`.
 */
export function runGroupContrast(contrast, aligned) {
  const { HIGH_AHI, LOW_AHI, ADHERENT_HOURS } = CORRELATION_ENGINE;
  const a = []; // group A values (the "high"/"adherent" side)
  const b = []; // group B values
  for (const night of aligned) {
    const metricVal = getY(night, contrast.metric);
    if (!Number.isFinite(metricVal)) continue;
    if (contrast.split === 'ahi') {
      const ahi = getX(night, 'ahi');
      if (!Number.isFinite(ahi)) continue;
      if (ahi >= HIGH_AHI) a.push(metricVal);
      else if (ahi < LOW_AHI) b.push(metricVal);
    } else if (contrast.split === 'adherence') {
      const usage = getX(night, 'usageHours');
      if (!Number.isFinite(usage)) continue;
      if (usage >= ADHERENT_HOURS) a.push(metricVal);
      else b.push(metricVal);
    }
  }
  if (a.length === 0 || b.length === 0) {
    return {
      name: contrast.name,
      family: contrast.family,
      metric: contrast.metric,
      U: NaN,
      p: NaN,
      rankBiserial: NaN,
      nA: a.length,
      nB: b.length,
    };
  }
  const mw = mannWhitneyUTest(a, b);
  return {
    name: contrast.name,
    family: contrast.family,
    metric: contrast.metric,
    U: mw.U,
    p: mw.p,
    rankBiserial: mw.effect,
    nA: a.length,
    nB: b.length,
  };
}

/* ===========================================================================
 * Engine entry point
 * =========================================================================== */

/**
 * Run the full correlation engine over a set of `AlignedNight`s (§4.9).
 *
 * Whole-analysis gate: requires `≥ MIN_NIGHTS_FOR_ANALYSIS` aligned nights, else
 * returns a not-enough-data envelope with no correlations.
 *
 * BH operates on the n_eff-adjusted p over the FULL family (all run pair lag-0
 * tests + all run group contrasts), split by family q-threshold (primary 0.05,
 * exploratory 0.10).
 *
 * @param {object[]} aligned - AlignedNight records.
 * @param {object} [opts]
 * @param {() => number} [opts.rng] - RNG for permutation p (injectable for tests).
 * @param {ReadonlyArray} [opts.pairs] - Pair registry override (testing).
 * @param {ReadonlyArray} [opts.groupContrasts] - Group-contrast override (testing).
 * @returns {object} The engine output shape (§4.9).
 */
export function runCorrelationEngine(aligned, opts = {}) {
  const {
    rng = Math.random,
    pairs = PAIR_REGISTRY,
    groupContrasts = GROUP_CONTRASTS,
  } = opts;

  const nAlignedNights = Array.isArray(aligned) ? aligned.length : 0;
  const base = {
    pairRegistryVersion: PAIR_REGISTRY_VERSION,
    nAlignedNights,
    familyQThresholds: {
      primary: CORRELATION_ENGINE.Q_PRIMARY,
      exploratory: CORRELATION_ENGINE.Q_EXPLORATORY,
    },
    singleSubjectCaveat: true,
  };

  if (nAlignedNights < DATA_LIMITS.MIN_NIGHTS_FOR_ANALYSIS) {
    return {
      ...base,
      pairs: [],
      groupTests: [],
      familySize: 0,
      testsRun: 0,
      warnings: ['not-enough-overlapping-nights'],
    };
  }

  // Run all pairs and group contrasts.
  const pairResults = pairs.map((p) => runPair(p, aligned, { rng }));
  const groupResults = groupContrasts.map((c) => runGroupContrast(c, aligned));

  // Build the FULL BH family: pair lag-0 adjusted p + group-contrast p, but only
  // tests that actually ran (finite p). Split by family.
  const familyMembers = [];
  pairResults.forEach((r, idx) => {
    if (Number.isFinite(r.pValueAdj)) {
      familyMembers.push({
        kind: 'pair',
        idx,
        family: r.family,
        p: r.pValueAdj,
      });
    }
  });
  groupResults.forEach((g, idx) => {
    if (Number.isFinite(g.p)) {
      familyMembers.push({ kind: 'group', idx, family: g.family, p: g.p });
    }
  });

  // Per-family BH (primary at 0.05, exploratory at 0.10).
  for (const fam of ['primary', 'exploratory']) {
    const members = familyMembers.filter((m) => m.family === fam);
    const q =
      fam === 'primary'
        ? CORRELATION_ENGINE.Q_PRIMARY
        : CORRELATION_ENGINE.Q_EXPLORATORY;
    const bh = benjaminiHochberg(
      members.map((m) => m.p),
      q,
    );
    bh.forEach((res, i) => {
      const member = members[i];
      if (member.kind === 'pair') {
        pairResults[member.idx].qValue = res.qValue;
        pairResults[member.idx].survivesFDR = res.significant;
      } else {
        groupResults[member.idx].qValue = res.qValue;
        groupResults[member.idx].survivesFDR = res.significant;
      }
    });
  }

  // Default q/FDR for tests that didn't enter the family.
  for (const r of pairResults) {
    if (!('qValue' in r)) {
      r.qValue = NaN;
      r.survivesFDR = false;
    }
  }
  for (const g of groupResults) {
    if (!('qValue' in g)) {
      g.qValue = NaN;
      g.survivesFDR = false;
    }
  }

  // Apply the canary + attenuation warnings now that FDR is known.
  for (const r of pairResults) applyCanary(r, aligned);

  // Engine-level warnings: surface any pair-level coverage/attenuation/wrong-sign.
  const warnings = [];
  for (const r of pairResults) {
    if (r.flags.includes('gross-wrong-sign')) {
      warnings.push(`gross-wrong-sign: ${r.x}↔${r.y}`);
    }
    if (r.flags.includes('attenuation-risk')) {
      warnings.push(`attenuation-risk: ${r.x}↔${r.y}`);
    }
    if (r.flags.includes('coverage-selection')) {
      warnings.push(`coverage-selection: ${r.x}↔${r.y}`);
    }
  }

  const familySize = familyMembers.length;

  return {
    ...base,
    familySize,
    testsRun: familySize,
    pairs: pairResults,
    groupTests: groupResults,
    warnings,
  };
}
