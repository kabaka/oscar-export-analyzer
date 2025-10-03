import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAnalyticsProcessing } from './useAnalyticsProcessing';

const baseParams = {
  gapSec: 120,
  bridgeThreshold: 0.7,
  bridgeSec: 90,
  minCount: 3,
  minTotalSec: 60,
  maxClusterSec: 600,
  minDensity: 0,
  edgeEnter: 2,
  edgeExit: 1,
};

const fnOptions = {
  flThreshold: 0.7,
  confidenceMin: 0.9,
  gapSec: 60,
  minDurationSec: 60,
};

const DETAILS_DATA = [
  {
    Event: 'ClearAirway',
    DateTime: '2024-01-01T00:00:00',
    'Data/Duration': '30',
  },
  {
    Event: 'Obstructive',
    DateTime: '2024-01-01T00:04:00',
    'Data/Duration': '25',
  },
  {
    Event: 'Mixed',
    DateTime: '2024-01-01T00:07:00',
    'Data/Duration': '20',
  },
  {
    Event: 'FLG',
    DateTime: '2024-01-01T00:07:30',
    'Data/Duration': '0.9',
  },
];

describe('useAnalyticsProcessing', () => {
  const originalWorker = global.Worker;

  afterEach(() => {
    global.Worker = originalWorker;
  });

  it('uses the analytics worker when available', async () => {
    class MockWorker {
      postMessage() {
        setTimeout(() => {
          this.onmessage?.({
            data: {
              ok: true,
              data: {
                clusters: [
                  {
                    count: 3,
                    durationSec: 120,
                    events: [
                      {
                        durationSec: 30,
                        date: new Date('2024-01-01T00:00:00Z'),
                      },
                      {
                        durationSec: 45,
                        date: new Date('2024-01-01T00:03:00Z'),
                      },
                      {
                        durationSec: 45,
                        date: new Date('2024-01-01T00:06:00Z'),
                      },
                    ],
                  },
                ],
                falseNegatives: [{ id: 'fn-1' }],
              },
            },
          });
        }, 0);
      }
      terminate() {}
    }
    global.Worker = MockWorker;

    const { result } = renderHook(() =>
      useAnalyticsProcessing(DETAILS_DATA, baseParams, fnOptions),
    );

    await waitFor(() => {
      expect(result.current.processingDetails).toBe(false);
      expect(result.current.apneaClusters).toHaveLength(1);
    });

    expect(result.current.falseNegatives).toHaveLength(1);
    expect(result.current.apneaClusters[0]).toHaveProperty('severity');
  });

  it('falls back to in-thread processing when workers fail', async () => {
    global.Worker = vi.fn(() => {
      throw new Error('no worker');
    });

    const { result } = renderHook(() =>
      useAnalyticsProcessing(DETAILS_DATA, baseParams, fnOptions),
    );

    await waitFor(() => {
      expect(result.current.processingDetails).toBe(false);
      expect(Array.isArray(result.current.apneaClusters)).toBe(true);
    });

    expect(Array.isArray(result.current.falseNegatives)).toBe(true);
    expect(global.Worker).toHaveBeenCalled();
  });
});
