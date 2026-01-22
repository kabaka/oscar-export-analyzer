import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGuide } from './useGuide';

describe('useGuide', () => {
  it('opens the mapped guide anchor for the active section', () => {
    const { result } = renderHook(() => useGuide('raw-data-explorer'));

    act(() => result.current.openGuideForActive());

    expect(result.current.guideOpen).toBe(true);
    expect(result.current.guideAnchor).toBe('raw-data-explorer');
  });

  it('reacts to open-guide events and supports closing', () => {
    const { result } = renderHook(() => useGuide('overview'));

    act(() => {
      window.dispatchEvent(
        new CustomEvent('open-guide', { detail: { anchor: 'direct-anchor' } }),
      );
    });

    expect(result.current.guideOpen).toBe(true);
    expect(result.current.guideAnchor).toBe('direct-anchor');

    act(() => result.current.closeGuide());
    expect(result.current.guideOpen).toBe(false);
  });
});
