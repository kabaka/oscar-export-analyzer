import React, { useMemo } from 'react';
import Plot from 'react-plotly.js';
import { parseDuration, quantile } from '../utils/stats';

export default function UsagePatternsCharts({ data, width = 700, height = 300 }) {
  // Prepare sorted date and usage arrays
  const { dates, usageHours, rollingAvg } = useMemo(() => {
    const pts = data
      .map(r => ({ date: new Date(r['Date']), hours: parseDuration(r['Total Time']) / 3600 }))
      .sort((a, b) => a.date - b.date);
    const hours = pts.map(p => p.hours);
    const datesArr = pts.map(p => p.date);
    const window = 7;
    const rolling = pts.map((p, i) => {
      const slice = hours.slice(Math.max(0, i - window + 1), i + 1);
      const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
      return avg;
    });
    return { dates: datesArr, usageHours: hours, rollingAvg: rolling };
  }, [data]);

  // Boxplot stats
  const p25 = quantile(usageHours, 0.25);
  const median = quantile(usageHours, 0.5);
  const p75 = quantile(usageHours, 0.75);
  const iqr = p75 - p25;

  return (
    <div className="usage-charts">
      <Plot
        data={[
          { x: dates, y: usageHours, type: 'scatter', mode: 'lines+markers', name: 'Usage (hrs)' },
          { x: dates, y: rollingAvg, type: 'scatter', mode: 'lines', name: '7-night Avg', line: { dash: 'dash' } },
        ]}
        layout={{
          title: 'Nightly Usage Hours Over Time',
          xaxis: { title: 'Date' },
          yaxis: { title: 'Hours of Use' },
          margin: { t: 40, l: 60, r: 20, b: 50 },
          width,
          height,
        }}
      />
      <Plot
        data={[{ x: usageHours, type: 'histogram', nbinsx: 12, name: 'Usage Distribution' }]}
        layout={{
          title: 'Distribution of Nightly Usage',
          xaxis: { title: 'Hours' },
          yaxis: { title: 'Count' },
          margin: { t: 40, l: 60, r: 20, b: 50 },
          width,
          height,
        }}
      />
      <Plot
        data={[{
          y: usageHours,
          type: 'box',
          name: 'Usage Boxplot',
          boxpoints: 'outliers',
          marker: { color: '#888' },
        }]}
        layout={{
          title: 'Boxplot of Nightly Usage',
          yaxis: { title: 'Hours of Use', zeroline: false },
          margin: { t: 40, l: 60, r: 20, b: 50 },
          width,
          height: height * 0.6,
        }}
      />
    </div>
  );
}
