/**
 * Tests for wearable↔OSCAR alignment (§3.3–3.5). Synthetic data only.
 */
import { describe, it, expect } from 'vitest';
import {
  oscarDateKey,
  overlapHours,
  alignWearableToOscar,
  hasLargeDurationMismatch,
} from './alignment.js';
import { createWearableNight, createWindow } from './wearableNight.js';

/** A synthetic WearableNight with a given asleep duration. */
function wnight(nightKey, asleepMin = 420, windowSource = 'inferred') {
  return createWearableNight({
    nightKey,
    window: createWindow({
      startLocal: `${nightKey}T23:00:00`,
      endLocal: `${nightKey}T07:00:00`,
      utcOffsetMinutes: -480,
    }),
    windowSource,
    sleep: { asleepMin, efficiencyPct: 90 },
  });
}

/** A synthetic OSCAR summary row. */
function oscarRow(date, ahi = 3.2, totalTime = 7.0) {
  return {
    Date: date,
    AHI: String(ahi),
    'Total Time': String(totalTime),
    'Median EPAP': '8.0',
  };
}

describe('oscarDateKey', () => {
  it('extracts YYYY-MM-DD from a string', () => {
    expect(oscarDateKey('2024-01-15 00:00:00')).toBe('2024-01-15');
  });
  it('returns empty for unparseable', () => {
    expect(oscarDateKey('garbage')).toBe('');
  });
});

describe('overlapHours', () => {
  it('uses min(usage, asleep) when both present', () => {
    const w = wnight('2024-01-15', 420); // 7h asleep
    expect(overlapHours({ usageHours: 6 }, w)).toBe(6);
  });
});

describe('alignWearableToOscar', () => {
  it('matches exact nightKey', () => {
    const res = alignWearableToOscar(
      [oscarRow('2024-01-15')],
      [wnight('2024-01-15')],
    );
    expect(res.aligned).toHaveLength(1);
    expect(res.aligned[0].matchType).toBe('exact');
    expect(res.aligned[0].oscar.ahi).toBeCloseTo(3.2, 5);
  });

  it('±1-day shifted match requires the overlap gate', () => {
    // OSCAR labeled one day after the wearable night; ample overlap (7h ≥ 4h gate).
    const res = alignWearableToOscar(
      [oscarRow('2024-01-16', 4, 7)],
      [wnight('2024-01-15', 420)],
    );
    expect(res.aligned).toHaveLength(1);
    expect(res.aligned[0].matchType).toBe('shifted-1');
  });

  it('does not steal a neighbor when overlap fails the gate', () => {
    const res = alignWearableToOscar(
      [oscarRow('2024-01-16', 4, 1)], // only 1h usage < 4h gate
      [wnight('2024-01-15', 60)], // 1h asleep
    );
    expect(res.aligned).toHaveLength(0);
    expect(res.unmatchedOscar).toHaveLength(1);
  });

  it('is one-to-one: a consumed wearable night cannot match twice', () => {
    const res = alignWearableToOscar(
      [oscarRow('2024-01-15'), oscarRow('2024-01-15')],
      [wnight('2024-01-15')],
    );
    expect(res.aligned).toHaveLength(1);
    expect(res.unmatchedOscar).toHaveLength(1);
  });

  it('empty either side → empty aligned, full unmatched, no throw', () => {
    expect(alignWearableToOscar([], []).aligned).toHaveLength(0);
    const r = alignWearableToOscar([oscarRow('2024-01-15')], []);
    expect(r.aligned).toHaveLength(0);
    expect(r.unmatchedOscar).toHaveLength(1);
  });

  it('unparseable OSCAR Date → unmatchedOscar with reason, no throw', () => {
    const r = alignWearableToOscar(
      [{ Date: 'nope', AHI: '1' }],
      [wnight('2024-01-15')],
    );
    expect(r.unmatchedOscar[0].reason).toBe('unparseable-date');
    expect(r.unmatchedWearable).toHaveLength(1);
  });
});

describe('hasLargeDurationMismatch', () => {
  it('flags > 2h mismatch as a quality flag (not exclusion)', () => {
    const res = alignWearableToOscar(
      [oscarRow('2024-01-15', 3, 3)], // 3h usage
      [wnight('2024-01-15', 420)], // 7h asleep → 4h mismatch
    );
    expect(hasLargeDurationMismatch(res.aligned[0])).toBe(true);
  });
});
