import React from 'react';
import { ThemedPlot } from '../ui';
import {
  DEFAULT_PLOT_MARGIN,
  GRADIENT_OPACITY_LOW,
  GRADIENT_OPACITY_MED_LOW,
  GRADIENT_OPACITY_MED_HIGH,
  GRADIENT_OPACITY_HIGH,
  GRADIENT_OPACITY_MAX,
  GRADIENT_OPACITY_MIN,
} from '../../constants';
import ChartWithHelp from './ChartWithHelp';

const DARK_MODE_HEATMAP_SCALE = Object.freeze([
  [GRADIENT_OPACITY_MIN, '#121821'],
  [GRADIENT_OPACITY_LOW, '#1b2b3b'],
  [GRADIENT_OPACITY_MED_LOW, '#23445a'],
  [GRADIENT_OPACITY_MED_HIGH, '#2b5c7a'],
  [GRADIENT_OPACITY_HIGH, '#3c7db0'],
  [GRADIENT_OPACITY_MAX, '#58a6ff'],
]);

function UsageCalendarHeatmap({ heatmap, isDark, height }) {
  if (!heatmap) return null;

  return (
    <ChartWithHelp text="Calendar heatmap of nightly usage by day of week; darker tiles indicate more hours of use.">
      <ThemedPlot
        useResizeHandler
        style={{
          width: '100%',
          height: `${height}px`,
        }}
        data={[
          {
            z: heatmap.z,
            x: heatmap.x,
            y: heatmap.y,
            type: 'heatmap',
            colorscale: isDark ? DARK_MODE_HEATMAP_SCALE : 'Blues',
            hovertemplate:
              '%{y} %{x|%Y-%m-%d}<br>Hours: %{z:.2f}<extra></extra>',
          },
        ]}
        layout={{
          title: 'Calendar Heatmap of Usage (hours)',
          xaxis: { title: 'Week', type: 'date', tickformat: '%Y-%m-%d' },
          yaxis: { title: 'Day of Week', autorange: 'reversed' },
          margin: { ...DEFAULT_PLOT_MARGIN },
        }}
        config={{ responsive: true, displaylogo: false }}
      />
    </ChartWithHelp>
  );
}

export default UsageCalendarHeatmap;
