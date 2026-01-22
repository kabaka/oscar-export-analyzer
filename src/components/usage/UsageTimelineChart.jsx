import React from 'react';
import { ThemedPlot } from '../ui';
import { COLORS } from '../../utils/colors';
import {
  CHART_EXPORT_FORMAT,
  DEFAULT_CHART_HEIGHT,
  DEFAULT_PLOT_MARGIN,
  HORIZONTAL_CENTER_LEGEND,
  LINE_WIDTH_BOLD,
  LINE_WIDTH_FINE,
} from '../../constants/charts';
import ChartWithHelp from './ChartWithHelp';

const PRIMARY_LINE_WIDTH = LINE_WIDTH_FINE;
const EMPHASIS_LINE_WIDTH = LINE_WIDTH_BOLD;

function UsageTimelineChart({
  dates,
  usageHours,
  r7Low,
  r7High,
  r30Low,
  r30High,
  rolling7,
  rolling30,
  shortWindowLabel,
  longWindowLabel,
  breakDates,
  cpDates,
  onRelayout,
}) {
  return (
    <ChartWithHelp
      text={`Nightly CPAP usage hours with ${shortWindowLabel} and ${longWindowLabel} rolling averages. Purple lines mark detected change-points; dotted lines mark crossover breakpoints.`}
    >
      <ThemedPlot
        useResizeHandler
        style={{ width: '100%', height: `${DEFAULT_CHART_HEIGHT}px` }}
        data={[
          {
            x: dates,
            y: usageHours,
            type: 'scatter',
            mode: 'lines',
            name: 'Usage (hrs)',
            line: { width: PRIMARY_LINE_WIDTH, color: COLORS.primary },
          },
          {
            x: dates,
            y: r7Low,
            type: 'scatter',
            mode: 'lines',
            name: `${shortWindowLabel} Avg CI low`,
            line: { width: 0 },
            hoverinfo: 'skip',
            showlegend: false,
          },
          {
            x: dates,
            y: r7High,
            type: 'scatter',
            mode: 'lines',
            name: `${shortWindowLabel} Avg CI`,
            fill: 'tonexty',
            fillcolor: 'rgba(255,127,14,0.15)',
            line: { width: 0 },
            hoverinfo: 'skip',
            showlegend: true,
          },
          {
            x: dates,
            y: rolling7,
            type: 'scatter',
            mode: 'lines',
            name: `${shortWindowLabel} Avg`,
            line: {
              dash: 'dash',
              width: EMPHASIS_LINE_WIDTH,
              color: COLORS.secondary,
            },
          },
          {
            x: dates,
            y: r30Low,
            type: 'scatter',
            mode: 'lines',
            name: `${longWindowLabel} Avg CI low`,
            line: { width: 0 },
            hoverinfo: 'skip',
            showlegend: false,
          },
          {
            x: dates,
            y: r30High,
            type: 'scatter',
            mode: 'lines',
            name: `${longWindowLabel} Avg CI`,
            fill: 'tonexty',
            fillcolor: 'rgba(44,160,44,0.15)',
            line: { width: 0 },
            hoverinfo: 'skip',
            showlegend: true,
          },
          {
            x: dates,
            y: rolling30,
            type: 'scatter',
            mode: 'lines',
            name: `${longWindowLabel} Avg`,
            line: {
              dash: 'dot',
              width: EMPHASIS_LINE_WIDTH,
              color: COLORS.accent,
            },
          },
        ]}
        layout={{
          title: 'Nightly Usage Hours Over Time',
          legend: { ...HORIZONTAL_CENTER_LEGEND },
          xaxis: { title: 'Date' },
          yaxis: { title: 'Hours of Use' },
          margin: { ...DEFAULT_PLOT_MARGIN },
          shapes: [
            ...(breakDates?.map((d) => ({
              type: 'line',
              x0: d,
              x1: d,
              yref: 'paper',
              y0: 0,
              y1: 1,
              line: {
                color: '#aa3377',
                width: PRIMARY_LINE_WIDTH,
                dash: 'dot',
              },
            })) || []),
            ...(cpDates?.map((d) => ({
              type: 'line',
              x0: d,
              x1: d,
              yref: 'paper',
              y0: 0,
              y1: 1,
              line: { color: '#6a3d9a', width: EMPHASIS_LINE_WIDTH },
            })) || []),
          ],
        }}
        onRelayout={onRelayout}
        config={{
          responsive: true,
          displaylogo: false,
          modeBarButtonsToAdd: ['toImage'],
          toImageButtonOptions: {
            format: CHART_EXPORT_FORMAT,
            filename: 'usage_hours_over_time',
          },
        }}
      />
    </ChartWithHelp>
  );
}

export default UsageTimelineChart;
