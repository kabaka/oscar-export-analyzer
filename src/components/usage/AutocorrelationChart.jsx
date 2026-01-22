import React from 'react';
import { COLORS } from '../../utils/colors';
import CorrelationChart from './CorrelationChart';

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
