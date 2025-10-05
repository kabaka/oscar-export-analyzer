import React, { useMemo, useCallback } from 'react';
import {
  parseDuration,
  quantile,
  computeUsageRolling,
  computeAdherenceStreaks,
  detectUsageBreakpoints,
  detectChangePoints,
  stlDecompose,
} from '../utils/stats';
import { COLORS } from '../utils/colors';
import { useEffectiveDarkMode } from '../hooks/useEffectiveDarkMode';
import ThemedPlot from './ThemedPlot';
import VizHelp from './VizHelp';

const STL_SEASON = 7;

/**
 * Render usage and adherence charts for nightly data.
 *
 * @param {Object} props
 * @param {Array<Object>} props.data - Array of summary rows with 'Date' and 'Total Time'.
 * @param {(range: {start: Date, end: Date})=>void} [props.onRangeSelect] - Callback when a range is selected.
 * @returns {JSX.Element}
 */
function UsagePatternsCharts({ data, onRangeSelect }) {
  // Prepare sorted date and usage arrays
  const {
    dates,
    usageHours,
    rolling7,
    rolling30,
    r7Low,
    r7High,
    r30Low,
    r30High,
    compliance4_30,
    breakDates,
    cpDates,
    dowHeatmap,
    decomposition,
  } = useMemo(() => {
    const pts = data
      .map((r) => ({
        date: new Date(r['Date']),
        hours: parseDuration(r['Total Time']) / 3600,
      }))
      .sort((a, b) => a.date - b.date);
    const hours = pts.map((p) => p.hours);
    const datesArr = pts.map((p) => p.date);
    const rolling = computeUsageRolling(datesArr, hours, [7, 30]);
    const rolling7 = rolling.avg7;
    const rolling30 = rolling.avg30;
    const r7Low = rolling['avg7_ci_low'];
    const r7High = rolling['avg7_ci_high'];
    const r30Low = rolling['avg30_ci_low'];
    const r30High = rolling['avg30_ci_high'];
    const compliance4_30 = rolling['compliance4_30'];
    const breakDates = detectUsageBreakpoints(rolling7, rolling30, datesArr);
    const cpDates = detectChangePoints(hours, datesArr, 8);

    // Day-of-week weekly heatmap (GitHub-style)
    const toISODate = (d) =>
      new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const getWeekStart = (d) => {
      const nd = new Date(d);
      const day = (nd.getDay() + 6) % 7; // Mon=0..Sun=6
      nd.setDate(nd.getDate() - day);
      return toISODate(nd);
    };
    const dateToStr = (d) => d.toISOString().slice(0, 10);
    const byDate = new Map();
    datesArr.forEach((d, i) => byDate.set(dateToStr(toISODate(d)), hours[i]));
    const start = datesArr.length ? getWeekStart(datesArr[0]) : null;
    const end = datesArr.length
      ? getWeekStart(datesArr[datesArr.length - 1])
      : null;
    const weekStarts = [];
    if (start && end && start <= end) {
      const maxWeeks = 600; // ~11.5 years safety cap
      let iter = 0;
      for (
        let w = new Date(start);
        w <= end && iter < maxWeeks;
        w.setDate(w.getDate() + 7), iter++
      ) {
        weekStarts.push(new Date(w));
      }
    }
    const yLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const z = weekStarts.length
      ? yLabels.map((_, dowIdx) =>
          weekStarts.map((ws) => {
            const d = new Date(ws);
            d.setDate(d.getDate() + dowIdx);
            const key = dateToStr(toISODate(d));
            return byDate.has(key) ? byDate.get(key) : null;
          }),
        )
      : yLabels.map(() => []);
    const dowHeatmap = { x: weekStarts, y: yLabels, z };
    const decomposition = stlDecompose(hours, { seasonLength: STL_SEASON });

    return {
      dates: datesArr,
      usageHours: hours,
      rolling7,
      rolling30,
      r7Low,
      r7High,
      r30Low,
      r30High,
      compliance4_30,
      breakDates,
      cpDates,
      dowHeatmap,
      decomposition,
    };
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

  const handleRelayout = useCallback(
    (ev) => {
      const x0 = ev?.['xaxis.range[0]'];
      const x1 = ev?.['xaxis.range[1]'];
      if (x0 && x1 && onRangeSelect) {
        onRangeSelect({ start: new Date(x0), end: new Date(x1) });
      }
    },
    [onRangeSelect],
  );

  return (
    <div className="usage-charts">
      {/* Compliance KPIs */}
      <div
        className="kpi-row"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(120px, 1fr))',
          gap: '12px',
          marginBottom: '8px',
        }}
      >
        <div>
          <strong>% nights ≥ 4h:</strong>{' '}
          {(
            (usageHours.filter((h) => h >= 4).length / usageHours.length) *
            100
          ).toFixed(0)}
          %
        </div>
        <div>
          <strong>% nights ≥ 6h:</strong>{' '}
          {(
            (usageHours.filter((h) => h >= 6).length / usageHours.length) *
            100
          ).toFixed(0)}
          %
        </div>
        <div>
          <strong>Current 30-night ≥4h:</strong>{' '}
          {compliance4_30?.length
            ? compliance4_30[compliance4_30.length - 1].toFixed(0)
            : '—'}
          %
        </div>
        <div>
          <strong>Longest streak ≥4h/≥6h:</strong> {longest_4 || 0} /{' '}
          {longest_6 || 0} nights
        </div>
      </div>
      {/* Time-series usage with rolling average, full-width responsive */}
      <div className="chart-with-help">
        <ThemedPlot
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
            // 7-day CI ribbon (low then high with fill)
            {
              x: dates,
              y: r7Low,
              type: 'scatter',
              mode: 'lines',
              name: '7-night Avg CI low',
              line: { width: 0 },
              hoverinfo: 'skip',
              showlegend: false,
            },
            {
              x: dates,
              y: r7High,
              type: 'scatter',
              mode: 'lines',
              name: '7-night Avg CI',
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
              name: '7-night Avg',
              line: { dash: 'dash', width: 2, color: COLORS.secondary },
            },
            // 30-day CI ribbon
            {
              x: dates,
              y: r30Low,
              type: 'scatter',
              mode: 'lines',
              name: '30-night Avg CI low',
              line: { width: 0 },
              hoverinfo: 'skip',
              showlegend: false,
            },
            {
              x: dates,
              y: r30High,
              type: 'scatter',
              mode: 'lines',
              name: '30-night Avg CI',
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
              name: '30-night Avg',
              line: { dash: 'dot', width: 2, color: COLORS.accent },
            },
          ]}
          layout={{
            title: 'Nightly Usage Hours Over Time',
            legend: { orientation: 'h', x: 0.5, xanchor: 'center' },
            xaxis: { title: 'Date' },
            yaxis: { title: 'Hours of Use' },
            margin: { t: 40, l: 60, r: 20, b: 50 },
            shapes: [
              ...(breakDates?.map((d) => ({
                type: 'line',
                x0: d,
                x1: d,
                yref: 'paper',
                y0: 0,
                y1: 1,
                line: { color: '#aa3377', width: 1, dash: 'dot' },
              })) || []),
              ...(cpDates?.map((d) => ({
                type: 'line',
                x0: d,
                x1: d,
                yref: 'paper',
                y0: 0,
                y1: 1,
                line: { color: '#6a3d9a', width: 2 },
              })) || []),
            ],
          }}
          onRelayout={handleRelayout}
          config={{
            responsive: true,
            displaylogo: false,
            modeBarButtonsToAdd: ['toImage'],
            toImageButtonOptions: {
              format: 'svg',
              filename: 'usage_hours_over_time',
            },
          }}
        />
        <VizHelp text="Nightly CPAP usage hours with 7- and 30-night rolling averages. Purple lines mark detected change-points; dotted lines mark crossover breakpoints." />
      </div>

      {dates.length > 0 && (
        <div className="chart-with-help">
          <ThemedPlot
            useResizeHandler
            style={{ width: '100%', height: '360px' }}
            data={[
              {
                x: dates,
                y: decomposition.trend,
                type: 'scatter',
                mode: 'lines',
                name: 'Trend',
                line: { color: COLORS.secondary, width: 2 },
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
                line: { color: COLORS.accent, width: 1 },
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
                line: { color: COLORS.primary, width: 1 },
                hovertemplate:
                  'Date: %{x|%Y-%m-%d}<br>Residual: %{y:.2f} h<extra></extra>',
                showlegend: false,
              },
            ]}
            layout={{
              title: `Usage STL Decomposition (season=${STL_SEASON})`,
              grid: {
                rows: 3,
                columns: 1,
                pattern: 'independent',
                roworder: 'top to bottom',
              },
              hovermode: 'x unified',
              legend: { orientation: 'h', x: 0.5, xanchor: 'center' },
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
              margin: { t: 40, l: 60, r: 20, b: 50 },
            }}
            onRelayout={handleRelayout}
            config={{
              responsive: true,
              displaylogo: false,
              modeBarButtonsToAdd: ['toImage'],
              toImageButtonOptions: {
                format: 'svg',
                filename: 'usage_stl_decomposition',
              },
            }}
          />
          <VizHelp text="Trend/Seasonal/Residual view decomposes nightly usage. The trend panel smooths long-term adherence, the seasonal pane surfaces weekday habits, and residual spikes flag nights that buck the pattern." />
        </div>
      )}

      {/* Histogram and boxplot side-by-side on large screens, stacked on narrow */}
      <div className="usage-charts-grid">
        <div className="chart-item chart-with-help">
          <ThemedPlot
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
              title: 'Distribution of Nightly Usage',
              legend: { orientation: 'h', x: 0.5, xanchor: 'center' },
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
                  y: 1.05,
                  text: `Median: ${median.toFixed(2)}`,
                  showarrow: false,
                  font: { color: COLORS.secondary },
                },
                {
                  x: mean,
                  yref: 'paper',
                  y: 1.1,
                  text: `Mean: ${mean.toFixed(2)}`,
                  showarrow: false,
                  font: { color: COLORS.accent },
                },
              ],
              margin: { t: 40, l: 60, r: 20, b: 50 },
            }}
            config={{
              responsive: true,
              displaylogo: false,
              modeBarButtonsToAdd: ['toImage'],
              toImageButtonOptions: {
                format: 'svg',
                filename: 'usage_distribution',
              },
            }}
          />
          <VizHelp text="Distribution of nightly usage hours. Dashed line marks the median; dotted line marks the mean." />
        </div>
        <div className="chart-item chart-with-help">
          <ThemedPlot
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
              title: 'Boxplot of Nightly Usage',
              legend: { orientation: 'h', x: 0.5, xanchor: 'center' },
              yaxis: { title: 'Hours of Use', zeroline: false },
              margin: { t: 40, l: 60, r: 20, b: 50 },
            }}
            config={{
              responsive: true,
              displaylogo: false,
              modeBarButtonsToAdd: ['toImage'],
              toImageButtonOptions: {
                format: 'svg',
                filename: 'usage_boxplot',
              },
            }}
          />
          <VizHelp text="Boxplot summarizing nightly usage; box shows the interquartile range (IQR), whiskers extend to typical range, points indicate outliers." />
        </div>
      </div>
      {/* Weekly calendar heatmap (Mon–Sun by columns of weeks) */}
      <div className="chart-item chart-with-help" style={{ marginTop: '16px' }}>
        <ThemedPlot
          useResizeHandler
          style={{ width: '100%', height: '220px' }}
          data={[
            {
              z: dowHeatmap.z,
              x: dowHeatmap.x,
              y: dowHeatmap.y,
              type: 'heatmap',
              colorscale: isDark
                ? [
                    [0, '#121821'],
                    [0.2, '#1b2b3b'],
                    [0.4, '#23445a'],
                    [0.6, '#2b5c7a'],
                    [0.8, '#3c7db0'],
                    [1, '#58a6ff'],
                  ]
                : 'Blues',
              hovertemplate:
                '%{y} %{x|%Y-%m-%d}<br>Hours: %{z:.2f}<extra></extra>',
            },
          ]}
          layout={{
            title: 'Calendar Heatmap of Usage (hours)',
            xaxis: { title: 'Week', type: 'date', tickformat: '%Y-%m-%d' },
            yaxis: { title: 'Day of Week', autorange: 'reversed' },
            margin: { t: 40, l: 60, r: 20, b: 50 },
          }}
          config={{ responsive: true, displaylogo: false }}
        />
        <VizHelp text="Calendar heatmap of nightly usage by day of week; darker tiles indicate more hours of use." />
      </div>
    </div>
  );
}

export { UsagePatternsCharts };
export default React.memo(UsagePatternsCharts);
