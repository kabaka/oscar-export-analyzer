import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { ThemedPlot } from '../../ui';
import { COLORS } from '../../../utils/colors';
import {
  HORIZONTAL_CENTER_LEGEND,
  LINE_WIDTH_BOLD,
} from '../../../constants/charts';
import {
  SCATTER_PLOT_HEIGHT,
  CORRELATION_CHART_MARGINS,
  CORRELATION_THRESHOLDS,
  SIGNIFICANCE_LEVELS,
  DATA_LIMITS,
} from '../../../constants/fitbit';

/**
 * Bivariate scatter plot for exploring relationships between two specific metrics.
 *
 * Features:
 * - Scatter plot with regression line and confidence intervals
 * - Color-coding by third variable (e.g., SpO2 levels)
 * - Outlier detection and highlighting
 * - Statistical summary panel with clinical interpretation
 * - Interactive point selection with night detail links
 *
 * @param {Object} props - Component props
 * @param {string} props.xMetric - Name of x-axis metric
 * @param {string} props.yMetric - Name of y-axis metric
 * @param {string} [props.colorMetric] - Optional third metric for point coloring
 * @param {Object} props.scatterData - Scatter plot data and statistics
 * @param {Array<number>} props.scatterData.xValues - X-axis values
 * @param {Array<number>} props.scatterData.yValues - Y-axis values
 * @param {Array<number>} [props.scatterData.colorValues] - Values for point coloring
 * @param {Array<string>} props.scatterData.dateLabels - Date labels for each point
 * @param {Object} props.scatterData.statistics - Regression and correlation stats
 * @param {number} props.scatterData.statistics.correlation - Correlation coefficient (r)
 * @param {number} props.scatterData.statistics.pValue - Statistical significance (p)
 * @param {number} props.scatterData.statistics.rSquared - Coefficient of determination
 * @param {number} props.scatterData.statistics.slope - Regression slope
 * @param {number} props.scatterData.statistics.intercept - Regression intercept
 * @param {Array<number>} props.scatterData.regressionLine - Regression line points
 * @param {Array<number>} [props.scatterData.confidenceInterval] - 95% CI bounds
 * @param {Array<Object>} [props.scatterData.outliers] - Detected outliers
 * @param {Function} [props.onPointClick] - Callback when data point clicked
 * @param {Function} [props.onMetricChange] - Callback when metric selection changed
 * @param {string} [props.title] - Chart title override
 * @param {string} [props.className] - CSS class for container
 * @returns {JSX.Element} Interactive scatter plot with regression analysis
 *
 * @example
 * const scatterData = {
 *   xValues: [62, 58, 65, 71, ...],
 *   yValues: [3.2, 8.5, 1.1, 12.3, ...],
 *   colorValues: [95, 92, 96, 89, ...],
 *   dateLabels: ['2026-01-20', '2026-01-21', ...],
 *   statistics: {
 *     correlation: 0.63,
 *     pValue: 0.0001,
 *     rSquared: 0.40,
 *     slope: 0.15,
 *     intercept: -1.2,
 *   },
 *   regressionLine: { x: [50, 100], y: [6.3, 13.8] },
 *   confidenceInterval: { upper: [...], lower: [...] },
 *   outliers: [{ date: '2026-01-15', xValue: 68, yValue: 22.1 }],
 * };
 *
 * <BivariateScatterPlot
 *   xMetric="Heart Rate"
 *   yMetric="AHI"
 *   colorMetric="SpO2 Min"
 *   scatterData={scatterData}
 *   onPointClick={(date) => showNightDetail(date)}
 * />
 */
