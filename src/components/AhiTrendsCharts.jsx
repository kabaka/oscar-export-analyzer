import React, { useMemo } from 'react';
import Plot from 'react-plotly.js';
import { quantile, detectUsageBreakpoints, computeUsageRolling } from '../utils/stats';
import { COLORS } from '../utils/colors';
import { useEffectiveDarkMode } from '../hooks/useEffectiveDarkMode';

export default function AhiTrendsCharts({ data, clusters = [], width = 700, height = 300 }) {
  const { dates, ahis, rolling7, rolling30, breakDates, oai, cai, mai } = useMemo(() => {
    const pts = data
      .map(r => ({ date: new Date(r['Date']), ahi: parseFloat(r['AHI']) }))
      .filter(p => !isNaN(p.ahi))
      .sort((a, b) => a.date - b.date);
    const datesArr = pts.map(p => p.date);
    const ahisArr = pts.map(p => p.ahi);
    const rolling = computeUsageRolling(datesArr, ahisArr, [7, 30]);
    const rolling7 = rolling.avg7;
    const rolling30 = rolling.avg30;
    const breakDates = detectUsageBreakpoints(rolling7, rolling30, datesArr, 0.5);

    // Optional decomposition if columns present
    const keys = data.length ? Object.keys(data[0]) : [];
    const oaiKey = keys.find(k => /obstructive/i.test(k) && /index/i.test(k));
    const caiKey = keys.find(k => /central/i.test(k) && /index/i.test(k));
    const maiKey = keys.find(k => /mixed/i.test(k) && /index/i.test(k));
    const compose = key => data
      .map(r => ({ date: new Date(r['Date']), val: parseFloat(r[key]) }))
      .filter(p => !isNaN(p.val))
      .sort((a, b) => a.date - b.date);
    const oaiPts = oaiKey ? compose(oaiKey) : [];
    const caiPts = caiKey ? compose(caiKey) : [];
    const maiPts = maiKey ? compose(maiKey) : [];
    const oai = oaiPts.length === datesArr.length ? oaiPts.map(p => p.val) : null;
    const cai = caiPts.length === datesArr.length ? caiPts.map(p => p.val) : null;
    const mai = maiPts.length === datesArr.length ? maiPts.map(p => p.val) : null;
    return {
      dates: datesArr,
      ahis: ahisArr,
      rolling7,
      rolling30,
      breakDates,
      oai, cai, mai,
    };
  }, [data]);

  // Summary stats and adaptive histogram bins
  const p25 = quantile(ahis, 0.25);
  const median = quantile(ahis, 0.5);
  const p75 = quantile(ahis, 0.75);
  const iqr = p75 - p25;
  const mean = ahis.reduce((sum, v) => sum + v, 0) / ahis.length;
  const binWidth = 2 * iqr * Math.pow(ahis.length, -1 / 3);
  const range = Math.max(...ahis) - Math.min(...ahis);
  const nbins = binWidth > 0 ? Math.ceil(range / binWidth) : 12;

  const isDark = useEffectiveDarkMode();

  // Severity bands counts
  const bands = {
    le5: ahis.filter(v => v <= 5).length,
    b5_15: ahis.filter(v => v > 5 && v <= 15).length,
    b15_30: ahis.filter(v => v > 15 && v <= 30).length,
    gt30: ahis.filter(v => v > 30).length,
  };

  // QQ-plot against normal
  const n = ahis.length;
  const sorted = ahis.slice().sort((a, b) => a - b);
  const mu = sorted.reduce((s, v) => s + v, 0) / n;
  const sigma = Math.sqrt(sorted.reduce((s, v) => s + (v - mu) ** 2, 0) / Math.max(1, n - 1));
  const probs = sorted.map((_, i) => (i + 1) / (n + 1));
  const normalQuantile = p => {
    // Beasley-Springer/Moro approx via inverse error function
    const a = [2.50662823884, -18.61500062529, 41.39119773534, -25.44106049637];
    const b = [-8.47351093090, 23.08336743743, -21.06224101826, 3.13082909833];
    const c = [0.3374754822726147, 0.9761690190917186, 0.1607979714918209, 0.0276438810333863, 0.0038405729373609, 0.0003951896511919, 0.0000321767881768, 0.0000002888167364, 0.0000003960315187];
    const y = p - 0.5;
    if (Math.abs(y) < 0.42) {
      const r = y * y;
      const num = y * (((a[3] * r + a[2]) * r + a[1]) * r + a[0]);
      const den = (((b[3] * r + b[2]) * r + b[1]) * r + b[0]) * r + 1;
      return num / den;
    }
    let r = p;
    if (y > 0) r = 1 - p;
    r = Math.log(-Math.log(r));
    let x = c[0] + r * (c[1] + r * (c[2] + r * (c[3] + r * (c[4] + r * (c[5] + r * (c[6] + r * (c[7] + r * c[8])))))));
    return y < 0 ? -x : x;
  };
  const theo = probs.map(p => mu + sigma * normalQuantile(p));

  // Bad-night tagging with explanations
  const p25b = quantile(ahis, 0.25);
  const p75b = quantile(ahis, 0.75);
  const iqrb = p75b - p25b;
  const outlierHighCut = p75b + 1.5 * iqrb;
  const dateStr = (d) => d.toISOString().slice(0, 10);
  const clusterByNight = new Map();
  clusters.forEach(cl => {
    const k = dateStr(cl.start);
    const prev = clusterByNight.get(k) || { maxDur: 0, maxCount: 0 };
    clusterByNight.set(k, { maxDur: Math.max(prev.maxDur, cl.durationSec), maxCount: Math.max(prev.maxCount, cl.count) });
  });
  const badNights = [];
  dates.forEach((d, i) => {
    const reasons = [];
    if (ahis[i] >= 15 || ahis[i] >= outlierHighCut) reasons.push('High AHI');
    if (oai && cai && mai) {
      const total = (oai[i] || 0) + (cai[i] || 0) + (mai[i] || 0);
      const fracCA = total ? (cai[i] / total) : 0;
      if (ahis[i] > 5 && fracCA >= 0.6) reasons.push('High CA%');
    }
    const cl = clusterByNight.get(dateStr(d));
    if (cl && (cl.maxDur >= 120 || cl.maxCount >= 5)) reasons.push('Long/dense cluster');
    if (reasons.length) badNights.push({ date: d, ahi: ahis[i], reasons });
  });

  return (
    <div className="usage-charts">
      <Plot
        key={isDark ? 'dark' : 'light'}
        useResizeHandler
        style={{ width: '100%', height: '300px' }}
        data={[
          {
            x: dates,
            y: ahis,
            type: 'scatter',
            mode: 'lines',
            name: 'Nightly AHI',
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
          ...(oai && cai && mai ? [
            { x: dates, y: oai, type: 'scatter', mode: 'lines', name: 'OAI', stackgroup: 'ahi', line: { width: 0 }, fillcolor: 'rgba(31,119,180,0.4)' },
            { x: dates, y: cai, type: 'scatter', mode: 'lines', name: 'CAI', stackgroup: 'ahi', line: { width: 0 }, fillcolor: 'rgba(255,127,14,0.4)' },
            { x: dates, y: mai, type: 'scatter', mode: 'lines', name: 'MAI', stackgroup: 'ahi', line: { width: 0 }, fillcolor: 'rgba(44,160,44,0.4)' },
          ] : []),
        ]}
        layout={{
          template: isDark ? 'plotly_dark' : 'plotly',
          autosize: true,
          title: 'Nightly AHI Over Time',
          legend: { orientation: 'h', x: 0.5, xanchor: 'center' },
          shapes: [
            { type: 'line', xref: 'paper', x0: 0, x1: 1, y0: 5, y1: 5, line: { color: COLORS.threshold, dash: 'dashdot' } },
            ...(breakDates || []).map(d => ({ type: 'line', x0: d, x1: d, yref: 'paper', y0: 0, y1: 1, line: { color: '#aa3377', width: 1, dash: 'dot' } })),
          ],
          annotations: [
            { xref: 'paper', x: 1, y: 5, xanchor: 'left', text: 'AHI threshold (5)', showarrow: false, font: { color: COLORS.threshold } },
          ],
          xaxis: { title: 'Date' },
          yaxis: { title: 'AHI (events/hour)' },
          margin: { t: 40, l: 60, r: 20, b: 50 },
        }}
        config={{
          responsive: true,
          displaylogo: false,
          modeBarButtonsToAdd: ['toImage'],
          toImageButtonOptions: { format: 'svg', filename: 'ahi_over_time' },
        }}
      />

      <div className="usage-charts-grid">
        <div className="chart-item">
          <Plot
            key={isDark ? 'dark-hist' : 'light-hist'}
            useResizeHandler
            style={{ width: '100%', height: '300px' }}
            data={[
              { x: ahis, type: 'histogram', nbinsx: nbins, name: 'AHI Distribution', marker: { color: COLORS.primary } },
            ]}
            layout={{
              template: isDark ? 'plotly_dark' : 'plotly',
              autosize: true,
              title: 'Distribution of Nightly AHI',
              legend: { orientation: 'h', x: 0.5, xanchor: 'center' },
              shapes: [
                { type: 'line', x0: median, x1: median, yref: 'paper', y0: 0, y1: 1, line: { color: COLORS.secondary, dash: 'dash' } },
                { type: 'line', x0: mean, x1: mean, yref: 'paper', y0: 0, y1: 1, line: { color: COLORS.accent, dash: 'dot' } },
              ],
              annotations: [
                { x: median, yref: 'paper', y: 1.05, text: `Median: ${median.toFixed(2)}`, showarrow: false, font: { color: COLORS.secondary } },
                { x: mean, yref: 'paper', y: 1.1, text: `Mean: ${mean.toFixed(2)}`, showarrow: false, font: { color: COLORS.accent } },
              ],
              xaxis: { title: 'AHI (events/hour)' },
              yaxis: { title: 'Count' },
              margin: { t: 40, l: 60, r: 20, b: 50 },
            }}
            config={{
              responsive: true,
              displaylogo: false,
              modeBarButtonsToAdd: ['toImage'],
              toImageButtonOptions: { format: 'svg', filename: 'ahi_distribution' },
            }}
          />
        </div>
        <div className="chart-item">
          <Plot
            key={isDark ? 'dark-box' : 'light-box'}
            useResizeHandler
            style={{ width: '100%', height: '300px' }}
            data={[{
              y: ahis,
              type: 'box',
              name: 'AHI Boxplot',
              boxpoints: 'outliers',
              marker: { color: '#888' },
            }]}
            layout={{
              template: isDark ? 'plotly_dark' : 'plotly',
              autosize: true,
              title: 'Boxplot of Nightly AHI',
              yaxis: { title: 'AHI (events/hour)', zeroline: false },
              margin: { t: 40, l: 60, r: 20, b: 50 },
            }}
          />
        </div>
      </div>
      <div className="usage-charts-grid">
        <div className="chart-item">
          <Plot
            key={isDark ? 'dark-violin' : 'light-violin'}
            useResizeHandler
            style={{ width: '100%', height: '300px' }}
            data={[{ y: ahis, type: 'violin', name: 'AHI Violin', points: 'outliers', box: { visible: true } }]}
            layout={{
              template: isDark ? 'plotly_dark' : 'plotly',
              autosize: true,
              title: 'Violin Plot of Nightly AHI',
              yaxis: { title: 'AHI (events/hour)' },
              margin: { t: 40, l: 60, r: 20, b: 50 },
            }}
          />
        </div>
        <div className="chart-item">
          <Plot
            useResizeHandler
            style={{ width: '100%', height: '300px' }}
            data={[{ x: theo, y: sorted, type: 'scatter', mode: 'markers', name: 'QQ Points', marker: { size: 5, opacity: 0.7 } }, { x: [Math.min(...theo), Math.max(...theo)], y: [Math.min(...theo), Math.max(...theo)], type: 'scatter', mode: 'lines', name: 'y=x', line: { dash: 'dash' } }]}
            layout={{
              template: isDark ? 'plotly_dark' : 'plotly',
              autosize: true,
              title: 'QQ Plot vs Normal',
              xaxis: { title: 'Theoretical Quantiles' },
              yaxis: { title: 'Observed AHI Quantiles' },
              margin: { t: 40, l: 60, r: 20, b: 50 },
            }}
          />
        </div>
      </div>

      {/* Severity bands summary */}
      <div className="section" style={{ marginTop: '8px' }}>
        <h4>Severity Bands</h4>
        <table>
          <thead><tr><th>Band</th><th>Nights</th><th>Percent</th></tr></thead>
          <tbody>
            <tr><td>≤ 5</td><td>{bands.le5}</td><td>{((bands.le5 / ahis.length) * 100).toFixed(0)}%</td></tr>
            <tr><td>5–15</td><td>{bands.b5_15}</td><td>{((bands.b5_15 / ahis.length) * 100).toFixed(0)}%</td></tr>
            <tr><td>15–30</td><td>{bands.b15_30}</td><td>{((bands.b15_30 / ahis.length) * 100).toFixed(0)}%</td></tr>
            <tr><td>&gt; 30</td><td>{bands.gt30}</td><td>{((bands.gt30 / ahis.length) * 100).toFixed(0)}%</td></tr>
          </tbody>
        </table>
      </div>

      {badNights.length ? (
        <div className="section" style={{ marginTop: '8px' }}>
          <h4>Bad Nights (top 10)</h4>
          <table>
            <thead><tr><th>Date</th><th>AHI</th><th>Reasons</th></tr></thead>
            <tbody>
              {badNights.slice(0, 10).map((b, i) => (
                <tr key={i}><td>{b.date.toISOString().slice(0,10)}</td><td>{b.ahi.toFixed(2)}</td><td>{b.reasons.join(', ')}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

    </div>
  );
}
