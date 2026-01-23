/**
 * Analytics Web Worker: clusters apnea events and detects false negatives off the main thread.
 * Vite will bundle this as a module worker.
 *
 * **Worker Communication Protocol:**
 * Receives: { action: 'analyzeDetails', payload: { detailsData, params, fnOptions } }
 * Sends: { ok: true, data: { clusters, falseNegatives } } or { ok: false, error: string }
 *
 * **Performance Rationale:**
 * Clustering and false negative detection involve computationally intensive algorithms
 * (k-means, hierarchical clustering, edge detection). Running in a Web Worker prevents
 * UI freezing during analysis. Results are memoized on main thread to avoid re-analysis.
 *
 * **Error Handling:**
 * All errors are caught and returned as ok=false messages (never thrown to main thread).
 * Validation errors are caught early to fail fast. Processing errors are logged in DEV mode
 * but sent as sanitized messages to prevent information disclosure.
 *
 * @see useAnalyticsWorker - Main thread coordinator
 * @see clusterApneaEvents - Clustering algorithm
 * @see detectFalseNegatives - False negative detection algorithm
 */
import {
  clusterApneaEvents,
  detectFalseNegatives,
  DEFAULT_CLUSTER_ALGORITHM,
} from '../utils/clustering.js';
import { finalizeClusters } from '../utils/analytics.js';

self.onmessage = (e) => {
  try {
    const { action, payload } = e.data || {};

    // Validate action is provided
    if (!action) {
      self.postMessage({
        ok: false,
        error: 'No action specified in worker message',
      });
      return;
    }

    if (action === 'analyzeDetails') {
      // Validate required payload fields
      if (!payload) {
        self.postMessage({
          ok: false,
          error: 'No payload provided for analyzeDetails action',
        });
        return;
      }

      const { detailsData, params, fnOptions } = payload;

      if (!detailsData || !Array.isArray(detailsData)) {
        self.postMessage({
          ok: false,
          error: 'Invalid or missing detailsData in payload',
        });
        return;
      }

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
  } catch (err) {
    // Catch any unexpected errors in message handler or worker initialization
    if (import.meta.env.DEV) {
      console.error('Analytics worker message handler error:', err);
    }

    self.postMessage({
      ok: false,
      error: String((err && err.message) || err),
    });
  }
};
