/**
 * End-to-end ingest-engine tests (perf-storage §2). Drives `runIngest` against
 * a mock File System Access directory + `fake-indexeddb`, with fully synthetic
 * export files (no real PHI). Verifies:
 *   - allowlist-pruned enumeration (denied dirs never read),
 *   - two-phase ingest produces persisted nightly rollups keyed by nightDate,
 *   - SpO2 sentinel handling + offset resolution flow through to a night,
 *   - intraday typed arrays are written and lazily readable,
 *   - the wearable_meta manifest (lastIngestedDate, files) is written,
 *   - incremental skip via the high-water mark.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { runIngest, enumerateExport } from './ingestEngine.js';
import {
  openAppDb,
  getWearableNightsInRange,
  getWearableIntraday,
  getWearableMeta,
} from '../appDb.js';

/* ----------------------- mock FileSystemDirectoryHandle ----------------------- */

function fileHandle(name, text) {
  return {
    kind: 'file',
    name,
    async getFile() {
      return {
        name,
        size: text.length,
        async text() {
          return text;
        },
      };
    },
  };
}

function dirHandle(name, children) {
  // children: array of handles (file or dir)
  return {
    kind: 'directory',
    name,
    async *entries() {
      for (const child of children) yield [child.name, child];
    },
  };
}

/** Build a synthetic export tree from a flat { relPath: text } map. */
function buildExport(fileMap) {
  const root = {};
  for (const [rel, text] of Object.entries(fileMap)) {
    const parts = rel.split('/');
    let cursor = root;
    for (let i = 0; i < parts.length - 1; i += 1) {
      cursor[parts[i]] ??= { __dir: true };
      cursor = cursor[parts[i]];
    }
    cursor[parts[parts.length - 1]] = { __file: text };
  }
  const toHandle = (name, node) => {
    if (node.__file !== undefined) return fileHandle(name, node.__file);
    const children = Object.entries(node)
      .filter(([k]) => k !== '__dir')
      .map(([k, v]) => toHandle(k, v));
    return dirHandle(name, children);
  };
  return toHandle('', root);
}

/* ----------------------------- synthetic fixtures ----------------------------- */

const NIGHT = '2024-02-22';

function fixtures() {
  // Sleep window 23:00 -> 07:00 naive-local.
  const sleep = JSON.stringify([
    {
      logId: 100,
      dateOfSleep: NIGHT,
      startTime: `${NIGHT}T23:00:00.000`,
      endTime: '2024-02-23T07:00:00.000',
      type: 'stages',
      mainSleep: true,
      timeInBed: 480,
      minutesAsleep: 420,
      minutesAwake: 40,
      minutesToFallAsleep: 10,
      efficiency: 92,
      levels: {
        summary: {
          deep: { minutes: 60 },
          light: { minutes: 240 },
          rem: { minutes: 90 },
          wake: { minutes: 30 },
        },
      },
    },
  ]);

  // SpO2 minute samples (UTC+Z). Local window 23:00->07:00 at offset -08:00
  // maps to 07:00Z (23rd) -> 15:00Z (23rd). Spread samples across the WHOLE
  // UTC window so window-fit inference uniquely resolves -480 (-08:00); a
  // narrow cluster would tie across many offsets. Plus a 50.0 sentinel to drop.
  const spo2Rows = ['timestamp,value'];
  for (let min = 0; min < 8 * 60; min += 2) {
    const utc = new Date(Date.UTC(2024, 1, 23, 7, min, 0)).toISOString();
    spo2Rows.push(`${utc},${95 - (min % 3)}`);
  }
  // One sentinel within the window.
  spo2Rows.push(
    `${new Date(Date.UTC(2024, 1, 23, 9, 0, 30)).toISOString()},50.0`,
  );
  const spo2 = spo2Rows.join('\n') + '\n';

  // HR samples (MM/DD/YY naive local) inside 23:00->07:00; >300 samples.
  const hrRows = [];
  for (let i = 0; i < 400; i += 1) {
    const d = new Date(Date.UTC(2024, 1, 22, 23, 0, i * 30)); // every 30s from 23:00
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const yy = String(d.getUTCFullYear()).slice(2);
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mi = String(d.getUTCMinutes()).padStart(2, '0');
    const ss = String(d.getUTCSeconds()).padStart(2, '0');
    hrRows.push({
      dateTime: `${mm}/${dd}/${yy} ${hh}:${mi}:${ss}`,
      value: { bpm: 55 + (i % 5), confidence: 2 },
    });
  }
  const hr = JSON.stringify(hrRows);

  return {
    'Global Export Data/sleep-2024-02-22.json': sleep,
    'Sleep Score/sleep_score.csv':
      'sleep_log_entry_id,overall_score,resting_heart_rate\n100,88,56\n',
    'Health Fitness Data_GoogleData/UserSleeps_0.csv':
      'sleep_start,start_utc_offset\n2024-02-23T07:00:00Z,-08:00\n',
    'Global Export Data/resting_heart_rate-2024-02-22.json': JSON.stringify([
      { dateTime: '02/22/24 00:00:00', value: { date: '02/22/24', value: 56 } },
    ]),
    'Daily Readiness/Daily Readiness Score - 2024-02-01.csv':
      'date,readiness_score_value,readiness_state\n2024-02-22,72,MED\n',
    'Oxygen Saturation (SpO2)/Minute SpO2 - 2024-02-22.csv': spo2,
    'Global Export Data/heart_rate-2024-02-22.json': hr,
    // Denied / out-of-scope files that MUST NOT be read:
    'Your Profile/profile.csv': 'name,email\nA,a@x.com\n',
    'Physical Activity_GoogleData/gps_location_2024-02-22.csv':
      'lat,lng\n1,2\n',
    'Global Export Data/daily_heart_rate_zones.csv': '{bad pseudo json',
  };
}

