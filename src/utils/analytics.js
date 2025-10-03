import { computeClusterSeverity } from './clustering';

/**
 * Normalize raw apnea clusters by applying configured filters and computing
 * severity scores. This ensures consistent presentation between worker and
 * fallback analytics flows.
 *
 * @param {Array} rawClusters
 * @param {{ minCount?: number, minTotalSec?: number, maxClusterSec?: number }} params
 * @returns {Array}
 */
export function finalizeClusters(rawClusters, params = {}) {
  const {
    minCount = 0,
    minTotalSec = 0,
    maxClusterSec = Number.POSITIVE_INFINITY,
  } = params;

  const maxDuration = Number.isFinite(maxClusterSec)
    ? maxClusterSec
    : Number.POSITIVE_INFINITY;

  return (rawClusters || [])
    .map((cluster) => {
      const totalDuration = (cluster?.events || []).reduce(
        (sum, event) => sum + (event?.durationSec || 0),
        0,
      );
      const duration =
        typeof cluster?.durationSec === 'number'
          ? cluster.durationSec
          : totalDuration;
      return {
        cluster,
        totalDuration,
        duration,
      };
    })
    .filter(({ cluster }) => Number(cluster?.count ?? 0) >= minCount)
    .filter(({ totalDuration }) => totalDuration >= minTotalSec)
    .filter(({ duration }) => duration <= maxDuration)
    .map(({ cluster }) => ({
      ...cluster,
      severity: computeClusterSeverity(cluster),
    }));
}
