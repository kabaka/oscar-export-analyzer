import React from 'react';
import PropTypes from 'prop-types';
import Plot from 'react-plotly.js';
import { useEffectiveDarkMode } from '../../hooks/useEffectiveDarkMode';
import { applyChartTheme } from '../../utils/chartTheme';
import {
  getResponsiveChartLayout,
  getResponsiveChartConfig,
} from '../../utils/chartConfig';

/**
 * Wrapper component for Plotly charts with automatic dark/light theme switching
 * and responsive sizing for mobile, tablet, and desktop viewports.
 *
 * Responds to system and user theme preferences, automatically applying
 * appropriate colors, fonts, and styles to charts for consistent visual experience.
 * Also applies responsive font sizes, margins, and legend positions based on viewport.
 * Remounts on theme change to ensure proper Plotly rendering.
 *
 * All standard Plotly.js props are passed through; theme and responsive settings
 * are applied to the layout and config.
 *
 * @param {Object} props - Component props
 * @param {Object} props.layout - Plotly layout configuration object (title, axes, etc.)
 *   Theme colors and responsive settings will be merged into this layout
 * @param {Array<Object>} props.data - Plotly data traces (scatter, bar, histogram, etc.)
 * @param {string} [props.style] - CSS style for the Plot wrapper div
 * @param {Function} [props.onRelayout] - Callback when layout changes (e.g., zoom, pan)
 * @param {Function} [props.onHover] - Callback when hovering over data points
 * @param {Object} [props.config] - Plotly config (displayModeBar, toImageButtonOptions, etc.)
 *   Responsive config will be merged with this
 * @param {boolean} [props.useResizeHandler=true] - Enable Plotly's resize handler for responsive charts
 * @returns {JSX.Element} A react-plotly Plot component with themed and responsive layout
 *
 * @example
 * <ThemedPlot
 *   data={[{ x: dates, y: ahis, type: 'scatter' }]}
 *   layout={{ title: 'AHI Over Time', xaxis: { title: 'Date' } }}
 *   style={{ width: '100%', height: '100%' }}
 *   useResizeHandler={true}
 * />
 *
 * @see applyChartTheme - Theme application utility
 * @see getResponsiveChartLayout - Responsive layout configuration
 * @see getResponsiveChartConfig - Responsive config (mode bar, touch interactions)
 * @see useEffectiveDarkMode - Dark mode detection hook
 */
export default function ThemedPlot({
  layout,
  config,
  useResizeHandler = true,
  ...props
}) {
  const isDark = useEffectiveDarkMode();

  // Apply theme, then responsive settings
  const themedLayout = applyChartTheme(isDark, layout);
  const responsiveLayout = getResponsiveChartLayout(themedLayout);

  // Merge user config with responsive defaults
  const responsiveConfig = {
    ...getResponsiveChartConfig(),
    ...config,
  };

  return (
    <Plot
      key={isDark ? 'dark' : 'light'}
      layout={responsiveLayout}
      config={responsiveConfig}
      useResizeHandler={useResizeHandler}
      {...props}
    />
  );
}

ThemedPlot.propTypes = {
  layout: PropTypes.object.isRequired,
  data: PropTypes.arrayOf(PropTypes.object),
  style: PropTypes.object,
  onRelayout: PropTypes.func,
  onHover: PropTypes.func,
  config: PropTypes.object,
  useResizeHandler: PropTypes.bool,
};
