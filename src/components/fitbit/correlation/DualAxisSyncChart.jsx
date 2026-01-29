import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { ThemedPlot } from '../../ui';
import { COLORS } from '../../../utils/colors';
import {
  HORIZONTAL_CENTER_LEGEND,
  LINE_WIDTH_FINE,
  LINE_WIDTH_MEDIUM,
} from '../../../constants/charts';
import {
  DUAL_AXIS_CHART_HEIGHT,
  CORRELATION_CHART_MARGINS,
} from '../../../constants/fitbit';

const SCRIPT_TAG_REGEX = /<\s*script\b[^>]*>([\s\S]*?)<\s*\/\s*script\s*>/gi;

const sanitizeLabel = (value) => {
  if (typeof value !== 'string') return value;
  return value.replace(SCRIPT_TAG_REGEX, '').trim();
};

/**
 * Dual-axis chart showing temporal alignment between CPAP metrics and Fitbit data.
 *
 * Primary visualization for exploring relationships between:
 * - Heart rate trends (primary y-axis, left)
 * - AHI events (secondary y-axis, right)
 * - SpO2 data (background band)
 * - Sleep stages (background sections)
 *
 * Features interactive zoom, pan, and event detail tooltips.
 * Adapts to mobile/tablet/desktop with responsive legends and margins.
 *
 * @param {Object} props - Component props
 * @param {string} props.title - Chart title, typically includes night date
 * @param {Object} props.data - Combined CPAP and Fitbit data for a single night
 * @param {Array<Date>} props.data.timestamps - Time points for data alignment
 * @param {Array<number>} props.data.heartRate - Heart rate values (BPM)
 * @param {Array<number>} props.data.spO2 - SpO2 values (%)
 * @param {Array<string>} props.data.sleepStages - Sleep stage labels per timestamp
 * @param {Array<Object>} props.data.ahiEvents - AHI event objects with time, type, severity
 * @param {Date} props.data.sleepStart - Sleep period start time
 * @param {Date} props.data.sleepEnd - Sleep period end time
 * @param {Function} [props.onRelayout] - Callback when user zooms/pans chart
 * @param {Function} [props.onEventClick] - Callback when AHI event marker clicked
 * @param {boolean} [props.showLegend=true] - Whether to show chart legend
 * @param {Object} [props.className] - CSS class for container styling
 * @returns {JSX.Element} Interactive dual-axis correlation chart
 *
 * @example
 * const nightData = {
 *   timestamps: [new Date('2026-01-24T22:00:00'), ...],
 *   heartRate: [62, 59, 61, ...],
 *   spO2: [96, 95, 97, ...],
 *   sleepStages: ['WAKE', 'LIGHT', 'DEEP', ...],
 *   ahiEvents: [
 *     { time: new Date('2026-01-24T23:15:00'), type: 'Apnea', severity: 8.5, duration: 12 },
 *     // ... more events
 *   ],
 *   sleepStart: new Date('2026-01-24T22:30:00'),
 *   sleepEnd: new Date('2026-01-25T06:45:00')
 * };
 *
 * <DualAxisSyncChart
 *   title="Heart Rate & AHI Events - January 24, 2026"
 *   data={nightData}
 *   onEventClick={(event) => openEventDetail(event)}
 *   onRelayout={(layoutEvent) => updateDateRange(layoutEvent)}
 * />
 */
