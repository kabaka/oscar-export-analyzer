import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HEADER_OFFSET_PX,
  HEADER_SCROLL_MARGIN_PX,
  OBSERVER_BOTTOM_MARGIN_PERCENT,
  OBSERVER_THRESHOLDS,
  buildObserverRootMargin,
  computeTopMargin,
} from './layout.js';

describe('layout constants', () => {
  it('computes top margin from header offset', () => {
    const margin = computeTopMargin(DEFAULT_HEADER_OFFSET_PX);
    expect(margin).toBe(DEFAULT_HEADER_OFFSET_PX + HEADER_SCROLL_MARGIN_PX);
  });

  it('builds intersection observer root margin strings', () => {
    const margin = computeTopMargin(DEFAULT_HEADER_OFFSET_PX);
    const rootMargin = buildObserverRootMargin(margin);
    expect(rootMargin).toBe(
      `-${margin}px 0px -${OBSERVER_BOTTOM_MARGIN_PERCENT}% 0px`,
    );
  });

  it('uses stable observer thresholds', () => {
    expect(OBSERVER_THRESHOLDS).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });
});
