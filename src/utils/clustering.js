/* eslint-disable no-magic-numbers -- signal processing and clustering algorithm parameters */
// Utility functions for clustering apnea annotation events and detecting false negatives.

import {
  CLUSTER_ALGORITHMS,
  DEFAULT_APNEA_CLUSTER_GAP_SEC,
  DEFAULT_CLUSTER_ALGORITHM,
  DEFAULT_FLG_BRIDGE_THRESHOLD,
  DEFAULT_FLG_CLUSTER_GAP_SEC,
  DEFAULT_KMEANS_K,
  DEFAULT_SINGLE_LINK_GAP_SEC,
  EVENT_WINDOW_MS,
  SECONDS_PER_MINUTE,
} from '../constants';

/**
 * HYSTERESIS CONFIGURATION (FLG Edge Detection)
 * ============================================================================
 * EDGE_ENTER_THRESHOLD: 0.5 (default enter threshold)
 * EDGE_EXIT_FRACTION: 0.7 (exit threshold as fraction of enter threshold)
 *
 * RATIONALE (Signal Processing / Heuristic):
 * These values are empirical heuristics based on ResMed "FlowLim" signal
 * characteristics, designed to prevent event fragmentation and flickering.
 *
 * - 0.5 (ENTER): Corresponds to significant waveform flattening ("chair-shaping"
 *   on ResMed flow traces). Acts as a conservative gatekeeper to prevent
 *   extending clusters during periods of only mild resistance/snoring (0.1-0.3).
 *
 * - 0.35 (EXIT = 0.5 × 0.7): Provides a hysteresis buffer (Schmitt Trigger logic).
 *   Ensures the cluster boundary does not "flicker" if data hovers near 0.5.
 *   Requires the airway to recover to "Mild" flow limitation levels (<0.35)
 *   before releasing the cluster lock.
 *
 * HYSTERESIS BENEFIT:
 * Without separate enter/exit thresholds, patients whose FLG readings oscillate
 * around the threshold would trigger hundreds of micro-events, destroying data
 * readability. The 30% hysteresis buffer (0.5→0.35) acts as a low-pass filter.
 *
 * STATUS: Engineering optimization for signal stability. Not a clinical standard.
 *         Standard practice in biomedical signal processing (similar to R-wave
 *         detection in ECG, arousal detection in EEG).
 * ============================================================================
 */

export const CLUSTERING_DEFAULTS = Object.freeze({
  MIN_CLUSTER_DURATION_SEC: SECONDS_PER_MINUTE,
  APNEA_GAP_SEC: DEFAULT_APNEA_CLUSTER_GAP_SEC,
  FLG_BRIDGE_THRESHOLD: DEFAULT_FLG_BRIDGE_THRESHOLD,
  FLG_CLUSTER_GAP_SEC: DEFAULT_FLG_CLUSTER_GAP_SEC,
  EDGE_ENTER_THRESHOLD: 0.5,
  EDGE_EXIT_FRACTION: 0.7,
  EDGE_MIN_DURATION_SEC: 10,
  KMEANS_K: DEFAULT_KMEANS_K,
  KMEANS_MAX_ITERATIONS: 25,
  MIN_DENSITY_CUTOFF: 0,
  MAX_FALSE_NEG_FLG_DURATION_SEC: 10 * SECONDS_PER_MINUTE,
  FALSE_NEG_PEAK_FLG_LEVEL_MIN: 0.95,
  MAX_CLUSTER_DURATION_SEC: 230,
});

// Parameters for boundary extension via FLG edge clusters
const EDGE_THRESHOLD = CLUSTERING_DEFAULTS.EDGE_ENTER_THRESHOLD; // default enter threshold
const EDGE_MIN_DURATION_SEC = CLUSTERING_DEFAULTS.EDGE_MIN_DURATION_SEC; // min duration (sec) for FLG edge segment to extend boundaries
const EDGE_EXIT_FRACTION = CLUSTERING_DEFAULTS.EDGE_EXIT_FRACTION; // exit hysteresis as fraction of enter threshold
const DEFAULT_EDGE_EXIT_THRESHOLD = EDGE_THRESHOLD * EDGE_EXIT_FRACTION;

// Parameters for false-negative detection
export const APOEA_CLUSTER_MIN_TOTAL_SEC =
  CLUSTERING_DEFAULTS.MIN_CLUSTER_DURATION_SEC; // min total apnea-event duration (sec) for valid cluster
