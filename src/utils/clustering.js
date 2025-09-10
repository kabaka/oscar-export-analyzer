// Utility functions for clustering apnea annotation events and detecting false negatives.

import { EVENT_WINDOW_MS } from '../constants';

// Default parameters for apnea clustering
const DEFAULT_APNEA_GAP_SEC = 120; // max gap (sec) between annotation events to cluster
const DEFAULT_FLG_BRIDGE_THRESHOLD = 0.1; // FLG level to bridge annotation events (low threshold)
const DEFAULT_FLG_CLUSTER_GAP_SEC = 60; // max gap (sec) to group FLG readings into clusters

// Parameters for boundary extension via FLG edge clusters
const EDGE_THRESHOLD = 0.5; // default enter threshold
const EDGE_MIN_DURATION_SEC = 10; // min duration (sec) for FLG edge segment to extend boundaries
const EDGE_EXIT_FRACTION = 0.7; // exit hysteresis as fraction of enter threshold

// Parameters for false-negative detection
export const APOEA_CLUSTER_MIN_TOTAL_SEC = 60; // min total apnea-event duration (sec) for valid cluster
const FLG_DURATION_THRESHOLD_SEC = APOEA_CLUSTER_MIN_TOTAL_SEC; // min FLG-only cluster duration for false-negatives
const MAX_FALSE_NEG_FLG_DURATION_SEC = 600; // cap on FLG-only cluster duration (sec)
export const FALSE_NEG_CONFIDENCE_MIN = 0.95; // min confidence (fraction) for false-negative reporting

/**
 * Cluster apnea annotation events, bridging through moderate FLG readings,
 * then extend boundaries based on sustained, high-level FLG edge clusters.
 * @param {Array<{date: Date, durationSec: number}>} events
 * @param {Array<{date: Date, level: number}>} flgEvents
 * @param {number} gapSec - max gap between annotation events to cluster (seconds)
 * @param {number} bridgeThreshold - FLG level threshold for bridging clusters
 * @param {number} bridgeSec - max gap for FLG-based bridging (seconds)
 * @returns {Array<{start: Date, end: Date, durationSec: number, count: number, events: Array}>}
 */
export function clusterApneaEvents(
  events,
  flgEvents,
  gapSec = DEFAULT_APNEA_GAP_SEC,
  bridgeThreshold = DEFAULT_FLG_BRIDGE_THRESHOLD,
  bridgeSec = DEFAULT_FLG_CLUSTER_GAP_SEC,
  edgeEnter = EDGE_THRESHOLD,
  edgeExit = EDGE_THRESHOLD * EDGE_EXIT_FRACTION,
  edgeMinDurSec = EDGE_MIN_DURATION_SEC,
  minDensityPerMin = 0,
) {
  if (!events.length) return [];
  // FLG clusters for bridging annotation gaps (lower threshold)
  const flgBridgeHigh = flgEvents
    .filter((f) => f.level >= bridgeThreshold)
    .sort((a, b) => a.date - b.date);
  const flgBridgeClusters = [];
  if (flgBridgeHigh.length) {
    let vc = [flgBridgeHigh[0]];
    for (let i = 1; i < flgBridgeHigh.length; i++) {
      const prev = flgBridgeHigh[i - 1],
        curr = flgBridgeHigh[i];
      if ((curr.date - prev.date) / 1000 <= bridgeSec) vc.push(curr);
      else {
        flgBridgeClusters.push(vc);
        vc = [curr];
      }
    }
    flgBridgeClusters.push(vc);
  }
  // FLG clusters for boundary extension (higher threshold, min duration)
  // Hysteresis-based FLG edge segments: start when >= enter, continue while within gap and >= exit
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
  // Group annotation events by proximity and FLG bridges
  const sorted = events.slice().sort((a, b) => a.date - b.date);
  const rawGroups = [];
  let current = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const evt = sorted[i];
    const prev = current[current.length - 1];
    const prevEnd = new Date(prev.date.getTime() + prev.durationSec * 1000);
    const gap = (evt.date - prevEnd) / 1000;
    const flgBridge =
      gap <= bridgeSec &&
      flgBridgeHigh.some((f) => f.date >= prevEnd && f.date <= evt.date);
    if (gap <= gapSec || flgBridge) {
      current.push(evt);
    } else {
      rawGroups.push(current);
      current = [evt];
    }
  }
  if (current.length) rawGroups.push(current);
  // Map to clusters and extend boundaries using sustained FLG edge clusters
  const clusters = rawGroups.map((group) => {
    let start = group[0].date;
    const lastEvt = group[group.length - 1];
    let end = new Date(lastEvt.date.getTime() + lastEvt.durationSec * 1000);
    const count = group.length;
    const validEdges = flgEdgeSegments.filter(
      (cl) => (cl[cl.length - 1].date - cl[0].date) / 1000 >= edgeMinDurSec,
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
    const durationSec = (end - start) / 1000;
    const density = durationSec > 0 ? count / (durationSec / 60) : 0;
    return { start, end, durationSec, count, density, events: group };
  });
  // Optional density filter
  return clusters.filter((cl) =>
    minDensityPerMin ? cl.density >= minDensityPerMin : true,
  );
}

/**
 * Detect potential false negatives by clustering high FLG events without apnea events.
 * @param {Array<Object>} details - rows with DateTime, Event, Data/Duration
 * @param {number} flThreshold - min FLG level to consider
 * @returns {Array<{start: Date, end: Date, durationSec: number, confidence: number}>}
 */
export function detectFalseNegatives(details, opts = {}) {
  const {
    flThreshold = DEFAULT_FLG_BRIDGE_THRESHOLD,
    gapSec = DEFAULT_FLG_CLUSTER_GAP_SEC,
    minDurationSec = FLG_DURATION_THRESHOLD_SEC,
    maxDurationSec = MAX_FALSE_NEG_FLG_DURATION_SEC,
    confidenceMin = FALSE_NEG_CONFIDENCE_MIN,
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
      const confidence = Math.max(...cl.map((e) => e.level));
      return { start, end, durationSec, confidence };
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
    .filter((cl) => cl.confidence >= confidenceMin);
}

// Expose default bridge threshold for use in filtering and parsing logic
export const FLG_BRIDGE_THRESHOLD = DEFAULT_FLG_BRIDGE_THRESHOLD;
// Cap on apnea cluster window duration
export const MAX_CLUSTER_DURATION_SEC = 230; // sanity cap on cluster window (sec)

// Additional exported defaults for UI parameter panels
export const APNEA_GAP_DEFAULT = DEFAULT_APNEA_GAP_SEC;
export const FLG_CLUSTER_GAP_DEFAULT = DEFAULT_FLG_CLUSTER_GAP_SEC;
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
  const windowMin = Math.max(1 / 60, cluster.durationSec / 60);
  const density = cluster.count / windowMin; // events per minute over the final window
  const edgeExtensionSec = Math.max(0, cluster.durationSec - rawSpanSec);
  // Weighted combination; weights chosen for stable, interpretable ordering
  const score =
    (totalEvtDuration / 60) * 1.5 +
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
