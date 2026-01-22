import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEffectiveDarkMode } from './useEffectiveDarkMode';

describe('useEffectiveDarkMode', () => {
  let originalMutationObserver;
  let originalMatchMedia;
  let mutationCallbacks;
  let mediaQuery;

  beforeEach(() => {
    mutationCallbacks = [];
    originalMutationObserver = global.MutationObserver;
    originalMatchMedia = window.matchMedia;

    class MockMutationObserver {
      constructor(callback) {
        this.callback = callback;
        mutationCallbacks.push(callback);
      }
      observe() {}
      disconnect() {}
    }

    mediaQuery = {
      matches: false,
      listener: null,
      addEventListener: vi.fn((_, cb) => {
        mediaQuery.listener = cb;
      }),
      removeEventListener: vi.fn(),
    };

    global.MutationObserver = MockMutationObserver;
    window.matchMedia = vi.fn(() => mediaQuery);
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    global.MutationObserver = originalMutationObserver;
    window.matchMedia = originalMatchMedia;
  });

  it('follows explicit data-theme attribute changes', () => {
    document.documentElement.setAttribute('data-theme', 'light');
    const { result } = renderHook(() => useEffectiveDarkMode());

    expect(result.current).toBe(false);

    act(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
      mutationCallbacks.forEach((cb) => cb());
    });

    expect(result.current).toBe(true);
  });

  it('responds to system preference changes when in system mode', () => {
    const { result } = renderHook(() => useEffectiveDarkMode());

    expect(result.current).toBe(false);

    act(() => {
      mediaQuery.matches = true;
      mediaQuery.listener?.({ matches: true });
    });

    expect(result.current).toBe(true);
  });
});
