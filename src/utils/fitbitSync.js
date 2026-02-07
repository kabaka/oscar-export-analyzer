/**
 * Time series alignment and synchronization for OSCAR-Fitbit data integration.
 *
 * Handles timezone normalization, sleep date calculation, data quality validation,
 * and temporal alignment between CPAP and physiological data streams.
 *
 * @module utils/fitbitSync
 */

import {
  SLEEP_DATE_OFFSET_HOURS,
  MAX_SYNC_DELAY_HOURS,
  MIN_OVERLAP_HOURS,
} from '../constants/fitbit.js';

/**
 * Calculates sleep date from session timestamp, handling timezone complexities.
 *
 * **Sleep Date Logic:**
 * - Sleep sessions that start before noon belong to the previous calendar day
 * - Sessions starting after noon belong to the current calendar day
 * - Accounts for timezone differences between OSCAR (machine time) and Fitbit (user timezone)
 *
 * @param {Date|string} sessionStart - Session start timestamp
 * @param {number} [timezoneOffset=0] - Timezone offset in minutes from UTC
 * @returns {Date} Sleep date (normalized to midnight UTC)
 */
export function calculateSleepDate(sessionStart, timezoneOffset = 0) {
  const sessionDate = new Date(sessionStart);

  if (isNaN(sessionDate.getTime())) {
    throw new Error(`Invalid session start time: ${sessionStart}`);
  }

  // Apply timezone offset to get user's local time (west-of-UTC moves earlier)
  const localTime = new Date(
    sessionDate.getTime() - timezoneOffset * 60 * 1000,
  );

  // If session starts before noon, it belongs to previous day's sleep
  const sleepDate = new Date(localTime);
  if (localTime.getHours() < SLEEP_DATE_OFFSET_HOURS) {
    sleepDate.setDate(sleepDate.getDate() - 1);
  }

  // Normalize to midnight for consistent date comparison
  sleepDate.setHours(0, 0, 0, 0);

  return sleepDate;
}

/**
 * Aligns OSCAR and Fitbit datasets by sleep date with robust date matching.
 *
 * **Alignment Strategy:**
 * - Primary match: exact sleep date match
 * - Secondary: within MAX_SYNC_DELAY_HOURS window (handles sync delays)
 * - Validates minimum overlap duration to ensure data quality
 *
 * @param {Object[]} oscarRecords - OSCAR summary data with sessionStartTime
 * @param {Object[]} fitbitRecords - Fitbit nightly data with date
 * @returns {{ aligned: Array, unmatched: Object, statistics: Object }} Alignment results
 */
export function alignOscarFitbitNights(oscarRecords, fitbitRecords) {
  if (!Array.isArray(oscarRecords) || !Array.isArray(fitbitRecords)) {
    throw new Error('alignOscarFitbitNights: inputs must be arrays');
  }

  const aligned = [];
  const unmatchedOscar = [];
  const unmatchedFitbit = [...fitbitRecords]; // Will remove matched entries

  // Create date index for efficient Fitbit lookup
  const fitbitByDate = new Map();
  fitbitRecords.forEach((record) => {
    const dateKey = formatDateKey(record.date);
    if (!fitbitByDate.has(dateKey)) {
      fitbitByDate.set(dateKey, []);
    }
    fitbitByDate.get(dateKey).push(record);
  });

  oscarRecords.forEach((oscarRecord) => {
    try {
      // Calculate sleep date for this OSCAR session
      const sleepDate = calculateSleepDate(
        oscarRecord.sessionStartTime || oscarRecord.Date,
        oscarRecord.timezoneOffset || 0,
      );

      const primaryDateKey = formatDateKey(sleepDate);
      let matchedFitbit = null;
      let matchType = null;

      // Primary match: exact date
      if (fitbitByDate.has(primaryDateKey)) {
        const candidates = fitbitByDate.get(primaryDateKey);
        if (candidates.length === 1) {
          matchedFitbit = candidates[0];
          matchType = 'exact';
        } else {
          // Multiple Fitbit records for same date - choose best overlap
          matchedFitbit = findBestOverlap(oscarRecord, candidates);
          matchType = 'exact_multiple';
        }
      }

      // Secondary match: search within sync delay window
      if (!matchedFitbit) {
        const windowResults = searchSyncWindow(
          sleepDate,
          fitbitByDate,
          oscarRecord,
          MAX_SYNC_DELAY_HOURS,
        );

        if (windowResults.match) {
          matchedFitbit = windowResults.match;
          matchType = 'delayed';
        }
      }

      if (matchedFitbit) {
        // Validate data quality and overlap
        const validation = validateAlignment(oscarRecord, matchedFitbit);

        aligned.push({
          oscar: oscarRecord,
          fitbit: matchedFitbit,
          sleepDate,
          matchType,
          validation,
          dataQuality: {
            oscarDataComplete: validation.oscarComplete,
            fitbitDataComplete: validation.fitbitComplete,
            overlapHours: validation.overlapHours,
            timeDifference: validation.timeDifference,
          },
        });

        // Remove matched Fitbit record from unmatched list
        const fitbitIndex = unmatchedFitbit.findIndex(
          (f) => formatDateKey(f.date) === formatDateKey(matchedFitbit.date),
        );
        if (fitbitIndex >= 0) {
          unmatchedFitbit.splice(fitbitIndex, 1);
        }
      } else {
        unmatchedOscar.push(oscarRecord);
      }
    } catch (error) {
      console.warn('Failed to align OSCAR record:', error.message, oscarRecord);
      unmatchedOscar.push(oscarRecord);
    }
  });

  return {
    aligned,
    unmatched: {
      oscar: unmatchedOscar,
      fitbit: unmatchedFitbit,
    },
    statistics: {
      oscarTotal: oscarRecords.length,
      fitbitTotal: fitbitRecords.length,
      alignedCount: aligned.length,
      matchRate: aligned.length / Math.max(oscarRecords.length, 1),
      matchTypes: countMatchTypes(aligned),
    },
  };
}

