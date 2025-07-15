import React, { useMemo } from 'react';
import Plot from 'react-plotly.js';
import { quantile } from '../utils/stats';
import { COLORS } from '../utils/colors';

export default function AhiTrendsCharts({ data, width = 700, height = 300 }) {
  const { dates, ahis, rollingAvg } = useMemo(() => {
    const pts = data
      .map(r => ({ date: new Date(r['Date']), ahi: parseFloat(r['AHI']) }))
      .filter(p => !isNaN(p.ahi))
      .sort((a, b) => a.date - b.date);
    const datesArr = pts.map(p => p.date);
    const ahisArr = pts.map(p => p.ahi);
    const window = 7;
    const rolling = ahisArr.map((v, i) => {
      const slice = ahisArr.slice(Math.max(0, i - window + 1), i + 1);
      return slice.reduce((a, b) => a + b, 0) / slice.length;
    });
    return {
      dates: datesArr,
      ahis: ahisArr,
      rollingAvg: rolling,
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

  return (
    <div className="usage-charts">
      <Plot
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
            y: rollingAvg,
            type: 'scatter',
            mode: 'lines',
            name: '7-night Avg',
            line: { dash: 'dash', width: 2, color: COLORS.secondary },
          },
        ]}
        layout={{
          autosize: true,
          title: 'Nightly AHI Over Time',
          legend: { orientation: 'h', x: 0.5, xanchor: 'center' },
          shapes: [
            { type: 'line', xref: 'paper', x0: 0, x1: 1, y0: 5, y1: 5, line: { color: COLORS.threshold, dash: 'dashdot' } },
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
            useResizeHandler
            style={{ width: '100%', height: '300px' }}
            data={[
              { x: ahis, type: 'histogram', nbinsx: nbins, name: 'AHI Distribution', marker: { color: COLORS.primary } },
            ]}
            layout={{
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
              autosize: true,
              title: 'Boxplot of Nightly AHI',
              yaxis: { title: 'AHI (events/hour)', zeroline: false },
              margin: { t: 40, l: 60, r: 20, b: 50 },
            }}
          />
        </div>
      </div>
    </div>
  );
}
