import React, { useMemo } from 'react';
import Plot from 'react-plotly.js';
import { COLORS } from '../utils/colors';
import { useEffectiveDarkMode } from '../hooks/useEffectiveDarkMode';
import { mannWhitneyUTest, pearson } from '../utils/stats';

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
      <Plot
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
          template: isDark ? 'plotly_dark' : 'plotly',
          autosize: true,
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

      <div className="usage-charts-grid">
        <div className="chart-item">
        <Plot
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
            template: isDark ? 'plotly_dark' : 'plotly',
            autosize: true,
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
        </div>
        <div className="chart-item">
          <Plot
            useResizeHandler
            style={{ width: '100%', height: '300px' }}
            data={[
              { x: epapAhiPairs.map(p => p.epap), y: epapAhiPairs.map(p => p.ahi), type: 'scatter', mode: 'markers', name: 'Data', marker: { size: 6, opacity: 0.7, color: COLORS.primary } },
              { x: [boxMin, boxMax], y: [slope * boxMin + intercept, slope * boxMax + intercept], type: 'scatter', mode: 'lines', name: 'Fit', line: { dash: 'dash', width: 2, color: COLORS.secondary } },
            ]}
            layout={{
              template: isDark ? 'plotly_dark' : 'plotly',
              autosize: true,
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
              toImageButtonOptions: { format: 'svg', filename: 'epap_vs_ahi_scatter' },
            }}
          />
      </div>
        <div className="chart-item">
          <Plot
            useResizeHandler
            style={{ width: '100%', height: '300px' }}
            data={[{ x: epapAhiPairs.map(p => p.epap), y: epapAhiPairs.map(p => p.ahi), type: 'histogram2d', colorscale: 'Viridis' }]}
            layout={{
              template: isDark ? 'plotly_dark' : 'plotly',
              autosize: true,
              title: 'EPAP vs AHI Density (2D Histogram)',
              xaxis: { title: 'Median EPAP (cmH₂O)' },
              yaxis: { title: 'AHI (events/hour)' },
              margin: { t: 40, l: 60, r: 20, b: 50 },
            }}
            config={{ responsive: true, displaylogo: false }}
          />
        </div>
      </div>

      {corrMatrix.labels.length >= 2 && (
        <div className="chart-item" style={{ marginTop: '16px' }}>
          <Plot
            useResizeHandler
            style={{ width: '100%', height: '300px' }}
            data={[{ z: corrMatrix.z, x: corrMatrix.labels, y: corrMatrix.labels, type: 'heatmap', colorscale: 'RdBu', zmin: -1, zmax: 1, reversescale: true }]}
            layout={{
              template: isDark ? 'plotly_dark' : 'plotly',
              title: 'Correlation Matrix (Pearson r)',
              autosize: true,
              margin: { t: 40, l: 80, r: 20, b: 80 },
              annotations: corrMatrix.z.flatMap((row, i) => row.map((v, j) => ({ x: corrMatrix.labels[j], y: corrMatrix.labels[i], text: isFinite(v) ? v.toFixed(2) : '—', showarrow: false, font: { color: '#fff' } }))),
            }}
            config={{ responsive: true, displaylogo: false }}
          />
        </div>
      )}

      {/* Leak charts if available */}
      {(corrMatrix.leakMed && corrMatrix.leakMed.length) ? (
        <div className="usage-charts-grid" style={{ marginTop: '16px' }}>
          <div className="chart-item">
            <Plot
              useResizeHandler
              style={{ width: '100%', height: '300px' }}
              data={[{ x: dates, y: corrMatrix.leakMed, type: 'scatter', mode: 'lines', name: 'Leak Median' }]}
              layout={{
                template: isDark ? 'plotly_dark' : 'plotly',
                autosize: true,
                title: 'Leak Median Over Time',
                xaxis: { title: 'Date' },
                yaxis: { title: 'Leak (median)' },
                margin: { t: 40, l: 60, r: 20, b: 50 },
              }}
              config={{ responsive: true, displaylogo: false }}
            />
          </div>
          <div className="chart-item">
            <Plot
              useResizeHandler
              style={{ width: '100%', height: '300px' }}
              data={[{ x: corrMatrix.leakMed, type: 'histogram', nbinsx: 20 }]}
              layout={{
                template: isDark ? 'plotly_dark' : 'plotly',
                autosize: true,
                title: 'Leak Median Distribution',
                xaxis: { title: 'Leak (median)' },
                yaxis: { title: 'Count' },
                margin: { t: 40, l: 60, r: 20, b: 50 },
              }}
              config={{ responsive: true, displaylogo: false }}
            />
          </div>
          {corrMatrix.leakPct && corrMatrix.leakPct.length ? (
            <div className="chart-item">
              <Plot
                useResizeHandler
                style={{ width: '100%', height: '300px' }}
                data={[{ x: dates, y: corrMatrix.leakPct, type: 'scatter', mode: 'lines', name: 'Leak % above thr' }]}
                layout={{
                  template: isDark ? 'plotly_dark' : 'plotly',
                  autosize: true,
                  title: 'Time Above Leak Threshold (%)',
                  xaxis: { title: 'Date' },
                  yaxis: { title: 'Percent of night (%)' },
                  margin: { t: 40, l: 60, r: 20, b: 50 },
                }}
                config={{ responsive: true, displaylogo: false }}
              />
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
        <p>MW U = {isFinite(titration.U) ? titration.U.toFixed(1) : '—'}, p ≈ {isFinite(titration.p) ? titration.p.toExponential(2) : '—'}, effect (rank-biserial) ≈ {isFinite(titration.effect) ? titration.effect.toFixed(2) : '—'}</p>
      </div>
    </div>
  );
}
