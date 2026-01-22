import React, { useMemo, useCallback } from 'react';
import { normalQuantile } from '../utils/stats';
import { useTimeSeriesProcessing } from '../hooks/useTimeSeriesProcessing';
import { useUsageStats } from '../hooks/useUsageStats';
import { useAutocorrelation } from '../hooks/useAutocorrelation';
import {
  LAG_CONTROL_GAP_PX,
  LAG_CONTROL_MARGIN_BOTTOM_PX,
  LAG_CONTROL_MARGIN_TOP_PX,
  LAG_INPUT_MAX,
  LAG_INPUT_MIN,
} from './usage/lagConstants';
import { COLORS } from '../utils/colors';
import { ThemedPlot, VizHelp } from './ui';
import {
  AHI_BREAKPOINT_MIN_DELTA,
  AHI_CHANGEPOINT_PENALTY,
  AHI_SEVERITY_LIMITS,
  CLUSTER_COUNT_ALERT,
  CLUSTER_DURATION_ALERT_SEC,
  DEFAULT_MAX_LAG,
  DEFAULT_ROLLING_WINDOWS,
  HIGH_CENTRAL_APNEA_FRACTION,
  IQR_OUTLIER_MULTIPLIER,
  PERCENT_SCALE,
  ROLLING_WINDOW_LONG_DAYS,
  ROLLING_WINDOW_SHORT_DAYS,
  STL_SEASON_LENGTH,
} from '../constants';
import {
  AUTOCORRELATION_CHART_HEIGHT,
  AUTOCORRELATION_CHART_MARGIN,
  AUTOCORRELATION_CONFIDENCE_LABEL,
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
} from '../constants/charts';

const LAG_CONTROL_MARGIN = `${LAG_CONTROL_MARGIN_TOP_PX}px 0 ${LAG_CONTROL_MARGIN_BOTTOM_PX}px`;
const LAG_INPUT_WIDTH_PX = 80;
const LAG_INPUT_STEP = 1;
const LAG_LABEL = 'Max lag (nights):';
const BAD_NIGHT_LIMIT = 10;
const MEDIAN_ANNOTATION_Y = MEDIAN_ANNOTATION_OFFSET;
const MEAN_ANNOTATION_Y = MEAN_ANNOTATION_OFFSET;
const ISO_DATE_LENGTH = 10;
const SQUARE_EXPONENT = 2;
const PRIMARY_LINE_WIDTH = LINE_WIDTH_FINE;
const EMPHASIS_LINE_WIDTH = LINE_WIDTH_BOLD;

