import { useMemo } from 'react';
import {
  computeUsageRolling,
  detectChangePoints,
  detectUsageBreakpoints,
  stlDecompose,
} from '../utils/stats';
import { timeSeriesHeatmap } from '../utils/timeSeries';

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
