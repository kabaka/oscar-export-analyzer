import { describe, it, expect } from 'vitest';
import {
  parseDuration,
  quantile,
  computeApneaEventStats,
  summarizeUsage,
  computeAHITrends,
  computeEPAPTrends,
} from './stats';
import { computeUsageRolling } from './stats';
import { mannWhitneyUTest } from './stats';
import { detectChangePoints } from './stats';
import {
  loessSmooth,
  runningQuantileXY,
  partialCorrelation,
  pearson,
} from './stats';
import { kmSurvival } from './stats';
import { normalQuantile, normalCdf } from './stats';

describe('parseDuration', () => {
  it('parses HH:MM:SS format', () => {
    expect(parseDuration('1:02:03')).toBe(3723);
  });

  it('handles MM:SS format', () => {
    expect(parseDuration('2:03')).toBe(123);
  });

  it('returns NaN for malformed strings', () => {
    expect(parseDuration('abc')).toBeNaN();
    expect(parseDuration('1:2:3:4')).toBeNaN();
  });

  it('throws on malformed input when requested', () => {
    expect(() => parseDuration('bad', { throwOnError: true })).toThrow(
      /invalid duration/i,
    );
  });
});

describe('kmSurvival (Kaplan–Meier) uncensored', () => {
  it('computes stepwise survival for simple data', () => {
    const durs = [1, 1, 2, 3];
    const { times, survival, lower, upper } = kmSurvival(durs);
    expect(times).toEqual([1, 2, 3]);
    expect(survival[0]).toBeCloseTo(0.5);
    expect(survival[1]).toBeCloseTo(0.25);
    expect(survival[2]).toBeCloseTo(0);
    // monotone non-increasing
    for (let i = 1; i < survival.length; i++)
      expect(survival[i]).toBeLessThanOrEqual(survival[i - 1]);
    expect(lower.length).toBe(times.length);
    expect(upper.length).toBe(times.length);
  });

  it('produces log-log Greenwood CIs matching reference values', () => {
    const durs = [1, 1, 2, 3];
    const { lower, upper } = kmSurvival(durs);
    expect(lower[0]).toBeCloseTo(0.0578428, 5);
    expect(upper[0]).toBeCloseTo(0.844865, 5);
    expect(lower[1]).toBeCloseTo(0.00894687, 5);
    expect(upper[1]).toBeCloseTo(0.665331, 5);
    expect(lower[2]).toBeNaN();
    expect(upper[2]).toBeNaN();
  });
});

describe('partialCorrelation (controls reduce confounding)', () => {
  it('shrinks correlation when controlling for confounder', () => {
    const n = 120;
    const z = Array.from({ length: n }, (_, i) => i / n);
    const x = z.map((v) => v + 0.1 * Math.sin(10 * v));
    const y = z.map((v) => 0.8 * v + 0.1 * Math.cos(8 * v));
    const r = (a, b) => pearson(a, b);
    const naive = r(x, y);
    // controls matrix: one column z
    const controls = z.map((v) => [v]);
    const pc = partialCorrelation(x, y, controls);
    expect(Math.abs(pc)).toBeLessThan(Math.abs(naive));
  });
});

describe('pearson', () => {
  it('ignores NaN pairs without skewing results', () => {
    const x = [1, 2, 3, NaN];
    const y = [1, 2, 3, 4];
    const fx = [1, 2, 3];
    const fy = [1, 2, 3];
    expect(pearson(x, y)).toBeCloseTo(pearson(fx, fy));
  });

  it('ignores NaNs in either array', () => {
    const x = [1, 2, 3, 4];
    const y = [1, 2, NaN, 4];
    const fx = [1, 2, 4];
    const fy = [1, 2, 4];
    expect(pearson(x, y)).toBeCloseTo(pearson(fx, fy));
  });
});

