import React from 'react';
import { COLORS } from '../../utils/colors';
import CorrelationChart from './CorrelationChart';

/**
 * Autocorrelation chart component wrapper for usage data.
 *
 * Displays a bar chart of autocorrelation values with confidence band highlighting
 * statistically significant lags. This shows how strongly tonight's usage predicts
 * tomorrow's usage, next week's usage, etc.
 *
 * @param {Object} props - Component props
 * @param {Array<number>} props.values - Array of autocorrelation values at each lag
 * @param {number} props.confidence - 95% confidence band threshold (typically 1.96/sqrt(n))
 * @returns {JSX.Element} A CorrelationChart configured for ACF visualization
 *
 * @example
 * const { acfValues, acfConfidence } = useAutocorrelation(usageHours);
 * const acfData = acfValues.map(d => d.autocorrelation);
 * return <AutocorrelationChart values={acfData} confidence={acfConfidence} />;
 *
 * @see CorrelationChart - Generic correlation visualization wrapper
 * @see useAutocorrelation - Hook computing ACF values and confidence bands
 */
function AutocorrelationChart({ values, confidence }) {
  return (
    <CorrelationChart
      values={values}
      confidence={confidence}
      title="Usage Autocorrelation"
      name="ACF"
      color={COLORS.secondary}
      yKey="autocorrelation"
      helpText="Autocorrelation reveals whether short nights cluster together. Bars crossing the grey band indicate lags with stronger-than-random persistence."
    />
  );
}

export default AutocorrelationChart;
