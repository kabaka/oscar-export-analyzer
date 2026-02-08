/**
 * Hook for running OSCAR-Fitbit correlation analysis when both data sources
 * are available. Transforms data formats, executes the analysis pipeline, and
 * shapes results for the FitbitDashboard component.
 *
 * @module hooks/useFitbitAnalysis
 */

import { useMemo } from 'react';
import { analyzeOscarFitbitIntegration } from '../utils/fitbitAnalysis.js';

/**
 * Transforms raw synced heart rate data into the format expected by
 * alignOscarFitbitNights (fitbitSync.js).
 *
 * From: [{ date: "2026-01-08", restingHeartRate: 68, heartRateZones: [...] }]
 * To:   [{ date: "2026-01-08T12:00:00", fitbit: { heartRate: { restingBpm: 68 } } }]
 *
 * Uses noon local time (T12:00:00 without Z) so formatDateKey produces the
 * correct calendar date regardless of the runtime timezone.
 *
 * @param {Array} heartRateData - Parsed heart rate records from parseSyncResults
 * @param {Array} [spo2Data] - Parsed SpO2 records from parseSyncResults
 * @param {Array} [sleepData] - Parsed sleep records from parseSyncResults
 * @param {Array} [heartRateIntraday] - Per-day intraday HR data from parseSyncResults
 * @returns {Array} Fitbit nightly records for the analysis pipeline
 */
export function transformFitbitDataForPipeline(
  heartRateData,
  spo2Data = [],
  sleepData = [],
  heartRateIntraday = [],
) {
  if (!Array.isArray(heartRateData)) return [];

  // Build lookup maps for SpO2 and sleep data by date
  const spo2ByDate = new Map();
  if (Array.isArray(spo2Data)) {
    for (const entry of spo2Data) {
      if (entry?.date) spo2ByDate.set(entry.date, entry);
    }
  }

  const sleepByDate = new Map();
  if (Array.isArray(sleepData)) {
    for (const entry of sleepData) {
      if (entry?.date) sleepByDate.set(entry.date, entry);
    }
  }

  // Collect all unique dates from all data sources
  const allDates = new Set();
  for (const d of heartRateData) {
    if (d?.date) allDates.add(d.date);
  }
  for (const d of spo2Data || []) {
    if (d?.date) allDates.add(d.date);
  }
  for (const d of sleepData || []) {
    if (d?.date) allDates.add(d.date);
  }

  // Build HR lookup
  const hrByDate = new Map();
  for (const day of heartRateData) {
    if (day?.date && day.restingHeartRate != null) {
      hrByDate.set(day.date, day);
    }
  }

  // Build HR intraday lookup
  const hrIntradayByDate = new Map();
  if (Array.isArray(heartRateIntraday)) {
    for (const entry of heartRateIntraday) {
      if (entry?.date) hrIntradayByDate.set(entry.date, entry);
    }
  }

  // Build merged records for each date that has any data
  const records = [];
  for (const dateStr of allDates) {
    const hr = hrByDate.get(dateStr);
    const spo2 = spo2ByDate.get(dateStr);
    const sleep = sleepByDate.get(dateStr);
    const hrIntraday = hrIntradayByDate.get(dateStr);

    // Require at least HR data to produce a record
    if (!hr) continue;

    const fitbit = {
      heartRate: {
        restingBpm: hr.restingHeartRate,
      },
    };

    // Include intraday HR data when available
    if (hrIntraday?.intradayData?.length > 0) {
      fitbit.heartRate.intradayData = hrIntraday.intradayData;
      fitbit.heartRate.intradayStats = hrIntraday.intradayStats;
    }

    if (spo2) {
      fitbit.oxygenSaturation = {
        avgPercent: spo2.avg,
        minPercent: spo2.min,
        maxPercent: spo2.max,
      };
    }

    if (sleep) {
      fitbit.sleepStages = {
        totalSleepMinutes: sleep.minutesAsleep,
        sleepEfficiency: sleep.efficiency,
        deepSleepMinutes: sleep.deep,
        remSleepMinutes: sleep.rem,
        lightSleepMinutes: sleep.light,
        awakeMinutes: sleep.wake,
        onsetLatencyMin: sleep.minutesToFallAsleep,
      };
    }

    records.push({
      date: `${dateStr}T12:00:00`,
      fitbit,
    });
  }

  return records;
}

