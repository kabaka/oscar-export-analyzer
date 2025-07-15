import React, { useMemo } from 'react';
import Plot from 'react-plotly.js';
import { computeApneaEventStats } from '../utils/stats';

/**
 * Displays statistics and charts for individual apnea event durations
 * and their frequency per night to highlight anomalies and outliers.
 */
export default function ApneaEventStats({ data, width = 700, height = 300 }) {
  const stats = useMemo(() => computeApneaEventStats(data), [data]);
  if (!stats.totalEvents) {
    return null;
  }

  return (
    <div>
      <h2 id="apnea-characteristics">Apnea Event Characteristics</h2>
      <table>
        <tbody>
          <tr><td>Total apnea events</td><td>{stats.totalEvents}</td></tr>
          <tr><td>Median duration</td><td>{stats.medianDur.toFixed(1)} s</td></tr>
          <tr><td>Duration IQR (25th–75th percentile)</td><td>{stats.p25Dur.toFixed(1)}–{stats.p75Dur.toFixed(1)} s</td></tr>
          <tr><td>95th percentile duration</td><td>{stats.p95Dur.toFixed(1)} s</td></tr>
          <tr><td>Max duration</td><td>{stats.maxDur.toFixed(0)} s</td></tr>
          <tr><td>Events > 30 s</td><td>{stats.countOver30} ({(stats.countOver30 / stats.totalEvents * 100).toFixed(1)}%)</td></tr>
          <tr><td>Events > 60 s</td><td>{stats.countOver60} ({(stats.countOver60 / stats.totalEvents * 100).toFixed(1)}%)</td></tr>
          <tr><td>Outlier events (≥ Q3+1.5×IQR)</td><td>{stats.countOutlierEvents}</td></tr>
        </tbody>
      </table>
      <div className="usage-charts-grid">
        <div className="chart-item">
          <Plot
            useResizeHandler
            style={{ width: '100%', height: '300px' }}
            data={[{ x: stats.durations, type: 'histogram', nbinsx: 20, name: 'Duration Dist' }]}
            layout={{
              autosize: true,
              title: 'Distribution of Apnea Durations',
              xaxis: { title: 'Duration (s)' },
              yaxis: { title: 'Count' },
              margin: { t: 40, l: 60, r: 20, b: 50 },
            }}
          />
        </div>
        <div className="chart-item">
          <Plot
            useResizeHandler
            style={{ width: '100%', height: '300px' }}
            data={[{
              y: stats.durations,
              type: 'box',
              name: 'Duration Boxplot',
              boxpoints: 'outliers',
              marker: { color: '#888' },
            }]}
            layout={{
              autosize: true,
              title: 'Apnea Duration Boxplot',
              yaxis: { title: 'Duration (s)', zeroline: false },
              margin: { t: 40, l: 60, r: 20, b: 50 },
            }}
          />
        </div>
      </div>

      <h3>Apnea Events per Night</h3>
      <table>
        <tbody>
          <tr><td>Median events/night</td><td>{stats.medianNight.toFixed(1)}</td></tr>
          <tr><td>Events/night IQR (25th–75th)</td><td>{stats.p25Night.toFixed(1)}–{stats.p75Night.toFixed(1)}</td></tr>
          <tr><td>Min / Max events/night</td><td>{stats.minNight} / {stats.maxNight}</td></tr>
          <tr><td>High-count outlier nights (≥ Q3+1.5×IQR)</td><td>{stats.outlierNightHigh}</td></tr>
          <tr><td>Low-count outlier nights (≤ Q1−1.5×IQR)</td><td>{stats.outlierNightLow}</td></tr>
        </tbody>
      </table>
      <div className="usage-charts-grid">
        <div className="chart-item">
          <Plot
            useResizeHandler
            style={{ width: '100%', height: '300px' }}
            data={[{ x: stats.nightDates, y: stats.eventsPerNight, type: 'scatter', mode: 'lines', name: 'Events/night', line: { width: 1 } }]}
            layout={{
              autosize: true,
              title: 'Apnea Events per Night',
              xaxis: { title: 'Date' },
              yaxis: { title: 'Count' },
              margin: { t: 40, l: 60, r: 20, b: 50 },
            }}
          />
        </div>
        <div className="chart-item">
          <Plot
            useResizeHandler
            style={{ width: '100%', height: '300px' }}
            data={[{ x: stats.eventsPerNight, type: 'histogram', nbinsx: 12, name: 'Events/night Dist' }]}
            layout={{
              autosize: true,
              title: 'Distribution of Events per Night',
              xaxis: { title: 'Count' },
              yaxis: { title: 'Nights' },
              margin: { t: 40, l: 60, r: 20, b: 50 },
            }}
          />
        </div>
      </div>
    </div>
  );
}
