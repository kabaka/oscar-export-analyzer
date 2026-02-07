/**
 * Parse Fitbit heart rate API responses into a clean format
 * for display in the dashboard.
 *
 * The Fitbit API returns heart rate data in this format:
 * ```json
 * {
 *   "activities-heart": [
 *     {
 *       "dateTime": "2026-01-08",
 *       "value": {
 *         "restingHeartRate": 68,
 *         "heartRateZones": [
 *           { "name": "Out of Range", "minutes": 1439, "caloriesOut": 1200, "min": 30, "max": 100 },
 *           { "name": "Fat Burn", "minutes": 0, "caloriesOut": 0, "min": 100, "max": 140 },
 *           ...
 *         ]
 *       }
 *     }
 *   ]
 * }
 * ```
 *
 * @module utils/fitbitHeartRateParser
 */

/**
 * Parse raw Fitbit heart rate API response into a clean array of daily records.
 *
 * @param {Object} rawResponse - Raw response from Fitbit heart rate API
 * @param {Array} rawResponse['activities-heart'] - Array of daily heart rate entries
 * @returns {Array<Object>} Parsed daily heart rate records sorted by date ascending
 *
 * @example
 * const parsed = parseHeartRateResponse({
 *   'activities-heart': [
 *     { dateTime: '2026-01-08', value: { restingHeartRate: 68, heartRateZones: [...] } }
 *   ]
 * });
 * // Returns: [{ date: '2026-01-08', restingHeartRate: 68, heartRateZones: [...] }]
 */
