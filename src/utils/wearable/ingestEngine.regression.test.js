/**
 * Red-team regression tests for the wearable ingest engine (perf-storage §2 +
 * §3.x correctness fixes). These complement the happy-path coverage in
 * `ingestEngine.test.js` by driving the EMPIRICALLY-FOUND bugs end-to-end through
 * `runIngest` (mock File System Access dir + `fake-indexeddb`). The underlying
 * pure functions (`resolveOffset`, `dedupSleepSessions`, `aggregateSpO2`) are
 * unit-tested in isolation elsewhere; the value here is proving the bug stays
 * fixed once those pieces are wired together inside the engine, where the offset
 * hint actually flows from `UserSleeps_*.csv`, two real chunk files collide, and
 * the incremental `{relativePath,size}` identity set gates re-parsing.
 *
 * All fixtures are fully synthetic — no real PHI (oscar-test-data-generation,
 * oscar-privacy-boundaries).
 *
 * Guards:
 *   (a) Pacific `+00:00` hint night → resolver returns the INFERRED -480, not
 *       the placeholder hint; SpO2 samples land in-window.
 *   (b) Chunk-file boundary duplicate (same logId, two files) → one night, stage
 *       minutes not doubled.
 *   (c) Incremental re-import → matching `{relativePath,size}` Phase-B files are
 *       skipped (no re-parse), a new dated file is picked up, mtime is irrelevant.
 *   (d) SpO2 night with real sub-70 readings → retained + flagged, `===50.0`
 *       sentinels dropped.
 *
 * Plus an expanded end-to-end ingestion test exercising HRV details / snore /
 * HRV+RR summaries alongside the core metrics, and explicit instrumentation that
 * a denied PII subtree and an ignored file are NEVER opened/parsed.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { runIngest } from './ingestEngine.js';
import {
  openAppDb,
  getWearableNightsInRange,
  getWearableIntraday,
  getWearableMeta,
} from '../appDb.js';

/* ----------------------- mock FileSystemDirectoryHandle ----------------------- */

/**
 * Build a file handle. `opts.onRead` is invoked whenever the file's text is
 * actually read, letting a test prove a denied/ignored/skipped file was never
 * opened. `opts.size` overrides the byte size (defaults to text length) so we
 * can decouple size from mtime for the incremental-identity test.
 */
function fileHandle(name, text, { onRead = null, size = null } = {}) {
  return {
    kind: 'file',
    name,
    async getFile() {
      return {
        name,
        size: size ?? text.length,
        async text() {
          if (onRead) onRead(name);
          return text;
        },
      };
    },
  };
}

function dirHandle(name, children, { onEnter = null } = {}) {
  return {
    kind: 'directory',
    name,
    async *entries() {
      if (onEnter) onEnter(name);
      for (const child of children) yield [child.name, child];
    },
  };
}

/**
 * Build a synthetic export tree from a flat `{ relPath: text | {text, size, onRead} }`
 * map. Directory entries can carry an `onEnter` spy via `__dirSpies[prefix]`.
 */
function buildExport(fileMap, { dirSpies = {}, fileSpies = {} } = {}) {
  const root = {};
  for (const [rel, val] of Object.entries(fileMap)) {
    const parts = rel.split('/');
    let cursor = root;
    for (let i = 0; i < parts.length - 1; i += 1) {
      cursor[parts[i]] ??= { __dir: true };
      cursor = cursor[parts[i]];
    }
    const spec = typeof val === 'string' ? { text: val } : val;
    cursor[parts[parts.length - 1]] = {
      __file: spec.text,
      __size: spec.size ?? null,
      __relPath: rel,
    };
  }
  const toHandle = (name, node, prefix) => {
    if (node.__file !== undefined) {
      return fileHandle(name, node.__file, {
        size: node.__size,
        onRead: fileSpies[node.__relPath] ?? null,
      });
    }
    const here = prefix ? `${prefix}${name}/` : name ? `${name}/` : '';
    const children = Object.entries(node)
      .filter(([k]) => k !== '__dir')
      .map(([k, v]) => toHandle(k, v, here));
    return dirHandle(name, children, { onEnter: dirSpies[here] ?? null });
  };
  return toHandle('', root, '');
}

/* --------------------------------- builders --------------------------------- */