const FLG_DURATION_THRESHOLD_SEC = CLUSTERING_DEFAULTS.MIN_CLUSTER_DURATION_SEC; // min FLG-only cluster duration for false-negatives
const MAX_FALSE_NEG_FLG_DURATION_SEC =
  CLUSTERING_DEFAULTS.MAX_FALSE_NEG_FLG_DURATION_SEC; // cap on FLG-only cluster duration (sec)
export const FALSE_NEG_PEAK_FLG_LEVEL_MIN =
  CLUSTERING_DEFAULTS.FALSE_NEG_PEAK_FLG_LEVEL_MIN; // min peak FLG level (normalized; cmH₂O) for false-negative reporting

export {
  CLUSTER_ALGORITHMS,
  DEFAULT_CLUSTER_ALGORITHM,
  DEFAULT_KMEANS_K,
  DEFAULT_SINGLE_LINK_GAP_SEC,
};

/**
 * Summarize a cluster of apnea events with both count-based and duration-based density metrics.
 *
 * DENSITY METRICS:
 * - density: Events per minute (count-based, legacy metric)
 * - weightedDensity: Seconds of apnea per minute (duration-based, "Choke Factor")
 * - totalApneaDurationSec: Total time spent in apnea within cluster
 *
 * CLINICAL INTERPRETATION:
 * The weightedDensity metric aligns with the "Hypoxic Burden" concept
 * (Azarbarzin et al., Eur Heart J 2019), where cumulative apnea duration
 * is a stronger predictor of cardiovascular outcomes than event count alone.
 *
 * Example: 3 events (60s each) in a 5-minute cluster:
 * - density = 3/5 = 0.6 events/min
 * - weightedDensity = 180s/5min = 36 seconds/min (60% of time not breathing)
 *
 * @param {Array} events - Array of apnea event objects with {date, durationSec}
 * @param {Object} overrides - Optional {start, end} to override cluster boundaries
 * @returns {Object} Cluster summary with multiple density metrics
 */
function summarizeClusterEvents(events, overrides = {}) {
  if (!events.length) return null;
  const start = overrides.start ?? events[0].date;
  const lastEvt = events[events.length - 1];
  const naturalEnd = new Date(
    lastEvt.date.getTime() + (lastEvt.durationSec || 0) * 1000,
  );
  const end = overrides.end ?? naturalEnd;
  const count = events.length;
  const durationSec = (end - start) / 1000;
  const density =
    durationSec > 0 ? count / (durationSec / SECONDS_PER_MINUTE) : 0;

  // Calculate weighted density: total apnea duration / window duration (apnea burden per time)
  const totalApneaDurationSec = events.reduce(
    (sum, evt) => sum + (evt.durationSec || 0),
    0,
  );
  const weightedDensity =
    durationSec > 0
      ? totalApneaDurationSec / (durationSec / SECONDS_PER_MINUTE)
      : 0;

  return {
    start,
    end,
    durationSec,
    count,
    density, // Events per minute (legacy count-based metric)
    weightedDensity, // Seconds of apnea per minute (recommended: duration-based "burden")
    totalApneaDurationSec, // Total apnea time in cluster (seconds)
    events,
  };
}

function normalizeMinDensity(options = {}) {
  const { minDensity, minDensityPerMin } = options;
  return typeof minDensity === 'number'
    ? minDensity
    : minDensityPerMin || CLUSTERING_DEFAULTS.MIN_DENSITY_CUTOFF;
}

function filterByDensity(clusters, minDensity) {
  if (!minDensity) return clusters;
  return clusters.filter((cl) => (cl?.density ?? 0) >= minDensity);
}

