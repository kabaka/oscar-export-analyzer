import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCsvFiles } from './useCsvFiles';

describe('useCsvFiles', () => {
  let originalWorker;
  let workers;

  const createFile = (name, size = 12) => ({
    name,
    size,
    type: 'text/csv',
  });

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
    originalWorker = global.Worker;
    global.Worker = MockWorker;
  });

  afterEach(() => {
    global.Worker = originalWorker;
  });

  it('loads summary files, updates progress, and clears detail data', () => {
    const { result } = renderHook(() => useCsvFiles());

    act(() => {
      result.current.setDetailsData([{ existing: true }]);
    });

    act(() => {
      result.current.onSummaryFile({
        target: { files: [createFile('summary.csv', 20)] },
      });
    });

    expect(result.current.loadingSummary).toBe(true);
    expect(result.current.detailsData).toBeNull();
    expect(result.current.summaryProgressMax).toBe(20);

    act(() => {
      workers[0].onmessage?.({ data: { type: 'progress', cursor: 5 } });
    });
    expect(result.current.summaryProgress).toBe(5);

    act(() => {
      workers[0].onmessage?.({
        data: { type: 'rows', rows: [{ id: 'row-1' }] },
      });
    });
    expect(result.current.summaryData).toEqual([{ id: 'row-1' }]);

    act(() => {
      workers[0].onmessage?.({ data: { type: 'complete' } });
    });
    expect(result.current.loadingSummary).toBe(false);
  });

  it('terminates the worker when an abort signal is triggered', () => {
    const controller = new AbortController();
    const { result } = renderHook(() => useCsvFiles());
    const file = createFile('summary.csv');

    act(() => {
      result.current.onSummaryFile(
        { target: { files: [file] } },
        { signal: controller.signal },
      );
    });

    act(() => controller.abort());

    expect(workers[0].terminate).toHaveBeenCalledTimes(1);
    expect(result.current.loadingSummary).toBe(false);
  });

  it('sends filter flag when parsing details files', () => {
    const { result } = renderHook(() => useCsvFiles());
    const file = createFile('details.csv');

    act(() => {
      result.current.onDetailsFile({ target: { files: [file] } });
    });

    expect(workers[0].postMessage).toHaveBeenCalledWith({
      file,
      filterEvents: true,
    });
  });

  it('records worker errors and stops loading', () => {
    const { result } = renderHook(() => useCsvFiles());
    const file = createFile('summary.csv');

    act(() => {
      result.current.onSummaryFile({ target: { files: [file] } });
    });

    act(() => {
      workers[0].onmessage?.({ data: { type: 'error', error: 'bad file' } });
    });

    expect(result.current.error).toBe('bad file');
    expect(result.current.loadingSummary).toBe(false);
  });
});