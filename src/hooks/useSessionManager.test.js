import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSessionManager } from './useSessionManager';
import { useCsvFiles } from './useCsvFiles';
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

describe('useCsvFiles worker management', () => {
  const originalWorker = global.Worker;
  let workers;

  class MockWorker {
    constructor() {
      this.postMessage = vi.fn();
      this.terminate = vi.fn();
      this.onmessage = null;
      workers.push(this);
    }
  }

  beforeEach(() => {
    workers = [];
    global.Worker = MockWorker;
  });

  afterEach(() => {
    global.Worker = originalWorker;
  });

  const createFile = (name) => ({ name, size: 10, type: 'text/csv' });

  it('terminates the previous worker and replaces rows when a new upload starts', () => {
    const { result } = renderHook(() => useCsvFiles());

    act(() => {
      result.current.onSummaryFile({ target: { files: [createFile('first.csv')] } });
    });

    expect(workers).toHaveLength(1);
    const firstWorker = workers[0];

    act(() => {
      firstWorker.onmessage?.({
        data: { type: 'rows', rows: [{ id: 'first-row' }] },
      });
    });

    expect(result.current.summaryData).toEqual([{ id: 'first-row' }]);

    act(() => {
      result.current.onSummaryFile({ target: { files: [createFile('second.csv')] } });
    });

    expect(firstWorker.terminate).toHaveBeenCalledTimes(1);
    expect(workers).toHaveLength(2);

    const secondWorker = workers[1];

    act(() => {
      firstWorker.onmessage?.({
        data: { type: 'rows', rows: [{ id: 'stale-row' }] },
      });
      secondWorker.onmessage?.({
        data: { type: 'rows', rows: [{ id: 'second-row' }] },
      });
    });

    expect(result.current.summaryData).toEqual([{ id: 'second-row' }]);
  });
});
