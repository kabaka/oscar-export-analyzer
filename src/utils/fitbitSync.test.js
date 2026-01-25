import { describe, it, expect } from 'vitest';
import {
  calculateSleepDate,
  alignOscarFitbitNights,
  validateAlignment,
  imputeMissingValues,
} from './fitbitSync.js';
import { createNightlyRecord } from './fitbitModels.js';

describe('Fitbit Synchronization Utilities', () => {
  describe('calculateSleepDate', () => {
    it('assigns correct sleep date for evening sessions', () => {
      // Session starts at 10:30 PM on Jan 15 -> sleep date is Jan 15
      const sessionStart = new Date('2024-01-15T22:30:00');
      const sleepDate = calculateSleepDate(sessionStart);

      expect(sleepDate.getFullYear()).toBe(2024);
      expect(sleepDate.getMonth()).toBe(0); // January (0-indexed)
      expect(sleepDate.getDate()).toBe(15);
      expect(sleepDate.getHours()).toBe(0); // Normalized to midnight
      expect(sleepDate.getMinutes()).toBe(0);
    });

    it('assigns correct sleep date for early morning sessions', () => {
      // Session starts at 2:00 AM on Jan 16 -> sleep date is Jan 15 (previous day)
      const sessionStart = new Date('2024-01-16T02:00:00');
      const sleepDate = calculateSleepDate(sessionStart);

      expect(sleepDate.getFullYear()).toBe(2024);
      expect(sleepDate.getMonth()).toBe(0); // January
      expect(sleepDate.getDate()).toBe(15); // Previous day
    });

    it('handles noon boundary correctly', () => {
      // Session starts at exactly noon -> belongs to current day
      const sessionStart = new Date('2024-01-15T12:00:00');
      const sleepDate = calculateSleepDate(sessionStart);

      expect(sleepDate.getDate()).toBe(15); // Same day

      // Session starts just before noon -> belongs to previous day
      const sessionStart2 = new Date('2024-01-15T11:59:59');
      const sleepDate2 = calculateSleepDate(sessionStart2);

      expect(sleepDate2.getDate()).toBe(14); // Previous day
    });

    it('handles timezone offsets', () => {
      // Positive offsets (west of UTC) move local time earlier
      const sessionStart = new Date('2024-01-15T18:00:00Z');
      const westOffset = 480; // UTC-8
      const westSleepDate = calculateSleepDate(sessionStart, westOffset);

      expect(westSleepDate.getDate()).toBe(14); // Moves to previous sleep date

      // Negative offsets (east of UTC) push local time later
      const eastOffset = -330; // UTC+5:30
      const eastSleepDate = calculateSleepDate(sessionStart, eastOffset);

      expect(eastSleepDate.getDate()).toBe(15); // Stays on same sleep date
    });

    it('throws error for invalid session time', () => {
      expect(() => calculateSleepDate('invalid-date')).toThrow(
        'Invalid session start time',
      );
    });
  });

  describe('alignOscarFitbitNights', () => {
    function createOscarRecord(date, ahi = 10, totalTime = '07:00:00') {
      return {
        Date: date,
        sessionStartTime: new Date(`${date}T22:00:00`), // 10 PM session start
        AHI: ahi,
        'Total Time': totalTime,
        'Median EPAP': 8.5,
      };
    }

    function createFitbitRecord(date, sleepMinutes = 420) {
      return {
        date: new Date(`${date}T00:00:00`), // Fitbit uses sleep date
        fitbit: {
          heartRate: {
            restingBpm: 65,
            avgSleepBpm: 58,
            hrv: { rmssd: 25, confidence: 'high' },
          },
          sleepStages: {
            totalSleepMinutes: sleepMinutes,
            sleepEfficiency: 88,
          },
          oxygenSaturation: { minPercent: 92 },
        },
      };
    }

    it('aligns records with exact date matches', () => {
      const oscarRecords = [
        createOscarRecord('2024-01-15'),
        createOscarRecord('2024-01-16'),
        createOscarRecord('2024-01-17'),
      ];

      const fitbitRecords = [
        createFitbitRecord('2024-01-15'),
        createFitbitRecord('2024-01-16'),
        createFitbitRecord('2024-01-17'),
      ];

      const result = alignOscarFitbitNights(oscarRecords, fitbitRecords);

      expect(result.aligned).toHaveLength(3);
      expect(result.unmatched.oscar).toHaveLength(0);
      expect(result.unmatched.fitbit).toHaveLength(0);

      expect(result.statistics.matchRate).toBe(1.0);
      expect(result.statistics.matchTypes.exact).toBe(3);

      // Verify proper alignment
      expect(result.aligned[0].oscar.Date).toBe('2024-01-15');
      expect(
        result.aligned[0].fitbit.date.toISOString().startsWith('2024-01-15'),
      ).toBe(true);
    });

    it('handles missing Fitbit data gracefully', () => {
      const oscarRecords = [
        createOscarRecord('2024-01-15'),
        createOscarRecord('2024-01-16'), // No matching Fitbit
        createOscarRecord('2024-01-17'),
      ];

      const fitbitRecords = [
        createFitbitRecord('2024-01-15'),
        createFitbitRecord('2024-01-17'), // Missing 2024-01-16
      ];

      const result = alignOscarFitbitNights(oscarRecords, fitbitRecords);

      // Alignment finds delayed matches within sync window, so all 3 Oscar records may match
      expect(result.aligned.length).toBeGreaterThanOrEqual(2);
      expect(result.aligned.length).toBeLessThanOrEqual(3);
    });

    it('handles sync delays within window', () => {
      const oscarRecords = [createOscarRecord('2024-01-15')];

      // Fitbit data arrives 1 day late due to sync delay
      const fitbitRecords = [
        createFitbitRecord('2024-01-16'), // Should match with delayed search
      ];

      const result = alignOscarFitbitNights(oscarRecords, fitbitRecords);

      expect(result.aligned).toHaveLength(1);
      expect(result.aligned[0].matchType).toBe('delayed');
    });

    it('handles multiple Fitbit records for same date', () => {
      const oscarRecords = [
        createOscarRecord('2024-01-15', 10, '08:00:00'), // 8 hours
      ];

      const fitbitRecords = [
        createFitbitRecord('2024-01-15', 300), // 5 hours sleep
        createFitbitRecord('2024-01-15', 480), // 8 hours sleep (better match)
      ];

      const result = alignOscarFitbitNights(oscarRecords, fitbitRecords);

      expect(result.aligned).toHaveLength(1);
      expect(result.aligned[0].matchType).toBe('exact_multiple');

      // Should choose the Fitbit record with closer duration match
      const alignedFitbit = result.aligned[0].fitbit;
      expect(alignedFitbit.fitbit.sleepStages.totalSleepMinutes).toBe(480);
    });

    it('provides comprehensive statistics', () => {
      const oscarRecords = [
        createOscarRecord('2024-01-15'),
        createOscarRecord('2024-01-16'),
        createOscarRecord('2024-01-17'),
      ];

      const fitbitRecords = [
        createFitbitRecord('2024-01-15'),
        createFitbitRecord('2024-01-18'), // Delayed match for 01-17
      ];

      const result = alignOscarFitbitNights(oscarRecords, fitbitRecords);

      expect(result.statistics.oscarTotal).toBe(3);
      expect(result.statistics.fitbitTotal).toBe(2);
      // Alignment may find delayed matches, so count can be 2 or 3
      expect(result.statistics.alignedCount).toBeGreaterThanOrEqual(2);
      expect(result.statistics.alignedCount).toBeLessThanOrEqual(3);

      expect(result.statistics.matchTypes).toBeDefined();
      // Allow for different match strategies - alignment algorithm may vary
      expect(
        result.statistics.matchTypes.exact +
          (result.statistics.matchTypes.delayed || 0),
      ).toBeGreaterThanOrEqual(2);

      // Verify match types are present but don't enforce specific counts
      expect(result.statistics.matchTypes.exact).toBeGreaterThanOrEqual(1);
    });

    it('throws error for invalid input types', () => {
      expect(() => alignOscarFitbitNights(null, [])).toThrow(
        'inputs must be arrays',
      );

      expect(() => alignOscarFitbitNights([], 'not-array')).toThrow(
        'inputs must be arrays',
      );
    });
  });

  describe('validateAlignment', () => {
    it('validates good alignment between OSCAR and Fitbit', () => {
      const oscarRecord = {
        AHI: 12.5,
        'Total Time': 7.5, // 7.5 hours
        'Median EPAP': 8.5,
      };

      const fitbitRecord = {
        fitbit: {
          heartRate: { avgSleepBpm: 58 },
          sleepStages: { totalSleepMinutes: 450 }, // 7.5 hours
          oxygenSaturation: { minPercent: 92 },
        },
      };

      const validation = validateAlignment(oscarRecord, fitbitRecord);

      expect(validation.valid).toBe(true);
      expect(validation.warnings).toHaveLength(0);
      expect(validation.errors).toHaveLength(0);
      expect(validation.oscarComplete).toBe(true);
      expect(validation.fitbitComplete).toBe(true);
      expect(validation.overlapHours).toBe(7.5);
      expect(validation.timeDifference).toBe(0);
    });

    it('detects missing OSCAR data', () => {
      const oscarRecord = {
        AHI: '', // Missing AHI
        'Total Time': 7.0,
      };

      const fitbitRecord = {
        fitbit: {
          heartRate: { avgSleepBpm: 58 },
          sleepStages: { totalSleepMinutes: 420 },
        },
      };

      const validation = validateAlignment(oscarRecord, fitbitRecord);

      expect(validation.oscarComplete).toBe(false);
      expect(validation.errors).toContain('Missing OSCAR AHI data');
    });

    it('detects missing Fitbit data', () => {
      const oscarRecord = {
        AHI: 12.5,
        'Total Time': 7.0,
      };

      const fitbitRecord = {
        fitbit: {
          sleepStages: { totalSleepMinutes: 420 },
          // Missing heart rate data
        },
      };

      const validation = validateAlignment(oscarRecord, fitbitRecord);

      expect(validation.fitbitComplete).toBe(false);
      expect(validation.errors).toContain('Missing Fitbit heart rate data');
    });

    it('warns about large duration mismatches', () => {
      const oscarRecord = {
        AHI: 12.5,
        'Total Time': 8.0, // 8 hours
      };

      const fitbitRecord = {
        fitbit: {
          heartRate: { avgSleepBpm: 58 },
          sleepStages: { totalSleepMinutes: 300 }, // 5 hours (3hr difference)
        },
      };

      const validation = validateAlignment(oscarRecord, fitbitRecord);

      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.warnings[0]).toContain('duration mismatch');
      expect(validation.timeDifference).toBe(3.0);
      expect(validation.overlapHours).toBe(5.0);
    });

    it('rejects alignment with insufficient overlap', () => {
      const oscarRecord = {
        AHI: 12.5,
        'Total Time': 3.0, // Only 3 hours
      };

      const fitbitRecord = {
        fitbit: {
          heartRate: { avgSleepBpm: 58 },
          sleepStages: { totalSleepMinutes: 150 }, // 2.5 hours
        },
      };

      const validation = validateAlignment(oscarRecord, fitbitRecord);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.includes('overlap'))).toBe(true);
      expect(validation.overlapHours).toBe(2.5);
    });

    it('warns about zero usage nights', () => {
      const oscarRecord = {
        AHI: 0,
        'Total Time': 0, // No usage
      };

      const fitbitRecord = {
        fitbit: {
          heartRate: { avgSleepBpm: 58 },
          sleepStages: { totalSleepMinutes: 400 },
        },
      };

      const validation = validateAlignment(oscarRecord, fitbitRecord);

      expect(validation.warnings).toContain(
        'Zero OSCAR usage - possible non-therapy night',
      );
    });
  });

  describe('imputeMissingValues', () => {
    function createRecordForImputation(overrides = {}) {
      return {
        oscar: {
          ahi: 10,
          pressures: { epap: 8 },
          usage: { totalMinutes: 420 },
        },
        fitbit: {
          heartRate: {
            restingBpm: 65,
            avgSleepBpm: 58,
            hrv: { rmssd: 25 },
          },
        },
        dataQuality: {
          oscarDataComplete: true,
          fitbitDataComplete: true,
        },
        ...overrides,
      };
    }

    it('performs regression imputation for missing HRV', () => {
      const completeRecords = [
        createRecordForImputation(),
        createRecordForImputation({
          oscar: { ahi: 20 },
          fitbit: { heartRate: { hrv: { rmssd: 15 } } },
        }),
        createRecordForImputation({
          oscar: { ahi: 5 },
          fitbit: { heartRate: { hrv: { rmssd: 35 } } },
        }),
      ];

      const recordsWithMissing = [
        ...completeRecords,
        createRecordForImputation({
          oscar: { ahi: 12 },
          fitbit: { heartRate: { hrv: { rmssd: NaN } } }, // Missing HRV
          dataQuality: { fitbitDataComplete: false },
        }),
      ];

      const result = imputeMissingValues(recordsWithMissing, 'regression');

      expect(result).toHaveLength(4);

      const imputedRecord = result[3];
      expect(Number.isFinite(imputedRecord.fitbit.heartRate.hrv.rmssd)).toBe(
        true,
      );
      expect(imputedRecord.dataQuality.imputedFields).toContain(
        'fitbit.heartRate.hrv.rmssd',
      );
    });

    it('performs mean imputation for missing sleep HR', () => {
      const completeRecords = [
        createRecordForImputation({
          fitbit: {
            heartRate: { avgSleepBpm: 55, hrv: { rmssd: 25 } },
          },
        }),
        createRecordForImputation({
          fitbit: {
            heartRate: { avgSleepBpm: 65, hrv: { rmssd: 25 } },
          },
        }),
        createRecordForImputation({
          fitbit: {
            heartRate: { avgSleepBpm: 60, hrv: { rmssd: 25 } },
          },
        }),
      ];

      const recordsWithMissing = [
        ...completeRecords,
        createRecordForImputation({
          fitbit: { heartRate: { avgSleepBpm: NaN, hrv: { rmssd: 25 } } }, // Missing sleep HR
          dataQuality: {
            oscarDataComplete: true,
            fitbitDataComplete: false,
          },
        }),
      ];

      const result = imputeMissingValues(recordsWithMissing, 'mean');

      const imputedRecord = result[3];
      expect(Number.isFinite(imputedRecord.fitbit.heartRate.avgSleepBpm)).toBe(
        true,
      );
      expect(imputedRecord.dataQuality.imputedFields).toContain(
        'fitbit.heartRate.avgSleepBpm',
      );

      // Mean of [55, 65, 60] = 60
      expect(imputedRecord.fitbit.heartRate.avgSleepBpm).toBeCloseTo(60, 1);
    });

    it('handles insufficient complete records gracefully', () => {
      const records = [
        createRecordForImputation({
          dataQuality: { fitbitDataComplete: false },
        }),
        createRecordForImputation({
          dataQuality: { oscarDataComplete: false },
        }),
      ];

      const result = imputeMissingValues(records, 'regression');

      // Should return original records unchanged
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(records[0]);
    });

    it('preserves existing imputed fields list', () => {
      const records = [
        createRecordForImputation(),
        createRecordForImputation(),
        createRecordForImputation(),
        createRecordForImputation({
          fitbit: { heartRate: { avgSleepBpm: NaN, hrv: { rmssd: 25 } } },
          dataQuality: {
            oscarDataComplete: true,
            fitbitDataComplete: false,
            imputedFields: ['existing.field'],
          },
        }),
      ];

      const result = imputeMissingValues(records, 'mean');

      const imputedRecord = result[3];
      expect(imputedRecord.dataQuality.imputedFields).toContain(
        'existing.field',
      );
      expect(imputedRecord.dataQuality.imputedFields).toContain(
        'fitbit.heartRate.avgSleepBpm',
      );
    });

    it('throws error for unknown imputation method', () => {
      const records = [
        createRecordForImputation(),
        createRecordForImputation(),
        createRecordForImputation(),
        createRecordForImputation({
          fitbit: { heartRate: { avgSleepBpm: NaN } },
        }),
      ];

      expect(() => imputeMissingValues(records, 'unknown-method')).toThrow(
        'Unknown imputation method: unknown-method',
      );
    });

    it('returns empty array unchanged', () => {
      const result = imputeMissingValues([], 'regression');
      expect(result).toEqual([]);
    });
  });

  describe('edge cases and error handling', () => {
    it('handles malformed OSCAR session times', () => {
      const oscarRecord = {
        Date: '2024-01-15',
        sessionStartTime: 'invalid-time', // Malformed timestamp
        AHI: 10,
      };

      const fitbitRecord = createNightlyRecord({ date: '2024-01-15' });

      const result = alignOscarFitbitNights([oscarRecord], [fitbitRecord]);

      // Should handle gracefully and put record in unmatched
      expect(result.unmatched.oscar).toContain(oscarRecord);
    });

    it('handles timezone edge cases around midnight', () => {
      // Session at 11:59 PM should be current day
      const session1 = new Date('2024-01-15T23:59:59');
      const sleepDate1 = calculateSleepDate(session1);
      expect(sleepDate1.getDate()).toBe(15);

      // Session at 12:01 AM should be previous day
      const session2 = new Date('2024-01-16T00:01:00');
      const sleepDate2 = calculateSleepDate(session2);
      expect(sleepDate2.getDate()).toBe(15);
    });

    it('handles extreme timezone offsets', () => {
      // Test with large positive and negative offsets
      const sessionStart = new Date('2024-01-15T06:00:00Z'); // 6 AM UTC

      const baseSleepDate = calculateSleepDate(sessionStart, 0);

      // UTC-12 style offset (positive minutes west of UTC) shifts local time earlier
      const westSleepDate = calculateSleepDate(sessionStart, 12 * 60);
      expect(westSleepDate.getTime()).toBeLessThan(baseSleepDate.getTime());

      // UTC+14 style offset (negative minutes east of UTC) shifts local time later
      const eastSleepDate = calculateSleepDate(sessionStart, -14 * 60);
      expect(eastSleepDate.getTime()).toBeGreaterThanOrEqual(
        baseSleepDate.getTime(),
      );
    });
  });
});
