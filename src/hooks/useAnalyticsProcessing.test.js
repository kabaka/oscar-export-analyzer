import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../utils/clustering', () => {
  return {
    clusterApneaEvents: vi.fn(),
    detectFalseNegatives: vi.fn(),
    DEFAULT_CLUSTER_ALGORITHM: 'dbscan',
  };
});

vi.mock('../utils/analytics', () => ({
  finalizeClusters: vi.fn((clusters) => clusters),
}));

import { useAnalyticsProcessing } from './useAnalyticsProcessing';
import { clusterApneaEvents, detectFalseNegatives } from '../utils/clustering';
import { finalizeClusters } from '../utils/analytics';

describe('useAnalyticsProcessing', () => {
  let originalWorker;
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
    originalWorker = global.Worker;
    global.Worker = MockWorker;
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.Worker = originalWorker;
  });

  it('returns idle state when data is missing', () => {
    const { result } = renderHook(() =>
      useAnalyticsProcessing(null, { gapSec: 300 }, {}),
    );

    expect(result.current.apneaClusters).toEqual([]);
    expect(result.current.falseNegatives).toEqual([]);
    expect(result.current.processing).toBe(false);
  });

  it('processes analytics via worker and normalizes payload', () => {
    const detailsData = [
      {
        Event: 'ClearAirway',
        'Data/Duration': '12',
        DateTime: '2025-06-01T00:00:00Z',
      },
    ];

    const { result } = renderHook(() =>
      useAnalyticsProcessing(detailsData, { gapSec: 120 }, {}),
    );

    expect(result.current.processing).toBe(true);
    expect(workers).toHaveLength(1);

    act(() => {
      workers[0].onmessage?.({
        data: {
          ok: true,
          data: {
            clusters: [
              {
                start: '2025-06-01T00:00:00Z',
                end: null,
                events: [{ date: '2025-06-01T00:00:00Z' }],
              },
            ],
            falseNegatives: [{ start: '2025-06-01T00:10:00Z' }],
          },
        },
      });
    });

    expect(result.current.processing).toBe(false);
    expect(result.current.apneaClusters).toHaveLength(1);
    expect(result.current.apneaClusters[0].start).toBeInstanceOf(Date);
    expect(result.current.falseNegatives[0].end).toBeInstanceOf(Date);
  });

  it('falls back to synchronous computation when worker fails', () => {
    clusterApneaEvents.mockReturnValue([
      {
        start: '2025-06-01T00:00:00Z',
        end: '2025-06-01T00:20:00Z',
        events: [],
      },
    ]);
    detectFalseNegatives.mockReturnValue([
      { start: '2025-06-01T00:30:00Z', end: '2025-06-01T00:45:00Z' },
    ]);

    const detailsData = [
      {
        Event: 'Obstructive',
        'Data/Duration': '9',
        DateTime: '2025-06-01T00:00:00Z',
      },
    ];

    const clusterParams = { gapSec: 300, algorithm: 'dbscan' };
    const { result } = renderHook(() =>
      useAnalyticsProcessing(detailsData, clusterParams, {
        sensitivity: 'high',
      }),
    );

    act(() => {
      workers[0].onmessage?.({ data: { ok: false, error: 'boom' } });
    });

    expect(clusterApneaEvents).toHaveBeenCalledWith(
      expect.objectContaining({ gapSec: 300, events: expect.any(Array) }),
    );
    expect(finalizeClusters).toHaveBeenCalledTimes(1);
    expect(detectFalseNegatives).toHaveBeenCalledWith(detailsData, {
      sensitivity: 'high',
    });
    expect(result.current.apneaClusters).toHaveLength(1);
    expect(result.current.falseNegatives).toHaveLength(1);
    expect(result.current.processing).toBe(false);
  });

  it('ignores stale worker responses when a newer job is running', () => {
    const clusterParams = { gapSec: 120 };
    const detailsFirst = [
      {
        Event: 'ClearAirway',
        'Data/Duration': '12',
        DateTime: '2025-06-01T00:00:00Z',
      },
    ];
    const detailsSecond = [
      {
        Event: 'Obstructive',
        'Data/Duration': '6',
        DateTime: '2025-07-01T00:00:00Z',
      },
    ];

    const { result, rerender } = renderHook(
      ({ details, params, options }) =>
        useAnalyticsProcessing(details, params, options),
      {
        initialProps: {
          details: detailsFirst,
          params: clusterParams,
          options: {},
        },
      },
    );

    expect(workers).toHaveLength(1);

    rerender({ details: detailsSecond, params: clusterParams, options: {} });

    expect(workers).toHaveLength(2);
    expect(workers[0].terminate).toHaveBeenCalled();

    act(() => {
      workers[0].onmessage?.({
        data: {
          ok: true,
          data: {
            clusters: [
              {
                start: '2025-06-01T00:00:00Z',
                events: [{ date: '2025-06-01T00:00:00Z' }],
              },
            ],
            falseNegatives: [],
          },
        },
      });
    });

    // Still waiting on the latest job to complete.
    expect(result.current.processing).toBe(true);
    expect(result.current.apneaClusters).toEqual([]);

    act(() => {
      workers[1].onmessage?.({
        data: {
          ok: true,
          data: {
            clusters: [
              {
                start: '2025-07-01T00:00:00Z',
                events: [{ date: '2025-07-01T00:00:00Z' }],
              },
            ],
            falseNegatives: [
              {
                start: '2025-07-01T00:10:00Z',
              },
            ],
          },
        },
      });
    });

    expect(result.current.processing).toBe(false);
    expect(result.current.apneaClusters[0].start).toEqual(
      new Date('2025-07-01T00:00:00Z'),
    );
    expect(result.current.falseNegatives[0].start).toEqual(
      new Date('2025-07-01T00:10:00Z'),
    );
  });
});
