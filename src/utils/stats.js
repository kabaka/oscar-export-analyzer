/**
 * Utility functions for data parsing and statistical summaries.
 */

// Parse a duration string "HH:MM:SS" into total seconds
export function parseDuration(s) {
  const [h, m, sec] = s.split(':').map(parseFloat);
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
  };
}