function BivariateScatterPlot({
  xMetric,
  yMetric,
  colorMetric,
  scatterData,
  onPointClick,
  title,
  className = '',
}) {
  // eslint-disable-next-line no-unused-vars
  const [selectedPoint, setSelectedPoint] = useState(null); // State used via setter in handlePlotClick
  const [showConfidenceInterval, setShowConfidenceInterval] = useState(true);
  const [highlightOutliers, setHighlightOutliers] = useState(true);

  // Process scatter plot data
  const processedData = useMemo(() => {
    if (!scatterData || !scatterData.xValues || !scatterData.yValues) {
      return {
        traces: [],
        layout: {},
        isEmpty: true,
      };
    }

    const {
      xValues,
      yValues,
      colorValues,
      dateLabels,
      regressionLine,
      confidenceInterval,
      outliers,
    } = scatterData;

    const traces = [];

    // Confidence interval fill (if available and enabled)
    if (showConfidenceInterval && confidenceInterval) {
      traces.push({
        name: 'Confidence Interval',
        x: [...regressionLine.x, ...regressionLine.x.slice().reverse()],
        y: [
          ...confidenceInterval.upper,
          ...confidenceInterval.lower.slice().reverse(),
        ],
        fill: 'toself',
        fillcolor: 'rgba(31, 119, 180, 0.2)',
        line: { color: 'transparent' },
        mode: 'lines',
        hoverinfo: 'skip',
        showlegend: true,
      });
    }

    // Main data points scatter
    const scatterTrace = {
      name: 'Nightly Measurements',
      x: xValues,
      y: yValues,
      mode: 'markers',
      type: 'scatter',
      marker: {
        size: 8,
        line: {
          width: 1,
          color: '#ffffff',
        },
      },
      text: dateLabels,
      hovertemplate:
        '<b>%{text}</b><br>' +
        `${xMetric}: %{x}<br>` +
        `${yMetric}: %{y}<br>` +
        (colorMetric ? `${colorMetric}: %{marker.color}<br>` : '') +
        '<extra></extra>',
    };

    // Apply color coding if available
    if (colorValues && colorMetric) {
      scatterTrace.marker.color = colorValues;
      scatterTrace.marker.colorscale = 'Viridis';
      scatterTrace.marker.showscale = true;
      scatterTrace.marker.colorbar = {
        title: colorMetric,
        titleside: 'right',
        thickness: 15,
        len: 0.7,
        x: 1.02,
      };
    } else {
      scatterTrace.marker.color = COLORS.primary;
    }

    traces.push(scatterTrace);

    // Regression line
    if (regressionLine) {
      traces.push({
        name: 'Trend Line',
        x: regressionLine.x,
        y: regressionLine.y,
        mode: 'lines',
        type: 'scatter',
        line: {
          color: COLORS.threshold,
          width: LINE_WIDTH_BOLD,
          dash: 'solid',
        },
        hoverinfo: 'skip',
        showlegend: true,
      });
    }

    // Outliers overlay (if enabled)
    if (highlightOutliers && outliers && outliers.length > 0) {
      const outlierIndices = outliers
        .map((o) => dateLabels.findIndex((date) => date === o.date))
        .filter((i) => i !== -1);

      if (outlierIndices.length > 0) {
        traces.push({
          name: 'Outliers',
          x: outlierIndices.map((i) => xValues[i]),
          y: outlierIndices.map((i) => yValues[i]),
          mode: 'markers',
          type: 'scatter',
          marker: {
            size: 12,
            symbol: 'diamond',
            color: 'transparent',
            line: {
              width: 3,
              color: COLORS.secondary,
            },
          },
          text: outlierIndices.map((i) => dateLabels[i]),
          hovertemplate:
            '<b>%{text}</b> (Outlier)<br>' +
            `${xMetric}: %{x}<br>` +
            `${yMetric}: %{y}<br>` +
            '<extra></extra>',
          showlegend: true,
        });
      }
    }

    return {
      traces,
      isEmpty: false,
    };
  }, [
    scatterData,
    xMetric,
    yMetric,
    colorMetric,
    showConfidenceInterval,
    highlightOutliers,
  ]);

  // Chart layout configuration
  const chartLayout = useMemo(() => {
    if (processedData.isEmpty) return {};

    const { statistics } = scatterData;
    const correlationText =
      statistics && statistics.correlation != null
        ? ` (r=${statistics.correlation.toFixed(2)}, p${statistics.pValue != null && statistics.pValue < 0.001 ? '<0.001' : statistics.pValue != null ? `=${statistics.pValue.toFixed(3)}` : '=N/A'})`
        : '';

    return {
      title: title || `${yMetric} vs ${xMetric}${correlationText}`,

      xaxis: {
        title: getMetricLabel(xMetric),
        zeroline: false,
        gridcolor: '#f0f0f0',
        showspikes: true,
        spikecolor: '#999',
        spikethickness: 1,
      },

      yaxis: {
        title: getMetricLabel(yMetric),
        zeroline: false,
        gridcolor: '#f0f0f0',
        showspikes: true,
        spikecolor: '#999',
        spikethickness: 1,
      },

      hovermode: 'closest',
      dragmode: 'zoom',

      margin: { ...CORRELATION_CHART_MARGINS.SCATTER },
      height: SCATTER_PLOT_HEIGHT,

      legend: {
        ...HORIZONTAL_CENTER_LEGEND,
        y: -0.15,
      },

      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
    };
  }, [xMetric, yMetric, title, scatterData, processedData.isEmpty]);

  // Handle point clicks
  const handlePlotClick = (event) => {
    if (!onPointClick) return;
    if (!event.points || event.points.length === 0) return;

    const point = event.points[0];
    if (point && point.data.name === 'Nightly Measurements') {
      const dateLabel = point.text;
      setSelectedPoint(dateLabel); // Used for internal state tracking
      onPointClick(dateLabel);
    }
  };

  if (processedData.isEmpty) {
    return (
      <div
        className={`scatter-plot-container ${className}`}
        style={{
          height: SCATTER_PLOT_HEIGHT,
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
          <p>No scatter plot data available</p>
          <p style={{ fontSize: '0.9em' }}>
            Select metrics with sufficient paired observations for analysis.
          </p>
        </div>
      </div>
    );
  }

  const { statistics } = scatterData;

  return (
    <div className={`bivariate-scatter-container ${className}`}>
      {/* Chart controls */}
      <div
        className="scatter-controls"
        style={{
          marginBottom: '1rem',
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            type="checkbox"
            checked={showConfidenceInterval}
            onChange={(e) => setShowConfidenceInterval(e.target.checked)}
            aria-label="Show confidence interval"
          />
          <span>95% Confidence Interval</span>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            type="checkbox"
            checked={highlightOutliers}
            onChange={(e) => setHighlightOutliers(e.target.checked)}
            aria-label="Highlight outliers"
          />
          <span>Highlight Outliers</span>
        </label>
      </div>

      {/* Accessibility summary */}
      <div
        id="scatter-plot-summary"
        className="sr-only"
        role="region"
        aria-label="Scatter plot summary"
      >
        Scatter plot of {scatterData.xValues?.length || 0} nights showing{' '}
        {yMetric} versus {xMetric}.
        {statistics &&
          statistics.correlation != null &&
          ` ${statistics.correlation > 0 ? 'Positive' : 'Negative'} correlation (r=${statistics.correlation.toFixed(2)}, ` +
            `${statistics.pValue != null && statistics.pValue < SIGNIFICANCE_LEVELS.P_05 ? 'significant' : 'not significant'}). ` +
            `${statistics.rSquared != null ? (statistics.rSquared * 100).toFixed(0) : '?'}% of variance explained.`}
        {scatterData.outliers?.length > 0 &&
          ` ${scatterData.outliers.length} outliers detected beyond 2 standard deviations.`}
      </div>

      {/* Main scatter plot */}
      <div
        className="scatter-plot-wrapper"
        role="img"
        aria-label={`Scatter plot: ${yMetric} vs ${xMetric}`}
        aria-describedby="scatter-plot-summary"
      >
        <ThemedPlot
          useResizeHandler
          style={{ width: '100%', height: `${SCATTER_PLOT_HEIGHT}px` }}
          data={processedData.traces}
          layout={chartLayout}
          config={{
            responsive: true,
            displaylogo: false,
            modeBarButtonsToRemove: ['lasso2d', 'select2d'],
            toImageButtonOptions: {
              format: 'png',
              filename: `oscar-fitbit-scatter-${xMetric}-${yMetric}`,
              height: 600,
              width: 800,
              scale: 1,
            },
          }}
          onClick={handlePlotClick}
        />
      </div>

      {/* Statistical summary panel */}
      {statistics && (
        <StatisticalSummary
          xMetric={xMetric}
          yMetric={yMetric}
          statistics={statistics}
          outliers={scatterData.outliers}
          sampleSize={scatterData.xValues?.length || 0}
        />
      )}
    </div>
  );
}

/**
 * Statistical summary component showing correlation analysis results.
 */
function StatisticalSummary({
  xMetric,
  yMetric,
  statistics,
  outliers,
  sampleSize,
}) {
  const { correlation, pValue, rSquared, slope } = statistics;
  // intercept not used in display

  return (
    <div
      className="statistical-summary"
      style={{
        marginTop: '2rem',
        padding: '1rem',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #e9ecef',
      }}
    >
      <h4 style={{ margin: '0 0 1rem 0', color: '#495057' }}>
        Relationship Analysis
      </h4>

      <div
        className="stats-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1rem',
        }}
      >
        <div className="stat-item">
          <label
            style={{
              display: 'block',
              fontWeight: 'bold',
              color: '#6c757d',
              fontSize: '0.9em',
            }}
          >
            Correlation
          </label>
          <span
            className="stat-value"
            style={{ fontSize: '1.2em', fontWeight: 'bold', color: '#495057' }}
          >
            {correlation != null ? correlation.toFixed(3) : '\u2014'}
          </span>
          <span
            className="stat-interpretation"
            style={{ display: 'block', fontSize: '0.85em', color: '#6c757d' }}
          >
            {correlation != null
              ? getCorrelationStrength(correlation)
              : 'Insufficient data'}
          </span>
        </div>

        <div className="stat-item">
          <label
            style={{
              display: 'block',
              fontWeight: 'bold',
              color: '#6c757d',
              fontSize: '0.9em',
            }}
          >
            P-value
          </label>
          <span
            className="stat-value"
            style={{ fontSize: '1.2em', fontWeight: 'bold', color: '#495057' }}
          >
            {pValue != null
              ? pValue < 0.001
                ? '<0.001'
                : pValue.toExponential(2)
              : 'N/A'}
          </span>
          <span
            className="stat-interpretation"
            style={{ display: 'block', fontSize: '0.85em', color: '#6c757d' }}
          >
            {pValue == null
              ? 'N/A'
              : pValue < SIGNIFICANCE_LEVELS.P_001
                ? 'Highly Significant'
                : pValue < SIGNIFICANCE_LEVELS.P_05
                  ? 'Significant'
                  : 'Not Significant'}
          </span>
        </div>

        <div className="stat-item">
          <label
            style={{
              display: 'block',
              fontWeight: 'bold',
              color: '#6c757d',
              fontSize: '0.9em',
            }}
          >
            R-squared
          </label>
          <span
            className="stat-value"
            style={{ fontSize: '1.2em', fontWeight: 'bold', color: '#495057' }}
          >
            {rSquared != null ? rSquared.toFixed(3) : '\u2014'}
          </span>
          <span
            className="stat-interpretation"
            style={{ display: 'block', fontSize: '0.85em', color: '#6c757d' }}
          >
            {rSquared != null
              ? `${(rSquared * 100).toFixed(0)}% variance explained`
              : 'Insufficient data'}
          </span>
        </div>

        <div className="stat-item">
          <label
            style={{
              display: 'block',
              fontWeight: 'bold',
              color: '#6c757d',
              fontSize: '0.9em',
            }}
          >
            Slope
          </label>
          <span
            className="stat-value"
            style={{ fontSize: '1.2em', fontWeight: 'bold', color: '#495057' }}
          >
            {slope != null ? slope.toFixed(3) : '\u2014'}
          </span>
          <span
            className="stat-interpretation"
            style={{ display: 'block', fontSize: '0.85em', color: '#6c757d' }}
          >
            {slope != null
              ? getSlopeInterpretation(xMetric, yMetric, slope)
              : 'Insufficient data'}
          </span>
        </div>
      </div>

      {/* Clinical interpretation */}
      <div
        className="clinical-interpretation"
        style={{
          padding: '1rem',
          backgroundColor: '#ffffff',
          borderRadius: '6px',
          border: '1px solid #dee2e6',
        }}
      >
        <h5 style={{ margin: '0 0 0.5rem 0', color: '#495057' }}>
          Clinical Interpretation
        </h5>
        <p
          style={{
            margin: 0,
            fontSize: '0.95em',
            lineHeight: 1.5,
            color: '#495057',
          }}
        >
          {generateClinicalInterpretation(
            correlation,
            pValue,
            xMetric,
            yMetric,
            sampleSize,
          )}
        </p>
      </div>

      {/* Outlier analysis */}
      {outliers && outliers.length > 0 && (
        <div className="outlier-analysis" style={{ marginTop: '1rem' }}>
          <h5 style={{ margin: '0 0 0.5rem 0', color: '#495057' }}>
            Outlier Detection
          </h5>
          <p
            style={{
              margin: '0 0 0.5rem 0',
              fontSize: '0.95em',
              color: '#495057',
            }}
          >
            Found {outliers.length} outlier(s) beyond 2 standard deviations:
          </p>
          <ul
            style={{
              margin: 0,
              paddingLeft: '1.5rem',
              fontSize: '0.9em',
              color: '#6c757d',
            }}
          >
            {outliers.slice(0, 5).map((outlier, index) => (
              <li key={index}>
                <strong>{outlier.date}</strong>:{xMetric} = {outlier.xValue},{' '}
                {yMetric} = {outlier.yValue}
              </li>
            ))}
            {outliers.length > 5 && <li>... and {outliers.length - 5} more</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

// Helper functions

/**
 * Get metric label with units.
 */
function getMetricLabel(metric) {
  const metricUnits = {
    'Heart Rate': 'Heart Rate (bpm)',
    AHI: 'AHI (events/hour)',
    'SpO2 Min': 'SpO2 Min (%)',
    'Sleep Efficiency': 'Sleep Efficiency (%)',
    'Deep Sleep %': 'Deep Sleep (%)',
    'REM Sleep %': 'REM Sleep (%)',
    EPAP: 'EPAP (cmH₂O)',
    'Leak Rate': 'Leak Rate (L/min)',
  };

  return metricUnits[metric] || metric;
}

/**
 * Get correlation strength description.
 */
function getCorrelationStrength(correlation) {
  if (correlation == null) return 'Insufficient data';
  const abs = Math.abs(correlation);
  if (abs < CORRELATION_THRESHOLDS.WEAK) return 'Weak correlation';
  if (abs < CORRELATION_THRESHOLDS.MODERATE) return 'Moderate correlation';
  if (abs < CORRELATION_THRESHOLDS.STRONG) return 'Strong correlation';
  return 'Very strong correlation';
}

/**
 * Get slope interpretation.
 */
function getSlopeInterpretation(xMetric, yMetric, slope) {
  if (slope == null) return 'Insufficient data';
  if (slope > 0) {
    return `${slope.toFixed(2)} ${yMetric} per ${xMetric}`;
  } else {
    return `${Math.abs(slope).toFixed(2)} ${yMetric} decrease per ${xMetric}`;
  }
}

/**
 * Generate clinical interpretation text.
 */
function generateClinicalInterpretation(
  correlation,
  pValue,
  xMetric,
  yMetric,
  sampleSize,
) {
  if (correlation == null) {
    return `Insufficient data to determine a relationship between ${xMetric} and ${yMetric}. More paired observations are needed for correlation analysis.`;
  }
  const isSignificant = pValue != null && pValue < SIGNIFICANCE_LEVELS.P_05;
  const strength = getCorrelationStrength(correlation);
  const direction = correlation > 0 ? 'positive' : 'negative';

  let interpretation = `This analysis shows a ${strength.toLowerCase()} ${direction} relationship between ${xMetric} and ${yMetric}`;

  if (pValue == null) {
    interpretation += '.';
  } else if (isSignificant) {
    interpretation += ` that is statistically significant (p${pValue < 0.001 ? '<0.001' : `=${pValue.toFixed(3)}`}).`;
  } else {
    interpretation += ` that is not statistically significant (p=${pValue.toFixed(3)}).`;
  }

  // Add sample size context
  if (sampleSize < DATA_LIMITS.MIN_NIGHTS_FOR_CORRELATION) {
    interpretation += ` Note: This analysis is based on ${sampleSize} nights, which is below the recommended minimum of ${DATA_LIMITS.MIN_NIGHTS_FOR_CORRELATION} nights for reliable correlation analysis.`;
  } else {
    interpretation += ` Based on ${sampleSize} nights of data.`;
  }

  return interpretation;
}

BivariateScatterPlot.propTypes = {
  xMetric: PropTypes.string.isRequired,
  yMetric: PropTypes.string.isRequired,
  colorMetric: PropTypes.string,
  scatterData: PropTypes.shape({
    xValues: PropTypes.arrayOf(PropTypes.number).isRequired,
    yValues: PropTypes.arrayOf(PropTypes.number).isRequired,
    colorValues: PropTypes.arrayOf(PropTypes.number),
    dateLabels: PropTypes.arrayOf(PropTypes.string).isRequired,
    statistics: PropTypes.shape({
      correlation: PropTypes.number.isRequired,
      pValue: PropTypes.number.isRequired,
      rSquared: PropTypes.number.isRequired,
      slope: PropTypes.number.isRequired,
      intercept: PropTypes.number.isRequired,
    }).isRequired,
    regressionLine: PropTypes.shape({
      x: PropTypes.arrayOf(PropTypes.number),
      y: PropTypes.arrayOf(PropTypes.number),
    }),
    confidenceInterval: PropTypes.shape({
      upper: PropTypes.arrayOf(PropTypes.number),
      lower: PropTypes.arrayOf(PropTypes.number),
    }),
    outliers: PropTypes.arrayOf(
      PropTypes.shape({
        date: PropTypes.string.isRequired,
        xValue: PropTypes.number.isRequired,
        yValue: PropTypes.number.isRequired,
      }),
    ),
  }).isRequired,
  onPointClick: PropTypes.func,
  onMetricChange: PropTypes.func,
  title: PropTypes.string,
  className: PropTypes.string,
};

StatisticalSummary.propTypes = {
  xMetric: PropTypes.string.isRequired,
  yMetric: PropTypes.string.isRequired,
  statistics: PropTypes.shape({
    correlation: PropTypes.number.isRequired,
    pValue: PropTypes.number.isRequired,
    rSquared: PropTypes.number.isRequired,
    slope: PropTypes.number.isRequired,
    intercept: PropTypes.number.isRequired,
  }).isRequired,
  outliers: PropTypes.arrayOf(PropTypes.object),
  sampleSize: PropTypes.number.isRequired,
};

export default BivariateScatterPlot;
