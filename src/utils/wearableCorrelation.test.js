import { describe, it, expect } from 'vitest';
import {
  spearmanCorrelation,
  crossCorrelation,
} from './wearableCorrelation.js';

describe('Fitbit Correlation Algorithms', () => {
  describe('spearmanCorrelation', () => {
    it('computes perfect positive correlation', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 6, 8, 10]; // Perfect linear relationship

      const result = spearmanCorrelation(x, y);

      expect(result.correlation).toBeCloseTo(1.0, 10);
      expect(result.n).toBe(5);
      expect(result.pValue).toBe(0);
    });

    it('computes perfect negative correlation', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [10, 8, 6, 4, 2]; // Perfect inverse relationship

      const result = spearmanCorrelation(x, y);

      expect(result.correlation).toBeCloseTo(-1.0, 10);
      expect(result.n).toBe(5);
      expect(result.pValue).toBeLessThan(0.001);
    });

    it('handles monotonic non-linear relationships', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [1, 4, 9, 16, 25]; // Quadratic but monotonic

      const result = spearmanCorrelation(x, y);

      expect(result.correlation).toBeCloseTo(1.0, 10);
      expect(result.n).toBe(5);
    });

    it('returns finite p-values for strong but imperfect correlations', () => {
      const x = Array.from({ length: 30 }, (_, i) => i);
      // Deterministic noise to avoid perfect monotonic ordering while keeping a strong trend
      const y = x.map((val, idx) => val + (idx % 2 === 0 ? 2 : -2));

      const result = spearmanCorrelation(x, y);

      expect(Math.abs(result.correlation)).toBeGreaterThan(0.8);
      expect(Number.isFinite(result.pValue)).toBe(true);
      expect(result.pValue).toBeLessThan(0.001);
    });

    it('returns zero correlation for independent variables', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [3, 1, 4, 2, 5]; // Random permutation

      const result = spearmanCorrelation(x, y);

      expect(Math.abs(result.correlation)).toBeLessThan(0.5);
      expect(result.n).toBe(5);
    });

    it('handles tied values using average rank method', () => {
      const x = [1, 2, 2, 3, 3, 3];
      const y = [1, 2, 2, 4, 4, 4]; // Tied values in both series

      const result = spearmanCorrelation(x, y);

      expect(Number.isFinite(result.correlation)).toBe(true);
      expect(result.n).toBe(6);
    });

    it('filters out NaN values pairwise', () => {
      const x = [1, 2, NaN, 4, 5];
      const y = [2, NaN, 6, 8, 10]; // Different NaN positions

      const result = spearmanCorrelation(x, y);

      expect(result.n).toBe(3); // Only [1,2], [4,8], [5,10] are valid pairs
      expect(Number.isFinite(result.correlation)).toBe(true);
    });

    it('returns NaN for insufficient data', () => {
      const x = [1, 2];
      const y = [3, 4]; // Only 2 points

      const result = spearmanCorrelation(x, y);

      expect(Number.isNaN(result.correlation)).toBe(true);
      expect(result.n).toBe(2);
    });

    it('throws error for mismatched array lengths', () => {
      const x = [1, 2, 3];
      const y = [1, 2]; // Different lengths

      expect(() => spearmanCorrelation(x, y)).toThrow(
        'arrays must have equal length',
      );
    });
  });

  describe('crossCorrelation', () => {
    it('detects synchronous correlation at lag 0', () => {
      const x = [1, 2, 3, 4, 5, 4, 3, 2, 1];
      const y = [2, 4, 6, 8, 10, 8, 6, 4, 2]; // Perfectly synchronized

      const result = crossCorrelation(x, y, { maxLag: 3 });

      expect(result.peak.lag).toBe(0);
      expect(result.peak.correlation).toBeCloseTo(1.0, 5);
      expect(result.isSignificant).toBe(true);
    });

    it('detects lagged correlation with positive lag', () => {
      // y leads x by 2 time units
      const x = [1, 1, 1, 2, 3, 4, 5, 4, 3, 2];
      const y = [1, 2, 3, 4, 5, 4, 3, 2, 1, 1];

      const result = crossCorrelation(x, y, { maxLag: 5 });

      expect(result.peak.lag).toBe(2); // y leads by 2
      expect(Math.abs(result.peak.correlation)).toBeGreaterThan(0.5);
    });

    it('detects lagged correlation with negative lag', () => {
      // x leads y by 2 time units
      const x = [1, 2, 3, 4, 5, 4, 3, 2, 1, 1];
      const y = [1, 1, 1, 2, 3, 4, 5, 4, 3, 2];

      const result = crossCorrelation(x, y, { maxLag: 5 });

      expect(result.peak.lag).toBe(-2); // x leads by 2
      expect(Math.abs(result.peak.correlation)).toBeGreaterThan(0.5);
    });

    it('provides significance threshold for white noise', () => {
      const n = 100;
      // Use deterministic uncorrelated data instead of Math.random()
      const x = Array.from({ length: n }, (_, i) => Math.sin(i * 0.1));
      const y = Array.from({ length: n }, (_, i) => Math.cos(i * 0.234)); // Different frequency, should be uncorrelated

      const result = crossCorrelation(x, y, { maxLag: 10 });

      expect(result.peak.threshold).toBeCloseTo(1.96 / Math.sqrt(n), 3);
      expect(result.isSignificant).toBe(false); // Uncorrelated data should not be significant
    });

    it('throws error for insufficient data', () => {
      const x = [1, 2, 3];
      const y = [1, 2, 3]; // Too few points for maxLag=5

      expect(() => crossCorrelation(x, y, { maxLag: 5 })).toThrow(
        'insufficient data',
      );
    });
  });
});
