import React from 'react';
import { ThemedPlot } from '../ui';
import { COLORS } from '../../utils/colors';
import {
  CHART_EXPORT_FORMAT,
  DEFAULT_PLOT_MARGIN,
  DECOMPOSITION_CHART_HEIGHT,
  HORIZONTAL_CENTER_LEGEND,
  LINE_WIDTH_BOLD,
  LINE_WIDTH_FINE,
} from '../../constants/charts';
import { STL_SEASON_LENGTH } from '../../constants';
import ChartWithHelp from './ChartWithHelp';

const PRIMARY_LINE_WIDTH = LINE_WIDTH_FINE;
const EMPHASIS_LINE_WIDTH = LINE_WIDTH_BOLD;

function UsageDecompositionChart({ dates, decomposition, onRelayout }) {
  return (
    <ChartWithHelp text="Trend/Seasonal/Residual view decomposes nightly usage. The trend panel smooths long-term adherence, the seasonal pane surfaces weekday habits, and residual spikes flag nights that buck the pattern.">
      <ThemedPlot
        useResizeHandler
        style={{
          width: '100%',
          height: `${DECOMPOSITION_CHART_HEIGHT}px`,
        }}
        data={[
          {
            x: dates,
            y: decomposition.trend,
            type: 'scatter',
            mode: 'lines',
            name: 'Trend',
            line: { color: COLORS.secondary, width: EMPHASIS_LINE_WIDTH },
            hovertemplate:
              'Date: %{x|%Y-%m-%d}<br>Trend: %{y:.2f} h<extra></extra>',
          },
          {
            x: dates,
            y: decomposition.seasonal,
            type: 'scatter',
            mode: 'lines',
            name: 'Seasonal',
            xaxis: 'x2',
            yaxis: 'y2',
            line: { color: COLORS.accent, width: PRIMARY_LINE_WIDTH },
            hovertemplate:
              'Date: %{x|%Y-%m-%d}<br>Seasonal: %{y:.2f} h<extra></extra>',
            showlegend: false,
          },
          {
            x: dates,
            y: decomposition.residual,
            type: 'scatter',
            mode: 'lines',
            name: 'Residual',
            xaxis: 'x3',
            yaxis: 'y3',
            line: { color: COLORS.primary, width: PRIMARY_LINE_WIDTH },
            hovertemplate:
              'Date: %{x|%Y-%m-%d}<br>Residual: %{y:.2f} h<extra></extra>',
            showlegend: false,
          },
        ]}
        layout={{
          title: `Usage STL Decomposition (season=${STL_SEASON_LENGTH})`,
          grid: {
            rows: 3,
            columns: 1,
            pattern: 'independent',
            roworder: 'top to bottom',
          },
          hovermode: 'x unified',
          legend: { ...HORIZONTAL_CENTER_LEGEND },
          xaxis: { title: 'Date', showspikes: true },
          xaxis2: { matches: 'x', anchor: 'y2', showspikes: true },
          xaxis3: {
            matches: 'x',
            anchor: 'y3',
            title: 'Date',
            showspikes: true,
          },
          yaxis: { title: 'Trend (hrs)', zeroline: false },
          yaxis2: { title: 'Seasonal (hrs)', zeroline: false },
          yaxis3: { title: 'Residual (hrs)', zeroline: false },
          margin: { ...DEFAULT_PLOT_MARGIN },
        }}
        onRelayout={onRelayout}
        config={{
          responsive: true,
          displaylogo: false,
          modeBarButtonsToAdd: ['toImage'],
          toImageButtonOptions: {
            format: CHART_EXPORT_FORMAT,
            filename: 'usage_stl_decomposition',
          },
        }}
      />
    </ChartWithHelp>
  );
}

export default UsageDecompositionChart;
