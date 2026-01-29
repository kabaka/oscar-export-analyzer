/**
 * Storage keys for Fitbit OAuth flow (session/localStorage).
 *
 * Centralizes all magic strings for storage access in OAuth and token management.
 *
 * @typedef {Object} FITBIT_OAUTH_STORAGE_KEYS
 * @property {string} STATE - Key for OAuth state (sessionStorage)
 * @property {string} PKCE_VERIFIER - Key for PKCE code verifier (sessionStorage)
 * @property {string} STATE_BACKUP - Backup key for OAuth state (localStorage)
 * @property {string} PKCE_VERIFIER_BACKUP - Backup key for PKCE verifier (localStorage)
 * @property {string} PASSPHRASE - Key for encryption passphrase (sessionStorage)
 * @property {string} SESSION_PASSPHRASE - Key for session passphrase (sessionStorage)
 * @property {string} TOKENS - Key for Fitbit tokens (session/localStorage)
 */
export const FITBIT_OAUTH_STORAGE_KEYS = {
  STATE: 'fitbit_oauth_state',
  PKCE_VERIFIER: 'fitbit_pkce_verifier',
  STATE_BACKUP: 'fitbit_oauth_state_backup',
  PKCE_VERIFIER_BACKUP: 'fitbit_pkce_verifier_backup',
  PASSPHRASE: 'fitbit_oauth_passphrase',
  SESSION_PASSPHRASE: 'fitbit_session_passphrase',
  TOKENS: 'fitbit_tokens',
};
// Helper to safely access Vite env vars in both Vite and Vitest
function getMetaEnv() {
  // Vitest injects globalThis.__vitest_worker__?.metaEnv
  if (
    typeof globalThis !== 'undefined' &&
    globalThis.__vitest_worker__?.metaEnv
  ) {
    return globalThis.__vitest_worker__.metaEnv;
  }
  // Vite/Browser: import.meta.env
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env;
  }
  return {};
}
/**
 * Fitbit API configuration and constants.
 *
 * Contains OAuth endpoints, scopes, rate limits, and API configuration
 * following the technical roadmap and security specifications.
 *
 * @module constants/fitbit
 */

/**
 * Fitbit OAuth 2.0 configuration.
 * Uses Authorization Code flow with PKCE for security.
 */

const DEFAULT_CLIENT_ID = 'dev-client-id';

const resolveClientId = (value) => {
  if (!value) return DEFAULT_CLIENT_ID;
  const trimmed = value.trim();
  if (trimmed === '***' || trimmed === 'your-fitbit-client-id') {
    return DEFAULT_CLIENT_ID;
  }
  return trimmed;
};

export const FITBIT_CONFIG = {
  // OAuth endpoints
  authUrl: 'https://www.fitbit.com/oauth2/authorize',
  tokenUrl: 'https://api.fitbit.com/oauth2/token',
  revokeUrl: 'https://api.fitbit.com/oauth2/revoke',

  // Client configuration
  // Lazy getter ensures resolveClientId runs at runtime, not module load time
  // This prevents Vite from inlining the env var value during build
  get clientId() {
    const env = getMetaEnv();
    const envClientId =
      typeof env.VITE_FITBIT_CLIENT_ID !== 'undefined'
        ? env.VITE_FITBIT_CLIENT_ID
        : undefined;
    return resolveClientId(envClientId);
  },
  redirectUri: `${globalThis.location?.origin || 'http://localhost:5173'}${(function () {
    const env = getMetaEnv();
    return typeof env.BASE_URL !== 'undefined' ? env.BASE_URL : '/';
  })()}oauth-callback`,

  // PKCE configuration
  codeChallenge: {
    method: 'S256', // SHA256
    length: 128, // Code verifier length (43-128 chars)
  },

  // OAuth state management
  stateTimeoutMs: 5 * 60 * 1000, // 5 minutes
  stateLength: 32, // OAuth state string length

  // Token configuration
  tokenBufferSeconds: 5, // Refresh token 5 seconds before expiry
};

/**
 * Fitbit API scopes for health data access.
 * Each scope requires user consent during OAuth flow.
 */
