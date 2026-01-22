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
  } = await import('./src/utils/clustering.js');
  const {
    APNEA_CLUSTER_MIN_EVENTS,
    CLI_DEFAULTS,
    CLUSTER_ALGORITHMS,
    DEFAULT_APNEA_CLUSTER_GAP_SEC,
    DEFAULT_CLUSTER_ALGORITHM,
    DEFAULT_FLG_BRIDGE_THRESHOLD,
    DEFAULT_FLG_CLUSTER_GAP_SEC,
    DEFAULT_KMEANS_K,
    DEFAULT_SINGLE_LINK_GAP_SEC,
  } = await import('./src/constants.js');
  const mergedOpts = { ...CLI_DEFAULTS, ...opts };
  const {
    gapSec = DEFAULT_APNEA_CLUSTER_GAP_SEC,
    bridgeThreshold = DEFAULT_FLG_BRIDGE_THRESHOLD,
    bridgeSec = DEFAULT_FLG_CLUSTER_GAP_SEC,
    edgeEnter,
    edgeExit,
    edgeMinDurSec,
    minDensityPerMin,
    algorithm = DEFAULT_CLUSTER_ALGORITHM,
    k = DEFAULT_KMEANS_K,
    linkageThresholdSec = DEFAULT_SINGLE_LINK_GAP_SEC,
  } = mergedOpts;
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
    // eslint-disable-next-line no-magic-numbers -- CSV expected format: [timestamp, ignored, event, value, ...]
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
    `Parsed ${summaryEvents.length} apnea summary events, ${flgEvents.length} FLG events`,
  );

  console.error(
    `Using ${algorithm} clustering (gap=${gapSec}s, bridge≥${bridgeThreshold}, bridgeGap=${bridgeSec}s, k=${k}, linkageThreshold=${linkageThresholdSec}s)`,
  );

  const availableAlgorithms = Object.values(CLUSTER_ALGORITHMS);
  if (!availableAlgorithms.includes(algorithm)) {
    throw new Error(
      `Unsupported clustering algorithm "${algorithm}". Choose from: ${availableAlgorithms.join(', ')}`,
    );
  }

  const clusters =
    summaryEvents.length > 0
      ? clusterApneaEvents({
          algorithm,
          events: summaryEvents,
          flgEvents,
          gapSec,
          bridgeThreshold,
          bridgeSec,
          edgeEnter,
          edgeExit,
          edgeMinDurSec,
          minDensity: minDensityPerMin,
          k,
          linkageThresholdSec,
        })
      : [];
  const valid = clusters.filter((c) => {
    const totalEventDur = c.events.reduce((sum, e) => sum + e.durationSec, 0);
    return (
      c.count >= APNEA_CLUSTER_MIN_EVENTS &&
      totalEventDur >= APOEA_CLUSTER_MIN_TOTAL_SEC &&
      c.durationSec <= MAX_CLUSTER_DURATION_SEC
    );
  });
  if (!valid.length) {
    console.log(
      `No apnea clusters (≥${APNEA_CLUSTER_MIN_EVENTS} events and ≥${APOEA_CLUSTER_MIN_TOTAL_SEC}s total) found for`,
      targetDateStr,
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
        `    ${e.type} @ ${e.date.toISOString()} dur=${e.durationSec}s`,
      ),
    );
    const flgIn = flgEvents
      .filter((f) => f.date >= c.start && f.date <= c.end)
      .map((f) => f.level);
    if (flgIn.length)
      console.log(
        `  FLG levels: min=${Math.min(...flgIn)}, max=${Math.max(...flgIn)} (${flgIn.length} samples)`,
      );
    const pIn = pressureEvents
      .filter((p) => p.date >= c.start && p.date <= c.end)
      .map((p) => p.level);
    if (pIn.length)
      console.log(
        `  Pressure:   min=${Math.min(...pIn)}, max=${Math.max(...pIn)}`,
      );
    const eIn = epapEvents
      .filter((p) => p.date >= c.start && p.date <= c.end)
      .map((p) => p.level);
    if (eIn.length)
      console.log(
        `  EPAP:       min=${Math.min(...eIn)}, max=${Math.max(...eIn)}`,
      );
  });
  return valid;
}

module.exports = { run };

async function main() {
  const args = process.argv;
  const positionals = [];
  const flags = {};
  // eslint-disable-next-line no-magic-numbers -- skip node (0) and script path (1)
  for (const arg of args.slice(2)) {
    if (arg.startsWith('--')) {
      // eslint-disable-next-line no-magic-numbers -- skip "--" prefix (2 chars)
      const [rawKey, rawVal] = arg.slice(2).split('=');
      const key = rawKey.trim();
      const value = rawVal === undefined ? true : rawVal.trim();
      flags[key] = value;
    } else {
      positionals.push(arg);
    }
  }

  if (positionals.length < 1) {
    const {
      CLUSTER_ALGORITHMS,
      DEFAULT_APNEA_CLUSTER_GAP_SEC,
      DEFAULT_CLUSTER_ALGORITHM,
      DEFAULT_FLG_BRIDGE_THRESHOLD,
      DEFAULT_FLG_CLUSTER_GAP_SEC,
      DEFAULT_KMEANS_K,
      DEFAULT_SINGLE_LINK_GAP_SEC,
    } = await import('./src/constants.js');
    const availableAlgorithms = Object.values(CLUSTER_ALGORITHMS).join('|');
    console.error(
      `Usage: node analysis.js <detailsCsv> [YYYY-MM-DD] [gapSec] [flgBridgeThreshold] [flgClusterGapSec] [--algorithm=<${availableAlgorithms}>] [--k=<clusters>] [--linkage-threshold-sec=<seconds>]`,
    );
    console.error(
      `Defaults: algorithm=${DEFAULT_CLUSTER_ALGORITHM}, gapSec=${DEFAULT_APNEA_CLUSTER_GAP_SEC}, flgBridgeThreshold=${DEFAULT_FLG_BRIDGE_THRESHOLD}, flgClusterGapSec=${DEFAULT_FLG_CLUSTER_GAP_SEC}, k=${DEFAULT_KMEANS_K}, linkage-threshold-sec=${DEFAULT_SINGLE_LINK_GAP_SEC}`,
    );
    process.exit(1);
  }

  const [detailsCsv, dateStr, gapArg, flgArg, bridgeArg] = positionals;
  const cliOpts = {};
  if (gapArg) {
    const parsed = parseInt(gapArg, 10);
    if (!Number.isNaN(parsed)) cliOpts.gapSec = parsed;
  }
  if (flgArg) {
    const parsed = parseFloat(flgArg);
    if (!Number.isNaN(parsed)) cliOpts.bridgeThreshold = parsed;
  }
  if (bridgeArg) {
    const parsed = parseInt(bridgeArg, 10);
    if (!Number.isNaN(parsed)) cliOpts.bridgeSec = parsed;
  }

  if (flags.algorithm)
    cliOpts.algorithm = String(flags.algorithm).toLowerCase();
  if (flags.k) {
    const parsed = parseInt(flags.k, 10);
    if (!Number.isNaN(parsed)) cliOpts.k = parsed;
  }
  if (flags['linkage-threshold-sec']) {
    const parsed = parseInt(flags['linkage-threshold-sec'], 10);
    if (!Number.isNaN(parsed)) cliOpts.linkageThresholdSec = parsed;
  }

  try {
    await run(detailsCsv, dateStr || '2025-06-15', cliOpts);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
