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
  DAYS_PER_WEEK,
  DEFAULT_MAX_LAG,
  DEFAULT_ROLLING_WINDOWS,
  FREEDMAN_DIACONIS_FACTOR,
  FREEDMAN_DIACONIS_EXPONENT,
  HEADER_SCROLL_MARGIN_PX,
  HISTOGRAM_FALLBACK_BINS,
  MAX_LAG_INPUT,
  MIN_LAG_INPUT,
  NORMAL_CONFIDENCE_Z,
  PERCENT_SCALE,
  QUARTILE_LOWER,
  QUARTILE_MEDIAN,
  QUARTILE_UPPER,
  ROLLING_WINDOW_LONG_DAYS,
  ROLLING_WINDOW_SHORT_DAYS,
  SECONDS_PER_HOUR,
  STL_SEASON_LENGTH,
  USAGE_CHANGEPOINT_PENALTY,
  USAGE_COMPLIANCE_THRESHOLD_HOURS,
  USAGE_STRICT_THRESHOLD_HOURS,
} from '../constants';
import {
  AUTOCORRELATION_CHART_HEIGHT,
  AUTOCORRELATION_CHART_MARGIN,
  AUTOCORRELATION_CONFIDENCE_LABEL,
  CALENDAR_HEATMAP_HEIGHT,
  CHART_EXPORT_FORMAT,
  DEFAULT_CHART_HEIGHT,
  DEFAULT_PLOT_MARGIN,
  DECOMPOSITION_CHART_HEIGHT,
  HORIZONTAL_CENTER_LEGEND,
  LINE_WIDTH_BOLD,
  LINE_WIDTH_FINE,
  MEAN_ANNOTATION_OFFSET,
  MEDIAN_ANNOTATION_OFFSET,
  SUMMARY_DECIMAL_PLACES,
  MAX_CALENDAR_WEEKS,
} from '../constants/charts';

