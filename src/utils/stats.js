/**
 * Utility functions for data parsing and statistical summaries.
 */

// Parse a duration string "HH:MM:SS" into total seconds
export function parseDuration(s) {
  const parts = s.split(':').map(parseFloat);
  let h = 0;
  let m = 0;
  let sec = 0;
  if (parts.length === 3) {
    [h, m, sec] = parts;
  } else if (parts.length === 2) {
    [m, sec] = parts;
  } else if (parts.length === 1) {
    [sec] = parts;
  }
  return (h || 0) * 3600 + (m || 0) * 60 + (sec || 0);
}

// Compute approximate quantile (q in [0,1]) of numeric array
export function quantile(arr, q) {
  const sorted = arr.slice().sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

/**
 * Compute statistics for individual apnea events and their nightly frequency.
 * @param {Array<Object>} details - Filtered details rows containing apnea event records with DateTime and Data/Duration.
 * @returns {Object} Apnea event duration metrics and per-night event count metrics.
 */
export function computeApneaEventStats(details) {
  // Extract apnea event durations (seconds)
  const durations = details
    .filter(r => ['ClearAirway', 'Obstructive', 'Mixed'].includes(r['Event']))
    .map(r => parseFloat(r['Data/Duration']))
    .filter(v => !isNaN(v));
  const totalEvents = durations.length;
  if (totalEvents === 0) {
    return { durations, totalEvents };
  }
  const p25Dur = quantile(durations, 0.25);
  const medianDur = quantile(durations, 0.5);
  const p75Dur = quantile(durations, 0.75);
  const iqrDur = p75Dur - p25Dur;
  const p95Dur = quantile(durations, 0.95);
  const maxDur = Math.max(...durations);
  const countOver30 = durations.filter(v => v > 30).length;
  const countOver60 = durations.filter(v => v > 60).length;
  const countOutlierEvents = durations.filter(v => v >= (p75Dur + 1.5 * iqrDur)).length;

  // Compute events per night
  const nightCounts = {};
  details.forEach(r => {
    if (!['ClearAirway', 'Obstructive', 'Mixed'].includes(r['Event'])) return;
    const d = new Date(r['DateTime']);
    if (isNaN(d)) return;
    const key = d.toISOString().slice(0, 10);
    nightCounts[key] = (nightCounts[key] || 0) + 1;
  });
  const nightDates = Object.keys(nightCounts).sort();
  const eventsPerNight = nightDates.map(d => nightCounts[d]);
  let p25Night = 0, medianNight = 0, p75Night = 0, iqrNight = 0;
  if (eventsPerNight.length) {
    p25Night = quantile(eventsPerNight, 0.25);
    medianNight = quantile(eventsPerNight, 0.5);
    p75Night = quantile(eventsPerNight, 0.75);
    iqrNight = p75Night - p25Night;
  }
  const minNight = eventsPerNight.length ? Math.min(...eventsPerNight) : 0;
  const maxNight = eventsPerNight.length ? Math.max(...eventsPerNight) : 0;
  const outlierNightHigh = eventsPerNight.filter(v => v >= (p75Night + 1.5 * iqrNight)).length;
  const outlierNightLow = eventsPerNight.filter(v => v <= (p25Night - 1.5 * iqrNight)).length;

  return {
    durations,
    totalEvents,
    p25Dur,
    medianDur,
    p75Dur,
    p95Dur,
    iqrDur,
    maxDur,
    countOver30,
    countOver60,
    countOutlierEvents,
    nightDates,
    eventsPerNight,
    p25Night,
    medianNight,
    p75Night,
    iqrNight,
    minNight,
    maxNight,
    outlierNightHigh,
    outlierNightLow,
  };
}

// Summarize nightly usage statistics from summary data rows
export function summarizeUsage(data) {
  const totalNights = data.length;
  const usageHours = data
    .map(r => parseDuration(r['Total Time']) / 3600)
    .filter(h => !isNaN(h));
  const sumHours = usageHours.reduce((sum, h) => sum + h, 0);
  const avgHours = sumHours / totalNights;
  const nightsLong = usageHours.filter(h => h >= 4).length;
  const nightsLong6 = usageHours.filter(h => h >= 6).length;
  const nightsShort = totalNights - nightsLong;
  const minHours = Math.min(...usageHours);
  const maxHours = Math.max(...usageHours);
  const medianHours = quantile(usageHours, 0.5);
  const p25Hours = quantile(usageHours, 0.25);
  const p75Hours = quantile(usageHours, 0.75);
  const iqrHours = p75Hours - p25Hours;
  const outlierLowCount = usageHours.filter(
    h => h < p25Hours - 1.5 * iqrHours
  ).length;
  const outlierHighCount = usageHours.filter(
    h => h > p75Hours + 1.5 * iqrHours
  ).length;
  return {
    totalNights,
    avgHours,
    nightsLong,
    nightsLong6,
    nightsShort,
    minHours,
    maxHours,
    medianHours,
    p25Hours,
    p75Hours,
    iqrHours,
    outlierLowCount,
    outlierHighCount,
    usageHours,
  };
}

// Compute rolling averages and compliance metrics for usage hours
export function computeUsageRolling(dates, usageHours, windows = [7, 30]) {
  // Date-aware rolling windows by last w calendar days (inclusive).
  // Also compute normal-approx CI for mean and distribution-free CI for median.
  const n = usageHours.length;
  const result = {};
  const toDay = d => Math.floor(new Date(d).getTime() / (24 * 3600 * 1000));
  const days = dates.map(toDay);
  windows.forEach(w => {
    const avg = new Array(n).fill(0);
    const avg_ci_low = new Array(n).fill(NaN);
    const avg_ci_high = new Array(n).fill(NaN);
    const median = new Array(n).fill(0);
    const med_ci_low = new Array(n).fill(NaN);
    const med_ci_high = new Array(n).fill(NaN);
    const comp4 = new Array(n).fill(0);

    let start = 0; // start index of window
    // maintain rolling sums for mean and variance
    let sum = 0;
    let sumsq = 0;
    let cnt4 = 0;
    // multiset values for median CI; keep as a simple array for now
    const windowVals = [];

    const push = (val) => {
      windowVals.push(val);
      sum += val || 0;
      sumsq += (val || 0) * (val || 0);
      if (val >= 4) cnt4 += 1;
    };
    const remove = (val) => {
      // remove one occurrence from windowVals
      const idx = windowVals.indexOf(val);
      if (idx !== -1) windowVals.splice(idx, 1);
      sum -= val || 0;
      sumsq -= (val || 0) * (val || 0);
      if (val >= 4) cnt4 -= 1;
    };

    for (let i = 0; i < n; i++) {
      // advance end: include usageHours[i]
      push(usageHours[i]);
      // advance start while window exceeds w days
      const cutoff = days[i] - (w - 1);
      while (start <= i && days[start] < cutoff) {
        remove(usageHours[start]);
        start += 1;
      }
      const len = i - start + 1;
      if (len > 0) {
        const m = sum / len;
        avg[i] = m;
        // mean CI via normal approx: m ± 1.96 * s/√n
        const variance = Math.max(0, (sumsq - (sum * sum) / len) / Math.max(1, len - 1));
        const se = Math.sqrt(variance) / Math.sqrt(len);
        const z = 1.96;
        avg_ci_low[i] = m - z * se;
        avg_ci_high[i] = m + z * se;
        comp4[i] = (cnt4 / len) * 100;

        // median and its CI via order-statistics (binomial approx)
        const sorted = windowVals.slice().sort((a, b) => a - b);
        const mid = Math.floor((len - 1) / 2);
        median[i] = len % 2 === 1 ? sorted[mid] : (sorted[mid] + sorted[mid + 1]) / 2;
        // approximate nonparametric CI bounds for median
        const p = 0.5;
        const s = Math.sqrt(len * p * (1 - p));
        const kLower = Math.max(0, Math.floor(len * p - 1.96 * s));
        const kUpper = Math.min(len - 1, Math.ceil(len * p + 1.96 * s));
        med_ci_low[i] = sorted[kLower];
        med_ci_high[i] = sorted[kUpper];
      } else {
        avg[i] = 0;
        comp4[i] = 0;
      }
    }

    result[`avg${w}`] = avg;
    result[`avg${w}_ci_low`] = avg_ci_low;
    result[`avg${w}_ci_high`] = avg_ci_high;
    result[`median${w}`] = median;
    result[`median${w}_ci_low`] = med_ci_low;
    result[`median${w}_ci_high`] = med_ci_high;
    result[`compliance4_${w}`] = comp4;
  });
  return result;
}

// Compute adherence streaks for thresholds (e.g., >=4h and >=6h)
export function computeAdherenceStreaks(usageHours, thresholds = [4, 6]) {
  const map = {};
  thresholds.forEach(th => {
    let longest = 0;
    let current = 0;
    for (let i = 0; i < usageHours.length; i++) {
      if (usageHours[i] >= th) {
        current += 1;
        longest = Math.max(longest, current);
      } else {
        current = 0;
      }
    }
    map[`longest_${th}`] = longest;
  });
  return map;
}

// Lightweight breakpoint detection: sign changes where 7d vs 30d diff crosses, beyond threshold
export function detectUsageBreakpoints(rolling7, rolling30, dates, minDelta = 0.75) {
  const points = [];
  for (let i = 1; i < rolling7.length; i++) {
    const prev = rolling7[i - 1] - rolling30[i - 1];
    const curr = rolling7[i] - rolling30[i];
    const crossed = (prev <= 0 && curr > 0) || (prev >= 0 && curr < 0);
    if (crossed && Math.abs(curr) >= minDelta) {
      points.push(dates[i]);
    }
  }
  return points;
}

// Change-point detection via least-squares segmentation (PELT-like DP, O(n^2)).
// Returns array of Date objects where a change is detected.
export function detectChangePoints(series, dates, penalty = 10) {
  const n = series.length;
  if (!n) return [];
  // Prefix sums for fast SSE cost
  const pref = new Array(n + 1).fill(0);
  const pref2 = new Array(n + 1).fill(0);
  for (let i = 0; i < n; i++) {
    const v = series[i] ?? 0;
    pref[i + 1] = pref[i] + v;
    pref2[i + 1] = pref2[i] + v * v;
  }
  const costSeg = (i, j) => {
    // cost for segment [i..j] inclusive as SSE
    const len = j - i + 1;
    if (len <= 0) return 0;
    const sum = pref[j + 1] - pref[i];
    const sum2 = pref2[j + 1] - pref2[i];
    const mean = sum / len;
    return sum2 - 2 * mean * sum + len * mean * mean;
  };
  // DP: F[t] = min cost up to t, with change set C[t]
  const F = new Array(n + 1).fill(0);
  const prev = new Array(n + 1).fill(-1);
  F[0] = -penalty; // allow first segment without penalty
  for (let t = 1; t <= n; t++) {
    let best = Infinity;
    let bestK = -1;
    for (let k = 0; k < t; k++) {
      const cost = F[k] + costSeg(k, t - 1) + penalty;
      if (cost < best) { best = cost; bestK = k; }
    }
    F[t] = best;
    prev[t] = bestK;
  }
  // backtrack to get change indices
  const cps = [];
  let t = n;
  while (t > 0) {
    const k = prev[t];
    if (k <= 0) break;
    cps.push(k);
    t = k;
  }
  cps.reverse();
  // map to dates and compute simple strength: abs(diff of means) at CP
  const cpDates = [];
  for (let idx of cps) {
    if (dates && dates[idx]) cpDates.push(dates[idx]);
    else cpDates.push(idx);
  }
  return cpDates;
}

// Compute AHI trend metrics from summary data rows
export function computeAHITrends(data) {
  const ahis = data.map(r => parseFloat(r['AHI'])).filter(v => !isNaN(v));
  const avgAHI = ahis.reduce((a, b) => a + b, 0) / ahis.length;
  const minAHI = Math.min(...ahis);
  const maxAHI = Math.max(...ahis);
  const medianAHI = quantile(ahis, 0.5);
  const p25AHI = quantile(ahis, 0.25);
  const p75AHI = quantile(ahis, 0.75);
  const iqrAHI = p75AHI - p25AHI;
  const nightsAHIover5 = ahis.filter(v => v > 5).length;
  const sortedByDate = data
    .slice()
    .sort((a, b) => new Date(a['Date']) - new Date(b['Date']));
  const first = sortedByDate
    .slice(0, 30)
    .map(r => parseFloat(r['AHI']))
    .filter(v => !isNaN(v));
  const last = sortedByDate
    .slice(-30)
    .map(r => parseFloat(r['AHI']))
    .filter(v => !isNaN(v));
  const first30AvgAHI = first.reduce((a, b) => a + b, 0) / first.length;
  const last30AvgAHI = last.reduce((a, b) => a + b, 0) / last.length;
  return {
    avgAHI,
    minAHI,
    maxAHI,
    medianAHI,
    p25AHI,
    p75AHI,
    iqrAHI,
    nightsAHIover5,
    first30AvgAHI,
    last30AvgAHI,
    ahis,
  };
}

// Compute EPAP trend metrics from summary data rows
export function computeEPAPTrends(data) {
  const epaps = data.map(r => parseFloat(r['Median EPAP'])).filter(v => !isNaN(v));
  const minEPAP = Math.min(...epaps);
  const maxEPAP = Math.max(...epaps);
  const medianEPAP = quantile(epaps, 0.5);
  const p25EPAP = quantile(epaps, 0.25);
  const p75EPAP = quantile(epaps, 0.75);
  const iqrEPAP = p75EPAP - p25EPAP;
  const sortedByDate = data
    .slice()
    .sort((a, b) => new Date(a['Date']) - new Date(b['Date']));
  const first30 = sortedByDate
    .slice(0, 30)
    .map(r => parseFloat(r['Median EPAP']))
    .filter(v => !isNaN(v));
  const last30 = sortedByDate
    .slice(-30)
    .map(r => parseFloat(r['Median EPAP']))
    .filter(v => !isNaN(v));
  const avgMedianEPAPFirst30 = first30.reduce((a, b) => a + b, 0) / first30.length;
  const avgMedianEPAPLast30 = last30.reduce((a, b) => a + b, 0) / last30.length;
  const epapAhiPairs = data
    .map(r => [parseFloat(r['Median EPAP']), parseFloat(r['AHI'])])
    .filter(([p, a]) => !isNaN(p) && !isNaN(a));
  const meanEpap =
    epapAhiPairs.reduce((sum, [p]) => sum + p, 0) / epapAhiPairs.length;
  const meanAhi =
    epapAhiPairs.reduce((sum, [, a]) => sum + a, 0) / epapAhiPairs.length;
  const cov =
    epapAhiPairs.reduce((sum, [p, a]) => sum + (p - meanEpap) * (a - meanAhi), 0) /
    (epapAhiPairs.length - 1);
  const stdEp = Math.sqrt(
    epapAhiPairs.reduce((sum, [p]) => sum + (p - meanEpap) ** 2, 0) /
      (epapAhiPairs.length - 1)
  );
  const stdAh = Math.sqrt(
    epapAhiPairs.reduce((sum, [, a]) => sum + (a - meanAhi) ** 2, 0) /
      (epapAhiPairs.length - 1)
  );
  const corrEPAPAHI = cov / (stdEp * stdAh);
  const lowGroup = data
    .filter(r => parseFloat(r['Median EPAP']) < 7)
    .map(r => parseFloat(r['AHI']))
    .filter(v => !isNaN(v));
  const highGroup = data
    .filter(r => parseFloat(r['Median EPAP']) >= 7)
    .map(r => parseFloat(r['AHI']))
    .filter(v => !isNaN(v));
  const countLow = lowGroup.length;
  const countHigh = highGroup.length;
  const avgAHILow = lowGroup.reduce((a, b) => a + b, 0) / (countLow || 1);
  const avgAHIHigh = highGroup.reduce((a, b) => a + b, 0) / (countHigh || 1);
  return {
    minEPAP,
    maxEPAP,
    medianEPAP,
    p25EPAP,
    p75EPAP,
    iqrEPAP,
    avgMedianEPAPFirst30,
    avgMedianEPAPLast30,
    countLow,
    avgAHILow,
    countHigh,
    avgAHIHigh,
    corrEPAPAHI,
    epaps,
    epapAhiPairs,
    ahisLow: lowGroup,
    ahisHigh: highGroup,
  };
}

// Pearson correlation helper
export function pearson(x, y) {
  const n = Math.min(x.length, y.length);
  if (n < 2) return NaN;
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (let i = 0; i < n; i++) {
    const xi = x[i];
    const yi = y[i];
    if (!isFinite(xi) || !isFinite(yi)) continue;
    sx += xi; sy += yi;
    sxx += xi * xi; syy += yi * yi; sxy += xi * yi;
  }
  const cov = (sxy - (sx * sy) / n) / (n - 1);
  const vx = (sxx - (sx * sx) / n) / (n - 1);
  const vy = (syy - (sy * sy) / n) / (n - 1);
  const denom = Math.sqrt(vx) * Math.sqrt(vy);
  return denom ? cov / denom : NaN;
}

// Rank arrays for Spearman
export function rank(arr) {
  const indexed = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const ranks = new Array(arr.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j + 1 < indexed.length && indexed[j + 1].v === indexed[i].v) j++;
    const avgRank = (i + j + 2) / 2; // 1-based ranks averaged for ties
    for (let k = i; k <= j; k++) ranks[indexed[k].i] = avgRank;
    i = j + 1;
  }
  return ranks;
}

