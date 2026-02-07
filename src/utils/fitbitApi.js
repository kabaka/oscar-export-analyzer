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
   * @param {Date|string} startDate - Start date
   * @param {Date|string} endDate - End date
   * @returns {Promise<Object>} Sleep data
   */
  async getSleepLogs(startDate, endDate) {
    const accessToken = await this.getAccessToken();
    const formattedStart = this.httpClient.formatDate(startDate);
    const formattedEnd = this.httpClient.formatDate(endDate);

    const endpoint = this.httpClient.replaceParams(FITBIT_API.sleep.logs, {
      startDate: formattedStart,
      endDate: formattedEnd,
    });

    return this.httpClient.makeRequest(endpoint, accessToken);
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
    dataTypes = ['heartRate', 'spo2', 'sleep'],
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
                case 'heartRate':
                  data = await this.getHeartRateRange(startDate, endDate);
                  break;
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