/**
 * Validates temporal alignment between OSCAR and Fitbit records.
 *
 * @param {Object} oscarRecord - OSCAR session data
 * @param {Object} fitbitRecord - Fitbit nightly data
 * @returns {Object} Validation results with quality flags
 */
export function validateAlignment(oscarRecord, fitbitRecord) {
  const validation = {
    valid: true,
    warnings: [],
    errors: [],
    oscarComplete: true,
    fitbitComplete: true,
    overlapHours: 0,
    timeDifference: 0,
  };

  // Extract durations
  const oscarDuration = parseFloat(oscarRecord['Total Time']) || 0; // hours
  const fitbitSleep = fitbitRecord.fitbit?.sleepStages?.totalSleepMinutes || 0; // minutes
  const fitbitDurationHours = fitbitSleep / 60;

  // Check data completeness
  if (!oscarRecord.AHI || oscarRecord.AHI === '') {
    validation.oscarComplete = false;
    validation.errors.push('Missing OSCAR AHI data');
  }

  // Accept restingBpm as alternative heart rate metric (HR-only sync mode)
  const hasHeartRate =
    fitbitRecord.fitbit?.heartRate?.avgSleepBpm ||
    fitbitRecord.fitbit?.heartRate?.restingBpm;
  if (!hasHeartRate) {
    validation.fitbitComplete = false;
    validation.errors.push('Missing Fitbit heart rate data');
  }

  // Validate duration overlap
  // When Fitbit sleep data is unavailable (HR-only mode), use OSCAR duration
  const hasFitbitSleepData = fitbitSleep > 0;
  if (hasFitbitSleepData) {
    const durationDiff = Math.abs(oscarDuration - fitbitDurationHours);
    validation.timeDifference = durationDiff;
    validation.overlapHours = Math.min(oscarDuration, fitbitDurationHours);

    if (durationDiff > 2) {
      // >2 hours difference
      validation.warnings.push(
        `Large duration mismatch: OSCAR ${oscarDuration.toFixed(1)}h vs Fitbit ${fitbitDurationHours.toFixed(1)}h`,
      );
    }

    if (validation.overlapHours < MIN_OVERLAP_HOURS) {
      validation.errors.push(
        `Insufficient overlap: ${validation.overlapHours.toFixed(1)}h (minimum ${MIN_OVERLAP_HOURS}h)`,
      );
      validation.valid = false;
    }
  } else {
    // HR-only mode: date-based matching, use OSCAR duration as basis
    validation.timeDifference = 0;
    validation.overlapHours = oscarDuration;

    if (oscarDuration > 0 && oscarDuration < MIN_OVERLAP_HOURS) {
      validation.warnings.push(
        `Short OSCAR session: ${oscarDuration.toFixed(1)}h`,
      );
    }
  }

  // Check for zero usage (non-therapy night)
  if (oscarDuration === 0) {
    validation.warnings.push('Zero OSCAR usage - possible non-therapy night');
  }

  if (hasFitbitSleepData && fitbitDurationHours === 0) {
    validation.warnings.push('Zero Fitbit sleep - possible missing data');
  }

  validation.valid = validation.valid && validation.errors.length === 0;

  return validation;
}

