import React from 'react';
import { VizHelp } from '../ui';

const baseClass = 'chart-with-help';

/**
 * Wrapper component combining a chart with an inline help icon and tooltip.
 *
 * Provides consistent layout for chart + help pattern used throughout the app.
 * Renders children (typically a Plotly chart) and VizHelp tooltip side-by-side.
 *
 * @param {Object} props - Component props
 * @param {ReactNode} props.children - Chart component to wrap (typically ThemedPlot)
 * @param {string} props.text - Help tooltip text
 * @param {string} [props.className] - Additional CSS class names to append to base 'chart-with-help' class
 * @returns {JSX.Element} A div containing children and VizHelp component
 *
 * @example
 * <ChartWithHelp text="Hover to see exact values">
 *   <ThemedPlot data={...} />
 * </ChartWithHelp>
 */
function ChartWithHelp({ children, text, className }) {
  const classes = className ? `${baseClass} ${className}` : baseClass;
  return (
    <div className={classes}>
      {children}
      <VizHelp text={text} />
    </div>
  );
}

export default ChartWithHelp;
