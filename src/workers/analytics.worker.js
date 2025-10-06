// Analytics Web Worker: clusters apnea events and detects false negatives off the main thread.
// Vite will bundle this as a module worker.
import {
  clusterApneaEvents,
  detectFalseNegatives,
  DEFAULT_CLUSTER_ALGORITHM,
} from '../utils/clustering.js';
import { finalizeClusters } from '../utils/analytics.js';

self.onmessage = (e) => {
  const { action, payload } = e.data || {};
  if (action === 'analyzeDetails') {
    const { detailsData, params, fnOptions } = payload || {};
    try {
      const apneaEvents = detailsData
        .filter((r) =>
          ['ClearAirway', 'Obstructive', 'Mixed'].includes(r['Event']),
        )
        .map((r) => ({
          date: new Date(r['DateTime']),
          durationSec: parseFloat(r['Data/Duration']),
        }));
      const flgEvents = detailsData
        .filter((r) => r['Event'] === 'FLG')
        .map((r) => ({
          date: new Date(r['DateTime']),
          level: parseFloat(r['Data/Duration']),
        }));
      const rawClusters = clusterApneaEvents({
        algorithm: params.algorithm || DEFAULT_CLUSTER_ALGORITHM,
        events: apneaEvents,
        flgEvents,
        gapSec: params.gapSec,
        bridgeThreshold: params.bridgeThreshold,
        bridgeSec: params.bridgeSec,
        edgeEnter: params.edgeEnter,
        edgeExit: params.edgeExit,
        edgeMinDurSec: params.edgeMinDurSec,
        minDensity: params.minDensity,
        k: params.k,
        linkageThresholdSec: params.linkageThresholdSec,
      });
      const fns = detectFalseNegatives(detailsData, fnOptions || {});
      self.postMessage({
        ok: true,
        data: {
          clusters: finalizeClusters(rawClusters, params),
          falseNegatives: fns,
        },
      });
    } catch (err) {
      self.postMessage({
        ok: false,
        error: String((err && err.message) || err),
      });
    }
  } else {
    self.postMessage({ ok: false, error: 'unknown_action' });
  }
};