/**
 * Backward-compatible alias — transforms only HR data.
 *
 * @param {Array} heartRateData - Parsed heart rate records
 * @returns {Array} Fitbit nightly records for the analysis pipeline
 */
export function transformHeartRateForPipeline(heartRateData) {
  return transformFitbitDataForPipeline(heartRateData);
}

/**
 * Prepares OSCAR summary rows for the analysis pipeline.
 * Adds sessionStartTime so calculateSleepDate in fitbitSync.js produces
 * the correct calendar date.
 *
 * Uses 10 PM local time (T22:00:00 without Z), which maps correctly to the
 * same calendar date through calculateSleepDate across all timezones.
 *
 * @param {Array} filteredSummary - Parsed CSV rows with Date field
 * @returns {Array} OSCAR records ready for alignment
 */
export function prepareOscarData(filteredSummary) {
  if (!Array.isArray(filteredSummary)) return [];

  return filteredSummary.map((row) => ({
    ...row,
    sessionStartTime: `${row.Date}T22:00:00`,
  }));
}

/**
 * Builds scatter plot data from correlation metrics.
 * Creates paired (x, y) point arrays for each metric combination.
 *
 * @param {Object} metrics - Extracted metric arrays from computeOscarFitbitCorrelations
 * @returns {Object} Keyed scatter data for BivariateScatterPlot
 */
export function buildScatterData(metrics) {
  if (!metrics) return {};

  const scatterPairs = {};
  const metricKeys = Object.keys(metrics);

  for (let i = 0; i < metricKeys.length; i++) {
    for (let j = i + 1; j < metricKeys.length; j++) {
      const xKey = metricKeys[i];
      const yKey = metricKeys[j];
      const xVals = metrics[xKey];
      const yVals = metrics[yKey];

      if (!Array.isArray(xVals) || !Array.isArray(yVals)) continue;

      const points = [];
      for (let k = 0; k < Math.min(xVals.length, yVals.length); k++) {
        if (Number.isFinite(xVals[k]) && Number.isFinite(yVals[k])) {
          points.push({ x: xVals[k], y: yVals[k], index: k });
        }
      }

      if (points.length > 0) {
        scatterPairs[`${xKey}_${yKey}`] = {
          xMetric: xKey,
          yMetric: yKey,
          points,
        };
      }
    }
  }

  return scatterPairs;
}

/**
 * Human-readable labels for internal metric keys used in correlation pairs.
 * @type {Object<string, string>}
 */
export const METRIC_LABELS = {
  ahi: 'AHI',
  restingHR: 'Resting HR',
  minSpO2: 'Min SpO2',
  avgSpO2: 'Avg SpO2',
  sleepEfficiency: 'Sleep Efficiency',
  deepSleepPercent: 'Deep Sleep %',
  hrv: 'HRV',
  epap: 'EPAP',
  usage: 'Usage (hrs)',
  leakPercent: 'Leak %',
};

/**
 * Converts pair-format correlation output into the NxN matrix format
 * expected by CorrelationMatrix.
 *
 * Pair format (from computeOscarFitbitCorrelations):
 *   { correlations: { "ahi_restingHR": { correlation, pValue, ... }, ... }, sampleSize, metrics }
 *
 * Matrix format (for CorrelationMatrix component):
 *   { metrics: string[], correlations: number[][], pValues: number[][], sampleSize: number }
 *
 * @param {Object|null} correlationAnalysis - Raw correlation output
 * @returns {Object|null} Matrix-format correlation data, or null if input is empty
 */
