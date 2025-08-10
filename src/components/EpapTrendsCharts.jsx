import React, { useMemo } from 'react';
import Plot from 'react-plotly.js';
import { COLORS } from '../utils/colors';
import { useEffectiveDarkMode } from '../hooks/useEffectiveDarkMode';
import { applyChartTheme } from '../utils/chartTheme';
import VizHelp from './VizHelp';
import { mannWhitneyUTest, pearson, loessSmooth, runningQuantileXY } from '../utils/stats';

/**
 * EPAP Analysis Charts: boxplot of nightly median EPAP,
 * time-series of EPAP with first/last 30-night markers,
 * and scatter plot of EPAP vs AHI with regression line and correlation coefficient.
 */
export default function EpapTrendsCharts({ data, width = 700, height = 300 }) {
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
      .map(r => ({
        date: new Date(r['Date']),
        epap: parseFloat(r['Median EPAP']),
        ahi: parseFloat(r['AHI']),
      }))
      .filter(p => !isNaN(p.epap) && !isNaN(p.ahi))
      .sort((a, b) => a.date - b.date);
    const datesArr = pts.map(p => p.date);
    const epapsArr = pts.map(p => p.epap);
    const ahisArr = pts.map(p => p.ahi);
    const first30 = pts.slice(0, 30);
    const last30 = pts.slice(-30);
    const epapAhiPairsArr = pts;
    const n = epapAhiPairsArr.length;
    const meanE = epapAhiPairsArr.reduce((sum, p) => sum + p.epap, 0) / n;
    const meanA = epapAhiPairsArr.reduce((sum, p) => sum + p.ahi, 0) / n;
    const cov =
      epapAhiPairsArr.reduce((sum, p) => sum + (p.epap - meanE) * (p.ahi - meanA), 0) /
      (n - 1);
    const varE =
      epapAhiPairsArr.reduce((sum, p) => sum + (p.epap - meanE) ** 2, 0) / (n - 1);
    const stdE = Math.sqrt(varE);
    const stdA = Math.sqrt(
      epapAhiPairsArr.reduce((sum, p) => sum + (p.ahi - meanA) ** 2, 0) / (n - 1)
    );
    const corrVal = cov / (stdE * stdA);
    const slopeVal = cov / varE;
    const interceptVal = meanA - slopeVal * meanE;
    return {
      dates: datesArr,
      epaps: epapsArr,
      first30Dates: first30.map(p => p.date),
      first30Epaps: first30.map(p => p.epap),
      last30Dates: last30.map(p => p.date),
      last30Epaps: last30.map(p => p.epap),
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
    const steps = 60;
    const arr = [];
    const step = (max - min) / Math.max(1, steps - 1);
    for (let i = 0; i < steps; i++) arr.push(min + i * step);
    return arr;
  }, [epaps]);
  const loess = useMemo(() => loessSmooth(epaps, ahis, xs, 0.3), [epaps, ahis, xs]);
  const q50 = useMemo(() => runningQuantileXY(epaps, ahis, xs, 0.5, 25), [epaps, ahis, xs]);
  const q90 = useMemo(() => runningQuantileXY(epaps, ahis, xs, 0.9, 25), [epaps, ahis, xs]);

  const isDark = useEffectiveDarkMode();

  // Correlation matrix among available variables: EPAP, AHI, Usage (hours), Leak (if present)
  const corrMatrix = useMemo(() => {
    const vars = [];
    vars.push({ key: 'EPAP', values: epaps });
    vars.push({ key: 'AHI', values: ahis });
    // usage hours
    const usage = data
      .map(r => r['Total Time'])
      .map(v => (typeof v === 'string' && v.includes(':') ? (v.split(':').reduce((a, b, i) => a + parseFloat(b) * [3600, 60, 1][i], 0)) / 3600 : parseFloat(v)))
      .filter(v => !isNaN(v));
    if (usage.length === epaps.length) vars.push({ key: 'Usage (h)', values: usage });
    // leak median if present: find a numeric column with both 'Leak' and 'Median' in key
    const keys = data.length ? Object.keys(data[0]) : [];
    const leakMedKey = keys.find(k => /leak/i.test(k) && /median/i.test(k));
    const leakPctKey = keys.find(k => /leak/i.test(k) && (/%/.test(k) || /time.*above/i.test(k)));
    let leakMed = null;
    let leakPct = null;
    if (leakMedKey) {
      const leak = data.map(r => parseFloat(r[leakMedKey])).filter(v => !isNaN(v));
      if (leak.length === epaps.length) {
        vars.push({ key: 'Leak (median)', values: leak });
        leakMed = leak;
      }
    }
    if (leakPctKey) {
      const arr = data.map(r => parseFloat(r[leakPctKey])).filter(v => !isNaN(v));
      if (arr.length === epaps.length) {
        vars.push({ key: 'Leak (%>thr)', values: arr });
        leakPct = arr;
      }
    }
    const labels = vars.map(v => v.key);
    const z = labels.map((_, i) => labels.map((_, j) => pearson(vars[i].values, vars[j].values)));
    return { labels, z, leakMedKey, leakMed, leakPctKey, leakPct };
  }, [data, epaps, ahis]);

  // Mann–Whitney titration helper for EPAP <7 vs ≥7 bins
  const titration = useMemo(() => {
    const low = data.filter(r => parseFloat(r['Median EPAP']) < 7).map(r => parseFloat(r['AHI'])).filter(v => !isNaN(v));
    const high = data.filter(r => parseFloat(r['Median EPAP']) >= 7).map(r => parseFloat(r['AHI'])).filter(v => !isNaN(v));
    const res = mannWhitneyUTest(low, high);
    return { low, high, ...res };
  }, [data]);

  return (
    <div className="usage-charts">
      <div className="chart-with-help">
        <Plot
        key={isDark ? 'dark' : 'light'}
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
        layout={applyChartTheme(isDark, {
          title: 'Nightly Median EPAP Over Time',
          legend: { orientation: 'h', x: 0.5, xanchor: 'center' },
          xaxis: { title: 'Date' },
          yaxis: { title: 'EPAP (cmH₂O)' },
          margin: { t: 40, l: 60, r: 20, b: 50 },
        })}
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
        <Plot
          key={isDark ? 'dark-box' : 'light-box'}
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
          layout={applyChartTheme(isDark, {
            title: 'Boxplot of Nightly Median EPAP',
            legend: { orientation: 'h', x: 0.5, xanchor: 'center' },
            yaxis: { title: 'EPAP (cmH₂O)', zeroline: false },
            margin: { t: 40, l: 60, r: 20, b: 50 },
          })}
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
          <Plot
            key={isDark ? 'dark-scatter' : 'light-scatter'}
            useResizeHandler
            style={{ width: '100%', height: '300px' }}
            data={[
              { x: epapAhiPairs.map(p => p.epap), y: epapAhiPairs.map(p => p.ahi), type: 'scatter', mode: 'markers', name: 'Data', marker: { size: 6, opacity: 0.7, color: COLORS.primary } },
              { x: [boxMin, boxMax], y: [slope * boxMin + intercept, slope * boxMax + intercept], type: 'scatter', mode: 'lines', name: 'Fit', line: { dash: 'dash', width: 2, color: COLORS.secondary } },
              ...(xs.length ? [
                { x: xs, y: loess, type: 'scatter', mode: 'lines', name: 'LOESS', line: { width: 2, color: '#6a3d9a' } },
                { x: xs, y: q50, type: 'scatter', mode: 'lines', name: 'p50', line: { width: 1.5, color: '#2ca02c' } },
                { x: xs, y: q90, type: 'scatter', mode: 'lines', name: 'p90', line: { width: 1.5, color: '#d62728' } },
              ] : []),
            ]}
            layout={applyChartTheme(isDark, {
              title: `EPAP vs AHI Scatter (r = ${corr.toFixed(2)})`,
              legend: { orientation: 'h', x: 0.5, xanchor: 'center' },
              xaxis: { title: 'Median EPAP (cmH₂O)' },
              yaxis: { title: 'AHI (events/hour)' },
              margin: { t: 40, l: 60, r: 20, b: 50 },
            })}
            config={{
              responsive: true,
              displaylogo: false,
              modeBarButtonsToAdd: ['toImage'],
              toImageButtonOptions: { format: 'svg', filename: 'epap_vs_ahi_scatter' },
            }}
          />
          <VizHelp text="Scatter of nightly EPAP vs AHI. Dots are nights; dashed line is linear fit; purple line is LOESS smoother; green/red lines are running p50/p90 quantiles." />
      </div>
        <div className="chart-item chart-with-help">
          <Plot
            key={isDark ? 'dark-2d' : 'light-2d'}
            useResizeHandler
            style={{ width: '100%', height: '300px' }}
            data={[{ x: epapAhiPairs.map(p => p.epap), y: epapAhiPairs.map(p => p.ahi), type: 'histogram2d', colorscale: 'Viridis' }]}
            layout={applyChartTheme(isDark, {
              title: 'EPAP vs AHI Density (2D Histogram)',
              xaxis: { title: 'Median EPAP (cmH₂O)' },
              yaxis: { title: 'AHI (events/hour)' },
              margin: { t: 40, l: 60, r: 20, b: 50 },
            })}
            config={{ responsive: true, displaylogo: false }}
          />
          <VizHelp text="2D histogram density of EPAP vs AHI, highlighting common combinations." />
        </div>
      </div>

      {corrMatrix.labels.length >= 2 && (
        <div className="chart-item chart-with-help" style={{ marginTop: '16px' }}>
          <Plot
            key={isDark ? 'dark-corr' : 'light-corr'}
            useResizeHandler
            style={{ width: '100%', height: '300px' }}
            data={[{ z: corrMatrix.z, x: corrMatrix.labels, y: corrMatrix.labels, type: 'heatmap', colorscale: isDark ? [
              [0.0, '#9e2f2f'],
              [0.25, '#d04a4a'],
              [0.5, '#1a2330'],
              [0.75, '#4a7bd0'],
              [1.0, '#2f5aa6'],
            ] : 'RdBu', zmin: -1, zmax: 1, reversescale: !isDark }]}
            layout={applyChartTheme(isDark, {
              title: 'Correlation Matrix (Pearson r)',
              autosize: true,
              xaxis: { title: 'Variable' },
              yaxis: { title: 'Variable' },
              margin: { t: 40, l: 80, r: 20, b: 80 },
              annotations: corrMatrix.z.flatMap((row, i) => row.map((v, j) => ({ x: corrMatrix.labels[j], y: corrMatrix.labels[i], text: isFinite(v) ? v.toFixed(2) : '—', showarrow: false, font: { color: isDark ? '#fff' : '#000' } }))),
            })}
            config={{ responsive: true, displaylogo: false }}
          />
          <VizHelp text="Correlation matrix (Pearson r) among available variables; cell labels show the correlation value." />
        </div>
      )}

      {/* Leak charts if available */}
      {(corrMatrix.leakMed && corrMatrix.leakMed.length) ? (
        <div className="usage-charts-grid" style={{ marginTop: '16px' }}>
          <div className="chart-item chart-with-help">
            <Plot
              key={isDark ? 'dark-leak' : 'light-leak'}
              useResizeHandler
              style={{ width: '100%', height: '300px' }}
              data={[{ x: dates, y: corrMatrix.leakMed, type: 'scatter', mode: 'lines', name: 'Leak Median' }]}
              layout={applyChartTheme(isDark, {
                title: 'Leak Median Over Time',
                xaxis: { title: 'Date' },
                yaxis: { title: 'Leak (median)' },
                margin: { t: 40, l: 60, r: 20, b: 50 },
              })}
              config={{ responsive: true, displaylogo: false }}
            />
            <VizHelp text="Leak median over time if available; trends can indicate mask fit or seal issues." />
          </div>
          <div className="chart-item chart-with-help">
            <Plot
              key={isDark ? 'dark-leak-hist' : 'light-leak-hist'}
              useResizeHandler
              style={{ width: '100%', height: '300px' }}
              data={[{ x: corrMatrix.leakMed, type: 'histogram', nbinsx: 20 }]}
              layout={applyChartTheme(isDark, {
                title: 'Leak Median Distribution',
                xaxis: { title: 'Leak (median)' },
                yaxis: { title: 'Count' },
                margin: { t: 40, l: 60, r: 20, b: 50 },
              })}
              config={{ responsive: true, displaylogo: false }}
            />
            <VizHelp text="Distribution of nightly leak median values; helps identify consistent high-leak nights." />
          </div>
          {corrMatrix.leakPct && corrMatrix.leakPct.length ? (
            <div className="chart-item chart-with-help">
              <Plot
                key={isDark ? 'dark-leak-pct' : 'light-leak-pct'}
                useResizeHandler
                style={{ width: '100%', height: '300px' }}
                data={[{ x: dates, y: corrMatrix.leakPct, type: 'scatter', mode: 'lines', name: 'Leak % above thr' }]}
                layout={applyChartTheme(isDark, {
                  title: 'Time Above Leak Threshold (%)',
                  xaxis: { title: 'Date' },
                  yaxis: { title: 'Percent of night (%)' },
                  margin: { t: 40, l: 60, r: 20, b: 50 },
                })}
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
          <thead><tr><th>Group</th><th>n</th><th>Mean AHI</th></tr></thead>
          <tbody>
            <tr><td>EPAP &lt; 7</td><td>{titration.low.length}</td><td>{(titration.low.reduce((a,b)=>a+b,0)/(titration.low.length||1)).toFixed(2)}</td></tr>
            <tr><td>EPAP ≥ 7</td><td>{titration.high.length}</td><td>{(titration.high.reduce((a,b)=>a+b,0)/(titration.high.length||1)).toFixed(2)}</td></tr>
          </tbody>
        </table>
        <p>
          MW U = {isFinite(titration.U) ? titration.U.toFixed(1) : '—'},
          p{titration.method === 'exact' ? ' (exact)' : ' (normal)'} ≈ {isFinite(titration.p) ? titration.p.toExponential(2) : '—'},
          effect (rank-biserial) ≈ {isFinite(titration.effect) ? titration.effect.toFixed(2) : '—'}
          {isFinite(titration.effect_ci_low) && isFinite(titration.effect_ci_high)
            ? ` [${titration.effect_ci_low.toFixed(2)}, ${titration.effect_ci_high.toFixed(2)}]` : ''}
        </p>
      </div>
    </div>
  );
}
