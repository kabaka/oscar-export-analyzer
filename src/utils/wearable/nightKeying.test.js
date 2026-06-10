/**
 * Tests for logId de-dup and night-keying (§3.1). Synthetic chunk-file data only.
 */
import { describe, it, expect } from 'vitest';
import {
  dedupSleepSessions,
  deriveSleepArchitecture,
  foldNightsByKey,
} from './nightKeying.js';

/** A synthetic stages main-sleep session. */
function session({
  logId,
  dateOfSleep,
  start = `${dateOfSleep}T23:00:00`,
  end = `${dateOfSleep}T07:00:00`,
  file,
  type = 'stages',
  deep = 60,
  light = 240,
  rem = 90,
  wake = 30,
  asleep = 390,
}) {
  return {
    logId,
    mainSleep: true,
    dateOfSleep,
    startTime: start,
    endTime: end,
    type,
    file,
    timeInBed: 420,
    minutesAsleep: asleep,
    minutesAwake: 30,
    minutesToFallAsleep: 10,
    minutesAfterWakeup: 0,
    efficiency: 92,
    levels: {
      summary: {
        deep: { minutes: deep },
        light: { minutes: light },
        rem: { minutes: rem },
        wake: { minutes: wake },
      },
    },
  };
}

describe('dedupSleepSessions (finding #2 — boundary duplicates)', () => {
  it('collapses a boundary logId shared across two chunk files (counted once)', () => {
    const a = session({
      logId: 100,
      dateOfSleep: '2024-01-15',
      file: 'chunk-A.json',
    });
    const b = session({
      logId: 100,
      dateOfSleep: '2024-01-15',
      file: 'chunk-B.json',
    });
    const { sessions, duplicateCount } = dedupSleepSessions([a, b]);
    expect(sessions).toHaveLength(1);
    expect(duplicateCount).toBe(1);
    expect(sessions[0].sourceFiles).toEqual(['chunk-A.json', 'chunk-B.json']);
  });

  it('flags a window mismatch on a same-logId duplicate', () => {
    const a = session({ logId: 100, dateOfSleep: '2024-01-15', file: 'A' });
    const b = session({
      logId: 100,
      dateOfSleep: '2024-01-15',
      end: '2024-01-15T09:00:00',
      file: 'B',
    });
    const { sessions } = dedupSleepSessions([a, b]);
    expect(sessions[0].dupWindowMismatch).toBe(true);
  });

  it('excludes naps (mainSleep !== true)', () => {
    const nap = {
      ...session({ logId: 7, dateOfSleep: '2024-01-15' }),
      mainSleep: false,
    };
    const { sessions } = dedupSleepSessions([nap]);
    expect(sessions).toHaveLength(0);
  });
});

describe('foldNightsByKey', () => {
  it('boundary dup folds to one night, stage minutes counted once, sourceFiles==2', () => {
    const a = session({
      logId: 100,
      dateOfSleep: '2024-01-15',
      file: 'A',
      deep: 60,
    });
    const b = session({
      logId: 100,
      dateOfSleep: '2024-01-15',
      file: 'B',
      deep: 60,
    });
    const { sessions } = dedupSleepSessions([a, b]);
    const nights = foldNightsByKey(sessions);
    expect(nights).toHaveLength(1);
    expect(nights[0].sleep.deepMin).toBe(60); // NOT doubled
    expect(nights[0].sourceFiles).toHaveLength(2);
    expect(nights[0].flags).not.toContain('split-sleep');
  });

  it('genuine split sleep (≥2 DISTINCT logIds, same nightKey) merges once', () => {
    const a = session({
      logId: 1,
      dateOfSleep: '2024-01-15',
      start: '2024-01-15T22:00:00',
      end: '2024-01-16T01:00:00',
      deep: 30,
      light: 100,
      rem: 20,
      asleep: 150,
    });
    const b = session({
      logId: 2,
      dateOfSleep: '2024-01-15',
      start: '2024-01-16T02:00:00',
      end: '2024-01-16T07:00:00',
      deep: 40,
      light: 150,
      rem: 40,
      asleep: 230,
    });
    const { sessions } = dedupSleepSessions([a, b]);
    const nights = foldNightsByKey(sessions);
    expect(nights).toHaveLength(1);
    expect(nights[0].flags).toContain('split-sleep');
    expect(nights[0].sleep.deepMin).toBe(70); // summed across distinct logIds
    // union window: earliest start, latest end
    expect(nights[0].startLocal).toBe('2024-01-15T22:00:00');
    expect(nights[0].endLocal).toBe('2024-01-16T07:00:00');
  });

  it('classic nights degrade gracefully (null stage minutes + flag)', () => {
    const c = {
      ...session({ logId: 5, dateOfSleep: '2024-01-15', type: 'classic' }),
      levels: {
        summary: { restless: { minutes: 20 }, awake: { minutes: 15 } },
      },
    };
    const { sessions } = dedupSleepSessions([c]);
    const nights = foldNightsByKey(sessions);
    expect(nights[0].sleep.deepMin).toBeNull();
    expect(nights[0].flags).toContain('classic-sleep');
    expect(nights[0].sleep.wasoMin).toBe(35); // restless + awake
  });
});

describe('deriveSleepArchitecture', () => {
  it('computes WASO and stage percentages for stages nights', () => {
    const { sleep, isClassic } = deriveSleepArchitecture(
      session({ logId: 9, dateOfSleep: '2024-01-15', deep: 78, asleep: 390 }),
    );
    expect(isClassic).toBe(false);
    expect(sleep.wasoMin).toBe(20); // awake(30) − onset(10) − afterWakeup(0)
    expect(sleep.deepPct).toBeCloseTo((78 / 390) * 100, 5);
  });
});
