import React, { useMemo } from 'react';
import Plot from 'react-plotly.js';
import { quantile } from '../utils/stats';

export default function AhiTrendsCharts({ data, width = 700, height = 300 }) {
  const { dates, ahis, rollingAvg, above5Dates, ahisAbove5 } = useMemo(() => {
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
    const abovePts = pts.filter(p => p.ahi > 5);
    return {
      dates: datesArr,
      ahis: ahisArr,
      rollingAvg: rolling,
      above5Dates: abovePts.map(p => p.date),
      ahisAbove5: abovePts.map(p => p.ahi),
    };
  }, [data]);

  const p25 = quantile(ahis, 0.25);
  const median = quantile(ahis, 0.5);
  const p75 = quantile(ahis, 0.75);

  return (
    <div className="usage-charts">
      <Plot
        useResizeHandler
        style={{ width: '100%', height: '300px' }}
        data={[
          { x: dates, y: ahis, type: 'scatter', mode: 'lines+markers', name: 'Nightly AHI' },
          { x: dates, y: rollingAvg, type: 'scatter', mode: 'lines', name: '7-night Avg', line: { dash: 'dash' } },
          { x: above5Dates, y: ahisAbove5, type: 'scatter', mode: 'markers', name: 'AHI > 5', marker: { color: 'red', size: 8 } },
        ]}
        layout={{
          autosize: true,
          title: 'Nightly AHI Over Time',
          xaxis: { title: 'Date' },
          yaxis: { title: 'AHI (events/hour)' },
          margin: { t: 40, l: 60, r: 20, b: 50 },
        }}
      />

      <div className="usage-charts-grid">
        <div className="chart-item">
          <Plot
            useResizeHandler
            style={{ width: '100%', height: '300px' }}
            data={[{ x: ahis, type: 'histogram', nbinsx: 12, name: 'AHI Distribution' }]}
            layout={{
              autosize: true,
              title: 'Distribution of Nightly AHI',
              xaxis: { title: 'AHI (events/hour)' },
              yaxis: { title: 'Count' },
              margin: { t: 40, l: 60, r: 20, b: 50 },
            }}
          />
        </div>
        <div className="chart-item">
          <Plot
            useResizeHandler
            style={{ width: '100%', height: '250px' }}
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
