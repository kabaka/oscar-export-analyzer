import { describe, it, expect } from 'vitest';
import {
  validateSummaryHeaders,
  validateDetailsHeaders,
} from './csvValidation.js';

describe('validateSummaryHeaders', () => {
  it('passes with all required columns', () => {
    const headers = ['Date', 'AHI', 'Median EPAP', 'Total Time'];
    const result = validateSummaryHeaders(headers);

    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('passes with extra columns beyond required', () => {
    const headers = [
      'Date',
      'AHI',
      'Median EPAP',
      'Total Time',
      'Leak Rate',
      'Pressure',
    ];
    const result = validateSummaryHeaders(headers);

    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('fails when Date is missing', () => {
    const headers = ['AHI', 'Median EPAP', 'Total Time'];
    const result = validateSummaryHeaders(headers);

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Missing required columns: Date');
    expect(result.found).toEqual(headers);
  });

  it('fails when AHI is missing', () => {
    const headers = ['Date', 'Median EPAP', 'Total Time'];
    const result = validateSummaryHeaders(headers);

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Missing required columns: AHI');
    expect(result.found).toEqual(headers);
  });

  it('fails when Median EPAP is missing', () => {
    const headers = ['Date', 'AHI', 'Total Time'];
    const result = validateSummaryHeaders(headers);

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Missing required columns: Median EPAP');
    expect(result.found).toEqual(headers);
  });

  it('fails when Total Time is missing', () => {
    const headers = ['Date', 'AHI', 'Median EPAP'];
    const result = validateSummaryHeaders(headers);

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Missing required columns: Total Time');
    expect(result.found).toEqual(headers);
  });

  it('fails when multiple columns are missing', () => {
    const headers = ['Date', 'Leak Rate'];
    const result = validateSummaryHeaders(headers);

    expect(result.valid).toBe(false);
    expect(result.error).toBe(
      'Missing required columns: AHI, Median EPAP, Total Time',
    );
    expect(result.found).toEqual(headers);
  });

  it('uses strict case-sensitive matching', () => {
    const headers = ['date', 'ahi', 'median epap', 'total time'];
    const result = validateSummaryHeaders(headers);

    expect(result.valid).toBe(false);
    // All columns should fail due to case mismatch
    expect(result.error).toContain('Date');
    expect(result.error).toContain('AHI');
    expect(result.error).toContain('Median EPAP');
    expect(result.error).toContain('Total Time');
  });
});

describe('validateDetailsHeaders', () => {
  it('passes with all required columns', () => {
    const headers = ['Event', 'DateTime', 'Data/Duration'];
    const result = validateDetailsHeaders(headers);

    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('passes with extra columns beyond required', () => {
    const headers = ['Event', 'DateTime', 'Data/Duration', 'Session', 'Notes'];
    const result = validateDetailsHeaders(headers);

    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('fails when Event is missing', () => {
    const headers = ['DateTime', 'Data/Duration'];
    const result = validateDetailsHeaders(headers);

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Missing required columns: Event');
    expect(result.found).toEqual(headers);
  });

  it('fails when DateTime is missing', () => {
    const headers = ['Event', 'Data/Duration'];
    const result = validateDetailsHeaders(headers);

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Missing required columns: DateTime');
    expect(result.found).toEqual(headers);
  });

  it('fails when Data/Duration is missing', () => {
    const headers = ['Event', 'DateTime'];
    const result = validateDetailsHeaders(headers);

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Missing required columns: Data/Duration');
    expect(result.found).toEqual(headers);
  });

  it('fails when multiple columns are missing', () => {
    const headers = ['Session'];
    const result = validateDetailsHeaders(headers);

    expect(result.valid).toBe(false);
    expect(result.error).toBe(
      'Missing required columns: Event, DateTime, Data/Duration',
    );
    expect(result.found).toEqual(headers);
  });

  it('uses strict case-sensitive matching', () => {
    const headers = ['event', 'datetime', 'data/duration'];
    const result = validateDetailsHeaders(headers);

    expect(result.valid).toBe(false);
    // All columns should fail due to case mismatch
    expect(result.error).toContain('Event');
    expect(result.error).toContain('DateTime');
    expect(result.error).toContain('Data/Duration');
  });
});
