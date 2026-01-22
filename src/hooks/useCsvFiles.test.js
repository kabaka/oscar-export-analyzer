/* eslint-disable no-magic-numbers -- test-specific file sizes and line counts */
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

  const workerIdFor = (idx = 0) =>
    workers[idx]?.postMessage?.mock.calls?.[0]?.[0]?.workerId;

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
      workers[0].onmessage?.({
        data: { workerId: workerIdFor(0), type: 'progress', cursor: 5 },
      });
    });
    expect(result.current.summaryProgress).toBe(5);

    act(() => {
      workers[0].onmessage?.({
        data: {
          workerId: workerIdFor(0),
          type: 'rows',
          rows: [{ id: 'row-1' }],
        },
      });
    });
    expect(result.current.summaryData).toEqual([{ id: 'row-1' }]);

    act(() => {
      workers[0].onmessage?.({
        data: { workerId: workerIdFor(0), type: 'complete' },
      });
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

    expect(workers[0].postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        file,
        filterEvents: true,
      }),
    );
  });

  it('records worker errors and stops loading', () => {
    const { result } = renderHook(() => useCsvFiles());
    const file = createFile('summary.csv');

    act(() => {
      result.current.onSummaryFile({ target: { files: [file] } });
    });

    act(() => {
      workers[0].onmessage?.({
        data: { workerId: workerIdFor(0), type: 'error', error: 'bad file' },
      });
    });

    expect(result.current.error).toBe('bad file');
    expect(result.current.loadingSummary).toBe(false);
  });

  describe('file size limits', () => {
    const MB = 1024 * 1024;

    it('accepts files under 100 MB with no warning', () => {
      const { result } = renderHook(() => useCsvFiles());
      const file = createFile('summary.csv', 99 * MB);

      act(() => {
        result.current.onSummaryFile({ target: { files: [file] } });
      });

      expect(result.current.warning).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.loadingSummary).toBe(true);
    });

    it('shows warning for files >= 100 MB but < 150 MB', () => {
      const { result } = renderHook(() => useCsvFiles());
      const file = createFile('summary.csv', 100 * MB);

      act(() => {
        result.current.onSummaryFile({ target: { files: [file] } });
      });

      expect(result.current.warning).toBe(
        'Large file detected (over 100 MB). Parsing may take ~5 s and use ~1 GB memory. Please keep other tabs light.',
      );
      expect(result.current.error).toBeNull();
      expect(result.current.loadingSummary).toBe(true);
    });

    it('allows 150 MB files with warning (limit is > 150)', () => {
      const { result } = renderHook(() => useCsvFiles());
      const file = createFile('summary.csv', 150 * MB);

      act(() => {
        result.current.onSummaryFile({ target: { files: [file] } });
      });

      expect(result.current.warning).toBe(
        'Large file detected (over 100 MB). Parsing may take ~5 s and use ~1 GB memory. Please keep other tabs light.',
      );
      expect(result.current.error).toBeNull();
      expect(result.current.loadingSummary).toBe(true);
      expect(workers).toHaveLength(1);
    });

    it('shows warning for files at 149 MB', () => {
      const { result } = renderHook(() => useCsvFiles());
      const file = createFile('summary.csv', 149 * MB);

      act(() => {
        result.current.onSummaryFile({ target: { files: [file] } });
      });

      expect(result.current.warning).toBe(
        'Large file detected (over 100 MB). Parsing may take ~5 s and use ~1 GB memory. Please keep other tabs light.',
      );
      expect(result.current.error).toBeNull();
      expect(result.current.loadingSummary).toBe(true);
    });

    it('blocks files over 150 MB with error', () => {
      const { result } = renderHook(() => useCsvFiles());
      const file = createFile('summary.csv', 151 * MB);

      act(() => {
        result.current.onSummaryFile({ target: { files: [file] } });
      });

      expect(result.current.error).toBe(
        'File exceeds 150MB limit. Please contact support if you need to analyze larger datasets.',
      );
      expect(result.current.loadingSummary).toBe(false);
      expect(workers.length).toBe(0); // No worker created
    });

    it('clears warning when loading smaller file after large one', () => {
      const { result } = renderHook(() => useCsvFiles());

      // First load large file
      act(() => {
        result.current.onSummaryFile({
          target: { files: [createFile('large.csv', 120 * MB)] },
        });
      });
      expect(result.current.warning).not.toBeNull();

      // Then load small file
      act(() => {
        result.current.onSummaryFile({
          target: { files: [createFile('small.csv', 50 * MB)] },
        });
      });
      expect(result.current.warning).toBeNull();
      expect(result.current.loadingSummary).toBe(true);
    });

    describe('details file size handling', () => {
      it('allows details files under 100 MB with no warning', () => {
        const { result } = renderHook(() => useCsvFiles());
        const file = createFile('details.csv', 99 * MB);

        act(() => {
          result.current.onDetailsFile({ target: { files: [file] } });
        });

        expect(result.current.warning).toBeNull();
        expect(result.current.error).toBeNull();
        expect(result.current.loadingDetails).toBe(true);
        expect(workers).toHaveLength(1);
      });

      it('warns for details files at 100 MB', () => {
        const { result } = renderHook(() => useCsvFiles());
        const file = createFile('details.csv', 100 * MB);

        act(() => {
          result.current.onDetailsFile({ target: { files: [file] } });
        });

        expect(result.current.warning).toBe(
          'Large file detected (over 100 MB). Parsing may take ~5 s and use ~1 GB memory. Please keep other tabs light.',
        );
        expect(result.current.error).toBeNull();
        expect(result.current.loadingDetails).toBe(true);
        expect(workers).toHaveLength(1);
      });

      it('warns for details files at 150 MB', () => {
        const { result } = renderHook(() => useCsvFiles());
        const file = createFile('details.csv', 150 * MB);

        act(() => {
          result.current.onDetailsFile({ target: { files: [file] } });
        });

        expect(result.current.warning).toBe(
          'Large file detected (over 100 MB). Parsing may take ~5 s and use ~1 GB memory. Please keep other tabs light.',
        );
        expect(result.current.error).toBeNull();
        expect(result.current.loadingDetails).toBe(true);
        expect(workers).toHaveLength(1);
      });

      it('blocks details files over 150 MB and does not create worker', () => {
        const { result } = renderHook(() => useCsvFiles());
        const file = createFile('details.csv', 151 * MB);

        act(() => {
          result.current.onDetailsFile({ target: { files: [file] } });
        });

        expect(result.current.error).toBe(
          'File exceeds 150MB limit. Please contact support if you need to analyze larger datasets.',
        );
        expect(result.current.warning).toBeNull();
        expect(result.current.loadingDetails).toBe(false);
        expect(workers).toHaveLength(0);
      });
    });
  });

  it('terminates prior worker and resets progress when switching summary files', () => {
    const { result } = renderHook(() => useCsvFiles());
    const first = createFile('summary-a.csv', 10);
    const second = createFile('summary-b.csv', 20);

    act(() => {
      result.current.onSummaryFile({ target: { files: [first] } });
    });

    act(() => {
      workers[0].onmessage?.({
        data: { workerId: workerIdFor(0), type: 'progress', cursor: 5 },
      });
    });
    expect(result.current.summaryProgress).toBe(5);

    act(() => {
      result.current.onSummaryFile({ target: { files: [second] } });
    });

    expect(workers[0].terminate).toHaveBeenCalledTimes(1);
    expect(result.current.summaryProgress).toBe(0);
    expect(result.current.summaryProgressMax).toBe(20);
    expect(result.current.loadingSummary).toBe(true);
    expect(workers).toHaveLength(2);
  });

  it('clears warning and error after hard-cap rejection when next file is valid', () => {
    const { result } = renderHook(() => useCsvFiles());
    const tooLarge = createFile('summary-big.csv', 151 * 1024 * 1024);
    const small = createFile('summary-small.csv', 10 * 1024 * 1024);

    act(() => {
      result.current.onSummaryFile({ target: { files: [tooLarge] } });
    });

    expect(result.current.error).toBe(
      'File exceeds 150MB limit. Please contact support if you need to analyze larger datasets.',
    );
    expect(result.current.warning).toBeNull();
    expect(workers).toHaveLength(0);

    act(() => {
      result.current.onSummaryFile({ target: { files: [small] } });
    });

    expect(result.current.error).toBeNull();
    expect(result.current.warning).toBeNull();
    expect(result.current.loadingSummary).toBe(true);
    expect(workers).toHaveLength(1);
  });
});
