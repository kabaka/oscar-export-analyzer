import React, { useMemo } from 'react';
import Plot from 'react-plotly.js';
import { parseDuration, quantile, computeUsageRolling, computeAdherenceStreaks, detectUsageBreakpoints } from '../utils/stats';
import { COLORS } from '../utils/colors';
import { useEffectiveDarkMode } from '../hooks/useEffectiveDarkMode';

export default function UsagePatternsCharts({ data, width = 700, height = 300 }) {
  // Prepare sorted date and usage arrays
  const { dates, usageHours, rolling7, rolling30, compliance4_30, breakDates, dowHeatmap } = useMemo(() => {
    const pts = data
      .map(r => ({ date: new Date(r['Date']), hours: parseDuration(r['Total Time']) / 3600 }))
      .sort((a, b) => a.date - b.date);
    const hours = pts.map(p => p.hours);
    const datesArr = pts.map(p => p.date);
    const rolling = computeUsageRolling(datesArr, hours, [7, 30]);
    const rolling7 = rolling.avg7;
    const rolling30 = rolling.avg30;
    const compliance4_30 = rolling['compliance4_30'];
    const breakDates = detectUsageBreakpoints(rolling7, rolling30, datesArr);

    // Day-of-week weekly heatmap (GitHub-style)
    const toISODate = d => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const getWeekStart = d => {
      const nd = new Date(d);
      const day = (nd.getDay() + 6) % 7; // Mon=0..Sun=6
      nd.setDate(nd.getDate() - day);
      return toISODate(nd);
    };
    const dateToStr = d => d.toISOString().slice(0, 10);
    const byDate = new Map();
    datesArr.forEach((d, i) => byDate.set(dateToStr(toISODate(d)), hours[i]));
    const start = datesArr.length ? getWeekStart(datesArr[0]) : null;
    const end = datesArr.length ? getWeekStart(datesArr[datesArr.length - 1]) : null;
    const weekStarts = [];
    if (start && end && start <= end) {
      const maxWeeks = 600; // ~11.5 years safety cap
      let iter = 0;
      for (let w = new Date(start); w <= end && iter < maxWeeks; w.setDate(w.getDate() + 7), iter++) {
        weekStarts.push(new Date(w));
      }
    }
    const yLabels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const z = weekStarts.length
      ? yLabels.map((_, dowIdx) =>
          weekStarts.map(ws => {
            const d = new Date(ws);
            d.setDate(d.getDate() + dowIdx);
            const key = dateToStr(toISODate(d));
            return byDate.has(key) ? byDate.get(key) : null;
          })
        )
      : yLabels.map(() => []);
    const dowHeatmap = { x: weekStarts, y: yLabels, z };

    return { dates: datesArr, usageHours: hours, rolling7, rolling30, compliance4_30, breakDates, dowHeatmap };
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

  const isDark = useEffectiveDarkMode();
  const { longest_4, longest_6 } = computeAdherenceStreaks(usageHours, [4, 6]);

  return (
    <div className="usage-charts">
      {/* Compliance KPIs */}
      <div className="kpi-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(120px, 1fr))', gap: '12px', marginBottom: '8px' }}>
        <div><strong>% nights ≥ 4h:</strong> {((usageHours.filter(h => h >= 4).length / usageHours.length) * 100).toFixed(0)}%</div>
        <div><strong>% nights ≥ 6h:</strong> {((usageHours.filter(h => h >= 6).length / usageHours.length) * 100).toFixed(0)}%</div>
        <div><strong>Current 30-night ≥4h:</strong> {compliance4_30?.length ? compliance4_30[compliance4_30.length - 1].toFixed(0) : '—'}%</div>
        <div><strong>Longest streak ≥4h/≥6h:</strong> {longest_4 || 0} / {longest_6 || 0} nights</div>
      </div>
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
            y: rolling7,
            type: 'scatter',
            mode: 'lines',
            name: '7-night Avg',
            line: { dash: 'dash', width: 2, color: COLORS.secondary },
          },
          {
            x: dates,
            y: rolling30,
            type: 'scatter',
            mode: 'lines',
            name: '30-night Avg',
            line: { dash: 'dot', width: 2, color: COLORS.accent },
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
          shapes: breakDates?.map(d => ({ type: 'line', x0: d, x1: d, yref: 'paper', y0: 0, y1: 1, line: { color: '#aa3377', width: 1, dash: 'dot' } })) || [],
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
      {/* Weekly calendar heatmap (Mon–Sun by columns of weeks) */}
      <div className="chart-item" style={{ marginTop: '16px' }}>
        <Plot
          useResizeHandler
          style={{ width: '100%', height: '220px' }}
          data={[
            {
              z: dowHeatmap.z,
              x: dowHeatmap.x,
              y: dowHeatmap.y,
              type: 'heatmap',
              colorscale: 'Blues',
              hovertemplate: '%{y} %{x|%Y-%m-%d}<br>Hours: %{z:.2f}<extra></extra>',
            },
          ]}
          layout={{
            template: isDark ? 'plotly_dark' : 'plotly',
            autosize: true,
            title: 'Calendar Heatmap of Usage (hours)',
            xaxis: { title: 'Week', type: 'date', tickformat: '%Y-%m-%d' },
            yaxis: { title: '', autorange: 'reversed' },
            margin: { t: 40, l: 60, r: 20, b: 50 },
          }}
          config={{ responsive: true, displaylogo: false }}
        />
      </div>
    </div>
  );
}
