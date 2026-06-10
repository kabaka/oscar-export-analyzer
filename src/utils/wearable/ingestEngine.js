/**
 * Streaming wearable-export ingestion engine (perf-storage design rev2 §2).
 *
 * This is the plain, **worker-agnostic** module that `wearableIngest.worker.js`
 * imports. Keeping the pipeline in a pure-ish module (its only side effects are
 * the IndexedDB writes it is handed via `putBatch`) makes it unit-testable
 * without a real Worker and lets jsdom/node tests drive it directly with a mock
 * `FileSystemDirectoryHandle` and `fake-indexeddb`.
 *
 * Pipeline (perf §2.2):
 *   1. **enumerate** the picked directory recursively, **allowlist-pruned** at
 *      descent (denied dirs never listed — privacy §2.3), building a work plan
 *      grouped by phase → metric → night-date order.
 *   2. **Phase A (resident):** UserSleeps offsets → sleep sessions (dedup via
 *      `dedupSleepSessions`/`foldNightsByKey`) → sleep score join → daily
 *      rollups (RHR, zones, readiness, stress, HRV/RR summary, AZM, steps,
 *      temperature). Populates the resident night-window index + rollup map.
 *   3. **Phase B (evicted per night):** for each high-frequency metric in its own
 *      phase (`spo2 → hrv → snore → hr`), read files date-ordered, window-restrict
 *      samples using the Phase-A window + a resolved offset (`resolveOffset` /
 *      `inferUtcOffset`), aggregate via the Phase-2 aggregators, build the
 *      WearableNight + intraday typed arrays, and flush+evict at the night
 *      boundary (`MAX_RESIDENT_INTRADAY_NIGHTS`).
 *   4. **persist** via batched `putBatch`; write the `wearable_meta` manifest
 *      (`lastIngestedDate` high-water mark, `{relativePath,size}` identity set).
 *
 * Bounded heap, cancellation via an `AbortSignal`, and **no PHI in errors**.
 *
 * @module utils/wearable/ingestEngine
 */

import {
  classify,
  describeFile,
  isDeniedDir,
  INGEST_PHASE,
  METRIC,
  CLASSIFICATION,
} from './exportAllowlist.js';
import { PARSERS } from './parsers.js';
import { dedupSleepSessions, foldNightsByKey } from './nightKeying.js';
import {
  naiveLocalToMinutes,
  utcToMinutes,
  resolveOffset,
} from './offsetInference.js';
import {
  aggregateSpO2,
  aggregateHeartRate,
  aggregateHRV,
  aggregateRespiratoryRate,
  aggregateSnore,
  aggregateReadiness,
  aggregateStress,
  aggregateActivity,
  aggregateTemperature,
} from './aggregators.js';
import {
  createWearableNight,
  createWindow,
  createCoverageBlock,
} from './wearableNight.js';
import {
  MAX_PUTS_PER_TX,
  MAX_RESIDENT_INTRADAY_NIGHTS,
  INTRADAY_CADENCE_SEC,
} from '../../constants/ui.js';
import { OFFSET_INFERENCE as OFFSET_CONST } from '../../constants/wearableConstants.js';
import { putBatch, setWearableMeta } from '../appDb.js';

const MS_PER_MINUTE = 60000;

/**
 * Recursively enumerate a `FileSystemDirectoryHandle`, pruning denied dirs at
 * descent and yielding only allowlisted file descriptors. Never lists or opens
 * a denied subtree (privacy §2.3).
 *
 * @param {FileSystemDirectoryHandle} dirHandle - The picked root.
 * @param {object} [opts]
 * @param {boolean} [opts.menstrualOptIn=false]
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<Array<{ relPath: string, handle: FileSystemFileHandle,
 *   metric: string, source: string, parser: string, phase: string }>>}
 */
export async function enumerateExport(
  dirHandle,
  { menstrualOptIn = false, signal } = {},
) {
  const out = [];
  await walk(dirHandle, '');
  return out;

  async function walk(handle, prefix) {
    throwIfAborted(signal);
    // `entries()` is the async-iterable form; tests provide a compatible mock.
    for await (const [name, child] of handle.entries()) {
      throwIfAborted(signal);
      const rel = prefix + name;
      if (child.kind === 'directory') {
        if (isDeniedDir(rel + '/', { menstrualOptIn })) continue; // prune
        await walk(child, rel + '/');
      } else {
        if (classify(rel, { menstrualOptIn }) !== CLASSIFICATION.ALLOWED) {
          continue;
        }
        const desc = describeFile(rel, { menstrualOptIn });
        if (desc) out.push({ relPath: rel, handle: child, ...desc });
      }
    }
  }
}

