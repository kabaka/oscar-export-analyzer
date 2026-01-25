/**
 * Synthetic Fitbit data builders for comprehensive testing.
 *
 * Generates realistic physiological data for Fitbit integration tests.
 * All data is SYNTHETIC and medically plausible - never use real patient data.
 *
 * @module test-utils/fitbitBuilders
 */

import {
  HR_SLEEP_MIN,
  HR_SLEEP_MAX,
  SPO2_NORMAL_MIN,
  HRV_SLEEP_APNEA_TYPICAL,
  FITBIT_CONFIDENCE_HIGH,
  FITBIT_CONFIDENCE_MEDIUM,
  FITBIT_CONFIDENCE_LOW,
} from '../constants/fitbit.js';

/**
 * Generate synthetic Fitbit heart rate data with realistic patterns.
 *
 * Simulates heart rate variability, sleep patterns, and correlation with apnea events.
 * Includes realistic HRV values and confidence scoring.
 *
 * @param {Object} options - Configuration options
 * @param {string} options.date - Start date (YYYY-MM-DD)
 * @param {number} options.nights - Number of nights to generate (default 1)
 * @param {number} options.baseRestingBpm - Baseline resting heart rate (default 65)
 * @param {string} options.sleepPattern - Sleep HR pattern: 'normal', 'tachycardia', 'bradycardia' (default 'normal')
 * @param {string} options.apneaCorrelation - Correlation with apnea: 'none', 'weak', 'moderate', 'strong' (default 'moderate')
 * @param {string} options.dataQuality - Data completeness: 'high', 'medium', 'low' (default 'high')
 * @param {number} options.seed - Random seed for reproducible tests
 * @returns {Array<Object>} Heart rate data objects
 */
