import { useMemo } from 'react';
import {
  FREEDMAN_DIACONIS_EXPONENT,
  FREEDMAN_DIACONIS_FACTOR,
  HISTOGRAM_FALLBACK_BINS,
  QUARTILE_LOWER,
  QUARTILE_MEDIAN,
  QUARTILE_UPPER,
} from '../constants';
import { quantile } from '../utils/stats';

/**
 * Computes summary statistics for a numeric time-series (usage hours or AHI).
 *
 * Calculates percentiles (25th, median, 75th), mean, IQR, range, and optimal
 * histogram bin count using Freedman-Diaconis rule.
 *
 * @param {Array<number>} [values=[]] - Numeric values to analyze
 * @returns {Object} Summary statistics:
 *   - p25 (number): 25th percentile (Q1)
 *   - median (number): 50th percentile (Q2)
 *   - p75 (number): 75th percentile (Q3)
 *   - mean (number): Arithmetic mean
 *   - iqr (number): Interquartile range (p75 - p25)
 *   - nbins (number): Histogram bin count (Freedman-Diaconis rule)
 *   - range (number): Max - Min
 *
 * @example
 * const usageHours = [4.2, 5.1, 6.0, 5.5, 4.8, ...];
 * const { median, mean, nbins } = useUsageStats(usageHours);
 * return <UsageHistogram values={usageHours} median={median} mean={mean} nbins={nbins} />;
 *
 * @see quantile - Percentile calculation utility
 */
export function useUsageStats(values = []) {
  return useMemo(() => {
    if (!values.length) {
      return {
        p25: 0,
        median: 0,
        p75: 0,
        mean: 0,
        iqr: 0,
        nbins: HISTOGRAM_FALLBACK_BINS,
        range: 0,
      };
    }
    const p25 = quantile(values, QUARTILE_LOWER);
    const median = quantile(values, QUARTILE_MEDIAN);
    const p75 = quantile(values, QUARTILE_UPPER);
    const iqr = p75 - p25;
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const range = Math.max(...values) - Math.min(...values);
    const binWidth =
      FREEDMAN_DIACONIS_FACTOR *
      iqr *
      Math.pow(values.length, FREEDMAN_DIACONIS_EXPONENT);
    const nbins =
      binWidth > 0 ? Math.ceil(range / binWidth) : HISTOGRAM_FALLBACK_BINS;

    return { p25, median, p75, mean, iqr, nbins, range };
  }, [values]);
}

export default useUsageStats;
