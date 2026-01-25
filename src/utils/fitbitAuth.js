/**
 * Fitbit OAuth 2.0 authentication utilities with PKCE.
 *
 * Implements secure OAuth flow following security requirements:
 * - PKCE (Proof Key for Code Exchange) for authorization code flow
 * - Encrypted token storage using existing crypto utilities
 * - Automatic token refresh with secure retry logic
 * - Proper CSRF protection with state parameters
 *
 * @module utils/fitbitAuth
 */

import { encryptData, decryptData } from './encryption.js';
import { storeTokens, getTokens, clearFitbitData } from './fitbitDb.js';
import {
  FITBIT_CONFIG,
  FITBIT_ERRORS,
  MVP_SCOPES,
} from '../constants/fitbit.js';

/**
 * Generate cryptographically secure random string for PKCE.
 *
 * @param {number} length - String length (43-128 characters for PKCE)
 * @returns {string} Base64URL-encoded random string
 */
function generateRandomString(length) {
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
 * @param {string} codeVerifier - Code verifier string
 * @returns {Promise<string>} Base64URL-encoded SHA256 hash
 */
async function generateCodeChallenge(codeVerifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const base64String = btoa(String.fromCharCode(...new Uint8Array(digest)));

  return base64String.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * OAuth state management for CSRF protection.
 */
class OAuthState {
  constructor() {
    this.stateKey = 'fitbit_oauth_state';
    this.verifierKey = 'fitbit_pkce_verifier';
  }

  /**
   * Generate and store OAuth state and PKCE verifier.
   *
   * @returns {Promise<{state: string, codeChallenge: string}>}
   */
  async generateState() {
    const state = generateRandomString(32);
    const codeVerifier = generateRandomString(
      FITBIT_CONFIG.codeChallenge.length,
    );
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Store temporarily in sessionStorage (cleared after callback)
    sessionStorage.setItem(this.stateKey, state);
    sessionStorage.setItem(this.verifierKey, codeVerifier);

    return { state, codeChallenge };
  }

  /**
   * Validate OAuth callback state and retrieve PKCE verifier.
   *
   * @param {string} receivedState - State from OAuth callback
   * @returns {string|null} PKCE code verifier or null if invalid
   */
  validateCallback(receivedState) {
    const storedState = sessionStorage.getItem(this.stateKey);
    const codeVerifier = sessionStorage.getItem(this.verifierKey);

    // Clear stored values
    sessionStorage.removeItem(this.stateKey);
    sessionStorage.removeItem(this.verifierKey);

    if (!storedState || storedState !== receivedState) {
      console.error('OAuth state mismatch - possible CSRF attack');
      return null;
    }

    return codeVerifier;
  }
}

/**
 * Token management with encryption and automatic refresh.
 */
class TokenManager {
  constructor(passphrase = null) {
    this.passphrase = passphrase;
    this.memoryCache = null; // In-memory cache for decrypted tokens
    this.refreshPromise = null; // Prevent concurrent refresh attempts
  }

  /**
   * Store tokens securely with encryption.
   *
   * @param {Object} tokenData - Raw token response from Fitbit
   * @param {string} passphrase - User encryption passphrase
   * @returns {Promise<boolean>} Success status
   */
  async storeTokensSecurely(tokenData, passphrase) {
    try {
      const encrypted = await encryptData(tokenData, passphrase);

      const success = await storeTokens(
        tokenData,
        encrypted.encrypted,
        encrypted.salt,
        encrypted.iv,
      );

      if (success) {
        // Cache decrypted tokens in memory for performance
        this.memoryCache = {
          ...tokenData,
          expires_at: Date.now() + tokenData.expires_in * 1000,
          cached_at: Date.now(),
        };
        this.passphrase = passphrase;
      }

      return success;
    } catch (error) {
      console.error('Token storage failed:', error);
      throw new Error(FITBIT_ERRORS.ENCRYPTION_ERROR);
    }
  }

  /**
   * Retrieve and decrypt stored tokens.
   *
   * @param {string} passphrase - User encryption passphrase
   * @returns {Promise<Object|null>} Decrypted token data or null
   */
  async getStoredTokens(passphrase) {
    try {
      // Check memory cache first (valid for 5 minutes)
      if (
        this.memoryCache &&
        Date.now() - this.memoryCache.cached_at < 5 * 60 * 1000
      ) {
        return this.memoryCache;
      }

      const encrypted = await getTokens();
      if (!encrypted) return null;

      const decrypted = await decryptData(
        encrypted.encrypted,
        encrypted.salt,
        encrypted.iv,
        passphrase,
      );

      // Update memory cache
      this.memoryCache = {
        ...decrypted,
        expires_at: encrypted.metadata.expires_at,
        cached_at: Date.now(),
      };
      this.passphrase = passphrase;

      return this.memoryCache;
    } catch (error) {
      console.error('Token decryption failed:', error);
      this.memoryCache = null;
      throw new Error(FITBIT_ERRORS.ENCRYPTION_ERROR);
    }
  }

  /**
   * Get valid access token, refreshing if necessary.
   *
   * @param {string} passphrase - User encryption passphrase
   * @returns {Promise<string|null>} Valid access token or null
   */
  async getValidAccessToken(passphrase) {
    try {
      const tokens = await this.getStoredTokens(passphrase);
      if (!tokens) return null;

      const bufferMs = FITBIT_CONFIG.tokenBufferSeconds * 1000;
      const expiresAt = tokens.expires_at || 0;

      // Check if token needs refresh
      if (Date.now() + bufferMs >= expiresAt) {
        return await this.refreshAccessToken(passphrase);
      }

      return tokens.access_token;
    } catch (error) {
      console.error('Token validation failed:', error);
      return null;
    }
  }

  /**
   * Refresh access token using refresh token.
   *
   * @param {string} passphrase - User encryption passphrase
   * @returns {Promise<string|null>} New access token or null
   */
  async refreshAccessToken(passphrase) {
    // Prevent concurrent refresh attempts
    if (this.refreshPromise) {
      return await this.refreshPromise;
    }

    this.refreshPromise = this._performTokenRefresh(passphrase);

    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Internal token refresh implementation.
   *
   * @private
   * @param {string} passphrase - User encryption passphrase
   * @returns {Promise<string|null>} New access token or null
   */
  async _performTokenRefresh(passphrase) {
    try {
      const tokens = await this.getStoredTokens(passphrase);
      if (!tokens?.refresh_token) {
        throw new Error('No refresh token available');
      }

      const response = await fetch(FITBIT_CONFIG.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: FITBIT_CONFIG.clientId,
          grant_type: 'refresh_token',
          refresh_token: tokens.refresh_token,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Token refresh failed:', error);
        throw new Error(FITBIT_ERRORS.TOKEN_REFRESH_FAILED);
      }

      const newTokens = await response.json();

      // Store new tokens
      await this.storeTokensSecurely(newTokens, passphrase);

      return newTokens.access_token;
    } catch (error) {
      console.error('Token refresh error:', error);
      this.memoryCache = null; // Clear invalid cache
      throw error;
    }
  }

  /**
   * Revoke tokens and clear all data.
   *
   * @param {string} passphrase - User encryption passphrase
   * @returns {Promise<boolean>} Success status
   */
  async revokeTokens(passphrase) {
    try {
      const tokens = await this.getStoredTokens(passphrase);

      if (tokens?.refresh_token) {
        // Revoke with Fitbit API
        try {
          await fetch(FITBIT_CONFIG.revokeUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              client_id: FITBIT_CONFIG.clientId,
              token: tokens.refresh_token,
            }),
          });
        } catch (error) {
          console.warn(
            'Token revocation API failed (may already be invalid):',
            error,
          );
        }
      }

      // Clear local storage
      await clearFitbitData();
      this.memoryCache = null;
      this.passphrase = null;

      return true;
    } catch (error) {
      console.error('Token revocation failed:', error);
      return false;
    }
  }
}

