import React, { useMemo } from 'react';
import { COLORS } from '../utils/colors';
import { useEffectiveDarkMode } from '../hooks/useEffectiveDarkMode';
import { ThemedPlot, VizHelp } from './ui';
import {
  mannWhitneyUTest,
  pearson,
  loessSmooth,
  runningQuantileXY,
} from '../utils/stats';
import { LOESS_SAMPLE_STEPS } from '../constants';

/**
 * EPAP Analysis Charts: boxplot of nightly median EPAP,
 * time-series of EPAP with first/last 30-night markers,
 * and scatter plot of EPAP vs AHI with regression line and correlation coefficient.
 */
function EpapTrendsCharts({ data }) {
  const {
    dates,
    epaps,
    first30Dates,
    first30Epaps,
    last30Dates,
    last30Epaps,
    epapAhiPairs,
    corr,
    slope,
    intercept,
    ahis,
  } = useMemo(() => {
    const pts = data
      .map((r) => ({
        date: new Date(r['Date']),
        epap: parseFloat(r['Median EPAP']),
        ahi: parseFloat(r['AHI']),
      }))
      .filter((p) => !isNaN(p.epap) && !isNaN(p.ahi))
      .sort((a, b) => a.date - b.date);
    const datesArr = pts.map((p) => p.date);
    const epapsArr = pts.map((p) => p.epap);
    const ahisArr = pts.map((p) => p.ahi);
    const first30 = pts.slice(0, 30);
    const last30 = pts.slice(-30);
    const epapAhiPairsArr = pts;
    const n = epapAhiPairsArr.length;
    const meanE = epapAhiPairsArr.reduce((sum, p) => sum + p.epap, 0) / n;
    const meanA = epapAhiPairsArr.reduce((sum, p) => sum + p.ahi, 0) / n;
    const cov =
      epapAhiPairsArr.reduce(
        (sum, p) => sum + (p.epap - meanE) * (p.ahi - meanA),
        0,
      ) /
      (n - 1);
    const varE =
      epapAhiPairsArr.reduce((sum, p) => sum + (p.epap - meanE) ** 2, 0) /
      (n - 1);
    const stdE = Math.sqrt(varE);
    const stdA = Math.sqrt(
      epapAhiPairsArr.reduce((sum, p) => sum + (p.ahi - meanA) ** 2, 0) /
        (n - 1),
    );
    const corrVal = cov / (stdE * stdA);
    const slopeVal = cov / varE;
    const interceptVal = meanA - slopeVal * meanE;
    return {
      dates: datesArr,
      epaps: epapsArr,
      first30Dates: first30.map((p) => p.date),
      first30Epaps: first30.map((p) => p.epap),
      last30Dates: last30.map((p) => p.date),
      last30Epaps: last30.map((p) => p.epap),
      epapAhiPairs: epapAhiPairsArr,
      corr: corrVal,
      slope: slopeVal,
      intercept: interceptVal,
      ahis: ahisArr,
    };
  }, [data]);

  // Time-series chart with first/last markers
  const boxMin = Math.min(...epaps);
  const boxMax = Math.max(...epaps);
  const xs = useMemo(() => {
    if (!epaps.length) return [];
    const min = Math.min(...epaps);
    const max = Math.max(...epaps);
    const steps = LOESS_SAMPLE_STEPS;
    const arr = [];
    const step = (max - min) / Math.max(1, steps - 1);
    for (let i = 0; i < steps; i++) arr.push(min + i * step);
    return arr;
  }, [epaps]);
  const loess = useMemo(
    () => loessSmooth(epaps, ahis, xs, 0.3),
    [epaps, ahis, xs],
  );
  const q50 = useMemo(
    () => runningQuantileXY(epaps, ahis, xs, 0.5, 25),
    [epaps, ahis, xs],
  );
  const q90 = useMemo(
    () => runningQuantileXY(epaps, ahis, xs, 0.9, 25),
    [epaps, ahis, xs],
  );

  const isDark = useEffectiveDarkMode();

  // Correlation matrix among available variables: EPAP, AHI, Usage (hours), Leak (if present)
  const corrMatrix = useMemo(() => {
    const vars = [];
    vars.push({ key: 'EPAP', values: epaps });
    vars.push({ key: 'AHI', values: ahis });
    // usage hours
    const usage = data
      .map((r) => r['Total Time'])
      .map((v) =>
        typeof v === 'string' && v.includes(':')
          ? v
              .split(':')
              .reduce((a, b, i) => a + parseFloat(b) * [3600, 60, 1][i], 0) /
            3600
          : parseFloat(v),
      )
      .filter((v) => !isNaN(v));
    if (usage.length === epaps.length)
      vars.push({ key: 'Usage (h)', values: usage });
    // leak median if present: find a numeric column with both 'Leak' and 'Median' in key
    const keys = data.length ? Object.keys(data[0]) : [];
    const leakMedKey = keys.find((k) => /leak/i.test(k) && /median/i.test(k));
    const leakPctKey = keys.find(
      (k) => /leak/i.test(k) && (/%/.test(k) || /time.*above/i.test(k)),
    );
    let leakMed = null;
    let leakPct = null;
    if (leakMedKey) {
      const leak = data
        .map((r) => parseFloat(r[leakMedKey]))
        .filter((v) => !isNaN(v));
      if (leak.length === epaps.length) {
        vars.push({ key: 'Leak (median)', values: leak });
        leakMed = leak;
      }
    }
    if (leakPctKey) {
      const arr = data
        .map((r) => parseFloat(r[leakPctKey]))
        .filter((v) => !isNaN(v));
      if (arr.length === epaps.length) {
        vars.push({ key: 'Leak (%>thr)', values: arr });
        leakPct = arr;
      }
    }
    const labels = vars.map((v) => v.key);
    const z = labels.map((_, i) =>
      labels.map((_, j) => pearson(vars[i].values, vars[j].values)),
    );
    // Partial correlations controlling for Usage and Leak variables if present
    const controlIdx = labels.reduce((arr, k, i) => {
      if (/usage/i.test(k) || /leak/i.test(k)) arr.push(i);
      return arr;
    }, []);
    let zPartial = null;
    if (controlIdx.length) {
      zPartial = labels.map((_, i) =>
        labels.map((_, j) => {
          if (i === j) return 1;
          // Build controls matrix from selected control variables (excluding target vars if they are controls)
          const controls = [];
          for (let row = 0; row < epaps.length; row++) {
            const rowVals = [];
            controlIdx.forEach((ci) => {
              if (ci !== i && ci !== j) rowVals.push(vars[ci].values[row]);
            });
            controls.push(rowVals);
          }
          return controls[0].length
            ? pearson(
                olsResidualsFromVars(vars[i].values, controls),
                olsResidualsFromVars(vars[j].values, controls),
              )
            : z[i][j];
        }),
      );
    }
    return { labels, z, zPartial, leakMedKey, leakMed, leakPctKey, leakPct };
  }, [data, epaps, ahis]);

  function olsResidualsFromVars(arr, controls) {
    // thin wrapper to use stats.js olsResiduals via dynamic import pattern avoided; reimplement minimal since controls small
    const n = arr.length;
    if (!controls || !controls[0] || controls[0].length === 0)
      return arr.slice();
    const p = controls[0].length;
    // Build X with intercept
    const X = new Array(n);
    for (let i = 0; i < n; i++) {
      X[i] = [1];
      for (let j = 0; j < p; j++) X[i].push(controls[i][j]);
    }
    const k = p + 1;
    const XtX = Array.from({ length: k }, () => new Array(k).fill(0));
    const Xty = new Array(k).fill(0);
    for (let i = 0; i < n; i++) {
      const xi = X[i];
      for (let a = 0; a < k; a++) {
        Xty[a] += xi[a] * arr[i];
        for (let b = 0; b < k; b++) XtX[a][b] += xi[a] * xi[b];
      }
    }
    const inv = (A) => {
      const nn = A.length;
      const M = A.map((row, i) =>
        row.concat(Array.from({ length: nn }, (_, j) => (i === j ? 1 : 0))),
      );
      for (let col = 0; col < nn; col++) {
        let pivot = col;
        for (let i = col + 1; i < nn; i++)
          if (Math.abs(M[i][col]) > Math.abs(M[pivot][col])) pivot = i;
        const pv = M[pivot][col];
        if (Math.abs(pv) < 1e-12) return null;
        if (pivot !== col) {
          const tmp = M[pivot];
          M[pivot] = M[col];
          M[col] = tmp;
        }
        for (let j = 0; j < 2 * nn; j++) M[col][j] /= pv;
        for (let i = 0; i < nn; i++) {
          if (i === col) continue;
          const f = M[i][col];
          for (let j = 0; j < 2 * nn; j++) M[i][j] -= f * M[col][j];
        }
      }
      const invA = Array.from({ length: nn }, () => new Array(nn).fill(0));
      for (let i = 0; i < nn; i++)
        for (let j = 0; j < nn; j++) invA[i][j] = M[i][nn + j];
      return invA;
    };
    const XtXinv = inv(XtX);
    if (!XtXinv) return arr.slice();
    const beta = new Array(k).fill(0);
    for (let a = 0; a < k; a++)
      for (let b = 0; b < k; b++) beta[a] += XtXinv[a][b] * Xty[b];
    const r = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      let yhat = 0;
      for (let a = 0; a < k; a++) yhat += X[i][a] * beta[a];
      r[i] = arr[i] - yhat;
    }
    return r;
  }

  // Mann–Whitney titration helper for EPAP <7 vs ≥7 bins
  const titration = useMemo(() => {
    const low = data
      .filter((r) => parseFloat(r['Median EPAP']) < 7)
      .map((r) => parseFloat(r['AHI']))
      .filter((v) => !isNaN(v));
    const high = data
      .filter((r) => parseFloat(r['Median EPAP']) >= 7)
      .map((r) => parseFloat(r['AHI']))
      .filter((v) => !isNaN(v));
    const res = mannWhitneyUTest(low, high);
    return { low, high, ...res };
  }, [data]);

  return (
    <div className="usage-charts">
      <div className="chart-with-help">
        <ThemedPlot
          useResizeHandler
          style={{ width: '100%', height: '300px' }}
          data={[
            {
              x: dates,
              y: epaps,
              type: 'scatter',
              mode: 'lines',
              name: 'Nightly EPAP',
              line: { width: 1, color: COLORS.primary },
            },
            {
              x: first30Dates,
              y: first30Epaps,
              type: 'scatter',
              mode: 'markers',
              name: 'First 30 Nights',
              marker: { color: COLORS.accent, size: 6 },
            },
            {
              x: last30Dates,
              y: last30Epaps,
              type: 'scatter',
              mode: 'markers',
              name: 'Last 30 Nights',
              marker: { color: COLORS.secondary, size: 6 },
            },
          ]}
          layout={{
            title: 'Nightly Median EPAP Over Time',
            legend: { orientation: 'h', x: 0.5, xanchor: 'center' },
            xaxis: { title: 'Date' },
            yaxis: { title: 'EPAP (cmH₂O)' },
            margin: { t: 40, l: 60, r: 20, b: 50 },
          }}
          config={{
            responsive: true,
            displaylogo: false,
            modeBarButtonsToAdd: ['toImage'],
            toImageButtonOptions: { format: 'svg', filename: 'epap_over_time' },
          }}
        />
        <VizHelp text="Nightly median EPAP over time. Dots highlight the first and last 30 nights for quick comparison." />
      </div>

      <div className="usage-charts-grid">
        <div className="chart-item chart-with-help">
          <ThemedPlot
            useResizeHandler
            style={{ width: '100%', height: '300px' }}
            data={[
              {
                y: epaps,
                type: 'box',
                name: 'EPAP Boxplot',
                boxpoints: 'outliers',
                marker: { color: COLORS.box },
              },
            ]}
            layout={{
              title: 'Boxplot of Nightly Median EPAP',
              legend: { orientation: 'h', x: 0.5, xanchor: 'center' },
              yaxis: { title: 'EPAP (cmH₂O)', zeroline: false },
              margin: { t: 40, l: 60, r: 20, b: 50 },
            }}
            config={{
              responsive: true,
              displaylogo: false,
              modeBarButtonsToAdd: ['toImage'],
              toImageButtonOptions: { format: 'svg', filename: 'epap_boxplot' },
            }}
          />
          <VizHelp text="Boxplot of nightly median EPAP; box shows IQR and points indicate outliers." />
        </div>
        <div className="chart-item chart-with-help">
          <ThemedPlot
            useResizeHandler
            style={{ width: '100%', height: '300px' }}
            data={[
              {
                x: epapAhiPairs.map((p) => p.epap),
                y: epapAhiPairs.map((p) => p.ahi),
                type: 'scatter',
                mode: 'markers',
                name: 'Data',
                marker: { size: 6, opacity: 0.7, color: COLORS.primary },
              },
              {
                x: [boxMin, boxMax],
                y: [slope * boxMin + intercept, slope * boxMax + intercept],
                type: 'scatter',
                mode: 'lines',
                name: 'Fit',
                line: { dash: 'dash', width: 2, color: COLORS.secondary },
              },
              ...(xs.length
                ? [
                    {
                      x: xs,
                      y: loess,
                      type: 'scatter',
                      mode: 'lines',
                      name: 'LOESS',
                      line: { width: 2, color: '#6a3d9a' },
                    },
                    {
                      x: xs,
                      y: q50,
                      type: 'scatter',
                      mode: 'lines',
                      name: 'p50',
                      line: { width: 1.5, color: '#2ca02c' },
                    },
                    {
                      x: xs,
                      y: q90,
                      type: 'scatter',
                      mode: 'lines',
                      name: 'p90',
                      line: { width: 1.5, color: '#d62728' },
                    },
                  ]
                : []),
            ]}
            layout={{
              title: `EPAP vs AHI Scatter (r = ${corr.toFixed(2)})`,
              legend: { orientation: 'h', x: 0.5, xanchor: 'center' },
              xaxis: { title: 'Median EPAP (cmH₂O)' },
              yaxis: { title: 'AHI (events/hour)' },
              margin: { t: 40, l: 60, r: 20, b: 50 },
            }}
            config={{
              responsive: true,
              displaylogo: false,
              modeBarButtonsToAdd: ['toImage'],
              toImageButtonOptions: {
                format: 'svg',
                filename: 'epap_vs_ahi_scatter',
              },
            }}
          />
          <VizHelp text="Scatter of nightly EPAP vs AHI. Dots are nights; dashed line is linear fit; purple line is LOESS smoother; green/red lines are running p50/p90 quantiles." />
        </div>
        <div className="chart-item chart-with-help">
          <ThemedPlot
            useResizeHandler
            style={{ width: '100%', height: '300px' }}
            data={[
              {
                x: epapAhiPairs.map((p) => p.epap),
                y: epapAhiPairs.map((p) => p.ahi),
                type: 'histogram2d',
                colorscale: 'Viridis',
              },
            ]}
            layout={{
              title: 'EPAP vs AHI Density (2D Histogram)',
              xaxis: { title: 'Median EPAP (cmH₂O)' },
              yaxis: { title: 'AHI (events/hour)' },
              margin: { t: 40, l: 60, r: 20, b: 50 },
            }}
            config={{ responsive: true, displaylogo: false }}
          />
          <VizHelp text="2D histogram density of EPAP vs AHI, highlighting common combinations." />
        </div>
      </div>

      {corrMatrix.labels.length >= 2 && (
        <div
          className="chart-item chart-with-help"
          style={{ marginTop: '16px' }}
        >
          <ThemedPlot
            useResizeHandler
            style={{ width: '100%', height: '300px' }}
            data={[
              {
                z: corrMatrix.z,
                x: corrMatrix.labels,
                y: corrMatrix.labels,
                type: 'heatmap',
                colorscale: isDark
                  ? [
                      [0.0, '#9e2f2f'],
                      [0.25, '#d04a4a'],
                      [0.5, '#1a2330'],
                      [0.75, '#4a7bd0'],
                      [1.0, '#2f5aa6'],
                    ]
                  : 'RdBu',
                zmin: -1,
                zmax: 1,
                reversescale: !isDark,
              },
            ]}
            layout={{
              title: 'Correlation Matrix (Pearson r)',
              autosize: true,
              xaxis: { title: 'Variable' },
              yaxis: { title: 'Variable' },
              margin: { t: 40, l: 80, r: 20, b: 80 },
              annotations: corrMatrix.z.flatMap((row, i) =>
                row.map((v, j) => ({
                  x: corrMatrix.labels[j],
                  y: corrMatrix.labels[i],
                  text: isFinite(v) ? v.toFixed(2) : '—',
                  showarrow: false,
                  font: { color: isDark ? '#fff' : '#000' },
                })),
              ),
            }}
            config={{ responsive: true, displaylogo: false }}
          />
          <VizHelp text="Correlation matrix (Pearson r) among available variables; cell labels show the correlation value." />
        </div>
      )}

      {corrMatrix.zPartial && (
        <div
          className="chart-item chart-with-help"
          style={{ marginTop: '12px' }}
        >
          <ThemedPlot
            useResizeHandler
            style={{ width: '100%', height: '300px' }}
            data={[
              {
                z: corrMatrix.zPartial,
                x: corrMatrix.labels,
                y: corrMatrix.labels,
                type: 'heatmap',
                colorscale: isDark
                  ? [
                      [0.0, '#9e2f2f'],
                      [0.25, '#d04a4a'],
                      [0.5, '#1a2330'],
                      [0.75, '#4a7bd0'],
                      [1.0, '#2f5aa6'],
                    ]
                  : 'RdBu',
                zmin: -1,
                zmax: 1,
                reversescale: !isDark,
              },
            ]}
            layout={{
              title: 'Partial Correlation (controls: Usage, Leak)',
              autosize: true,
              xaxis: { title: 'Variable' },
              yaxis: { title: 'Variable' },
              margin: { t: 40, l: 80, r: 20, b: 80 },
              annotations: corrMatrix.zPartial.flatMap((row, i) =>
                row.map((v, j) => ({
                  x: corrMatrix.labels[j],
                  y: corrMatrix.labels[i],
                  text: isFinite(v) ? v.toFixed(2) : '—',
                  showarrow: false,
                  font: { color: isDark ? '#fff' : '#000' },
                })),
              ),
            }}
            config={{ responsive: true, displaylogo: false }}
          />
          <VizHelp text="Partial correlations controlling for Usage and Leak (if available). Helps assess EPAP–AHI relationship net of confounding." />
        </div>
      )}

      {/* Leak charts if available */}
      {corrMatrix.leakMed && corrMatrix.leakMed.length ? (
        <div className="usage-charts-grid" style={{ marginTop: '16px' }}>
          <div className="chart-item chart-with-help">
            <ThemedPlot
              useResizeHandler
              style={{ width: '100%', height: '300px' }}
              data={[
                {
                  x: dates,
                  y: corrMatrix.leakMed,
                  type: 'scatter',
                  mode: 'lines',
                  name: 'Leak Median',
                },
              ]}
              layout={{
                title: 'Leak Median Over Time',
                xaxis: { title: 'Date' },
                yaxis: { title: 'Leak (median)' },
                margin: { t: 40, l: 60, r: 20, b: 50 },
              }}
              config={{ responsive: true, displaylogo: false }}
            />
            <VizHelp text="Leak median over time if available; trends can indicate mask fit or seal issues." />
          </div>
          <div className="chart-item chart-with-help">
            <ThemedPlot
              useResizeHandler
              style={{ width: '100%', height: '300px' }}
              data={[{ x: corrMatrix.leakMed, type: 'histogram', nbinsx: 20 }]}
              layout={{
                title: 'Leak Median Distribution',
                xaxis: { title: 'Leak (median)' },
                yaxis: { title: 'Count' },
                margin: { t: 40, l: 60, r: 20, b: 50 },
              }}
              config={{ responsive: true, displaylogo: false }}
            />
            <VizHelp text="Distribution of nightly leak median values; helps identify consistent high-leak nights." />
          </div>
          {corrMatrix.leakPct && corrMatrix.leakPct.length ? (
            <div className="chart-item chart-with-help">
              <ThemedPlot
                useResizeHandler
                style={{ width: '100%', height: '300px' }}
                data={[
                  {
                    x: dates,
                    y: corrMatrix.leakPct,
                    type: 'scatter',
                    mode: 'lines',
                    name: 'Leak % above thr',
                  },
                ]}
                layout={{
                  title: 'Time Above Leak Threshold (%)',
                  xaxis: { title: 'Date' },
                  yaxis: { title: 'Percent of night (%)' },
                  margin: { t: 40, l: 60, r: 20, b: 50 },
                }}
                config={{ responsive: true, displaylogo: false }}
              />
              <VizHelp text="Percent of each night above leak threshold; persistent high percentages may impair therapy." />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="section" style={{ marginTop: '8px' }}>
        <h4>EPAP Titration (AHI by EPAP bins)</h4>
        <table>
          <thead>
            <tr>
              <th>Group</th>
              <th>n</th>
              <th>Mean AHI</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>EPAP &lt; 7</td>
              <td>{titration.low.length}</td>
              <td>
                {(
                  titration.low.reduce((a, b) => a + b, 0) /
                  (titration.low.length || 1)
                ).toFixed(2)}
              </td>
            </tr>
            <tr>
              <td>EPAP ≥ 7</td>
              <td>{titration.high.length}</td>
              <td>
                {(
                  titration.high.reduce((a, b) => a + b, 0) /
                  (titration.high.length || 1)
                ).toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
        <p>
          MW U = {isFinite(titration.U) ? titration.U.toFixed(1) : '—'}, p
          {titration.method === 'exact' ? ' (exact)' : ' (normal)'} ≈{' '}
          {isFinite(titration.p) ? titration.p.toExponential(2) : '—'}, effect
          (rank-biserial, high &gt; low) ≈{' '}
          {isFinite(titration.effect) ? titration.effect.toFixed(2) : '—'}
          {isFinite(titration.effect_ci_low) &&
          isFinite(titration.effect_ci_high)
            ? ` [${titration.effect_ci_low.toFixed(2)}, ${titration.effect_ci_high.toFixed(2)}]`
            : ''}
        </p>
      </div>
    </div>
  );
}

export { EpapTrendsCharts };
export default React.memo(EpapTrendsCharts);
