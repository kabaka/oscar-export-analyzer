import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { ThemedPlot } from '../../ui';
import { COLORS } from '../../../utils/colors';
import { CORR_HEATMAP_MARGIN } from '../../../constants/charts';
import {
  CORRELATION_MATRIX_HEIGHT,
  CORRELATION_THRESHOLDS,
  SIGNIFICANCE_LEVELS,
} from '../../../constants/fitbit';

/**
 * Correlation matrix heatmap showing pairwise correlations between CPAP and Fitbit metrics.
 *
 * Visualizes correlation coefficients as color-coded cells with:
 * - Color intensity representing correlation strength (-1 to +1)
 * - Cell annotations showing r-values and significance stars
 * - Interactive drill-down to scatter plots for specific metric pairs
 * - Accessible data table alternative for screen readers
 *
 * @param {Object} props - Component props
 * @param {Object} props.correlationData - Correlation analysis results
 * @param {Array<string>} props.correlationData.metrics - Metric names for matrix axes
 * @param {Array<Array<number>>} props.correlationData.correlations - Correlation matrix (r-values)
 * @param {Array<Array<number>>} props.correlationData.pValues - P-value matrix for significance testing
 * @param {number} props.correlationData.sampleSize - Number of nights analyzed
 * @param {Function} [props.onCellClick] - Callback when correlation cell clicked
 * @param {Array<string>} [props.selectedMetrics] - Metrics to highlight in matrix
 * @param {string} [props.title] - Chart title, defaults to "Metric Correlations"
 * @param {boolean} [props.showAnnotations=true] - Whether to show r-values in cells
 * @param {string} [props.className] - CSS class for container styling
 * @returns {JSX.Element} Interactive correlation matrix with drill-down capability
 *
 * @example
 * const correlationData = {
 *   metrics: ['Heart Rate', 'AHI', 'SpO2 Min', 'Sleep Efficiency', 'Deep Sleep %'],
 *   correlations: [
 *     [1.0, 0.63, -0.45, 0.12, -0.28],
 *     [0.63, 1.0, -0.72, -0.34, -0.18],
 *     // ... 5x5 matrix
 *   ],
 *   pValues: [
 *     [0, 0.0001, 0.003, 0.14, 0.08],
 *     // ... corresponding p-values
 *   ],
 *   sampleSize: 47
 * };
 *
 * <CorrelationMatrix
 *   correlationData={correlationData}
 *   onCellClick={(metric1, metric2, correlation) => openScatterPlot(metric1, metric2)}
 *   selectedMetrics={['Heart Rate', 'AHI']}
 * />
 */
