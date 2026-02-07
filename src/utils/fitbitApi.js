/**
 * Fitbit API client with rate limiting and error handling.
 *
 * Provides a high-level interface to Fitbit Web API with:
 * - Automatic authentication (token refresh)
 * - Rate limiting (150 requests/hour)
 * - Exponential backoff retry logic
 * - Request batching for date ranges
 *
 * @module utils/fitbitApi
 */

import { fitbitOAuth } from './fitbitAuth.js';
import {
  FITBIT_API,
  RATE_LIMITS,
  SYNC_CONFIG,
  FITBIT_ERRORS,
  DATA_TYPE_SCOPES,
} from '../constants/fitbit.js';
import { parseHeartRateIntradayResponse } from './fitbitHeartRateParser.js';

/**
 * Rate limiter to prevent API quota exhaustion.
 */
class RateLimiter {
  constructor() {
    this.requests = []; // Timestamp array for tracking requests
    this.maxRequests = RATE_LIMITS.requestsPerHour;
    this.windowMs = RATE_LIMITS.requestWindowMs;
  }

  /**
   * Check if request is allowed within rate limit.
   *
   * @returns {boolean} True if request allowed
   */
  canMakeRequest() {
    const now = Date.now();

    // Remove requests outside the window
    this.requests = this.requests.filter(
      (timestamp) => now - timestamp < this.windowMs,
    );

    return this.requests.length < this.maxRequests;
  }

  /**
   * Record a request timestamp.
   */
  recordRequest() {
    this.requests.push(Date.now());
  }

  /**
   * Get time until next request is allowed.
   *
   * @returns {number} Milliseconds to wait, or 0 if request allowed
   */
  getWaitTime() {
    if (this.canMakeRequest()) return 0;

    // Find oldest request in current window
    const oldestRequest = Math.min(...this.requests);
    const waitTime = oldestRequest + this.windowMs - Date.now();

    return Math.max(0, waitTime);
  }
}

/**
 * HTTP client with retry logic and error handling.
 */
class FitbitHttpClient {
  constructor() {
    this.rateLimiter = new RateLimiter();
    this.baseUrl = FITBIT_API.baseUrl;
  }

  /**
   * Make authenticated API request with retry logic.
   *
   * @param {string} endpoint - API endpoint path
   * @param {string} accessToken - Valid access token
   * @param {Object} options - Request options
   * @returns {Promise<Object>} API response data
   */
  async makeRequest(endpoint, accessToken, options = {}) {
    const {
      retries = RATE_LIMITS.maxRetries,
      delay = RATE_LIMITS.retryDelayMs,
    } = options;

    // Check rate limit
    if (!this.rateLimiter.canMakeRequest()) {
      const waitTime = this.rateLimiter.getWaitTime();
      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    try {
      this.rateLimiter.recordRequest();

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });

      if (response.status === 429) {
        // Rate limited - wait and retry
        if (retries > 0) {
          const retryAfter = response.headers.get('Retry-After');
          const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : delay;

          await new Promise((resolve) => setTimeout(resolve, waitMs));
          return this.makeRequest(endpoint, accessToken, {
            retries: retries - 1,
            delay: delay * RATE_LIMITS.backoffMultiplier,
          });
        }
        throw {
          code: 'api_rate_limited',
          type: 'api',
          message: 'API rate limit exceeded',
          details: 'HTTP 429 Too Many Requests',
        };
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`API request failed: ${response.status}`, errorData);
        throw {
          code: 'api_error',
          type: 'api',
          message: 'API request failed',
          details: errorData?.error || response.statusText,
        };
      }