export function buildFitbitHeartRateData({
  date = '2026-01-24',
  nights = 1,
  baseRestingBpm = 65,
  sleepPattern = 'normal',
  apneaCorrelation = 'moderate',
  dataQuality = 'high',
  seed = Math.random(),
} = {}) {
  let rngState = seed;
  const seededRandom = () => {
    rngState = (rngState * 9301 + 49297) % 233280;
    return rngState / 233280;
  };

  // Pattern-specific HR adjustments
  const patterns = {
    normal: { restingMultiplier: 1.0, sleepReduction: 0.85, maxVariation: 15 },
    tachycardia: {
      restingMultiplier: 1.3,
      sleepReduction: 0.9,
      maxVariation: 25,
    },
    bradycardia: {
      restingMultiplier: 0.8,
      sleepReduction: 0.75,
      maxVariation: 10,
    },
  };

  const pattern = patterns[sleepPattern];
  const adjustedResting = Math.round(
    baseRestingBpm * pattern.restingMultiplier,
  );

  // Apnea correlation factors
  const correlationFactors = {
    none: 0,
    weak: 0.2,
    moderate: 0.5,
    strong: 0.8,
  };
  const correlationFactor = correlationFactors[apneaCorrelation];

  // Data quality affects measurement gaps
  const qualityFactors = {
    high: { gapProbability: 0.02, noiseLevel: 0.1 },
    medium: { gapProbability: 0.08, noiseLevel: 0.2 },
    low: { gapProbability: 0.2, noiseLevel: 0.4 },
  };
  const qualityFactor = qualityFactors[dataQuality];

  const heartRateData = [];
  const startDate = new Date(date);

  for (let night = 0; night < nights; night++) {
    const nightDate = new Date(startDate);
    nightDate.setDate(nightDate.getDate() + night);

    // Skip night if data quality creates gap
    if (seededRandom() < qualityFactor.gapProbability) {
      continue; // Simulate missing night data
    }

    // Base sleep HR with pattern variation
    const baseSleepBpm = Math.round(adjustedResting * pattern.sleepReduction);
    const hrVariation = pattern.maxVariation * (seededRandom() - 0.5) * 2;
    const avgSleepBpm = Math.max(
      HR_SLEEP_MIN,
      Math.min(HR_SLEEP_MAX, baseSleepBpm + hrVariation),
    );

    // Simulate apnea-related HR elevation
    const apneaSeverity = seededRandom() * correlationFactor;
    const apneaHrElevation = apneaSeverity * 20; // 0-16 BPM elevation during events

    const minSleepBpm = Math.max(
      HR_SLEEP_MIN,
      avgSleepBpm - 15 + (seededRandom() - 0.5) * 5,
    );
    const maxSleepBpm = Math.min(
      HR_SLEEP_MAX,
      avgSleepBpm + 25 + apneaHrElevation + (seededRandom() - 0.5) * 10,
    );

    // HRV calculation (inversely related to apnea severity and age)
    const baseHrv = HRV_SLEEP_APNEA_TYPICAL * (1.2 - apneaSeverity * 0.8); // Lower HRV with more apnea
    const hrvVariation = baseHrv * 0.3 * (seededRandom() - 0.5) * 2;
    const rmssd = Math.max(15, Math.min(80, baseHrv + hrvVariation));

    // LF/HF ratio (higher with sympathetic dominance from apnea)
    const baseLfHf = 1.5 + apneaSeverity * 2.0; // Normal ~1.5, elevated with apnea
    const lfHf = Math.max(
      0.5,
      Math.min(6.0, baseLfHf + (seededRandom() - 0.5) * 0.8),
    );

    // Confidence based on data quality and measurement consistency
    const measurementNoise = qualityFactor.noiseLevel;
    let confidence = FITBIT_CONFIDENCE_HIGH;
    if (
      measurementNoise > 0.15 ||
      Math.abs(hrVariation) > pattern.maxVariation * 0.7
    ) {
      confidence = FITBIT_CONFIDENCE_MEDIUM;
    }
    if (
      measurementNoise > 0.35 ||
      Math.abs(hrVariation) > pattern.maxVariation
    ) {
      confidence = FITBIT_CONFIDENCE_LOW;
    }

    heartRateData.push({
      date: nightDate.toISOString().slice(0, 10), // YYYY-MM-DD format
      timestamp: nightDate.getTime(),
      heartRate: {
        restingBpm: Math.round(adjustedResting + (seededRandom() - 0.5) * 6), // Daily resting variation
        avgSleepBpm: Math.round(avgSleepBpm),
        minSleepBpm: Math.round(minSleepBpm),
        maxSleepBpm: Math.round(maxSleepBpm),
        hrv: {
          rmssd: Math.round(rmssd * 10) / 10, // One decimal place
          lfHf: Math.round(lfHf * 100) / 100, // Two decimal places
          confidence,
        },
      },
      dataQuality: {
        measurementMinutes: Math.round(420 + (seededRandom() - 0.5) * 60), // ~7 hours ± 30 min
        gapCount: Math.floor(
          seededRandom() * 3 * qualityFactor.gapProbability * 10,
        ), // 0-2 gaps for high quality
        noiseLevel: measurementNoise,
      },
    });
  }

  return heartRateData;
}

/**
 * Generate synthetic Fitbit SpO2 data with desaturation events.
 *
 * Simulates oxygen saturation patterns correlated with sleep apnea severity.
 * Includes ODI (Oxygen Desaturation Index) calculation and measurement gaps.
 *
 * @param {Object} options - Configuration options
 * @param {string} options.date - Start date (YYYY-MM-DD)
 * @param {number} options.nights - Number of nights to generate (default 1)
 * @param {number} options.baselinePercent - Baseline SpO2 percentage (default 95)
 * @param {number} options.desaturationEvents - Desaturation events per hour (ODI, default 8)
 * @param {string} options.severityPattern - Severity: 'normal', 'mild', 'moderate', 'severe' (default 'mild')
 * @param {boolean} options.measurementGaps - Include sensor measurement gaps (default false)
 * @param {number} options.seed - Random seed for reproducible tests
 * @returns {Array<Object>} SpO2 data objects
 */
