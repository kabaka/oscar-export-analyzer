import React from 'react';
import { COLORS } from '../../utils/colors';
import CorrelationChart from './CorrelationChart';

/**
 * Partial autocorrelation chart component wrapper for usage data.
 *
 * Displays a bar chart of partial autocorrelation (PACF) values with confidence band.
 * PACF isolates the direct effect of each lag, removing the influence of intermediate lags.
 * Useful for identifying the order of autoregressive models and understanding adherence memory.
 *
 * @param {Object} props - Component props
 * @param {Array<Object>} props.values - Array of PACF values with { lag, partialAutocorrelation } structure
 * @param {number} props.confidence - 95% confidence band threshold (typically 1.96/sqrt(n))
 * @returns {JSX.Element} A CorrelationChart configured for PACF visualization
 *
 * @example
 * const { pacfValues, acfConfidence } = useAutocorrelation(usageHours);
 * return <PartialAutocorrelationChart values={pacfValues} confidence={acfConfidence} />;
 *
 * @see CorrelationChart - Generic correlation visualization wrapper
 * @see useAutocorrelation - Hook computing PACF values and confidence bands
 */
function PartialAutocorrelationChart({ values, confidence }) {
  return (
    <CorrelationChart
      values={values}
      confidence={confidence}
      title="Usage Partial Autocorrelation"
      name="PACF"
      color={COLORS.accent}
      yKey="partialAutocorrelation"
      helpText="Partial autocorrelation pinpoints direct carryover from previous nights after accounting for intermediate lags. A sharp cutoff suggests a short memory for adherence habits."
    />
  );
}

export default PartialAutocorrelationChart;