/**
 * Main OAuth flow orchestrator.
 */
export class FitbitOAuth {
  constructor() {
    this.oauthState = new OAuthState();
    this.tokenManager = new TokenManager();
  }

  /**
   * Initiate OAuth authorization flow.
   *
   * @param {Array} scopes - OAuth scopes to request (defaults to MVP_SCOPES)
   * @returns {Promise<string>} Authorization URL to redirect to
   */
  async initiateAuth(scopes = MVP_SCOPES) {
    try {
      const { state, codeChallenge } = await this.oauthState.generateState();

      const authUrl = new URL(FITBIT_CONFIG.authUrl);
      authUrl.searchParams.set('client_id', FITBIT_CONFIG.clientId);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('redirect_uri', FITBIT_CONFIG.redirectUri);
      authUrl.searchParams.set('scope', scopes.join(' '));
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('code_challenge', codeChallenge);
      authUrl.searchParams.set(
        'code_challenge_method',
        FITBIT_CONFIG.codeChallenge.method,
      );

      return authUrl.toString();
    } catch (error) {
      console.error('OAuth initiation failed:', error);
      throw new Error(FITBIT_ERRORS.OAUTH_ERROR);
    }
  }

  /**
   * Handle OAuth callback and exchange code for tokens.
   *
   * @param {string} authorizationCode - Authorization code from callback
   * @param {string} state - State parameter from callback
   * @param {string} passphrase - User encryption passphrase
   * @returns {Promise<Object>} Token data
   */
  async handleCallback(authorizationCode, state, passphrase) {
    try {
      // Validate state and get PKCE verifier
      const codeVerifier = this.oauthState.validateCallback(state);
      if (!codeVerifier) {
        throw new Error('Invalid OAuth state');
      }

      // Exchange authorization code for tokens
      const response = await fetch(FITBIT_CONFIG.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: FITBIT_CONFIG.clientId,
          grant_type: 'authorization_code',
          code: authorizationCode,
          redirect_uri: FITBIT_CONFIG.redirectUri,
          code_verifier: codeVerifier,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Token exchange failed:', error);
        throw new Error(FITBIT_ERRORS.OAUTH_ERROR);
      }

      const tokenData = await response.json();

      // Store tokens securely
      await this.tokenManager.storeTokensSecurely(tokenData, passphrase);

      return tokenData;
    } catch (error) {
      console.error('OAuth callback handling failed:', error);
      throw error;
    }
  }

  /**
   * Check if user is currently authenticated.
   *
   * @param {string} passphrase - User encryption passphrase
   * @returns {Promise<boolean>} Authentication status
   */
  async isAuthenticated(passphrase) {
    try {
      const accessToken =
        await this.tokenManager.getValidAccessToken(passphrase);
      return !!accessToken;
    } catch {
      return false;
    }
  }

  /**
   * Get token manager instance.
   *
   * @returns {TokenManager} Token manager instance
   */
  getTokenManager() {
    return this.tokenManager;
  }
}

// Export singleton instance
export const fitbitOAuth = new FitbitOAuth();
