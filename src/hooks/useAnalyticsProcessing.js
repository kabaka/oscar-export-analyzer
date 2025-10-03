import { useEffect, useState } from 'react';
import {
  clusterApneaEvents,
  detectFalseNegatives,
  computeClusterSeverity,
} from '../utils/clustering';

export function useAnalyticsProcessing(detailsData, clusterParams, fnOptions) {
  const [apneaClusters, setApneaClusters] = useState([]);
  const [falseNegatives, setFalseNegatives] = useState([]);
  const [processingDetails, setProcessingDetails] = useState(false);

  useEffect(() => {
    if (!detailsData) {
      setApneaClusters([]);
      setFalseNegatives([]);
      setProcessingDetails(false);
      return undefined;
    }

    let cancelled = false;
    let worker;

    const finishProcessing = (clusters = [], negatives = []) => {
      if (cancelled) return;
      setApneaClusters(clusters);
      setFalseNegatives(negatives);
      setProcessingDetails(false);
    };

    const fallbackCompute = () => {
      const apneaEvents = detailsData
        .filter((r) => ['ClearAirway', 'Obstructive', 'Mixed'].includes(r['Event']))
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
      const rawClusters = clusterApneaEvents(
        apneaEvents,
        flgEvents,
        clusterParams.gapSec,
        clusterParams.bridgeThreshold,
        clusterParams.bridgeSec,
        clusterParams.edgeEnter,
        clusterParams.edgeExit,
        10,
        clusterParams.minDensity,
      );
      const validClusters = rawClusters
        .filter((cl) => cl.count >= clusterParams.minCount)
        .filter(
          (cl) =>
            cl.events.reduce((sum, e) => sum + e.durationSec, 0) >=
            clusterParams.minTotalSec,
        )
        .filter((cl) => cl.durationSec <= clusterParams.maxClusterSec)
        .map((cl) => ({ ...cl, severity: computeClusterSeverity(cl) }));

      finishProcessing(validClusters, detectFalseNegatives(detailsData, fnOptions));
    };

    setProcessingDetails(true);

    try {
      // eslint-disable-next-line no-undef
      worker = new Worker(new URL('../workers/analytics.worker.js', import.meta.url), {
        type: 'module',
      });
      worker.onmessage = (evt) => {
        if (cancelled) return;
        const { ok, data, error } = evt.data || {};
        if (ok) {
          const rawClusters = data.clusters || [];
          const validClusters = rawClusters
            .filter((cl) => cl.count >= clusterParams.minCount)
            .filter(
              (cl) =>
                cl.events.reduce((sum, e) => sum + e.durationSec, 0) >=
                clusterParams.minTotalSec,
            )
            .filter((cl) => cl.durationSec <= clusterParams.maxClusterSec)
            .map((cl) => ({ ...cl, severity: computeClusterSeverity(cl) }));
          finishProcessing(validClusters, data.falseNegatives || []);
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
      setProcessingDetails(false);
    };
  }, [detailsData, clusterParams, fnOptions]);

  return { apneaClusters, falseNegatives, processingDetails };
}
