/**
 * Tests for per-night UTC-offset inference (§3.2). All data is synthetic — no
 * real export values (oscar-privacy-boundaries). Pacific offsets: PST = −480 min,
 * PDT = −420 min.
 */
import { describe, it, expect } from 'vitest';
import {
  naiveLocalToMinutes,
  utcToMinutes,
  inferUtcOffset,
  resolveOffset,
  deriveUtcBounds,
} from './offsetInference.js';
import { WINDOW_SOURCE } from '../../constants/wearableConstants.js';

const HOUR = 60;

/**
 * Build a synthetic night's UTC sample minutes that physically fall inside a
 * Pacific-local sleep window. We pick a local window of 23:00→07:00 on a date
 * and place `count` evenly-spaced samples inside it, then convert to UTC by
 * subtracting the true offset.
 */
function syntheticUtcSamples({ dateUtcMidnightMin, trueOffsetMin, count }) {
  // Local window 23:00 (prev day) .. 07:00. Express in wall-clock minutes.
  const startLocal = dateUtcMidnightMin - 1 * HOUR; // 23:00 previous day
  const endLocal = dateUtcMidnightMin + 7 * HOUR; // 07:00
  const span = endLocal - startLocal;
  const samples = [];
  for (let i = 0; i < count; i++) {
    const local = startLocal + ((i + 0.5) / count) * span;
    samples.push(local - trueOffsetMin); // UTC minute = local − offset
  }
  return { startLocal, endLocal, samples };
}

describe('naiveLocalToMinutes / utcToMinutes', () => {
  it('parses naive-local literally (no TZ math)', () => {
    const a = naiveLocalToMinutes('2024-01-15T23:00:00');
    const b = naiveLocalToMinutes('2024-01-16T07:00:00');
    expect(b - a).toBe(8 * HOUR);
  });

  it('strips a trailing offset/Z and reads wall-clock fields', () => {
    expect(naiveLocalToMinutes('2024-01-15T23:00:00-08:00')).toBe(
      naiveLocalToMinutes('2024-01-15T23:00:00'),
    );
  });

  it('returns NaN for garbage', () => {
    expect(naiveLocalToMinutes('not-a-date')).toBeNaN();
    expect(utcToMinutes('not-a-date')).toBeNaN();
  });
});

describe('inferUtcOffset', () => {
  it('recovers a Pacific PST offset from the night own samples', () => {
    const dateMid = naiveLocalToMinutes('2024-01-16T00:00:00');
    const { startLocal, endLocal, samples } = syntheticUtcSamples({
      dateUtcMidnightMin: dateMid,
      trueOffsetMin: -480,
      count: 60,
    });
    const res = inferUtcOffset({
      startLocalMin: startLocal,
      endLocalMin: endLocal,
      utcSampleMinutes: samples,
    });
    expect(res.offset).toBe(-480);
    expect(res.confident).toBe(true);
    expect(res.frac).toBeGreaterThan(0.9);
  });

  it('marks insufficient when too few samples to infer', () => {
    const dateMid = naiveLocalToMinutes('2024-01-16T00:00:00');
    const { startLocal, endLocal, samples } = syntheticUtcSamples({
      dateUtcMidnightMin: dateMid,
      trueOffsetMin: -480,
      count: 10, // < MIN_INFER_SAMPLES (30)
    });
    const res = inferUtcOffset({
      startLocalMin: startLocal,
      endLocalMin: endLocal,
      utcSampleMinutes: samples,
    });
    expect(res.offset).toBeNull();
    expect(res.confident).toBe(false);
  });

  it('infers a different offset across a DST transition (no bleed)', () => {
    const dateMid = naiveLocalToMinutes('2024-03-12T00:00:00');
    // Post-DST night is now PDT (−420).
    const pdt = syntheticUtcSamples({
      dateUtcMidnightMin: dateMid,
      trueOffsetMin: -420,
      count: 60,
    });
    const res = inferUtcOffset({
      startLocalMin: pdt.startLocal,
      endLocalMin: pdt.endLocal,
      utcSampleMinutes: pdt.samples,
      prevInferredOffset: -480, // previous night was PST
    });
    expect(res.offset).toBe(-420);
  });
});

