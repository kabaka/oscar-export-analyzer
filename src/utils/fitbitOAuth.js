/**
 * Shared Fitbit OAuth state/token logic utility.
 *
 * Exports helpers for state, PKCE, token management, and OAuth callback parsing/error handling.
 *
 * @module utils/fitbitOAuth
 */

import { FITBIT_ERRORS } from '../constants/fitbitErrors.js';
import { FITBIT_OAUTH_STORAGE_KEYS } from '../constants/fitbit.js';

/**
 * Generate a cryptographically secure random string for PKCE/state.
 *
 * @param {number} length - Desired string length
 * @returns {string} URL-safe random string
 */
export function generateRandomString(length) {
  const array = new Uint8Array(Math.ceil((length * 3) / 4));
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
    .substr(0, length);
}

/**
 * Generate SHA256 hash for PKCE code challenge.
 *
 * @param {string} codeVerifier - PKCE code verifier
 * @returns {Promise<string>} URL-safe base64-encoded code challenge
 */
export async function generateCodeChallenge(codeVerifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const base64String = btoa(String.fromCharCode(...new Uint8Array(digest)));
  return base64String.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Get OAuth state and PKCE verifier from storage (session/local).
 *
 * @returns {{state: string|null, codeVerifier: string|null}} Object with state and codeVerifier
 */
export function getStoredOAuthState() {
  let state = null;
  let codeVerifier = null;
  try {
    const stored = sessionStorage.getItem(FITBIT_OAUTH_STORAGE_KEYS.STATE);
    state = stored ? JSON.parse(stored).value : null;
    codeVerifier = sessionStorage.getItem(
      FITBIT_OAUTH_STORAGE_KEYS.PKCE_VERIFIER,
    );
  } catch {
    // Ignore storage errors (unavailable or JSON parse error)
  }
  if (!state || !codeVerifier) {
    try {
      const backup = localStorage.getItem(
        FITBIT_OAUTH_STORAGE_KEYS.STATE_BACKUP,
      );
      state = backup ? JSON.parse(backup).value : null;
      codeVerifier = localStorage.getItem(
        FITBIT_OAUTH_STORAGE_KEYS.PKCE_VERIFIER_BACKUP,
      );
    } catch {
      // Ignore storage errors (unavailable or JSON parse error)
    }
  }
  return { state, codeVerifier };
}

/**
 * Remove OAuth state and PKCE verifier from storage.
 *
 * Removes both session and localStorage keys for state and PKCE verifier.
 */
/**
 * Parse OAuth callback parameters from a window location or URL string.
 *
 * @param {Location|string} location - window.location or URL string
 * @returns {{ code: string|null, state: string|null, error: string|null, errorDescription: string|null }}
 *   Object with code, state, error, and errorDescription fields (all nullable)
 */
/**
 * Build a standardized OAuth error object from error code/description.
 *
 * @param {string} errorCode - OAuth error code (e.g. 'access_denied')
 * @param {string} errorDescription - Human-readable error description
 * @returns {object} Error object for UI/state, with code, type, message, and details
 */
export function clearOAuthState() {
  sessionStorage.removeItem(FITBIT_OAUTH_STORAGE_KEYS.STATE);
  sessionStorage.removeItem(FITBIT_OAUTH_STORAGE_KEYS.PKCE_VERIFIER);
  localStorage.removeItem(FITBIT_OAUTH_STORAGE_KEYS.STATE_BACKUP);
  localStorage.removeItem(FITBIT_OAUTH_STORAGE_KEYS.PKCE_VERIFIER_BACKUP);
}

/**
 * Parse OAuth callback parameters from a window location or URL string.
 * @param {Location|string} location - window.location or URL string
 * @returns {{ code: string|null, state: string|null, error: string|null, errorDescription: string|null }}
 */
export function parseOAuthCallbackParams(location) {
  let search = '';
  if (typeof location === 'string') {
    search = new URL(location).search;
  } else if (location && location.search) {
    search = location.search;
  }
  const urlParams = new URLSearchParams(search);
  return {
    code: urlParams.get('code'),
    state: urlParams.get('state'),
    error: urlParams.get('error'),
    errorDescription: urlParams.get('error_description'),
  };
}

/**
 * Build a standardized OAuth error object from error code/description.
 * @param {string} errorCode
 * @param {string} errorDescription
 * @returns {object} Error object for UI/state
 */
export function buildOAuthError(errorCode, errorDescription) {
  let message = 'Authentication failed';
  let errorObj = {
    code: errorCode,
    type: 'oauth',
    message,
    details: `${errorCode}: ${errorDescription}`,
  };
  switch (errorCode) {
    case 'access_denied':
      errorObj.message = 'Access was denied by user';
      break;
    case 'invalid_request':
      errorObj.message = 'Invalid authentication request';
      break;
    case 'unsupported_response_type':
      errorObj.message = 'Unsupported authentication method';
      break;
    default:
      errorObj.message = errorDescription || 'Unknown authentication error';
  }
  // Prefer canonical error structure if available, but always include type
  if (FITBIT_ERRORS[errorCode?.toUpperCase()]) {
    errorObj = {
      ...FITBIT_ERRORS[errorCode?.toUpperCase()],
      type: 'oauth',
      details: `${errorCode}: ${errorDescription}`,
    };
  }
  return errorObj;
}
