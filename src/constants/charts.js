/**
 * Visualization-specific constants shared across chart components.
 */

/**
 * Safety cap on the number of weeks rendered in calendar-style heatmaps.
 * Roughly corresponds to ~11.5 years of nightly data.
 */
export const MAX_CALENDAR_WEEKS = 600;

/** Default height (in px) applied to most charts unless overridden. */
export const DEFAULT_CHART_HEIGHT = 300;

export const AUTOCORRELATION_CHART_HEIGHT = 260;
export const DECOMPOSITION_CHART_HEIGHT = 360;
export const CALENDAR_HEATMAP_HEIGHT = 220;

export const DEFAULT_PLOT_MARGIN = Object.freeze({
  t: 40,
  l: 60,
  r: 20,
  b: 50,
});

export const AUTOCORRELATION_CHART_MARGIN = Object.freeze({
  t: 40,
  r: 30,
  b: 40,
  l: 50,
});

export const LINE_WIDTH_FINE = 1;
export const LINE_WIDTH_MEDIUM = 1.5;
export const LINE_WIDTH_BOLD = 2;

export const SUMMARY_DECIMAL_PLACES = 2;
export const MEDIAN_ANNOTATION_OFFSET = 1.05;
export const MEAN_ANNOTATION_OFFSET = 1.1;

export const LEGEND_CENTER_POSITION = 0.5;
export const HORIZONTAL_CENTER_LEGEND = Object.freeze({
  orientation: 'h',
  x: LEGEND_CENTER_POSITION,
  xanchor: 'center',
});

export const FALSE_NEG_SCATTER_HEIGHT = 400;
export const FALSE_NEG_SCATTER_MARGIN = Object.freeze({
  l: 80,
  r: 20,
  t: 40,
  b: 40,
});
export const FALSE_NEG_MARKER_MIN_SIZE = 6;
export const FALSE_NEG_MARKER_MAX_SIZE = 20;
export const FALSE_NEG_MARKER_DURATION_SCALE = 5;

/** Label used for the confidence interval overlays in autocorrelation charts. */
export const AUTOCORRELATION_CONFIDENCE_LABEL = '95% CI';

export const CHART_EXPORT_FORMAT = 'svg';

/**
 * Virtual table layout defaults used by RawDataExplorer and similar views.
 */
export const VIRTUAL_TABLE_ROW_HEIGHT = 28;
export const VIRTUAL_TABLE_DEFAULT_HEIGHT = 360;
export const VIRTUAL_TABLE_OVERSCAN_ROWS = 6;
export const VIRTUAL_TABLE_BUFFER_ROWS = 3;

/**
 * AHI Trends and chart analysis constants.
 */
export const LAG_INPUT_STEP = 1;
export const BAD_NIGHT_LIMIT = 10;
export const SQUARE_EXPONENT = 2;

/**
 * EPAP Trends analysis constants.
 */
export const LOESS_BANDWIDTH = 0.3;
export const RUNNING_MEDIAN_QUANTILE = 0.5;
export const RUNNING_HIGH_QUANTILE = 0.9;
export const RUNNING_QUANTILE_WINDOW = 25;
export const SCATTER_MARKER_SIZE = 6;
export const SCATTER_MARKER_OPACITY = 0.7;
export const MATRIX_AUGMENT_FACTOR = 2;
export const MIN_CORRELATION_VARS = 2;

/**
 * Statistical display precision constants.
 */
export const CORRELATION_DECIMALS = 2;
export const MANN_WHITNEY_DECIMALS = 1;
export const EFFECT_DECIMALS = 2;
export const P_VALUE_DIGITS = 2;
export const DECIMAL_PLACES_PERCENT = 1;

/**
 * Histogram and quantile analysis.
 */
export const LEAK_HISTOGRAM_BINS = 20;

/**
 * Heatmap and margin constants for correlation analysis.
 */
/* eslint-disable no-magic-numbers -- Plotly colorscale quantiles (0, 0.25, 0.5, 0.75, 1) */
export const DARK_HEATMAP_COLORSCALE = Object.freeze([
  [0, '#9e2f2f'],
  [0.25, '#d04a4a'],
  [0.5, '#1a2330'],
  [0.75, '#4a7bd0'],
  [1, '#2f5aa6'],
]);
/* eslint-enable no-magic-numbers */

export const CORR_HEATMAP_MARGIN = Object.freeze({
  t: 40,
  l: 80,
  r: 20,
  b: 80,
});

/**
 * Heatmap margin and tooltip thresholds.
 */
export const HEATMAP_MARGIN_TOP_PX = 16;
export const USAGE_HELP_TOOLTIP_MIN_COUNT = 7;

/**
 * Cluster analysis padding in milliseconds (30 seconds).
 */
export const CLUSTER_ANALYSIS_PADDING_MS = 30000;
