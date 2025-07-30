// Utility functions for clustering apnea annotation events and detecting false negatives.

// Default parameters for apnea clustering
const DEFAULT_APNEA_GAP_SEC = 120;        // max gap (sec) between annotation events to cluster
const DEFAULT_FLG_BRIDGE_THRESHOLD = 0.1;  // FLG level to bridge annotation events (low threshold)
const DEFAULT_FLG_CLUSTER_GAP_SEC = 60;    // max gap (sec) to group FLG readings into clusters

// Parameters for boundary extension via FLG edge clusters
const EDGE_THRESHOLD = 0.5;                // FLG level to detect true low-flow edges (high threshold)
const EDGE_MIN_DURATION_SEC = 10;          // min duration (sec) for FLG edge cluster to extend boundaries

// Parameters for false-negative detection
const APOEA_CLUSTER_MIN_TOTAL_SEC = 60;    // min total apnea-event duration (sec) for valid cluster
const FLG_DURATION_THRESHOLD_SEC = APOEA_CLUSTER_MIN_TOTAL_SEC; // min FLG-only cluster duration for false-negatives
const MAX_FALSE_NEG_FLG_DURATION_SEC = 600; // cap on FLG-only cluster duration (sec)
export const FALSE_NEG_CONFIDENCE_MIN = 0.95;     // min confidence (fraction) for false-negative reporting

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
  bridgeSec = DEFAULT_FLG_CLUSTER_GAP_SEC
) {
  if (!events.length) return [];
  // FLG clusters for bridging annotation gaps (lower threshold)
  const flgBridgeHigh = flgEvents
    .filter(f => f.level >= bridgeThreshold)
    .sort((a, b) => a.date - b.date);
  const flgBridgeClusters = [];
  if (flgBridgeHigh.length) {
    let vc = [flgBridgeHigh[0]];
    for (let i = 1; i < flgBridgeHigh.length; i++) {
      const prev = flgBridgeHigh[i - 1], curr = flgBridgeHigh[i];
      if ((curr.date - prev.date) / 1000 <= bridgeSec) vc.push(curr);
      else { flgBridgeClusters.push(vc); vc = [curr]; }
    }
    flgBridgeClusters.push(vc);
  }
  // FLG clusters for boundary extension (higher threshold, min duration)
  const flgEdgeHigh = flgEvents
    .filter(f => f.level >= EDGE_THRESHOLD)
    .sort((a, b) => a.date - b.date);
  const flgEdgeClusters = [];
  if (flgEdgeHigh.length) {
    let vc = [flgEdgeHigh[0]];
    for (let i = 1; i < flgEdgeHigh.length; i++) {
      const prev = flgEdgeHigh[i - 1], curr = flgEdgeHigh[i];
      if ((curr.date - prev.date) / 1000 <= bridgeSec) vc.push(curr);
      else { flgEdgeClusters.push(vc); vc = [curr]; }
    }
    flgEdgeClusters.push(vc);
  }
  // Group annotation events by proximity and FLG bridges
  const sorted = events.slice().sort((a, b) => a.date - b.date);
  const rawGroups = [];
  let current = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const evt = sorted[i];
    const prev = current[current.length - 1];
    const prevEnd = new Date(prev.date.getTime() + prev.durationSec * 1000);
    const gap = (evt.date - prevEnd) / 1000;
    const flgBridge = gap <= bridgeSec && flgBridgeHigh.some(f => f.date >= prevEnd && f.date <= evt.date);
    if (gap <= gapSec || flgBridge) {
      current.push(evt);
    } else {
      rawGroups.push(current);
      current = [evt];
    }
  }
  if (current.length) rawGroups.push(current);
  // Map to clusters and extend boundaries using sustained FLG edge clusters
  return rawGroups.map(group => {
    let start = group[0].date;
    const lastEvt = group[group.length - 1];
    let end = new Date(lastEvt.date.getTime() + lastEvt.durationSec * 1000);
    const count = group.length;
    const validEdges = flgEdgeClusters.filter(cl =>
      (cl[cl.length - 1].date - cl[0].date) / 1000 >= EDGE_MIN_DURATION_SEC
    );
    const before = validEdges.find(cl =>
      cl[cl.length - 1].date <= start && (start - cl[cl.length - 1].date) / 1000 <= gapSec
    );
    if (before) start = before[0].date;
    const after = validEdges.find(cl =>
      cl[0].date >= end && (cl[0].date - end) / 1000 <= gapSec
    );
    if (after) end = after[after.length - 1].date;
    return { start, end, durationSec: (end - start) / 1000, count, events: group };
  });
}

/**
 * Detect potential false negatives by clustering high FLG events without apnea events.
 * @param {Array<Object>} details - rows with DateTime, Event, Data/Duration
 * @param {number} flThreshold - min FLG level to consider
 * @returns {Array<{start: Date, end: Date, durationSec: number, confidence: number}>}
 */
export function detectFalseNegatives(details, flThreshold = DEFAULT_FLG_BRIDGE_THRESHOLD) {
  const flEvents = details
    .filter(r => r['Event'] === 'FLG' && r['Data/Duration'] >= flThreshold)
    .map(r => ({ date: new Date(r['DateTime']), level: r['Data/Duration'] }));
  // cluster flow-limit events by time gap
  const clusters = [];
  let current = [];
  flEvents.sort((a, b) => a.date - b.date).forEach(evt => {
    if (!current.length) {
      current.push(evt);
    } else {
      const prev = current[current.length - 1];
      if ((evt.date - prev.date) / 1000 <= DEFAULT_FLG_CLUSTER_GAP_SEC) {
        current.push(evt);
      } else {
        clusters.push(current);
        current = [evt];
      }
    }
  });
  if (current.length) clusters.push(current);
  return clusters
    .map(cl => {
      const start = cl[0].date;
      const end = cl[cl.length - 1].date;
      const durationSec = (end - start) / 1000;
      const confidence = Math.max(...cl.map(e => e.level));
      return { start, end, durationSec, confidence };
    })
    .filter(cl => cl.durationSec >= FLG_DURATION_THRESHOLD_SEC && cl.durationSec <= MAX_FALSE_NEG_FLG_DURATION_SEC)
    .filter(cl => {
      // no known apnea events within expanded window
      return !details.some(r => {
        const t = new Date(r['DateTime']).getTime();
        return ['ClearAirway', 'Obstructive', 'Mixed'].includes(r['Event']) &&
               t >= (cl.start.getTime() - 5000) && t <= (cl.end.getTime() + 5000);
      });
    })
    .filter(cl => cl.confidence >= FALSE_NEG_CONFIDENCE_MIN);
}

// Expose default bridge threshold for use in filtering and parsing logic
export const FLG_BRIDGE_THRESHOLD = DEFAULT_FLG_BRIDGE_THRESHOLD;
