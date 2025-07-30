import React, { useMemo } from 'react';
import Plot from 'react-plotly.js';
import { parseDuration, quantile } from '../utils/stats';
import { COLORS } from '../utils/colors';
import { usePrefersDarkMode } from '../hooks/usePrefersDarkMode';

export default function UsagePatternsCharts({ data, width = 700, height = 300 }) {
  // Prepare sorted date and usage arrays
  const { dates, usageHours, rollingAvg } = useMemo(() => {
    const pts = data
      .map(r => ({ date: new Date(r['Date']), hours: parseDuration(r['Total Time']) / 3600 }))
      .sort((a, b) => a.date - b.date);
    const hours = pts.map(p => p.hours);
    const datesArr = pts.map(p => p.date);
    const window = 7;
    const rolling = pts.map((p, i) => {
      const slice = hours.slice(Math.max(0, i - window + 1), i + 1);
      const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
      return avg;
    });
    return { dates: datesArr, usageHours: hours, rollingAvg: rolling };
  }, [data]);

  // Summary stats and adaptive bins for histogram
  const p25 = quantile(usageHours, 0.25);
  const median = quantile(usageHours, 0.5);
  const p75 = quantile(usageHours, 0.75);
  const iqr = p75 - p25;
  const mean = usageHours.reduce((sum, v) => sum + v, 0) / usageHours.length;
  const binWidth = 2 * iqr * Math.pow(usageHours.length, -1 / 3);
  const range = Math.max(...usageHours) - Math.min(...usageHours);
  const nbins = binWidth > 0 ? Math.ceil(range / binWidth) : 12;

  const isDark = usePrefersDarkMode();

  return (
    <div className="usage-charts">
      {/* Time-series usage with rolling average, full-width responsive */}
      <Plot
        useResizeHandler
        style={{ width: '100%', height: '300px' }}
        data={[
          {
            x: dates,
            y: usageHours,
            type: 'scatter',
            mode: 'lines',
            name: 'Usage (hrs)',
            line: { width: 1, color: COLORS.primary },
          },
          {
            x: dates,
            y: rollingAvg,
            type: 'scatter',
            mode: 'lines',
            name: '7-night Avg',
            line: { dash: 'dash', width: 2, color: COLORS.secondary },
          },
        ]}
        layout={{
          template: isDark ? 'plotly_dark' : 'plotly',
          autosize: true,
          title: 'Nightly Usage Hours Over Time',
          legend: { orientation: 'h', x: 0.5, xanchor: 'center' },
          xaxis: { title: 'Date' },
          yaxis: { title: 'Hours of Use' },
          margin: { t: 40, l: 60, r: 20, b: 50 },
        }}
        config={{
          responsive: true,
          displaylogo: false,
          modeBarButtonsToAdd: ['toImage'],
          toImageButtonOptions: { format: 'svg', filename: 'usage_hours_over_time' },
        }}
      />

      {/* Histogram and boxplot side-by-side on large screens, stacked on narrow */}
      <div className="usage-charts-grid">
        <div className="chart-item">
        <Plot
          useResizeHandler
          style={{ width: '100%', height: '300px' }}
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
            template: isDark ? 'plotly_dark' : 'plotly',
            autosize: true,
            title: 'Distribution of Nightly Usage',
            legend: { orientation: 'h', x: 0.5, xanchor: 'center' },
            xaxis: { title: 'Hours' },
            yaxis: { title: 'Count' },
            shapes: [
              { type: 'line', x0: median, x1: median, yref: 'paper', y0: 0, y1: 1, line: { color: COLORS.secondary, dash: 'dash' } },
              { type: 'line', x0: mean, x1: mean, yref: 'paper', y0: 0, y1: 1, line: { color: COLORS.accent, dash: 'dot' } },
            ],
            annotations: [
              { x: median, yref: 'paper', y: 1.05, text: `Median: ${median.toFixed(2)}`, showarrow: false, font: { color: COLORS.secondary } },
              { x: mean, yref: 'paper', y: 1.1, text: `Mean: ${mean.toFixed(2)}`, showarrow: false, font: { color: COLORS.accent } },
            ],
            margin: { t: 40, l: 60, r: 20, b: 50 },
          }}
          config={{
            responsive: true,
            displaylogo: false,
            modeBarButtonsToAdd: ['toImage'],
            toImageButtonOptions: { format: 'svg', filename: 'usage_distribution' },
          }}
        />
        </div>
        <div className="chart-item">
          <Plot
            useResizeHandler
            style={{ width: '100%', height: '300px' }}
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
              template: isDark ? 'plotly_dark' : 'plotly',
              autosize: true,
              title: 'Boxplot of Nightly Usage',
              legend: { orientation: 'h', x: 0.5, xanchor: 'center' },
              yaxis: { title: 'Hours of Use', zeroline: false },
              margin: { t: 40, l: 60, r: 20, b: 50 },
            }}
            config={{
              responsive: true,
              displaylogo: false,
              modeBarButtonsToAdd: ['toImage'],
              toImageButtonOptions: { format: 'svg', filename: 'usage_boxplot' },
            }}
          />
        </div>
      </div>
    </div>
  );
}
