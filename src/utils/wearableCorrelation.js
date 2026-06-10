/**
 * Statistical correlation algorithms for OSCAR-Fitbit data analysis.
 *
 * Implements Mann-Whitney U tests, Spearman correlation, cross-correlation with lag analysis,
 * and advanced statistical methods for sleep therapy research. Follows existing OSCAR patterns
 * for statistical rigor and medical domain validation.
 *
 * @module utils/wearableCorrelation
 */

import { pearson } from './stats.js';

/**
 * Assigns ranks to array values, handling tied values with average rank method.
 * Used internally by Spearman correlation and Mann-Whitney U tests.
 *
 * @param {number[]} array - Numeric array to rank
 * @returns {number[]} Array of ranks (1-based)
 */
function assignRanks(array) {
  const indexed = array.map((val, idx) => ({ val, idx }));
  indexed.sort((a, b) => {
    if (isNaN(a.val) && isNaN(b.val)) return 0;
    if (isNaN(a.val)) return 1; // NaN ranks last
    if (isNaN(b.val)) return -1;
    return a.val - b.val;
  });

  const ranks = new Array(array.length);

  let i = 0;
  while (i < indexed.length) {
    if (isNaN(indexed[i].val)) {
      // Assign NaN rank to NaN values
      for (let k = i; k < indexed.length; k++) {
        ranks[indexed[k].idx] = NaN;
      }
      break;
    }

    let j = i;
    while (
      j < indexed.length &&
      !isNaN(indexed[j].val) &&
      indexed[j].val === indexed[i].val
    ) {
      j++;
    }

    const avgRank = (i + j + 1) / 2; // 1-based ranking
    for (let k = i; k < j; k++) {
      ranks[indexed[k].idx] = avgRank;
    }
    i = j;
  }

  return ranks;
}

/**
 * Computes Spearman rank correlation coefficient between two variables.
 * Robust to outliers and non-normal distributions, ideal for physiological data.
 *
 * **Statistical Properties:**
 * - Measures monotonic (not necessarily linear) relationships
 * - Robust to outliers and non-normal distributions
 * - Range: [-1, 1], where ±1 indicates perfect monotonic relationship
 * - Uses average rank method for tied values (consistent with R's cor(method="spearman"))
 *
 * **Clinical Applications:**
 * - AHI ↔ HRV correlation (expected: ρ = -0.3 to -0.6)
 * - EPAP ↔ SpO2 minimum correlation (expected: ρ = +0.2 to +0.5)
 * - Sleep efficiency ↔ CPAP usage correlation
 *
 * @param {number[]} x - First variable (e.g., nightly AHI values)
 * @param {number[]} y - Second variable (e.g., nightly HRV values)
 * @returns {{ correlation: number, n: number, pValue?: number }} Spearman correlation results
 */
export function spearmanCorrelation(x, y) {
  if (!Array.isArray(x) || !Array.isArray(y)) {
    throw new Error('spearmanCorrelation: inputs must be arrays');
  }

  if (x.length !== y.length) {
    throw new Error('spearmanCorrelation: arrays must have equal length');
  }

  if (x.length < 3) {
    return {
      correlation: NaN,
      n: x.length,
      pValue: NaN,
    };
  }

  // Filter out pairs with NaN values
  const validPairs = [];
  for (let i = 0; i < x.length; i++) {
    if (Number.isFinite(x[i]) && Number.isFinite(y[i])) {
      validPairs.push({ x: x[i], y: y[i] });
    }
  }

  if (validPairs.length < 3) {
    return {
      correlation: NaN,
      n: validPairs.length,
      pValue: NaN,
    };
  }

  const xVals = validPairs.map((p) => p.x);
  const yVals = validPairs.map((p) => p.y);

  const ranksX = assignRanks(xVals);
  const ranksY = assignRanks(yVals);

  // Pearson correlation of ranks = Spearman correlation
  const correlation = pearson(ranksX, ranksY);

  const n = validPairs.length;
  if (!Number.isFinite(correlation)) {
    return { correlation, n, pValue: NaN };
  }

  const absCorr = Math.abs(correlation);
  if (absCorr >= 0.999999999) {
    return { correlation, n, pValue: 0 };
  }

  const denom = 1 - correlation * correlation;
  if (denom <= 0) {
    return { correlation, n, pValue: NaN };
  }

  const t = correlation * Math.sqrt((n - 2) / denom);
  const pValueRaw = 2 * (1 - studentTCDF(Math.abs(t), n - 2));
  const pValue = Number.isFinite(pValueRaw)
    ? Math.min(Math.max(pValueRaw, 0), 1)
    : NaN;

  return {
    correlation,
    n,
    pValue,
  };
}