describe('loessSmooth and runningQuantileXY', () => {
  it('loess reproduces linear relationship approximately', () => {
    const x = Array.from({ length: 20 }, (_, i) => i);
    const y = x.map((v) => 2 * v + 1);
    const xs = [0, 5, 10, 15, 19];
    const sm = loessSmooth(x, y, xs, 0.4);
    expect(sm).toHaveLength(xs.length);
    // Expect close to true line
    sm.forEach((yv, i) => {
      const xv = xs[i];
      expect(Math.abs(yv - (2 * xv + 1))).toBeLessThan(1e-6);
    });
  });

  it('runningQuantileXY returns plausible quantiles', () => {
    const x = Array.from({ length: 30 }, (_, i) => i);
    const y = x.map((v) => v); // identity
    const xs = [0, 10, 20, 29];
    const q50 = runningQuantileXY(x, y, xs, 0.5, 11);
    expect(q50).toHaveLength(xs.length);
    // p50 should be non-decreasing and within overall range
    for (let i = 1; i < q50.length; i++) {
      expect(q50[i]).toBeGreaterThanOrEqual(q50[i - 1]);
    }
    q50.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(29);
    });
    const q90 = runningQuantileXY(x, y, xs, 0.9, 11);
    q90.forEach((v, i) => {
      expect(v).toBeGreaterThanOrEqual(q50[i]);
    });
  });
});

describe('detectChangePoints', () => {
  it('detects a single change around a step', () => {
    const n1 = 30,
      n2 = 30;
    const series = Array(n1).fill(1).concat(Array(n2).fill(5));
    const dates = series.map((_, i) => new Date(2021, 0, i + 1));
    const cps = detectChangePoints(series, dates, 8);
    // expect one change near index 30
    expect(cps.length).toBeGreaterThanOrEqual(1);
    const idx = cps.findIndex((d) => d instanceof Date);
    expect(idx).toBeGreaterThanOrEqual(0);
  });
});

describe('mannWhitneyUTest (exact small-n and ties)', () => {
  it('computes exact p for small samples', () => {
    const a = [1, 2];
    const b = [3, 4];
    const res = mannWhitneyUTest(a, b);
    expect(res.method).toBe('exact');
    // Exact two-sided p = 2/6 = 0.333...
    expect(res.p).toBeLessThan(0.34);
    expect(res.effect).toBeGreaterThan(0.9);
    expect(res.effect_ci_low).toBeLessThanOrEqual(res.effect_ci_high);
  });

  it('handles ties and returns finite results', () => {
    const a = [1, 2];
    const b = [2, 3];
    const res = mannWhitneyUTest(a, b);
    expect(res.method).toBe('exact');
    expect(isFinite(res.U)).toBe(true);
    expect(isFinite(res.p)).toBe(true);
    expect(isFinite(res.effect)).toBe(true);
  });
});

describe('quantile', () => {
  it('computes median for odd-length array', () => {
    expect(quantile([1, 3, 2], 0.5)).toBe(2);
  });

  it('interpolates for even-length array', () => {
    expect(quantile([0, 10], 0.5)).toBe(5);
  });

  it('returns NaN for empty array', () => {
    expect(quantile([], 0.5)).toBeNaN();
  });
});

describe('normalQuantile', () => {
  it('inverts normalCdf at common probabilities', () => {
    const probs = [0.025, 0.5, 0.975];
    probs.forEach((p) => {
      const z = normalQuantile(p);
      expect(normalCdf(z)).toBeCloseTo(p, 4);
    });
  });

  it('matches known z-scores', () => {
    expect(normalQuantile(0.841344746)).toBeCloseTo(1, 4);
    expect(normalQuantile(0.158655254)).toBeCloseTo(-1, 4);
  });
});

describe('computeApneaEventStats', () => {
  it('computes duration and night statistics', () => {
    const details = [
      {
        Event: 'ClearAirway',
        'Data/Duration': '30',
        DateTime: '2021-01-01T00:00:00Z',
      },
      {
        Event: 'Obstructive',
        'Data/Duration': '60',
        DateTime: '2021-01-01T00:02:00Z',
      },
      {
        Event: 'FLG',
        'Data/Duration': '1.0',
        DateTime: '2021-01-01T00:01:00Z',
      },
    ];
    const stats = computeApneaEventStats(details);
    expect(stats.totalEvents).toBe(2);
    expect(stats.durations).toEqual([30, 60]);
    expect(stats.medianDur).toBe(45);
    expect(stats.iqrDur).toBeCloseTo(15);
    expect(stats.nightDates).toEqual(['2021-01-01']);
    expect(stats.eventsPerNight).toEqual([2]);
  });
});

