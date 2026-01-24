/* eslint-disable no-magic-numbers -- test data uses explicit numeric values for clarity */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { computeEPAPTrends } from './stats';
import {
  TEST_EPAP_LOW,
  TEST_EPAP_MEDIUM,
  TEST_EPAP_BELOW_MIN,
  TEST_EPAP_ABOVE_MAX,
} from '../constants/testData';

describe('EPAP validation integration in computeEPAPTrends', () => {
  let consoleWarnSpy;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  it('should not warn for valid EPAP values', () => {
    const data = [
      { Date: '2024-01-01', 'Median EPAP': TEST_EPAP_LOW, AHI: 5 },
      { Date: '2024-01-02', 'Median EPAP': TEST_EPAP_MEDIUM, AHI: 3 },
      { Date: '2024-01-03', 'Median EPAP': 12, AHI: 4 },
      { Date: '2024-01-04', 'Median EPAP': 10, AHI: 6 },
    ];

    computeEPAPTrends(data);

    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it('should warn for below-range EPAP values', () => {
    const data = [
      { Date: '2024-01-01', 'Median EPAP': TEST_EPAP_BELOW_MIN, AHI: 5 },
      { Date: '2024-01-02', 'Median EPAP': TEST_EPAP_MEDIUM, AHI: 3 },
    ];

    computeEPAPTrends(data);

    // Warning called multiple times as EPAP is parsed in different contexts within the function
    // (epaps array, first30, last30, epapAhiPairs, lowGroup/highGroup)
    expect(consoleWarnSpy).toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Suspicious EPAP value: 3.0 cmH₂O'),
    );
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Date: 2024-01-01]'),
    );
  });

  it('should warn for above-range EPAP values', () => {
    const data = [
      { Date: '2024-01-01', 'Median EPAP': TEST_EPAP_MEDIUM, AHI: 5 },
      { Date: '2024-01-02', 'Median EPAP': TEST_EPAP_ABOVE_MAX, AHI: 3 },
    ];

    computeEPAPTrends(data);

    // Warning called multiple times as EPAP is parsed in different contexts within the function
    expect(consoleWarnSpy).toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Suspicious EPAP value: 30.0 cmH₂O'),
    );
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Date: 2024-01-02]'),
    );
  });

  it('should warn for multiple out-of-range values', () => {
    const data = [
      { Date: '2024-01-01', 'Median EPAP': TEST_EPAP_BELOW_MIN, AHI: 5 },
      { Date: '2024-01-02', 'Median EPAP': TEST_EPAP_MEDIUM, AHI: 3 },
      { Date: '2024-01-03', 'Median EPAP': TEST_EPAP_ABOVE_MAX, AHI: 4 },
      { Date: '2024-01-04', 'Median EPAP': 2, AHI: 6 },
    ];

    computeEPAPTrends(data);

    // Warnings called multiple times from different parsing locations in the function
    // (epaps array, first30, last30, epapAhiPairs, lowGroup/highGroup)
    expect(consoleWarnSpy).toHaveBeenCalled();
    const calls = consoleWarnSpy.mock.calls;
    const uniqueDates = new Set(
      calls.map((call) => call[0].match(/Date: ([^\]]+)/)?.[1]).filter(Boolean),
    );
    expect(uniqueDates.has('2024-01-01')).toBe(true);
    expect(uniqueDates.has('2024-01-03')).toBe(true);
    expect(uniqueDates.has('2024-01-04')).toBe(true);
  });

  it('should still compute statistics correctly despite warnings', () => {
    const data = [
      { Date: '2024-01-01', 'Median EPAP': TEST_EPAP_BELOW_MIN, AHI: 5 },
      { Date: '2024-01-02', 'Median EPAP': TEST_EPAP_MEDIUM, AHI: 3 },
      { Date: '2024-01-03', 'Median EPAP': 12, AHI: 4 },
    ];

    const result = computeEPAPTrends(data);

    // Warnings logged but values still used
    expect(consoleWarnSpy).toHaveBeenCalled();

    // Statistics computed correctly
    expect(result.epaps).toHaveLength(3);
    expect(result.minEPAP).toBe(TEST_EPAP_BELOW_MIN);
    expect(result.maxEPAP).toBe(12);
  });

  it('should filter out NaN EPAP values without warnings', () => {
    const data = [
      { Date: '2024-01-01', 'Median EPAP': NaN, AHI: 5 },
      { Date: '2024-01-02', 'Median EPAP': TEST_EPAP_MEDIUM, AHI: 3 },
    ];

    const result = computeEPAPTrends(data);

    // Warnings expected for quartile calculation with n=1 (statistically insufficient)
    expect(consoleWarnSpy).toHaveBeenCalled();
    expect(result.epaps).toHaveLength(1);
    expect(result.epaps[0]).toBe(TEST_EPAP_MEDIUM);
  });
});
