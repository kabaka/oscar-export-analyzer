import { useMemo } from 'react';
import { useAnalyticsWorker } from './useAnalyticsWorker';
import {
  normalizeClusters,
  normalizeFalseNegatives,
} from '../utils/normalization';

/**
 * Processes CPAP session data to detect apnea clusters and potential false negatives.
 *
 * Runs clustering and false negative detection algorithms in response to changes in
 * session data or clustering parameters. Manages loading state and normalizes results.
 *
 * Returns normalized cluster objects and false negative candidates for visualization
 * and further analysis.
 *
 * @param {Array<Object>} detailsData - Parsed Details CSV with event-level CPAP data
 * @param {Object} clusterParams - Clustering configuration parameters
 * @param {Object} fnOptions - False negative detection options
 * @returns {Object} Detection results:
 *   - apneaClusters (Array<Object>): Normalized apnea clusters with Date objects
 *   - falseNegatives (Array<Object>): Normalized potential false negative entries
 *   - processing (boolean): True while clustering is in progress
 *
 * @example
 * const { apneaClusters, falseNegatives, processing } = useAnalyticsProcessing(
 *   detailsData,
 *   { algorithm: 'kmeans', gapSec: 30, ... },
 *   { preset: 'balanced' }
 * );
 * if (processing) return <Spinner />;
 * return <ClusterVisualization clusters={apneaClusters} />;
 *
 * @see useAnalyticsWorker - Worker communication and fallback computation
 * @see normalizeClusters - Date normalization for clusters
 * @see normalizeFalseNegatives - Date normalization for false negatives
 */
export function useAnalyticsProcessing(detailsData, clusterParams, fnOptions) {
  const hasDetails = Array.isArray(detailsData) && detailsData.length > 0;
  const rawResults = useAnalyticsWorker(detailsData, clusterParams, fnOptions);

  const apneaClusters = useMemo(() => {
    if (!hasDetails || !rawResults) return [];
    return normalizeClusters(rawResults.clusters);
  }, [hasDetails, rawResults]);

  const falseNegatives = useMemo(() => {
    if (!hasDetails || !rawResults) return [];
    return normalizeFalseNegatives(rawResults.falseNegatives);
  }, [hasDetails, rawResults]);

  const processing = hasDetails && !rawResults;

  return {
    apneaClusters,
    falseNegatives,
    processing,
  };
}
