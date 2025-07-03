#!/usr/bin/env node
// analysis.js
//
// Script to detect clusters of apnea events bridged by flow-limit (FLG) and
// summarize relevant metrics within each cluster for a given date.
// Usage: node analysis.js <detailsCsv> [YYYY-MM-DD] [groupGapSec]

const fs = require('fs');
const readline = require('readline');

async function run(detailFilePath, targetDateStr, gapSec = 120, flgThreshold = 0.1, bridgeSec = 60) {
  console.error(`Reading details from ${detailFilePath}`);
  const detailStream = fs.createReadStream(detailFilePath);
  const rl = readline.createInterface({ input: detailStream, crlfDelay: Infinity });
  const summaryEvents = [];
  const flgEvents = [];
  const pressureEvents = [];
  const epapEvents = [];
  let header;
  for await (const line of rl) {
    if (!header) {
      header = line.split(',');
      continue;
    }
    const cols = line.split(',');
    if (cols.length < 4) continue;
    const tm = cols[0];
    if (!tm.startsWith(targetDateStr)) continue;
    // parse DateTime string as UTC
    const dt = new Date(tm + 'Z');
    const event = cols[2];
    const val = parseFloat(cols[3]);
    if (['ClearAirway', 'Obstructive', 'Mixed'].includes(event)) {
      summaryEvents.push({ date: dt, type: event, durationSec: val });
    } else if (event === 'FLG') {
      flgEvents.push({ date: dt, level: val });
    } else if (event === 'Pressure') {
      pressureEvents.push({ date: dt, level: val });
    } else if (event === 'EPAP') {
      epapEvents.push({ date: dt, level: val });
    }
  }
  console.error(`Parsed ${summaryEvents.length} apnea summary events, ${flgEvents.length} FLG events`);

  // Cluster apnea summary events with FLG bridging and stricter boundary extension
  const EDGE_THRESHOLD = 0.5;        // FLG fraction threshold for true low-flow edge detection
  const EDGE_MIN_DURATION_SEC = 10;   // min duration for FLG edge clusters (sec)
  function clusterApneaEvents(events, flgEvents, gapSec, flgBridgeThreshold, bridgeSec) {
    // cluster FLG events for bridging annotation gaps (low threshold)
    const flgBridgeHigh = flgEvents.filter(f => f.level >= flgBridgeThreshold)
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
    // cluster FLG events for boundary extension (higher threshold, min duration)
    const flgEdgeHigh = flgEvents.filter(f => f.level >= EDGE_THRESHOLD)
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
    // group annotation events by proximity and FLG bridges
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
    // map to clusters and extend boundaries using filtered FLG edge clusters
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

  const clusters = summaryEvents.length > 0
    ? clusterApneaEvents(summaryEvents, flgEvents, gapSec, flgThreshold, bridgeSec)
    : [];
  const minTotalEventDurSec = 60;
  const maxClusterDurationSec = 230; // sanity cap on cluster window (sec)
  const valid = clusters.filter(c => {
    const totalEventDur = c.events.reduce((sum, e) => sum + e.durationSec, 0);
    return c.count >= 3 &&
           totalEventDur >= minTotalEventDurSec &&
           c.durationSec <= maxClusterDurationSec;
  });
  if (!valid.length) {
    console.log(
      `No apnea clusters (≥3 events and ≥${minTotalEventDurSec}s total) found for`,
      targetDateStr
    );
    return;
  }
  console.log(`Detected apnea clusters for ${targetDateStr}:`);
  valid.forEach((c, i) => {
    console.log(`Cluster ${i + 1}:`);
    console.log(`  Start:    ${c.start.toISOString()}`);
    console.log(`  End:      ${c.end.toISOString()}`);
    console.log(`  Duration: ${c.durationSec.toFixed(1)} sec`);
    console.log(`  Events:`);
    c.events.forEach(e => console.log(`    ${e.type} @ ${e.date.toISOString()} dur=${e.durationSec}s`));
    const flgIn = flgEvents.filter(f => f.date >= c.start && f.date <= c.end).map(f => f.level);
    if (flgIn.length) console.log(`  FLG levels: min=${Math.min(...flgIn)}, max=${Math.max(...flgIn)} (${flgIn.length} samples)`);
    const pIn = pressureEvents.filter(p => p.date >= c.start && p.date <= c.end).map(p => p.level);
    if (pIn.length) console.log(`  Pressure:   min=${Math.min(...pIn)}, max=${Math.max(...pIn)}`);
    const eIn = epapEvents.filter(p => p.date >= c.start && p.date <= c.end).map(p => p.level);
    if (eIn.length) console.log(`  EPAP:       min=${Math.min(...eIn)}, max=${Math.max(...eIn)}`);
  });
}

// Entry point
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: node analysis.js <detailsCsv> [YYYY-MM-DD] [groupGapSec]');
  process.exit(1);
}
const [detailsCsv, dateStr, gapArg] = args;
const gap = gapArg ? parseInt(gapArg, 10) : 120;
run(detailsCsv, dateStr || '2025-06-15', gap).catch(err => { console.error(err); process.exit(1); });
