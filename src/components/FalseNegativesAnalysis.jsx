import React from 'react';
import { FALSE_NEG_PEAK_FLG_LEVEL_MIN } from '../utils/clustering';
import { GuideLink, ThemedPlot, VizHelp } from './ui';
import { HEADER_SCROLL_MARGIN_PX, PERCENT_SCALE } from '../constants';
import {
  FALSE_NEG_MARKER_DURATION_SCALE,
  FALSE_NEG_MARKER_MAX_SIZE,
  FALSE_NEG_MARKER_MIN_SIZE,
  FALSE_NEG_SCATTER_HEIGHT,
  FALSE_NEG_SCATTER_MARGIN,
} from '../constants/charts';

const PRESET_GAP_PX = 12;
const PRESET_MARGIN_BOTTOM_PX = HEADER_SCROLL_MARGIN_PX;
const PRESET_DESCRIPTION_OPACITY = 0.8;

function FalseNegativesAnalysis({ list, preset, onPresetChange }) {
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
          gap: `${PRESET_GAP_PX}px`,
          alignItems: 'center',
          marginBottom: `${PRESET_MARGIN_BOTTOM_PX}px`,
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
        <span style={{ opacity: PRESET_DESCRIPTION_OPACITY }}>
          Thresholds tuned for sensitivity/specificity
        </span>
      </div>
      <div>
        <h3>False Negative Clusters by Peak FLG Level Over Time</h3>
        <div className="chart-with-help">
          <ThemedPlot
            useResizeHandler
            style={{
              width: '100%',
              height: `${FALSE_NEG_SCATTER_HEIGHT}px`,
            }}
            data={[
              {
                type: 'scatter',
                mode: 'markers',
                x: list.map((cl) => cl.start),
                y: list.map((cl) => cl.peakFLGLevel * PERCENT_SCALE),
                marker: {
                  size: list.map((cl) =>
                    Math.max(
                      FALSE_NEG_MARKER_MIN_SIZE,
                      Math.min(
                        FALSE_NEG_MARKER_MAX_SIZE,
                        Math.sqrt(cl.durationSec) *
                          FALSE_NEG_MARKER_DURATION_SCALE,
                      ),
                    ),
                  ),
                  color: list.map((cl) => cl.peakFLGLevel * PERCENT_SCALE),
                  colorscale: 'Viridis',
                  showscale: true,
                  colorbar: { title: 'Peak FLG Level (%)' },
                },
                text: list.map(
                  (cl) =>
                    `Start: ${cl.start.toLocaleString()}<br>Duration: ${cl.durationSec.toFixed(0)} s<br>Peak FLG Level: ${(cl.peakFLGLevel * PERCENT_SCALE).toFixed(0)}%`,
                ),
                hovertemplate: '%{text}<extra></extra>',
              },
            ]}
            layout={{
              title: 'False Negative Clusters by Peak FLG Level Over Time',
              xaxis: { type: 'date', title: 'Cluster Start Time' },
              yaxis: {
                title: 'Peak FLG Level (%)',
                range: [
                  FALSE_NEG_PEAK_FLG_LEVEL_MIN * PERCENT_SCALE,
                  PERCENT_SCALE,
                ],
              },
              margin: { ...FALSE_NEG_SCATTER_MARGIN },
              height: FALSE_NEG_SCATTER_HEIGHT,
            }}
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
              <th>Peak FLG Level</th>
            </tr>
          </thead>
          <tbody>
            {list.map((cl, i) => (
              <tr key={cl.start.getTime()}>
                <td>{i + 1}</td>
                <td>{cl.start.toLocaleString()}</td>
                <td>{cl.durationSec.toFixed(0)}</td>
                <td>{(cl.peakFLGLevel * PERCENT_SCALE).toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default FalseNegativesAnalysis;
