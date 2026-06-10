/**
 * Tests for the per-metric nightly aggregators (§2). All synthetic data; no PHI.
 */
import { describe, it, expect } from 'vitest';
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

/** Build `n` SpO2 rows at a constant value. */
function spo2Rows(value, n) {
  return Array.from({ length: n }, () => ({ value }));
}

describe('aggregateSpO2 — sentinel-only filter (finding #3)', () => {
  it('drops 50.0 sentinels from min/percentiles and logs sentinelMinutesRemoved', () => {
    // 200 good minutes around 96, plus 30 sentinel minutes at exactly 50.0.
    const good = spo2Rows(96, 200);
    const sentinels = spo2Rows(50.0, 30);
    const res = aggregateSpO2([...good, ...sentinels]);
    expect(res.value).not.toBeNull();
    expect(res.sentinelMinutesRemoved).toBe(30);
    // min must NOT collapse to 50 — sentinels removed.
    expect(res.value.minPct).toBe(96);
    expect(res.value.pctTimeBelow90).toBe(0);
    expect(res.value.validMinutes).toBe(200);
  });

  it('RETAINS a real sub-70 non-sentinel nadir and flags it (never deletes)', () => {
    const good = spo2Rows(95, 199);
    const realNadir = [{ value: 66 }]; // genuine deep desaturation, not the sentinel
    const res = aggregateSpO2([...good, ...realNadir]);
    expect(res.value).not.toBeNull();
    expect(res.value.minPct).toBe(66); // retained, drives the headline signal
    expect(res.subSeventyNonSentinelMinutes).toBe(1);
    expect(res.flags).toContain('spo2-sub70-nonsentinel');
  });

  it('gates out a too-short night → null + insufficient', () => {
    const res = aggregateSpO2(spo2Rows(97, 30)); // < 120 min
    expect(res.value).toBeNull();
    expect(res.insufficientGroup).toBe('spo2');
  });

  it('returns absent (no insufficient) for empty input', () => {
    const res = aggregateSpO2([]);
    expect(res.value).toBeNull();
    expect(res.insufficientGroup).toBeUndefined();
  });

  it('all-sentinel night → insufficient (no valid minutes)', () => {
    const res = aggregateSpO2(spo2Rows(50.0, 200));
    expect(res.value).toBeNull();
    expect(res.insufficientGroup).toBe('spo2');
    expect(res.sentinelMinutesRemoved).toBe(200);
  });
});

describe('aggregateHeartRate', () => {
  it('computes min/avg/max over confident samples', () => {
    const samples = Array.from({ length: 400 }, (_, i) => ({
      value: 50 + (i % 20),
      confidence: 1,
    }));
    const res = aggregateHeartRate(samples, { restingBpm: 58 });
    expect(res.value.sleepingMinBpm).toBe(50);
    expect(res.value.sleepingMaxBpm).toBe(69);
    expect(res.value.restingBpm).toBe(58);
  });

  it('drops confidence==0 samples', () => {
    const good = Array.from({ length: 300 }, () => ({
      value: 60,
      confidence: 1,
    }));
    const bad = [{ value: 200, confidence: 0 }];
    const res = aggregateHeartRate([...good, ...bad]);
    expect(res.value.sleepingMaxBpm).toBe(60); // 200 excluded
  });

  it('gates out too-few samples', () => {
    const res = aggregateHeartRate(spo2Rows(60, 10));
    expect(res.value).toBeNull();
    expect(res.insufficientGroup).toBe('hr');
  });
});

describe('aggregateHRV', () => {
  it('returns value when coverage clears the gate', () => {
    const res = aggregateHRV({
      rmssdMs: 35,
      coveragePct: 0.8,
      windowCount: 80,
    });
    expect(res.value.rmssdMs).toBe(35);
  });
  it('insufficient when coverage below gate', () => {
    const res = aggregateHRV({ rmssdMs: 35, coveragePct: 0.2 });
    expect(res.value).toBeNull();
    expect(res.insufficientGroup).toBe('hrv');
  });
  it('absent when rmssd missing', () => {
    const res = aggregateHRV({ rmssdMs: null });
    expect(res.value).toBeNull();
    expect(res.insufficientGroup).toBeUndefined();
  });
});

describe('aggregateSnore', () => {
  it('counts snore-minutes as 0.5 per labeled epoch and gates short nights', () => {
    const epochs = Array.from({ length: 200 }, (_, i) => ({
      snore_label: i < 40 ? 1 : 0,
      mean_dba: 40 + (i % 5),
      max_dba: 55,
    }));
    const res = aggregateSnore(epochs, { asleepMin: 400 });
    expect(res.value.snoreMinutes).toBe(20); // 40 * 0.5
    expect(res.value.maxDba).toBe(55);
  });
  it('insufficient for too few epochs', () => {
    const res = aggregateSnore([{ snore_label: 1 }]);
    expect(res.value).toBeNull();
    expect(res.insufficientGroup).toBe('snore');
  });
});

describe('pass-through aggregators', () => {
  it('respiratory rate', () => {
    expect(
      aggregateRespiratoryRate({ nightlyBrpm: 14 }).value.nightlyBrpm,
    ).toBe(14);
    expect(aggregateRespiratoryRate({}).value).toBeNull();
  });
  it('readiness / stress', () => {
    expect(aggregateReadiness({ score: 80, state: 'HIGH' }).value.state).toBe(
      'HIGH',
    );
    expect(aggregateReadiness(null).value).toBeNull();
    expect(
      aggregateStress({ score: 30, refDate: '2024-01-15' }).value.refDate,
    ).toBe('2024-01-15');
  });
  it('activity treats explicit 0 steps as valid', () => {
    expect(aggregateActivity({ steps: 0 }).value.steps).toBe(0);
    expect(aggregateActivity(null).value).toBeNull();
  });
  it('temperature retains relative °C, null when absent', () => {
    expect(
      aggregateTemperature({ skinDeviationC: -0.4 }).value.skinDeviationC,
    ).toBe(-0.4);
    expect(aggregateTemperature(null).value).toBeNull();
  });
});
