/**
 * Shared Fitbit OAuth state/token logic utility.
 *
 * Exports helpers for state, PKCE, and token management for use in hooks/components.
 *
 * @module utils/fitbitOAuth
 */

/**
 * Generate a cryptographically secure random string for PKCE/state.
 * @param {number} length
 * @returns {string}
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
 * @param {string} codeVerifier
 * @returns {Promise<string>}
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
 * @returns {{state: string|null, codeVerifier: string|null}}
 */
export function getStoredOAuthState() {
  let state = null;
  let codeVerifier = null;
  try {
    const stored = sessionStorage.getItem('fitbit_oauth_state');
    state = stored ? JSON.parse(stored).value : null;
    codeVerifier = sessionStorage.getItem('fitbit_pkce_verifier');
  } catch {
    // Ignore storage errors (unavailable or JSON parse error)
  }
  if (!state || !codeVerifier) {
    try {
      const backup = localStorage.getItem('fitbit_oauth_state_backup');
      state = backup ? JSON.parse(backup).value : null;
      codeVerifier = localStorage.getItem('fitbit_pkce_verifier_backup');
    } catch {
      // Ignore storage errors (unavailable or JSON parse error)
    }
  }
  return { state, codeVerifier };
}

/**
 * Remove OAuth state and PKCE verifier from storage.
 */
export function clearOAuthState() {
  sessionStorage.removeItem('fitbit_oauth_state');
  sessionStorage.removeItem('fitbit_pkce_verifier');
  localStorage.removeItem('fitbit_oauth_state_backup');
  localStorage.removeItem('fitbit_pkce_verifier_backup');
}