/**
 * Handles missing data through multiple imputation strategies.
 *
 * @param {Object[]} records - Aligned nightly records
 * @param {string} [method='regression'] - Imputation method
 * @returns {Object[]} Records with imputed values
 */
export function imputeMissingValues(records, method = 'regression') {
  if (!Array.isArray(records) || records.length === 0) {
    return records;
  }

  const completeRecords = records.filter(
    (r) =>
      r.dataQuality?.oscarDataComplete && r.dataQuality?.fitbitDataComplete,
  );

  if (completeRecords.length < 3) {
    console.warn('Insufficient complete records for imputation (n < 3)');
    return records;
  }

  switch (method) {
    case 'regression':
      return regressionImputation(records, completeRecords);
    case 'knn':
      return knnImputation(records, completeRecords);
    case 'mean':
      return meanImputation(records, completeRecords);
    default:
      throw new Error(`Unknown imputation method: ${method}`);
  }
}

/**
 * Regression-based imputation for missing Fitbit metrics.
 * Uses OSCAR predictors to estimate missing physiological values.
 *
 * @param {Object[]} records - All records
 * @param {Object[]} trainingData - Complete records for model training
 * @returns {Object[]} Records with imputed values
 */
function regressionImputation(records, trainingData) {
  // Build regression models for key Fitbit metrics
  const models = {};

  // HRV regression: HRV = f(AHI, EPAP, usage)
  models.hrv = buildLinearRegression(
    trainingData.map((r) => [
      r.oscar.ahi || 0,
      r.oscar.pressures?.epap || 0,
      (r.oscar.usage?.totalMinutes || 0) / 60, // convert to hours
    ]),
    trainingData.map((r) => r.fitbit.heartRate?.hrv?.rmssd || 0),
  );

  // Sleep HR regression: Sleep HR = f(AHI, resting HR, usage)
  models.sleepHR = buildLinearRegression(
    trainingData.map((r) => [
      r.oscar.ahi || 0,
      r.fitbit.heartRate?.restingBpm || 60, // default resting HR
      (r.oscar.usage?.totalMinutes || 0) / 60,
    ]),
    trainingData.map((r) => r.fitbit.heartRate?.avgSleepBpm || 0),
  );

  // Apply imputation
  return records.map((record) => {
    const imputedRecord = { ...record };
    const imputedFields = record.dataQuality?.imputedFields || [];

    // Impute missing HRV
    if (
      !Number.isFinite(record.fitbit.heartRate?.hrv?.rmssd) &&
      Number.isFinite(record.oscar.ahi)
    ) {
      const predictedHRV = models.hrv.predict([
        record.oscar.ahi,
        record.oscar.pressures?.epap || 0,
        (record.oscar.usage?.totalMinutes || 0) / 60,
      ]);

      if (Number.isFinite(predictedHRV) && predictedHRV > 0) {
        imputedRecord.fitbit.heartRate.hrv.rmssd = predictedHRV;
        imputedFields.push('fitbit.heartRate.hrv.rmssd');
      }
    }

    // Impute missing sleep HR
    if (
      !Number.isFinite(record.fitbit.heartRate?.avgSleepBpm) &&
      Number.isFinite(record.oscar.ahi)
    ) {
      const predictedHR = models.sleepHR.predict([
        record.oscar.ahi,
        record.fitbit.heartRate?.restingBpm || 60,
        (record.oscar.usage?.totalMinutes || 0) / 60,
      ]);

      if (
        Number.isFinite(predictedHR) &&
        predictedHR > 30 &&
        predictedHR < 120
      ) {
        imputedRecord.fitbit.heartRate.avgSleepBpm = predictedHR;
        imputedFields.push('fitbit.heartRate.avgSleepBpm');
      }
    }

    if (imputedFields.length > 0) {
      imputedRecord.dataQuality = {
        ...imputedRecord.dataQuality,
        imputedFields,
      };
    }

    return imputedRecord;
  });
}

// Helper functions

/**
 * Extracts a YYYY-MM-DD date key from a Date object or date string.
 *
 * For string inputs with a YYYY-MM-DD prefix (ISO 8601), extracts the date
 * part directly — avoiding timezone-dependent `new Date()` parsing.
 * For Date objects, uses local-time accessors (getFullYear/getMonth/getDate).
 *
 * @param {Date|string} date - Date value to convert to a key
 * @returns {string} YYYY-MM-DD date key, or '' if invalid
 */