      return await response.json();
    } catch (error) {
      if (error.message === FITBIT_ERRORS.API_RATE_LIMITED) {
        throw error;
      }

      // Network error - retry if retries available
      if (retries > 0 && error.name === 'TypeError') {
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.makeRequest(endpoint, accessToken, {
          retries: retries - 1,
          delay: delay * RATE_LIMITS.backoffMultiplier,
        });
      }

      // Network/CORS error with no retries left
      if (error.name === 'TypeError') {
        throw {
          code: 'api_request_failed',
          type: 'api',
          message: `Request to Fitbit API failed. Check your network connection and try again.`,
          details: error.message,
        };
      }

      throw error;
    }
  }

  /**
   * Format date for API endpoints.
   *
   * @param {Date|string} date - Date to format
   * @returns {string} YYYY-MM-DD formatted date
   */
  formatDate(date) {
    if (typeof date === 'string') return date;
    return date.toISOString().split('T')[0];
  }

  /**
   * Replace template parameters in endpoint URLs.
   *
   * @param {string} endpoint - Endpoint with {param} placeholders
   * @param {Object} params - Parameter values
   * @returns {string} Endpoint with parameters replaced
   */
  replaceParams(endpoint, params) {
    return Object.keys(params).reduce((url, key) => {
      return url.replace(`{${key}}`, params[key]);
    }, endpoint);
  }
}

/**
 * Main Fitbit API client.
 */
export class FitbitApiClient {
  constructor(passphrase = null) {
    this.passphrase = passphrase;
    this.httpClient = new FitbitHttpClient();
  }

  /**
   * Set encryption passphrase for token access.
   *
   * @param {string} passphrase - User encryption passphrase
   */
  setPassphrase(passphrase) {
    this.passphrase = passphrase;
  }

  /**
   * Get valid access token for API requests.
   *
   * @returns {Promise<string>} Valid access token
   * @throws {Error} If authentication fails
   */
  async getAccessToken() {
    if (!this.passphrase) {
      throw {
        code: 'encryption_error',
        type: 'encryption',
        message:
          'Encryption passphrase required to complete Fitbit connection.',
        details: 'Passphrase required for token access',
      };
    }

    const token = await fitbitOAuth
      .getTokenManager()
      .getValidAccessToken(this.passphrase);
    if (!token) {
      throw {
        code: 'authentication_required',
        type: 'auth',
        message: 'Authentication required',
        details: 'No valid token found',
      };
    }

    return token;
  }

  /**
   * Get heart rate data for a specific date.
   *
   * @param {Date|string} date - Target date
   * @returns {Promise<Object>} Heart rate intraday data
   */
  async getHeartRateIntraday(date) {
    const accessToken = await this.getAccessToken();
    const formattedDate = this.httpClient.formatDate(date);

    const endpoint = this.httpClient.replaceParams(
      FITBIT_API.heartRate.intraday,
      { date: formattedDate },
    );

    return this.httpClient.makeRequest(endpoint, accessToken);
  }

  /**
   * Get heart rate data for a date range.
   *
   * @param {Date|string} startDate - Start date
   * @param {Date|string} endDate - End date
   * @returns {Promise<Object>} Heart rate data
   */
  async getHeartRateRange(startDate, endDate) {
    const accessToken = await this.getAccessToken();
    const formattedStart = this.httpClient.formatDate(startDate);
    const formattedEnd = this.httpClient.formatDate(endDate);

    const endpoint = this.httpClient.replaceParams(
      FITBIT_API.heartRate.dateRange,
      { startDate: formattedStart, endDate: formattedEnd },
    );

    return this.httpClient.makeRequest(endpoint, accessToken);
  }

  /**
   * Get SpO2 data for a date range.
   *
   * @param {Date|string} startDate - Start date
   * @param {Date|string} endDate - End date
   * @returns {Promise<Object>} SpO2 data
   */
  async getSpo2Range(startDate, endDate) {
    const accessToken = await this.getAccessToken();
    const formattedStart = this.httpClient.formatDate(startDate);
    const formattedEnd = this.httpClient.formatDate(endDate);

    const endpoint = this.httpClient.replaceParams(FITBIT_API.spo2.dateRange, {
      startDate: formattedStart,
      endDate: formattedEnd,
    });

    return this.httpClient.makeRequest(endpoint, accessToken);
  }

