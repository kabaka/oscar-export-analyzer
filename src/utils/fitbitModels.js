/**
 * Fitbit data models and structures for OSCAR-Fitbit correlation analysis.
 *
 * Defines TypeScript-like interfaces and validation functions for Fitbit physiological data.
 * Follows existing OSCAR patterns for data parsing, validation, and statistical analysis.
 *
 * @module utils/fitbitModels
 */

import {
  HR_RESTING_MIN,
  HR_RESTING_MAX,
  HR_SLEEP_MIN,
  HR_ABSOLUTE_MAX,
  SPO2_NORMAL_MAX,
  SPO2_CRITICAL_MIN,
  HRV_ABSOLUTE_MIN,
  HRV_ABSOLUTE_MAX,
  SLEEP_DURATION_MIN,
  SLEEP_DURATION_MAX,
  RESP_RATE_MIN,
  RESP_RATE_MAX,
  FITBIT_CONFIDENCE_LOW,
} from '../constants/fitbit.js';

/**
 * Unified nightly record structure combining OSCAR and Fitbit data.
 *
 * @typedef {Object} NightlyRecord
 */
export function createNightlyRecord({
  date,
  timezoneOffset = 0,
  oscar = {},
  fitbit = {},
  correlations = {},
  dataQuality = {},
} = {}) {
  return {
    // Temporal identifiers
    date: new Date(date), // YYYY-MM-DD sleep date
    timezoneOffset, // minutes from UTC

    // OSCAR CPAP metrics
    oscar: {
      ahi: oscar.ahi ?? NaN, // events per hour
      centralAhi: oscar.centralAhi ?? NaN, // central apneas per hour
      obstructiveAhi: oscar.obstructiveAhi ?? NaN, // obstructive apneas per hour
      hypopneaAhi: oscar.hypopneaAhi ?? NaN, // hypopneas per hour

      pressures: {
        epap: oscar.pressures?.epap ?? NaN, // cmH2O
        ipap: oscar.pressures?.ipap ?? NaN, // cmH2O
        meanPressure: oscar.pressures?.meanPressure ?? NaN, // cmH2O
        maxPressure: oscar.pressures?.maxPressure ?? NaN, // cmH2O
        pressureRelief: oscar.pressures?.pressureRelief ?? NaN, // cmH2O
      },

      usage: {
        totalMinutes: oscar.usage?.totalMinutes ?? NaN, // total therapy time
        effectiveMinutes: oscar.usage?.effectiveMinutes ?? NaN, // time above minimum pressure
        leakPercent: oscar.usage?.leakPercent ?? NaN, // % time with excessive leak
        arousalCount: oscar.usage?.arousalCount ?? NaN, // detected arousals
      },

      events: oscar.events || [], // Array of event objects with timestamp, type, durationSec, clusterIndex
    },

    // Fitbit physiological metrics
    fitbit: {
      heartRate: {
        restingBpm: fitbit.heartRate?.restingBpm ?? NaN, // morning resting HR
        avgSleepBpm: fitbit.heartRate?.avgSleepBpm ?? NaN, // average during sleep
        minSleepBpm: fitbit.heartRate?.minSleepBpm ?? NaN, // minimum during sleep
        maxSleepBpm: fitbit.heartRate?.maxSleepBpm ?? NaN, // maximum during sleep
        hrv: {
          rmssd: fitbit.heartRate?.hrv?.rmssd ?? NaN, // ms, parasympathetic marker
          lfHf: fitbit.heartRate?.hrv?.lfHf ?? NaN, // LF/HF ratio, autonomic balance
          confidence:
            fitbit.heartRate?.hrv?.confidence || FITBIT_CONFIDENCE_LOW, // 'high', 'medium', 'low'
        },
      },

      oxygenSaturation: {
        minPercent: fitbit.oxygenSaturation?.minPercent ?? NaN, // lowest SpO2 reading
        avgPercent: fitbit.oxygenSaturation?.avgPercent ?? NaN, // average SpO2
        variabilityCoeff: fitbit.oxygenSaturation?.variabilityCoeff ?? NaN, // coefficient of variation
        odiEstimate: fitbit.oxygenSaturation?.odiEstimate ?? NaN, // desaturation events/hour
        measurementMinutes: fitbit.oxygenSaturation?.measurementMinutes ?? NaN, // valid SpO2 data duration
      },

      sleepStages: {
        totalSleepMinutes: fitbit.sleepStages?.totalSleepMinutes ?? NaN,
        lightSleepMinutes: fitbit.sleepStages?.lightSleepMinutes ?? NaN,
        deepSleepMinutes: fitbit.sleepStages?.deepSleepMinutes ?? NaN,
        remSleepMinutes: fitbit.sleepStages?.remSleepMinutes ?? NaN,
        awakeMinutes: fitbit.sleepStages?.awakeMinutes ?? NaN,
        sleepEfficiency: fitbit.sleepStages?.sleepEfficiency ?? NaN, // total sleep / time in bed
        remFragmentation: fitbit.sleepStages?.remFragmentation ?? NaN, // number of separate REM periods
        onsetLatencyMin: fitbit.sleepStages?.onsetLatencyMin ?? NaN, // minutes to fall asleep
      },

      breathing: {
        avgRatePerMin: fitbit.breathing?.avgRatePerMin ?? NaN, // average respiratory rate
        variabilityCoeff: fitbit.breathing?.variabilityCoeff ?? NaN, // RR coefficient of variation
        confidence: fitbit.breathing?.confidence || FITBIT_CONFIDENCE_LOW, // Fitbit's confidence in RR estimate
      },
    },

    // Derived correlations (computed)
    correlations: {
      ahiSpO2Correlation: correlations.ahiSpO2Correlation || NaN, // nightly event-SpO2 correlation
      pressureHrvLag: correlations.pressureHrvLag || NaN, // minutes lag for pressure-HRV response
      eventHrResponse: correlations.eventHrResponse || NaN, // HR elevation during events (bpm)
      recoveryTimeSeconds: correlations.recoveryTimeSeconds || NaN, // median HR recovery post-event
      sleepStageAhi: {
        // AHI by sleep stage
        light: correlations.sleepStageAhi?.light || NaN,
        deep: correlations.sleepStageAhi?.deep || NaN,
        rem: correlations.sleepStageAhi?.rem || NaN,
      },
    },

    // Quality flags
    dataQuality: {
      oscarDataComplete: dataQuality.oscarDataComplete ?? false, // no gaps in CPAP data
      fitbitDataComplete: dataQuality.fitbitDataComplete ?? false, // no gaps in Fitbit data
      suspiciousValues: dataQuality.suspiciousValues || [], // array of potential data issues
      anomalyScore: dataQuality.anomalyScore || 0, // 0-1, higher = more anomalous
      excluded: dataQuality.excluded ?? false, // exclude from analysis
      excludeReason: dataQuality.excludeReason || null, // reason for exclusion
      imputedFields: dataQuality.imputedFields || [], // list of fields filled via imputation
    },
  };
}

