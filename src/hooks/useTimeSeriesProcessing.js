import { useMemo } from 'react';
import {
  computeUsageRolling,
  detectChangePoints,
  detectUsageBreakpoints,
  stlDecompose,
} from '../utils/stats';
import { timeSeriesHeatmap } from '../utils/timeSeries';

/**
 * Computes time-series decomposition, rolling statistics, and change-point detection.
 *
 * From input data, generates:
 * - Dates and values arrays (sorted chronologically)
 * - Rolling averages over specified windows with confidence intervals
 * - STL (Seasonal-Trend Decomposition using Loess) into trend, seasonal, residual
 * - Detected breakpoints (crossover points between short/long rolling windows)
 * - Detected change-points (abrupt shifts in level using PELT algorithm)
 * - Optional calendar heatmap for weekly patterns
 *
 * All computations are memoized and rerun only when inputs change.
 *
 * @param {Object} config - Hook configuration
 * @param {Array<Object>} [config.data=[]] - Raw session/event records
 * @param {Function} [config.mapPoint] - Function to extract date and value from each record.
 *   Called as mapPoint(record) => { date: Date, value: number }
 * @param {Array<number>} [config.rollingWindows] - Window sizes in days for rolling averages,
 *   e.g. [7, 30] generates avg7 and avg30 with corresponding _ci_low and _ci_high
 * @param {number} [config.changePointPenalty] - PELT algorithm penalty; higher = fewer change-points
 * @param {number} [config.breakpointMinDelta] - Minimum change needed to signal breakpoint
 * @param {number} [config.seasonLength] - Seasonal cycle length for STL (e.g., 7 for weekly)
 * @param {boolean} [config.includeHeatmap=false] - Whether to compute calendar heatmap
 * @param {Object} [config.heatmapOptions] - Options for heatmap: { labels, daysPerWeek, ... }
 * @returns {Object} Time-series analysis results:
 *   - dates (Array<Date>): Chronologically sorted session dates
 *   - values (Array<number>): Corresponding metric values
 *   - rolling (Object): Rolling averages { avg7, avg7_ci_low, avg7_ci_high, avg30, ... }
 *   - breakDates (Array<Date>): Crossover dates where short/long averages intersect
 *   - cpDates (Array<Date>): Detected change-point dates
 *   - decomposition (Object): STL results { trend, seasonal, residual }
 *   - heatmap (Object | null): Heatmap data { z, x, y } or null if includeHeatmap=false
 *
 * @example
 * const { dates, values, rolling, decomposition } = useTimeSeriesProcessing({
 *   data: summaryData,
 *   mapPoint: (r) => ({ date: new Date(r.Date), value: parseFloat(r.AHI) }),
 *   rollingWindows: [7, 30],
 *   changePointPenalty: 2.0,
 *   seasonLength: 7,
 * });
 * return <TimelineChart dates={dates} values={values} rolling7={rolling.avg7} />;
 *
 * @see computeUsageRolling - Rolling average computation
 * @see detectChangePoints - Change-point detection (PELT)
 * @see stlDecompose - STL decomposition
 * @see timeSeriesHeatmap - Calendar heatmap generation
 */
export function useTimeSeriesProcessing({
  data = [],
  mapPoint,
  rollingWindows,
  changePointPenalty,
  breakpointMinDelta,
  seasonLength,
  includeHeatmap = false,
  heatmapOptions,
}) {
  return useMemo(() => {
    const points = (data || [])
      .map((row) => (mapPoint ? mapPoint(row) : row))
      .filter((p) => p && p.date && !Number.isNaN(p.date) && p.value != null)
      .sort((a, b) => a.date - b.date);

    const dates = points.map((p) => p.date);
    const values = points.map((p) => p.value);

    const rolling = computeUsageRolling(dates, values, rollingWindows);
    const shortKey = rollingWindows?.[0];
    const longKey = rollingWindows?.[1];
    const shortSeries = shortKey ? rolling[`avg${shortKey}`] : null;
    const longSeries = longKey ? rolling[`avg${longKey}`] : null;
    const breakDates = shortSeries
      ? detectUsageBreakpoints(
          shortSeries,
          longSeries,
          dates,
          breakpointMinDelta,
        )
      : [];
    const cpDates = changePointPenalty
      ? detectChangePoints(values, dates, changePointPenalty)
      : [];
    const decomposition = stlDecompose(values, {
      seasonLength,
    });

    const heatmap = includeHeatmap
      ? timeSeriesHeatmap(dates, values, heatmapOptions)
      : null;

    return {
      dates,
      values,
      rolling,
      breakDates,
      cpDates,
      decomposition,
      heatmap,
    };
  }, [
    data,
    mapPoint,
    rollingWindows,
    changePointPenalty,
    breakpointMinDelta,
    seasonLength,
    includeHeatmap,
    heatmapOptions,
  ]);
}

export default useTimeSeriesProcessing;