const pad = (n) => String(n).padStart(2, '0');
const isoDate = (d) =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/** A single-session `sleep-*.json` (stages) for a 23:00→07:00 naive-local night. */
function sleepJson({
  logId,
  night,
  deep = 60,
  light = 240,
  rem = 90,
  wake = 30,
}) {
  const [y, m, d] = night.split('-').map(Number);
  const nextDay = isoDate(new Date(Date.UTC(y, m - 1, d + 1)));
  return JSON.stringify([
    {
      logId,
      dateOfSleep: night,
      startTime: `${night}T23:00:00.000`,
      endTime: `${nextDay}T07:00:00.000`,
      type: 'stages',
      mainSleep: true,
      timeInBed: 480,
      minutesAsleep: 420,
      minutesAwake: 40,
      minutesToFallAsleep: 10,
      efficiency: 92,
      levels: {
        summary: {
          deep: { minutes: deep },
          light: { minutes: light },
          rem: { minutes: rem },
          wake: { minutes: wake },
        },
      },
    },
  ]);
}

/**
 * Minute-SpO2 CSV (true UTC `Z`). For a Pacific night the local window
 * 23:00→07:00 at offset -480 maps to UTC 07:00→15:00 on `utcDay`. Samples are
 * spread across the WHOLE UTC window so window-fit inference uniquely resolves
 * -480 (a narrow cluster would tie across offsets). `extraRows` injects sentinel
 * / sub-70 readings.
 */
function minuteSpo2Csv({
  utcYear,
  utcMonth,
  utcDay,
  value = (min) => 95 - (min % 3),
  extraRows = [],
}) {
  const rows = ['timestamp,value'];
  for (let min = 0; min < 8 * 60; min += 2) {
    const utc = new Date(
      Date.UTC(utcYear, utcMonth, utcDay, 7, min, 0),
    ).toISOString();
    rows.push(`${utc},${value(min)}`);
  }
  rows.push(...extraRows);
  return rows.join('\n') + '\n';
}

/** Heart-rate JSON (MM/DD/YY naive-local) across the 23:00→07:00 window. */
function heartRateJson({ year, month, day, n = 400 }) {
  const rows = [];
  for (let i = 0; i < n; i += 1) {
    const d = new Date(Date.UTC(year, month, day, 23, 0, i * 30));
    const mm = pad(d.getUTCMonth() + 1);
    const dd = pad(d.getUTCDate());
    const yy = String(d.getUTCFullYear()).slice(2);
    rows.push({
      dateTime: `${mm}/${dd}/${yy} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`,
      value: { bpm: 55 + (i % 5), confidence: 2 },
    });
  }
  return JSON.stringify(rows);
}

/* ----------------------------------- setup ----------------------------------- */

function withIndexedDb() {
  let originalIdb;
  let originalKeyRange;
  let db;
  beforeEach(async () => {
    originalIdb = globalThis.indexedDB;
    originalKeyRange = globalThis.IDBKeyRange;
    globalThis.indexedDB = new IDBFactory();
    globalThis.IDBKeyRange = IDBKeyRange;
    db = await openAppDb();
  });
  afterEach(() => {
    db?.close();
    globalThis.indexedDB = originalIdb;
    globalThis.IDBKeyRange = originalKeyRange;
  });
  return () => db;
}

/* ===========================================================================
 * (a) Pacific +00:00 hint night — inference must override the placeholder hint
 * =========================================================================== */