export function buildFitbitSpO2Data({
  date = '2026-01-24',
  nights = 1,
  baselinePercent = 95,
  desaturationEvents = 8,
  severityPattern = 'mild',
  measurementGaps = false,
  seed = Math.random(),
} = {}) {
  let rngState = seed;
  const seededRandom = () => {
    rngState = (rngState * 9301 + 49297) % 233280;
    return rngState / 233280;
  };

  // Severity patterns affect desaturation depth and duration
  const severityProfiles = {
    normal: { minDropPercent: 2, maxDropPercent: 4, avgDurationSec: 15 },
    mild: { minDropPercent: 3, maxDropPercent: 6, avgDurationSec: 25 },
    moderate: { minDropPercent: 4, maxDropPercent: 8, avgDurationSec: 35 },
    severe: { minDropPercent: 6, maxDropPercent: 12, avgDurationSec: 45 },
  };

  const profile = severityProfiles[severityPattern];
  const startDate = new Date(date);
  const spo2Data = [];

  for (let night = 0; night < nights; night++) {
    const nightDate = new Date(startDate);
    nightDate.setDate(nightDate.getDate() + night);

    // Skip night if measurement gaps are severe
    if (measurementGaps && seededRandom() < 0.15) {
      continue; // Simulate night with insufficient SpO2 data
    }

    // Calculate minimum SpO2 based on desaturation events
    const avgDropPercent =
      (profile.minDropPercent + profile.maxDropPercent) / 2;
    const randomVariation = (seededRandom() - 0.5) * 4; // ±2% random variation
    const minPercent = Math.max(
      SPO2_NORMAL_MIN - 15, // Don't go below danger threshold
      baselinePercent - avgDropPercent - randomVariation,
    );

    // Average SpO2 slightly lower than baseline due to events
    const eventImpact = Math.min(2, desaturationEvents * 0.1); // Max 2% impact from events
    const avgPercent = Math.max(
      SPO2_NORMAL_MIN,
      baselinePercent - eventImpact + (seededRandom() - 0.5) * 2,
    );

    // Variability coefficient increases with more events
    const baseVariability = 0.02; // 2% for normal breathing
    const eventVariability = desaturationEvents * 0.001; // Additional variability from events
    const variabilityCoeff =
      baseVariability + eventVariability + (seededRandom() - 0.5) * 0.01;

    // Measurement duration affected by sensor gaps
    let measurementMinutes = 420; // Default ~7 hours
    if (measurementGaps) {
      const gapFactor = 0.7 + seededRandom() * 0.25; // 70-95% coverage
      measurementMinutes = Math.round(measurementMinutes * gapFactor);
    }

    // ODI estimate based on configured events per hour
    const odiVariation = (seededRandom() - 0.5) * 4; // ±2 events variation
    const odiEstimate = Math.max(0, desaturationEvents + odiVariation);

    spo2Data.push({
      date: nightDate.toISOString().slice(0, 10),
      timestamp: nightDate.getTime(),
      oxygenSaturation: {
        minPercent: Math.round(minPercent * 10) / 10, // One decimal place
        avgPercent: Math.round(avgPercent * 10) / 10,
        variabilityCoeff: Math.round(variabilityCoeff * 1000) / 1000, // Three decimal places
        odiEstimate: Math.round(odiEstimate * 10) / 10,
        measurementMinutes,
      },
      dataQuality: {
        sensorGaps: measurementGaps,
        confidenceScore:
          measurementMinutes > 300
            ? FITBIT_CONFIDENCE_HIGH
            : measurementMinutes > 180
              ? FITBIT_CONFIDENCE_MEDIUM
              : FITBIT_CONFIDENCE_LOW,
        anomalyFlags: minPercent < 85 ? ['critically-low-spo2'] : [],
      },
    });
  }

  return spo2Data;
}

/**
 * Generate synthetic Fitbit sleep stage data.
 *
 * Creates realistic sleep architecture with proper stage proportions and transitions.
 * Includes sleep efficiency, REM fragmentation, and onset latency.
 *
 * @param {Object} options - Configuration options
 * @param {string} options.date - Start date (YYYY-MM-DD)
 * @param {number} options.nights - Number of nights to generate (default 1)
 * @param {number} options.totalSleepHours - Total sleep time in hours (default 7.5)
 * @param {number} options.sleepEfficiency - Sleep efficiency 0.0-1.0 (default 0.85)
 * @param {number} options.remPercent - REM percentage 0.0-1.0 (default 0.22)
 * @param {number} options.deepPercent - Deep sleep percentage 0.0-1.0 (default 0.18)
 * @param {string} options.fragmentationLevel - Fragmentation: 'low', 'moderate', 'high' (default 'low')
 * @param {number} options.seed - Random seed for reproducible tests
 * @returns {Array<Object>} Sleep stage data objects
 */
