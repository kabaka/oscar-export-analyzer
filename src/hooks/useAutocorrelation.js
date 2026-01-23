import { useCallback, useId, useMemo, useState } from 'react';
import {
  DEFAULT_MAX_LAG,
  MAX_LAG_INPUT,
  MIN_LAG_INPUT,
  NORMAL_CONFIDENCE_Z,
} from '../constants';
import {
  computeAutocorrelation,
  computePartialAutocorrelation,
} from '../utils/stats';

/**
 * Computes autocorrelation (ACF) and partial autocorrelation (PACF) of a time-series.
 *
 * Allows users to interactively adjust the maximum lag via lagInputId input.
 * Returns ACF/PACF values, 95% confidence band, and change handler for the lag control.
 *
 * Autocorrelation measures how strongly values at different time lags relate to each other.
 * Partial autocorrelation isolates direct dependencies after accounting for intermediate lags.
 * Both use pairwise deletion to handle missing data robustly.
 *
 * @param {Array<number>} [values=[]] - Time-series data (e.g., nightly usage hours or AHI values).
 *   Non-finite values (NaN, Infinity) are filtered out. Minimum 2 values needed for meaningful ACF.
 * @param {Object} [options={}] - Configuration:
 *   - initialMaxLag (number): Starting max lag value, default from DEFAULT_MAX_LAG constant
 *   - minLag (number): Minimum allowed lag, default MIN_LAG_INPUT (clamped to 1)
 *   - maxLag (number): Maximum allowed lag, default MAX_LAG_INPUT (clamped to n/3)
 * @returns {Object} Autocorrelation analysis state:
 *   - maxLag (number): Current maximum lag setting
 *   - lagInputId (string): Unique ID for lag input element (from useId)
 *   - acfValues (Array<Object>): Autocorrelation at each lag { lag, autocorrelation }
 *   - pacfValues (Array<Object>): Partial autocorrelation at each lag { lag, partialAutocorrelation }
 *   - acfConfidence (number): 95% confidence band threshold (1.96/sqrt(n))
 *   - handleLagChange (Function): Change handler for number input: (event: ChangeEvent) => void
 *
 * @example
 * const usageHours = [4.2, 5.1, 6.0, 5.5, 4.8, ...];
 * const { maxLag, lagInputId, acfValues, acfConfidence, handleLagChange } = useAutocorrelation(
 *   usageHours,
 *   { initialMaxLag: 30 }
 * );
 * return (
 *   <>
 *     <input id={lagInputId} type="number" value={maxLag} onChange={handleLagChange} />
 *     <ACFChart values={acfValues} confidence={acfConfidence} />
 *   </>
 * );
 *
 * @see computeAutocorrelation - ACF calculation utility
 * @see computePartialAutocorrelation - PACF calculation utility
 */
export function useAutocorrelation(values = [], options = {}) {
  const {
    initialMaxLag = DEFAULT_MAX_LAG,
    minLag = MIN_LAG_INPUT,
    maxLag = MAX_LAG_INPUT,
  } = options;
  const [maxLagState, setMaxLag] = useState(initialMaxLag);
  const lagInputId = useId();

  const { acfValues, pacfValues, acfConfidence } = useMemo(() => {
    const finiteValues = values.filter((v) => Number.isFinite(v));
    const sampleSize = finiteValues.length;
    if (sampleSize <= 1) {
      return { acfValues: [], pacfValues: [], acfConfidence: NaN };
    }
    const requestedLag = Math.max(1, Math.round(maxLagState));
    const cappedLag = Math.min(
      requestedLag,
      sampleSize - 1,
      Math.max(1, values.length - 1),
    );
    const acf = computeAutocorrelation(values, cappedLag).values.filter(
      (d) => d.lag > 0,
    );
    const pacf = computePartialAutocorrelation(values, cappedLag).values;
    const conf =
      sampleSize > 0 ? NORMAL_CONFIDENCE_Z / Math.sqrt(sampleSize) : NaN;
    return { acfValues: acf, pacfValues: pacf, acfConfidence: conf };
  }, [values, maxLagState]);

  const handleLagChange = useCallback(
    (event) => {
      const raw = Number(event.target.value);
      if (!Number.isFinite(raw)) {
        return;
      }
      const rounded = Math.round(raw) || minLag;
      const clamped = Math.max(minLag, Math.min(rounded, maxLag));
      setMaxLag(clamped);
    },
    [maxLag, minLag],
  );

  return {
    maxLag: maxLagState,
    lagInputId,
    acfValues,
    pacfValues,
    acfConfidence,
    handleLagChange,
  };
}

export default useAutocorrelation;