export function clusterApneaEventsBridged(options = {}) {
  const {
    events = [],
    flgEvents = [],
    gapSec = CLUSTERING_DEFAULTS.APNEA_GAP_SEC,
    bridgeThreshold = CLUSTERING_DEFAULTS.FLG_BRIDGE_THRESHOLD,
    bridgeSec = CLUSTERING_DEFAULTS.FLG_CLUSTER_GAP_SEC,
    edgeEnter = EDGE_THRESHOLD,
    edgeExit = DEFAULT_EDGE_EXIT_THRESHOLD,
    edgeMinDurSec = EDGE_MIN_DURATION_SEC,
  } = options;
  const minDensity = normalizeMinDensity(options);
  if (!events.length) return [];
  const flgSorted = flgEvents.slice().sort((a, b) => a.date - b.date);

  const flgEdgeSegments = [];
  let seg = null;
  for (let i = 0; i < flgSorted.length; i++) {
    const e = flgSorted[i];
    if (!seg) {
      if (e.level >= edgeEnter) {
        seg = [e];
      }
    } else {
      const prev = seg[seg.length - 1];
      const gap = (e.date - prev.date) / 1000;
      if (gap <= bridgeSec && e.level >= edgeExit) {
        seg.push(e);
      } else {
        flgEdgeSegments.push(seg);
        seg = e.level >= edgeEnter ? [e] : null;
      }
    }
  }
  if (seg && seg.length) flgEdgeSegments.push(seg);

  const sorted = events.slice().sort((a, b) => a.date - b.date);
  const rawGroups = [];
  let current = [sorted[0]];
  let flgIdx = 0;
  for (let i = 1; i < sorted.length; i++) {
    const evt = sorted[i];
    const prev = current[current.length - 1];
    const prevEnd = new Date(
      prev.date.getTime() + (prev.durationSec || 0) * 1000,
    );
    const gap = (evt.date - prevEnd) / 1000;

    while (flgIdx < flgSorted.length && flgSorted[flgIdx].date < prevEnd)
      flgIdx++;

    let flgBridge = false;
    if (gap <= bridgeSec) {
      let j = flgIdx;
      while (j < flgSorted.length && flgSorted[j].date <= evt.date) {
        if (flgSorted[j].level >= bridgeThreshold) {
          flgBridge = true;
          break;
        }
        j++;
      }
      flgIdx = j;
    }

    if (gap <= gapSec || flgBridge) {
      current.push(evt);
    } else {
      rawGroups.push(current);
      current = [evt];
    }
  }
  if (current.length) rawGroups.push(current);

  const validEdges = flgEdgeSegments.filter(
    (cl) => (cl[cl.length - 1].date - cl[0].date) / 1000 >= edgeMinDurSec,
  );

  const clusters = rawGroups.map((group) => {
    let start = group[0].date;
    const lastEvt = group[group.length - 1];
    let end = new Date(
      lastEvt.date.getTime() + (lastEvt.durationSec || 0) * 1000,
    );
    const before = validEdges.find(
      (cl) =>
        cl[cl.length - 1].date <= start &&
        (start - cl[cl.length - 1].date) / 1000 <= gapSec,
    );
    if (before) start = before[0].date;
    const after = validEdges.find(
      (cl) => cl[0].date >= end && (cl[0].date - end) / 1000 <= gapSec,
    );
    if (after) end = after[after.length - 1].date;
    return summarizeClusterEvents(group, { start, end });
  });

  return filterByDensity(clusters, minDensity);
}

export function clusterApneaEventsKMeans(options = {}) {
  const {
    events = [],
    k: rawK = DEFAULT_KMEANS_K,
    maxIterations: maxIterationsOpt,
  } = options;
  const minDensity = normalizeMinDensity(options);
  if (!events.length) {
    const empty = [];
    empty.meta = {
      converged: true,
      iterations: 0,
      maxIterationsReached: false,
      wcss: 0,
      kOverspecified: false,
    };
    return empty;
  }
  const sorted = events.slice().sort((a, b) => a.date - b.date);
  const times = sorted.map((evt) => evt.date.getTime());
  const k = Math.max(1, Math.min(sorted.length, Math.round(rawK || 1)));
  const centroids = Array.from({ length: k }).map((_, idx) => {
    if (k === 1) return times[0];
    const pos = Math.floor((idx * (times.length - 1)) / Math.max(1, k - 1));
    return times[pos];
  });
  const assignments = new Array(times.length).fill(0);
  const maxIterations =
    typeof maxIterationsOpt === 'number'
      ? Math.max(1, Math.floor(maxIterationsOpt))
      : CLUSTERING_DEFAULTS.KMEANS_MAX_ITERATIONS;

  // TODO: Consider k-means++ initialization on 1D timestamps for improved stability.

  let iterationsUsed = 0;
  let converged = false;

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    iterationsUsed = iteration + 1;
    let changed = false;
    for (let i = 0; i < times.length; i++) {
      let bestIdx = 0;
      let bestDist = Math.abs(times[i] - centroids[0]);
      for (let c = 1; c < centroids.length; c++) {
        const dist = Math.abs(times[i] - centroids[c]);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = c;
        }
      }
      if (assignments[i] !== bestIdx) {
        assignments[i] = bestIdx;
        changed = true;
      }
    }

    const sums = new Array(centroids.length).fill(0);
    const counts = new Array(centroids.length).fill(0);
    for (let i = 0; i < times.length; i++) {
      const clusterIdx = assignments[i];
      sums[clusterIdx] += times[i];
      counts[clusterIdx] += 1;
    }
    for (let c = 0; c < centroids.length; c++) {
      if (counts[c] > 0) {
        const newCentroid = sums[c] / counts[c];
        if (centroids[c] !== newCentroid) {
          centroids[c] = newCentroid;
          changed = true;
        }
      }
    }

    if (!changed) {
      converged = true;
      break;
    }
  }

  const groups = Array.from({ length: k }, () => []);
  assignments.forEach((clusterIdx, i) => {
    groups[clusterIdx].push(sorted[i]);
  });

  const clusters = groups
    .filter((group) => group.length)
    .map((group) => summarizeClusterEvents(group));

  const maxIterationsReached = !converged && iterationsUsed >= maxIterations;
  const kOverspecified = k > Math.floor(times.length / 3);
  let wcss = 0;
  for (let i = 0; i < times.length; i++) {
    const cIdx = assignments[i];
    const diff = times[i] - centroids[cIdx];
    wcss += diff * diff;
  }

  if (maxIterationsReached) {
    console.warn(
      `[KMeans] Max iterations reached without convergence; results may be suboptimal.`,
    );
  }

  const out = filterByDensity(
    clusters.sort((a, b) => a.start - b.start),
    minDensity,
  );

  // Attach metadata without breaking array consumers
  out.meta = {
    converged,
    iterations: iterationsUsed,
    maxIterationsReached,
    wcss,
    kOverspecified,
  };

  return out;
}