describe('runIngest regression (a) — Pacific +00:00 hint overridden by inference', () => {
  const getDb = withIndexedDb();
  const NIGHT = '2024-02-22';

  function pacificFixture() {
    return {
      'Global Export Data/sleep-2024-02-22.json': sleepJson({
        logId: 100,
        night: NIGHT,
      }),
      // UserSleeps reports the +00:00 PLACEHOLDER for this night (88% of rows
      // do). sleep_start is stored as UTC; with +00:00 the local date is still
      // 2024-02-22, so the hint lands on the right night but with offset 0.
      'Health Fitness Data_GoogleData/UserSleeps_0.csv':
        'sleep_start,start_utc_offset\n2024-02-22T23:00:00Z,+00:00\n',
      // SpO2 in true UTC: local 23:00→07:00 PST ⇒ UTC 07:00→15:00 on the 23rd.
      'Oxygen Saturation (SpO2)/Minute SpO2 - 2024-02-22.csv': minuteSpo2Csv({
        utcYear: 2024,
        utcMonth: 1,
        utcDay: 23,
      }),
    };
  }

  it('resolves the INFERRED -480 (not the +00:00 hint) and lands SpO2 in-window', async () => {
    const db = getDb();
    const root = buildExport(pacificFixture());
    await runIngest({ dirHandle: root, db });

    const nights = await getWearableNightsInRange(
      db,
      '2024-01-01',
      '2024-12-31',
    );
    expect(nights).toHaveLength(1);
    const n = nights[0];
    // The placeholder hint (0) was discarded; window-fit inference won.
    expect(n.windowSource).toBe('inferred');
    expect(n.window.utcOffsetMinutes).toBe(-480);
    // Because the offset is correct, the SpO2 samples fall inside the window and
    // aggregate to a real value (a +00:00 window would capture ~zero samples).
    expect(n.spo2).not.toBeNull();
    expect(n.spo2.validMinutes).toBeGreaterThan(0);
    expect(n.coverage.spo2ValidMinutes).toBeGreaterThan(0);
  });

  it('does NOT silently trust the placeholder hint (no +00:00 window leak)', async () => {
    const db = getDb();
    const root = buildExport(pacificFixture());
    await runIngest({ dirHandle: root, db });
    const [n] = await getWearableNightsInRange(db, '2024-01-01', '2024-12-31');
    expect(n.window.utcOffsetMinutes).not.toBe(0);
  });
});

/* ===========================================================================
 * (b) Chunk-file boundary duplicate — same logId in two files, counted once
 * =========================================================================== */

describe('runIngest regression (b) — chunk-boundary duplicate sleep collapses to one night', () => {
  const getDb = withIndexedDb();
  const NIGHT = '2024-03-15';

  it('the same logId in two chunk files yields ONE night with un-doubled stage minutes', async () => {
    const db = getDb();
    // Identical boundary session re-exported in two adjacent ~30-day chunk files.
    const session = sleepJson({
      logId: 777,
      night: NIGHT,
      deep: 70,
      light: 230,
      rem: 80,
      wake: 40,
    });
    const root = buildExport({
      'Global Export Data/sleep-2024-03-01.json': session,
      'Global Export Data/sleep-2024-03-15.json': session,
    });
    const result = await runIngest({ dirHandle: root, db });

    // Two sleep files were processed, but they fold to a single night.
    expect(result.nights).toBe(1);
    const nights = await getWearableNightsInRange(
      db,
      '2024-01-01',
      '2024-12-31',
    );
    expect(nights).toHaveLength(1);
    const n = nights[0];
    expect(n.nightDate).toBe(NIGHT);
    // Stage minutes are NOT doubled (deep stays 70, not 140) — no fake split.
    expect(n.sleep.deepMin).toBe(70);
    expect(n.sleep.remMin).toBe(80);
    expect(n.sleep.asleepMin).toBe(420);
    // It is NOT mislabelled as genuine split sleep (that flag is reserved for
    // ≥2 DISTINCT logIds sharing a nightKey — a boundary dup is one logId).
    expect(n.coverage.flags).not.toContain('split-sleep');
    // Provenance records both source files for the collapsed duplicate.
    expect(n.sourceFiles.length).toBeGreaterThanOrEqual(2);
  });
});

/* ===========================================================================
 * (c) Incremental re-import — size identity gates re-parse; mtime is irrelevant
 * =========================================================================== */

