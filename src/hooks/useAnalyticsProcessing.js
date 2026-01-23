import { useEffect, useReducer, useRef } from 'react';
import {
  clusterApneaEvents,
  detectFalseNegatives,
  DEFAULT_CLUSTER_ALGORITHM,
} from '../utils/clustering';
import { finalizeClusters } from '../utils/analytics';

/**
 * Processes CPAP session data to detect apnea clusters and potential false negatives.
 *
 * Runs clustering and false negative detection algorithms in response to changes in
 * session data or clustering parameters. Manages loading state and error handling.
 *
 * Returns normalized cluster objects and false negative candidates for visualization
 * and further analysis.
 *
 * @param {Object} params - Hook parameters
 * @param {Array<Object>} params.data - Parsed Details CSV with event-level CPAP data
 * @param {Object} params.clusterParams - Clustering configuration:
 *   - algorithm ('kmeans' or 'single-link')
 *   - gapThreshold (seconds between events in same cluster)
 *   - minTotalDuration (minimum cluster duration in seconds)
 *   - maxDuration (maximum event duration in seconds)
 * @param {Object} params.dateFilter - Date range filter: { start: Date, end: Date }
 * @param {string} params.fnPreset - False negative detection preset: 'strict', 'balanced', 'lenient'
 * @returns {Object} Detection results:
 *   - clustersAnalytics (Array<Object>): Apnea clusters with timing and event statistics
 *   - falseNegatives (Array<Object>): Potential false negative clusters
 *   - isLoading (boolean): True while clustering is in progress
 *   - error (Error | null): Error object if detection failed
 *
 * @example
 * const { clustersAnalytics, falseNegatives, isLoading, error } = useAnalyticsProcessing({
 *   data: detailsData,
 *   clusterParams: { algorithm: 'kmeans', gapThreshold: 30, ... },
 *   dateFilter: { start: new Date('2024-01-01'), end: new Date() },
 *   fnPreset: 'balanced'
 * });
 * if (isLoading) return <Spinner />;
 * if (error) return <ErrorMessage error={error} />;
 * return <ClusterVisualization clusters={clustersAnalytics} />;
 *
 * @see clusterApneaEvents - Clustering algorithm implementation
 * @see detectFalseNegatives - False negative detection algorithm
 */
const toValidDate = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  if (typeof value === 'number') {
    const fromNumber = new Date(value);
    return Number.isNaN(fromNumber.getTime()) ? null : fromNumber;
  }
  if (typeof value === 'string' && value) {
    const fromString = new Date(value);
    return Number.isNaN(fromString.getTime()) ? null : fromString;
  }
  return null;
};

const normalizeCluster = (cluster) => {
  if (!cluster) return null;
  const normalizedEvents = Array.isArray(cluster.events)
    ? cluster.events
        .map((evt) => {
          if (!evt) return null;
          const date = toValidDate(evt.date);
          return date ? { ...evt, date } : null;
        })
        .filter(Boolean)
    : cluster.events;

  const start =
    toValidDate(cluster.start) ||
    (Array.isArray(normalizedEvents) ? normalizedEvents[0]?.date : null);
  if (!start) {
    return null;
  }

  const end =
    toValidDate(cluster.end) ||
    (Array.isArray(normalizedEvents)
      ? normalizedEvents[normalizedEvents.length - 1]?.date
      : null) ||
    start;

  return {
    ...cluster,
    start,
    end,
    events: Array.isArray(normalizedEvents) ? normalizedEvents : cluster.events,
  };
};

const normalizeFalseNegative = (entry) => {
  if (!entry) return null;
  const start = toValidDate(entry.start);
  if (!start) {
    return null;
  }
  const end = toValidDate(entry.end) || start;
  return {
    ...entry,
    start,
    end,
  };
};

const normalizeClusters = (clusters) =>
  (Array.isArray(clusters) ? clusters : [])
    .map(normalizeCluster)
    .filter(Boolean);

const normalizeFalseNegatives = (entries) =>
  (Array.isArray(entries) ? entries : [])
    .map(normalizeFalseNegative)
    .filter(Boolean);

const initialState = {
  apneaClusters: [],
  falseNegatives: [],
  processing: false,
};

const analyticsReducer = (state, action) => {
  switch (action.type) {
    case 'start':
      return { ...state, processing: true };
    case 'complete':
      return {
        apneaClusters: normalizeClusters(action.clusters),
        falseNegatives: normalizeFalseNegatives(action.falseNegatives),
        processing: false,
      };
    case 'reset':
      return initialState;
    case 'idle':
      return state.processing ? { ...state, processing: false } : state;
    default:
      return state;
  }
};

export function useAnalyticsProcessing(detailsData, clusterParams, fnOptions) {
  const [state, dispatch] = useReducer(analyticsReducer, initialState);
  const jobIdRef = useRef(0);
  const hasDetails = Array.isArray(detailsData) && detailsData.length > 0;

  useEffect(() => {
    const jobId = jobIdRef.current + 1;
    jobIdRef.current = jobId;

    if (!hasDetails) {
      dispatch({ type: 'reset' });
      return undefined;
    }

    dispatch({ type: 'start' });
    let worker;
    const isStale = () => jobIdRef.current !== jobId;

    const completeWithResults = (clusters, falseNegs) => {
      if (isStale()) return;
      dispatch({ type: 'complete', clusters, falseNegatives: falseNegs });
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
      if (!isStale()) {
        // Only mark idle if this job was still the latest when cleaning up.
        dispatch({ type: 'idle' });
      }
    };
  }, [hasDetails, detailsData, clusterParams, fnOptions]);

  const activeClusters = hasDetails ? state.apneaClusters : [];
  const activeFalseNegatives = hasDetails ? state.falseNegatives : [];
  const isProcessing = hasDetails ? state.processing : false;

  return {
    apneaClusters: activeClusters,
    falseNegatives: activeFalseNegatives,
    processing: isProcessing,
  };
}
