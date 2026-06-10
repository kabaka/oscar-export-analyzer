/**
 * Sleep-session de-duplication and night-keying (§3.1).
 *
 * `sleep-*.json` are ~30-day **chunk** files and the boundary session is
 * re-exported in BOTH adjacent chunks (empirically ~136 logIds appear in two
 * files with identical windows). Keyed naively by `dateOfSleep` this fakes
 * ~127 "split-sleep" nights and would DOUBLE stage minutes / duration / window
 * for ~3% of nights, poisoning every correlation they enter. So:
 *
 *   1. de-dup sessions by `logId` (first-writer-wins) BEFORE any per-night fold;
 *   2. exclude naps (`mainSleep !== true`);
 *   3. group distinct logIds by `dateOfSleep`;
 *   4. fold — a single logId emits one night; genuine split sleep (≥2 DISTINCT
 *      logIds sharing a nightKey) merges (union window, summed stage minutes).
 *
 * This module owns ONLY the structural fold (identity, window, sleep
 * architecture, split-sleep merge, classic/stages degradation). The offset
 * resolution and physiological aggregation are layered on by the worker using
 * {@link module:utils/wearable/offsetInference} and the aggregators; this keeps
 * the de-dup logic independently testable.
 *
 * Pure functions, no DOM/worker/IndexedDB.
 *
 * @module utils/wearable/nightKeying
 */

import { naiveLocalToMinutes } from './offsetInference.js';

/**
 * De-duplicate raw sleep sessions by `logId` (first-writer-wins, §3.1 step 1).
 * Naps (`mainSleep !== true`) are excluded. Boundary duplicates (same logId in
 * a later file) are collapsed; their `file` is recorded in `sourceFiles` and a
 * window mismatch is flagged.
 *
 * @param {Array<{logId:number, mainSleep?:boolean, dateOfSleep:string,
 *   startTime:string, endTime:string, type?:string, file?:string,
 *   levels?:object, timeInBed?:number, minutesAsleep?:number,
 *   minutesAwake?:number, minutesToFallAsleep?:number,
 *   minutesAfterWakeup?:number, efficiency?:number}>} sessions
 *   Raw sessions across ALL chunk files, in deterministic order (e.g. by filename).
 * @returns {{ sessions: object[], duplicateCount: number }}
 *   Distinct-logId sessions, each carrying `sourceFiles` and a possible
 *   `dupWindowMismatch` flag; `duplicateCount` is how many boundary dups collapsed.
 */
export function dedupSleepSessions(sessions) {
  const byLogId = new Map();
  let duplicateCount = 0;

  for (const raw of sessions || []) {
    if (raw?.mainSleep !== true) continue; // naps excluded
    const { logId } = raw;
    if (logId == null) continue;

    if (byLogId.has(logId)) {
      // Boundary duplicate: keep first, record provenance, check window identity.
      duplicateCount += 1;
      const first = byLogId.get(logId);
      if (raw.file != null) first.sourceFiles.push(raw.file);
      const sameWindow =
        first.startTime === raw.startTime &&
        first.endTime === raw.endTime &&
        first.dateOfSleep === raw.dateOfSleep;
      if (!sameWindow) first.dupWindowMismatch = true;
      continue;
    }

    byLogId.set(logId, {
      ...raw,
      sourceFiles: raw.file != null ? [raw.file] : [],
      dupWindowMismatch: false,
    });
  }

  return { sessions: [...byLogId.values()], duplicateCount };
}

/**
 * Derive the sleep-architecture sub-object for one session (§1.1). Handles
 * `stages` vs `classic` graceful degradation: stage minutes are `null` for
 * classic nights (which instead set the `classic-sleep` flag upstream).
 *
 * @param {object} session - A deduped session.
 * @returns {{sleep: object, isClassic: boolean}}
 */
export function deriveSleepArchitecture(session) {
  const isClassic = session.type === 'classic';
  const summary = session.levels?.summary || {};
  const timeInBedMin = numOrNull(session.timeInBed);
  const asleepMin = numOrNull(session.minutesAsleep);
  const awakeMin = numOrNull(session.minutesAwake);
  const onsetLatencyMin = numOrNull(session.minutesToFallAsleep);
  const afterWakeup = numOrNull(session.minutesAfterWakeup) ?? 0;

  let wasoMin = null;
  if (isClassic) {
    const restless = numOrNull(summary.restless?.minutes) ?? 0;
    const awake = numOrNull(summary.awake?.minutes) ?? 0;
    wasoMin = restless + awake;
  } else if (awakeMin != null && onsetLatencyMin != null) {
    wasoMin = Math.max(0, awakeMin - onsetLatencyMin - afterWakeup);
  }

  const deepMin = isClassic ? null : numOrNull(summary.deep?.minutes);
  const lightMin = isClassic ? null : numOrNull(summary.light?.minutes);
  const remMin = isClassic ? null : numOrNull(summary.rem?.minutes);
  const wakeMin = isClassic ? null : numOrNull(summary.wake?.minutes);

  const pct = (stageMin) =>
    stageMin != null && asleepMin != null && asleepMin > 0
      ? (stageMin / asleepMin) * 100
      : null;

  return {
    isClassic,
    sleep: {
      timeInBedMin,
      asleepMin,
      awakeMin,
      onsetLatencyMin,
      wasoMin,
      efficiencyPct: numOrNull(session.efficiency),
      deepMin,
      lightMin,
      remMin,
      wakeMin,
      deepPct: pct(deepMin),
      lightPct: pct(lightMin),
      remPct: pct(remMin),
      // sleep.score and subscores joined later via logId (sleep_score.csv).
      score: null,
    },
  };
}

