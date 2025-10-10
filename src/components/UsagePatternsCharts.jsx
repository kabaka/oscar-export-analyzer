import React, { useMemo, useCallback, useState, useId } from 'react';
import {
  parseDuration,
  quantile,
  computeUsageRolling,
  computeAdherenceStreaks,
  detectUsageBreakpoints,
  detectChangePoints,
  stlDecompose,
  computeAutocorrelation,
  computePartialAutocorrelation,
} from '../utils/stats';
import { COLORS } from '../utils/colors';
import { useEffectiveDarkMode } from '../hooks/useEffectiveDarkMode';
import { ThemedPlot, VizHelp } from './ui';
import {
  DEFAULT_MAX_LAG,
  DEFAULT_ROLLING_WINDOWS,
  FREEDMAN_DIACONIS_FACTOR,
  HISTOGRAM_FALLBACK_BINS,
  MAX_LAG_INPUT,
  MIN_LAG_INPUT,
  NORMAL_CONFIDENCE_Z,
  QUARTILE_LOWER,
  QUARTILE_MEDIAN,
  QUARTILE_UPPER,
  ROLLING_WINDOW_LONG_DAYS,
  ROLLING_WINDOW_SHORT_DAYS,
  STL_SEASON_LENGTH,
  USAGE_CHANGEPOINT_PENALTY,
  USAGE_COMPLIANCE_THRESHOLD_HOURS,
  USAGE_STRICT_THRESHOLD_HOURS,
} from '../constants';

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
    const rolling = computeUsageRolling(
      datesArr,
      hours,
      DEFAULT_ROLLING_WINDOWS,
    );
    const rolling7 = rolling[`avg${ROLLING_WINDOW_SHORT_DAYS}`];
    const rolling30 = rolling[`avg${ROLLING_WINDOW_LONG_DAYS}`];
    const r7Low = rolling[`avg${ROLLING_WINDOW_SHORT_DAYS}_ci_low`];
    const r7High = rolling[`avg${ROLLING_WINDOW_SHORT_DAYS}_ci_high`];
    const r30Low = rolling[`avg${ROLLING_WINDOW_LONG_DAYS}_ci_low`];
    const r30High = rolling[`avg${ROLLING_WINDOW_LONG_DAYS}_ci_high`];
    const complianceKey = `compliance${USAGE_COMPLIANCE_THRESHOLD_HOURS}_${ROLLING_WINDOW_LONG_DAYS}`;
    const compliance4_30 = rolling[complianceKey];
    const breakDates = detectUsageBreakpoints(rolling7, rolling30, datesArr);
    const cpDates = detectChangePoints(
      hours,
      datesArr,
      USAGE_CHANGEPOINT_PENALTY,
    );

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
    const decomposition = stlDecompose(hours, {
      seasonLength: STL_SEASON_LENGTH,
    });

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
  const p25 = quantile(usageHours, QUARTILE_LOWER);
  const median = quantile(usageHours, QUARTILE_MEDIAN);
  const p75 = quantile(usageHours, QUARTILE_UPPER);
  const iqr = p75 - p25;
  const mean = usageHours.reduce((sum, v) => sum + v, 0) / usageHours.length;
  const binWidth =
    FREEDMAN_DIACONIS_FACTOR * iqr * Math.pow(usageHours.length, -1 / 3);
  const range = Math.max(...usageHours) - Math.min(...usageHours);
  const nbins =
    binWidth > 0 ? Math.ceil(range / binWidth) : HISTOGRAM_FALLBACK_BINS;

  const [maxLag, setMaxLag] = useState(DEFAULT_MAX_LAG);
  const lagInputId = useId();

  const { acfValues, pacfValues, acfConfidence } = useMemo(() => {
    const finiteUsage = usageHours.filter((v) => Number.isFinite(v));
    const sampleSize = finiteUsage.length;
    if (sampleSize <= 1) {
      return { acfValues: [], pacfValues: [], acfConfidence: NaN };
    }
    const requestedLag = Math.max(1, Math.round(maxLag));
    const cappedLag = Math.min(
      requestedLag,
      sampleSize - 1,
      Math.max(1, usageHours.length - 1),
    );
    const acf = computeAutocorrelation(usageHours, cappedLag).values.filter(
      (d) => d.lag > 0,
    );
    const pacf = computePartialAutocorrelation(usageHours, cappedLag).values;
    const conf =
      sampleSize > 0 ? NORMAL_CONFIDENCE_Z / Math.sqrt(sampleSize) : NaN;
    return { acfValues: acf, pacfValues: pacf, acfConfidence: conf };
  }, [usageHours, maxLag]);

  const handleLagChange = useCallback((event) => {
    const raw = Number(event.target.value);
    if (!Number.isFinite(raw)) {
      return;
    }
    const rounded = Math.round(raw) || MIN_LAG_INPUT;
    const clamped = Math.max(MIN_LAG_INPUT, Math.min(rounded, MAX_LAG_INPUT));
    setMaxLag(clamped);
  }, []);

  const isDark = useEffectiveDarkMode();
  const adherence = computeAdherenceStreaks(usageHours);
  const longestCompliance =
    adherence[`longest_${USAGE_COMPLIANCE_THRESHOLD_HOURS}`] ?? 0;
  const longestStrict =
    adherence[`longest_${USAGE_STRICT_THRESHOLD_HOURS}`] ?? 0;
  const shortWindowLabel = `${ROLLING_WINDOW_SHORT_DAYS}-night`;
  const longWindowLabel = `${ROLLING_WINDOW_LONG_DAYS}-night`;

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
          <strong>% nights ≥ {USAGE_COMPLIANCE_THRESHOLD_HOURS}h:</strong>{' '}
          {(
            (usageHours.filter((h) => h >= USAGE_COMPLIANCE_THRESHOLD_HOURS)
              .length /
              usageHours.length) *
            100
          ).toFixed(0)}
          %
        </div>
        <div>
          <strong>% nights ≥ {USAGE_STRICT_THRESHOLD_HOURS}h:</strong>{' '}
          {(
            (usageHours.filter((h) => h >= USAGE_STRICT_THRESHOLD_HOURS)
              .length /
              usageHours.length) *
            100
          ).toFixed(0)}
          %
        </div>
        <div>
          <strong>
            Current {ROLLING_WINDOW_LONG_DAYS}-night ≥
            {USAGE_COMPLIANCE_THRESHOLD_HOURS}h:
          </strong>{' '}
          {compliance4_30?.length
            ? compliance4_30[compliance4_30.length - 1].toFixed(0)
            : '—'}
          %
        </div>
        <div>
          <strong>
            Longest streak ≥{USAGE_COMPLIANCE_THRESHOLD_HOURS}h/≥
            {USAGE_STRICT_THRESHOLD_HOURS}h:
          </strong>{' '}
          {longestCompliance} / {longestStrict} nights
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
            // Short-window CI ribbon (low then high with fill)
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
              line: { dash: 'dash', width: 2, color: COLORS.secondary },
            },
            // Long-window CI ribbon
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
        <VizHelp
          text={`Nightly CPAP usage hours with ${shortWindowLabel} and ${longWindowLabel} rolling averages. Purple lines mark detected change-points; dotted lines mark crossover breakpoints.`}
        />
      </div>

      {usageHours.length > 1 ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: '8px',
            margin: '12px 0 4px',
          }}
        >
          <label htmlFor={lagInputId}>Max lag (nights):</label>
          <input
            id={lagInputId}
            type="number"
            min={MIN_LAG_INPUT}
            max={MAX_LAG_INPUT}
            step={1}
            value={maxLag}
            onChange={handleLagChange}
            style={{ width: '80px' }}
          />
        </div>
      ) : null}

      {acfValues.length ? (
        <div className="chart-with-help">
          <ThemedPlot
            data={[
              {
                x: acfValues.map((d) => d.lag),
                y: acfValues.map((d) => d.autocorrelation),
                type: 'bar',
                name: 'ACF',
                marker: { color: COLORS.secondary },
              },
              {
                x: acfValues.map((d) => d.lag),
                y: acfValues.map(() => -acfConfidence),
                type: 'scatter',
                mode: 'lines',
                name: '95% CI',
                line: { color: 'rgba(150,150,150,0)' },
                hoverinfo: 'skip',
                showlegend: false,
              },
              {
                x: acfValues.map((d) => d.lag),
                y: acfValues.map(() => acfConfidence),
                type: 'scatter',
                mode: 'lines',
                name: '95% CI',
                line: { color: 'rgba(150,150,150,0.6)', width: 1 },
                fill: 'tonexty',
                hoverinfo: 'skip',
                showlegend: true,
              },
            ]}
            layout={{
              title: 'Usage Autocorrelation',
              barmode: 'overlay',
              margin: { t: 40, r: 30, b: 40, l: 50 },
            }}
            useResizeHandler
            style={{ width: '100%', height: '260px' }}
          />
          <VizHelp text="Autocorrelation reveals whether short nights cluster together. Bars crossing the grey band indicate lags with stronger-than-random persistence." />
        </div>
      ) : null}

      {pacfValues.length ? (
        <div className="chart-with-help">
          <ThemedPlot
            data={[
              {
                x: pacfValues.map((d) => d.lag),
                y: pacfValues.map((d) => d.partialAutocorrelation),
                type: 'bar',
                name: 'PACF',
                marker: { color: COLORS.accent },
              },
              {
                x: pacfValues.map((d) => d.lag),
                y: pacfValues.map(() => -acfConfidence),
                type: 'scatter',
                mode: 'lines',
                name: '95% CI',
                line: { color: 'rgba(150,150,150,0)' },
                hoverinfo: 'skip',
                showlegend: false,
              },
              {
                x: pacfValues.map((d) => d.lag),
                y: pacfValues.map(() => acfConfidence),
                type: 'scatter',
                mode: 'lines',
                name: '95% CI',
                line: { color: 'rgba(150,150,150,0.6)', width: 1 },
                fill: 'tonexty',
                hoverinfo: 'skip',
                showlegend: true,
              },
            ]}
            layout={{
              title: 'Usage Partial Autocorrelation',
              barmode: 'overlay',
              margin: { t: 40, r: 30, b: 40, l: 50 },
            }}
            useResizeHandler
            style={{ width: '100%', height: '260px' }}
          />
          <VizHelp text="Partial autocorrelation pinpoints direct carryover from previous nights after accounting for intermediate lags. A sharp cutoff suggests a short memory for adherence habits." />
        </div>
      ) : null}

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
