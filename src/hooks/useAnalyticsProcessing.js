import { useEffect, useState } from 'react';
import {
  clusterApneaEvents,
  detectFalseNegatives,
  DEFAULT_CLUSTER_ALGORITHM,
} from '../utils/clustering';
import { finalizeClusters } from '../utils/analytics';

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
      setApneaClusters(validClusters);
      setFalseNegatives(detectFalseNegatives(detailsData, fnOptions));
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
          setApneaClusters(data.clusters || []);
          setFalseNegatives(data.falseNegatives || []);
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