describe('runIngest regression (c) — incremental re-import skips by {relativePath,size}', () => {
  const getDb = withIndexedDb();

  const N1 = '2024-04-10';
  const SPO2_1 = 'Oxygen Saturation (SpO2)/Minute SpO2 - 2024-04-10.csv';

  function firstRunFixture() {
    return {
      'Global Export Data/sleep-2024-04-10.json': sleepJson({
        logId: 1,
        night: N1,
      }),
      'Health Fitness Data_GoogleData/UserSleeps_0.csv':
        'sleep_start,start_utc_offset\n2024-04-10T23:00:00Z,+00:00\n',
      [SPO2_1]: minuteSpo2Csv({ utcYear: 2024, utcMonth: 3, utcDay: 11 }),
    };
  }

  it('first run writes the {relativePath,size} identity set into wearable_meta', async () => {
    const db = getDb();
    await runIngest({ dirHandle: buildExport(firstRunFixture()), db });
    const files = await getWearableMeta(db, 'files');
    expect(Array.isArray(files)).toBe(true);
    const spo2Entry = files.find((f) => f.relativePath === SPO2_1);
    expect(spo2Entry).toBeTruthy();
    expect(typeof spo2Entry.size).toBe('number');
  });

  it('re-running over unchanged Phase-B files SKIPS them (no re-parse), even with a different mtime', async () => {
    const db = getDb();
    // First run to obtain the identity set the hook would persist.
    await runIngest({ dirHandle: buildExport(firstRunFixture()), db });
    const knownFiles = await getWearableMeta(db, 'files');

    // Second run: a fresh tree with the SAME text/size, but instrument reads.
    // The mock file has no mtime at all — proving size identity alone drives the
    // skip and mtime is irrelevant (perf §2.5).
    const reads = [];
    const root = buildExport(firstRunFixture(), {
      fileSpies: { [SPO2_1]: (name) => reads.push(name) },
    });
    const result = await runIngest({
      dirHandle: root,
      db,
      opts: { knownFiles },
    });

    // The unchanged Minute-SpO2 file was skipped, not opened for text.
    expect(reads).toHaveLength(0);
    expect(result.stats.filesSkipped).toBeGreaterThanOrEqual(1);
  });

  it('a NEW dated Phase-B file is picked up on re-import while old ones stay skipped', async () => {
    const db = getDb();
    await runIngest({ dirHandle: buildExport(firstRunFixture()), db });
    const knownFiles = await getWearableMeta(db, 'files');

    const N2 = '2024-04-11';
    const SPO2_2 = 'Oxygen Saturation (SpO2)/Minute SpO2 - 2024-04-11.csv';
    const oldReads = [];
    const newReads = [];
    const fixture = {
      ...firstRunFixture(),
      // A second night, only present on the re-import.
      'Global Export Data/sleep-2024-04-11.json': sleepJson({
        logId: 2,
        night: N2,
      }),
      [SPO2_2]: minuteSpo2Csv({ utcYear: 2024, utcMonth: 3, utcDay: 12 }),
    };
    const root = buildExport(fixture, {
      fileSpies: {
        [SPO2_1]: (name) => oldReads.push(name),
        [SPO2_2]: (name) => newReads.push(name),
      },
    });
    await runIngest({ dirHandle: root, db, opts: { knownFiles } });

    // Old file skipped, new file parsed.
    expect(oldReads).toHaveLength(0);
    expect(newReads.length).toBeGreaterThanOrEqual(1);

    const nights = await getWearableNightsInRange(
      db,
      '2024-01-01',
      '2024-12-31',
    );
    const dates = nights.map((n) => n.nightDate);
    expect(dates).toContain(N2);
  });

  it('mtime is irrelevant: a file with the same size but a changed mtime is still skipped', async () => {
    const db = getDb();
    await runIngest({ dirHandle: buildExport(firstRunFixture()), db });
    const knownFiles = await getWearableMeta(db, 'files');

    // Re-build with an explicit (but identical) size to simulate a touched file
    // whose bytes are unchanged. There is no mtime field anywhere in the mock,
    // so the only thing that could distinguish it is size — which matches.
    const reads = [];
    const sameSizeText = minuteSpo2Csv({
      utcYear: 2024,
      utcMonth: 3,
      utcDay: 11,
    });
    const fixture = {
      ...firstRunFixture(),
      [SPO2_1]: { text: sameSizeText, size: sameSizeText.length },
    };
    const root = buildExport(fixture, {
      fileSpies: { [SPO2_1]: (name) => reads.push(name) },
    });
    const result = await runIngest({
      dirHandle: root,
      db,
      opts: { knownFiles },
    });
    expect(reads).toHaveLength(0);
    expect(result.stats.filesSkipped).toBeGreaterThanOrEqual(1);
  });
});

/* ===========================================================================
 * (d) SpO2 sentinel vs. real sub-70 — drop ===50.0, RETAIN + flag real lows
 * =========================================================================== */

