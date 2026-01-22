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
