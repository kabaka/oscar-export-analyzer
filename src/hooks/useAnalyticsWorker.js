import { useEffect, useMemo, useReducer, useRef } from 'react';
import {
  clusterApneaEvents,
  detectFalseNegatives,
  DEFAULT_CLUSTER_ALGORITHM,
} from '../utils/clustering';
import { finalizeClusters } from '../utils/analytics';

const initialState = {
  results: null,
  jobId: 0,
};

const reducer = (state, action) => {
  switch (action.type) {
    case 'start':
      return { ...state, jobId: state.jobId + 1 };
    case 'complete':
      return { ...state, results: action.payload };
    case 'reset':
      return { results: null, jobId: state.jobId + 1 };
    default:
      return state;
  }
};

/**
 * Custom hook for managing analytics worker communication and fallback computation.
 *
 * Handles:
 * - Worker lifecycle (creation, messaging, termination)
 * - Fallback to main-thread computation if worker fails
 * - Job tracking to prevent stale results
 *
 * @param {Array<Object>} detailsData - Parsed Details CSV with event-level CPAP data
 * @param {Object} clusterParams - Clustering configuration parameters
 * @param {Object} fnOptions - False negative detection options
 * @returns {Object|null} Raw analytics results with clusters and falseNegatives arrays
 */
export function useAnalyticsWorker(detailsData, clusterParams, fnOptions) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const currentJobIdRef = useRef(0);
  const hasDetails = useMemo(
    () => Array.isArray(detailsData) && detailsData.length > 0,
    [detailsData],
  );

  useEffect(() => {
    if (!hasDetails) {
      dispatch({ type: 'reset' });
      return undefined;
    }

    currentJobIdRef.current += 1;
    const currentJobId = currentJobIdRef.current;
    dispatch({ type: 'start' });
    let worker;
    const isStale = () => currentJobIdRef.current !== currentJobId;

    const completeWithResults = (clusters, falseNegs) => {
      if (isStale()) return;
      dispatch({
        type: 'complete',
        payload: { clusters, falseNegatives: falseNegs },
      });
    };

    const fallbackCompute = () => {
      if (isStale()) return;

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
        algorithm: clusterParams.algorithm || DEFAULT_CLUSTER_ALGORITHM,
        events: apneaEvents,
        flgEvents,
        gapSec: clusterParams.gapSec,
        bridgeThreshold: clusterParams.bridgeThreshold,
        bridgeSec: clusterParams.bridgeSec,
        edgeEnter: clusterParams.edgeEnter,
        edgeExit: clusterParams.edgeExit,
        edgeMinDurSec: clusterParams.edgeMinDurSec,
        minDensity: clusterParams.minDensity,
        k: clusterParams.k,
        linkageThresholdSec: clusterParams.linkageThresholdSec,
      });

      const validClusters = finalizeClusters(rawClusters, clusterParams);
      const fns = detectFalseNegatives(detailsData, fnOptions);

      completeWithResults(validClusters, fns);
    };

    try {
      worker = new Worker(
        new URL('../workers/analytics.worker.js', import.meta.url),
        {
          type: 'module',
        },
      );

      worker.onmessage = (evt) => {
        if (isStale()) return;
        const { ok, data, error } = evt.data || {};

        if (ok) {
          completeWithResults(data.clusters, data.falseNegatives);
        } else {
          if (import.meta.env.DEV) {
            console.warn('Analytics worker error:', error);
          }
          fallbackCompute();
        }
      };

      worker.postMessage({
        action: 'analyzeDetails',
        payload: { detailsData, params: clusterParams, fnOptions },
      });
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('Worker unavailable, using fallback', err);
      }
      fallbackCompute();
    }

    return () => {
      try {
        worker && worker.terminate && worker.terminate();
      } catch {
        // ignore termination errors
      }
    };
  }, [hasDetails, detailsData, clusterParams, fnOptions]);
  // Note: state.jobId is intentionally excluded - this effect PRODUCES job IDs
  // and should only re-run when inputs change. Including state.jobId would
  // cause an infinite loop (see commit fixing useAnalyticsProcessing).

  return state.results;
}
