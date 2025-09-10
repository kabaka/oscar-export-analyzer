import React, { useMemo } from 'react';
import { computeApneaEventStats, kmSurvival } from '../utils/stats';
import { useData } from '../context/DataContext';
import ThemedPlot from './ThemedPlot';
import VizHelp from './VizHelp';
import GuideLink from './GuideLink';

/**
 * Displays statistics and charts for individual apnea event durations
 * and their frequency per night to highlight anomalies and outliers.
 */
export default function ApneaEventStats() {
  const { filteredDetails: data } = useData();
  const stats = useMemo(() => computeApneaEventStats(data || []), [data]);
  const km = useMemo(
    () => kmSurvival(stats.durations || []),
    [stats.durations],
  );
  if (!stats.totalEvents) {
    return null;
  }

  return (
    <div>
      <h2 id="apnea-characteristics">
        Apnea Event Characteristics{' '}
        <GuideLink
          anchor="apnea-event-characteristics-details-csv"
          label="Guide"
        />
      </h2>
      <table>
        <tbody>
          <tr>
            <td>Total apnea events</td>
            <td>{stats.totalEvents}</td>
          </tr>
          <tr>
            <td>Median duration</td>
            <td>{stats.medianDur.toFixed(1)} s</td>
          </tr>
          <tr>
            <td>Duration IQR (25th–75th percentile)</td>
            <td>
              {stats.p25Dur.toFixed(1)}–{stats.p75Dur.toFixed(1)} s
            </td>
          </tr>
          <tr>
            <td>95th percentile duration</td>
            <td>{stats.p95Dur.toFixed(1)} s</td>
          </tr>
          <tr>
            <td>Max duration</td>
            <td>{stats.maxDur.toFixed(0)} s</td>
          </tr>
          <tr>
            <td>Events &gt; 30 s</td>
            <td>
              {stats.countOver30} (
              {((stats.countOver30 / stats.totalEvents) * 100).toFixed(1)}%)
            </td>
          </tr>
          <tr>
            <td>Events &gt; 60 s</td>
            <td>
              {stats.countOver60} (
              {((stats.countOver60 / stats.totalEvents) * 100).toFixed(1)}%)
            </td>
          </tr>
          <tr>
            <td>Outlier events (≥ Q3+1.5×IQR)</td>
            <td>{stats.countOutlierEvents}</td>
          </tr>
        </tbody>
      </table>
      <div className="usage-charts-grid">
        <div className="chart-item chart-with-help">
          <ThemedPlot
            useResizeHandler
            style={{ width: '100%', height: '300px' }}
            data={[
              {
                x: stats.durations,
                type: 'histogram',
                nbinsx: 20,
                name: 'Duration Dist',
              },
            ]}
            layout={{
              title: 'Distribution of Apnea Durations',
              xaxis: { title: 'Duration (s)' },
              yaxis: { title: 'Count' },
              margin: { t: 40, l: 60, r: 20, b: 50 },
            }}
          />
          <VizHelp text="Distribution of individual apnea event durations. Helps spot unusually long events." />
        </div>
        <div className="chart-item chart-with-help">
          <ThemedPlot
            useResizeHandler
            style={{ width: '100%', height: '300px' }}
            data={[
              {
                y: stats.durations,
                type: 'box',
                name: 'Duration Boxplot',
                boxpoints: 'outliers',
                marker: { color: '#888' },
              },
            ]}
            layout={{
              title: 'Apnea Duration Boxplot',
              yaxis: { title: 'Duration (s)', zeroline: false },
              margin: { t: 40, l: 60, r: 20, b: 50 },
            }}
          />
          <VizHelp text="Boxplot of apnea event durations; box shows IQR, whiskers typical range, points outliers." />
        </div>
      </div>

      <div className="chart-item chart-with-help">
        <ThemedPlot
          useResizeHandler
          style={{ width: '100%', height: '300px' }}
          data={[
            // CI ribbon
            {
              x: km.times,
              y: km.lower,
              type: 'scatter',
              mode: 'lines',
              name: 'Survival CI low',
              line: { width: 0 },
              hoverinfo: 'skip',
              showlegend: false,
            },
            {
              x: km.times,
              y: km.upper,
              type: 'scatter',
              mode: 'lines',
              name: 'Survival CI',
              fill: 'tonexty',
              fillcolor: 'rgba(31,119,180,0.15)',
              line: { width: 0 },
              hoverinfo: 'skip',
              showlegend: true,
            },
            // Survival step
            {
              x: km.times,
              y: km.survival,
              type: 'scatter',
              mode: 'lines',
              name: 'KM Survival',
              line: { width: 2, color: '#1f77b4', shape: 'hv' },
            },
          ]}
          layout={{
            title: 'Apnea Event Duration Survival (KM)',
            xaxis: { title: 'Duration (s)' },
            yaxis: { title: 'Survival P(T > t)', rangemode: 'tozero' },
            margin: { t: 40, l: 60, r: 20, b: 50 },
          }}
          config={{ responsive: true, displaylogo: false }}
        />
        <VizHelp text="KaplanâMeier survival of event durations (probability an event exceeds t seconds). Shaded band is the approximate 95% CI." />
      </div>

      <h3>Apnea Events per Night</h3>
      <table>
        <tbody>
          <tr>
            <td>Median events/night</td>
            <td>{stats.medianNight.toFixed(1)}</td>
          </tr>
          <tr>
            <td>Events/night IQR (25thâ75th)</td>
            <td>
              {stats.p25Night.toFixed(1)}â{stats.p75Night.toFixed(1)}
            </td>
          </tr>
          <tr>
            <td>Min / Max events/night</td>
            <td>
              {stats.minNight} / {stats.maxNight}
            </td>
          </tr>
          <tr>
            <td>High-count outlier nights (â¥ Q3+1.5ÃIQR)</td>
            <td>{stats.outlierNightHigh}</td>
          </tr>
          <tr>
            <td>Low-count outlier nights (â¤ Q1â1.5ÃIQR)</td>
            <td>{stats.outlierNightLow}</td>
          </tr>
        </tbody>
      </table>
      <div className="usage-charts-grid">
        <div className="chart-item chart-with-help">
          <ThemedPlot
            useResizeHandler
            style={{ width: '100%', height: '300px' }}
            data={[
              {
                x: stats.nightDates,
                y: stats.eventsPerNight,
                type: 'scatter',
                mode: 'lines',
                name: 'Events/night',
                line: { width: 1 },
              },
            ]}
            layout={{
              title: 'Apnea Events per Night',
              xaxis: { title: 'Date' },
              yaxis: { title: 'Count' },
              margin: { t: 40, l: 60, r: 20, b: 50 },
            }}
          />
          <VizHelp text="Events per night over time; look for spikes that may indicate rough nights." />
        </div>
        <div className="chart-item chart-with-help">
          <ThemedPlot
            useResizeHandler
            style={{ width: '100%', height: '300px' }}
            data={[
              {
                x: stats.eventsPerNight,
                type: 'histogram',
                nbinsx: 12,
                name: 'Events/night Dist',
              },
            ]}
            layout={{
              title: 'Distribution of Events per Night',
              xaxis: { title: 'Count' },
              yaxis: { title: 'Nights' },
              margin: { t: 40, l: 60, r: 20, b: 50 },
            }}
          />
          <VizHelp text="Distribution of nightly event counts; the shape shows how often high/low event nights occur." />
        </div>
      </div>
    </div>
  );
}
