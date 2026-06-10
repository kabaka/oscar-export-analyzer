import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { ThemedPlot } from '../../ui';
import { useEffectiveDarkMode } from '../../../hooks/useEffectiveDarkMode';
import { COLORS } from '../../../utils/colors';
import {
  HORIZONTAL_CENTER_LEGEND,
  LINE_WIDTH_FINE,
  LINE_WIDTH_MEDIUM,
} from '../../../constants/charts';
import {
  DUAL_AXIS_CHART_HEIGHT,
  CORRELATION_CHART_MARGINS,
} from '../../../constants/wearableConstants';

const SCRIPT_TAG_REGEX = /<\s*script\b[^>]*>([\s\S]*?)<\s*\/\s*script\s*>/gi;

const sanitizeLabel = (value) => {
  if (typeof value !== 'string') return value;
  return value.replace(SCRIPT_TAG_REGEX, '').trim();
};

/**
 * Dual-axis chart showing temporal alignment between CPAP metrics and wearable data.
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
 * @param {Object} props.data - Combined CPAP and wearable data for a single night
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

  const isDark = useEffectiveDarkMode();
  // applyChartTheme only themes the primary x/y axes, so the right-hand
  // (yaxis2) and overlaid SpO2 (yaxis3) labels/ticks need an explicit
  // theme-aware color to stay readable (WCAG AA) in dark mode. Values mirror
  // chartTheme.js axisColor (light #5b6472 / dark #aab2bd).
  const secondaryAxisColor = isDark ? '#aab2bd' : '#5b6472';

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

    // SpO2 line on its OWN axis (yaxis3) so it reads in true % units rather
    // than being scaled onto the heart-rate axis (clinically misleading).
    if (spO2 && spO2.length > 0) {
      traces.push({
        name: 'SpO₂',
        x: timestamps,
        y: spO2,
        type: 'scatter',
        mode: 'lines',
        line: {
          color: COLORS.accent,
          width: LINE_WIDTH_FINE,
          dash: 'dot',
        },
        yaxis: 'y3',
        opacity: 0.8,
        hovertemplate: '<b>%{x|%H:%M}</b><br>SpO₂: %{y}%<extra></extra>',
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

  // Create chart layout with three y-axes (HR, AHI, SpO2 — each in true units)
  const chartLayout = useMemo(() => {
    const baseLayout = {
      title: title || 'Heart Rate & AHI Events Correlation',

      // Primary Y-axis (left) - Heart Rate. gridcolor/color left unset so
      // applyChartTheme supplies theme-aware values; series-color emphasis is
      // kept via the legend/trace colors rather than tinting the axis.
      yaxis: {
        title: 'Heart Rate (bpm)',
        side: 'left',
        color: COLORS.primary,
        range: [40, 120],
        zeroline: false,
      },

      // Secondary Y-axis (right edge of the plot domain) - AHI Events.
      // Anchored to the x-axis so it sits at the right edge of the SHRUNK
      // plot domain (xaxis.domain[1]), leaving the strip beyond it for yaxis3.
      // standoff/automargin are set explicitly because applyChartTheme only
      // normalizes the primary x/y axes (yaxis2/yaxis3 pass through untouched),
      // so without these the right-hand axis titles can clip.
      yaxis2: {
        title: { text: 'AHI Events per Hour', standoff: 8 },
        side: 'right',
        overlaying: 'y',
        anchor: 'x',
        color: COLORS.threshold,
        range: [0, 30],
        showgrid: false,
        zeroline: false,
        automargin: true,
      },

      // Tertiary Y-axis (free, far right) - SpO2 in true % units. Range is
      // [70,100] (NOT [80,100]): genuine apnea-driven desaturations into the
      // low-80s/70s are the clinical signal, and a floor of 80 would pin/clip
      // those nadirs (visually identical to a flat 80% — the same class of
      // "misleading scaling" bug this change set out to fix). Sub-70 sentinel
      // and data-quality values (SPO2_SUBSEVENTY_FLOOR) are filtered upstream,
      // so 70 is the natural valid floor. Anchored 'free' just inside the paper
      // edge (position 0.99) so its ticks and title have room within the
      // widened right margin. Themed explicitly (applyChartTheme skips it).
      yaxis3: {
        title: { text: 'SpO₂ (%)', standoff: 8 },
        side: 'right',
        overlaying: 'y',
        anchor: 'free',
        position: 0.99,
        color: secondaryAxisColor,
        range: [70, 100],
        showgrid: false,
        zeroline: false,
        automargin: true,
      },

      // X-axis - Time. Domain shrunk on the right to [0, 0.88] so the AHI axis
      // (anchored at the domain edge) and the far-right SpO2 axis (position
      // 0.99) have a visible gap between them and neither set of tick labels
      // overlaps the other.
      xaxis: {
        title: 'Sleep Time',
        type: 'date',
        domain: [0, 0.88],
        tickformat: '%H:%M',
        showspikes: true,
        spikecolor: secondaryAxisColor,
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
  }, [title, showLegend, secondaryAxisColor]);

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
          border: '1px dashed var(--color-border)',
          borderRadius: '8px',
          backgroundColor: 'var(--color-kpi-bg)',
        }}
      >
        <div
          className="empty-state"
          style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}
        >
          <p>No correlation data available</p>
          <p style={{ fontSize: '0.9em' }}>
            Ensure both CPAP and wearable data are available for the selected
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
        Heart rate and AHI events correlation chart for {title}. Heart rate is
        shown in bpm on the left axis, AHI events per hour on the right axis,
        and SpO₂ in true percent units on a separate far-right axis (range 70 to
        100 percent). Shows {processedData.traces[0]?.y?.length || 0} heart rate
        measurements and {data.ahiEvents?.length || 0} AHI events during sleep
        period.
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
              filename: 'oscar-wearable-correlation',
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
