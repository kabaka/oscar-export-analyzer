/**
 * Fitbit OAuth and API error codes and messages.
 *
 * Centralizes all error codes/messages for consistent error handling.
 *
 * @module constants/fitbitErrors
 */

export const FITBIT_ERRORS = {
  INVALID_STATE: {
    code: 'invalid_state',
    message: 'OAuth state mismatch or expired. Please try connecting again.',
  },
  OAUTH_ERROR: {
    code: 'oauth_error',
    type: 'oauth',
    message: 'OAuth authentication failed or was cancelled. Please try again.',
  },
  ENCRYPTION_ERROR: {
    code: 'encryption_error',
    message: 'Encryption passphrase required to complete Fitbit connection.',
  },
  TOKEN_EXPIRED: {
    code: 'token_expired',
    message: 'Your Fitbit session has expired. Please reconnect.',
  },
  TOKEN_REVOKED: {
    code: 'token_revoked',
    message: 'Your Fitbit connection was revoked. Please reconnect.',
  },
  NETWORK_ERROR: {
    code: 'network_error',
    message: 'Network error occurred while connecting to Fitbit.',
  },
  OAUTH_DENIED: {
    code: 'oauth_denied',
    message: 'Authorization denied. Fitbit connection was not completed.',
  },
  INVALID_CODE: {
    code: 'invalid_code',
    message: 'Invalid or expired authorization code. Please try again.',
  },
  UNKNOWN: {
    code: 'unknown_error',
    message: 'An unknown error occurred during Fitbit connection.',
  },
};