export function buildFitbitSleepStages({
  date = '2026-01-24',
  nights = 1,
  totalSleepHours = 7.5,
  sleepEfficiency = 0.85,
  remPercent = 0.22,
  deepPercent = 0.18,
  fragmentationLevel = 'low',
  seed = Math.random(),
} = {}) {
  let rngState = seed;
  const seededRandom = () => {
    rngState = (rngState * 9301 + 49297) % 233280;
    return rngState / 233280;
  };

  // Fragmentation affects REM continuity and wake periods
  const fragmentationProfiles = {
    low: { remPeriods: 3, wakeEpisodes: 2, onsetLatencyMin: 15 },
    moderate: { remPeriods: 5, wakeEpisodes: 4, onsetLatencyMin: 25 },
    high: { remPeriods: 8, wakeEpisodes: 7, onsetLatencyMin: 45 },
  };

  const fragProfile = fragmentationProfiles[fragmentationLevel];
  const startDate = new Date(date);
  const sleepData = [];

  for (let night = 0; night < nights; night++) {
    const nightDate = new Date(startDate);
    nightDate.setDate(nightDate.getDate() + night);

    // Convert hours to minutes for calculations
    const totalSleepMinutes = totalSleepHours * 60;
    const timeInBedMinutes = totalSleepMinutes / sleepEfficiency;

    // Calculate sleep stage durations
    const remSleepMinutes = Math.round(totalSleepMinutes * remPercent);
    const deepSleepMinutes = Math.round(totalSleepMinutes * deepPercent);

    // Light sleep is the remainder after REM and deep
    const lightSleepMinutes = Math.round(
      totalSleepMinutes - remSleepMinutes - deepSleepMinutes,
    );

    // Wake time during sleep period
    const awakeMinutes = Math.round(timeInBedMinutes - totalSleepMinutes);

    // Onset latency with variation
    const onsetVariation = (seededRandom() - 0.5) * 20; // ±10 min variation
    const onsetLatencyMin = Math.max(
      5,
      fragProfile.onsetLatencyMin + onsetVariation,
    );

    // REM fragmentation calculation
    const baseRemFragmentation = fragProfile.remPeriods;
    const remFragmentation = Math.round(
      baseRemFragmentation + (seededRandom() - 0.5) * 2,
    );

    sleepData.push({
      date: nightDate.toISOString().slice(0, 10),
      timestamp: nightDate.getTime(),
      sleepStages: {
        totalSleepMinutes: Math.round(totalSleepMinutes),
        lightSleepMinutes: Math.max(0, lightSleepMinutes),
        deepSleepMinutes: Math.max(0, deepSleepMinutes),
        remSleepMinutes: Math.max(0, remSleepMinutes),
        awakeMinutes: Math.max(0, awakeMinutes),
        sleepEfficiency: Math.round(sleepEfficiency * 1000) / 1000, // Three decimal places
        remFragmentation: Math.max(1, remFragmentation),
        onsetLatencyMin: Math.round(onsetLatencyMin),
      },
      dataQuality: {
        movementDetected: seededRandom() > 0.7, // 30% nights have significant movement
        sensorConfidence:
          lightSleepMinutes > 0
            ? FITBIT_CONFIDENCE_HIGH
            : FITBIT_CONFIDENCE_MEDIUM,
        stageTransitions: Math.round(20 + seededRandom() * 15), // 20-35 stage transitions per night
      },
    });
  }

  return sleepData;
}