/**
 * Group deduped sessions by `dateOfSleep` and structurally fold each night
 * (§3.1 step 2). Single-logId nights emit one folded session; genuine split
 * sleep (≥2 DISTINCT logIds) merges (union window via min start / max end,
 * summed stage minutes). Returns the folded structural night plus flags — the
 * worker layers offset resolution + physiological aggregation on top.
 *
 * @param {object[]} dedupedSessions - From {@link dedupSleepSessions}.
 * @returns {Array<{nightKey:string, logId:number, sleepType:string,
 *   startLocal:string, endLocal:string, startLocalMin:number, endLocalMin:number,
 *   sleep:object, sourceFiles:string[], flags:string[]}>}
 *   One folded structural night per `dateOfSleep`, ordered by nightKey ascending.
 */
export function foldNightsByKey(dedupedSessions) {
  const groups = new Map();
  for (const s of dedupedSessions || []) {
    const key = s.dateOfSleep;
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }

  const nights = [];
  for (const [nightKey, group] of groups) {
    if (group.length === 1) {
      nights.push(foldSingle(nightKey, group[0]));
    } else {
      nights.push(mergeSplitSleep(nightKey, group));
    }
  }

  nights.sort((a, b) => (a.nightKey < b.nightKey ? -1 : 1));
  return nights;
}

/** Fold one single-logId session into a structural night. @private */
function foldSingle(nightKey, session) {
  const { sleep, isClassic } = deriveSleepArchitecture(session);
  const flags = [];
  if (isClassic) flags.push('classic-sleep');
  if (session.dupWindowMismatch) flags.push('dup-window-mismatch');
  return {
    nightKey,
    logId: session.logId,
    sleepType: session.type || null,
    startLocal: session.startTime,
    endLocal: session.endTime,
    startLocalMin: naiveLocalToMinutes(session.startTime),
    endLocalMin: naiveLocalToMinutes(session.endTime),
    sleep,
    sourceFiles: session.sourceFiles || [],
    flags,
  };
}

/** Merge ≥2 distinct-logId sessions sharing a nightKey (genuine split sleep). @private */
function mergeSplitSleep(nightKey, group) {
  // Union window: earliest start, latest end (in naive-local minutes).
  let startSession = group[0];
  let endSession = group[0];
  for (const s of group) {
    if (
      naiveLocalToMinutes(s.startTime) <
      naiveLocalToMinutes(startSession.startTime)
    ) {
      startSession = s;
    }
    if (
      naiveLocalToMinutes(s.endTime) > naiveLocalToMinutes(endSession.endTime)
    ) {
      endSession = s;
    }
  }

  const flags = ['split-sleep'];
  let anyClassic = false;
  const sumStage = {
    timeInBedMin: 0,
    asleepMin: 0,
    awakeMin: 0,
    deepMin: 0,
    lightMin: 0,
    remMin: 0,
    wakeMin: 0,
    wasoMin: 0,
  };
  const present = {
    timeInBedMin: false,
    asleepMin: false,
    awakeMin: false,
    deepMin: false,
    lightMin: false,
    remMin: false,
    wakeMin: false,
    wasoMin: false,
  };

  for (const s of group) {
    const { sleep, isClassic } = deriveSleepArchitecture(s);
    if (isClassic) anyClassic = true;
    for (const k of Object.keys(sumStage)) {
      if (Number.isFinite(sleep[k])) {
        sumStage[k] += sleep[k];
        present[k] = true;
      }
    }
  }
  if (anyClassic) flags.push('classic-sleep');

  const asleepMin = present.asleepMin ? sumStage.asleepMin : null;
  const pct = (stageMin) =>
    stageMin != null && asleepMin != null && asleepMin > 0
      ? (stageMin / asleepMin) * 100
      : null;
  const orNull = (k) => (present[k] ? sumStage[k] : null);

  const sourceFiles = [...new Set(group.flatMap((s) => s.sourceFiles || []))];

  return {
    nightKey,
    logId: startSession.logId, // representative; sourceFiles audit the rest
    sleepType: anyClassic ? 'classic' : 'stages',
    startLocal: startSession.startTime,
    endLocal: endSession.endTime,
    startLocalMin: naiveLocalToMinutes(startSession.startTime),
    endLocalMin: naiveLocalToMinutes(endSession.endTime),
    sleep: {
      timeInBedMin: orNull('timeInBedMin'),
      asleepMin,
      awakeMin: orNull('awakeMin'),
      onsetLatencyMin: numOrNull(startSession.minutesToFallAsleep),
      wasoMin: orNull('wasoMin'),
      efficiencyPct: numOrNull(startSession.efficiency),
      deepMin: orNull('deepMin'),
      lightMin: orNull('lightMin'),
      remMin: orNull('remMin'),
      wakeMin: orNull('wakeMin'),
      deepPct: pct(orNull('deepMin')),
      lightPct: pct(orNull('lightMin')),
      remPct: pct(orNull('remMin')),
      score: null,
    },
    sourceFiles,
    flags,
  };
}

/** Coerce to a finite number or `null`. @private */
function numOrNull(v) {
  return Number.isFinite(v) ? v : null;
}