export function parseHeartRateResponse(rawResponse) {
  if (!rawResponse) return [];

  const entries = rawResponse['activities-heart'];
  if (!Array.isArray(entries)) return [];

  return entries
    .map((entry) => {
      if (!entry || !entry.dateTime || !entry.value) return null;

      return {
        date: entry.dateTime,
        restingHeartRate: entry.value.restingHeartRate ?? null,
        heartRateZones: Array.isArray(entry.value.heartRateZones)
          ? entry.value.heartRateZones.map((zone) => ({
              name: zone.name,
              minutes: zone.minutes ?? 0,
              caloriesOut: zone.caloriesOut ?? 0,
              min: zone.min,
              max: zone.max,
            }))
          : [],
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Parse a single-day Fitbit intraday heart rate API response.
 *
 * The Fitbit intraday HR response for a single date looks like:
 * ```json
 * {
 *   "activities-heart": [{ "dateTime": "2026-01-08", "value": { "restingHeartRate": 68, "heartRateZones": [...] } }],
 *   "activities-heart-intraday": {
 *     "dataset": [
 *       { "time": "00:00:00", "value": 64 },
 *       { "time": "00:01:00", "value": 63 }
 *     ],
 *     "datasetInterval": 1,
 *     "datasetType": "minute"
 *   }
 * }
 * ```
 *
 * @param {Object} rawResponse - Raw response from Fitbit intraday HR API
 * @returns {Object} Parsed intraday heart rate data with summary and per-minute values
 *
 * @example
 * const parsed = parseHeartRateIntradayResponse(rawResponse);
 * // Returns: {
 * //   date: "2026-01-08",
 * //   restingHeartRate: 68, heartRateZones: [...],
 * //   intradayData: [{ time: "00:00:00", bpm: 64 }, ...],
 * //   intradayStats: { minBpm: 52, maxBpm: 95, avgBpm: 64.3, dataPoints: 1440 }
 * // }
 */
export function parseHeartRateIntradayResponse(rawResponse) {
  if (!rawResponse)
    return { date: null, intradayData: [], intradayStats: null };

  // Extract daily summary from activities-heart
  const entries = rawResponse['activities-heart'];
  const entry =
    Array.isArray(entries) && entries.length > 0 ? entries[0] : null;
  const date = entry?.dateTime ?? null;
  const restingHeartRate = entry?.value?.restingHeartRate ?? null;
  const heartRateZones = Array.isArray(entry?.value?.heartRateZones)
    ? entry.value.heartRateZones.map((zone) => ({
        name: zone.name,
        minutes: zone.minutes ?? 0,
        caloriesOut: zone.caloriesOut ?? 0,
        min: zone.min,
        max: zone.max,
      }))
    : [];

  // Extract intraday dataset
  const intraday = rawResponse['activities-heart-intraday'];
  const dataset = Array.isArray(intraday?.dataset) ? intraday.dataset : [];

  const intradayData = dataset
    .filter((point) => point && point.time != null && point.value != null)
    .map((point) => ({
      time: point.time,
      bpm: point.value,
    }));

  // Compute intraday statistics
  let intradayStats = null;
  if (intradayData.length > 0) {
    const bpmValues = intradayData.map((d) => d.bpm);
    const sum = bpmValues.reduce((a, b) => a + b, 0);
    intradayStats = {
      minBpm: Math.min(...bpmValues),
      maxBpm: Math.max(...bpmValues),
      avgBpm: Math.round((sum / bpmValues.length) * 10) / 10,
      dataPoints: intradayData.length,
    };
  }

  return {
    date,
    restingHeartRate,
    heartRateZones,
    intradayData,
    intradayStats,
  };
}

/**
 * Parse batch sync results to extract heart rate, SpO2, and sleep data.
 *
 * batchSync() returns results keyed by data type:
 * `{ heartRate: { "activities-heart": [...] }, spo2: [...], sleep: { sleep: [...] }, ... }`
 *
 * @param {Object} batchResults - Results from fitbitApiClient.batchSync()
 * @returns {Object} Parsed synced data with heartRateData, spo2Data, and sleepData arrays
 */
export function parseSyncResults(batchResults) {
  if (!batchResults)
    return {
      heartRateData: [],
      heartRateIntraday: [],
      spo2Data: [],
      sleepData: [],
    };

  const result = {
    heartRateData: [],
    heartRateIntraday: [],
    spo2Data: [],
    sleepData: [],
  };

  // Parse heart rate data if present and not an error
  if (batchResults.heartRate && !batchResults.heartRate.error) {
    result.heartRateData = parseHeartRateResponse(batchResults.heartRate);

    // Extract intraday batch data if present (added by batchSync)
    if (Array.isArray(batchResults.heartRate._intradayBatch)) {
      result.heartRateIntraday = batchResults.heartRate._intradayBatch;
    }
  }

  // Parse SpO2 data if present and not an error
  if (batchResults.spo2 && !batchResults.spo2.error) {
    result.spo2Data = parseSpo2Response(batchResults.spo2);
  }

  // Parse sleep data if present and not an error
  // (Sleep API is currently disabled due to CORS issues; sleepData will be [])
  if (batchResults.sleep && !batchResults.sleep.error) {
    result.sleepData = parseSleepResponse(batchResults.sleep);
  }

  return result;
}

/**
 * Compute summary statistics from parsed heart rate data.
 *
 * @param {Array<Object>} heartRateData - Parsed daily heart rate records
 * @returns {Object} Summary statistics
 */
export function computeHeartRateSummary(heartRateData) {
  if (!heartRateData || heartRateData.length === 0) {
    return {
      totalDays: 0,
      daysWithRestingHR: 0,
      avgRestingHR: null,
      minRestingHR: null,
      maxRestingHR: null,
      dateRange: null,
    };
  }

  const withResting = heartRateData.filter(
    (d) => d.restingHeartRate != null && !isNaN(d.restingHeartRate),
  );

  const restingValues = withResting.map((d) => d.restingHeartRate);

  return {
    totalDays: heartRateData.length,
    daysWithRestingHR: withResting.length,
    avgRestingHR:
      restingValues.length > 0
        ? Math.round(
            (restingValues.reduce((a, b) => a + b, 0) / restingValues.length) *
              10,
          ) / 10
        : null,
    minRestingHR: restingValues.length > 0 ? Math.min(...restingValues) : null,
    maxRestingHR: restingValues.length > 0 ? Math.max(...restingValues) : null,
    dateRange:
      heartRateData.length > 0
        ? {
            start: heartRateData[0].date,
            end: heartRateData[heartRateData.length - 1].date,
          }
        : null,
  };
}

/**
 * Parse raw Fitbit SpO2 API response into a clean array of daily records.
 *
 * Handles both the basic summary format and the intraday /all format:
 *
 * Summary format:
 * ```json
 * [{ "dateTime": "2026-01-08", "value": { "avg": 96.5, "min": 93, "max": 99 } }]
 * ```
 *
 * Intraday /all format:
 * ```json
 * [{ "dateTime": "2026-01-08", "minutes": [
 *   { "minute": "2026-01-08T01:30:00.000", "value": 96.5 },
 *   { "minute": "2026-01-08T01:35:00.000", "value": 97.0 }
 * ]}]
 * ```
 *
 * @param {Array|Object} rawResponse - Raw response from Fitbit SpO2 API
 * @returns {Array<Object>} Parsed daily SpO2 records sorted by date ascending
 */
export function parseSpo2Response(rawResponse) {
  if (!rawResponse) return [];

  // SpO2 date range API returns an array directly
  const entries = Array.isArray(rawResponse) ? rawResponse : [];
  if (entries.length === 0) return [];

  return entries
    .map((entry) => {
      if (!entry || !entry.dateTime) return null;

      // Intraday /all format: has minutes array
      if (Array.isArray(entry.minutes) && entry.minutes.length > 0) {
        const values = entry.minutes
          .filter((m) => m && m.value != null)
          .map((m) => m.value);

        const intradayData = entry.minutes
          .filter((m) => m && m.minute != null && m.value != null)
          .map((m) => ({
            minute: m.minute,
            value: m.value,
          }));

        const avg =
          values.length > 0
            ? Math.round(
                (values.reduce((a, b) => a + b, 0) / values.length) * 10,
              ) / 10
            : null;
        const min = values.length > 0 ? Math.min(...values) : null;
        const max = values.length > 0 ? Math.max(...values) : null;

        return {
          date: entry.dateTime,
          avg,
          min,
          max,
          intradayData,
        };
      }

      // Basic summary format: has value object
      const value = entry.value || {};
      return {
        date: entry.dateTime,
        avg: value.avg ?? null,
        min: value.min ?? null,
        max: value.max ?? null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Parse raw Fitbit Sleep API response into a clean array of nightly records.
 *
 * The Fitbit Sleep v1.2 date range API returns data in this format:
 * ```json
 * {
 *   "sleep": [
 *     {
 *       "dateOfSleep": "2026-01-08",
 *       "duration": 28800000,
 *       "efficiency": 92,
 *       "minutesAsleep": 420,
 *       "minutesAwake": 30,
 *       "minutesToFallAsleep": 12,
 *       "levels": {
 *         "summary": {
 *           "deep": { "count": 4, "minutes": 90 },
 *           "light": { "count": 20, "minutes": 210 },
 *           "rem": { "count": 6, "minutes": 100 },
 *           "wake": { "count": 25, "minutes": 30 }
 *         }
 *       }
 *     }
 *   ]
 * }
 * ```
 *
 * When multiple sleep records exist for the same date (e.g. naps), the longest
 * record is selected as the primary sleep session.
 *
 * @param {Object} rawResponse - Raw response from Fitbit Sleep API
 * @returns {Array<Object>} Parsed nightly sleep records sorted by date ascending
 */
export function parseSleepResponse(rawResponse) {
  if (!rawResponse) return [];

  const sleepEntries = rawResponse.sleep;
  if (!Array.isArray(sleepEntries) || sleepEntries.length === 0) return [];

  // Group by dateOfSleep: keep the longest record per night
  const byDate = new Map();
  for (const entry of sleepEntries) {
    if (!entry || !entry.dateOfSleep) continue;

    const existing = byDate.get(entry.dateOfSleep);
    if (!existing || (entry.duration || 0) > (existing.duration || 0)) {
      byDate.set(entry.dateOfSleep, entry);
    }
  }

  return Array.from(byDate.values())
    .map((entry) => {
      const levels = entry.levels || {};
      const summary = levels.summary || {};

      return {
        date: entry.dateOfSleep,
        duration: entry.duration ?? null, // milliseconds
        durationMinutes: entry.duration
          ? Math.round(entry.duration / 60000)
          : null,
        efficiency: entry.efficiency ?? null,
        minutesAsleep: entry.minutesAsleep ?? null,
        minutesAwake: entry.minutesAwake ?? null,
        minutesToFallAsleep: entry.minutesToFallAsleep ?? null,
        deep: summary.deep?.minutes ?? null,
        light: summary.light?.minutes ?? null,
        rem: summary.rem?.minutes ?? null,
        wake: summary.wake?.minutes ?? null,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}