describe('summarizeUsage', () => {
  it('summarizes usage hours and outliers', () => {
    const data = [{ 'Total Time': '1:00:00' }, { 'Total Time': '3:00:00' }];
    const usage = summarizeUsage(data);
    expect(usage.totalNights).toBe(2);
    expect(usage.avgHours).toBe(2);
    expect(usage.nightsLong).toBe(0);
    expect(usage.nightsShort).toBe(2);
    expect(usage.medianHours).toBe(2);
    expect(usage.iqrHours).toBe(1);
  });

  it('handles empty input', () => {
    const usage = summarizeUsage([]);
    expect(usage.totalNights).toBe(0);
    expect(Number.isNaN(usage.avgHours)).toBe(true);
    expect(Number.isNaN(usage.minHours)).toBe(true);
    expect(Number.isNaN(usage.maxHours)).toBe(true);
  });
});

describe('computeAHITrends', () => {
  it('calculates AHI statistics and trends', () => {
    const data = [
      { Date: '2021-01-01', AHI: '1' },
      { Date: '2021-01-02', AHI: '5' },
      { Date: '2021-01-03', AHI: '10' },
    ];
    const ahi = computeAHITrends(data);
    expect(ahi.avgAHI).toBeCloseTo((1 + 5 + 10) / 3);
    expect(ahi.medianAHI).toBe(5);
    expect(ahi.nightsAHIover5).toBe(1);
    expect(ahi.first30AvgAHI).toBeCloseTo(ahi.avgAHI);
    expect(ahi.last30AvgAHI).toBeCloseTo(ahi.avgAHI);
  });

  it('handles empty input', () => {
    const ahi = computeAHITrends([]);
    expect(Number.isNaN(ahi.avgAHI)).toBe(true);
    expect(Number.isNaN(ahi.minAHI)).toBe(true);
    expect(ahi.nightsAHIover5).toBe(0);
  });
});

describe('computeEPAPTrends', () => {
  it('computes EPAP percentiles, correlation with AHI, and group means', () => {
    const data = [
      { Date: '2021-01-01', 'Median EPAP': '5', AHI: '1' },
      { Date: '2021-01-02', 'Median EPAP': '9', AHI: '3' },
    ];
    const epap = computeEPAPTrends(data);
    expect(epap.medianEPAP).toBe(7);
    expect(epap.iqrEPAP).toBe(2);
    // correlation of points (5,1) and (9,3) is 1
    expect(epap.corrEPAPAHI).toBeCloseTo(1);
    expect(epap.countLow).toBe(1);
    expect(epap.countHigh).toBe(1);
    expect(epap.avgAHILow).toBe(1);
    expect(epap.avgAHIHigh).toBe(3);
  });

  it('handles empty input', () => {
    const epap = computeEPAPTrends([]);
    expect(Number.isNaN(epap.minEPAP)).toBe(true);
    expect(Number.isNaN(epap.maxEPAP)).toBe(true);
    expect(Number.isNaN(epap.corrEPAPAHI)).toBe(true);
    expect(epap.countLow).toBe(0);
    expect(Number.isNaN(epap.avgAHILow)).toBe(true);
    expect(Number.isNaN(epap.avgAHIHigh)).toBe(true);
  });
});

describe('computeUsageRolling (date-aware)', () => {
  it('uses calendar-day windows rather than fixed counts and returns CIs', () => {
    const dates = [
      new Date('2021-01-01'),
      new Date('2021-01-02'),
      new Date('2021-01-05'), // gap of 2 days
    ];
    const hours = [2, 4, 6];
    const r = computeUsageRolling(dates, hours, [3]); // 3-day window
    // At index 1 (2021-01-02), window covers 2020-12-31..2021-01-02 => indices 0..1
    expect(r.avg3[1]).toBeCloseTo((2 + 4) / 2);
    // At index 2 (2021-01-05), window covers 2021-01-03..2021-01-05 => only index 2
    expect(r.avg3[2]).toBeCloseTo(6);
    // CIs are present and same length
    expect(r.avg3_ci_low).toHaveLength(3);
    expect(r.avg3_ci_high).toHaveLength(3);
    expect(Number.isFinite(r.avg3_ci_low[2])).toBe(true);
    expect(Number.isFinite(r.avg3_ci_high[2])).toBe(true);
    // Median arrays present
    expect(r.median3).toHaveLength(3);
    expect(Number.isFinite(r.median3[2])).toBe(true);
  });
});