export function clusterApneaEventsAgglomerative(options = {}) {
  const { events = [], linkageThresholdSec = DEFAULT_SINGLE_LINK_GAP_SEC } =
    options;
  const minDensity = normalizeMinDensity(options);
  if (!events.length) return [];
  const threshold =
    typeof linkageThresholdSec === 'number'
      ? linkageThresholdSec
      : DEFAULT_SINGLE_LINK_GAP_SEC;

  const sorted = events.slice().sort((a, b) => a.date - b.date);
  const rawClusters = [];
  let current = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const evt = sorted[i];
    const prev = current[current.length - 1];
    const prevEnd = new Date(
      prev.date.getTime() + (prev.durationSec || 0) * 1000,
    );
    const gap = (evt.date - prevEnd) / 1000;
    if (gap <= threshold) {
      current.push(evt);
    } else {
      rawClusters.push(current);
      current = [evt];
    }
  }
  if (current.length) rawClusters.push(current);

  const clusters = rawClusters.map((group) => summarizeClusterEvents(group));
  return filterByDensity(clusters, minDensity);
}

export function clusterApneaEvents(options = {}) {
  const { algorithm = DEFAULT_CLUSTER_ALGORITHM } = options || {};
  switch (algorithm) {
    case CLUSTER_ALGORITHMS.KMEANS:
      return clusterApneaEventsKMeans(options);
    case CLUSTER_ALGORITHMS.AGGLOMERATIVE:
      return clusterApneaEventsAgglomerative(options);
    case CLUSTER_ALGORITHMS.BRIDGED:
      return clusterApneaEventsBridged(options);
    default:
      throw new Error(`Unsupported apnea clustering algorithm: ${algorithm}`);
  }
}

/**
 * Detect potential false negatives by clustering high FLG events without apnea events.
 * Peak FLG level is the maximum normalized Flow Limitation Level (in cmH₂O) observed in a cluster.
 * @param {Array<Object>} details - rows with DateTime, Event, Data/Duration
 * @param {number} flThreshold - min FLG level to consider
 * @returns {Array<{start: Date, end: Date, durationSec: number, peakFLGLevel: number}>}
 */