const KPI_GRID_COLUMN_COUNT = 4;
const KPI_CARD_MIN_WIDTH_PX = 120;
const KPI_GRID_GAP_PX = 12;
const KPI_GRID_MARGIN_BOTTOM_PX = HEADER_SCROLL_MARGIN_PX;
const KPI_GRID_TEMPLATE = `repeat(${KPI_GRID_COLUMN_COUNT}, minmax(${KPI_CARD_MIN_WIDTH_PX}px, 1fr))`;
const LAG_CONTROL_GAP_PX = HEADER_SCROLL_MARGIN_PX;
const LAG_CONTROL_MARGIN_TOP_PX = 12;
const LAG_CONTROL_MARGIN_BOTTOM_PX = 4;
const LAG_CONTROL_MARGIN = `${LAG_CONTROL_MARGIN_TOP_PX}px 0 ${LAG_CONTROL_MARGIN_BOTTOM_PX}px`;
const LAG_INPUT_WIDTH_PX = 80;
const LAG_INPUT_STEP = 1;
const HEATMAP_MARGIN_TOP_PX = 16;
const LAG_LABEL = 'Max lag (nights):';
const DOW_LABELS = Object.freeze([
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
  'Sun',
]);
const MONDAY_INDEX_OFFSET = 6;
const ISO_DATE_LENGTH = 10;
export const USAGE_HELP_TOOLTIP_MIN_COUNT = 7;
const PRIMARY_LINE_WIDTH = LINE_WIDTH_FINE;
const EMPHASIS_LINE_WIDTH = LINE_WIDTH_BOLD;
const HEATMAP_STOPS_PER_RANGE = 5;
const HEATMAP_STOP_INCREMENT = 1 / HEATMAP_STOPS_PER_RANGE;
const HEATMAP_STOP_SECOND = HEATMAP_STOP_INCREMENT;
const HEATMAP_STOP_THIRD = HEATMAP_STOP_SECOND + HEATMAP_STOP_INCREMENT;
const HEATMAP_STOP_FOURTH = HEATMAP_STOP_THIRD + HEATMAP_STOP_INCREMENT;
const HEATMAP_STOP_FIFTH = HEATMAP_STOP_FOURTH + HEATMAP_STOP_INCREMENT;
const DARK_MODE_HEATMAP_SCALE = Object.freeze([
  [0, '#121821'],
  [HEATMAP_STOP_SECOND, '#1b2b3b'],
  [HEATMAP_STOP_THIRD, '#23445a'],
  [HEATMAP_STOP_FOURTH, '#2b5c7a'],
  [HEATMAP_STOP_FIFTH, '#3c7db0'],
  [1, '#58a6ff'],
]);

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
        hours: parseDuration(r['Total Time']) / SECONDS_PER_HOUR,
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
      const day = (nd.getDay() + MONDAY_INDEX_OFFSET) % DAYS_PER_WEEK; // Mon=0..Sun=6
      nd.setDate(nd.getDate() - day);
      return toISODate(nd);
    };
    const dateToStr = (d) => d.toISOString().slice(0, ISO_DATE_LENGTH);
    const byDate = new Map();
    datesArr.forEach((d, i) => byDate.set(dateToStr(toISODate(d)), hours[i]));
    const start = datesArr.length ? getWeekStart(datesArr[0]) : null;
    const end = datesArr.length
      ? getWeekStart(datesArr[datesArr.length - 1])
      : null;
    const weekStarts = [];
    if (start && end && start <= end) {
      const maxWeeks = MAX_CALENDAR_WEEKS;
      let iter = 0;
      for (
        let w = new Date(start);
        w <= end && iter < maxWeeks;
        w.setDate(w.getDate() + DAYS_PER_WEEK), iter++
      ) {
        weekStarts.push(new Date(w));
      }
    }
    const z = weekStarts.length
      ? DOW_LABELS.map((_, dowIdx) =>
          weekStarts.map((ws) => {
            const d = new Date(ws);
            d.setDate(d.getDate() + dowIdx);
            const key = dateToStr(toISODate(d));
            return byDate.has(key) ? byDate.get(key) : null;
          }),
        )
      : DOW_LABELS.map(() => []);
    const dowHeatmap = { x: weekStarts, y: DOW_LABELS, z };
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
    FREEDMAN_DIACONIS_FACTOR *
    iqr *
    Math.pow(usageHours.length, FREEDMAN_DIACONIS_EXPONENT);
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
          gridTemplateColumns: KPI_GRID_TEMPLATE,
          gap: `${KPI_GRID_GAP_PX}px`,
          marginBottom: `${KPI_GRID_MARGIN_BOTTOM_PX}px`,
        }}
      >
        <div>
          <strong>% nights ≥ {USAGE_COMPLIANCE_THRESHOLD_HOURS}h:</strong>{' '}
          {(
            (usageHours.filter((h) => h >= USAGE_COMPLIANCE_THRESHOLD_HOURS)
              .length /
              usageHours.length) *
            PERCENT_SCALE
          ).toFixed(0)}
          %
        </div>
        <div>
          <strong>% nights ≥ {USAGE_STRICT_THRESHOLD_HOURS}h:</strong>{' '}
          {(
            (usageHours.filter((h) => h >= USAGE_STRICT_THRESHOLD_HOURS)
              .length /
              usageHours.length) *
            PERCENT_SCALE
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
              line: {
                dash: 'dash',
                width: EMPHASIS_LINE_WIDTH,
                color: COLORS.secondary,
              },
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
          onRelayout={handleRelayout}
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
            gap: `${LAG_CONTROL_GAP_PX}px`,
            margin: LAG_CONTROL_MARGIN,
          }}
        >
          <label htmlFor={lagInputId}>{LAG_LABEL}</label>
          <input
            id={lagInputId}
            type="number"
            min={MIN_LAG_INPUT}
            max={MAX_LAG_INPUT}
            step={LAG_INPUT_STEP}
            value={maxLag}
            onChange={handleLagChange}
            style={{ width: `${LAG_INPUT_WIDTH_PX}px` }}
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
                name: AUTOCORRELATION_CONFIDENCE_LABEL,
                line: { color: 'rgba(150,150,150,0)' },
                hoverinfo: 'skip',
                showlegend: false,
              },
              {
                x: acfValues.map((d) => d.lag),
                y: acfValues.map(() => acfConfidence),
                type: 'scatter',
                mode: 'lines',
                name: AUTOCORRELATION_CONFIDENCE_LABEL,
                line: {
                  color: 'rgba(150,150,150,0.6)',
                  width: PRIMARY_LINE_WIDTH,
                },
                fill: 'tonexty',
                hoverinfo: 'skip',
                showlegend: true,
              },
            ]}
            layout={{
              title: 'Usage Autocorrelation',
              barmode: 'overlay',
              margin: { ...AUTOCORRELATION_CHART_MARGIN },
            }}
            useResizeHandler
            style={{
              width: '100%',
              height: `${AUTOCORRELATION_CHART_HEIGHT}px`,
            }}
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
                name: AUTOCORRELATION_CONFIDENCE_LABEL,
                line: { color: 'rgba(150,150,150,0)' },
                hoverinfo: 'skip',
                showlegend: false,
              },
              {
                x: pacfValues.map((d) => d.lag),
                y: pacfValues.map(() => acfConfidence),
                type: 'scatter',
                mode: 'lines',
                name: AUTOCORRELATION_CONFIDENCE_LABEL,
                line: {
                  color: 'rgba(150,150,150,0.6)',
                  width: PRIMARY_LINE_WIDTH,
                },
                fill: 'tonexty',
                hoverinfo: 'skip',
                showlegend: true,
              },
            ]}
            layout={{
              title: 'Usage Partial Autocorrelation',
              barmode: 'overlay',
              margin: { ...AUTOCORRELATION_CHART_MARGIN },
            }}
            useResizeHandler
            style={{
              width: '100%',
              height: `${AUTOCORRELATION_CHART_HEIGHT}px`,
            }}
          />
          <VizHelp text="Partial autocorrelation pinpoints direct carryover from previous nights after accounting for intermediate lags. A sharp cutoff suggests a short memory for adherence habits." />
        </div>
      ) : null}

      {dates.length > 0 && (
        <div className="chart-with-help">
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
            onRelayout={handleRelayout}
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
          <VizHelp text="Trend/Seasonal/Residual view decomposes nightly usage. The trend panel smooths long-term adherence, the seasonal pane surfaces weekday habits, and residual spikes flag nights that buck the pattern." />
        </div>
      )}

      {/* Histogram and boxplot side-by-side on large screens, stacked on narrow */}
      <div className="usage-charts-grid">
        <div className="chart-item chart-with-help">
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
          <VizHelp text="Distribution of nightly usage hours. Dashed line marks the median; dotted line marks the mean." />
        </div>
        <div className="chart-item chart-with-help">
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
          <VizHelp text="Boxplot summarizing nightly usage; box shows the interquartile range (IQR), whiskers extend to typical range, points indicate outliers." />
        </div>
      </div>
      {/* Weekly calendar heatmap (Mon–Sun by columns of weeks) */}
      <div
        className="chart-item chart-with-help"
        style={{ marginTop: `${HEATMAP_MARGIN_TOP_PX}px` }}
      >
        <ThemedPlot
          useResizeHandler
          style={{
            width: '100%',
            height: `${CALENDAR_HEATMAP_HEIGHT}px`,
          }}
          data={[
            {
              z: dowHeatmap.z,
              x: dowHeatmap.x,
              y: dowHeatmap.y,
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
        <VizHelp text="Calendar heatmap of nightly usage by day of week; darker tiles indicate more hours of use." />
      </div>
    </div>
  );
}

export { UsagePatternsCharts };
export default React.memo(UsagePatternsCharts);
