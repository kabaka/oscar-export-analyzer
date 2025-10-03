import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';

const finalizeClustersMock = vi.fn();
const clusterApneaEventsMock = vi.fn();
const detectFalseNegativesMock = vi.fn();

vi.mock('../utils/analytics.js', () => ({
  finalizeClusters: finalizeClustersMock,
}));

vi.mock('../utils/clustering.js', () => ({
  clusterApneaEvents: clusterApneaEventsMock,
  detectFalseNegatives: detectFalseNegativesMock,
}));

describe('analytics.worker', () => {
  beforeEach(() => {
    finalizeClustersMock.mockReset();
    clusterApneaEventsMock.mockReset();
    detectFalseNegativesMock.mockReset();
    vi.resetModules();
  });

  afterEach(() => {
    delete global.self;
  });

  it('finalizes clusters before posting results', async () => {
    const postedClusters = [{ id: 'final', severity: 'high' }];
    const rawClusters = [{ id: 'raw', count: 3 }];

    finalizeClustersMock.mockReturnValue(postedClusters);
    clusterApneaEventsMock.mockReturnValue(rawClusters);
    detectFalseNegativesMock.mockReturnValue(['fn']);

    const postMessage = vi.fn();
    global.self = { postMessage };

    await import('./analytics.worker.js');

    expect(typeof global.self.onmessage).toBe('function');

    const payload = {
      action: 'analyzeDetails',
      payload: {
        detailsData: [
          {
            Event: 'ClearAirway',
            DateTime: '2025-06-01T00:00:00',
            'Data/Duration': '12',
          },
          {
            Event: 'FLG',
            DateTime: '2025-06-01T00:00:12',
            'Data/Duration': '0.8',
          },
        ],
        params: {
          gapSec: 120,
          bridgeThreshold: 0.5,
          bridgeSec: 30,
          edgeEnter: 1,
          edgeExit: 0.3,
          minDensity: 0.2,
        },
        fnOptions: { foo: 'bar' },
      },
    };

    global.self.onmessage({ data: payload });

    expect(clusterApneaEventsMock).toHaveBeenCalled();
    expect(finalizeClustersMock).toHaveBeenCalledWith(rawClusters, payload.payload.params);
    expect(detectFalseNegativesMock).toHaveBeenCalledWith(payload.payload.detailsData, {
      foo: 'bar',
    });
    expect(postMessage).toHaveBeenCalledWith({
      ok: true,
      data: { clusters: postedClusters, falseNegatives: ['fn'] },
    });
  });
});