/**
 * Generate synthetic combined nightly data with OSCAR and Fitbit metrics.
 *
 * Creates correlated CPAP and physiological data for testing correlation analysis.
 * Automatically adjusts Fitbit metrics based on OSCAR AHI and pressure settings.
 *
 * @param {Object} options - Configuration options
 * @param {string} options.date - Start date (YYYY-MM-DD)
 * @param {number} options.nights - Number of nights to generate (default 7)
 * @param {Object} options.oscarData - OSCAR session data (from buildNightSession)
 * @param {Object} options.fitbitData - Fitbit data components (optional, auto-generated if not provided)
 * @param {string} options.correlationStrength - Overall correlation: 'none', 'weak', 'moderate', 'strong' (default 'moderate')
 * @param {number} options.seed - Random seed for reproducible tests
 * @returns {Array<Object>} Combined nightly records
 */
export function buildCombinedNightlyData({
  date = '2026-01-24',
  nights = 7,
  oscarData = null,
  fitbitData = null,
  correlationStrength = 'moderate',
  seed = Math.random(),
} = {}) {
  let rngState = seed;
  const seededRandom = () => {
    rngState = (rngState * 9301 + 49297) % 233280;
    return rngState / 233280;
  };

  // If no OSCAR data provided, generate nights with varying AHI
  if (!oscarData) {
    const { buildNightSession } = require('./builders.js');
    oscarData = [];
    for (let i = 0; i < nights; i++) {
      const nightDate = new Date(date);
      nightDate.setDate(nightDate.getDate() + i);
      const ahiTarget = 5 + seededRandom() * 25; // 5-30 AHI range
      oscarData.push(
        buildNightSession({
          date: nightDate.toISOString().slice(0, 10),
          ahiTarget,
          seed: rngState + i,
        }),
      );
    }
  }

  // Generate Fitbit data correlated with OSCAR AHI patterns
  if (!fitbitData) {
    fitbitData = { heartRate: [], spo2: [], sleep: [] };

    for (let i = 0; i < nights; i++) {
      const nightDate = new Date(date);
      nightDate.setDate(nightDate.getDate() + i);
      const dateStr = nightDate.toISOString().slice(0, 10);

      // Extract AHI from OSCAR data to correlate Fitbit metrics
      const oscarNight = oscarData[i];
      const estimatedAhi = oscarNight ? oscarNight.events.length / 8 : 10; // Rough AHI estimate

      // Generate correlated Fitbit data
      const correlatedHR = buildFitbitHeartRateData({
        date: dateStr,
        nights: 1,
        apneaCorrelation: correlationStrength,
        baseRestingBpm: 65 + Math.round(estimatedAhi * 0.5), // Higher AHI → higher HR
        seed: rngState + i * 10,
      });

      const correlatedSpO2 = buildFitbitSpO2Data({
        date: dateStr,
        nights: 1,
        desaturationEvents: Math.round(estimatedAhi * 0.8), // AHI correlates with ODI
        baselinePercent: 96 - Math.round(estimatedAhi * 0.1), // Higher AHI → lower baseline
        seed: rngState + i * 20,
      });

      const correlatedSleep = buildFitbitSleepStages({
        date: dateStr,
        nights: 1,
        sleepEfficiency: Math.max(0.65, 0.9 - estimatedAhi * 0.008), // AHI reduces efficiency
        fragmentationLevel:
          estimatedAhi > 20 ? 'high' : estimatedAhi > 10 ? 'moderate' : 'low',
        seed: rngState + i * 30,
      });

      fitbitData.heartRate.push(...correlatedHR);
      fitbitData.spo2.push(...correlatedSpO2);
      fitbitData.sleep.push(...correlatedSleep);
    }
  }

  // Combine OSCAR and Fitbit data into unified nightly records
  const combinedData = [];
  for (let i = 0; i < nights; i++) {
    const nightDate = new Date(date);
    nightDate.setDate(nightDate.getDate() + i);
    const dateStr = nightDate.toISOString().slice(0, 10);

    const oscar = oscarData[i] || { events: [], flgReadings: [] };
    const hrData = fitbitData.heartRate.find((d) => d.date === dateStr);
    const spo2Data = fitbitData.spo2.find((d) => d.date === dateStr);
    const sleepData = fitbitData.sleep.find((d) => d.date === dateStr);

    // Import createNightlyRecord from fitbitModels
    const { createNightlyRecord } = require('../utils/fitbitModels.js');

    const nightlyRecord = createNightlyRecord({
      date: dateStr,
      oscar: {
        ahi: oscar.events.length / 8, // Rough calculation: events / 8 hours
        events: oscar.events,
      },
      fitbit: {
        heartRate: hrData?.heartRate || {},
        oxygenSaturation: spo2Data?.oxygenSaturation || {},
        sleepStages: sleepData?.sleepStages || {},
      },
      dataQuality: {
        oscarDataComplete: oscar.events.length > 0,
        fitbitDataComplete: !!(hrData && spo2Data && sleepData),
        correlationStrength,
      },
    });

    combinedData.push(nightlyRecord);
  }

  return combinedData;
}

