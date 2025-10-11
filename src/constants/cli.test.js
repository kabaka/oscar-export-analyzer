import { describe, expect, it } from 'vitest';
import {
  CLI_DEFAULTS,
  CLUSTER_ALGORITHMS,
  DEFAULT_APNEA_CLUSTER_GAP_SEC,
  DEFAULT_CLUSTER_ALGORITHM,
  DEFAULT_FLG_BRIDGE_THRESHOLD,
  DEFAULT_FLG_CLUSTER_GAP_SEC,
  DEFAULT_KMEANS_K,
  DEFAULT_SINGLE_LINK_GAP_SEC,
} from './cli.js';
import { CLUSTERING_DEFAULTS } from '../utils/clustering.js';

describe('cli constants', () => {
  it('stay in sync with clustering defaults', () => {
    expect(DEFAULT_APNEA_CLUSTER_GAP_SEC).toBe(
      CLUSTERING_DEFAULTS.APNEA_GAP_SEC,
    );
    expect(DEFAULT_FLG_BRIDGE_THRESHOLD).toBe(
      CLUSTERING_DEFAULTS.FLG_BRIDGE_THRESHOLD,
    );
    expect(DEFAULT_FLG_CLUSTER_GAP_SEC).toBe(
      CLUSTERING_DEFAULTS.FLG_CLUSTER_GAP_SEC,
    );
    expect(DEFAULT_KMEANS_K).toBe(CLUSTERING_DEFAULTS.KMEANS_K);
    expect(DEFAULT_SINGLE_LINK_GAP_SEC).toBe(DEFAULT_APNEA_CLUSTER_GAP_SEC);
  });

  it('exposes consistent CLI defaults', () => {
    expect(CLI_DEFAULTS).toMatchObject({
      gapSec: DEFAULT_APNEA_CLUSTER_GAP_SEC,
      bridgeThreshold: DEFAULT_FLG_BRIDGE_THRESHOLD,
      bridgeSec: DEFAULT_FLG_CLUSTER_GAP_SEC,
      algorithm: DEFAULT_CLUSTER_ALGORITHM,
      k: DEFAULT_KMEANS_K,
      linkageThresholdSec: DEFAULT_SINGLE_LINK_GAP_SEC,
    });
  });

  it('exports known clustering algorithms', () => {
    expect(CLUSTER_ALGORITHMS).toEqual({
      BRIDGED: 'bridged',
      KMEANS: 'kmeans',
      AGGLOMERATIVE: 'agglomerative',
    });
  });
});