describe('resolveOffset fallback chain', () => {
  const dateMid = naiveLocalToMinutes('2024-01-16T00:00:00');
  const pacific = syntheticUtcSamples({
    dateUtcMidnightMin: dateMid,
    trueOffsetMin: -480,
    count: 60,
  });

  it('PRIMARY: a +00:00-reporting Pacific night resolves to inferred, not hint', () => {
    const res = resolveOffset({
      startLocalMin: pacific.startLocal,
      endLocalMin: pacific.endLocal,
      utcSampleMinutes: pacific.samples,
      userSleepsHintMin: 0, // placeholder +00:00 → treated as missing
    });
    expect(res.windowSource).toBe(WINDOW_SOURCE.INFERRED);
    expect(res.utcOffsetMinutes).toBe(-480);
  });

  it('keeps inferred and flags disagreement when hint disagrees ≥15 min', () => {
    const res = resolveOffset({
      startLocalMin: pacific.startLocal,
      endLocalMin: pacific.endLocal,
      utcSampleMinutes: pacific.samples,
      userSleepsHintMin: -300, // disagrees by 180 min
    });
    expect(res.windowSource).toBe(WINDOW_SOURCE.INFERRED);
    expect(res.utcOffsetMinutes).toBe(-480);
    expect(res.offsetDisagreementMin).toBe(180);
    expect(res.flags).toContain('offset-disagreement');
  });

  it('FALLBACK: sparse night with a non-placeholder hint uses userSleeps-hint', () => {
    const sparse = syntheticUtcSamples({
      dateUtcMidnightMin: dateMid,
      trueOffsetMin: -480,
      count: 5,
    });
    const res = resolveOffset({
      startLocalMin: sparse.startLocal,
      endLocalMin: sparse.endLocal,
      utcSampleMinutes: sparse.samples,
      userSleepsHintMin: -420,
    });
    expect(res.windowSource).toBe(WINDOW_SOURCE.USERSLEEPS_HINT);
    expect(res.utcOffsetMinutes).toBe(-420);
    expect(res.flags).toContain('offset-from-hint');
  });

  it('FALLBACK: carry-forward within MAX_CARRY_NIGHTS uses prev inferred offset', () => {
    const sparse = syntheticUtcSamples({
      dateUtcMidnightMin: dateMid,
      trueOffsetMin: -480,
      count: 5,
    });
    const res = resolveOffset({
      startLocalMin: sparse.startLocal,
      endLocalMin: sparse.endLocal,
      utcSampleMinutes: sparse.samples,
      userSleepsHintMin: 0, // placeholder
      prevInferredOffset: -480,
      nightsSincePrevInferred: 1,
    });
    expect(res.windowSource).toBe(WINDOW_SOURCE.CARRY_FORWARD);
    expect(res.flags).toContain('offset-carry-forward');
  });

  it('carry-forward does NOT bleed past MAX_CARRY_NIGHTS → default fallback', () => {
    const sparse = syntheticUtcSamples({
      dateUtcMidnightMin: dateMid,
      trueOffsetMin: -480,
      count: 5,
    });
    const res = resolveOffset({
      startLocalMin: sparse.startLocal,
      endLocalMin: sparse.endLocal,
      utcSampleMinutes: sparse.samples,
      userSleepsHintMin: 0,
      prevInferredOffset: -480,
      nightsSincePrevInferred: 3, // > MAX_CARRY_NIGHTS (2)
    });
    expect(res.windowSource).toBe(WINDOW_SOURCE.DEFAULT_FALLBACK);
    expect(res.flags).toContain('offset-default-fallback');
  });
});

describe('deriveUtcBounds', () => {
  it('subtracts the offset to convert local bounds to UTC', () => {
    const start = naiveLocalToMinutes('2024-01-15T23:00:00');
    const end = naiveLocalToMinutes('2024-01-16T07:00:00');
    const { startUtc, endUtc } = deriveUtcBounds(start, end, -480);
    // 23:00 PST = 07:00Z next day.
    expect(startUtc).toBe('2024-01-16T07:00:00.000Z');
    expect(endUtc).toBe('2024-01-16T15:00:00.000Z');
  });
});