describe('runIngest regression (d) — sentinel dropped, real sub-70 retained + flagged', () => {
  const getDb = withIndexedDb();
  const NIGHT = '2024-05-20';

  it('drops ===50.0 sentinels but keeps and flags genuine sub-70 desaturations', async () => {
    const db = getDb();
    // Real sub-70 nadirs (66, 68) inside the UTC window, plus pure 50.0 sentinels.
    const sentinelTs = (h, m, s) =>
      new Date(Date.UTC(2024, 4, 21, h, m, s)).toISOString();
    const extraRows = [
      `${sentinelTs(8, 0, 30)},50.0`,
      `${sentinelTs(8, 1, 30)},50.0`,
      `${sentinelTs(9, 0, 15)},66`, // genuine deep desaturation (NOT sentinel)
      `${sentinelTs(9, 1, 15)},68`,
    ];
    const root = buildExport({
      'Global Export Data/sleep-2024-05-20.json': sleepJson({
        logId: 5,
        night: NIGHT,
      }),
      'Health Fitness Data_GoogleData/UserSleeps_0.csv':
        'sleep_start,start_utc_offset\n2024-05-20T23:00:00Z,+00:00\n',
      'Oxygen Saturation (SpO2)/Minute SpO2 - 2024-05-20.csv': minuteSpo2Csv({
        utcYear: 2024,
        utcMonth: 4,
        utcDay: 21,
        extraRows,
      }),
    });
    await runIngest({ dirHandle: root, db });

    const [n] = await getWearableNightsInRange(db, '2024-01-01', '2024-12-31');
    expect(n).toBeTruthy();
    // Sentinels removed (≥2 we injected).
    expect(n.coverage.spo2SentinelMinutesRemoved).toBeGreaterThanOrEqual(2);
    // Real sub-70 nadir retained → post-filter min reflects the true low (≤68),
    // NOT collapsed to the 50.0 sentinel and NOT clipped away.
    expect(n.spo2.minPct).toBeLessThanOrEqual(68);
    expect(n.spo2.minPct).toBeGreaterThan(50);
    // And the genuine low is surfaced as a flag, never silently deleted.
    expect(n.spo2.subSeventyNonSentinelMinutes).toBeGreaterThanOrEqual(2);
    expect(n.coverage.flags).toContain('spo2-sub70-nonsentinel');
  });
});

/* ===========================================================================
 * Expanded end-to-end ingestion — HRV/snore/summaries + denied/ignored guards
 * =========================================================================== */

