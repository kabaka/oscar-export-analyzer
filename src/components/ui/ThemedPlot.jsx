import React from 'react';
import Plot from 'react-plotly.js';
import { useEffectiveDarkMode } from '../../hooks/useEffectiveDarkMode';
import { applyChartTheme } from '../../utils/chartTheme';

export default function ThemedPlot({ layout, ...props }) {
  const isDark = useEffectiveDarkMode();
  const themedLayout = applyChartTheme(isDark, layout);
  return (
    <Plot key={isDark ? 'dark' : 'light'} layout={themedLayout} {...props} />
  );
}
