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
 * @returns {Array} Fitbit nightly records for the analysis pipeline
 */
export function transformHeartRateForPipeline(heartRateData) {
  if (!Array.isArray(heartRateData)) return [];

  return heartRateData
    .filter((day) => day.restingHeartRate != null)
    .map((day) => ({
      date: `${day.date}T12:00:00`,
      fitbit: {
        heartRate: {
          restingBpm: day.restingHeartRate,
        },
      },
    }));
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
 * Shapes raw analysis results into the format expected by FitbitDashboard.
 *
 * Dashboard expects:
 *   { correlationData, nightlyData, scatterData, summary, heartRateData }
 *
 * @param {Object|null} analysisResult - Output from analyzeOscarFitbitIntegration
 * @param {Array} rawHeartRateData - Original synced heart rate data (for fallback display)
 * @returns {Object} Dashboard-compatible fitbitData
 */
export function shapeForDashboard(analysisResult, rawHeartRateData) {
  if (!analysisResult || !analysisResult.success) {
    return {
      heartRateData: rawHeartRateData || [],
    };
  }

  const {
    correlations,
    alignedRecords,
    dataOverview,
    clinicalInsights,
    advancedAnalysis,
  } = analysisResult;

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
    avgHeartRate: record.fitbit?.heartRate?.restingBpm ?? null,
    ahi: record.oscar?.ahi ?? null,
    minSpO2: record.fitbit?.oxygenSaturation?.minPercent ?? null,
    oscar: record.oscar,
    fitbit: record.fitbit,
  }));

  // Build scatter data from correlation metrics
  const scatterData = buildScatterData(correlations?.metrics);

  return {
    correlationData: correlations,
    nightlyData,
    scatterData,
    summary: {
      totalNights: dataOverview?.analysisNights || alignedRecords?.length || 0,
      strongCorrelations,
      matchRate: dataOverview?.matchRate,
      dataQuality: dataOverview?.dataQuality,
    },
    heartRateData: rawHeartRateData || [],
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
 *   Expected shape: { heartRateData: [{ date, restingHeartRate, heartRateZones }] }
 * @returns {{ analysisData: Object, hasAnalysis: boolean, analysisError: string|null }}
 */
export function useFitbitAnalysis({ oscarData, fitbitSyncedData } = {}) {
  return useMemo(() => {
    const hasOscarData = Array.isArray(oscarData) && oscarData.length > 0;
    const rawHeartRateData = fitbitSyncedData?.heartRateData;
    const hasHeartRateData =
      Array.isArray(rawHeartRateData) && rawHeartRateData.length > 0;

    // When either source is missing, return raw HR data for basic display
    if (!hasOscarData || !hasHeartRateData) {
      return {
        analysisData: shapeForDashboard(null, rawHeartRateData),
        hasAnalysis: false,
        analysisError: null,
      };
    }

    try {
      const preparedOscar = prepareOscarData(oscarData);
      const preparedFitbit = transformHeartRateForPipeline(rawHeartRateData);

      const result = analyzeOscarFitbitIntegration(
        preparedOscar,
        preparedFitbit,
        {
          minNightsRequired: 3,
          enableAdvancedAnalysis: true,
        },
      );

      return {
        analysisData: shapeForDashboard(result, rawHeartRateData),
        hasAnalysis: result.success,
        analysisError: result.success ? null : result.error,
      };
    } catch (error) {
      console.error('Fitbit correlation analysis failed:', error);
      return {
        analysisData: shapeForDashboard(null, rawHeartRateData),
        hasAnalysis: false,
        analysisError: error.message,
      };
    }
  }, [oscarData, fitbitSyncedData]);
}