describe('runIngest — expanded end-to-end ingestion (HRV/snore/summaries; privacy guards)', () => {
  const getDb = withIndexedDb();
  const NIGHT = '2024-06-08';

  // Spies prove the denied subtree is never descended and the ignored file is
  // never opened.
  const profileReads = [];
  const ignoredReads = [];
  const profileDirEnters = [];

  function fullFixture() {
    // HRV details (5-min naive-local windows) inside 23:00→07:00.
    const hrvRows = ['timestamp,rmssd,coverage,low_frequency,high_frequency'];
    for (let i = 0; i < 90; i += 1) {
      const d = new Date(Date.UTC(2024, 5, 8, 23, 0, 0) + i * 5 * 60000);
      hrvRows.push(`${isoNaive(d)},${30 + (i % 5)},0.95,120,180`);
    }
    // Snore epochs (30s naive-local) inside the window.
    const snoreRows = ['timestamp,mean_dba,max_dba,snore_label'];
    for (let i = 0; i < 120; i += 1) {
      const d = new Date(Date.UTC(2024, 5, 8, 23, 30, 0) + i * 30000);
      snoreRows.push(`${isoNaive(d)},38,${40 + (i % 6)},1`);
    }

    const map = {
      'Global Export Data/sleep-2024-06-08.json': sleepJson({
        logId: 9,
        night: NIGHT,
      }),
      'Sleep Score/sleep_score.csv':
        'sleep_log_entry_id,overall_score,resting_heart_rate\n9,84,57\n',
      'Health Fitness Data_GoogleData/UserSleeps_0.csv':
        'sleep_start,start_utc_offset\n2024-06-08T23:00:00Z,+00:00\n',
      'Global Export Data/resting_heart_rate-2024-06-08.json': JSON.stringify([
        {
          dateTime: '06/08/24 00:00:00',
          value: { date: '06/08/24', value: 57 },
        },
      ]),
      'Daily Readiness/Daily Readiness Score - 2024-06-01.csv':
        'date,readiness_score_value,readiness_state\n2024-06-08,71,MED\n',
      'Heart Rate Variability/Daily Heart Rate Variability Summary - 2024-06-08.csv':
        'timestamp,rmssd,nremhr,entropy\n2024-06-08T02:00:00,42,54,2.3\n',
      'Heart Rate Variability/Daily Respiratory Rate Summary - 2024-06-08.csv':
        'timestamp,daily_respiratory_rate\n2024-06-08T02:00:00,15.2\n',
      'Heart Rate Variability/Heart Rate Variability Details - 2024-06-08.csv':
        hrvRows.join('\n') + '\n',
      'Snore and Noise Detect/Snore Details - 2024-06-08.csv':
        snoreRows.join('\n') + '\n',
      'Oxygen Saturation (SpO2)/Minute SpO2 - 2024-06-08.csv': minuteSpo2Csv({
        utcYear: 2024,
        utcMonth: 5,
        utcDay: 9,
      }),
      'Global Export Data/heart_rate-2024-06-08.json': heartRateJson({
        year: 2024,
        month: 5,
        day: 8,
      }),
    };

    // Denied PII subtree (must never be descended) + an ignored summary file
    // (allowlist-miss → never opened). daily_heart_rate_zones.csv is IGNORED.
    const dirSpies = { 'Your Profile/': (name) => profileDirEnters.push(name) };
    const fileSpies = {
      'Your Profile/profile.csv': (name) => profileReads.push(name),
      'Global Export Data/daily_heart_rate_zones.csv': (name) =>
        ignoredReads.push(name),
    };
    const denied = {
      'Your Profile/profile.csv': 'name,email\nA,a@x.com\n',
      'Physical Activity_GoogleData/gps_location_2024-06-08.csv':
        'lat,lng\n1,2\n',
      'Global Export Data/daily_heart_rate_zones.csv': '{ ignored summary }',
    };
    return {
      root: buildExport({ ...map, ...denied }, { dirSpies, fileSpies }),
    };
  }

  beforeEach(() => {
    profileReads.length = 0;
    ignoredReads.length = 0;
    profileDirEnters.length = 0;
  });

  it('persists a complete night with sleep+score+spo2+hr+hrv+snore+rr and intraday', async () => {
    const db = getDb();
    const { root } = fullFixture();
    const result = await runIngest({ dirHandle: root, db });
    expect(result.nights).toBe(1);

    const [n] = await getWearableNightsInRange(db, '2024-01-01', '2024-12-31');
    expect(n.nightDate).toBe(NIGHT);
    expect(n.sleep.deepMin).toBe(60);
    expect(n.sleep.score).toBe(84); // joined via logId
    expect(n.hr.restingBpm).toBe(57);
    expect(n.spo2).not.toBeNull();
    expect(n.hrv).not.toBeNull();
    expect(n.rr).not.toBeNull();
    expect(n.snore).not.toBeNull();
    // Intraday typed arrays were written for the high-frequency metrics.
    expect(n.intradayMetrics).toEqual(
      expect.arrayContaining(['spo2', 'hr', 'hrv', 'snore']),
    );
    const spo2Intraday = await getWearableIntraday(db, NIGHT, 'spo2');
    expect(spo2Intraday).not.toBeNull();
    expect(ArrayBuffer.isView(spo2Intraday.values)).toBe(true);
  });

  it('NEVER opens a denied PII subtree or an ignored file (privacy boundary)', async () => {
    const db = getDb();
    const { root } = fullFixture();
    await runIngest({ dirHandle: root, db });

    // The denied `Your Profile/` directory was pruned at descent — never entered,
    // its file never read. The ignored daily_heart_rate_zones.csv never opened.
    expect(profileDirEnters).toHaveLength(0);
    expect(profileReads).toHaveLength(0);
    expect(ignoredReads).toHaveLength(0);

    // And the manifest's identity set contains only allowlisted files.
    const files = await getWearableMeta(db, 'files');
    const relPaths = files.map((f) => f.relativePath);
    expect(relPaths.some((p) => p.startsWith('Your Profile/'))).toBe(false);
    expect(relPaths.some((p) => p.includes('gps_location'))).toBe(false);
    expect(relPaths.some((p) => p.includes('daily_heart_rate_zones.csv'))).toBe(
      false,
    );
  });
});

/** `YYYY-MM-DDTHH:mm:ss` naive-local from a Date (UTC fields read literally). */
function isoNaive(d) {
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
  );
}
