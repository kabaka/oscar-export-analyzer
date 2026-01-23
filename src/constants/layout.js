/* eslint-disable no-magic-numbers -- canonical layout metrics */
export const DEFAULT_HEADER_OFFSET_PX = 58;
export const HEADER_SCROLL_MARGIN_PX = 8;
export const OBSERVER_BOTTOM_MARGIN_RATIO = 0.7;

export const OBSERVER_THRESHOLD_MIN = 0;
export const OBSERVER_THRESHOLD_QUARTER = 0.25;
export const OBSERVER_THRESHOLD_HALF = 0.5;
export const OBSERVER_THRESHOLD_THREE_QUARTERS = 0.75;
export const OBSERVER_THRESHOLD_MAX = 1;

export const OBSERVER_THRESHOLDS = Object.freeze([
  OBSERVER_THRESHOLD_MIN,
  OBSERVER_THRESHOLD_QUARTER,
  OBSERVER_THRESHOLD_HALF,
  OBSERVER_THRESHOLD_THREE_QUARTERS,
  OBSERVER_THRESHOLD_MAX,
]);

export const OBSERVER_BOTTOM_MARGIN_PERCENT =
  OBSERVER_BOTTOM_MARGIN_RATIO * 100;

/**
 * Section spacing and component layout metrics.
 */
export const LEAK_SECTION_MARGIN_TOP_PX = 16;
export const PARTIAL_CORR_MARGIN_TOP_PX = 12;
export const TITRATION_SECTION_MARGIN_TOP_PX = 8;
export const PRESET_GAP_PX = 12;

/**
 * Calendar heatmap and date handling layout.
 */
export const MONDAY_INDEX_OFFSET = 6;

/**
 * UI opacity settings.
 */
export const PRESET_DESCRIPTION_OPACITY = 0.8;

export function computeTopMargin(headerOffsetPx) {
  return headerOffsetPx + HEADER_SCROLL_MARGIN_PX;
}

export function buildObserverRootMargin(topMarginPx) {
  return `-${topMarginPx}px 0px -${OBSERVER_BOTTOM_MARGIN_PERCENT}% 0px`;
}
