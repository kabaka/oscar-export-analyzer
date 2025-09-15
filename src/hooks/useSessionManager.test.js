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
}));

describe('useSessionManager', () => {
  beforeEach(() => {
    memoryStore.last = null;
    vi.clearAllMocks();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const baseProps = () => ({
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

  it('auto-saves when data is present', async () => {
    const props = baseProps();
    props.summaryData = [{ AHI: '1' }];
    renderHook(() => useSessionManager(props));
    vi.advanceTimersByTime(600);
    const { putLastSession } = await import('../utils/db');
    expect(putLastSession).toHaveBeenCalledTimes(1);
    expect(memoryStore.last).not.toBeNull();
  });

  it('does not auto-save when no data is loaded', async () => {
    const props = baseProps();
    props.summaryData = null;
    props.detailsData = null;
    renderHook(() => useSessionManager(props));
    vi.advanceTimersByTime(600);
    const { putLastSession } = await import('../utils/db');
    expect(putLastSession).not.toHaveBeenCalled();
  });

  it('loads a saved session', async () => {
    memoryStore.last = buildSession({ summaryData: [{ AHI: '1' }], detailsData: [] });
    const props = baseProps();
    const setSummaryData = vi.fn();
    props.setSummaryData = setSummaryData;
    const { result } = renderHook(() => useSessionManager(props));
    await act(async () => {
      await result.current.handleLoadSaved();
    });
    const { getLastSession } = await import('../utils/db');
    expect(getLastSession).toHaveBeenCalled();
    expect(setSummaryData).toHaveBeenCalled();
  });

  it('rejects malformed session JSON', async () => {
    const props = baseProps();
    const setSummaryData = vi.fn();
    props.setSummaryData = setSummaryData;
    const { result } = renderHook(() => useSessionManager(props));

    const originalFileReader = global.FileReader;
    class MockFileReader {
      readAsText() {
        this.result = '{';
        this.onload();
      }
    }
    global.FileReader = MockFileReader;

    const file = new Blob(['{'], { type: 'application/json' });
    await expect(
      act(async () => {
        await result.current.importSessionFile(file);
      }),
    ).rejects.toBeTruthy();
    expect(setSummaryData).not.toHaveBeenCalled();

    global.FileReader = originalFileReader;
  });
});
