import React from 'react';
import { ThemedPlot } from '../ui';
import {
  AUTOCORRELATION_CHART_HEIGHT,
  AUTOCORRELATION_CHART_MARGIN,
  AUTOCORRELATION_CONFIDENCE_LABEL,
} from '../../constants/charts';
import ChartWithHelp from './ChartWithHelp';

/**
 * Generic correlation chart component displaying autocorrelation or partial autocorrelation bars.
 *
 * Renders a bar chart of correlation values at different lags with confidence bands
 * highlighting statistically significant correlations (bars crossing the grey band).
 * Used as a base for both ACF and PACF visualizations.
 *
 * @param {Object} props - Component props
 * @param {Array<Object>} props.values - Correlation values with { lag, [yKey]: value } structure
 * @param {number} props.confidence - 95% confidence band threshold (typically 1.96/sqrt(n))
 * @param {string} props.title - Chart title
 * @param {string} props.name - Legend name for the bar series (e.g., 'ACF', 'PACF')
 * @param {string} props.color - Hex color for bars (e.g., '#1f77b4')
 * @param {string} props.yKey - Property name in values array to plot (e.g., 'autocorrelation', 'partialAutocorrelation')
 * @param {string} props.helpText - Help tooltip text explaining the chart
 * @returns {JSX.Element} A bar chart wrapped in ChartWithHelp container
 *
 * @example
 * <CorrelationChart
 *   values={acfValues}
 *   confidence={acfConfidence}
 *   title="Usage Autocorrelation"
 *   name="ACF"
 *   color="#ff7f0e"
 *   yKey="autocorrelation"
 *   helpText="Bars outside the band indicate significant lags."
 * />
 *
 * @see AutocorrelationChart - ACF-specific wrapper
 * @see PartialAutocorrelationChart - PACF-specific wrapper
 */
function CorrelationChart({
  values,
  confidence,
  title,
  name,
  color,
  yKey,
  helpText,
}) {
  return (
    <ChartWithHelp text={helpText}>
      <ThemedPlot
        data={[
          {
            x: values.map((d) => d.lag),
            y: values.map((d) => d[yKey]),
            type: 'bar',
            name,
            marker: { color },
          },
          {
            x: values.map((d) => d.lag),
            y: values.map(() => -confidence),
            type: 'scatter',
            mode: 'lines',
            name: AUTOCORRELATION_CONFIDENCE_LABEL,
            line: { color: 'rgba(150,150,150,0)' },
            hoverinfo: 'skip',
            showlegend: false,
          },
          {
            x: values.map((d) => d.lag),
            y: values.map(() => confidence),
            type: 'scatter',
            mode: 'lines',
            name: AUTOCORRELATION_CONFIDENCE_LABEL,
            line: {
              color: 'rgba(150,150,150,0.6)',
              width: 1,
            },
            fill: 'tonexty',
            hoverinfo: 'skip',
            showlegend: true,
          },
        ]}
        layout={{
          title,
          barmode: 'overlay',
          margin: { ...AUTOCORRELATION_CHART_MARGIN },
        }}
        useResizeHandler
        style={{
          width: '100%',
          height: `${AUTOCORRELATION_CHART_HEIGHT}px`,
        }}
      />
    </ChartWithHelp>
  );
}

export default CorrelationChart;
