import React from 'react';
import { ThemedPlot } from '../ui';
import { COLORS } from '../../utils/colors';
import {
  CHART_EXPORT_FORMAT,
  DEFAULT_CHART_HEIGHT,
  DEFAULT_PLOT_MARGIN,
  HORIZONTAL_CENTER_LEGEND,
} from '../../constants/charts';
import ChartWithHelp from './ChartWithHelp';

function UsageBoxplot({ usageHours }) {
  return (
    <ChartWithHelp text="Boxplot summarizing nightly usage; box shows the interquartile range (IQR), whiskers extend to typical range, points indicate outliers.">
      <ThemedPlot
        useResizeHandler
        style={{
          width: '100%',
          height: `${DEFAULT_CHART_HEIGHT}px`,
        }}
        data={[
          {
            y: usageHours,
            type: 'box',
            name: 'Usage Boxplot',
            boxpoints: 'outliers',
            marker: { color: COLORS.box },
          },
        ]}
        layout={{
          title: 'Boxplot of Nightly Usage',
          legend: { ...HORIZONTAL_CENTER_LEGEND },
          yaxis: { title: 'Hours of Use', zeroline: false },
          margin: { ...DEFAULT_PLOT_MARGIN },
        }}
        config={{
          responsive: true,
          displaylogo: false,
          modeBarButtonsToAdd: ['toImage'],
          toImageButtonOptions: {
            format: CHART_EXPORT_FORMAT,
            filename: 'usage_boxplot',
          },
        }}
      />
    </ChartWithHelp>
  );
}

export default UsageBoxplot;
