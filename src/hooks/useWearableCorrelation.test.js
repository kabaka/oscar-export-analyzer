import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWearableCorrelation } from './useWearableCorrelation';
import {
  createWearableNight,
  createWindow,
} from '../utils/wearable/wearableNight.js';

/** A synthetic OSCAR summary row with a given AHI. */
function oscarRow(date, ahi) {
  return {
    Date: date,
    AHI: String(ahi),
    'Total Time': '07:30:00',
    'Median EPAP': '8',
    'Leak Rate Median': '5',
  };
}

/** A synthetic WearableNight rollup keyed on `nightKey === date`. */
function wnight(date, minPct) {
  return createWearableNight({
    nightKey: date,
    window: createWindow({
      startLocal: `${date}T23:00:00`,
      endLocal: `${date}T06:30:00`,
      utcOffsetMinutes: 0,
    }),
    sleep: { asleepMin: 420, efficiencyPct: 90 },
    spo2: { avgPct: 95, minPct, pctTimeBelow90: 1 },
    hr: { sleepingAvgBpm: 60 },
  });
}

/** Generate N date strings starting 2026-01-01. */
function dates(n) {
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const d = new Date(Date.UTC(2026, 0, 1 + i));
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

describe('useWearableCorrelation', () => {
  it('returns no result when either input is empty', () => {
    const { result } = renderHook(() =>
      useWearableCorrelation({ oscarRows: [], nights: [] }),
    );
    expect(result.current.hasResult).toBe(false);
    expect(result.current.correlation).toBeNull();
  });

  it('aligns nights and runs the correlation engine', () => {
    const ds = dates(10);
    const oscarRows = ds.map((d, i) => oscarRow(d, 5 + i));
    // minPct inversely tracks AHI so there is a real negative association.
    const nights = ds.map((d, i) => wnight(d, 96 - i));

    const { result } = renderHook(() =>
      useWearableCorrelation({ oscarRows, nights }),
    );

    expect(result.current.hasResult).toBe(true);
    expect(result.current.aligned.length).toBeGreaterThanOrEqual(7);
    expect(result.current.correlation).toBeTruthy();
    expect(Array.isArray(result.current.correlation.pairs)).toBe(true);
    expect(result.current.correlation.nAlignedNights).toBe(
      result.current.aligned.length,
    );
  });

  it('reports not-enough-nights below the analysis minimum', () => {
    const ds = dates(3);
    const oscarRows = ds.map((d, i) => oscarRow(d, 5 + i));
    const nights = ds.map((d, i) => wnight(d, 96 - i));

    const { result } = renderHook(() =>
      useWearableCorrelation({ oscarRows, nights }),
    );
    expect(result.current.correlation.warnings).toContain(
      'not-enough-overlapping-nights',
    );
  });
});
