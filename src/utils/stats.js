/**
 * Utility functions for data parsing and statistical summaries.
 */

/**
 * Parse a duration string ("HH:MM:SS", "MM:SS", or "SS") into total seconds.
 * Returns `NaN` for malformed strings or optionally throws an error when
 * `throwOnError` is true.
 *
 * @param {string|number} s - Duration string or number of seconds.
 * @param {{ throwOnError?: boolean }} [opts] - Optional behaviour flags.
 * @returns {number} Total number of seconds or `NaN` if invalid.
 * @throws {Error} When the input is malformed and `opts.throwOnError` is true.
 */
export function parseDuration(s, opts = {}) {
  const { throwOnError = false } = opts;
  if (typeof s === 'number' && Number.isFinite(s)) return s;
  if (typeof s !== 'string') {
    if (throwOnError) throw new Error('Duration must be a string');
    return NaN;
  }
  const parts = s.split(':');
  if (parts.length === 0 || parts.length > 3) {
    if (throwOnError) throw new Error(`Invalid duration format: ${s}`);
    return NaN;
  }
  const nums = [];
  for (const p of parts) {
    if (!/^\d+(?:\.\d+)?$/.test(p)) {
      if (throwOnError) throw new Error(`Invalid duration segment: ${p}`);
      return NaN;
    }
    nums.push(parseFloat(p));
  }
  let h = 0,
    m = 0,
    sec = 0;
  if (nums.length === 3) {
    [h, m, sec] = nums;
  } else if (nums.length === 2) {
    [m, sec] = nums;
  } else if (nums.length === 1) {
    [sec] = nums;
  }
  return h * 3600 + m * 60 + sec;
}

