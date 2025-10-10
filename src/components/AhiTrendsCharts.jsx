import React, { useMemo, useCallback, useState, useId } from 'react';
import {
  quantile,
  detectUsageBreakpoints,
  computeUsageRolling,
  detectChangePoints,
  normalQuantile,
  stlDecompose,
  computeAutocorrelation,
  computePartialAutocorrelation,
} from '../utils/stats';
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
  FREEDMAN_DIACONIS_FACTOR,
  HISTOGRAM_FALLBACK_BINS,
  HIGH_CENTRAL_APNEA_FRACTION,
  IQR_OUTLIER_MULTIPLIER,
  MAX_LAG_INPUT,
  MIN_LAG_INPUT,
  NORMAL_CONFIDENCE_Z,
  QUARTILE_LOWER,
  QUARTILE_MEDIAN,
  QUARTILE_UPPER,
  ROLLING_WINDOW_LONG_DAYS,
  ROLLING_WINDOW_SHORT_DAYS,
  STL_SEASON_LENGTH,
} from '../constants';
import {
  AUTOCORRELATION_CONFIDENCE_LABEL,
  DEFAULT_CHART_HEIGHT,
} from '../constants/charts';

export default function AhiTrendsCharts({
  data,
  clusters = [],
  onRangeSelect,
}) {
  const {
    dates,
    ahis,
    rolling7,
    rolling30,
    r7Low,
    r7High,
    r30Low,
    r30High,
    breakDates,
    cpDates,
    oai,
    cai,
    mai,
    decomposition,
  } = useMemo(() => {
    const pts = data
      .map((r) => ({ date: new Date(r['Date']), ahi: parseFloat(r['AHI']) }))
      .filter((p) => !isNaN(p.ahi))
      .sort((a, b) => a.date - b.date);
    const datesArr = pts.map((p) => p.date);
    const ahisArr = pts.map((p) => p.ahi);
    const rolling = computeUsageRolling(
      datesArr,
      ahisArr,
      DEFAULT_ROLLING_WINDOWS,
    );
    const rolling7 = rolling.avg7;
    const rolling30 = rolling.avg30;
    const r7Low = rolling['avg7_ci_low'];
    const r7High = rolling['avg7_ci_high'];
    const r30Low = rolling['avg30_ci_low'];
    const r30High = rolling['avg30_ci_high'];
    const breakDates = detectUsageBreakpoints(
      rolling7,
      rolling30,
      datesArr,
      AHI_BREAKPOINT_MIN_DELTA,
    );
    const cpDates = detectChangePoints(
      ahisArr,
      datesArr,
      AHI_CHANGEPOINT_PENALTY,
    );
    const decomposition = stlDecompose(ahisArr, {
      seasonLength: STL_SEASON_LENGTH,
    });

    // Optional decomposition if columns present
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
    const oai =
      oaiPts.length === datesArr.length ? oaiPts.map((p) => p.val) : null;
    const cai =
      caiPts.length === datesArr.length ? caiPts.map((p) => p.val) : null;
    const mai =
      maiPts.length === datesArr.length ? maiPts.map((p) => p.val) : null;
    return {
      dates: datesArr,
      ahis: ahisArr,
      rolling7,
      rolling30,
      breakDates,
      oai,
      cai,
      mai,
      cpDates,
      r7Low,
      r7High,
      r30Low,
      r30High,
      decomposition,
    };
  }, [data]);

  const [maxLag, setMaxLag] = useState(DEFAULT_MAX_LAG);
  const lagInputId = useId();
  const shortWindowLabel = `${ROLLING_WINDOW_SHORT_DAYS}-night`;
  const longWindowLabel = `${ROLLING_WINDOW_LONG_DAYS}-night`;

  const { acfValues, pacfValues, acfConfidence } = useMemo(() => {
    const finiteAhis = ahis.filter((v) => Number.isFinite(v));
    const sampleSize = finiteAhis.length;
    if (sampleSize <= 1) {
      return { acfValues: [], pacfValues: [], acfConfidence: NaN };
    }
    const requestedLag = Math.max(1, Math.round(maxLag));
    const cappedLag = Math.min(
      requestedLag,
      sampleSize - 1,
      Math.max(1, ahis.length - 1),
    );
    const acf = computeAutocorrelation(ahis, cappedLag).values.filter(
      (d) => d.lag > 0,
    );
    const pacf = computePartialAutocorrelation(ahis, cappedLag).values;
    const conf =
      sampleSize > 0 ? NORMAL_CONFIDENCE_Z / Math.sqrt(sampleSize) : NaN;
    return { acfValues: acf, pacfValues: pacf, acfConfidence: conf };
  }, [ahis, maxLag]);

  const handleLagChange = useCallback((event) => {
    const raw = Number(event.target.value);
    if (!Number.isFinite(raw)) {
      return;
    }
    const rounded = Math.round(raw) || MIN_LAG_INPUT;
    const clamped = Math.max(MIN_LAG_INPUT, Math.min(rounded, MAX_LAG_INPUT));
    setMaxLag(clamped);
  }, []);

  // Summary stats and adaptive histogram bins
  const p25 = quantile(ahis, QUARTILE_LOWER);
  const median = quantile(ahis, QUARTILE_MEDIAN);
  const p75 = quantile(ahis, QUARTILE_UPPER);
  const iqr = p75 - p25;
  const mean = ahis.reduce((sum, v) => sum + v, 0) / ahis.length;
  const binWidth =
    FREEDMAN_DIACONIS_FACTOR * iqr * Math.pow(ahis.length, -1 / 3);
  const range = Math.max(...ahis) - Math.min(...ahis);
  const nbins =
    binWidth > 0 ? Math.ceil(range / binWidth) : HISTOGRAM_FALLBACK_BINS;

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
    sorted.reduce((s, v) => s + (v - mu) ** 2, 0) / Math.max(1, n - 1),
  );
  const probs = sorted.map((_, i) => (i + 1) / (n + 1));
  const theo = probs.map((p) => mu + sigma * normalQuantile(p));

  // Bad-night tagging with explanations
  const p25b = quantile(ahis, QUARTILE_LOWER);
  const p75b = quantile(ahis, QUARTILE_UPPER);
  const iqrb = p75b - p25b;
  const outlierHighCut = p75b + IQR_OUTLIER_MULTIPLIER * iqrb;
  const dateStr = (d) => d.toISOString().slice(0, 10);
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
              line: { width: 1, color: COLORS.primary },
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
            legend: { orientation: 'h', x: 0.5, xanchor: 'center' },
            shapes: [
              {
                type: 'line',
                xref: 'paper',
                x0: 0,
                x1: 1,
                y0: 5,
                y1: 5,
                line: { color: COLORS.threshold, dash: 'dashdot' },
              },
              ...(breakDates || []).map((d) => ({
                type: 'line',
                x0: d,
                x1: d,
                yref: 'paper',
                y0: 0,
                y1: 1,
                line: { color: '#aa3377', width: 1, dash: 'dot' },
              })),
              ...(cpDates || []).map((d) => ({
                type: 'line',
                x0: d,
                x1: d,
                yref: 'paper',
                y0: 0,
                y1: 1,
                line: { color: '#6a3d9a', width: 2 },
              })),
            ],
            annotations: [
              {
                xref: 'paper',
                x: 1,
                y: 5,
                xanchor: 'left',
                text: 'AHI threshold (5)',
                showarrow: false,
                font: { color: COLORS.threshold },
              },
            ],
            xaxis: { title: 'Date' },
            yaxis: { title: 'AHI (events/hour)' },
            margin: { t: 40, l: 60, r: 20, b: 50 },
          }}
          onRelayout={handleRelayout}
          config={{
            responsive: true,
            displaylogo: false,
            modeBarButtonsToAdd: ['toImage'],
            toImageButtonOptions: { format: 'svg', filename: 'ahi_over_time' },
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
                line: { color: 'rgba(150,150,150,0.6)', width: 1 },
                fill: 'tonexty',
                hoverinfo: 'skip',
                showlegend: true,
              },
            ]}
            layout={{
              title: 'AHI Autocorrelation',
              barmode: 'overlay',
              margin: { t: 40, r: 30, b: 40, l: 50 },
            }}
            useResizeHandler
            style={{ width: '100%', height: '260px' }}
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
                line: { color: 'rgba(150,150,150,0.6)', width: 1 },
                fill: 'tonexty',
                hoverinfo: 'skip',
                showlegend: true,
              },
            ]}
            layout={{
              title: 'AHI Partial Autocorrelation',
              barmode: 'overlay',
              margin: { t: 40, r: 30, b: 40, l: 50 },
            }}
            useResizeHandler
            style={{ width: '100%', height: '260px' }}
          />
          <VizHelp text="Partial autocorrelation isolates direct dependencies at each lag. Sudden drops after a few lags suggest short memory, while long tails hint at persistent regimes." />
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
                line: { color: COLORS.accent, width: 1 },
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
                line: { color: COLORS.primary, width: 1 },
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
              legend: { orientation: 'h', x: 0.5, xanchor: 'center' },
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
              margin: { t: 40, l: 60, r: 20, b: 50 },
            }}
            onRelayout={handleRelayout}
            config={{
              responsive: true,
              displaylogo: false,
              modeBarButtonsToAdd: ['toImage'],
              toImageButtonOptions: {
                format: 'svg',
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
              legend: { orientation: 'h', x: 0.5, xanchor: 'center' },
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
              xaxis: { title: 'AHI (events/hour)' },
              yaxis: { title: 'Count' },
              margin: { t: 40, l: 60, r: 20, b: 50 },
            }}
            config={{
              responsive: true,
              displaylogo: false,
              modeBarButtonsToAdd: ['toImage'],
              toImageButtonOptions: {
                format: 'svg',
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
              margin: { t: 40, l: 60, r: 20, b: 50 },
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
              margin: { t: 40, l: 60, r: 20, b: 50 },
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
              margin: { t: 40, l: 60, r: 20, b: 50 },
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
              <td>{((bands.le5 / ahis.length) * 100).toFixed(0)}%</td>
            </tr>
            <tr>
              <td>{severityLabels.b5_15}</td>
              <td>{bands.b5_15}</td>
              <td>{((bands.b5_15 / ahis.length) * 100).toFixed(0)}%</td>
            </tr>
            <tr>
              <td>{severityLabels.b15_30}</td>
              <td>{bands.b15_30}</td>
              <td>{((bands.b15_30 / ahis.length) * 100).toFixed(0)}%</td>
            </tr>
            <tr>
              <td>{severityLabels.gt30}</td>
              <td>{bands.gt30}</td>
              <td>{((bands.gt30 / ahis.length) * 100).toFixed(0)}%</td>
            </tr>
          </tbody>
        </table>
      </div>

      {badNights.length ? (
        <div className="section" style={{ marginTop: '8px' }}>
          <h4>Bad Nights (top 10)</h4>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>AHI</th>
                <th>Reasons</th>
              </tr>
            </thead>
            <tbody>
              {badNights.slice(0, 10).map((b) => (
                <tr key={b.date.getTime()}>
                  <td>{b.date.toISOString().slice(0, 10)}</td>
                  <td>{b.ahi.toFixed(2)}</td>
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
