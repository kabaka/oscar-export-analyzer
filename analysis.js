#!/usr/bin/env node
// analysis.js
//
// Script to detect clusters of apnea events bridged by flow-limit (FLG) and
// summarize relevant metrics within each cluster for a given date.
// Usage: node analysis.js <detailsCsv> [YYYY-MM-DD] [gapSec] [flgBridgeThreshold] [flgClusterGapSec]

const fs = require('fs');
const readline = require('readline');

async function run(detailFilePath, targetDateStr, opts = {}) {
  const {
    clusterApneaEvents,
    APOEA_CLUSTER_MIN_TOTAL_SEC,
    MAX_CLUSTER_DURATION_SEC,
    APNEA_GAP_DEFAULT,
    FLG_BRIDGE_THRESHOLD,
    FLG_CLUSTER_GAP_DEFAULT,
  } = await import('./src/utils/clustering.js');
  const {
    gapSec = APNEA_GAP_DEFAULT,
    bridgeThreshold = FLG_BRIDGE_THRESHOLD,
    bridgeSec = FLG_CLUSTER_GAP_DEFAULT,
    edgeEnter,
    edgeExit,
    edgeMinDurSec,
    minDensityPerMin,
  } = opts;
  console.error(`Reading details from ${detailFilePath}`);
  const detailStream = fs.createReadStream(detailFilePath);
  const rl = readline.createInterface({
    input: detailStream,
    crlfDelay: Infinity,
  });
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
  console.error(
    `Parsed ${summaryEvents.length} apnea summary events, ${flgEvents.length} FLG events`
  );

  const clusters =
    summaryEvents.length > 0
      ? clusterApneaEvents(
          summaryEvents,
          flgEvents,
          gapSec,
          bridgeThreshold,
          bridgeSec,
          edgeEnter,
          edgeExit,
          edgeMinDurSec,
          minDensityPerMin
        )
      : [];
  const valid = clusters.filter((c) => {
    const totalEventDur = c.events.reduce((sum, e) => sum + e.durationSec, 0);
    return (
      c.count >= 3 &&
      totalEventDur >= APOEA_CLUSTER_MIN_TOTAL_SEC &&
      c.durationSec <= MAX_CLUSTER_DURATION_SEC
    );
  });
  if (!valid.length) {
    console.log(
      `No apnea clusters (≥3 events and ≥${APOEA_CLUSTER_MIN_TOTAL_SEC}s total) found for`,
      targetDateStr
    );
    return [];
  }
  console.log(`Detected apnea clusters for ${targetDateStr}:`);
  valid.forEach((c, i) => {
    console.log(`Cluster ${i + 1}:`);
    console.log(`  Start:    ${c.start.toISOString()}`);
    console.log(`  End:      ${c.end.toISOString()}`);
    console.log(`  Duration: ${c.durationSec.toFixed(1)} sec`);
    console.log(`  Events:`);
    c.events.forEach((e) =>
      console.log(
        `    ${e.type} @ ${e.date.toISOString()} dur=${e.durationSec}s`
      )
    );
    const flgIn = flgEvents
      .filter((f) => f.date >= c.start && f.date <= c.end)
      .map((f) => f.level);
    if (flgIn.length)
      console.log(
        `  FLG levels: min=${Math.min(...flgIn)}, max=${Math.max(...flgIn)} (${flgIn.length} samples)`
      );
    const pIn = pressureEvents
      .filter((p) => p.date >= c.start && p.date <= c.end)
      .map((p) => p.level);
    if (pIn.length)
      console.log(
        `  Pressure:   min=${Math.min(...pIn)}, max=${Math.max(...pIn)}`
      );
    const eIn = epapEvents
      .filter((p) => p.date >= c.start && p.date <= c.end)
      .map((p) => p.level);
    if (eIn.length)
      console.log(
        `  EPAP:       min=${Math.min(...eIn)}, max=${Math.max(...eIn)}`
      );
  });
  return valid;
}

module.exports = { run };

// Entry point
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error(
    'Usage: node analysis.js <detailsCsv> [YYYY-MM-DD] [gapSec] [flgBridgeThreshold] [flgClusterGapSec]'
  );
  process.exit(1);
}
const [detailsCsv, dateStr, gapArg, flgArg, bridgeArg] = args;
const cliOpts = {};
if (gapArg) cliOpts.gapSec = parseInt(gapArg, 10);
if (flgArg) cliOpts.bridgeThreshold = parseFloat(flgArg);
if (bridgeArg) cliOpts.bridgeSec = parseInt(bridgeArg, 10);
run(detailsCsv, dateStr || '2025-06-15', cliOpts).catch((err) => {
  console.error(err);
  process.exit(1);
});