// Compute approximate quantile (q in [0,1]) of numeric array.
// Returns NaN when the input array is empty.
export function quantile(arr, q) {
  if (!arr.length) return NaN;
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
    .filter((r) => ['ClearAirway', 'Obstructive', 'Mixed'].includes(r['Event']))
    .map((r) => parseFloat(r['Data/Duration']))
    .filter((v) => !isNaN(v));
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
  const countOver30 = durations.filter((v) => v > 30).length;
  const countOver60 = durations.filter((v) => v > 60).length;
  const countOutlierEvents = durations.filter(
    (v) => v >= p75Dur + 1.5 * iqrDur,
  ).length;

  // Compute events per night
  const nightCounts = {};
  details.forEach((r) => {
    if (!['ClearAirway', 'Obstructive', 'Mixed'].includes(r['Event'])) return;
    const d = new Date(r['DateTime']);
    if (isNaN(d)) return;
    const key = d.toISOString().slice(0, 10);
    nightCounts[key] = (nightCounts[key] || 0) + 1;
  });
  const nightDates = Object.keys(nightCounts).sort();
  const eventsPerNight = nightDates.map((d) => nightCounts[d]);
  let p25Night = 0,
    medianNight = 0,
    p75Night = 0,
    iqrNight = 0;
  if (eventsPerNight.length) {
    p25Night = quantile(eventsPerNight, 0.25);
    medianNight = quantile(eventsPerNight, 0.5);
    p75Night = quantile(eventsPerNight, 0.75);
    iqrNight = p75Night - p25Night;
  }
  const minNight = eventsPerNight.length ? Math.min(...eventsPerNight) : 0;
  const maxNight = eventsPerNight.length ? Math.max(...eventsPerNight) : 0;
  const outlierNightHigh = eventsPerNight.filter(
    (v) => v >= p75Night + 1.5 * iqrNight,
  ).length;
  const outlierNightLow = eventsPerNight.filter(
    (v) => v <= p25Night - 1.5 * iqrNight,
  ).length;

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
  const usageHours = [];
  let invalidNights = 0;
  for (const row of data) {
    const hours = parseDuration(row['Total Time']) / 3600;
    if (Number.isFinite(hours)) {
      usageHours.push(hours);
    } else {
      invalidNights += 1;
    }
  }
  const validNights = usageHours.length;
  const sumHours = usageHours.reduce((sum, h) => sum + h, 0);
  const avgHours = validNights ? sumHours / validNights : NaN;
  const nightsLong = usageHours.filter((h) => h >= 4).length;
  const nightsLong6 = usageHours.filter((h) => h >= 6).length;
  const nightsShort = usageHours.filter((h) => h < 4).length;
  let minHours = NaN,
    maxHours = NaN,
    medianHours = NaN,
    p25Hours = NaN,
    p75Hours = NaN,
    iqrHours = NaN,
    outlierLowCount = 0,
    outlierHighCount = 0;
  if (usageHours.length) {
    minHours = Math.min(...usageHours);
    maxHours = Math.max(...usageHours);
    medianHours = quantile(usageHours, 0.5);
    p25Hours = quantile(usageHours, 0.25);
    p75Hours = quantile(usageHours, 0.75);
    iqrHours = p75Hours - p25Hours;
    outlierLowCount = usageHours.filter(
      (h) => h < p25Hours - 1.5 * iqrHours,
    ).length;
    outlierHighCount = usageHours.filter(
      (h) => h > p75Hours + 1.5 * iqrHours,
    ).length;
  }
  return {
    totalNights,
    validNights,
    invalidNights,
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
  const toDay = (d) => Math.floor(new Date(d).getTime() / (24 * 3600 * 1000));
  const days = dates.map(toDay);
  windows.forEach((w) => {
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
        const variance = Math.max(
          0,
          (sumsq - (sum * sum) / len) / Math.max(1, len - 1),
        );
        const se = Math.sqrt(variance) / Math.sqrt(len);
        const z = 1.96;
        avg_ci_low[i] = m - z * se;
        avg_ci_high[i] = m + z * se;
        comp4[i] = (cnt4 / len) * 100;

        // median and its CI via order-statistics (binomial approx)
        const sorted = windowVals.slice().sort((a, b) => a - b);
        const mid = Math.floor((len - 1) / 2);
        median[i] =
          len % 2 === 1 ? sorted[mid] : (sorted[mid] + sorted[mid + 1]) / 2;
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
  thresholds.forEach((th) => {
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
export function detectUsageBreakpoints(
  rolling7,
  rolling30,
  dates,
  minDelta = 0.75,
) {
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
      if (cost < best) {
        best = cost;
        bestK = k;
      }
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
  const ahis = data.map((r) => parseFloat(r['AHI'])).filter((v) => !isNaN(v));
  const avgAHI = ahis.length
    ? ahis.reduce((a, b) => a + b, 0) / ahis.length
    : NaN;
  let minAHI = NaN,
    maxAHI = NaN,
    medianAHI = NaN,
    p25AHI = NaN,
    p75AHI = NaN,
    iqrAHI = NaN;
  if (ahis.length) {
    minAHI = Math.min(...ahis);
    maxAHI = Math.max(...ahis);
    medianAHI = quantile(ahis, 0.5);
    p25AHI = quantile(ahis, 0.25);
    p75AHI = quantile(ahis, 0.75);
    iqrAHI = p75AHI - p25AHI;
  }
  const nightsAHIover5 = ahis.filter((v) => v > 5).length;
  const sortedByDate = data
    .slice()
    .sort((a, b) => new Date(a['Date']) - new Date(b['Date']));
  const first = sortedByDate
    .slice(0, 30)
    .map((r) => parseFloat(r['AHI']))
    .filter((v) => !isNaN(v));
  const last = sortedByDate
    .slice(-30)
    .map((r) => parseFloat(r['AHI']))
    .filter((v) => !isNaN(v));
  const first30AvgAHI = first.length
    ? first.reduce((a, b) => a + b, 0) / first.length
    : NaN;
  const last30AvgAHI = last.length
    ? last.reduce((a, b) => a + b, 0) / last.length
    : NaN;
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
  const epaps = data
    .map((r) => parseFloat(r['Median EPAP']))
    .filter((v) => !isNaN(v));
  let minEPAP = NaN,
    maxEPAP = NaN,
    medianEPAP = NaN,
    p25EPAP = NaN,
    p75EPAP = NaN,
    iqrEPAP = NaN;
  if (epaps.length) {
    minEPAP = Math.min(...epaps);
    maxEPAP = Math.max(...epaps);
    medianEPAP = quantile(epaps, 0.5);
    p25EPAP = quantile(epaps, 0.25);
    p75EPAP = quantile(epaps, 0.75);
    iqrEPAP = p75EPAP - p25EPAP;
  }
  const sortedByDate = data
    .slice()
    .sort((a, b) => new Date(a['Date']) - new Date(b['Date']));
  const first30 = sortedByDate
    .slice(0, 30)
    .map((r) => parseFloat(r['Median EPAP']))
    .filter((v) => !isNaN(v));
  const last30 = sortedByDate
    .slice(-30)
    .map((r) => parseFloat(r['Median EPAP']))
    .filter((v) => !isNaN(v));
  const avgMedianEPAPFirst30 = first30.length
    ? first30.reduce((a, b) => a + b, 0) / first30.length
    : NaN;
  const avgMedianEPAPLast30 = last30.length
    ? last30.reduce((a, b) => a + b, 0) / last30.length
    : NaN;
  const epapAhiPairs = data
    .map((r) => [parseFloat(r['Median EPAP']), parseFloat(r['AHI'])])
    .filter(([p, a]) => !isNaN(p) && !isNaN(a));
  let corrEPAPAHI = NaN;
  if (epapAhiPairs.length > 1) {
    const meanEpap =
      epapAhiPairs.reduce((sum, [p]) => sum + p, 0) / epapAhiPairs.length;
    const meanAhi =
      epapAhiPairs.reduce((sum, [, a]) => sum + a, 0) / epapAhiPairs.length;
    const cov =
      epapAhiPairs.reduce(
        (sum, [p, a]) => sum + (p - meanEpap) * (a - meanAhi),
        0,
      ) /
      (epapAhiPairs.length - 1);
    const stdEp = Math.sqrt(
      epapAhiPairs.reduce((sum, [p]) => sum + (p - meanEpap) ** 2, 0) /
        (epapAhiPairs.length - 1),
    );
    const stdAh = Math.sqrt(
      epapAhiPairs.reduce((sum, [, a]) => sum + (a - meanAhi) ** 2, 0) /
        (epapAhiPairs.length - 1),
    );
    corrEPAPAHI = stdEp && stdAh ? cov / (stdEp * stdAh) : NaN;
  }
  const lowGroup = data
    .filter((r) => parseFloat(r['Median EPAP']) < 7)
    .map((r) => parseFloat(r['AHI']))
    .filter((v) => !isNaN(v));
  const highGroup = data
    .filter((r) => parseFloat(r['Median EPAP']) >= 7)
    .map((r) => parseFloat(r['AHI']))
    .filter((v) => !isNaN(v));
  const countLow = lowGroup.length;
  const countHigh = highGroup.length;
  const avgAHILow = countLow
    ? lowGroup.reduce((a, b) => a + b, 0) / countLow
    : NaN;
  const avgAHIHigh = countHigh
    ? highGroup.reduce((a, b) => a + b, 0) / countHigh
    : NaN;
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
  let count = 0,
    sx = 0,
    sy = 0,
    sxx = 0,
    syy = 0,
    sxy = 0;
  for (let i = 0; i < n; i++) {
    const xi = x[i];
    const yi = y[i];
    if (!isFinite(xi) || !isFinite(yi)) continue;
    count++;
    sx += xi;
    sy += yi;
    sxx += xi * xi;
    syy += yi * yi;
    sxy += xi * yi;
  }
  if (count < 2) return NaN;
  const cov = (sxy - (sx * sy) / count) / count;
  const vx = (sxx - (sx * sx) / count) / count;
  const vy = (syy - (sy * sy) / count) / count;
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

// Standard normal quantile (inverse CDF) approximation
// Uses the Beasley-Springer/Moro algorithm for high accuracy
export function normalQuantile(p) {
  const a = [2.50662823884, -18.61500062529, 41.39119773534, -25.44106049637];
  const b = [-8.4735109309, 23.08336743743, -21.06224101826, 3.13082909833];
  const c = [
    0.3374754822726147, 0.9761690190917186, 0.1607979714918209,
    0.0276438810333863, 0.0038405729373609, 0.0003951896511919,
    0.0000321767881768, 0.0000002888167364, 0.0000003960315187,
  ];
  const y = p - 0.5;
  if (Math.abs(y) < 0.42) {
    const r = y * y;
    const num = y * (((a[3] * r + a[2]) * r + a[1]) * r + a[0]);
    const den = (((b[3] * r + b[2]) * r + b[1]) * r + b[0]) * r + 1;
    return num / den;
  }
  let r = p;
  if (y > 0) r = 1 - p;
  r = Math.log(-Math.log(r));
  let x =
    c[0] +
    r *
      (c[1] +
        r *
          (c[2] +
            r *
              (c[3] +
                r * (c[4] + r * (c[5] + r * (c[6] + r * (c[7] + r * c[8])))))));
  return y < 0 ? -x : x;
}

// Standard normal CDF approximation
export function normalCdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  let prob =
    d *
    t *
    (0.3193815 +
      t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  if (z > 0) prob = 1 - prob;
  return prob;
}

// Mann-Whitney U test with normal approximation (two-sided)
export function mannWhitneyUTest(a, b) {
  const n1 = a.length,
    n2 = b.length;
  if (n1 === 0 || n2 === 0)
    return { U: NaN, z: NaN, p: NaN, effect: NaN, method: 'NA' };
  // ranks on combined (average ranks for ties)
  const combined = a
    .map((v, i) => ({ v, g: 1, idx: i }))
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
  const tieCorr =
    1 -
    tieGroups.reduce((acc, t) => acc + t * (t * t - 1), 0) /
      ((n1 + n2) * ((n1 + n2) * (n1 + n2) - 1));
  const sigma =
    Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12) * Math.sqrt(Math.max(0, tieCorr));

  // Decide method: exact for small samples, otherwise normal approx
  const n = n1 + n2;
  const EXACT_MAX_N = 28; // keep DP tractable
  let method = 'normal';
  let p = NaN;
  let z = 0;
  if (n <= EXACT_MAX_N) {
    method = 'exact';
    // Build rank-sum distribution via DP over individual items (distinguishable), using scaled integer ranks (x2)
    const ranksScaled = ranks.map((r) => Math.round(r * 2));
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
  // rank-biserial effect and approximate CI via proportion CI of CL = P(B > A)
  const Npairs = n1 * n2;
  const CL = Npairs ? U2 / Npairs : NaN;
  const effect = isFinite(CL) ? 2 * CL - 1 : NaN;
  const { low: clLow, high: clHigh } = proportionCI(CL, Npairs);
  const effect_ci_low = 2 * clLow - 1;
  const effect_ci_high = 2 * clHigh - 1;
  return { U, U1, U2, z, p, effect, effect_ci_low, effect_ci_high, method };
}

function binom(n, k) {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let num = 1;
  let den = 1;
  for (let i = 1; i <= k; i++) {
    num *= n - (k - i);
    den *= i;
    const g = gcd(num, den);
    num /= g;
    den /= g;
  }
  return Math.round(num / den);
}

function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a || 1;
}

// Wilson score interval for proportion
function proportionCI(p, n, z = 1.96) {
  if (!isFinite(p) || !isFinite(n) || n <= 0) return { low: NaN, high: NaN };
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const half =
    (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return { low: Math.max(0, center - half), high: Math.min(1, center + half) };
}

// LOESS smoothing (locally weighted linear regression) using tricube weights.
// x, y: arrays; xs: evaluation points; alpha: bandwidth fraction (0-1)
export function loessSmooth(x, y, xs, alpha = 0.3) {
  const n = Math.min(x.length, y.length);
  if (!n || !xs?.length) return [];
  const pairs = [];
  for (let i = 0; i < n; i++) {
    const xi = x[i];
    const yi = y[i];
    if (isFinite(xi) && isFinite(yi)) pairs.push([xi, yi]);
  }
  pairs.sort((a, b) => a[0] - b[0]);
  const xsOut = xs.slice();
  const m = Math.max(2, Math.floor(alpha * pairs.length));
  const tricube = (u) => {
    const t = Math.max(0, 1 - Math.pow(Math.abs(u), 3));
    return Math.pow(t, 3);
  };
  const res = new Array(xsOut.length).fill(NaN);
  for (let i = 0; i < xsOut.length; i++) {
    const x0 = xsOut[i];
    // Find window of m nearest neighbors by absolute distance
    let left = 0;
    let right = 0;
    // two-pointer expand around insertion point
    let idx = binarySearch(pairs, x0);
    left = idx - 1;
    right = idx;
    const neighbors = [];
    while (neighbors.length < m && (left >= 0 || right < pairs.length)) {
      const dl = left >= 0 ? Math.abs(pairs[left][0] - x0) : Infinity;
      const dr =
        right < pairs.length ? Math.abs(pairs[right][0] - x0) : Infinity;
      if (dl <= dr) {
        neighbors.push(pairs[left]);
        left--;
      } else {
        neighbors.push(pairs[right]);
        right++;
      }
    }
    const maxD =
      neighbors.reduce((mx, p) => Math.max(mx, Math.abs(p[0] - x0)), 0) || 1;
    // Weighted linear regression y = a + b x
    let sw = 0,
      swx = 0,
      swy = 0,
      swxx = 0,
      swxy = 0;
    for (const [xi, yi] of neighbors) {
      const w = tricube((xi - x0) / maxD);
      sw += w;
      swx += w * xi;
      swy += w * yi;
      swxx += w * xi * xi;
      swxy += w * xi * yi;
    }
    const den = sw * swxx - swx * swx;
    const b = den !== 0 ? (sw * swxy - swx * swy) / den : 0;
    const a = sw !== 0 ? (swy - b * swx) / sw : 0;
    res[i] = a + b * x0;
  }
  return res;
}

function binarySearch(pairs, x0) {
  let lo = 0,
    hi = pairs.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (pairs[mid][0] < x0) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// Running quantile across x using sliding window of k-nearest neighbors
export function runningQuantileXY(x, y, xs, q = 0.5, k = 25) {
  const n = Math.min(x.length, y.length);
  if (!n || !xs?.length) return [];
  const pts = [];
  for (let i = 0; i < n; i++) {
    const xi = x[i];
    const yi = y[i];
    if (isFinite(xi) && isFinite(yi)) pts.push([xi, yi]);
  }
  pts.sort((a, b) => a[0] - b[0]);
  const res = new Array(xs.length).fill(NaN);
  const nn = Math.max(3, Math.min(k, pts.length));
  for (let i = 0; i < xs.length; i++) {
    const x0 = xs[i];
    let left = 0,
      right = 0,
      idx = binarySearch(pts, x0);
    left = idx - 1;
    right = idx;
    const neighbors = [];
    while (neighbors.length < nn && (left >= 0 || right < pts.length)) {
      const dl = left >= 0 ? Math.abs(pts[left][0] - x0) : Infinity;
      const dr = right < pts.length ? Math.abs(pts[right][0] - x0) : Infinity;
      if (dl <= dr) {
        neighbors.push(pts[left][1]);
        left--;
      } else {
        neighbors.push(pts[right][1]);
        right++;
      }
    }
    neighbors.sort((a, b) => a - b);
    res[i] = quantile(neighbors, q);
  }
  return res;
}

// Kaplan–Meier survival for uncensored durations (all events observed)
// Returns stepwise survival at unique event times and approximate 95% CIs (log-log Greenwood)
export function kmSurvival(durations, z = 1.96) {
  const vals = (durations || [])
    .map(Number)
    .filter((v) => Number.isFinite(v) && v >= 0)
    .sort((a, b) => a - b);
  const n = vals.length;
  if (!n) return { times: [], survival: [], lower: [], upper: [] };
  const times = [];
  const dcount = [];
  for (let i = 0; i < n; ) {
    const t = vals[i];
    let j = i;
    while (j < n && vals[j] === t) j++;
    times.push(t);
    dcount.push(j - i);
    i = j;
  }
  const survival = [];
  const lower = [];
  const upper = [];
  let S = 1;
  let cumGreenwood = 0;
  let eventsSoFar = 0;
  for (let idx = 0; idx < times.length; idx++) {
    const di = dcount[idx];
    const ni = n - eventsSoFar;
    const frac = di / ni;
    S = S * (1 - frac);
    eventsSoFar += di;
    survival.push(S);
    // Greenwood incremental
    if (ni > di && di > 0) {
      cumGreenwood += di / (ni * (ni - di));
    }
    // log(-log S) CI
    if (S > 0 && S < 1) {
      const logS = Math.log(S);
      const absLogS = Math.abs(logS);
      if (absLogS > 1e-12 && Number.isFinite(absLogS)) {
        const se = Math.sqrt(cumGreenwood) / absLogS;
        const loglog = Math.log(-Math.log(S));
        const lo = Math.exp(-Math.exp(loglog + z * se));
        const hi = Math.exp(-Math.exp(loglog - z * se));
        lower.push(lo);
        upper.push(hi);
        continue;
      }
    }
    lower.push(NaN);
    upper.push(NaN);
  }
  return { times, survival, lower, upper };
}

// OLS residuals of y ~ [1, controls]
function olsResiduals(y, controls) {
  const n = y.length;
  const p = controls[0] ? controls[0].length : 0;
  if (!n || !p) return y.slice();
  // Build X with intercept
  const X = new Array(n);
  for (let i = 0; i < n; i++) {
    X[i] = [1];
    for (let j = 0; j < p; j++) X[i].push(controls[i][j]);
  }
  const k = p + 1;
  const XtX = Array.from({ length: k }, () => new Array(k).fill(0));
  const Xty = new Array(k).fill(0);
  for (let i = 0; i < n; i++) {
    const xi = X[i];
    for (let a = 0; a < k; a++) {
      Xty[a] += xi[a] * y[i];
      for (let b = 0; b < k; b++) XtX[a][b] += xi[a] * xi[b];
    }
  }
  const XtXinv = invertMatrix(XtX);
  if (!XtXinv) return y.slice();
  // beta = XtXinv * Xty
  const beta = new Array(k).fill(0);
  for (let a = 0; a < k; a++) {
    for (let b = 0; b < k; b++) beta[a] += XtXinv[a][b] * Xty[b];
  }
  // residuals r = y - X*beta
  const r = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let yhat = 0;
    for (let a = 0; a < k; a++) yhat += X[i][a] * beta[a];
    r[i] = y[i] - yhat;
  }
  return r;
}

function invertMatrix(A) {
  const n = A.length;
  // Create augmented [A | I]
  const M = A.map((row, i) =>
    row.concat(Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))),
  );
  // Gauss-Jordan elimination
  for (let col = 0; col < n; col++) {
    // find pivot
    let pivot = col;
    for (let i = col + 1; i < n; i++)
      if (Math.abs(M[i][col]) > Math.abs(M[pivot][col])) pivot = i;
    const pv = M[pivot][col];
    if (Math.abs(pv) < 1e-12) return null; // singular
    // swap
    if (pivot !== col) {
      const tmp = M[pivot];
      M[pivot] = M[col];
      M[col] = tmp;
    }
    // normalize
    for (let j = 0; j < 2 * n; j++) M[col][j] /= pv;
    // eliminate others
    for (let i = 0; i < n; i++) {
      if (i === col) continue;
      const factor = M[i][col];
      for (let j = 0; j < 2 * n; j++) M[i][j] -= factor * M[col][j];
    }
  }
  // extract right half
  const inv = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) inv[i][j] = M[i][n + j];
  return inv;
}

// Partial correlation of x and y controlling for controls (matrix of columns)
export function partialCorrelation(x, y, controls) {
  const n = Math.min(x.length, y.length);
  if (n < 3) return NaN;
  // Build controls matrix with rows aligned
  const p = controls?.[0]?.length ?? 0;
  if (!p) return pearson(x, y);
  const C = Array.from({ length: n }, () => new Array(p).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < p; j++) C[i][j] = controls[i][j];
  }
  const xr = olsResiduals(x, C);
  const yr = olsResiduals(y, C);
  return pearson(xr, yr);
}
