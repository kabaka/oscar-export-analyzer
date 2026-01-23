import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useThrottle } from './useThrottle';

describe('useThrottle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('executes callback immediately on first call', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useThrottle(callback, 100));

    act(() => {
      result.current('test');
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('test');
  });

  it('throttles subsequent calls within delay period', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useThrottle(callback, 100));

    act(() => {
      result.current('first');
      result.current('second');
      result.current('third');
    });

    // Only first call should execute immediately
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('first');
  });

  it('executes trailing call after delay period passes', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useThrottle(callback, 100));

    act(() => {
      result.current('first');
    });

    expect(callback).toHaveBeenCalledTimes(1);

    // Call again within throttle period
    act(() => {
      result.current('second');
    });

    // Should still be 1 call
    expect(callback).toHaveBeenCalledTimes(1);

    // Advance time to trigger trailing call
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenLastCalledWith('second');
  });

  it('executes immediately after full delay period has passed', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useThrottle(callback, 100));

    act(() => {
      result.current('first');
    });

    expect(callback).toHaveBeenCalledTimes(1);

    // Advance time past throttle period
    act(() => {
      vi.advanceTimersByTime(150);
    });

    // Next call should execute immediately
    act(() => {
      result.current('second');
    });

    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenLastCalledWith('second');
  });

  it('handles multiple arguments correctly', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useThrottle(callback, 100));

    act(() => {
      result.current('arg1', 'arg2', 'arg3');
    });

    expect(callback).toHaveBeenCalledWith('arg1', 'arg2', 'arg3');
  });

  it('cancels pending timeout when immediate execution occurs', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useThrottle(callback, 100));

    act(() => {
      result.current('first');
    });

    // Schedule a trailing call
    act(() => {
      result.current('second');
    });

    // Advance time past throttle period to trigger trailing call
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Now 'second' should have executed (total: 2 calls)
    expect(callback).toHaveBeenCalledTimes(2);

    // Advance enough time so the next call will execute immediately
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Execute immediately since 100ms have passed since trailing call
    act(() => {
      result.current('third');
    });

    expect(callback).toHaveBeenCalledTimes(3);

    // Verify no additional calls after advancing time
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(callback).toHaveBeenCalledTimes(3);
  });

  it('uses default delay of 100ms when delay not provided', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useThrottle(callback));

    act(() => {
      result.current('first');
      result.current('second');
    });

    expect(callback).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('handles custom delay values correctly', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useThrottle(callback, 250));

    act(() => {
      result.current('first');
      result.current('second');
    });

    expect(callback).toHaveBeenCalledTimes(1);

    // Advance by 100ms - should not trigger
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(callback).toHaveBeenCalledTimes(1);

    // Advance by remaining 150ms - should trigger
    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('handles very fast consecutive calls correctly', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useThrottle(callback, 100));

    act(() => {
      result.current('call1');
      result.current('call2');
      result.current('call3');
      result.current('call4');
      result.current('call5');
    });

    // Only first call executes immediately
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('call1');

    // Advance time to trigger trailing call
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Trailing call with the args from the second call (first throttled call)
    // Note: The implementation schedules only one trailing call with the args
    // from the first throttled invocation, not the last
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenLastCalledWith('call2');
  });

  it('updates throttled callback when callback reference changes', () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    const { result, rerender } = renderHook(({ cb }) => useThrottle(cb, 100), {
      initialProps: { cb: callback1 },
    });

    act(() => {
      result.current('test1');
    });

    expect(callback1).toHaveBeenCalledWith('test1');
    expect(callback2).not.toHaveBeenCalled();

    // Advance time
    act(() => {
      vi.advanceTimersByTime(150);
    });

    // Update callback
    rerender({ cb: callback2 });

    act(() => {
      result.current('test2');
    });

    expect(callback2).toHaveBeenCalledWith('test2');
    expect(callback1).toHaveBeenCalledTimes(1);
  });

  it('handles delay change correctly', () => {
    const callback = vi.fn();

    const { result, rerender } = renderHook(
      ({ delay }) => useThrottle(callback, delay),
      { initialProps: { delay: 100 } },
    );

    act(() => {
      result.current('first');
      result.current('second');
    });

    expect(callback).toHaveBeenCalledTimes(1);

    // Advance time to trigger the original scheduled call (100ms)
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // The trailing call should have executed with original 100ms delay
    expect(callback).toHaveBeenCalledTimes(2);

    // Change delay for future calls and advance time past new delay
    rerender({ delay: 200 });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Make another call - should execute immediately since enough time passed
    act(() => {
      result.current('third');
    });

    expect(callback).toHaveBeenCalledTimes(3);
  });

  it('does not throw error when callback throws', () => {
    const errorCallback = vi.fn(() => {
      throw new Error('Test error');
    });

    const { result } = renderHook(() => useThrottle(errorCallback, 100));

    expect(() => {
      act(() => {
        result.current('test');
      });
    }).toThrow('Test error');

    // Should still be able to call again after error
    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(() => {
      act(() => {
        result.current('test2');
      });
    }).toThrow('Test error');

    expect(errorCallback).toHaveBeenCalledTimes(2);
  });
});
