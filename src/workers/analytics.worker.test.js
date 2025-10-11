import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';
import { DEFAULT_APNEA_CLUSTER_GAP_SEC } from '../test-utils/testConstants';

const finalizeClustersMock = vi.fn();
const clusterApneaEventsMock = vi.fn();
const detectFalseNegativesMock = vi.fn();

vi.mock('../utils/analytics.js', () => ({
  finalizeClusters: finalizeClustersMock,
}));

vi.mock('../utils/clustering.js', () => ({
  clusterApneaEvents: clusterApneaEventsMock,
  detectFalseNegatives: detectFalseNegativesMock,
  DEFAULT_CLUSTER_ALGORITHM: 'bridged',
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

    const gapSec = DEFAULT_APNEA_CLUSTER_GAP_SEC;
    const bridgeThreshold = 0.5;
    const bridgeSec = 30;
    const edgeEnter = 1;
    const edgeExit = 0.3;
    const minDensity = 0.2;
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
          gapSec,
          bridgeThreshold,
          bridgeSec,
          edgeEnter,
          edgeExit,
          minDensity,
        },
        fnOptions: { foo: 'bar' },
      },
    };

    global.self.onmessage({ data: payload });

    expect(clusterApneaEventsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        algorithm: 'bridged',
        events: expect.any(Array),
        flgEvents: expect.any(Array),
        gapSec: payload.payload.params.gapSec,
      }),
    );
    expect(finalizeClustersMock).toHaveBeenCalledWith(
      rawClusters,
      payload.payload.params,
    );
    expect(detectFalseNegativesMock).toHaveBeenCalledWith(
      payload.payload.detailsData,
      {
        foo: 'bar',
      },
    );
    expect(postMessage).toHaveBeenCalledWith({
      ok: true,
      data: { clusters: postedClusters, falseNegatives: ['fn'] },
    });
  });
});
