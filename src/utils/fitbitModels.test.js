import { describe, it, expect } from 'vitest';
import {
  createNightlyRecord,
  validateNightlyRecord,
  checkDataSufficiency,
  normalizeFitbitData,
} from './fitbitModels.js';

describe('Fitbit Data Models', () => {
  describe('createNightlyRecord', () => {
    it('creates a complete nightly record with default values', () => {
      const record = createNightlyRecord({
        date: '2024-01-15',
        oscar: {
          ahi: 12.5,
          pressures: { epap: 8.5 },
          usage: { totalMinutes: 480 }, // 8 hours
        },
        fitbit: {
          heartRate: {
            restingBpm: 65,
            avgSleepBpm: 58,
            hrv: { rmssd: 25, confidence: 'high' },
          },
          oxygenSaturation: { minPercent: 92, avgPercent: 96 },
          sleepStages: { totalSleepMinutes: 450, sleepEfficiency: 88 },
        },
      });

      expect(record.date).toEqual(new Date('2024-01-15'));
      expect(record.oscar.ahi).toBe(12.5);
      expect(record.oscar.pressures.epap).toBe(8.5);
      expect(record.fitbit.heartRate.restingBpm).toBe(65);
      expect(record.fitbit.heartRate.hrv.rmssd).toBe(25);
      expect(record.dataQuality.excluded).toBe(false);
    });

    it('handles missing optional fields with NaN defaults', () => {
      const record = createNightlyRecord({
        date: '2024-01-15',
      });

      expect(Number.isNaN(record.oscar.ahi)).toBe(true);
      expect(Number.isNaN(record.fitbit.heartRate.restingBpm)).toBe(true);
      expect(record.oscar.events).toEqual([]);
      expect(record.dataQuality.imputedFields).toEqual([]);
    });
  });

  describe('validateNightlyRecord', () => {
    it('validates a record with normal physiological values', () => {
      const record = createNightlyRecord({
        date: '2024-01-15',
        oscar: {
          ahi: 8.2,
          pressures: { epap: 10.5 },
          usage: { totalMinutes: 420 },
        },
        fitbit: {
          heartRate: {
            restingBpm: 72,
            avgSleepBpm: 62,
            hrv: { rmssd: 28 },
          },
          oxygenSaturation: { minPercent: 94, avgPercent: 97 },
          sleepStages: {
            totalSleepMinutes: 410,
            sleepEfficiency: 85,
          },
        },
      });

      const validation = validateNightlyRecord(record);

      expect(validation.valid).toBe(true);
      expect(validation.issues).toEqual([]);
      expect(validation.dataQuality).toBeCloseTo(1.0);
    });

    it('detects implausible AHI values', () => {
      const record = createNightlyRecord({
        date: '2024-01-15',
        oscar: { ahi: 175 }, // Too high
      });

      const validation = validateNightlyRecord(record);

      expect(validation.valid).toBe(false);
      expect(validation.issues).toContain(
        'Implausible AHI: 175 events/hour (expected 0-150)',
      );
    });

    it('detects implausible EPAP values', () => {
      const record = createNightlyRecord({
        date: '2024-01-15',
        oscar: {
          pressures: { epap: 2.5 }, // Too low
        },
      });

      const validation = validateNightlyRecord(record);

      expect(validation.valid).toBe(false);
      expect(validation.issues).toContain(
        'Implausible EPAP: 2.5 cmH2O (expected 4-25)',
      );
    });

    it('detects dangerously low SpO2 values', () => {
      const record = createNightlyRecord({
        date: '2024-01-15',
        fitbit: {
          oxygenSaturation: { minPercent: 65 }, // Critically low
        },
      });

      const validation = validateNightlyRecord(record);

      expect(validation.valid).toBe(false);
      expect(validation.issues).toContain(
        'Dangerously low SpO2: 65% (below 70%)',
      );
    });

    it('detects sleep duration mismatch between OSCAR and Fitbit', () => {
      const record = createNightlyRecord({
        date: '2024-01-15',
        oscar: {
          usage: { totalMinutes: 480 }, // 8 hours
        },
        fitbit: {
          sleepStages: { totalSleepMinutes: 300 }, // 5 hours (3hr difference)
        },
      });

      const validation = validateNightlyRecord(record);

      expect(validation.valid).toBe(false);
      expect(validation.issues).toContain(
        'Sleep duration mismatch: Fitbit 300min vs OSCAR 480min (>120min difference)',
      );
    });

    it('detects zero usage with zero AHI pattern', () => {
      const record = createNightlyRecord({
        date: '2024-01-15',
        oscar: {
          ahi: 0,
          usage: { totalMinutes: 0 },
        },
      });

      const validation = validateNightlyRecord(record);

      expect(validation.valid).toBe(false);
      expect(validation.issues).toContain(
        'Zero AHI with zero usage - possible non-therapy night',
      );
    });
  });

  describe('checkDataSufficiency', () => {
    it('identifies sufficient data for basic correlation', () => {
      const record = createNightlyRecord({
        date: '2024-01-15',
        oscar: {
          ahi: 12.5,
          usage: { totalMinutes: 420 },
        },
        fitbit: {
          heartRate: { avgSleepBpm: 58 },
          sleepStages: { totalSleepMinutes: 410 },
        },
      });

      const sufficiency = checkDataSufficiency(record);

      expect(sufficiency.sufficient).toBe(true);
      expect(sufficiency.missing).toEqual([]);
    });

    it('identifies missing required OSCAR data', () => {
      const record = createNightlyRecord({
        date: '2024-01-15',
        fitbit: {
          heartRate: { avgSleepBpm: 58 },
          sleepStages: { totalSleepMinutes: 410 },
        },
        // Missing OSCAR data
      });

      const sufficiency = checkDataSufficiency(record);

      expect(sufficiency.sufficient).toBe(false);
      expect(sufficiency.missing).toContain('OSCAR AHI');
      expect(sufficiency.missing).toContain('OSCAR usage duration');
    });

    it('identifies missing required Fitbit data', () => {
      const record = createNightlyRecord({
        date: '2024-01-15',
        oscar: {
          ahi: 12.5,
          usage: { totalMinutes: 420 },
        },
        // Missing Fitbit data
      });

      const sufficiency = checkDataSufficiency(record);

      expect(sufficiency.sufficient).toBe(false);
      expect(sufficiency.missing).toContain('Fitbit sleep heart rate');
      expect(sufficiency.missing).toContain('Fitbit sleep duration');
    });

    it('warns about optional but valuable data', () => {
      const record = createNightlyRecord({
        date: '2024-01-15',
        oscar: {
          ahi: 12.5,
          usage: { totalMinutes: 420 },
        },
        fitbit: {
          heartRate: { avgSleepBpm: 58 }, // Has required data
          sleepStages: { totalSleepMinutes: 410 },
          // Missing optional HRV and SpO2
        },
      });

      const sufficiency = checkDataSufficiency(record);

      expect(sufficiency.sufficient).toBe(true);
      expect(sufficiency.optional).toContain('HRV (advanced correlation)');
      expect(sufficiency.optional).toContain('SpO2 (oxygen correlation)');
    });
  });

  describe('normalizeFitbitData', () => {
    it('converts raw Fitbit API response to standardized format', () => {
      const rawFitbitData = {
        heartRate: {
          restingHeartRate: 68,
        },
        sleep: {
          averageHeartRate: 61,
          minHeartRate: 48,
          maxHeartRate: 82,
          totalSleepRecords: 445, // minutes
          efficiency: 87,
          minutesToFallAsleep: 12,
          levels: {
            summary: {
              light: { minutes: 245 },
              deep: { minutes: 85 },
              rem: { minutes: 115 },
              wake: { minutes: 22 },
            },
          },
        },
        hrv: {
          dailyRmssd: 32.5,
          lfHfRatio: 1.8,
          confidence: 'high',
        },
        spo2: {
          min: 93,
          avg: 96.5,
          variabilityCoeff: 0.03,
        },
        breathing: {
          averageBreathingRate: 16.2,
          breathingRateVariabilityCoeff: 0.12,
          confidence: 'medium',
        },
      };

      const normalized = normalizeFitbitData(rawFitbitData);

      expect(normalized.heartRate.restingBpm).toBe(68);
      expect(normalized.heartRate.avgSleepBpm).toBe(61);
      expect(normalized.heartRate.hrv.rmssd).toBe(32.5);
      expect(normalized.heartRate.hrv.confidence).toBe('high');

      expect(normalized.sleepStages.totalSleepMinutes).toBe(445);
      expect(normalized.sleepStages.sleepEfficiency).toBe(87);
      expect(normalized.sleepStages.lightSleepMinutes).toBe(245);
      expect(normalized.sleepStages.deepSleepMinutes).toBe(85);

      expect(normalized.oxygenSaturation.minPercent).toBe(93);
      expect(normalized.oxygenSaturation.avgPercent).toBe(96.5);

      expect(normalized.breathing.avgRatePerMin).toBe(16.2);
      expect(normalized.breathing.confidence).toBe('medium');
    });

    it('handles missing fields with NaN defaults', () => {
      const incompleteFitbitData = {
        heartRate: {
          restingHeartRate: 70,
          // Missing other HR fields
        },
        // Missing sleep, HRV, SpO2, breathing data
      };

      const normalized = normalizeFitbitData(incompleteFitbitData);

      expect(normalized.heartRate.restingBpm).toBe(70);
      expect(Number.isNaN(normalized.heartRate.avgSleepBpm)).toBe(true);
      expect(Number.isNaN(normalized.heartRate.hrv.rmssd)).toBe(true);
      expect(Number.isNaN(normalized.sleepStages.totalSleepMinutes)).toBe(true);
      expect(Number.isNaN(normalized.oxygenSaturation.minPercent)).toBe(true);
      expect(Number.isNaN(normalized.breathing.avgRatePerMin)).toBe(true);
    });
  });

  describe('edge cases and error handling', () => {
    it('handles extreme but valid physiological values', () => {
      const record = createNightlyRecord({
        date: '2024-01-15',
        oscar: {
          ahi: 5.0, // Exactly at normal/mild boundary
          pressures: { epap: 4.0 }, // Minimum therapeutic pressure
        },
        fitbit: {
          heartRate: {
            restingBpm: 40, // Bradycardia but within validation range
            avgSleepBpm: 35, // Minimum sleep HR
            hrv: { rmssd: 5 }, // Low but above absolute minimum
          },
          oxygenSaturation: { minPercent: 95 }, // Normal minimum
        },
      });

      const validation = validateNightlyRecord(record);

      expect(validation.valid).toBe(true);
      expect(validation.issues).toEqual([]);
    });

    it('handles NaN values gracefully in validation', () => {
      const record = createNightlyRecord({
        date: '2024-01-15',
        oscar: { ahi: NaN },
        fitbit: {
          heartRate: { restingBpm: NaN },
          oxygenSaturation: { minPercent: NaN },
        },
      });

      const validation = validateNightlyRecord(record);

      // Should not throw errors, just skip validation for NaN values
      expect(validation.valid).toBe(true);
      expect(validation.issues).toEqual([]);
    });
  });
});