function DualAxisSyncChart({
  title,
  data,
  onRelayout,
  onEventClick,
  showLegend = true,
  className = '',
}) {
  // eslint-disable-next-line no-unused-vars
  const [selectedEventIndex, setSelectedEventIndex] = useState(null); // State used via setter in handlePlotClick

  // Process data for visualization
  const processedData = useMemo(() => {
    if (!data || !data.timestamps || data.timestamps.length === 0) {
      return {
        traces: [],
        layout: {},
        isEmpty: true,
      };
    }

    const { timestamps, heartRate, spO2, ahiEvents } = data;
    // sleepStages, sleepStart, sleepEnd not used in current implementation

    // Create time series traces
    const traces = [];

    // Heart rate main trace (primary y-axis)
    if (heartRate && heartRate.length > 0) {
      traces.push({
        name: 'Heart Rate',
        x: timestamps,
        y: heartRate,
        type: 'scatter',
        mode: 'lines',
        line: {
          color: COLORS.primary,
          width: LINE_WIDTH_MEDIUM,
          shape: 'spline',
        },
        yaxis: 'y',
        hovertemplate:
          '<b>%{x|%H:%M}</b><br>Heart Rate: %{y} bpm<extra></extra>',
        connectgaps: false,
      });
    }

    // SpO2 background band (primary y-axis, scaled)
    if (spO2 && spO2.length > 0) {
      // Scale SpO2 to heart rate range for visual overlay
      const hrMin = Math.min(...heartRate.filter(Boolean)) || 40;
      const hrMax = Math.max(...heartRate.filter(Boolean)) || 100;
      const spO2Min = Math.min(...spO2.filter(Boolean)) || 90;
      const spO2Max = Math.max(...spO2.filter(Boolean)) || 100;

      const scaledSpO2 = spO2.map((val) => {
        if (!val) return null;
        // Scale SpO2 (90-100) to heart rate range
        return (
          hrMin + ((val - spO2Min) / (spO2Max - spO2Min)) * (hrMax - hrMin)
        );
      });

      traces.push({
        name: 'SpO2 (scaled)',
        x: timestamps,
        y: scaledSpO2,
        type: 'scatter',
        mode: 'lines',
        line: {
          color: COLORS.accent,
          width: LINE_WIDTH_FINE,
          dash: 'dot',
        },
        yaxis: 'y',
        opacity: 0.6,
        hovertemplate:
          '<b>%{x|%H:%M}</b><br>SpO2: %{customdata}%<extra></extra>',
        customdata: spO2,
        connectgaps: false,
      });
    }

    // AHI events scatter plot (secondary y-axis)
    if (ahiEvents && ahiEvents.length > 0) {
      const eventTimes = ahiEvents.map((event) => event.time);
      const eventSeverities = ahiEvents.map((event) => event.severity || 5);
      const eventTypes = ahiEvents.map((event) =>
        sanitizeLabel(event.type || 'Event'),
      );
      const eventDurations = ahiEvents.map((event) => event.duration || 10);

      traces.push({
        name: 'AHI Events',
        x: eventTimes,
        y: eventSeverities,
        type: 'scatter',
        mode: 'markers',
        marker: {
          color: COLORS.threshold,
          size: 8,
          symbol: 'circle',
          line: { width: 1, color: '#fff' },
        },
        yaxis: 'y2',
        hovertemplate:
          '<b>%{x|%H:%M}</b><br>' +
          'Event: %{text}<br>' +
          'Severity: %{y}<br>' +
          'Duration: %{customdata}s<extra></extra>',
        text: eventTypes,
        customdata: eventDurations,
      });
    }

    return {
      traces,
      isEmpty: false,
    };
  }, [data]);

  // Create chart layout with dual y-axes
  const chartLayout = useMemo(() => {
    const baseLayout = {
      title: title || 'Heart Rate & AHI Events Correlation',

      // Primary Y-axis (left) - Heart Rate
      yaxis: {
        title: 'Heart Rate (bpm)',
        side: 'left',
        color: COLORS.primary,
        range: [40, 120],
        gridcolor: '#f0f0f0',
        zeroline: false,
      },

      // Secondary Y-axis (right) - AHI Events
      yaxis2: {
        title: 'AHI Events per Hour',
        side: 'right',
        overlaying: 'y',
        color: COLORS.threshold,
        range: [0, 30],
        showgrid: false,
        zeroline: false,
      },

      // X-axis - Time
      xaxis: {
        title: 'Sleep Time',
        type: 'date',
        tickformat: '%H:%M',
        showspikes: true,
        spikecolor: '#999',
        spikedash: 'solid',
        spikemode: 'across',
        spikethickness: 1,
      },

      // Interactive behavior
      hovermode: 'x unified',
      dragmode: 'zoom',
      showlegend: showLegend,

      // Responsive margins
      margin: { ...CORRELATION_CHART_MARGINS.DUAL_AXIS },

      // Legend positioning
      legend: showLegend
        ? {
            ...HORIZONTAL_CENTER_LEGEND,
            y: -0.15,
          }
        : { showlegend: false },

      // Styling
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
    };

    return baseLayout;
  }, [title, showLegend]);

  // Handle event clicks
  const handlePlotClick = (event) => {
    if (!onEventClick) return;

    const clickedPoint = event.points[0];
    if (clickedPoint && clickedPoint.data.name === 'AHI Events') {
      const eventIndex = clickedPoint.pointIndex;
      setSelectedEventIndex(eventIndex); // Used for event selection tracking
      onEventClick(data.ahiEvents[eventIndex]);
    }
  };

  // Handle zoom/pan events
  const handleRelayout = (event) => {
    if (onRelayout) {
      onRelayout(event);
    }
  };

  if (processedData.isEmpty) {
    return (
      <div
        className={`dual-axis-chart-container ${className}`}
        style={{
          height: DUAL_AXIS_CHART_HEIGHT,
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
            Ensure both CPAP and Fitbit data are available for the selected
            night.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`dual-axis-chart-container ${className}`}
      data-testid="dual-axis-sync-chart"
    >
      {/* Chart accessibility summary */}
      <div
        id="dual-axis-chart-summary"
        className="sr-only"
        role="region"
        aria-label="Chart summary"
      >
        Heart rate and AHI events correlation chart for {title}. Shows{' '}
        {processedData.traces[0]?.y?.length || 0} heart rate measurements and{' '}
        {data.ahiEvents?.length || 0} AHI events during sleep period.
        {data.ahiEvents?.length > 0 &&
          ` Average AHI: ${(data.ahiEvents.reduce((sum, event) => sum + (event.severity || 0), 0) / data.ahiEvents.length).toFixed(1)} events per hour.`}
      </div>

      {/* Main chart */}
      <div
        className="chart-wrapper"
        role="img"
        aria-label={`Dual-axis correlation chart: ${title}`}
        aria-describedby="dual-axis-chart-summary"
      >
        <ThemedPlot
          useResizeHandler
          style={{
            width: '100%',
            height: `${DUAL_AXIS_CHART_HEIGHT}px`,
          }}
          data={processedData.traces}
          layout={chartLayout}
          config={{
            responsive: true,
            displaylogo: false,
            modeBarButtonsToRemove: ['lasso2d', 'select2d'],
            toImageButtonOptions: {
              format: 'png',
              filename: 'oscar-fitbit-correlation',
              height: 600,
              width: 800,
              scale: 1,
            },
            scrollZoom: false,
          }}
          onClick={handlePlotClick}
          onRelayout={handleRelayout}
        />
      </div>
    </div>
  );
}

DualAxisSyncChart.propTypes = {
  title: PropTypes.string,
  data: PropTypes.shape({
    timestamps: PropTypes.arrayOf(PropTypes.instanceOf(Date)),
    heartRate: PropTypes.arrayOf(PropTypes.number),
    spO2: PropTypes.arrayOf(PropTypes.number),
    sleepStages: PropTypes.arrayOf(PropTypes.string),
    ahiEvents: PropTypes.arrayOf(
      PropTypes.shape({
        time: PropTypes.instanceOf(Date).isRequired,
        type: PropTypes.string,
        severity: PropTypes.number,
        duration: PropTypes.number,
      }),
    ),
    sleepStart: PropTypes.instanceOf(Date),
    sleepEnd: PropTypes.instanceOf(Date),
  }).isRequired,
  onRelayout: PropTypes.func,
  onEventClick: PropTypes.func,
  showLegend: PropTypes.bool,
  className: PropTypes.string,
};

export default DualAxisSyncChart;
