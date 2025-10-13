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