/**
 * Create mock OAuth tokens for testing authentication flows.
 *
 * @param {Object} options - Token configuration
 * @param {boolean} options.expired - Whether tokens should be expired (default false)
 * @param {number} options.expiresInHours - Token expiry in hours (default 8)
 * @returns {Object} Mock OAuth token response
 */
export function buildMockOAuthTokens({
  expired = false,
  expiresInHours = 8,
} = {}) {
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + (expired ? -3600000 : expiresInHours * 3600000),
  ); // ±1 hour or +N hours

  return {
    access_token:
      'mock_access_token_' + Math.random().toString(36).substr(2, 9),
    refresh_token:
      'mock_refresh_token_' + Math.random().toString(36).substr(2, 9),
    user_id: 'mock_user_' + Math.random().toString(36).substr(2, 6),
    scope: 'heartrate spo2 sleep profile',
    token_type: 'Bearer',
    expires_in: expired ? -3600 : expiresInHours * 3600,
    expires_at: expiresAt.toISOString(),
  };
}

/**
 * Generate mock Fitbit API response data for testing HTTP requests.
 *
 * @param {string} endpoint - API endpoint type: 'profile', 'heartrate', 'spo2', 'sleep'
 * @param {Object} options - Response configuration
 * @returns {Object} Mock API response data
 */
export function buildMockFitbitApiResponse(endpoint, options = {}) {
  const { date = '2026-01-24', success = true, rateLimit = false } = options;

  if (!success) {
    return {
      success: false,
      errors: [{ errorType: 'invalid_token', message: 'Access token expired' }],
    };
  }

  if (rateLimit) {
    return {
      success: false,
      errors: [
        { errorType: 'rate_limit_exceeded', message: 'Rate limit exceeded' },
      ],
      'X-RateLimit-Remaining': 0,
      'X-RateLimit-Reset': Math.floor(Date.now() / 1000) + 3600, // Reset in 1 hour
    };
  }

  const responses = {
    profile: {
      user: {
        displayName: 'Test User',
        encodedId: 'TEST123',
        timezone: 'America/New_York',
        memberSince: '2020-01-01',
      },
    },
    heartrate: {
      'activities-heart': [
        {
          dateTime: date,
          value: {
            restingHeartRate: 65,
          },
        },
      ],
      'activities-heart-intraday': {
        dataset: Array.from({ length: 480 }, (_, i) => ({
          time: `${Math.floor(i / 60)
            .toString()
            .padStart(2, '0')}:${(i % 60).toString().padStart(2, '0')}:00`,
          value: 60 + Math.sin(i / 60) * 10 + Math.random() * 5,
        })),
      },
    },
    spo2: {
      dateTime: date,
      value: {
        avg: 94.5,
        min: 88,
        max: 97,
      },
    },
    sleep: {
      sleep: [
        {
          dateOfSleep: date,
          duration: 8 * 60 * 60 * 1000, // 8 hours in milliseconds
          efficiency: 85,
          stages: {
            deep: 90, // minutes
            light: 240, // minutes
            rem: 120, // minutes
            wake: 30, // minutes
          },
        },
      ],
    },
  };

  return responses[endpoint] || { error: 'Unknown endpoint' };
}
