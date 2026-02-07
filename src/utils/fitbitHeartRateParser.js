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
 * Parse batch sync results to extract heart rate data.
 *
 * batchSync() returns results keyed by data type:
 * `{ heartRate: { "activities-heart": [...] }, spo2: {...}, ... }`
 *
 * @param {Object} batchResults - Results from fitbitApiClient.batchSync()
 * @returns {Object} Parsed synced data with heartRateData array
 */
export function parseSyncResults(batchResults) {
  if (!batchResults) return { heartRateData: [] };

  const result = {
    heartRateData: [],
  };

  // Parse heart rate data if present and not an error
  if (batchResults.heartRate && !batchResults.heartRate.error) {
    result.heartRateData = parseHeartRateResponse(batchResults.heartRate);
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
