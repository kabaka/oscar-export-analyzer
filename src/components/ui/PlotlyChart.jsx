import createPlotlyComponent from 'react-plotly.js/factory';
import Plotly from 'plotly.js/lib/core';

import scatter from 'plotly.js/lib/scatter';
import bar from 'plotly.js/lib/bar';
import histogram from 'plotly.js/lib/histogram';
import histogram2d from 'plotly.js/lib/histogram2d';
import heatmap from 'plotly.js/lib/heatmap';
import box from 'plotly.js/lib/box';
import violin from 'plotly.js/lib/violin';

/**
 * Trace modules registered with the partial Plotly build.
 *
 * This list MUST cover every Plotly `type` rendered anywhere in the app. A
 * missing registration renders a blank chart at runtime (Plotly silently drops
 * unknown trace types). The set below is the audited list of trace types used
 * across all chart components:
 *
 *   - scatter      line/marker charts (AHI/EPAP/usage trends, scatter plots, …)
 *   - bar          bar charts (apnea event stats, usage patterns, …)
 *   - histogram    1-D histograms (usage distribution, EPAP, …)
 *   - histogram2d  2-D density (EpapTrendsCharts pressure/flow density)
 *   - heatmap      correlation matrix, usage calendar heatmap
 *   - box          box plots (usage/statistics box views)
 *   - violin       violin distribution view
 *
 * Keep this in sync with REGISTERED_TRACE_TYPES below and with the guard test
 * (PlotlyChart.test.jsx). Add the corresponding `plotly.js/lib/<type>` import
 * AND the registry entry when introducing a new trace type.
 */
export const REGISTERED_TRACE_TYPES = Object.freeze([
  'scatter',
  'bar',
  'histogram',
  'histogram2d',
  'heatmap',
  'box',
  'violin',
]);

Plotly.register([scatter, bar, histogram, histogram2d, heatmap, box, violin]);

const PlotlyChart = createPlotlyComponent(Plotly);

export default PlotlyChart;