  /**
   * Get sleep logs for a date range.
   *
   * DISABLED: Sleep v1.2 endpoints produce CORS errors even on the official
   * Fitbit Swagger UI. This method is retained for forward compatibility
   * but will throw until the CORS issue is resolved by Fitbit.
   *
   * @param {Date|string} _startDate - Start date (unused)
   * @param {Date|string} _endDate - End date (unused)
   * @returns {Promise<Object>} Never resolves — always throws
   */
  async getSleepLogs(/* startDate, endDate */) {
    throw {
      code: 'api_endpoint_disabled',
      type: 'api',
      message:
        'Sleep API (v1.2) is currently disabled due to CORS errors on api.fitbit.com. ' +
        'This is a known Fitbit platform issue, not a configuration problem.',
      details: 'See https://dev.fitbit.com/build/reference/web-api/sleep/',
    };
  }

  /**
   * Get HRV data for a date range.
   *
   * @param {Date|string} startDate - Start date
   * @param {Date|string} endDate - End date
   * @returns {Promise<Object>} HRV data
   */
  async getHrvRange(startDate, endDate) {
    const accessToken = await this.getAccessToken();
    const formattedStart = this.httpClient.formatDate(startDate);
    const formattedEnd = this.httpClient.formatDate(endDate);

    const endpoint = this.httpClient.replaceParams(FITBIT_API.hrv.dateRange, {
      startDate: formattedStart,
      endDate: formattedEnd,
    });

    return this.httpClient.makeRequest(endpoint, accessToken);
  }

  /**
   * Get user profile information.
   *
   * @returns {Promise<Object>} User profile data
   */
  async getUserProfile() {
    const accessToken = await this.getAccessToken();
    return this.httpClient.makeRequest(FITBIT_API.profile, accessToken);
  }

  /**
   * Fetch intraday heart rate data for multiple dates.
   * Uses 1-minute resolution. Fetches one day at a time (API limitation).
   * Optionally constrains to a time window (e.g., sleep hours only).
   *
   * @param {Date|string} startDate - First date to fetch
   * @param {Date|string} endDate - Last date to fetch
   * @param {Object} [options] - Options
   * @param {string} [options.startTime='00:00'] - Start time (HH:mm)
   * @param {string} [options.endTime='23:59'] - End time (HH:mm)
   * @param {Function} [options.onProgress] - Progress callback
   * @returns {Promise<Object[]>} Array of { date, intradayData, summary }
   */
  async getHeartRateIntradayBatch(startDate, endDate, options = {}) {
    const { onProgress } = options;
    const formattedStart = this.httpClient.formatDate(startDate);
    const formattedEnd = this.httpClient.formatDate(endDate);

    // Generate list of dates between start and end (inclusive)
    const dates = [];
    const current = new Date(`${formattedStart}T12:00:00`);
    const last = new Date(`${formattedEnd}T12:00:00`);
    while (current <= last) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }

    const results = [];
    const batchSize = SYNC_CONFIG.maxConcurrentRequests;

    for (let i = 0; i < dates.length; i += batchSize) {
      const batch = dates.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map(async (date) => {
          try {
            // Use the existing intraday endpoint (returns summary + intraday for 1 day)
            const raw = await this.getHeartRateIntraday(date);
            const parsed = parseHeartRateIntradayResponse(raw);
            return parsed;
          } catch (error) {
            console.error(`Failed to fetch HR intraday for ${date}:`, error);
            return { date, error: error.message || 'Failed to fetch' };
          }
        }),
      );

      results.push(...batchResults);