function CorrelationMatrix({
  correlationData,
  onCellClick,
  // selectedMetrics prop available but not used
  title,
  showAnnotations = true,
  className = '',
}) {
  // eslint-disable-next-line no-unused-vars
  const [hoveredCell, setHoveredCell] = useState(null); // State used via setter in handlePlotHover/Unhover

  // Process correlation data for heatmap visualization
  const processedData = useMemo(() => {
    if (
      !correlationData ||
      !correlationData.correlations ||
      !correlationData.metrics
    ) {
      return {
        traces: [],
        layout: {},
        annotations: [],
        isEmpty: true,
      };
    }

    const { metrics, correlations, pValues, sampleSize } = correlationData;
    const n = metrics.length;

    // Create correlation matrix trace
    const heatmapTrace = {
      z: correlations,
      x: metrics,
      y: metrics.slice().reverse(), // Reverse for intuitive top-to-bottom reading
      type: 'heatmap',
      colorscale: [
        [0, COLORS.threshold], // Strong negative (-1.0) - Red
        [0.25, '#FFA500'], // Weak negative (-0.5) - Orange
        [0.5, '#FFFFFF'], // No correlation (0) - White
        [0.75, '#87CEEB'], // Weak positive (0.5) - Light Blue
        [1, COLORS.primary], // Strong positive (1.0) - Blue
      ],
      zmin: -1,
      zmax: 1,
      colorbar: {
        title: 'Correlation (r)',
        titleside: 'right',
        thickness: 20,
        len: 0.8,
        x: 1.02,
      },
      hoverongaps: false,
      hovertemplate:
        '<b>%{y}</b> × <b>%{x}</b><br>' +
        'Correlation: %{z:.3f}<br>' +
        'P-value: %{customdata:.4f}<br>' +
        'Significance: %{text}<br>' +
        `Sample size: ${sampleSize || 'N/A'}<extra></extra>`,
      customdata: pValues,
      text: generateSignificanceLabels(pValues),
    };

    // Generate cell annotations (r-values with significance stars)
    const annotations = [];
    if (showAnnotations) {
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const correlation = correlations[n - 1 - i][j]; // Account for reversed y-axis
          const pValue = pValues[n - 1 - i][j];

          // Skip diagonal cells (always 1.0)
          if (i === n - 1 - j) continue;

          annotations.push({
            x: j,
            y: i,
            text: formatCorrelationText(correlation, pValue),
            font: {
              color: getTextColor(correlation),
              size: Math.max(10, 14 - n), // Smaller text for larger matrices
              family: 'monospace',
            },
            showarrow: false,
            xanchor: 'center',
            yanchor: 'middle',
          });
        }
      }
    }

    return {
      traces: [heatmapTrace],
      annotations,
      isEmpty: false,
    };
  }, [correlationData, showAnnotations]);

  // Chart layout configuration
  const chartLayout = useMemo(() => {
    if (processedData.isEmpty) return {};

    const { metrics } = correlationData;
    const baseLayout = {
      title:
        title ||
        `Metric Correlations (${correlationData.sampleSize || 'N'} nights)`,

      xaxis: {
        title: '',
        tickangle: -45,
        side: 'bottom',
        showgrid: false,
        zeroline: false,
        tickfont: { size: 11 },
      },

      yaxis: {
        title: '',
        autorange: false,
        range: [-0.5, metrics.length - 0.5],
        showgrid: false,
        zeroline: false,
        tickfont: { size: 11 },
      },

      annotations: processedData.annotations,

      // Responsive margins for metric labels
      margin: { ...CORR_HEATMAP_MARGIN },

      // Square aspect ratio
      height: Math.min(CORRELATION_MATRIX_HEIGHT, window.innerWidth * 0.8),
      width: Math.min(CORRELATION_MATRIX_HEIGHT, window.innerWidth * 0.8),

      // Styling
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',

      showlegend: false,
    };

    return baseLayout;
  }, [correlationData, processedData, title]);

  // Handle cell clicks for drill-down
  const handlePlotClick = (event) => {
    if (!onCellClick) return;

    const point = event.points[0];
    if (point) {
      const xMetric = point.x;
      const yMetric = point.y;
      const correlation = point.z;
      const pValue = point.customdata;

      // Don't drill into diagonal cells
      if (xMetric !== yMetric) {
        onCellClick(xMetric, yMetric, {
          correlation,
          pValue,
          sampleSize: correlationData.sampleSize,
        });
      }
    }
  };

  // Handle hover for enhanced interactivity
  const handlePlotHover = (event) => {
    if (event.points && event.points.length > 0) {
      const point = event.points[0];
      setHoveredCell({
        // Used for hover state tracking
        x: point.x,
        y: point.y,
        correlation: point.z,
        pValue: point.customdata,
      });
    }
  };

  const handlePlotUnhover = () => {
    setHoveredCell(null);
  };

  if (processedData.isEmpty) {
    return (
      <div
        className={`correlation-matrix-container ${className}`}
        style={{
          height: CORRELATION_MATRIX_HEIGHT,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px dashed #ccc',
          borderRadius: '8px',
          backgroundColor: '#f9f9f9',
        }}
      >
        <div
          className="empty-state"
          style={{ textAlign: 'center', color: '#666' }}
        >
          <p>No correlation data available</p>
          <p style={{ fontSize: '0.9em' }}>
            Ensure sufficient nights of combined CPAP and Fitbit data for
            analysis.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`correlation-matrix-container ${className}`}
      data-testid="correlation-matrix"
    >
      {/* Chart accessibility summary */}
      <div
        id="correlation-matrix-summary"
        className="sr-only"
        role="region"
        aria-label="Correlation matrix summary"
      >
        Correlation matrix showing relationships between{' '}
        {correlationData.metrics.length} metrics across{' '}
        {correlationData.sampleSize} nights.
        {findStrongestCorrelation(
          correlationData.correlations,
          correlationData.metrics,
          correlationData.pValues,
        )}
      </div>

      {/* Main heatmap chart */}
      <div
        className="correlation-heatmap-wrapper"
        role="img"
        aria-label={`Correlation matrix heatmap: ${title || 'Metric correlations'}`}
        aria-describedby="correlation-matrix-summary"
      >
        <ThemedPlot
          useResizeHandler
          style={{ width: '100%', height: '100%' }}
          data={processedData.traces}
          layout={chartLayout}
          config={{
            responsive: true,
            displaylogo: false,
            modeBarButtonsToRemove: ['lasso2d', 'select2d', 'zoom2d', 'pan2d'],
            toImageButtonOptions: {
              format: 'png',
              filename: 'oscar-fitbit-correlation-matrix',
              height: 600,
              width: 600,
              scale: 1,
            },
            scrollZoom: false,
            doubleClick: false,
          }}
          onClick={handlePlotClick}
          onHover={handlePlotHover}
          onUnhover={handlePlotUnhover}
        />
      </div>

      {/* Accessible data table alternative */}
      <CorrelationTable
        correlationData={correlationData}
        className="correlation-table sr-only"
      />
    </div>
  );
}

/**
 * Accessible data table showing correlation values for screen readers.
 */
