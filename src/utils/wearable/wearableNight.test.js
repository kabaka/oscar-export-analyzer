/**
 * Tests for the WearableNight / AlignedNight contract factories (§2/§4.9).
 */
import { describe, it, expect } from 'vitest';
import {
  createWearableNight,
  createWindow,
  createCoverageBlock,
  parseOscarSummaryRow,
  createAlignedNight,
  COVERAGE_GROUPS,
} from './wearableNight.js';

describe('createWearableNight', () => {
  it('defaults all physiological groups to null (absent)', () => {
    const w = createWearableNight({ nightKey: '2024-01-15' });
    expect(w.nightKey).toBe('2024-01-15');
    expect(w.spo2).toBeNull();
    expect(w.hr).toBeNull();
    expect(w.coverage.insufficient).toEqual([]);
    expect(w.isMainSleep).toBe(true);
  });

  it('carries a window block and provenance', () => {
    const w = createWearableNight({
      nightKey: '2024-01-15',
      window: createWindow({ utcOffsetMinutes: -480 }),
      windowSource: 'inferred',
    });
    expect(w.window.utcOffsetMinutes).toBe(-480);
    expect(w.windowSource).toBe('inferred');
  });

  it('exposes the coverage-group keys used by the insufficient contract', () => {
    expect(COVERAGE_GROUPS).toContain('spo2');
    expect(COVERAGE_GROUPS).toContain('hrv');
  });
});

describe('parseOscarSummaryRow', () => {
  it('parses numerics and converts Total Time to usage hours; NaN when absent', () => {
    const o = parseOscarSummaryRow({
      Date: '2024-01-15',
      AHI: '4.2',
      'Median EPAP': '8.5',
      'Total Time': '7.25',
      'Leak Rate Median': '12',
    });
    expect(o.ahi).toBeCloseTo(4.2, 5);
    expect(o.medianEpap).toBeCloseTo(8.5, 5);
    expect(o.usageHours).toBeCloseTo(7.25, 5);
    expect(o.ipap).toBeNaN(); // absent column
  });
});

describe('createAlignedNight', () => {
  it('computes durationMismatchHours from usage vs asleepMin', () => {
    const wearable = createWearableNight({
      nightKey: '2024-01-15',
      sleep: { asleepMin: 360 }, // 6h
      coverage: createCoverageBlock(),
    });
    const a = createAlignedNight({
      nightKey: '2024-01-15',
      matchType: 'exact',
      overlapHours: 6,
      oscar: { usageHours: 8 },
      wearable,
    });
    expect(a.quality.durationMismatchHours).toBeCloseTo(2, 5);
    expect(a.quality.windowSource).toBe(wearable.windowSource);
  });
});
