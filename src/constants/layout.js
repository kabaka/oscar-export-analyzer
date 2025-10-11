export const DEFAULT_HEADER_OFFSET_PX = 58;
export const HEADER_SCROLL_MARGIN_PX = 8;
export const OBSERVER_BOTTOM_MARGIN_RATIO = 0.7;
export const OBSERVER_THRESHOLDS = Object.freeze([0, 0.25, 0.5, 0.75, 1]);

export const OBSERVER_BOTTOM_MARGIN_PERCENT =
  OBSERVER_BOTTOM_MARGIN_RATIO * 100;

export function computeTopMargin(headerOffsetPx) {
  return headerOffsetPx + HEADER_SCROLL_MARGIN_PX;
}

export function buildObserverRootMargin(topMarginPx) {
  return `-${topMarginPx}px 0px -${OBSERVER_BOTTOM_MARGIN_PERCENT}% 0px`;
}
