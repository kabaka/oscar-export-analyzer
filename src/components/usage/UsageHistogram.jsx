import React from 'react';
import { ThemedPlot } from '../ui';
import { COLORS } from '../../utils/colors';
import {
  CHART_EXPORT_FORMAT,
  DEFAULT_CHART_HEIGHT,
  DEFAULT_PLOT_MARGIN,
  HORIZONTAL_CENTER_LEGEND,
  MEAN_ANNOTATION_OFFSET,
  MEDIAN_ANNOTATION_OFFSET,
  SUMMARY_DECIMAL_PLACES,
} from '../../constants/charts';
import ChartWithHelp from './ChartWithHelp';

function UsageHistogram({ usageHours, median, mean, nbins }) {
  return (
    <ChartWithHelp text="Distribution of nightly usage hours. Dashed line marks the median; dotted line marks the mean.">
      <ThemedPlot
        useResizeHandler
        style={{
          width: '100%',
          height: `${DEFAULT_CHART_HEIGHT}px`,
        }}
        data={[
          {
            x: usageHours,
            type: 'histogram',
            nbinsx: nbins,
            name: 'Usage Distribution',
            marker: { color: COLORS.primary },
          },
        ]}
        layout={{
          title: 'Distribution of Nightly Usage',
          legend: { ...HORIZONTAL_CENTER_LEGEND },
          xaxis: { title: 'Hours' },
          yaxis: { title: 'Count' },
          shapes: [
            {
              type: 'line',
              x0: median,
              x1: median,
              yref: 'paper',
              y0: 0,
              y1: 1,
              line: { color: COLORS.secondary, dash: 'dash' },
            },
            {
              type: 'line',
              x0: mean,
              x1: mean,
              yref: 'paper',
              y0: 0,
              y1: 1,
              line: { color: COLORS.accent, dash: 'dot' },
            },
          ],
          annotations: [
            {
              x: median,
              yref: 'paper',
              y: MEDIAN_ANNOTATION_OFFSET,
              text: `Median: ${median.toFixed(SUMMARY_DECIMAL_PLACES)}`,
              showarrow: false,
              font: { color: COLORS.secondary },
            },
            {
              x: mean,
              yref: 'paper',
              y: MEAN_ANNOTATION_OFFSET,
              text: `Mean: ${mean.toFixed(SUMMARY_DECIMAL_PLACES)}`,
              showarrow: false,
              font: { color: COLORS.accent },
            },
          ],
          margin: { ...DEFAULT_PLOT_MARGIN },
        }}
        config={{
          responsive: true,
          displaylogo: false,
          modeBarButtonsToAdd: ['toImage'],
          toImageButtonOptions: {
            format: CHART_EXPORT_FORMAT,
            filename: 'usage_distribution',
          },
        }}
      />
    </ChartWithHelp>
  );
}

export default UsageHistogram;