export function detectFalseNegatives(details, opts = {}) {
  const {
    flThreshold = DEFAULT_FLG_BRIDGE_THRESHOLD,
    gapSec = DEFAULT_FLG_CLUSTER_GAP_SEC,
    minDurationSec = FLG_DURATION_THRESHOLD_SEC,
    maxDurationSec = MAX_FALSE_NEG_FLG_DURATION_SEC,
    peakFLGLevelMin = FALSE_NEG_PEAK_FLG_LEVEL_MIN,
  } = typeof opts === 'number' ? { flThreshold: opts } : opts;
  const flEvents = details
    .filter((r) => r['Event'] === 'FLG' && r['Data/Duration'] >= flThreshold)
    .map((r) => ({ date: new Date(r['DateTime']), level: r['Data/Duration'] }));
  // cluster flow-limit events by time gap
  const clusters = [];
  let current = [];
  flEvents
    .sort((a, b) => a.date - b.date)
    .forEach((evt) => {
      if (!current.length) {
        current.push(evt);
      } else {
        const prev = current[current.length - 1];
        if ((evt.date - prev.date) / 1000 <= gapSec) {
          current.push(evt);
        } else {
          clusters.push(current);
          current = [evt];
        }
      }
    });
  if (current.length) clusters.push(current);
  return clusters
    .map((cl) => {
      const start = cl[0].date;
      const end = cl[cl.length - 1].date;
      const durationSec = (end - start) / 1000;
      const peakFLGLevel = Math.max(...cl.map((e) => e.level));
      return { start, end, durationSec, peakFLGLevel };
    })
    .filter(
      (cl) =>
        cl.durationSec >= minDurationSec && cl.durationSec <= maxDurationSec,
    )
    .filter((cl) => {
      // no known apnea events within expanded window
      return !details.some((r) => {
        const t = new Date(r['DateTime']).getTime();
        return (
          ['ClearAirway', 'Obstructive', 'Mixed'].includes(r['Event']) &&
          t >= cl.start.getTime() - EVENT_WINDOW_MS &&
          t <= cl.end.getTime() + EVENT_WINDOW_MS
        );
      });
    })
    .filter((cl) => cl.peakFLGLevel >= peakFLGLevelMin);
}

// Expose default bridge threshold for use in filtering and parsing logic
export const FLG_BRIDGE_THRESHOLD = CLUSTERING_DEFAULTS.FLG_BRIDGE_THRESHOLD;
// Cap on apnea cluster window duration
export const MAX_CLUSTER_DURATION_SEC =
  CLUSTERING_DEFAULTS.MAX_CLUSTER_DURATION_SEC; // sanity cap on cluster window (sec)

// Additional exported defaults for UI parameter panels
export const APNEA_GAP_DEFAULT = CLUSTERING_DEFAULTS.APNEA_GAP_SEC;
export const FLG_CLUSTER_GAP_DEFAULT = CLUSTERING_DEFAULTS.FLG_CLUSTER_GAP_SEC;
export const FLG_EDGE_THRESHOLD_DEFAULT = EDGE_THRESHOLD;
export const FLG_EDGE_ENTER_THRESHOLD_DEFAULT = EDGE_THRESHOLD;
export const FLG_EDGE_EXIT_THRESHOLD_DEFAULT =
  EDGE_THRESHOLD * EDGE_EXIT_FRACTION;

/**
 * Compute a severity score for a cluster combining total duration, density, and
 * boundary extension via FLG edge strength. Higher is more severe.
 * This is a heuristic and meant for sorting/prioritization in the UI.
 * @param {{ start: Date, end: Date, durationSec: number, count: number, events: Array<{date: Date, durationSec: number}> }} cluster
 * @returns {number}
 */
export function computeClusterSeverity(cluster) {
  if (!cluster || !cluster.events?.length) return 0;
  const totalEvtDuration = cluster.events.reduce(
    (s, e) => s + (e.durationSec || 0),
    0,
  );
  const firstStart = cluster.events[0].date;
  const lastEvt = cluster.events[cluster.events.length - 1];
  const lastEnd = new Date(
    lastEvt.date.getTime() + (lastEvt.durationSec || 0) * 1000,
  );
  const rawSpanSec = Math.max(1, (lastEnd - firstStart) / 1000);
  const windowMin = Math.max(
    1 / SECONDS_PER_MINUTE,
    cluster.durationSec / SECONDS_PER_MINUTE,
  );
  const density = cluster.count / windowMin; // events per minute over the final window
  const edgeExtensionSec = Math.max(0, cluster.durationSec - rawSpanSec);
  // Weighted combination; weights chosen for stable, interpretable ordering
  const score =
    (totalEvtDuration / SECONDS_PER_MINUTE) * 1.5 +
    density * 0.5 +
    (edgeExtensionSec / 30) * 1.0;
  return Number.isFinite(score) ? score : 0;
}

/**
 * Convert clusters to a simple CSV for export.
 * Columns: index,start,end,durationSec,count,severity
 * @param {Array} clusters
 * @returns {string}
 */
export function clustersToCsv(clusters) {
  const header = ['index', 'start', 'end', 'durationSec', 'count', 'severity'];
  const rows = (clusters || []).map((cl, idx) => [
    idx + 1,
    cl.start instanceof Date ? cl.start.toISOString() : '',
    cl.end instanceof Date ? cl.end.toISOString() : '',
    Math.round(cl.durationSec ?? 0),
    cl.count ?? 0,
    cl.severity != null ? Number(cl.severity).toFixed(3) : '',
  ]);
  return [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
}
