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
