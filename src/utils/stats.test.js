import { describe, it, expect } from 'vitest';
import { parseDuration, quantile, computeApneaEventStats, summarizeUsage, computeAHITrends, computeEPAPTrends } from './stats';
import { computeUsageRolling } from './stats';

describe('parseDuration', () => {
  it('parses HH:MM:SS format', () => {
    expect(parseDuration('1:02:03')).toBe(3723);
  });

  it('handles MM:SS format', () => {
    expect(parseDuration('2:03')).toBe(123);
  });
});

describe('quantile', () => {
  it('computes median for odd-length array', () => {
    expect(quantile([1, 3, 2], 0.5)).toBe(2);
  });

  it('interpolates for even-length array', () => {
    expect(quantile([0, 10], 0.5)).toBe(5);
  });
});

describe('computeApneaEventStats', () => {
  it('computes duration and night statistics', () => {
    const details = [
      { Event: 'ClearAirway', 'Data/Duration': '30', DateTime: '2021-01-01T00:00:00Z' },
      { Event: 'Obstructive', 'Data/Duration': '60', DateTime: '2021-01-01T00:02:00Z' },
      { Event: 'FLG', 'Data/Duration': '1.0', DateTime: '2021-01-01T00:01:00Z' }
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
    const data = [
      { 'Total Time': '1:00:00' },
      { 'Total Time': '3:00:00' }
    ];
    const usage = summarizeUsage(data);
    expect(usage.totalNights).toBe(2);
    expect(usage.avgHours).toBe(2);
    expect(usage.nightsLong).toBe(0);
    expect(usage.nightsShort).toBe(2);
    expect(usage.medianHours).toBe(2);
    expect(usage.iqrHours).toBe(1);
  });
});

describe('computeAHITrends', () => {
  it('calculates AHI statistics and trends', () => {
    const data = [
      { Date: '2021-01-01', AHI: '1' },
      { Date: '2021-01-02', AHI: '5' },
      { Date: '2021-01-03', AHI: '10' }
    ];
    const ahi = computeAHITrends(data);
    expect(ahi.avgAHI).toBeCloseTo((1 + 5 + 10) / 3);
    expect(ahi.medianAHI).toBe(5);
    expect(ahi.nightsAHIover5).toBe(1);
    expect(ahi.first30AvgAHI).toBeCloseTo(ahi.avgAHI);
    expect(ahi.last30AvgAHI).toBeCloseTo(ahi.avgAHI);
  });
});

describe('computeEPAPTrends', () => {
  it('computes EPAP percentiles, correlation with AHI, and group means', () => {
    const data = [
      { Date: '2021-01-01', 'Median EPAP': '5', AHI: '1' },
      { Date: '2021-01-02', 'Median EPAP': '9', AHI: '3' }
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
