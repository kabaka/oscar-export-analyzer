import React from 'react';
import { COLORS } from '../../utils/colors';
import CorrelationChart from './CorrelationChart';

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
