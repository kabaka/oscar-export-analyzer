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

/** Label used for the confidence interval overlays in autocorrelation charts. */
export const AUTOCORRELATION_CONFIDENCE_LABEL = '95% CI';

/**
 * Virtual table layout defaults used by RawDataExplorer and similar views.
 */
export const VIRTUAL_TABLE_ROW_HEIGHT = 28;
export const VIRTUAL_TABLE_DEFAULT_HEIGHT = 360;
export const VIRTUAL_TABLE_OVERSCAN_ROWS = 6;
export const VIRTUAL_TABLE_BUFFER_ROWS = 3;