      if (onProgress) {
        onProgress({
          completed: Math.min(i + batchSize, dates.length),
          total: dates.length,
          percentage: Math.round(
            (Math.min(i + batchSize, dates.length) / dates.length) * 100,
          ),
        });
      }
    }

    return results.filter((r) => !r.error);
  }

  /**
   * Check which scopes were granted during OAuth authorization.
   * Returns null if scope info is unavailable (best-effort).
   *
   * @returns {Promise<string[]|null>} Granted scopes or null
   */
  async getGrantedScopes() {
    if (!this.passphrase) return null;
    try {
      return await fitbitOAuth
        .getTokenManager()
        .getGrantedScopes(this.passphrase);
    } catch {
      return null;
    }
  }

  /**
   * Batch sync multiple data types for a date range.
   * Respects rate limits and concurrent request limits.
   * Validates granted scopes before making API calls.
   *
   * @param {Object} params - Sync parameters
   * @param {Date|string} params.startDate - Start date
   * @param {Date|string} params.endDate - End date
   * @param {Array} params.dataTypes - Data types to sync ['heartRate', 'spo2', 'sleep', 'hrv']
   * @param {Function} params.onProgress - Progress callback (optional)
   * @returns {Promise<Object>} Synced data by type
   */
  async batchSync({
    startDate,
    endDate,
    dataTypes = ['heartRate', 'spo2'],
    onProgress,
  }) {
    const results = {};
    const totalRequests = dataTypes.length;
    let completedRequests = 0;

    const updateProgress = () => {
      completedRequests++;
      if (onProgress) {
        onProgress({
          completed: completedRequests,
          total: totalRequests,
          percentage: Math.round((completedRequests / totalRequests) * 100),
        });
      }
    };

    // Best-effort scope validation: skip data types whose scope wasn't granted
    const grantedScopes = await this.getGrantedScopes();
    const filteredDataTypes = [];
    for (const dataType of dataTypes) {
      const requiredScope = DATA_TYPE_SCOPES[dataType];
      if (
        grantedScopes &&
        requiredScope &&
        !grantedScopes.includes(requiredScope)
      ) {
        console.warn(
          `Skipping ${dataType}: scope '${requiredScope}' was not granted during Fitbit authorization.`,
        );
        results[dataType] = {
          error: `Scope '${requiredScope}' was not granted. Re-authorize with this permission to access ${dataType} data.`,
          scopeMissing: true,
        };
        updateProgress();
      } else {
        filteredDataTypes.push(dataType);
      }
    }

    try {
      // Execute requests with proper concurrency limit
      const semaphore = SYNC_CONFIG.maxConcurrentRequests;
      for (let i = 0; i < filteredDataTypes.length; i += semaphore) {
        const batch = filteredDataTypes.slice(i, i + semaphore);
        await Promise.all(
          batch.map(async (dataType) => {
            try {
              let data;

              switch (dataType) {
                case 'heartRate': {
                  // Fetch range summary
                  const summaryData = await this.getHeartRateRange(
                    startDate,
                    endDate,
                  );
                  // Also fetch intraday batch
                  let intradayData = [];
                  try {
                    intradayData = await this.getHeartRateIntradayBatch(
                      startDate,
                      endDate,
                    );
                  } catch (intradayErr) {
                    console.warn(
                      'HR intraday batch failed, continuing with summary only:',
                      intradayErr,
                    );
                  }
                  data = {
                    ...summaryData,
                    _intradayBatch: intradayData,
                  };
                  break;
                }
                case 'spo2':
                  data = await this.getSpo2Range(startDate, endDate);
                  break;
                case 'sleep':
                  data = await this.getSleepLogs(startDate, endDate);
                  break;
                case 'hrv':
                  data = await this.getHrvRange(startDate, endDate);
                  break;
                default:
                  throw {
                    code: 'unsupported_data_type',
                    type: 'api',
                    message: `Unsupported data type: ${dataType}`,
                    details: dataType,
                  };
              }

              results[dataType] = data;
              updateProgress();
            } catch (error) {
              console.error(`Failed to sync ${dataType}:`, error);
              results[dataType] = { error: error.message || error.details };
              updateProgress();
            }
          }),
        );
      }

      return results;
    } catch (error) {
      console.error('Batch sync failed:', error);
      throw error;
    }
  }
}

// Export singleton client
export const fitbitApiClient = new FitbitApiClient();
