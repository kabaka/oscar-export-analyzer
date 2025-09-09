import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useSessionManager from './useSessionManager.js';

// In-memory stub store to simulate IndexedDB-backed persistence
const memoryStore = { last: null };

vi.mock('../utils/db', () => {
  return {
    putLastSession: vi.fn(async (session) => {
      memoryStore.last = session;
      return true;
    }),
    getLastSession: vi.fn(async () => memoryStore.last),
    clearLastSession: vi.fn(async () => {
      memoryStore.last = null;
      return true;
    }),
  };
});

describe('useSessionManager hook', () => {
  const baseState = () => ({
    summaryData: [],
    detailsData: [],
    clusterParams: {},
    dateFilter: { start: null, end: null },
    rangeA: { start: null, end: null },
    rangeB: { start: null, end: null },
    fnPreset: 'balanced',
    setClusterParams: vi.fn(),
    setDateFilter: vi.fn(),
    setRangeA: vi.fn(),
    setRangeB: vi.fn(),
    setSummaryData: vi.fn(),
    setDetailsData: vi.fn(),
  });

  beforeEach(() => {
    memoryStore.last = null;
    vi.useFakeTimers();
    try {
      window.localStorage.removeItem('persistEnabled');
    } catch {
      // ignore storage errors
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces auto-save when enabled and supports save/load/clear controls', async () => {
    const { result } = renderHook(() => useSessionManager(baseState()));

    act(() => result.current.setPersistEnabled(true));
    vi.advanceTimersByTime(600);

    const { putLastSession, getLastSession, clearLastSession } = await import(
      '../utils/db'
    );
    expect(putLastSession).toHaveBeenCalledTimes(1);
    expect(memoryStore.last).toBeTruthy();

    await act(async () => {
      await result.current.handleSaveNow();
    });
    expect(putLastSession).toHaveBeenCalledTimes(2);

    await act(async () => {
      await result.current.handleLoadSaved();
    });
    expect(getLastSession).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.handleClearSaved();
    });
    expect(clearLastSession).toHaveBeenCalledTimes(1);
    expect(memoryStore.last).toBeNull();
  });

  it('skips invalid duration strings when loading a saved session', async () => {
    const stats = await import('../utils/stats');
    const spy = vi.spyOn(stats, 'parseDuration');

    const { buildSession } = await import('../utils/session');
    memoryStore.last = buildSession({
      summaryData: [
        {
          Date: '2021-01-01',
          'Total Time': '1:00:00',
          AHI: '1',
          'Median EPAP': '5',
        },
        {
          Date: '2021-01-02',
          'Total Time': 'bad',
          AHI: '2',
          'Median EPAP': '6',
        },
      ],
      detailsData: [],
    });

    const state = baseState();
    state.setSummaryData = (rows) => {
      rows.forEach((r) => stats.parseDuration(r['Total Time']));
    };
    const { result } = renderHook(() => useSessionManager(state));

    await act(async () => {
      await result.current.handleLoadSaved();
    });

    await vi.waitFor(() => expect(spy).toHaveBeenCalled());
    expect(spy.mock.calls.some((c) => c[0] === 'bad')).toBe(true);
    expect(spy.mock.results.some((r) => Number.isNaN(r.value))).toBe(true);
    spy.mockRestore();
  });
});
