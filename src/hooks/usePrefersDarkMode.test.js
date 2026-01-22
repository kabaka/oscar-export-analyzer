import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePrefersDarkMode } from './usePrefersDarkMode';

describe('usePrefersDarkMode', () => {
  let originalMatchMedia;
  let mediaQuery;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    mediaQuery = {
      matches: true,
      listener: null,
      addEventListener: vi.fn((_, cb) => {
        mediaQuery.listener = cb;
      }),
      removeEventListener: vi.fn(),
    };
    window.matchMedia = vi.fn(() => mediaQuery);
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('returns the current system preference and updates on change', () => {
    const { result } = renderHook(() => usePrefersDarkMode());

    expect(result.current).toBe(true);

    act(() => {
      mediaQuery.matches = false;
      mediaQuery.listener?.({ matches: false });
    });

    expect(result.current).toBe(false);
  });
});