export function buildCorrelationMatrix(correlationAnalysis) {
  if (!correlationAnalysis?.correlations) return null;

  const pairs = correlationAnalysis.correlations;
  const pairKeys = Object.keys(pairs);
  if (pairKeys.length === 0) return null;

  // Extract unique metric keys from pair keys (e.g. "ahi_restingHR" → ["ahi", "restingHR"])
  const metricSet = new Set();
  const pairLookup = new Map();

  for (const key of pairKeys) {
    const pair = pairs[key];
    const parts = findMetricPair(key);
    if (parts) {
      const [a, b] = parts;
      metricSet.add(a);
      metricSet.add(b);
      pairLookup.set(`${a}_${b}`, pair);
      pairLookup.set(`${b}_${a}`, pair);
    }
  }

  const metricKeys = [...metricSet];
  const n = metricKeys.length;
  if (n === 0) return null;

  const labels = metricKeys.map((k) => METRIC_LABELS[k] || k);

  // Build NxN matrices
  const corrMatrix = Array.from({ length: n }, () => Array(n).fill(null));
  const pValMatrix = Array.from({ length: n }, () => Array(n).fill(null));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        corrMatrix[i][j] = 1.0;
        pValMatrix[i][j] = 0.0;
      } else {
        const lookupKey = `${metricKeys[i]}_${metricKeys[j]}`;
        const pair = pairLookup.get(lookupKey);
        if (pair) {
          corrMatrix[i][j] = Number.isFinite(pair.correlation)
            ? pair.correlation
            : null;
          pValMatrix[i][j] = Number.isFinite(pair.pValue) ? pair.pValue : null;
        }
      }
    }
  }

  return {
    metrics: labels,
    correlations: corrMatrix,
    pValues: pValMatrix,
    sampleSize: correlationAnalysis.sampleSize ?? null,
  };
}

/**
 * Extracts the two metric names from a pair key like "ahi_restingHR".
 * Tries all split positions against known metric labels, then falls back
 * to the first underscore split.
 *
 * @param {string} key - The pair key (e.g. "ahi_restingHR")
 * @returns {[string,string]|null} The two metric keys, or null if unresolvable
 */
function findMetricPair(key) {
  const knownMetrics = Object.keys(METRIC_LABELS);

  // Try every possible underscore split position
  for (let pos = 1; pos < key.length; pos++) {
    if (key[pos] === '_') {
      const a = key.slice(0, pos);
      const b = key.slice(pos + 1);
      if (knownMetrics.includes(a) && knownMetrics.includes(b)) {
        return [a, b];
      }
    }
  }

  // Fallback: accept even unknown metric keys so the matrix is still populated
  const underscoreIdx = key.indexOf('_');
  if (underscoreIdx > 0 && underscoreIdx < key.length - 1) {
    return [key.slice(0, underscoreIdx), key.slice(underscoreIdx + 1)];
  }

  return null;
}

/**
 * Shapes raw analysis results into the format expected by FitbitDashboard.
 *
 * Dashboard expects:
 *   { correlationData, nightlyData, scatterData, summary, heartRateData, heartRateIntraday }
 *
 * @param {Object|null} analysisResult - Output from analyzeOscarFitbitIntegration
 * @param {Array} rawHeartRateData - Original synced heart rate data (for fallback display)
 * @param {Array} [rawHeartRateIntraday] - Per-day intraday HR data for night detail view
 * @returns {Object} Dashboard-compatible fitbitData
 */