/* ----------------------------------- tests ----------------------------------- */

describe('enumerateExport — allowlist-pruned', () => {
  it('yields only allowlisted files, never denied/ignored ones', async () => {
    const root = buildExport(fixtures());
    const files = await enumerateExport(root);
    const paths = files.map((f) => f.relPath);
    expect(paths).toContain('Global Export Data/sleep-2024-02-22.json');
    expect(paths).toContain(
      'Oxygen Saturation (SpO2)/Minute SpO2 - 2024-02-22.csv',
    );
    expect(paths).not.toContain('Your Profile/profile.csv');
    expect(paths).not.toContain(
      'Physical Activity_GoogleData/gps_location_2024-02-22.csv',
    );
    expect(paths).not.toContain(
      'Global Export Data/daily_heart_rate_zones.csv',
    );
  });

  it('never even enters a denied directory', async () => {
    let profileRead = false;
    const root = dirHandle('', [
      {
        kind: 'directory',
        name: 'Your Profile',
        async *entries() {
          profileRead = true; // would only run if descended
          yield ['profile.csv', fileHandle('profile.csv', 'x')];
        },
      },
    ]);
    const files = await enumerateExport(root);
    expect(files).toHaveLength(0);
    expect(profileRead).toBe(false);
  });
});

describe('runIngest — two-phase, persisted rollups', () => {
  let originalIdb;
  let db;

  let originalKeyRange;
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

  it('produces a nightly rollup keyed by nightDate with sleep + score + spo2 + hr', async () => {
    const root = buildExport(fixtures());
    const result = await runIngest({ dirHandle: root, db });
    expect(result.nights).toBe(1);

    const nights = await getWearableNightsInRange(
      db,
      '2024-01-01',
      '2024-12-31',
    );
    expect(nights).toHaveLength(1);
    const n = nights[0];
    expect(n.nightDate).toBe(NIGHT);
    expect(n.sleep.deepMin).toBe(60);
    expect(n.sleep.score).toBe(88); // joined via logId
    expect(n.hr.restingBpm).toBe(56);
    // SpO2 aggregated with sentinel dropped.
    expect(n.spo2).not.toBeNull();
    expect(n.coverage.spo2SentinelMinutesRemoved).toBeGreaterThanOrEqual(1);
    // HR aggregated.
    expect(n.hr.sleepingAvgBpm).toBeGreaterThan(50);
    expect(n.intradayMetrics).toEqual(expect.arrayContaining(['spo2', 'hr']));
  });

  it('resolves the per-night offset from the SpO2 UTC samples (inferred)', async () => {
    const root = buildExport(fixtures());
    await runIngest({ dirHandle: root, db });
    const nights = await getWearableNightsInRange(
      db,
      '2024-01-01',
      '2024-12-31',
    );
    expect(nights[0].window.utcOffsetMinutes).toBe(-480); // -08:00 inferred
    expect(nights[0].windowSource).toBe('inferred');
  });

  it('writes lazily-readable intraday typed arrays', async () => {
    const root = buildExport(fixtures());
    await runIngest({ dirHandle: root, db });
    const hr = await getWearableIntraday(db, NIGHT, 'hr');
    expect(hr).not.toBeNull();
    expect(hr.cadenceSec).toBe(60);
    // structured-clone may return a cross-realm typed array; duck-check it.
    expect(ArrayBuffer.isView(hr.values)).toBe(true);
    expect(hr.values.constructor.name).toBe('Int16Array');
    expect(hr.values.length).toBeGreaterThan(0);
  });

  it('writes the wearable_meta manifest (high-water mark + identity set)', async () => {
    const root = buildExport(fixtures());
    await runIngest({ dirHandle: root, db });
    const hw = await getWearableMeta(db, 'lastIngestedDate');
    expect(hw.sleep).toBe(NIGHT);
    expect(hw.hr).toBe(NIGHT);
    const files = await getWearableMeta(db, 'files');
    expect(Array.isArray(files)).toBe(true);
    expect(
      files.some((f) => f.relativePath.includes('sleep-2024-02-22.json')),
    ).toBe(true);
  });

  it('skips nights at/below the incremental high-water mark', async () => {
    const root = buildExport(fixtures());
    const result = await runIngest({
      dirHandle: root,
      db,
      opts: { sinceDate: NIGHT }, // skip everything <= this night
    });
    expect(result.nights).toBe(0);
  });

  it('honors an abort signal mid-ingest', async () => {
    const root = buildExport(fixtures());
    const controller = new AbortController();
    controller.abort();
    await expect(
      runIngest({ dirHandle: root, db, signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('does not throw when a malformed file is in scope', async () => {
    const map = fixtures();
    // Corrupt the HR file — must skip, not abort the whole ingest.
    map['Global Export Data/heart_rate-2024-02-22.json'] = '{not json';
    const root = buildExport(map);
    const result = await runIngest({ dirHandle: root, db });
    expect(result.nights).toBe(1);
    const nights = await getWearableNightsInRange(
      db,
      '2024-01-01',
      '2024-12-31',
    );
    // Sleep still present; HR absent (file was unparseable → null group).
    expect(nights[0].sleep.deepMin).toBe(60);
    expect(nights[0].hr).toBeNull();
  });
});