export function spearman(x, y) {
  const rx = rank(x);
  const ry = rank(y);
  return pearson(rx, ry);
}

// Standard normal CDF approximation
export function normalCdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  let prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  if (z > 0) prob = 1 - prob;
  return prob;
}

// Mann-Whitney U test with normal approximation (two-sided)
export function mannWhitneyUTest(a, b) {
  const n1 = a.length, n2 = b.length;
  if (n1 === 0 || n2 === 0) return { U: NaN, z: NaN, p: NaN, effect: NaN, method: 'NA' };
  // ranks on combined (average ranks for ties)
  const combined = a.map((v, i) => ({ v, g: 1, idx: i }))
    .concat(b.map((v, i) => ({ v, g: 2, idx: i })));
  combined.sort((x, y) => x.v - y.v);
  let rankSum1 = 0;
  let i = 0;
  const tieGroups = [];
  const ranks = new Array(combined.length);
  while (i < combined.length) {
    let j = i;
    while (j + 1 < combined.length && combined[j + 1].v === combined[i].v) j++;
    const avgRank = (i + j + 2) / 2;
    let count = 0;
    for (let k = i; k <= j; k++) {
      ranks[k] = avgRank;
      if (combined[k].g === 1) rankSum1 += avgRank;
      count++;
    }
    tieGroups.push(count);
    i = j + 1;
  }
  const U1 = rankSum1 - (n1 * (n1 + 1)) / 2;
  const U2 = n1 * n2 - U1;
  const U = Math.min(U1, U2);
  const mu = (n1 * n2) / 2;
  // tie correction for variance
  const tieCorr = 1 - tieGroups.reduce((acc, t) => acc + (t * (t * t - 1)), 0) / ((n1 + n2) * ((n1 + n2) * (n1 + n2) - 1));
  const sigma = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12) * Math.sqrt(Math.max(0, tieCorr));

  // Decide method: exact for small samples, otherwise normal approx
  const n = n1 + n2;
  const EXACT_MAX_N = 28; // keep DP tractable
  let method = 'normal';
  let p = NaN;
  let z = 0;
  if (n <= EXACT_MAX_N) {
    method = 'exact';
    // Build rank-sum distribution via DP over individual items (distinguishable), using scaled integer ranks (x2)
    const ranksScaled = ranks.map(r => Math.round(r * 2));
    const targetK = n1;
    // dp[k] = Map(sumScaled -> count)
    const dp = new Array(targetK + 1).fill(0).map(() => new Map());
    dp[0].set(0, 1);
    for (let r of ranksScaled) {
      for (let k = Math.min(targetK, n); k >= 1; k--) {
        const prev = dp[k - 1];
        const curr = dp[k];
        prev.forEach((cnt, sum) => {
          const ns = sum + r;
          curr.set(ns, (curr.get(ns) || 0) + cnt);
        });
      }
    }
    const dist = dp[targetK];
    const total = binom(n, n1);
    // observed rank sum scaled
    const R1 = rankSum1;
    const meanR1 = (n1 * (n + 1)) / 2;
    const obs = Math.round(R1 * 2);
    const meanScaled = Math.round(meanR1 * 2);
    const distArray = Array.from(dist.entries());
    const extremeProb = distArray.reduce((acc, [sumScaled, count]) => {
      return Math.abs(sumScaled - meanScaled) >= Math.abs(obs - meanScaled)
        ? acc + count
        : acc;
    }, 0);
    p = Math.min(1, extremeProb / total);
    z = sigma ? (U - mu) / sigma : 0;
  } else {
    method = 'normal';
    z = sigma ? (U - mu) / sigma : 0;
    p = 2 * (1 - normalCdf(Math.abs(z)));
  }
  // rank-biserial effect and approximate CI via proportion CI of CL = U/(n1*n2)
  const Npairs = n1 * n2;
  const CL = U / Npairs; // using smaller U aligns with two-sided p; convert to rank-biserial by 1-2U/N
  const effect = 1 - (2 * U) / Npairs;
  const { low: clLow, high: clHigh } = proportionCI(CL, Npairs);
  const effect_ci_low = 2 * clLow - 1;
  const effect_ci_high = 2 * clHigh - 1;
  return { U, z, p, effect, effect_ci_low, effect_ci_high, method };
}

function binom(n, k) {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let num = 1;
  let den = 1;
  for (let i = 1; i <= k; i++) {
    num *= (n - (k - i));
    den *= i;
    const g = gcd(num, den);
    num /= g; den /= g;
  }
  return Math.round(num / den);
}

function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { const t = b; b = a % b; a = t; }
  return a || 1;
}

// Wilson score interval for proportion
function proportionCI(p, n, z = 1.96) {
  if (!isFinite(p) || !isFinite(n) || n <= 0) return { low: NaN, high: NaN };
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return { low: Math.max(0, center - half), high: Math.min(1, center + half) };
}
