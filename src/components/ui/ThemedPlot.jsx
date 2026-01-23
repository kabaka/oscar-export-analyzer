import React from 'react';
import Plot from 'react-plotly.js';
import { useEffectiveDarkMode } from '../../hooks/useEffectiveDarkMode';
import { applyChartTheme } from '../../utils/chartTheme';

/**
 * Wrapper component for Plotly charts with automatic dark/light theme switching.
 *
 * Responds to system and user theme preferences, automatically applying
 * appropriate colors, fonts, and styles to charts for consistent visual experience.
 * Remounts on theme change to ensure proper Plotly rendering.
 *
 * All standard Plotly.js props are passed through; theme is applied to the layout.
 *
 * @param {Object} props - Component props
 * @param {Object} props.layout - Plotly layout configuration object (title, axes, etc.)
 *   Theme colors will be merged into this layout
 * @param {Array<Object>} props.data - Plotly data traces (scatter, bar, histogram, etc.)
 * @param {string} [props.style] - CSS style for the Plot wrapper div
 * @param {Function} [props.onRelayout] - Callback when layout changes (e.g., zoom, pan)
 * @param {Function} [props.onHover] - Callback when hovering over data points
 * @param {Object} [props.config] - Plotly config (displayModeBar, toImageButtonOptions, etc.)
 * @returns {JSX.Element} A react-plotly Plot component with themed layout
 *
 * @example
 * <ThemedPlot
 *   data={[{ x: dates, y: ahis, type: 'scatter' }]}
 *   layout={{ title: 'AHI Over Time', xaxis: { title: 'Date' } }}
 *   style={{ width: '100%', height: '600px' }}
 * />
 *
 * @see applyChartTheme - Theme application utility
 * @see useEffectiveDarkMode - Dark mode detection hook
 */
export default function ThemedPlot({ layout, ...props }) {
  const isDark = useEffectiveDarkMode();
  const themedLayout = applyChartTheme(isDark, layout);
  return (
    <Plot key={isDark ? 'dark' : 'light'} layout={themedLayout} {...props} />
  );
}