export function shapeForDashboard(
  analysisResult,
  rawHeartRateData,
  rawHeartRateIntraday,
) {
  if (!analysisResult || !analysisResult.success) {
    return {
      heartRateData: rawHeartRateData || [],
      heartRateIntraday: rawHeartRateIntraday || [],
    };
  }

  const {
    correlations,
    alignedRecords,
    dataOverview,
    clinicalInsights,
    advancedAnalysis,
  } = analysisResult;

  // Helper: coerce NaN/undefined/null to null for safe display
  const finiteOrNull = (v) => (Number.isFinite(v) ? v : null);

  // Count strong correlations (|r| > 0.3 and p < 0.05)
  const strongCorrelations = correlations?.correlations
    ? Object.values(correlations.correlations).filter(
        (c) =>
          Number.isFinite(c.correlation) &&
          Number.isFinite(c.pValue) &&
          Math.abs(c.correlation) > 0.3 &&
          c.pValue < 0.05,
      ).length
    : 0;

  // Transform aligned records for nightly view
  const nightlyData = (alignedRecords || []).map((record) => ({
    date:
      record.date instanceof Date
        ? record.date.toISOString().slice(0, 10)
        : String(record.date).slice(0, 10),
    avgHeartRate: finiteOrNull(record.fitbit?.heartRate?.restingBpm),
    ahi: finiteOrNull(record.oscar?.ahi),
    minSpO2: finiteOrNull(record.fitbit?.oxygenSaturation?.minPercent),
    oscar: record.oscar,
    fitbit: record.fitbit,
  }));

  // Build scatter data from raw correlation metrics (needs the metrics object, not matrix)
  const scatterData = buildScatterData(correlations?.metrics);

  return {
    correlationData: buildCorrelationMatrix(correlations),
    nightlyData,
    scatterData,
    summary: {
      totalNights: dataOverview?.analysisNights || alignedRecords?.length || 0,
      strongCorrelations,
      matchRate: dataOverview?.matchRate,
      dataQuality: dataOverview?.dataQuality,
    },
    heartRateData: rawHeartRateData || [],
    heartRateIntraday: rawHeartRateIntraday || [],
    clinicalInsights,
    advancedAnalysis,
  };
}

/**
 * Hook that automatically runs OSCAR-Fitbit correlation analysis
 * when both OSCAR CSV data and Fitbit heart rate data are available.
 *
 * Uses useMemo to recompute only when either data source changes.
 *
 * @param {Object} options
 * @param {Array|null} options.oscarData - filteredSummary from DataContext
 * @param {Object|null} options.fitbitSyncedData - syncedData from useFitbitConnection
 *   Expected shape: { heartRateData: [...], heartRateIntraday?: [...], spo2Data?: [...], sleepData?: [...] }
 * @returns {{ analysisData: Object, hasAnalysis: boolean, analysisError: string|null }}
 */
export function useFitbitAnalysis({ oscarData, fitbitSyncedData } = {}) {
  return useMemo(() => {
    const hasOscarData = Array.isArray(oscarData) && oscarData.length > 0;
    const rawHeartRateData = fitbitSyncedData?.heartRateData;
    const rawHeartRateIntraday = fitbitSyncedData?.heartRateIntraday;
    const rawSpo2Data = fitbitSyncedData?.spo2Data;
    const rawSleepData = fitbitSyncedData?.sleepData;
    const hasHeartRateData =
      Array.isArray(rawHeartRateData) && rawHeartRateData.length > 0;

    // When either source is missing, return raw HR data for basic display
    if (!hasOscarData || !hasHeartRateData) {
      return {
        analysisData: shapeForDashboard(
          null,
          rawHeartRateData,
          rawHeartRateIntraday,
        ),
        hasAnalysis: false,
        analysisError: null,
      };
    }

    try {
      const preparedOscar = prepareOscarData(oscarData);
      const preparedFitbit = transformFitbitDataForPipeline(
        rawHeartRateData,
        rawSpo2Data,
        rawSleepData,
        rawHeartRateIntraday,
      );

      const result = analyzeOscarFitbitIntegration(
        preparedOscar,
        preparedFitbit,
        {
          minNightsRequired: 3,
          enableAdvancedAnalysis: true,
        },
      );

      return {
        analysisData: shapeForDashboard(
          result,
          rawHeartRateData,
          rawHeartRateIntraday,
        ),
        hasAnalysis: result.success,
        analysisError: result.success ? null : result.error,
      };
    } catch (error) {
      console.error('Fitbit correlation analysis failed:', error);
      return {
        analysisData: shapeForDashboard(
          null,
          rawHeartRateData,
          rawHeartRateIntraday,
        ),
        hasAnalysis: false,
        analysisError: error.message,
      };
    }
  }, [oscarData, fitbitSyncedData]);
}
