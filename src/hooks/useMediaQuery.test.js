import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useMediaQuery, useResponsive } from './useMediaQuery';

describe('useMediaQuery', () => {
  let mockMql;
  let matchMediaSpy;
  let listeners;

  beforeEach(() => {
    listeners = new Map();
    mockMql = {
      matches: true,
      addEventListener: vi.fn((event, cb) => {
        listeners.set(event, cb);
      }),
      removeEventListener: vi.fn(() => {
        listeners.clear();
      }),
    };

    if (!window.matchMedia) {
      window.matchMedia = vi.fn();
    }

    matchMediaSpy = vi
      .spyOn(window, 'matchMedia')
      .mockImplementation(() => mockMql);
  });

  afterEach(() => {
    listeners.clear();
    vi.restoreAllMocks();
  });

  it('returns initial match state and responds to change events', () => {
    const { result } = renderHook(() => useMediaQuery('(min-width: 800px)'));

    expect(result.current).toBe(true);
    expect(matchMediaSpy).toHaveBeenCalledWith('(min-width: 800px)');

    act(() => {
      listeners.get('change')?.({ matches: false });
    });

    expect(result.current).toBe(false);
  });

  it('cleans up the media query listener on unmount', () => {
    const { unmount } = renderHook(() => useMediaQuery('(max-width: 480px)'));

    unmount();

    expect(mockMql.removeEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function),
    );
  });
});

describe('useResponsive', () => {
  let mockMql;
  let matchMediaSpy;

  beforeEach(() => {
    mockMql = {
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    if (!window.matchMedia) {
      window.matchMedia = vi.fn();
    }

    matchMediaSpy = vi
      .spyOn(window, 'matchMedia')
      .mockImplementation(() => mockMql);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns isMobile, isTablet, isDesktop properties', () => {
    const { result } = renderHook(() => useResponsive());

    expect(result.current).toHaveProperty('isMobile');
    expect(result.current).toHaveProperty('isTablet');
    expect(result.current).toHaveProperty('isDesktop');
    expect(typeof result.current.isMobile).toBe('boolean');
    expect(typeof result.current.isTablet).toBe('boolean');
    expect(typeof result.current.isDesktop).toBe('boolean');
  });
});