export const FITBIT_SCOPES = {
  HEARTRATE: 'heartrate', // 1-minute heart rate data
  SPO2: 'oxygen_saturation', // SpO2 readings (5-minute intervals)
  SLEEP: 'sleep', // Sleep stages and duration
  RESPIRATORY_RATE: 'respiratory_rate', // Breathing rate (optional)
  ACTIVITY: 'activity', // Steps, calories (optional for future)
  PROFILE: 'profile', // Basic profile info
};

/**
 * MVP scopes - minimal permissions for core correlation features.
 * Matches requirements from technical roadmap.
 */
export const MVP_SCOPES = [
  FITBIT_SCOPES.HEARTRATE,
  FITBIT_SCOPES.SPO2,
  FITBIT_SCOPES.SLEEP,
];

/**
 * Fitbit Web API endpoints.
 * Rate limited to 150 requests/hour per user.
 */
export const FITBIT_API = {
  baseUrl: 'https://api.fitbit.com',

  // Heart rate endpoints
  heartRate: {
    intraday: '/1/user/-/activities/heart/date/{date}/1d/1min.json',
    dateRange: '/1/user/-/activities/heart/date/{startDate}/{endDate}.json',
  },

  // SpO2 endpoints
  spo2: {
    intraday: '/1/user/-/spo2/date/{date}/all.json',
    dateRange: '/1/user/-/spo2/date/{startDate}/{endDate}/all.json',
  },

  // Sleep endpoints
  sleep: {
    logs: '/1.2/user/-/sleep/date/{startDate}/{endDate}.json',
    detail: '/1.2/user/-/sleep/date/{date}.json',
  },

  // Heart rate variability (HRV)
  hrv: {
    dateRange: '/1/user/-/hrv/date/{startDate}/{endDate}/all.json',
  },

  // User profile
  profile: '/1/user/-/profile.json',
};

/**
 * API rate limiting configuration.
 * Fitbit enforces 150 requests/hour per user.
 */
export const RATE_LIMITS = {
  requestsPerHour: 150,
  requestWindowMs: 60 * 60 * 1000, // 1 hour
  retryDelayMs: 1000, // Initial retry delay
  maxRetries: 3, // Max retry attempts
  backoffMultiplier: 2, // Exponential backoff
};

/**
 * Data sync configuration.
 */
export const SYNC_CONFIG = {
  maxDaysPerRequest: 7, // Batch size for date range requests
  maxConcurrentRequests: 2, // Prevent rate limit exhaustion
  defaultLookbackDays: 30, // Default sync period
};

/**
 * Connection states for UI components.
 */
export const CONNECTION_STATUS = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  ERROR: 'error',
  TOKEN_EXPIRED: 'token_expired',
};

/**
 * Error codes for Fitbit integration.
 */
export const FITBIT_ERRORS = {
  OAUTH_CANCELLED: 'oauth_cancelled',
  OAUTH_ERROR: 'oauth_error',
  TOKEN_REFRESH_FAILED: 'token_refresh_failed',
  API_RATE_LIMITED: 'api_rate_limited',
  API_ERROR: 'api_error',
  NETWORK_ERROR: 'network_error',
  ENCRYPTION_ERROR: {
    code: 'encryption_error',
    message:
      'Encryption passphrase required or invalid. Please enter your passphrase to continue.',
  },
};

/**
 * Physiological validation constants for Fitbit data integration.
 *
 * Based on established clinical ranges for healthy adults and sleep apnea patients.
 * Used for data quality validation and outlier detection in OSCAR-Fitbit correlation analysis.
 */

/** Heart Rate Validation (BPM) */
export const HR_RESTING_MIN = 40; // Bradycardia threshold
export const HR_RESTING_MAX = 100; // Tachycardia threshold
export const HR_SLEEP_MIN = 35; // Minimum during sleep
export const HR_SLEEP_MAX = 80; // Maximum normal sleep HR
export const HR_ABSOLUTE_MAX = 220; // Physiological maximum
export const HR_SLEEP_DISORDER_MAX = 120; // Upper bound for sleep disorders

/** SpO2 (Oxygen Saturation) Validation (%) */
export const SPO2_NORMAL_MIN = 95; // Normal lower bound
export const SPO2_NORMAL_MAX = 100; // Perfect saturation
export const SPO2_MILD_HYPOXEMIA = 90; // Mild hypoxemia threshold
export const SPO2_SEVERE_HYPOXEMIA = 85; // Severe hypoxemia threshold
export const SPO2_CRITICAL_MIN = 70; // Critical threshold (flag as suspicious)

