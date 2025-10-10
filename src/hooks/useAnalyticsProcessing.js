import { useEffect, useState } from 'react';
import {
  clusterApneaEvents,
  detectFalseNegatives,
  DEFAULT_CLUSTER_ALGORITHM,
} from '../utils/clustering';
import { finalizeClusters } from '../utils/analytics';

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

export function useAnalyticsProcessing(detailsData, clusterParams, fnOptions) {
  const [apneaClusters, setApneaClusters] = useState([]);
  const [falseNegatives, setFalseNegatives] = useState([]);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!detailsData || !detailsData.length) {
      setApneaClusters([]);
      setFalseNegatives([]);
      setProcessing(false);
      return undefined;
    }

    setProcessing(true);
    let cancelled = false;
    let worker;

    const fallbackCompute = () => {
      if (cancelled) return;
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
      setApneaClusters(normalizeClusters(validClusters));
      setFalseNegatives(
        normalizeFalseNegatives(detectFalseNegatives(detailsData, fnOptions)),
      );
      setProcessing(false);
    };

    try {
      // eslint-disable-next-line no-undef
      worker = new Worker(
        new URL('../workers/analytics.worker.js', import.meta.url),
        {
          type: 'module',
        },
      );
      worker.onmessage = (evt) => {
        if (cancelled) return;
        const { ok, data, error } = evt.data || {};
        if (ok) {
          setApneaClusters(normalizeClusters(data.clusters));
          setFalseNegatives(normalizeFalseNegatives(data.falseNegatives));
          setProcessing(false);
        } else {
          console.warn('Analytics worker error:', error);
          fallbackCompute();
        }
      };
      worker.postMessage({
        action: 'analyzeDetails',
        payload: { detailsData, params: clusterParams, fnOptions },
      });
    } catch (err) {
      console.warn('Worker unavailable, using fallback', err);
      fallbackCompute();
    }

    return () => {
      cancelled = true;
      try {
        worker && worker.terminate && worker.terminate();
      } catch {
        // ignore termination errors
      }
      setProcessing(false);
    };
  }, [detailsData, clusterParams, fnOptions]);

  return { apneaClusters, falseNegatives, processing };
}
