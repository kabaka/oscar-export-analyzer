/**
 * Multi-format datetime parser tests (catalog §4 gotcha #1). Synthetic strings.
 */
import { describe, it, expect } from 'vitest';
import {
  parseMmDdYy,
  parseMmDdYyDate,
  parseIsoNaive,
  parseIsoUtc,
  parseEpochSeconds,
  parseUtcOffsetMinutes,
  dateKeyFromWallMs,
} from './datetime.js';

describe('parseMmDdYy (Global JSON intraday — naive local)', () => {
  it('parses MM/DD/YY HH:MM:SS as wall-clock ms', () => {
    const ms = parseMmDdYy('01/01/24 08:00:06');
    expect(new Date(ms).getUTCFullYear()).toBe(2024);
    expect(new Date(ms).getUTCHours()).toBe(8);
    expect(new Date(ms).getUTCSeconds()).toBe(6);
  });
  it('rejects malformed input with NaN (never throws)', () => {
    expect(parseMmDdYy('not-a-date')).toBeNaN();
    expect(parseMmDdYy(null)).toBeNaN();
    expect(parseMmDdYy(12345)).toBeNaN();
  });
  it('pivots a 2-digit year into the 21st century (no 1970 ambiguity)', () => {
    // MM/DD/YY can never produce a 1970 placeholder — the 2000-pivot lands it
    // in 2070, which is a valid (>= 2000) instant. 1970 rejection is exercised
    // via parseEpochSeconds / ISO parsers instead.
    expect(parseMmDdYy('01/01/70 00:00:00')).not.toBeNaN();
    expect(new Date(parseMmDdYy('01/01/70 00:00:00')).getUTCFullYear()).toBe(
      2070,
    );
  });
  it('rejects a 4-digit 1970 instant in ISO via the lower bound', () => {
    expect(parseIsoNaive('1970-01-01T00:00:00.000')).toBeNaN();
    expect(parseIsoUtc('1970-01-02T00:00:00Z')).toBeNaN();
  });
});

describe('parseMmDdYyDate (date-only, nested RHR)', () => {
  it('parses MM/DD/YY at midnight', () => {
    const ms = parseMmDdYyDate('02/22/24');
    expect(dateKeyFromWallMs(ms)).toBe('2024-02-22');
  });
});

describe('parseIsoNaive (sleep-json / HRV / snore — no Z)', () => {
  it('reads wall-clock fields literally, ignoring any trailing Z', () => {
    const a = parseIsoNaive('2024-02-22T07:41:30.000');
    const b = parseIsoNaive('2024-02-22T07:41:30.000Z');
    expect(a).toBe(b); // Z stripped — both treated as wall-clock
    expect(new Date(a).getUTCHours()).toBe(7);
  });
  it('handles fractional seconds and returns NaN on junk', () => {
    expect(parseIsoNaive('2024-02-22T07:41:30.123')).toBeGreaterThan(0);
    expect(parseIsoNaive('garbage')).toBeNaN();
  });
});

describe('parseIsoUtc (SpO2 / GoogleData — with Z/offset)', () => {
  it('parses a true UTC instant', () => {
    const ms = parseIsoUtc('2024-02-22T07:41:30Z');
    expect(ms).toBe(Date.parse('2024-02-22T07:41:30Z'));
  });
  it('parses an explicit offset', () => {
    const ms = parseIsoUtc('2024-02-22T07:41:30-08:00');
    expect(ms).toBe(Date.parse('2024-02-22T07:41:30-08:00'));
  });
  it('returns NaN for a naive (no-Z) string', () => {
    expect(parseIsoUtc('2024-02-22T07:41:30')).toBeNaN();
  });
});

describe('parseEpochSeconds (Mindfulness EDA)', () => {
  it('multiplies seconds to ms', () => {
    expect(parseEpochSeconds(1601501667)).toBe(1601501667 * 1000);
  });
  it('rejects the 1970 epoch-0 placeholder', () => {
    expect(parseEpochSeconds(0)).toBeNaN();
  });
});

describe('parseUtcOffsetMinutes (UserSleeps start_utc_offset)', () => {
  it('parses signed HH:MM into minutes east of UTC', () => {
    expect(parseUtcOffsetMinutes('-07:00')).toBe(-420);
    expect(parseUtcOffsetMinutes('+05:30')).toBe(330);
  });
  it('parses the +00:00 placeholder to 0', () => {
    expect(parseUtcOffsetMinutes('+00:00')).toBe(0);
  });
  it('returns NaN on garbage', () => {
    expect(parseUtcOffsetMinutes('PST')).toBeNaN();
  });
});
