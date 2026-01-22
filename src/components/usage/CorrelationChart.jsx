import React from 'react';
import { ThemedPlot } from '../ui';
import {
  AUTOCORRELATION_CHART_HEIGHT,
  AUTOCORRELATION_CHART_MARGIN,
  AUTOCORRELATION_CONFIDENCE_LABEL,
} from '../../constants/charts';
import ChartWithHelp from './ChartWithHelp';

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