function CorrelationTable({ correlationData, className }) {
  if (!correlationData || !correlationData.metrics) return null;

  const { metrics, correlations, pValues } = correlationData;
  const correlationPairs = [];

  // Generate all unique pairs (upper triangle)
  for (let i = 0; i < metrics.length; i++) {
    for (let j = i + 1; j < metrics.length; j++) {
      correlationPairs.push({
        metric1: metrics[i],
        metric2: metrics[j],
        correlation: correlations[i][j],
        pValue: pValues[i][j],
      });
    }
  }

  return (
    <table className={className} aria-label="Correlation matrix data">
      <thead>
        <tr>
          <th scope="col">Metric Pair</th>
          <th scope="col">Correlation (r)</th>
          <th scope="col">P-value</th>
          <th scope="col">Significance</th>
          <th scope="col">Interpretation</th>
        </tr>
      </thead>
      <tbody>
        {correlationPairs.map((pair) => (
          <tr key={`${pair.metric1}-${pair.metric2}`}>
            <td>
              {pair.metric1} ↔ {pair.metric2}
            </td>
            <td>{pair.correlation.toFixed(3)}</td>
            <td>{pair.pValue.toExponential(3)}</td>
            <td>{getSignificanceLabel(pair.pValue)}</td>
            <td>
              {getCorrelationInterpretation(pair.correlation, pair.pValue)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Helper functions

/**
 * Generate significance labels based on p-values.
 */
function generateSignificanceLabels(pValues) {
  return pValues.map((row) => row.map((p) => getSignificanceLabel(p)));
}

/**
 * Get significance label for p-value.
 */
function getSignificanceLabel(pValue) {
  if (pValue < SIGNIFICANCE_LEVELS.P_001) return '***';
  if (pValue < SIGNIFICANCE_LEVELS.P_01) return '**';
  if (pValue < SIGNIFICANCE_LEVELS.P_05) return '*';
  return 'ns';
}

/**
 * Format correlation text with significance stars.
 */
function formatCorrelationText(correlation, pValue) {
  const significance = getSignificanceLabel(pValue);
  return `${correlation.toFixed(2)}${significance}`;
}

/**
 * Get text color based on correlation strength for readability.
 */
function getTextColor(correlation) {
  return Math.abs(correlation) > 0.4 ? '#FFFFFF' : '#000000';
}

/**
 * Find strongest correlation for accessibility summary.
 */
function findStrongestCorrelation(correlations, metrics, pValues) {
  let maxCorr = 0;
  let maxPair = null;
  let maxPValue = 1;

  for (let i = 0; i < metrics.length; i++) {
    for (let j = i + 1; j < metrics.length; j++) {
      const corr = Math.abs(correlations[i][j]);
      if (corr > maxCorr) {
        maxCorr = corr;
        maxPair = `${metrics[i]} and ${metrics[j]}`;
        maxPValue = pValues[i][j];
      }
    }
  }

  if (maxPair) {
    const significance =
      maxPValue < SIGNIFICANCE_LEVELS.P_05 ? 'significant' : 'not significant';
    return `Strongest correlation: ${maxPair} (r=${correlations[metrics.indexOf(maxPair.split(' and ')[0])][metrics.indexOf(maxPair.split(' and ')[1])].toFixed(2)}, ${significance}).`;
  }

  return '';
}

/**
 * Get correlation interpretation for accessibility.
 */
function getCorrelationInterpretation(correlation, pValue) {
  const absCorr = Math.abs(correlation);
  const isSignificant = pValue < SIGNIFICANCE_LEVELS.P_05;

  let strength = '';
  if (absCorr < CORRELATION_THRESHOLDS.WEAK) strength = 'weak';
  else if (absCorr < CORRELATION_THRESHOLDS.MODERATE) strength = 'moderate';
  else if (absCorr < CORRELATION_THRESHOLDS.STRONG) strength = 'strong';
  else strength = 'very strong';

  const direction = correlation > 0 ? 'positive' : 'negative';
  const significance = isSignificant ? 'significant' : 'not significant';

  return `${strength} ${direction} correlation (${significance})`;
}

CorrelationMatrix.propTypes = {
  correlationData: PropTypes.shape({
    metrics: PropTypes.arrayOf(PropTypes.string).isRequired,
    correlations: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number))
      .isRequired,
    pValues: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number)).isRequired,
    sampleSize: PropTypes.number.isRequired,
  }).isRequired,
  onCellClick: PropTypes.func,
  selectedMetrics: PropTypes.arrayOf(PropTypes.string),
  title: PropTypes.string,
  showAnnotations: PropTypes.bool,
  className: PropTypes.string,
};

CorrelationTable.propTypes = {
  correlationData: PropTypes.shape({
    metrics: PropTypes.arrayOf(PropTypes.string).isRequired,
    correlations: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number))
      .isRequired,
    pValues: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number)).isRequired,
  }).isRequired,
  className: PropTypes.string,
};

export default CorrelationMatrix;
