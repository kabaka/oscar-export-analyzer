import React from 'react';
import Plot from 'react-plotly.js';
import { FALSE_NEG_CONFIDENCE_MIN } from '../utils/clustering';
import { applyChartTheme } from '../utils/chartTheme';
import { useEffectiveDarkMode } from '../hooks/useEffectiveDarkMode';
import GuideLink from './GuideLink';
import VizHelp from './VizHelp';

function FalseNegativesAnalysis({ list, preset, onPresetChange }) {
  const prefersDark = useEffectiveDarkMode();
  return (
    <div>
      <h2 id="false-negatives">
        Potential False Negatives{' '}
        <GuideLink
          anchor="potential-false-negatives-details-csv"
          label="Guide"
        />
      </h2>
      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <label>
          Preset:
          <select
            value={preset}
            onChange={(e) => onPresetChange?.(e.target.value)}
          >
            <option value="strict">Strict</option>
            <option value="balanced">Balanced</option>
            <option value="lenient">Lenient</option>
          </select>
        </label>
        <span style={{ opacity: 0.8 }}>
          Thresholds tuned for sensitivity/specificity
        </span>
      </div>
      <div>
        <h3>False Negative Clusters by Confidence Over Time</h3>
        <div className="chart-with-help">
          <Plot
            key={prefersDark ? 'dark-fn' : 'light-fn'}
            useResizeHandler
            style={{ width: '100%', height: '400px' }}
            data={[
              {
                type: 'scatter',
                mode: 'markers',
                x: list.map((cl) => cl.start),
                y: list.map((cl) => cl.confidence * 100),
                marker: {
                  size: list.map((cl) =>
                    Math.max(6, Math.min(20, Math.sqrt(cl.durationSec) * 5))
                  ),
                  color: list.map((cl) => cl.confidence * 100),
                  colorscale: 'Viridis',
                  showscale: true,
                  colorbar: { title: 'Confidence (%)' },
                },
                text: list.map(
                  (cl) =>
                    `Start: ${cl.start.toLocaleString()}<br>Duration: ${cl.durationSec.toFixed(0)} s<br>Confidence: ${(cl.confidence * 100).toFixed(0)}%`
                ),
                hovertemplate: '%{text}<extra></extra>',
              },
            ]}
            layout={applyChartTheme(prefersDark, {
              title: 'False Negative Clusters by Confidence Over Time',
              xaxis: { type: 'date', title: 'Cluster Start Time' },
              yaxis: {
                title: 'Confidence (%)',
                range: [FALSE_NEG_CONFIDENCE_MIN * 100, 100],
              },
              margin: { l: 80, r: 20, t: 40, b: 40 },
              height: 400,
            })}
            config={{ responsive: true, displaylogo: false }}
          />
          <VizHelp text="Each dot is a potential false-negative cluster. Position shows time and confidence; marker size scales with duration and color encodes confidence." />
        </div>
      </div>
      <div className="cluster-table-container">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Start</th>
              <th>Duration (s)</th>
              <th>Confidence</th>
            </tr>
          </thead>
          <tbody>
            {list.map((cl, i) => (
              <tr key={cl.start.getTime()}>
                <td>{i + 1}</td>
                <td>{cl.start.toLocaleString()}</td>
                <td>{cl.durationSec.toFixed(0)}</td>
                <td>{(cl.confidence * 100).toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default FalseNegativesAnalysis;