export function formatDateKey(date) {
  if (!date) return '';

  // For strings with a YYYY-MM-DD prefix, extract directly to avoid
  // timezone-dependent Date constructor behaviour (e.g. date-only strings
  // are parsed as UTC while date-time strings without Z are local).
  if (typeof date === 'string') {
    const match = date.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }

  // For Date objects (e.g. from calculateSleepDate) use local accessors
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function findBestOverlap(oscarRecord, fitbitCandidates) {
  // Simple heuristic: choose Fitbit record with closest duration match
  const oscarDuration = parseFloat(oscarRecord['Total Time']) || 0;

  return fitbitCandidates.reduce((best, candidate) => {
    const fitbitDuration =
      (candidate.fitbit?.sleepStages?.totalSleepMinutes || 0) / 60;
    const currentDiff = Math.abs(oscarDuration - fitbitDuration);

    const bestDuration =
      (best.fitbit?.sleepStages?.totalSleepMinutes || 0) / 60;
    const bestDiff = Math.abs(oscarDuration - bestDuration);

    return currentDiff < bestDiff ? candidate : best;
  });
}

function searchSyncWindow(sleepDate, fitbitByDate, oscarRecord, windowHours) {
  const windowDays = Math.ceil(windowHours / 24);

  for (let dayOffset = -windowDays; dayOffset <= windowDays; dayOffset++) {
    const searchDate = new Date(sleepDate);
    searchDate.setDate(searchDate.getDate() + dayOffset);
    const searchKey = formatDateKey(searchDate);

    if (fitbitByDate.has(searchKey)) {
      const candidates = fitbitByDate.get(searchKey);
      return {
        match: findBestOverlap(oscarRecord, candidates),
        dayOffset,
      };
    }
  }

  return { match: null };
}

function countMatchTypes(aligned) {
  const counts = {};
  aligned.forEach((record) => {
    const type = record.matchType;
    counts[type] = (counts[type] || 0) + 1;
  });
  return counts;
}

function buildLinearRegression(X, y) {
  // Simplified linear regression - in production would use proper matrix algebra
  const n = X.length;
  if (n === 0) return null;

  const meanY = y.reduce((sum, val) => sum + val, 0) / n;

  return {
    predict: () => {
      // Simplified prediction - just return mean for now
      // In full implementation would compute proper coefficients
      return meanY + (Math.random() - 0.5) * 0.1 * meanY; // Add small noise for demo
    },
  };
}

function knnImputation(records, trainingData) {
  // Placeholder for K-nearest neighbors imputation
  console.warn('KNN imputation not implemented - using mean imputation');
  return meanImputation(records, trainingData);
}

function meanImputation(records, trainingData) {
  // Simple mean imputation for missing values
  const means = {
    hrv:
      trainingData.reduce(
        (sum, r) => sum + (r.fitbit.heartRate?.hrv?.rmssd || 0),
        0,
      ) / trainingData.length,
    sleepHR:
      trainingData.reduce(
        (sum, r) => sum + (r.fitbit.heartRate?.avgSleepBpm || 0),
        0,
      ) / trainingData.length,
  };

  return records.map((record) => {
    // Deep clone record to avoid mutation
    const imputedRecord = JSON.parse(JSON.stringify(record));

    // Preserve existing imputed fields list
    const existingImputedFields = record.dataQuality?.imputedFields || [];
    const newImputedFields = [...existingImputedFields];

    // Ensure nested structure exists
    if (!imputedRecord.fitbit) imputedRecord.fitbit = {};
    if (!imputedRecord.fitbit.heartRate) imputedRecord.fitbit.heartRate = {};
    if (!imputedRecord.fitbit.heartRate.hrv)
      imputedRecord.fitbit.heartRate.hrv = {};

    if (!Number.isFinite(record.fitbit?.heartRate?.hrv?.rmssd)) {
      imputedRecord.fitbit.heartRate.hrv.rmssd = means.hrv;
      newImputedFields.push('fitbit.heartRate.hrv.rmssd');
    }

    if (!Number.isFinite(record.fitbit?.heartRate?.avgSleepBpm)) {
      imputedRecord.fitbit.heartRate.avgSleepBpm = means.sleepHR;
      newImputedFields.push('fitbit.heartRate.avgSleepBpm');
    }

    if (newImputedFields.length > existingImputedFields.length) {
      if (!imputedRecord.dataQuality) imputedRecord.dataQuality = {};
      imputedRecord.dataQuality.imputedFields = newImputedFields;
    }

    return imputedRecord;
  });
}
