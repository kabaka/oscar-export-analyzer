/**
 * Tests for the kept wearable constants (physiological ranges, temporal
 * alignment, statistical thresholds, chart layout, engine knobs). The OAuth/API
 * era constants were removed with the OAuth integration.
 */

import { describe, it, expect } from 'vitest';
import {
  HR_RESTING_MIN,
  HR_RESTING_MAX,
  SPO2_NORMAL_MIN,
  SPO2_MILD_HYPOXEMIA,
  SLEEP_EFFICIENCY_MIN,
  MIN_OVERLAP_HOURS,
  SIGNIFICANCE_LEVELS,
  CORRELATION_THRESHOLDS,
  DUAL_AXIS_CHART_HEIGHT,
  CORRELATION_MATRIX_HEIGHT,
  CORRELATION_CHART_MARGINS,
  DATA_LIMITS,
  ALIGNMENT,
  CORRELATION_ENGINE,
} from '../constants/wearableConstants.js';

describe('wearable constants', () => {
  it('exports physiological HR validation ranges', () => {
    expect(HR_RESTING_MIN).toBe(40);
    expect(HR_RESTING_MAX).toBe(100);
  });

  it('exports SpO2 thresholds', () => {
    expect(SPO2_NORMAL_MIN).toBe(95);
    expect(SPO2_MILD_HYPOXEMIA).toBe(90);
  });

  it('exports sleep efficiency threshold', () => {
    expect(SLEEP_EFFICIENCY_MIN).toBe(85);
  });

  it('exports temporal alignment constants', () => {
    expect(MIN_OVERLAP_HOURS).toBe(4);
    expect(ALIGNMENT.MIN_OVERLAP_HOURS).toBe(MIN_OVERLAP_HOURS);
  });

  it('exports statistical significance levels', () => {
    expect(SIGNIFICANCE_LEVELS.P_05).toBe(0.05);
    expect(SIGNIFICANCE_LEVELS.P_01).toBe(0.01);
  });

  it('exports correlation thresholds', () => {
    expect(CORRELATION_THRESHOLDS.WEAK).toBe(0.3);
    expect(CORRELATION_THRESHOLDS.STRONG).toBe(0.7);
  });

  it('exports chart layout constants', () => {
    expect(DUAL_AXIS_CHART_HEIGHT).toBe(500);
    expect(CORRELATION_MATRIX_HEIGHT).toBe(450);
    expect(CORRELATION_CHART_MARGINS.DUAL_AXIS).toMatchObject({
      top: 20,
      right: 80,
    });
  });

  it('exports data validation limits', () => {
    expect(DATA_LIMITS.MIN_NIGHTS_FOR_ANALYSIS).toBe(7);
  });

  it('exports correlation engine FDR thresholds', () => {
    expect(CORRELATION_ENGINE.Q_PRIMARY).toBe(0.05);
    expect(CORRELATION_ENGINE.Q_EXPLORATORY).toBe(0.1);
  });
});