export default function AhiTrendsCharts({
  data,
  clusters = [],
  onRangeSelect,
}) {
  const {
    dates,
    values: ahis,
    rolling,
    breakDates,
    cpDates,
    decomposition,
  } = useTimeSeriesProcessing({
    data,
    mapPoint: (r) => ({
      date: new Date(r['Date']),
      value: parseFloat(r['AHI']),
    }),
    rollingWindows: DEFAULT_ROLLING_WINDOWS,
    changePointPenalty: AHI_CHANGEPOINT_PENALTY,
    breakpointMinDelta: AHI_BREAKPOINT_MIN_DELTA,
    seasonLength: STL_SEASON_LENGTH,
  });

  const rolling7 = rolling[`avg${ROLLING_WINDOW_SHORT_DAYS}`] || [];
  const rolling30 = rolling[`avg${ROLLING_WINDOW_LONG_DAYS}`] || [];
  const r7Low = rolling[`avg${ROLLING_WINDOW_SHORT_DAYS}_ci_low`] || [];
  const r7High = rolling[`avg${ROLLING_WINDOW_SHORT_DAYS}_ci_high`] || [];
  const r30Low = rolling[`avg${ROLLING_WINDOW_LONG_DAYS}_ci_low`] || [];
  const r30High = rolling[`avg${ROLLING_WINDOW_LONG_DAYS}_ci_high`] || [];

  const { oai, cai, mai } = useMemo(() => {
    const keys = data.length ? Object.keys(data[0]) : [];
    const oaiKey = keys.find((k) => /obstructive/i.test(k) && /index/i.test(k));
    const caiKey = keys.find((k) => /central/i.test(k) && /index/i.test(k));
    const maiKey = keys.find((k) => /mixed/i.test(k) && /index/i.test(k));
    const compose = (key) =>
      data
        .map((r) => ({ date: new Date(r['Date']), val: parseFloat(r[key]) }))
        .filter((p) => !isNaN(p.val))
        .sort((a, b) => a.date - b.date);
    const oaiPts = oaiKey ? compose(oaiKey) : [];
    const caiPts = caiKey ? compose(caiKey) : [];
    const maiPts = maiKey ? compose(maiKey) : [];
    const oaiVals =
      oaiPts.length === dates.length ? oaiPts.map((p) => p.val) : null;
    const caiVals =
      caiPts.length === dates.length ? caiPts.map((p) => p.val) : null;
    const maiVals =
      maiPts.length === dates.length ? maiPts.map((p) => p.val) : null;
    return { oai: oaiVals, cai: caiVals, mai: maiVals };
  }, [data, dates]);

  const {
    maxLag,
    lagInputId,
    acfValues,
    pacfValues,
    acfConfidence,
    handleLagChange,
  } = useAutocorrelation(ahis, { initialMaxLag: DEFAULT_MAX_LAG });
  const shortWindowLabel = `${ROLLING_WINDOW_SHORT_DAYS}-night`;
  const longWindowLabel = `${ROLLING_WINDOW_LONG_DAYS}-night`;

  const { p25, median, p75, mean, nbins } = useUsageStats(ahis);

  // Severity bands counts
  const bands = useMemo(
    () =>
      ahis.reduce(
        (acc, v) => {
          if (v <= AHI_SEVERITY_LIMITS.normal) acc.le5++;
          else if (v <= AHI_SEVERITY_LIMITS.mild) acc.b5_15++;
          else if (v <= AHI_SEVERITY_LIMITS.moderate) acc.b15_30++;
          else acc.gt30++;
          return acc;
        },
        { le5: 0, b5_15: 0, b15_30: 0, gt30: 0 },
      ),
    [ahis],
  );

  const severityLabels = useMemo(
    () => ({
      le5: `≤ ${AHI_SEVERITY_LIMITS.normal}`,
      b5_15: `${AHI_SEVERITY_LIMITS.normal}–${AHI_SEVERITY_LIMITS.mild}`,
      b15_30: `${AHI_SEVERITY_LIMITS.mild}–${AHI_SEVERITY_LIMITS.moderate}`,
      gt30: `> ${AHI_SEVERITY_LIMITS.moderate}`,
    }),
    [],
  );

  // QQ-plot against normal
  const n = ahis.length;
  const sorted = ahis.slice().sort((a, b) => a - b);
  const mu = sorted.reduce((s, v) => s + v, 0) / n;
  const sigma = Math.sqrt(
    sorted.reduce((s, v) => s + (v - mu) ** SQUARE_EXPONENT, 0) /
      Math.max(1, n - 1),
  );
  const probs = sorted.map((_, i) => (i + 1) / (n + 1));
  const theo = probs.map((p) => mu + sigma * normalQuantile(p));

  // Bad-night tagging with explanations
  const p25b = p25;
  const p75b = p75;
  const iqrb = p75b - p25b;
  const outlierHighCut = p75b + IQR_OUTLIER_MULTIPLIER * iqrb;
  const dateStr = (d) => d.toISOString().slice(0, ISO_DATE_LENGTH);
  const clusterByNight = new Map();
  clusters.forEach((cl) => {
    const k = dateStr(cl.start);
    const prev = clusterByNight.get(k) || { maxDur: 0, maxCount: 0 };
    clusterByNight.set(k, {
      maxDur: Math.max(prev.maxDur, cl.durationSec),
      maxCount: Math.max(prev.maxCount, cl.count),
    });
  });
  const badNights = [];
  dates.forEach((d, i) => {
    const reasons = [];
    if (ahis[i] >= AHI_SEVERITY_LIMITS.mild || ahis[i] >= outlierHighCut)
      reasons.push('High AHI');
    if (oai && cai && mai) {
      const total = (oai[i] || 0) + (cai[i] || 0) + (mai[i] || 0);
      const fracCA = total ? cai[i] / total : 0;
      if (
        ahis[i] > AHI_SEVERITY_LIMITS.normal &&
        fracCA >= HIGH_CENTRAL_APNEA_FRACTION
      )
        reasons.push('High CA%');
    }
    const cl = clusterByNight.get(dateStr(d));
    if (
      cl &&
      (cl.maxDur >= CLUSTER_DURATION_ALERT_SEC ||
        cl.maxCount >= CLUSTER_COUNT_ALERT)
    )
      reasons.push('Long/dense cluster');
    if (reasons.length) badNights.push({ date: d, ahi: ahis[i], reasons });
  });

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
      <div className="chart-with-help">
        <ThemedPlot
          useResizeHandler
          style={{ width: '100%', height: `${DEFAULT_CHART_HEIGHT}px` }}
          data={[
            {
              x: dates,
              y: ahis,
              type: 'scatter',
              mode: 'lines',
              name: 'Nightly AHI',
              line: { width: PRIMARY_LINE_WIDTH, color: COLORS.primary },
            },
            // Short-window CI ribbon
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
            ...(oai && cai && mai
              ? [
                  {
                    x: dates,
                    y: oai,
                    type: 'scatter',
                    mode: 'lines',
                    name: 'OAI',
                    stackgroup: 'ahi',
                    line: { width: 0 },
                    fillcolor: 'rgba(31,119,180,0.4)',
                  },
                  {
                    x: dates,
                    y: cai,
                    type: 'scatter',
                    mode: 'lines',
                    name: 'CAI',
                    stackgroup: 'ahi',
                    line: { width: 0 },
                    fillcolor: 'rgba(255,127,14,0.4)',
                  },
                  {
                    x: dates,
                    y: mai,
                    type: 'scatter',
                    mode: 'lines',
                    name: 'MAI',
                    stackgroup: 'ahi',
                    line: { width: 0 },
                    fillcolor: 'rgba(44,160,44,0.4)',
                  },
                ]
              : []),
          ]}
          layout={{
            title: 'Nightly AHI Over Time',
            legend: { ...HORIZONTAL_CENTER_LEGEND },
            shapes: [
              {
                type: 'line',
                xref: 'paper',
                x0: 0,
                x1: 1,
                y0: AHI_SEVERITY_LIMITS.normal,
                y1: AHI_SEVERITY_LIMITS.normal,
                line: { color: COLORS.threshold, dash: 'dashdot' },
              },
              ...(breakDates || []).map((d) => ({
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
              })),
              ...(cpDates || []).map((d) => ({
                type: 'line',
                x0: d,
                x1: d,
                yref: 'paper',
                y0: 0,
                y1: 1,
                line: { color: '#6a3d9a', width: EMPHASIS_LINE_WIDTH },
              })),
            ],
            annotations: [
              {
                xref: 'paper',
                x: 1,
                y: AHI_SEVERITY_LIMITS.normal,
                xanchor: 'left',
                text: `AHI threshold (${AHI_SEVERITY_LIMITS.normal})`,
                showarrow: false,
                font: { color: COLORS.threshold },
              },
            ],
            xaxis: { title: 'Date' },
            yaxis: { title: 'AHI (events/hour)' },
            margin: { ...DEFAULT_PLOT_MARGIN },
          }}
          onRelayout={handleRelayout}
          config={{
            responsive: true,
            displaylogo: false,
            modeBarButtonsToAdd: ['toImage'],
            toImageButtonOptions: {
              format: CHART_EXPORT_FORMAT,
              filename: 'ahi_over_time',
            },
          }}
        />
        <VizHelp
          text={`Nightly AHI with ${shortWindowLabel} and ${longWindowLabel} averages. Dashed horizontal line at AHI=${AHI_SEVERITY_LIMITS.normal}; purple lines mark detected change-points; dotted verticals show crossover breakpoints.`}
        />
      </div>

      {ahis.length > 1 ? (
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
            min={LAG_INPUT_MIN}
            max={LAG_INPUT_MAX}
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
              title: 'AHI Autocorrelation',
              barmode: 'overlay',
              margin: { ...AUTOCORRELATION_CHART_MARGIN },
            }}
            useResizeHandler
            style={{
              width: '100%',
              height: `${AUTOCORRELATION_CHART_HEIGHT}px`,
            }}
          />
          <VizHelp text="Autocorrelation shows how strongly tonight's AHI relates to prior nights. Bars outside the grey band exceed the 95% white-noise expectation; see docs/user/02-visualizations.md#ahi-trends." />
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
              title: 'AHI Partial Autocorrelation',
              barmode: 'overlay',
              margin: { ...AUTOCORRELATION_CHART_MARGIN },
            }}
            useResizeHandler
            style={{
              width: '100%',
              height: `${AUTOCORRELATION_CHART_HEIGHT}px`,
            }}
          />
          <VizHelp text="Partial autocorrelation isolates direct dependencies at each lag. Sudden drops after a few lags suggest short memory, while long tails hint at persistent regimes." />
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
                  'Date: %{x|%Y-%m-%d}<br>Trend: %{y:.2f}<extra></extra>',
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
                  'Date: %{x|%Y-%m-%d}<br>Seasonal: %{y:.2f}<extra></extra>',
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
                  'Date: %{x|%Y-%m-%d}<br>Residual: %{y:.2f}<extra></extra>',
                showlegend: false,
              },
            ]}
            layout={{
              title: `AHI STL Decomposition (season=${STL_SEASON_LENGTH})`,
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
              yaxis: { title: 'Trend', zeroline: false },
              yaxis2: { title: 'Seasonal', zeroline: false },
              yaxis3: { title: 'Residual', zeroline: false },
              margin: { ...DEFAULT_PLOT_MARGIN },
            }}
            onRelayout={handleRelayout}
            config={{
              responsive: true,
              displaylogo: false,
              modeBarButtonsToAdd: ['toImage'],
              toImageButtonOptions: {
                format: CHART_EXPORT_FORMAT,
                filename: 'ahi_stl_decomposition',
              },
            }}
          />
          <VizHelp text="Trend/Seasonal/Residual view shows the STL decomposition. The weekly seasonal pane highlights recurring patterns; residual spikes mark nights that don't fit the weekly rhythm." />
        </div>
      )}

      <div className="usage-charts-grid">
        <div className="chart-item chart-with-help">
          <ThemedPlot
            useResizeHandler
            style={{ width: '100%', height: `${DEFAULT_CHART_HEIGHT}px` }}
            data={[
              {
                x: ahis,
                type: 'histogram',
                nbinsx: nbins,
                name: 'AHI Distribution',
                marker: { color: COLORS.primary },
              },
            ]}
            layout={{
              title: 'Distribution of Nightly AHI',
              legend: { ...HORIZONTAL_CENTER_LEGEND },
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
                  y: MEDIAN_ANNOTATION_Y,
                  text: `Median: ${median.toFixed(SUMMARY_DECIMAL_PLACES)}`,
                  showarrow: false,
                  font: { color: COLORS.secondary },
                },
                {
                  x: mean,
                  yref: 'paper',
                  y: MEAN_ANNOTATION_Y,
                  text: `Mean: ${mean.toFixed(SUMMARY_DECIMAL_PLACES)}`,
                  showarrow: false,
                  font: { color: COLORS.accent },
                },
              ],
              xaxis: { title: 'AHI (events/hour)' },
              yaxis: { title: 'Count' },
              margin: { ...DEFAULT_PLOT_MARGIN },
            }}
            config={{
              responsive: true,
              displaylogo: false,
              modeBarButtonsToAdd: ['toImage'],
              toImageButtonOptions: {
                format: CHART_EXPORT_FORMAT,
                filename: 'ahi_distribution',
              },
            }}
          />
          <VizHelp text="Distribution of nightly AHI values. Dashed line marks the median; dotted line marks the mean." />
        </div>
        <div className="chart-item chart-with-help">
          <ThemedPlot
            useResizeHandler
            style={{ width: '100%', height: `${DEFAULT_CHART_HEIGHT}px` }}
            data={[
              {
                y: ahis,
                type: 'box',
                name: 'AHI Boxplot',
                boxpoints: 'outliers',
                marker: { color: '#888' },
              },
            ]}
            layout={{
              title: 'Boxplot of Nightly AHI',
              yaxis: { title: 'AHI (events/hour)', zeroline: false },
              margin: { ...DEFAULT_PLOT_MARGIN },
            }}
          />
          <VizHelp text="Boxplot of nightly AHI; box shows the interquartile range (IQR) and points indicate outliers." />
        </div>
      </div>
      <div className="usage-charts-grid">
        <div className="chart-item chart-with-help">
          <ThemedPlot
            useResizeHandler
            style={{ width: '100%', height: `${DEFAULT_CHART_HEIGHT}px` }}
            data={[
              {
                y: ahis,
                type: 'violin',
                name: 'AHI Violin',
                points: 'outliers',
                box: { visible: true },
              },
            ]}
            layout={{
              title: 'Violin Plot of Nightly AHI',
              yaxis: { title: 'AHI (events/hour)' },
              margin: { ...DEFAULT_PLOT_MARGIN },
            }}
          />
          <VizHelp text="Violin plot of nightly AHI; width shows density of values. Inner box shows quartiles and median." />
        </div>
        <div className="chart-item chart-with-help">
          <ThemedPlot
            useResizeHandler
            style={{ width: '100%', height: `${DEFAULT_CHART_HEIGHT}px` }}
            data={[
              {
                x: theo,
                y: sorted,
                type: 'scatter',
                mode: 'markers',
                name: 'QQ Points',
                marker: { size: 5, opacity: 0.7 },
              },
              {
                x: [Math.min(...theo), Math.max(...theo)],
                y: [Math.min(...theo), Math.max(...theo)],
                type: 'scatter',
                mode: 'lines',
                name: 'y=x',
                line: { dash: 'dash' },
              },
            ]}
            layout={{
              title: 'QQ Plot vs Normal',
              xaxis: { title: 'Theoretical Quantiles' },
              yaxis: { title: 'Observed AHI Quantiles' },
              margin: { ...DEFAULT_PLOT_MARGIN },
            }}
          />
          <VizHelp text="QQ plot comparing observed AHI quantiles to a theoretical normal distribution. Deviations from the dashed y=x line indicate non-normality." />
        </div>
      </div>

      {/* Severity bands summary */}
      <div className="section" style={{ marginTop: '8px' }}>
        <h4>Severity Bands</h4>
        <table>
          <thead>
            <tr>
              <th>Band</th>
              <th>Nights</th>
              <th>Percent</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{severityLabels.le5}</td>
              <td>{bands.le5}</td>
              <td>{((bands.le5 / ahis.length) * PERCENT_SCALE).toFixed(0)}%</td>
            </tr>
            <tr>
              <td>{severityLabels.b5_15}</td>
              <td>{bands.b5_15}</td>
              <td>
                {((bands.b5_15 / ahis.length) * PERCENT_SCALE).toFixed(0)}%
              </td>
            </tr>
            <tr>
              <td>{severityLabels.b15_30}</td>
              <td>{bands.b15_30}</td>
              <td>
                {((bands.b15_30 / ahis.length) * PERCENT_SCALE).toFixed(0)}%
              </td>
            </tr>
            <tr>
              <td>{severityLabels.gt30}</td>
              <td>{bands.gt30}</td>
              <td>
                {((bands.gt30 / ahis.length) * PERCENT_SCALE).toFixed(0)}%
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {badNights.length ? (
        <div className="section" style={{ marginTop: '8px' }}>
          <h4>Bad Nights (top {BAD_NIGHT_LIMIT})</h4>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>AHI</th>
                <th>Reasons</th>
              </tr>
            </thead>
            <tbody>
              {badNights.slice(0, BAD_NIGHT_LIMIT).map((b) => (
                <tr key={b.date.getTime()}>
                  <td>{b.date.toISOString().slice(0, ISO_DATE_LENGTH)}</td>
                  <td>{b.ahi.toFixed(SUMMARY_DECIMAL_PLACES)}</td>
                  <td>{b.reasons.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