/**
 * Validates a complete nightly record for data quality issues.
 *
 * @param {NightlyRecord} record - Complete nightly record
 * @returns {{ valid: boolean, issues: string[], dataQuality: number }} Validation results
 */
export function validateNightlyRecord(record) {
  const issues = [];

  // OSCAR data validation
  if (Number.isFinite(record.oscar.ahi)) {
    if (record.oscar.ahi < 0 || record.oscar.ahi > 150) {
      issues.push(
        `Implausible AHI: ${record.oscar.ahi} events/hour (expected 0-150)`,
      );
    }
  }

  if (Number.isFinite(record.oscar.pressures.epap)) {
    if (record.oscar.pressures.epap < 4 || record.oscar.pressures.epap > 25) {
      issues.push(
        `Implausible EPAP: ${record.oscar.pressures.epap} cmH2O (expected 4-25)`,
      );
    }
  }

  // Fitbit heart rate validation
  if (Number.isFinite(record.fitbit.heartRate.avgSleepBpm)) {
    if (
      record.fitbit.heartRate.avgSleepBpm < HR_SLEEP_MIN ||
      record.fitbit.heartRate.avgSleepBpm > HR_ABSOLUTE_MAX
    ) {
      issues.push(
        `Implausible sleep HR: ${record.fitbit.heartRate.avgSleepBpm} bpm (expected ${HR_SLEEP_MIN}-${HR_ABSOLUTE_MAX})`,
      );
    }
  }

  if (Number.isFinite(record.fitbit.heartRate.restingBpm)) {
    if (
      record.fitbit.heartRate.restingBpm < HR_RESTING_MIN ||
      record.fitbit.heartRate.restingBpm > HR_RESTING_MAX
    ) {
      issues.push(
        `Implausible resting HR: ${record.fitbit.heartRate.restingBpm} bpm (expected ${HR_RESTING_MIN}-${HR_RESTING_MAX})`,
      );
    }
  }

  // SpO2 validation
  if (Number.isFinite(record.fitbit.oxygenSaturation.minPercent)) {
    if (record.fitbit.oxygenSaturation.minPercent < SPO2_CRITICAL_MIN) {
      issues.push(
        `Dangerously low SpO2: ${record.fitbit.oxygenSaturation.minPercent}% (below ${SPO2_CRITICAL_MIN}%)`,
      );
    }
    if (record.fitbit.oxygenSaturation.minPercent > SPO2_NORMAL_MAX) {
      issues.push(
        `Implausible high SpO2: ${record.fitbit.oxygenSaturation.minPercent}% (above ${SPO2_NORMAL_MAX}%)`,
      );
    }
  }

  // HRV validation
  if (Number.isFinite(record.fitbit.heartRate.hrv.rmssd)) {
    if (
      record.fitbit.heartRate.hrv.rmssd < HRV_ABSOLUTE_MIN ||
      record.fitbit.heartRate.hrv.rmssd > HRV_ABSOLUTE_MAX
    ) {
      issues.push(
        `Implausible HRV: ${record.fitbit.heartRate.hrv.rmssd}ms (expected ${HRV_ABSOLUTE_MIN}-${HRV_ABSOLUTE_MAX}ms)`,
      );
    }
  }

  // Sleep architecture validation
  if (Number.isFinite(record.fitbit.sleepStages.sleepEfficiency)) {
    if (
      record.fitbit.sleepStages.sleepEfficiency < 0 ||
      record.fitbit.sleepStages.sleepEfficiency > 100
    ) {
      issues.push(
        `Implausible sleep efficiency: ${record.fitbit.sleepStages.sleepEfficiency}% (expected 0-100%)`,
      );
    }
  }

  // Sleep duration validation
  const totalSleepHours = record.fitbit.sleepStages.totalSleepMinutes / 60;
  if (Number.isFinite(totalSleepHours)) {
    if (
      totalSleepHours < SLEEP_DURATION_MIN ||
      totalSleepHours > SLEEP_DURATION_MAX
    ) {
      issues.push(
        `Implausible sleep duration: ${totalSleepHours.toFixed(1)}h (expected ${SLEEP_DURATION_MIN}-${SLEEP_DURATION_MAX}h)`,
      );
    }
  }

  // Cross-field consistency validation
  if (record.oscar.ahi === 0 && record.oscar.usage.totalMinutes === 0) {
    issues.push('Zero AHI with zero usage - possible non-therapy night');
  }

  const totalSleep = record.fitbit.sleepStages.totalSleepMinutes;
  const oscarUsage = record.oscar.usage.totalMinutes;
  if (Number.isFinite(totalSleep) && Number.isFinite(oscarUsage)) {
    if (Math.abs(totalSleep - oscarUsage) > 120) {
      // >2hr difference
      issues.push(
        `Sleep duration mismatch: Fitbit ${totalSleep}min vs OSCAR ${oscarUsage}min (>${120}min difference)`,
      );
    }
  }

  // Respiratory rate validation
  if (Number.isFinite(record.fitbit.breathing.avgRatePerMin)) {
    if (
      record.fitbit.breathing.avgRatePerMin < RESP_RATE_MIN ||
      record.fitbit.breathing.avgRatePerMin > RESP_RATE_MAX
    ) {
      issues.push(
        `Implausible respiratory rate: ${record.fitbit.breathing.avgRatePerMin} breaths/min (expected ${RESP_RATE_MIN}-${RESP_RATE_MAX})`,
      );
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    dataQuality: Math.max(0, 1 - issues.length / 10), // normalize to 0-1 quality score
  };
}

/**
 * Checks if a nightly record has sufficient data for correlation analysis.
 *
 * @param {NightlyRecord} record - Nightly record to check
 * @returns {{ sufficient: boolean, missing: string[] }} Sufficiency assessment
 */
export function checkDataSufficiency(record) {
  const missing = [];

  // Required OSCAR fields
  if (!Number.isFinite(record.oscar.ahi)) missing.push('OSCAR AHI');
  if (!Number.isFinite(record.oscar.usage.totalMinutes))
    missing.push('OSCAR usage duration');

  // Required Fitbit fields for basic correlation
  if (!Number.isFinite(record.fitbit.heartRate.avgSleepBpm))
    missing.push('Fitbit sleep heart rate');
  if (!Number.isFinite(record.fitbit.sleepStages.totalSleepMinutes))
    missing.push('Fitbit sleep duration');

  // Warn about optional but valuable fields
  const optional = [];
  if (!Number.isFinite(record.fitbit.heartRate.hrv.rmssd))
    optional.push('HRV (advanced correlation)');
  if (!Number.isFinite(record.fitbit.oxygenSaturation.minPercent))
    optional.push('SpO2 (oxygen correlation)');

  return {
    sufficient: missing.length === 0,
    missing,
    optional,
  };
}

/**
 * Converts raw Fitbit API response to standardized nightly record.
 *
 * @param {Object} fitbitData - Raw Fitbit API response
 * @param {string} date - Sleep date (YYYY-MM-DD)
 * @returns {Object} Standardized fitbit portion of nightly record
 */
export function normalizeFitbitData(fitbitData) {
  const {
    heartRate = {},
    hrv = {},
    sleep = {},
    spo2 = {},
    breathing = {},
  } = fitbitData;

  return {
    heartRate: {
      restingBpm: heartRate.restingHeartRate || NaN,
      avgSleepBpm: sleep.averageHeartRate || NaN,
      minSleepBpm: sleep.minHeartRate || NaN,
      maxSleepBpm: sleep.maxHeartRate || NaN,
      hrv: {
        rmssd: hrv.dailyRmssd || NaN,
        lfHf: hrv.lfHfRatio || NaN,
        confidence: hrv.confidence || FITBIT_CONFIDENCE_LOW,
      },
    },

    oxygenSaturation: {
      minPercent: spo2.min || NaN,
      avgPercent: spo2.avg || NaN,
      variabilityCoeff: spo2.variabilityCoeff || NaN,
      odiEstimate: spo2.odiEstimate || NaN,
      measurementMinutes: spo2.measurementMinutes || NaN,
    },

    sleepStages: {
      totalSleepMinutes: sleep.totalSleepRecords || NaN,
      lightSleepMinutes: sleep.levels?.summary?.light?.minutes || NaN,
      deepSleepMinutes: sleep.levels?.summary?.deep?.minutes || NaN,
      remSleepMinutes: sleep.levels?.summary?.rem?.minutes || NaN,
      awakeMinutes: sleep.levels?.summary?.wake?.minutes || NaN,
      sleepEfficiency: sleep.efficiency || NaN,
      remFragmentation: sleep.remFragmentation || NaN,
      onsetLatencyMin: sleep.minutesToFallAsleep || NaN,
    },

    breathing: {
      avgRatePerMin: breathing.averageBreathingRate || NaN,
      variabilityCoeff: breathing.breathingRateVariabilityCoeff || NaN,
      confidence: breathing.confidence || FITBIT_CONFIDENCE_LOW,
    },
  };
}