/** Read a file handle's text. Tolerant of a `{ text() }` mock. @private */
async function readText(fileHandle) {
  const file = await fileHandle.getFile();
  return file.text();
}

/** Get a file's byte size (for the incremental identity set). @private */
async function readSize(fileHandle) {
  try {
    const file = await fileHandle.getFile();
    return file.size ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Run the full ingest. Persists nightly rollups + intraday to IndexedDB via
 * `putBatch` and writes the `wearable_meta` manifest. Reports progress through
 * the `onProgress` callback; honors `signal` for cancellation.
 *
 * @param {object} args
 * @param {FileSystemDirectoryHandle} args.dirHandle - Picked export root.
 * @param {IDBDatabase} args.db - Open `oscar_app` connection.
 * @param {object} [args.opts]
 * @param {boolean} [args.opts.menstrualOptIn=false]
 * @param {string|null} [args.opts.sinceDate=null] - Incremental high-water mark;
 *   nights with key `<= sinceDate` are skipped.
 * @param {Set<string>|Map<string,number>|null} [args.opts.knownFiles=null] -
 *   `relPath → size` of already-ingested files (incremental skip).
 * @param {(progress: object) => void} [args.onProgress] - Progress sink.
 * @param {AbortSignal} [args.signal] - Cancellation.
 * @returns {Promise<{ stats: object, lastIngestedDate: object,
 *   filesProcessed: number, nights: number }>}
 */
export async function runIngest({
  dirHandle,
  db,
  opts = {},
  onProgress = () => {},
  signal,
} = {}) {
  const { menstrualOptIn = false, sinceDate = null, knownFiles = null } = opts;

  const files = await enumerateExport(dirHandle, { menstrualOptIn, signal });
  const filesTotal = files.length;
  let filesDone = 0;

  // Partition by phase.
  const phaseAFiles = files.filter((f) => f.phase === INGEST_PHASE.WINDOWS);
  const phaseBFiles = files.filter((f) => f.phase === INGEST_PHASE.HIGH_FREQ);

  // --- Resident accumulators (perf §2.3) ---
  /** @type {Map<string, object>} nightKey → WearableNight (built incrementally). */
  const nightIndex = new Map();
  /** @type {Map<string, number>} nightKey → UserSleeps offset hint (minutes). */
  const offsetHints = new Map();
  /** @type {Map<string, number>} per-metric high-water mark date. */
  const lastIngestedDate = {};
  /** @type {Array<{relativePath:string,size:number}>} incremental identity set. */
  const fileIdentity = [];
  const stats = {
    nights: 0,
    filesProcessed: 0,
    filesSkipped: 0,
    malformedRows: 0,
    perMetricCounts: {},
    sentinelMinutesRemoved: 0,
    dateRange: { start: null, end: null },
  };

  const flushBuffer = [];
  const flush = async (force = false) => {
    if (flushBuffer.length === 0) return;
    if (!force && flushBuffer.length < MAX_PUTS_PER_TX) return;
    const batch = flushBuffer.splice(
      0,
      force ? flushBuffer.length : MAX_PUTS_PER_TX,
    );
    await putBatch(db, batch);
  };

  const skipByIdentity = makeIdentityPredicate(knownFiles);

  /* ----------------------------- PHASE A ----------------------------- */
  // 1. UserSleeps offset hints first (cheap, feeds windowing).
  for (const f of phaseAFiles.filter((x) => x.metric === METRIC.USER_SLEEPS)) {
    throwIfAborted(signal);
    const text = await readText(f.handle);
    const { hintsByDate, malformedRows } = PARSERS.userSleepsCsv(text);
    stats.malformedRows += malformedRows;
    for (const [date, off] of hintsByDate) offsetHints.set(date, off);
    fileIdentity.push({
      relativePath: f.relPath,
      size: await readSize(f.handle),
    });
    filesDone += 1;
    stats.filesProcessed += 1;
    emitProgress(
      onProgress,
      'userSleeps',
      filesDone,
      filesTotal,
      nightIndex.size,
    );
  }

  // 2. Sleep sessions across ALL chunk files → dedup → fold → window index.
  const rawSessions = [];
  for (const f of phaseAFiles.filter((x) => x.metric === METRIC.SLEEP)) {
    throwIfAborted(signal);
    const text = await readText(f.handle);
    const { sessions, malformedRows } = PARSERS.sleepJson(text, {
      relPath: f.relPath,
    });
    stats.malformedRows += malformedRows;
    for (const s of sessions) rawSessions.push(s);
    fileIdentity.push({
      relativePath: f.relPath,
      size: await readSize(f.handle),
    });
    filesDone += 1;
    stats.filesProcessed += 1;
    emitProgress(onProgress, 'sleep', filesDone, filesTotal, nightIndex.size);
  }
  const { sessions: deduped } = dedupSleepSessions(rawSessions);
  const structuralNights = foldNightsByKey(deduped);

  // 3. Sleep score join (logId → score fields).
  const scoreByLogId = new Map();
  for (const f of phaseAFiles.filter((x) => x.metric === METRIC.SLEEP_SCORE)) {
    throwIfAborted(signal);
    const text = await readText(f.handle);
    const { byLogId, malformedRows } = PARSERS.sleepScoreCsv(text);
    stats.malformedRows += malformedRows;
    for (const [id, v] of byLogId) scoreByLogId.set(id, v);
    fileIdentity.push({
      relativePath: f.relPath,
      size: await readSize(f.handle),
    });
    filesDone += 1;
    stats.filesProcessed += 1;
  }

  // 4. Daily rollup sources (keyed by date) parsed into lookup maps.
  const daily = {
    restingHr: new Map(),
    hrZones: new Map(),
    readiness: new Map(),
    stress: new Map(),
    hrvSummary: new Map(),
    respRateDaily: new Map(),
    respRateStage: new Map(),
    azm: new Map(),
    activity: new Map(),
    temperature: new Map(),
    spo2Daily: new Map(),
  };
  for (const f of phaseAFiles) {
    if (
      f.metric === METRIC.USER_SLEEPS ||
      f.metric === METRIC.SLEEP ||
      f.metric === METRIC.SLEEP_SCORE
    ) {
      continue; // already handled
    }
    throwIfAborted(signal);
    const text = await readText(f.handle);
    mergeDailySource(daily, f, text, stats);
    fileIdentity.push({
      relativePath: f.relPath,
      size: await readSize(f.handle),
    });
    filesDone += 1;
    stats.filesProcessed += 1;
    emitProgress(onProgress, f.metric, filesDone, filesTotal, nightIndex.size);
  }

  // 5. Build the WearableNight skeletons (sleep + daily rollups; intraday metrics
  //    layered in Phase B). Skip nights <= sinceDate (incremental).
  for (const sn of structuralNights) {
    const key = sn.nightKey;
    if (sinceDate && key <= sinceDate) {
      stats.filesSkipped += 0; // night-level skip; not a file skip
      continue;
    }
    const sleep = { ...sn.sleep };
    const scored = sn.logId != null ? scoreByLogId.get(sn.logId) : null;
    if (scored) {
      sleep.score = scored.score;
      sleep.compositionScore = scored.compositionScore;
      sleep.revitalizationScore = scored.revitalizationScore;
    }
    const rhr = daily.restingHr.get(key) ?? null;
    const hrvDaily = daily.hrvSummary.get(key) ?? {};
    const rrDaily = daily.respRateDaily.get(key);
    const rrStage = daily.respRateStage.get(key) ?? null;
    const activityRow = mergeActivityRow(daily, key);

    const coverage = createCoverageBlock();
    if (sn.flags) coverage.flags.push(...sn.flags);

    const night = createWearableNight({
      nightKey: key,
      logId: sn.logId,
      sleepType: sn.sleepType,
      isMainSleep: true,
      sourceFiles: sn.sourceFiles,
      sleep,
      readiness: aggregateReadiness(daily.readiness.get(key) ?? null).value,
      stress: aggregateStress(daily.stress.get(key) ?? null).value,
      hrv: aggregateHRV({
        rmssdMs: hrvDaily.rmssdMs ?? null,
        nremhrBpm: hrvDaily.nremhrBpm ?? null,
        entropy: hrvDaily.entropy ?? null,
        coveragePct: hrvDaily.rmssdMs != null ? 1 : null, // daily summary = full coverage
        windowCount: 0,
      }).value,
      rr: aggregateRespiratoryRate({
        nightlyBrpm: Number.isFinite(rrDaily) ? rrDaily : null,
        perStage: rrStage,
      }).value,
      activityPriorDay: aggregateActivity(activityRow).value,
      temp: aggregateTemperature(daily.temperature.get(key) ?? null).value,
      coverage,
    });
    // Stash daily lookups needed by Phase B onto a side channel (not persisted).
    night.__rhr = rhr;
    night.__hrZones = daily.hrZones.get(key) ?? null;
    night.__startLocalMin = sn.startLocalMin;
    night.__endLocalMin = sn.endLocalMin;
    night.__startLocal = sn.startLocal;
    night.__endLocal = sn.endLocal;
    night.__intraday = {};
    nightIndex.set(key, night);
    if (key) {
      bumpRange(stats.dateRange, key);
      markHighWater(lastIngestedDate, 'sleep', key);
    }
  }
  stats.nights = nightIndex.size;

  /* ----------------------------- PHASE B ----------------------------- */
  // High-frequency metrics. Processed **night-major**: we first bucket every
  // metric's samples by nightKey (metric-ordered so SpO2's resolved offset still
  // seeds later nights via `prevInferredOffset`), then iterate nights in date
  // order and assign ALL of a night's metrics together before flushing+evicting
  // that night exactly once. This guarantees every night receives all of its
  // metrics regardless of position/count — a night is never evicted mid-way
  // through the metric set (perf-storage §2 correctness fix).
  //
  // Memory stays bounded: only the per-night intraday typed arrays are the heavy
  // resident state, and each night's intraday is built then immediately evicted,
  // so at most one night's intraday is resident at a time (well under
  // `MAX_RESIDENT_INTRADAY_NIGHTS`). The transient raw-sample buckets are dropped
  // per night as they are consumed.
  const phaseBMetrics = [
    { metric: METRIC.SPO2_MINUTE, key: 'spo2' },
    { metric: METRIC.HRV_DETAILS, key: 'hrv' },
    { metric: METRIC.SNORE, key: 'snore' },
    { metric: METRIC.HR, key: 'hr' },
  ];

  // nightKey → { spo2?, hrv?, snore?, hr? } bucketed sample payloads.
  /** @type {Map<string, Record<string, object>>} */
  const samplesByNight = new Map();
  for (const { metric, key: metricKey } of phaseBMetrics) {
    throwIfAborted(signal);
    const metricFiles = phaseBFiles
      .filter((f) => f.metric === metric)
      .sort((a, b) => (a.relPath < b.relPath ? -1 : 1));

    for (const f of metricFiles) {
      throwIfAborted(signal);
      const size = await readSize(f.handle);
      if (skipByIdentity(f.relPath, size)) {
        stats.filesSkipped += 1;
        filesDone += 1;
        // BUG 3 fix: carry the skipped (unchanged) file's identity forward so the
        // NEXT incremental run still recognizes it as already-ingested. Without
        // this the manifest would lose every skipped Phase-B file and re-read the
        // full high-frequency export on the next "check for new data".
        fileIdentity.push({ relativePath: f.relPath, size });
        continue;
      }
      const text = await readText(f.handle);
      const byNight = bucketSamplesByNight(metric, text, nightIndex, stats);

      for (const [nightKey, payload] of byNight) {
        if (!nightIndex.has(nightKey)) continue;
        if (sinceDate && nightKey <= sinceDate) continue;
        let perNight = samplesByNight.get(nightKey);
        if (!perNight) {
          perNight = {};
          samplesByNight.set(nightKey, perNight);
        }
        perNight[metricKey] = payload;
      }
      fileIdentity.push({ relativePath: f.relPath, size });
      filesDone += 1;
      stats.filesProcessed += 1;
      emitProgress(
        onProgress,
        metricKey,
        filesDone,
        filesTotal,
        nightIndex.size,
      );
    }
  }

  // Apply all bucketed metrics night-by-night (date order), assigning EVERY
  // metric for a night before that night is flushed+evicted exactly once. SpO2 is
  // applied first per night so its resolved offset is available to the others.
  // Eviction is bounded by `MAX_RESIDENT_INTRADAY_NIGHTS`: a night's intraday
  // typed arrays become eligible for eviction the moment all its metrics are in,
  // so no more than that many nights' intraday is ever resident at once.
  let prevInferredOffset = null;
  let residentNights = 0;
  const orderedNightKeys = [...samplesByNight.keys()].sort();
  for (const nightKey of orderedNightKeys) {
    throwIfAborted(signal);
    const night = nightIndex.get(nightKey);
    if (!night) continue;
    const perNight = samplesByNight.get(nightKey);
    for (const { key: metricKey } of phaseBMetrics) {
      const payload = perNight[metricKey];
      if (!payload) continue;
      applyMetricToNight(
        metricKey,
        night,
        payload,
        prevInferredOffset,
        offsetHints,
        stats,
      );
      if (night.window?.windowSource === 'inferred') {
        prevInferredOffset = night.window.utcOffsetMinutes;
      }
      markHighWater(lastIngestedDate, metricKey, nightKey);
      bumpCount(stats.perMetricCounts, metricKey);
    }
    // This night is fully assigned. Free its raw sample buckets immediately, then
    // persist + evict its intraday once the resident set hits the cap.
    samplesByNight.delete(nightKey);
    residentNights += 1;
    if (residentNights >= MAX_RESIDENT_INTRADAY_NIGHTS) {
      await flushNightAndEvict(night, flushBuffer, nightIndex);
      await flush();
      residentNights -= 1;
    }
  }

  // Final flush: persist every remaining night that received no Phase-B metrics
  // (sleep-only nights are still skeletons in nightIndex) + drain the buffer.
  for (const [, night] of nightIndex) {
    stageNightForFlush(night, flushBuffer);
  }
  await flush(true);

  // Manifest.
  stats.sentinelMinutesRemoved = stats.sentinelMinutesRemoved || 0;
  await setWearableMeta(db, 'lastIngestedDate', lastIngestedDate);
  await setWearableMeta(db, 'files', fileIdentity);
  await setWearableMeta(db, 'ranges', stats.dateRange);
  await setWearableMeta(db, 'stats', {
    nights: stats.nights,
    filesProcessed: stats.filesProcessed,
    filesSkipped: stats.filesSkipped,
    perMetricCounts: stats.perMetricCounts,
    sentinelMinutesRemoved: stats.sentinelMinutesRemoved,
  });

  return {
    stats,
    lastIngestedDate,
    filesProcessed: stats.filesProcessed,
    nights: stats.nights,
  };
}

/* ============================ helpers ============================ */

/** Throw a generic (PHI-free) abort error if the signal is aborted. @private */
function throwIfAborted(signal) {
  if (signal?.aborted) {
    const err = new Error('Ingestion cancelled');
    err.name = 'AbortError';
    throw err;
  }
}

/** Emit a throttled-by-caller progress message. @private */
function emitProgress(onProgress, phase, filesDone, filesTotal, nights) {
  onProgress({ phase, filesDone, filesTotal, nights });
}

/** Merge a daily-source file into the right lookup map. @private */
function mergeDailySource(daily, f, text, stats) {
  switch (f.metric) {
    case METRIC.RESTING_HR: {
      const { byDate, malformedRows } = PARSERS.restingHrJson(text);
      stats.malformedRows += malformedRows;
      for (const [d, v] of byDate) daily.restingHr.set(d, v);
      break;
    }
    case METRIC.HR_ZONES: {
      const { byDate, malformedRows } = PARSERS.hrZonesJson(text);
      stats.malformedRows += malformedRows;
      for (const [d, v] of byDate) daily.hrZones.set(d, v);
      break;
    }
    case METRIC.READINESS: {
      const { byDate, malformedRows } = PARSERS.readinessCsv(text);
      stats.malformedRows += malformedRows;
      for (const [d, v] of byDate) daily.readiness.set(d, v);
      break;
    }
    case METRIC.STRESS: {
      const { byDate, malformedRows } = PARSERS.stressCsv(text);
      stats.malformedRows += malformedRows;
      for (const [d, v] of byDate) daily.stress.set(d, v);
      break;
    }
    case METRIC.HRV_SUMMARY: {
      const { byDate, malformedRows } = PARSERS.hrvSummaryCsv(text);
      stats.malformedRows += malformedRows;
      for (const [d, v] of byDate) daily.hrvSummary.set(d, v);
      break;
    }
    case METRIC.RESP_RATE_DAILY: {
      const { byDate, malformedRows } = PARSERS.respRateDailyCsv(text);
      stats.malformedRows += malformedRows;
      for (const [d, v] of byDate) daily.respRateDaily.set(d, v);
      break;
    }
    case METRIC.RESP_RATE_STAGE: {
      const { byDate, malformedRows } = PARSERS.respRateStageCsv(text);
      stats.malformedRows += malformedRows;
      for (const [d, v] of byDate) daily.respRateStage.set(d, v);
      break;
    }
    case METRIC.AZM: {
      const { byDate, malformedRows } = PARSERS.azmCsv(text);
      stats.malformedRows += malformedRows;
      for (const [d, v] of byDate) daily.azm.set(d, v);
      break;
    }
    case METRIC.STEPS: {
      const { byDate, malformedRows } = PARSERS.dailyActivityJson(text, {
        kind: 'steps',
      });
      stats.malformedRows += malformedRows;
      for (const [d, v] of byDate) {
        const cur = daily.activity.get(d) ?? {};
        daily.activity.set(d, { ...cur, steps: v.steps });
      }
      break;
    }
    case METRIC.ACTIVE_MINUTES: {
      const { byDate, malformedRows } = PARSERS.dailyActivityJson(text, {
        kind: 'activeMinutes',
      });
      stats.malformedRows += malformedRows;
      for (const [d, v] of byDate) {
        const cur = daily.activity.get(d) ?? {};
        daily.activity.set(d, {
          ...cur,
          activeMinutes: (cur.activeMinutes ?? 0) + v.activeMinutes,
        });
      }
      break;
    }
    case METRIC.TEMPERATURE: {
      const { byDate, malformedRows } = PARSERS.temperatureCsv(text);
      stats.malformedRows += malformedRows;
      for (const [d, v] of byDate) daily.temperature.set(d, v);
      break;
    }
    case METRIC.SPO2_DAILY: {
      const { byDate, malformedRows } = PARSERS.spo2DailyCsv(text);
      stats.malformedRows += malformedRows;
      for (const [d, v] of byDate) daily.spo2Daily.set(d, v);
      break;
    }
    default:
      break;
  }
}

/** Combine steps + AZM into one activity row for a date. @private */
function mergeActivityRow(daily, key) {
  const act = daily.activity.get(key);
  const azm = daily.azm.get(key);
  if (act == null && azm == null) return null;
  return {
    steps: act?.steps ?? null,
    activeMinutes: act?.activeMinutes ?? null,
    azmMinutes: azm ?? null,
  };
}

/**
 * Bucket a high-frequency file's samples by nightKey, attaching the night's
 * naive-local window minutes (needed for offset inference). Returns a Map of
 * nightKey → { utcSampleMinutes, samples, startLocalMin, endLocalMin }.
 * @private
 */
function bucketSamplesByNight(metric, text, nightIndex, stats) {
  const result = new Map();
  const ensure = (nightKey) => {
    const night = nightIndex.get(nightKey);
    if (!night) return null;
    if (!result.has(nightKey)) {
      result.set(nightKey, {
        startLocalMin: night.__startLocalMin,
        endLocalMin: night.__endLocalMin,
        utcSampleMinutes: [],
        samples: [],
      });
    }
    return result.get(nightKey);
  };

  if (metric === METRIC.SPO2_MINUTE) {
    const { samples, malformedRows } = PARSERS.minuteSpo2Csv(text);
    stats.malformedRows += malformedRows;
    for (const s of samples) {
      const nightKey = assignToNight(s.utcMs, nightIndex, /*isUtc*/ true);
      const bucket = ensure(nightKey);
      if (!bucket) continue;
      bucket.utcSampleMinutes.push(s.utcMs / MS_PER_MINUTE);
      bucket.samples.push({ utcMs: s.utcMs, value: s.value });
    }
  } else if (metric === METRIC.HRV_DETAILS) {
    const { windows, malformedRows } = PARSERS.hrvDetailsCsv(text);
    stats.malformedRows += malformedRows;
    for (const w of windows) {
      const nightKey = assignToNight(w.localMs, nightIndex, /*isUtc*/ false);
      const bucket = ensure(nightKey);
      if (!bucket) continue;
      bucket.samples.push(w);
    }
  } else if (metric === METRIC.SNORE) {
    const { epochs, malformedRows } = PARSERS.snoreCsv(text);
    stats.malformedRows += malformedRows;
    for (const e of epochs) {
      const nightKey = assignToNight(e.localMs, nightIndex, /*isUtc*/ false);
      const bucket = ensure(nightKey);
      if (!bucket) continue;
      bucket.samples.push(e);
    }
  } else if (metric === METRIC.HR) {
    const { samples, malformedRows } = PARSERS.heartRateJson(text);
    stats.malformedRows += malformedRows;
    for (const s of samples) {
      const nightKey = assignToNight(s.localMs, nightIndex, /*isUtc*/ false);
      const bucket = ensure(nightKey);
      if (!bucket) continue;
      bucket.samples.push({
        value: s.bpm,
        confidence: s.confidence,
        localMs: s.localMs,
      });
    }
  }
  return result;
}

/**
 * Assign a sample timestamp to the nearest night by its naive-local or UTC
 * window. For naive-local samples we compare wall-clock minutes directly; for
 * UTC samples we widen by the inference search bound so the offset resolver can
 * still localize them. Returns a nightKey or `null`.
 * @private
 */
function assignToNight(ms, nightIndex, isUtc) {
  const NEIGHBORHOOD = OFFSET_CONST.SAMPLE_NEIGHBORHOOD_HOURS * 60;
  const minutes = ms / MS_PER_MINUTE;
  for (const [key, night] of nightIndex) {
    const start = night.__startLocalMin;
    const end = night.__endLocalMin;
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    if (isUtc) {
      // UTC sample: candidate local = utc + offset(±14h). Accept if within a
      // wide neighborhood of the window so resolveOffset can refine it.
      if (
        minutes >= start - NEIGHBORHOOD - 840 &&
        minutes <= end + NEIGHBORHOOD + 840
      ) {
        return key;
      }
    } else if (
      minutes >= start - NEIGHBORHOOD &&
      minutes <= end + NEIGHBORHOOD
    ) {
      return key;
    }
  }
  return null;
}

/**
 * Aggregate a metric's bucketed samples onto a WearableNight, resolving the
 * per-night offset for UTC-stamped metrics (SpO2) and window-restricting before
 * aggregation. Also builds the persisted intraday typed array.
 * @private
 */
function applyMetricToNight(
  metricKey,
  night,
  payload,
  prevInferredOffset,
  offsetHints,
  stats,
) {
  const { startLocalMin, endLocalMin } = payload;

  if (metricKey === 'spo2') {
    // Resolve offset from this night's own UTC samples (inference primary).
    const resolved = resolveOffset({
      startLocalMin,
      endLocalMin,
      utcSampleMinutes: payload.utcSampleMinutes,
      userSleepsHintMin: offsetHints.get(night.nightKey) ?? null,
      prevInferredOffset,
    });
    night.window = createWindow({
      startLocal: night.__startLocal,
      endLocal: night.__endLocal,
      utcOffsetMinutes: resolved.utcOffsetMinutes,
    });
    night.windowSource = resolved.windowSource;
    night.offsetDisagreementMin = resolved.offsetDisagreementMin;
    if (resolved.flags?.length) night.coverage.flags.push(...resolved.flags);

    // Window-restrict UTC samples into local time using the resolved offset.
    const off = resolved.utcOffsetMinutes;
    const inWindow = payload.samples.filter((s) => {
      const local = s.utcMs / MS_PER_MINUTE + off;
      return local >= startLocalMin && local < endLocalMin;
    });
    const agg = aggregateSpO2(inWindow);
    night.spo2 = agg.value;
    stats.sentinelMinutesRemoved += agg.sentinelMinutesRemoved || 0;
    night.coverage.spo2SentinelMinutesRemoved +=
      agg.sentinelMinutesRemoved || 0;
    night.coverage.spo2ValidMinutes = agg.validMinutes;
    if (agg.insufficientGroup) night.coverage.insufficient.push('spo2');
    if (agg.flags?.length) night.coverage.flags.push(...agg.flags);
    night.__intraday.spo2 = downsample(
      inWindow.map((s) => ({ ms: s.utcMs, v: s.value })),
      INTRADAY_CADENCE_SEC.spo2,
    );
  } else if (metricKey === 'hr') {
    const inWindow = payload.samples.filter((s) => {
      const local = s.localMs / MS_PER_MINUTE;
      return local >= startLocalMin && local < endLocalMin;
    });
    const agg = aggregateHeartRate(inWindow, { restingBpm: night.__rhr });
    night.hr = agg.value;
    night.coverage.hrSamples = agg.sampleCount;
    if (agg.insufficientGroup) night.coverage.insufficient.push('hr');
    night.__intraday.hr = downsample(
      inWindow.map((s) => ({ ms: s.localMs, v: s.value })),
      INTRADAY_CADENCE_SEC.hr,
    );
  } else if (metricKey === 'hrv') {
    const inWindow = payload.samples.filter((w) => {
      const local = w.localMs / MS_PER_MINUTE;
      return local >= startLocalMin && local < endLocalMin;
    });
    const covValues = inWindow.map((w) => w.coverage).filter(Number.isFinite);
    const meanCov = covValues.length
      ? covValues.reduce((a, b) => a + b, 0) / covValues.length
      : null;
    const rmssdValues = inWindow.map((w) => w.rmssd).filter(Number.isFinite);
    const meanRmssd = rmssdValues.length
      ? rmssdValues.reduce((a, b) => a + b, 0) / rmssdValues.length
      : null;
    const agg = aggregateHRV({
      rmssdMs: night.hrv?.rmssdMs ?? meanRmssd,
      nremhrBpm: night.hrv?.nremhrBpm ?? null,
      entropy: night.hrv?.entropy ?? null,
      coveragePct: meanCov,
      windowCount: inWindow.length,
    });
    if (agg.value) night.hrv = agg.value;
    night.coverage.hrvWindows = inWindow.length;
    if (agg.insufficientGroup && !night.hrv) {
      night.coverage.insufficient.push('hrv');
    }
    night.__intraday.hrv = downsample(
      inWindow.map((w) => ({ ms: w.localMs, v: w.rmssd })),
      INTRADAY_CADENCE_SEC.hrv,
    );
  } else if (metricKey === 'snore') {
    const inWindow = payload.samples.filter((e) => {
      const local = e.localMs / MS_PER_MINUTE;
      return local >= startLocalMin && local < endLocalMin;
    });
    const agg = aggregateSnore(inWindow, {
      asleepMin: night.sleep?.asleepMin ?? null,
    });
    night.snore = agg.value;
    night.coverage.snoreEpochs = agg.epochCount;
    if (agg.insufficientGroup) night.coverage.insufficient.push('snore');
    night.__intraday.snore = downsample(
      inWindow.map((e) => ({ ms: e.localMs, v: e.max_dba })),
      INTRADAY_CADENCE_SEC.snore,
    );
  }
}

/**
 * Downsample a series of `{ ms, v }` points to a fixed cadence (seconds),
 * producing a compact `{ cadenceSec, t0Ms, values: Int16Array }` intraday record
 * payload. Values are rounded to integers (Int16). Empty → null.
 * @private
 */
function downsample(points, cadenceSec) {
  const finite = points.filter(
    (p) => Number.isFinite(p.ms) && Number.isFinite(p.v),
  );
  if (finite.length === 0) return null;
  finite.sort((a, b) => a.ms - b.ms);
  const t0Ms = finite[0].ms;
  const bucketMs = cadenceSec * 1000;
  const buckets = new Map();
  for (const p of finite) {
    const idx = Math.floor((p.ms - t0Ms) / bucketMs);
    const cur = buckets.get(idx);
    if (cur) {
      cur.sum += p.v;
      cur.n += 1;
    } else {
      buckets.set(idx, { sum: p.v, n: 1 });
    }
  }
  const maxIdx = Math.max(...buckets.keys());
  const values = new Int16Array(maxIdx + 1);
  for (let i = 0; i <= maxIdx; i += 1) {
    const b = buckets.get(i);
    values[i] = b ? Math.round(b.sum / b.n) : 0;
  }
  return { cadenceSec, t0Ms, values };
}

/** Stage a night's rollup + intraday records into the flush buffer. @private */
function stageNightForFlush(night, flushBuffer) {
  const intradayMetrics = [];
  const intraday = night.__intraday || {};
  for (const metric of Object.keys(intraday)) {
    const arr = intraday[metric];
    if (!arr) continue;
    intradayMetrics.push(metric);
    flushBuffer.push({
      store: 'wearable_intraday',
      value: {
        nightDate: night.nightKey,
        metric,
        cadenceSec: arr.cadenceSec,
        t0Ms: arr.t0Ms,
        values: arr.values,
      },
    });
  }
  flushBuffer.push({
    store: 'wearable_nights',
    value: serializeNight(night, intradayMetrics),
  });
}

/** Stage + drop a night's intraday from the resident index (eviction). @private */
async function flushNightAndEvict(night, flushBuffer, nightIndex) {
  stageNightForFlush(night, flushBuffer);
  // Drop intraday references so V8 can reclaim the typed arrays.
  night.__intraday = {};
  nightIndex.delete(night.nightKey);
}

/**
 * Produce the persisted `wearable_nights` record (keyPath `nightDate`) from a
 * WearableNight, stripping the `__`-prefixed side-channel fields.
 * @private
 */
function serializeNight(night, intradayMetrics) {
  return {
    nightDate: night.nightKey,
    nightKey: night.nightKey,
    logId: night.logId,
    schemaVersion: 3,
    sleepType: night.sleepType,
    window: night.window,
    windowSource: night.windowSource,
    offsetDisagreementMin: night.offsetDisagreementMin,
    sourceFiles: night.sourceFiles,
    sleep: night.sleep,
    spo2: night.spo2,
    hr: night.hr,
    hrv: night.hrv,
    rr: night.rr,
    readiness: night.readiness,
    stress: night.stress,
    snore: night.snore,
    activityPriorDay: night.activityPriorDay,
    temp: night.temp,
    coverage: night.coverage,
    intradayMetrics,
  };
}

/** Bump a per-metric count. @private */
function bumpCount(counts, metricKey) {
  counts[metricKey] = (counts[metricKey] || 0) + 1;
}

/** Advance a per-metric high-water mark date (max nightKey). @private */
function markHighWater(map, metricKey, nightKey) {
  if (!nightKey) return;
  if (!map[metricKey] || nightKey > map[metricKey]) map[metricKey] = nightKey;
}

/** Track overall date range. @private */
function bumpRange(range, key) {
  if (!range.start || key < range.start) range.start = key;
  if (!range.end || key > range.end) range.end = key;
}

/**
 * Build the incremental skip predicate from a known-files identity set.
 * Skip iff a same-relPath entry records the same byte size (perf §2.5 — no mtime).
 * @private
 */
function makeIdentityPredicate(knownFiles) {
  if (!knownFiles) return () => false;
  const map =
    knownFiles instanceof Map
      ? knownFiles
      : Array.isArray(knownFiles)
        ? new Map(knownFiles.map((f) => [f.relativePath, f.size]))
        : new Map(Object.entries(knownFiles));
  return (relPath, size) => map.has(relPath) && map.get(relPath) === size;
}

export { utcToMinutes, naiveLocalToMinutes };