/** HRV (Heart Rate Variability) Validation (ms) */
export const HRV_YOUNG_ADULT_MIN = 30; // Young adults (20-35)
export const HRV_YOUNG_ADULT_MAX = 50;
export const HRV_MIDDLE_AGE_MIN = 20; // Middle age (35-55)
export const HRV_MIDDLE_AGE_MAX = 40;
export const HRV_OLDER_ADULT_MIN = 15; // Older adults (55+)
export const HRV_OLDER_ADULT_MAX = 30;
export const HRV_SLEEP_APNEA_TYPICAL = 20; // Often below this in OSA patients
export const HRV_ABSOLUTE_MIN = 5; // Below this suggests measurement error
export const HRV_ABSOLUTE_MAX = 100; // Above this suggests measurement error

/** Sleep Architecture Validation (%) */
export const SLEEP_LIGHT_MIN = 35; // Light sleep percentage
export const SLEEP_LIGHT_MAX = 65;
export const SLEEP_DEEP_MIN = 10; // Deep sleep percentage
export const SLEEP_DEEP_MAX = 30;
export const SLEEP_REM_MIN = 15; // REM sleep percentage
export const SLEEP_REM_MAX = 30;
export const SLEEP_WAKE_MAX = 10; // Wake percentage (good efficiency)
export const SLEEP_EFFICIENCY_MIN = 85; // Sleep efficiency percentage

/** Respiratory Rate Validation (breaths/min) */
export const RESP_RATE_MIN = 8; // Bradypnea threshold
export const RESP_RATE_MAX = 25; // Tachypnea threshold
export const RESP_RATE_SLEEP_MIN = 6; // Minimum during sleep
export const RESP_RATE_SLEEP_MAX = 20; // Maximum during sleep

/** Sleep Duration Validation (hours) */
export const SLEEP_DURATION_MIN = 3; // Minimum for valid analysis
export const SLEEP_DURATION_MAX = 12; // Maximum reasonable duration
export const SLEEP_ONSET_MAX_MIN = 60; // Maximum sleep onset latency (minutes)

/** Fitbit Data Quality Thresholds */
export const FITBIT_CONFIDENCE_HIGH = 'high';
export const FITBIT_CONFIDENCE_MEDIUM = 'medium';
export const FITBIT_CONFIDENCE_LOW = 'low';

/** Temporal Alignment Constants */
export const SLEEP_DATE_OFFSET_HOURS = 12; // Hours to shift for sleep date calculation
export const MAX_SYNC_DELAY_HOURS = 48; // Maximum expected Fitbit sync delay
export const MIN_OVERLAP_HOURS = 4; // Minimum OSCAR-Fitbit overlap for valid night

/** Statistical Significance Levels */
export const SIGNIFICANCE_LEVELS = {
  P_001: 0.001, // Highly significant
  P_01: 0.01, // Very significant
  P_05: 0.05, // Significant
  P_10: 0.1, // Marginally significant
};

/** Correlation Analysis Thresholds */
export const CORRELATION_THRESHOLDS = {
  WEAK: 0.3, // Weak correlation
  MODERATE: 0.5, // Moderate correlation
  STRONG: 0.7, // Strong correlation
  VERY_STRONG: 0.9, // Very strong correlation
};

/** Chart Layout Constants */
export const SCATTER_PLOT_HEIGHT = 400;
export const DUAL_AXIS_CHART_HEIGHT = 500; // Height for dual-axis sync charts
export const CORRELATION_MATRIX_HEIGHT = 450; // Height for correlation matrix heatmaps

export const CORRELATION_CHART_MARGINS = {
  DEFAULT: { top: 20, right: 40, bottom: 60, left: 60 },
  DUAL_AXIS: { top: 20, right: 80, bottom: 60, left: 60 },
  COMPACT: { top: 15, right: 30, bottom: 45, left: 45 },
};

/** Data Validation Limits */
export const DATA_LIMITS = {
  MIN_NIGHTS_FOR_ANALYSIS: 7, // Minimum nights of data needed
  MAX_MISSING_DATA_RATIO: 0.3, // Maximum 30% missing data allowed
  MIN_CORRELATION_SAMPLE_SIZE: 10, // Minimum sample size for correlation
};
