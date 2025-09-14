import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSessionManager } from './useSessionManager';
import { buildSession } from '../utils/session';

const memoryStore = { last: null };

vi.mock('../utils/db', () => ({
  putLastSession: vi.fn(async (session) => {
    memoryStore.last = session;
  }),
  getLastSession: vi.fn(async () => memoryStore.last),
  clearLastSession: vi.fn(async () => {
    memoryStore.last = null;
  }),
}));

describe('useSessionManager', () => {
  beforeEach(() => {
    memoryStore.last = null;
    try {
      window.localStorage.removeItem('persistEnabled');
    } catch {
      // ignore
    }
    vi.clearAllMocks();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('auto-saves when enabled', async () => {
    const { result } = renderHook(() =>
      useSessionManager({
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
      }),
    );
    act(() => result.current.setPersistEnabled(true));
    vi.advanceTimersByTime(600);
    const { putLastSession } = await import('../utils/db');
    expect(putLastSession).toHaveBeenCalledTimes(1);
  });

  it('does not auto-save when no files are loaded', async () => {
    memoryStore.last = buildSession({ summaryData: [{ AHI: '2' }] });
    try {
      window.localStorage.setItem('persistEnabled', '1');
    } catch {
      /* ignore */
    }
    renderHook(() =>
      useSessionManager({
        summaryData: null,
        detailsData: null,
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
      }),
    );
    vi.advanceTimersByTime(600);
    const { putLastSession } = await import('../utils/db');
    expect(putLastSession).not.toHaveBeenCalled();
    expect(memoryStore.last).not.toBeNull();
  });

  it('loads a saved session', async () => {
    memoryStore.last = buildSession({
      summaryData: [{ AHI: '1' }],
      detailsData: [],
    });
    const setClusterParams = vi.fn();
    const setDateFilter = vi.fn();
    const setRangeA = vi.fn();
    const setRangeB = vi.fn();
    const setSummaryData = vi.fn();
    const setDetailsData = vi.fn();
    const { result } = renderHook(() =>
      useSessionManager({
        summaryData: [],
        detailsData: [],
        clusterParams: {},
        dateFilter: { start: null, end: null },
        rangeA: { start: null, end: null },
        rangeB: { start: null, end: null },
        fnPreset: 'balanced',
        setClusterParams,
        setDateFilter,
        setRangeA,
        setRangeB,
        setSummaryData,
        setDetailsData,
      }),
    );
    await act(async () => {
      await result.current.handleLoadSaved();
    });
    const { getLastSession } = await import('../utils/db');
    expect(getLastSession).toHaveBeenCalledTimes(1);
    expect(setSummaryData).toHaveBeenCalled();
  });

  it('clears stored session when persistence is disabled', async () => {
    const { result } = renderHook(() =>
      useSessionManager({
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
      }),
    );
    act(() => result.current.setPersistEnabled(true));
    vi.advanceTimersByTime(600);
    expect(memoryStore.last).not.toBeNull();
    await act(async () => {
      result.current.setPersistEnabled(false);
    });
    const { clearLastSession } = await import('../utils/db');
    expect(clearLastSession).toHaveBeenCalledTimes(1);
    expect(memoryStore.last).toBeNull();
  });

  it('silently discards malformed JSON on import', () => {
    const setClusterParams = vi.fn();
    const setDateFilter = vi.fn();
    const setRangeA = vi.fn();
    const setRangeB = vi.fn();
    const setSummaryData = vi.fn();
    const setDetailsData = vi.fn();
    const { result } = renderHook(() =>
      useSessionManager({
        summaryData: [],
        detailsData: [],
        clusterParams: {},
        dateFilter: { start: null, end: null },
        rangeA: { start: null, end: null },
        rangeB: { start: null, end: null },
        fnPreset: 'balanced',
        setClusterParams,
        setDateFilter,
        setRangeA,
        setRangeB,
        setSummaryData,
        setDetailsData,
      }),
    );

    const badFile = new File(['{ not json'], 'bad.json', {
      type: 'application/json',
    });

    const mockReader = {
      onload: null,
      readAsText: vi.fn(function () {
        this.result = '{ not json';
        this.onload();
      }),
    };

    const fileReaderSpy = vi
      .spyOn(window, 'FileReader')
      .mockImplementation(() => mockReader);
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    act(() => {
      result.current.handleImportJson({ target: { files: [badFile] } });
    });

    expect(setClusterParams).not.toHaveBeenCalled();
    expect(setDateFilter).not.toHaveBeenCalled();
    expect(setRangeA).not.toHaveBeenCalled();
    expect(setRangeB).not.toHaveBeenCalled();
    expect(setSummaryData).not.toHaveBeenCalled();
    expect(setDetailsData).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    fileReaderSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });
});
