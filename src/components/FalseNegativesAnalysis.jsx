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

/**
 * Analyzes and visualizes potential false negatives (missed apnea events) in CPAP data.
 *
 * False negatives are apnea events that may have been missed or under-detected by the CPAP device.
 * This component detects cluster patterns using three sensitivity presets:
 * - **Strict**: Highest specificity, most likely real missed events (conservative threshold)
 * - **Balanced**: Medium sensitivity/specificity trade-off (recommended for most users)
 * - **Lenient**: Highest sensitivity, includes more potential false negatives (exploratory)
 *
 * Features:
 * - Scatter plot of false negative clusters over time
 * - Cluster sizing by duration (longer clusters appear larger)
 * - Color-coding by peak Flow Limitation Grade (FLG) level
 * - Hover tooltips showing cluster duration, count, peak FLG level, and date
 * - Preset selector to adjust detection thresholds interactively
 * - Multiple analysis views: Peak FLG distribution, temporal patterns, cluster characteristics
 * - Integration with apnea cluster data for comprehensive false negative assessment
 *
 * @param {Object} props - Component props
 * @param {Array<Object>} props.list - Array of detected false negative clusters with properties:
 *   - start (Date): Start time of cluster
 *   - durationSec (number): Duration in seconds
 *   - peakFLGLevel (number): Peak Flow Limitation Grade (0-1 scale)
 *   - count (number): Number of detected events in cluster
 * @param {string} props.preset - Current detection preset: 'strict', 'balanced', or 'lenient'
 * @param {Function} [props.onPresetChange] - Callback when user changes preset.
 *   Called with string value ('strict', 'balanced', or 'lenient')
 * @returns {JSX.Element} A div containing scatter plot, controls, and analysis information
 *
 * @example
 * const clusters = [...detected false negative clusters...];
 * return (
 *   <FalseNegativesAnalysis
 *     list={clusters}
 *     preset="balanced"
 *     onPresetChange={(p) => handlePresetChange(p)}
 *   />
 * );
 *
 * @see detectFalseNegatives - Detection algorithm implementation
 * @see clusterApneaEvents - Clustering algorithm for grouping events
 */
/**
 * Displays analysis of potential false negatives in CPAP therapy.
 *
 * False negatives are apnea events that may have been missed or under-detected by the device.
 * This component visualizes detected cluster patterns using three sensitivity presets:
 * - **Strict**: Highest specificity, most likely real missed events
 * - **Balanced**: Medium sensitivity/specificity trade-off (recommended)
 * - **Lenient**: Highest sensitivity, includes more potential false negatives
 *
 * Features:
 * - Scatter plot of false negative clusters over time, sized by duration and colored by peak FLG (Flow Limitation Grade)
 * - Preset selector to adjust detection thresholds interactively
 * - Multiple analysis views (Peak FLG, cluster characteristics, temporal patterns)
 * - Interactive hover tooltips showing cluster duration, count, peak FLG level
 *
 * @param {Object} props - Component props
 * @param {Array<Object>} props.list - Array of detected false negative clusters with properties:
 *   - start (Date): Start time of cluster
 *   - durationSec (number): Duration in seconds
 *   - peakFLGLevel (number): Peak Flow Limitation Grade (0-1 scale)
 *   - count (number): Number of detected events in cluster
 * @param {string} props.preset - Current detection preset: 'strict', 'balanced', or 'lenient'
 * @param {Function} [props.onPresetChange] - Callback when user changes preset.
 *   Called with string value ('strict', 'balanced', or 'lenient')
 * @returns {JSX.Element} A div containing scatter plot, controls, and analysis information
 *
 * @example
 * const clusters = [...detected false negative clusters...];
 * return (
 *   <FalseNegativesAnalysis
 *     list={clusters}
 *     preset="balanced"
 *     onPresetChange={(p) => handlePresetChange(p)}
 *   />
 * );
 *
 * @see detectFalseNegatives - Utility function for detecting false negatives
 * @see ThemedPlot - Plotly wrapper for chart rendering
 */
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
