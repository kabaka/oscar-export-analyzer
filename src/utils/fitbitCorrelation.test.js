import { describe, it, expect } from 'vitest';
import {
  spearmanCorrelation,
  crossCorrelation,
  grangerCausalityTest,
  computeOscarFitbitCorrelations,
} from './fitbitCorrelation.js';
import { createNightlyRecord } from './fitbitModels.js';

// Helper function to create test records
const createTestRecord = (data) => createNightlyRecord(data);

describe('Fitbit Correlation Algorithms', () => {
  describe('spearmanCorrelation', () => {
    it('computes perfect positive correlation', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 6, 8, 10]; // Perfect linear relationship

      const result = spearmanCorrelation(x, y);

      expect(result.correlation).toBeCloseTo(1.0, 10);
      expect(result.n).toBe(5);
      expect(result.pValue).toBeLessThan(0.001);
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

  describe('grangerCausalityTest', () => {
    it('detects Granger causality in simple AR system', () => {
      // Simulate AR system: y[t] = 0.5*y[t-1] + 0.3*x[t-1] + noise
      const n = 50;
      const x = Array.from({ length: n }, () => Math.random());
      const y = [Math.random()]; // Initial value

      for (let t = 1; t < n; t++) {
        y[t] = 0.5 * y[t - 1] + 0.3 * x[t - 1] + 0.1 * Math.random();
      }

      const result = grangerCausalityTest(x, y, { maxLag: 3 });

      expect(Number.isFinite(result.fStatistic)).toBe(true);
      expect(Number.isFinite(result.pValue)).toBe(true);
      expect(typeof result.grangerCauses).toBe('boolean');
    });

    it('returns false for independent time series', () => {
      const n = 30;
      // Use deterministic uncorrelated data instead of Math.random()
      const x = Array.from({ length: n }, (_, i) => Math.sin(i * 0.1));
      const y = Array.from({ length: n }, (_, i) => Math.cos(i * 0.234)); // Different frequency, should be uncorrelated

      const result = grangerCausalityTest(x, y, { maxLag: 2 });

      // Independent series should not show Granger causality
      expect(result.grangerCauses).toBe(false);
      expect(result.pValue).toBeGreaterThan(0.05);
    });

    it('handles missing data with pairwise deletion', () => {
      const n = 30;
      const x = Array.from({ length: n }, (_, i) =>
        i % 5 === 0 ? NaN : Math.random(),
      );
      const y = Array.from({ length: n }, (_, i) =>
        i % 7 === 0 ? NaN : Math.random(),
      );

      const result = grangerCausalityTest(x, y, { maxLag: 2 });

      // Should handle NaN values without throwing
      expect(typeof result.grangerCauses).toBe('boolean');
    });

    it('returns NaN for insufficient data', () => {
      const x = [1, 2, 3, 4, 5]; // Too few observations
      const y = [2, 3, 4, 5, 6];

      const result = grangerCausalityTest(x, y, { maxLag: 3 });

      expect(Number.isNaN(result.fStatistic)).toBe(true);
      expect(Number.isNaN(result.pValue)).toBe(true);
      expect(result.grangerCauses).toBe(false);
    });
  });

  describe('computeOscarFitbitCorrelations', () => {
    function createTestRecord(overrides = {}) {
      return createNightlyRecord({
        date: '2024-01-15',
        oscar: {
          ahi: 10,
          pressures: { epap: 8 },
          usage: { totalMinutes: 420, leakPercent: 5 }, // 7 hours
        },
        fitbit: {
          heartRate: {
            restingBpm: 65,
            avgSleepBpm: 58,
            hrv: { rmssd: 25 },
          },
          oxygenSaturation: { minPercent: 92, avgPercent: 96 },
          sleepStages: {
            totalSleepMinutes: 400,
            sleepEfficiency: 85,
            deepSleepMinutes: 80,
          },
        },
        ...overrides,
      });
    }

    it('computes comprehensive correlation matrix', () => {
      // Create dataset with strong AHI-HRV negative correlation
      const records = Array.from({ length: 20 }, (_, i) => {
        const ahi = 5 + i * 2; // AHI from 5 to 43
        const hrv = 40 - i * 1.5; // HRV from 40 to 11.5 (inverse relationship)

        return createTestRecord({
          oscar: { ahi, usage: { totalMinutes: 420 } },
          fitbit: {
            heartRate: { hrv: { rmssd: hrv } },
            sleepStages: { sleepEfficiency: 90 - i * 0.5 },
          },
        });
      });

      const result = computeOscarFitbitCorrelations(records);

      expect(result.sampleSize).toBe(20);
      expect(result.correlations).toBeDefined();

      // Check AHI-HRV correlation
      const ahiHrv = result.correlations.ahi_hrv;
      expect(ahiHrv).toBeDefined();
      expect(ahiHrv.correlation).toBeLessThan(-0.5); // Strong negative correlation
      expect(ahiHrv.pValue).toBeLessThan(0.01);
      expect(ahiHrv.effectSize).toBe('large');
      expect(ahiHrv.expected).toBe('negative');
      expect(ahiHrv.clinical).toContain('autonomic function');
    });

    it('handles insufficient data gracefully', () => {
      const records = [createTestRecord(), createTestRecord()]; // Only 2 records

      const result = computeOscarFitbitCorrelations(records);

      expect(result.sampleSize).toBe(2);
      expect(result.warning).toContain('Insufficient data');
      expect(result.correlations).toEqual({});
    });

    it('provides clinical interpretation for correlations', () => {
      // Create dataset with expected positive usage-HRV correlation
      const records = Array.from({ length: 15 }, (_, i) => {
        const usage = 300 + i * 20; // Usage from 5 to 9.7 hours
        const hrv = 15 + i * 1.2; // HRV increases with usage

        return createTestRecord({
          oscar: { usage: { totalMinutes: usage } },
          fitbit: { heartRate: { hrv: { rmssd: hrv } } },
        });
      });

      const result = computeOscarFitbitCorrelations(records);

      const usageHrv = result.correlations.usage_hrv;
      expect(usageHrv.expected).toBe('positive');
      expect(usageHrv.clinical).toContain('therapy');
      expect(usageHrv.interpretation).toMatch(/correlation/);
    });

    it('extracts and validates metric arrays', () => {
      const records = [
        createTestRecord({
          oscar: { ahi: 12.5 },
          fitbit: { heartRate: { restingBpm: 70 } },
        }),
        createTestRecord({
          oscar: { ahi: 8.2 },
          fitbit: { heartRate: { restingBpm: 65 } },
        }),
      ];

      const result = computeOscarFitbitCorrelations(records);

      expect(result.metrics).toBeDefined();
      expect(result.metrics.ahi).toEqual([12.5, 8.2]);
      expect(result.metrics.restingHR).toEqual([70, 65]);
    });

    it('handles missing values in correlation computation', () => {
      const records = [
        createTestRecord({
          oscar: { ahi: 10 },
          fitbit: { heartRate: { hrv: { rmssd: 25 } } },
        }),
        createTestRecord({
          oscar: { ahi: NaN }, // Missing AHI
          fitbit: { heartRate: { hrv: { rmssd: 30 } } },
        }),
        createTestRecord({
          oscar: { ahi: 15 },
          fitbit: { heartRate: { hrv: { rmssd: 20 } } },
        }),
        createTestRecord({
          oscar: { ahi: 8 },
          fitbit: { heartRate: { hrv: { rmssd: 35 } } },
        }),
      ];

      const result = computeOscarFitbitCorrelations(records);

      // Should not crash and should handle NaN values appropriately
      // After filtering NaN values, should have 3 valid pairs for AHI-HRV correlation
      expect(result.sampleSize).toBe(4);
      expect(
        Number.isFinite(result.correlations.ahi_hrv?.correlation || NaN),
      ).toBe(true);
    });
  });

  describe('clinical correlation hypotheses', () => {
    it('validates expected AHI-SpO2 negative correlation', () => {
      // Higher AHI should correlate with lower minimum SpO2
      const records = Array.from({ length: 25 }, (_, i) => {
        const ahi = 2 + i * 2; // AHI from 2 to 50
        const minSpO2 = 98 - Math.sqrt(ahi) * 2; // Non-linear decrease

        return createTestRecord({
          oscar: { ahi },
          fitbit: { oxygenSaturation: { minPercent: minSpO2 } },
        });
      });

      const result = computeOscarFitbitCorrelations(records);
      const ahiSpO2 = result.correlations.ahi_minSpO2;

      expect(ahiSpO2.correlation).toBeLessThan(0);
      expect(ahiSpO2.expected).toBe('negative');
      expect(ahiSpO2.clinical).toContain('oxygen');
    });

    it('validates expected EPAP-SpO2 positive correlation', () => {
      // Higher EPAP should correlate with better minimum SpO2
      const records = Array.from({ length: 20 }, (_, i) => {
        const epap = 6 + i * 0.5; // EPAP from 6 to 15.5 cmH2O
        const minSpO2 = 88 + epap; // Positive relationship

        return createTestRecord({
          oscar: { pressures: { epap } },
          fitbit: { oxygenSaturation: { minPercent: minSpO2 } },
        });
      });

      const result = computeOscarFitbitCorrelations(records);
      const epapSpO2 = result.correlations.epap_minSpO2;

      expect(epapSpO2.correlation).toBeGreaterThan(0);
      expect(epapSpO2.expected).toBe('positive');
      expect(epapSpO2.clinical).toContain('oxygenation');
    });

    it('validates leak percentage impact on therapy effectiveness', () => {
      // Higher leak should correlate with worse sleep efficiency
      const records = Array.from({ length: 18 }, (_, i) => {
        const leakPercent = i * 3; // Leak from 0% to 51%
        const sleepEfficiency = 95 - leakPercent * 0.8; // Decreases with leak

        return createTestRecord({
          oscar: { usage: { leakPercent } },
          fitbit: { sleepStages: { sleepEfficiency } },
        });
      });

      const result = computeOscarFitbitCorrelations(records);
      const leakEfficiency = result.correlations.leakPercent_sleepEfficiency;

      expect(leakEfficiency.correlation).toBeLessThan(0);
      expect(leakEfficiency.expected).toBe('negative');
      expect(leakEfficiency.clinical).toContain('sleep');
    });
  });
});