/**
 * Cross-correlation over a POSITIONAL array (lag by index, not by date).
 *
 * ⚠️ INTERNAL — do NOT call directly on gappy nightly series. This function is
 * positional (it `slice`s by array index) and its emitted `lag` is sign-flipped
 * relative to its prose ("positive lag: y leads x" but it emits `lag: -lag`).
 * The wearable engine wraps it behind `nightlyLagCorrelation`
 * (utils/wearable/correlationEngine.js), which builds a calendar-dense array
 * first, deletes NaN pairs per lag, and applies a single documented lag-sign
 * convention. Use that wrapper as the sole public lag entry point (§4.2/§4.4).
 *
 * @param {number[]} x - First positional series.
 * @param {number[]} y - Second positional series.
 * @param {Object} options - Configuration options.
 * @param {number} [options.maxLag=30] - Maximum lag to test (±maxLag).
 * @returns {{ ccf: Array, peak: Object, isSignificant: boolean }}
 */
export function crossCorrelation(x, y, { maxLag = 30 } = {}) {
  if (!Array.isArray(x) || !Array.isArray(y)) {
    throw new Error('crossCorrelation: inputs must be arrays');
  }

  const n = Math.min(x.length, y.length);
  if (n < maxLag + 2) {
    throw new Error(
      `crossCorrelation: insufficient data (n=${n}, need >${maxLag + 2})`,
    );
  }

  const ccf = [];

  for (let lag = -maxLag; lag <= maxLag; lag++) {
    let xSeries, ySeries;

    if (lag >= 0) {
      // y leads x by lag: align x[0..n-lag-1] with y[lag..n-1]
      xSeries = x.slice(0, n - lag);
      ySeries = y.slice(lag);
    } else {
      // x leads y by |lag|: align x[|lag|..n-1] with y[0..n-|lag|-1]
      xSeries = x.slice(-lag);
      ySeries = y.slice(0, n + lag);
    }

    const correlation = pearson(xSeries, ySeries);
    ccf.push({ lag: lag === 0 ? 0 : -lag, correlation, n: xSeries.length }); // Negate lag, ensure +0 not -0
  }

  // Find peak correlation
  const peak = ccf.reduce((max, curr) =>
    Math.abs(curr.correlation) > Math.abs(max.correlation) ? curr : max,
  );

  // Statistical significance threshold (95% CI for white noise)
  const threshold = 1.96 / Math.sqrt(n);
  const isSignificant = Math.abs(peak.correlation) > threshold;

  return {
    ccf,
    peak: { ...peak, threshold },
    isSignificant,
  };
}

// Simplified statistical distribution functions for significance testing

/**
 * Student-t CDF via the regularized incomplete beta (Numerical Recipes).
 * Exported so the wearable correlation engine reuses ONE t-CDF source for its
 * effective-N–adjusted p-values (§4.3a) rather than reimplementing it.
 *
 * @param {number} t - t statistic.
 * @param {number} df - degrees of freedom (may be fractional, e.g. n_eff − 2).
 * @returns {number} P(T ≤ t), or `NaN` for invalid input.
 */
export function studentTCDF(t, df) {
  if (!Number.isFinite(t) || !Number.isFinite(df) || df <= 0) {
    return NaN;
  }

  // Normal approximation for extremely large df
  if (df > 1e6) {
    return standardNormalCDF(t);
  }

  // Regularized incomplete beta based implementation (Numerical Recipes)
  const x = df / (df + t * t);
  const ibeta = regularizedIncompleteBeta(x, df / 2, 0.5);
  if (!Number.isFinite(ibeta)) {
    return NaN;
  }

  return t >= 0 ? 1 - 0.5 * ibeta : 0.5 * ibeta;
}

function regularizedIncompleteBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  const bt = Math.exp(
    logGamma(a + b) -
      logGamma(a) -
      logGamma(b) +
      a * Math.log(x) +
      b * Math.log(1 - x),
  );

  if (x < (a + 1) / (a + b + 2)) {
    return (bt * betacf(a, b, x)) / a;
  }
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

function betacf(a, b, x) {
  const MAX_ITER = 200;
  const EPS = 3e-7;
  const FPMIN = 1e-30;

  let qab = a + b;
  let qap = a + 1;
  let qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;

  for (let m = 1; m <= MAX_ITER; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;

    aa = -((a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;

    if (Math.abs(del - 1) < EPS) {
      break;
    }
  }

  return h;
}

function logGamma(z) {
  // Lanczos approximation for log-gamma
  const cof = [
    76.18009172947146, -86.5053203294168, 24.01409824083091, -1.231739572450155,
    0.001208650973866179, -0.000005395239384953,
  ];

  let x = z;
  let y = z;
  let tmp = z + 5.5;
  tmp -= (z + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < cof.length; j++) {
    y += 1;
    ser += cof[j] / y;
  }
  return Math.log((2.50662827463 * ser) / x) - tmp;
}

function standardNormalCDF(z) {
  return 0.5 * (1 + erf(z / Math.sqrt(2)));
}

function erf(x) {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x >= 0 ? 1 : -1;
  const absX = Math.abs(x);

  const t = 1.0 / (1.0 + p * absX);
  const y =
    1.0 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

  return sign * y;
}
