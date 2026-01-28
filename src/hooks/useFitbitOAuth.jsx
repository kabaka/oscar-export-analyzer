/**
 * React hook for managing Fitbit OAuth authentication flow.
 *
 * Provides functions and state for:
 * - Initiating OAuth authorization
 * - Handling OAuth callbacks
 * - Managing authentication status
 * - Error handling and user feedback
 *
 * @module hooks/useFitbitOAuth
 */

import { useState, useCallback } from 'react';
import { fitbitOAuth } from '../utils/fitbitAuth.js';
import { CONNECTION_STATUS, MVP_SCOPES } from '../constants/fitbit.js';
import { FITBIT_ERRORS } from '../constants/fitbitErrors.js';

/**
 * OAuth flow management hook.
 *
 * @param {Object} options - Hook configuration
 * @param {Function} options.onSuccess - Success callback
 * @param {Function} options.onError - Error callback
 * @returns {Object} OAuth flow state and methods
 */
export function useFitbitOAuth({ onSuccess, onError } = {}) {
  /**
   * Current connection status (see CONNECTION_STATUS)
   */
  const [status, setStatus] = useState(CONNECTION_STATUS.DISCONNECTED);
  /**
   * Last error encountered (object with code/message/type from FITBIT_ERRORS or native Error)
   */
  const [error, setError] = useState(null);
  /**
   * Loading state for async operations
   */
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Clear error state.
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Initiate OAuth authorization flow.
   * Redirects user to Fitbit authorization page.
   *
   * @param {Object} params - Authorization parameters
   * @param {Array} params.scopes - OAuth scopes (defaults to MVP_SCOPES)
   * @param {string} params.passphrase - User encryption passphrase for token storage
   * @returns {Promise<void>}
   */
  /**
   * Initiate OAuth authorization flow.
   * Redirects user to Fitbit authorization page.
   *
   * @param {Object} params - Authorization parameters
   * @param {Array} params.scopes - OAuth scopes (defaults to MVP_SCOPES)
   * @param {string} params.passphrase - User encryption passphrase for token storage
   * @returns {Promise<void>}
   */
  const initiateAuth = useCallback(
    async ({ scopes = MVP_SCOPES, passphrase = null } = {}) => {
      try {
        setIsLoading(true);
        setError(null);
        setStatus(CONNECTION_STATUS.CONNECTING);

        const authUrl = await fitbitOAuth.initiateAuth(scopes);

        // Store passphrase temporarily in sessionStorage for OAuth callback handler to retrieve.
        if (passphrase) {
          sessionStorage.setItem('fitbit_oauth_passphrase', passphrase);
        }

        window.location.assign(authUrl);
      } catch (err) {
        // Always use FITBIT_ERRORS.OAUTH_ERROR structure
        const errorObj = {
          code: FITBIT_ERRORS.OAUTH_ERROR.code,
          type: FITBIT_ERRORS.OAUTH_ERROR.type,
          message: FITBIT_ERRORS.OAUTH_ERROR.message,
          details: err?.message || err,
        };
        setError(errorObj);
        setStatus(CONNECTION_STATUS.ERROR);
        setIsLoading(false);
        if (onError) onError(errorObj);
      }
    },
    [onError],
  );

  /**
   * Handle OAuth callback from Fitbit.
   * Exchanges authorization code for access tokens.
   *
   * @param {string} authorizationCode - Authorization code from callback
   * @param {string} state - State parameter from callback
   * @param {string} passphrase - User encryption passphrase
   * @returns {Promise<Object>} Token data
   */
  /**
   * Handle OAuth callback from Fitbit.
   * Exchanges authorization code for access tokens.
   *
   * @param {string} authorizationCode - Authorization code from callback
   * @param {string} state - State parameter from callback
   * @param {string} passphrase - User encryption passphrase
   * @returns {Promise<Object>} Token data
   */
  /**
   * Handle OAuth callback from Fitbit.
   * Exchanges authorization code for access tokens.
   *
   * @param {string} authorizationCode - Authorization code from callback
   * @param {string} state - State parameter from callback
   * @param {string} passphrase - User encryption passphrase
   * @param {string} [codeVerifier] - PKCE code verifier (optional, if already retrieved)
   * @returns {Promise<Object>} Token data
   */
  const handleCallback = useCallback(
    async (authorizationCode, state, passphrase, codeVerifier) => {
      try {
        setIsLoading(true);
        setError(null);
        setStatus(CONNECTION_STATUS.CONNECTING);

        if (!authorizationCode || !state) {
          const errorObj = {
            code: FITBIT_ERRORS.INVALID_STATE.code,
            type: 'state',
            message: FITBIT_ERRORS.INVALID_STATE.message,
            details: 'Missing authorization parameters',
          };
          setError(errorObj);
          setStatus(CONNECTION_STATUS.ERROR);
          setIsLoading(false);
          if (onError) onError(errorObj);
          throw errorObj;
        }

        if (!passphrase) {
          const fallback = {
            code: 'encryption_error',
            type: 'encryption',
            message:
              'Encryption passphrase required to complete Fitbit connection.',
            details: 'Encryption passphrase required',
          };
          const encryptionError = {
            ...(FITBIT_ERRORS?.ENCRYPTION_ERROR || fallback),
            code: FITBIT_ERRORS?.ENCRYPTION_ERROR?.code || fallback.code,
            type: FITBIT_ERRORS?.ENCRYPTION_ERROR?.type || fallback.type,
            message:
              FITBIT_ERRORS?.ENCRYPTION_ERROR?.message || fallback.message,
            details: fallback.details,
          };
          setError(encryptionError);
          setStatus(CONNECTION_STATUS.ERROR);
          setIsLoading(false);
          if (onError) onError(encryptionError);
          throw encryptionError;
        }

        // If codeVerifier not provided, retrieve it (only once per flow)
        let verifier = codeVerifier;
        if (!verifier) {
          verifier = fitbitOAuth.oauthState.validateCallback(state);
          if (!verifier) {
            const errorObj = {
              code: FITBIT_ERRORS.INVALID_STATE.code,
              type: 'state',
              message: FITBIT_ERRORS.INVALID_STATE.message,
              details: 'OAuth state invalid or expired',
            };
            setError(errorObj);
            setStatus(CONNECTION_STATUS.ERROR);
            setIsLoading(false);
            if (onError) onError(errorObj);
            throw errorObj;
          }
        }

        // Now exchange code for tokens, passing the verifier
        const tokenData = await fitbitOAuth.handleCallback(
          authorizationCode,
          state,
          passphrase,
          verifier,
        );

        setStatus(CONNECTION_STATUS.CONNECTED);
        setIsLoading(false);

        if (onSuccess) onSuccess(tokenData);

        return tokenData;
      } catch (err) {
        console.error('OAuth callback failed:', err);
        let errorObj = {
          code: FITBIT_ERRORS.UNKNOWN.code || 'unknown_error',
          type: 'fitbit',
          message: FITBIT_ERRORS.UNKNOWN.message,
          details: err?.message || err,
        };
        if (err?.code && FITBIT_ERRORS[err.code]) {
          errorObj = {
            code: FITBIT_ERRORS[err.code].code || err.code,
            type: FITBIT_ERRORS[err.code].type || 'fitbit',
            message: FITBIT_ERRORS[err.code].message,
            details: err?.message || err,
          };
        } else if (
          err?.message &&
          /state|csrf|cancelled|invalid/i.test(err.message)
        ) {
          errorObj = {
            code: FITBIT_ERRORS.INVALID_STATE.code || 'invalid_state',
            type: 'state',
            message: FITBIT_ERRORS.INVALID_STATE.message,
            details: err?.message || err,
          };
        } else if (err?.message && /denied/i.test(err.message)) {
          errorObj = {
            code: FITBIT_ERRORS.OAUTH_DENIED.code || 'oauth_denied',
            type: 'oauth',
            message: FITBIT_ERRORS.OAUTH_DENIED.message,
            details: err?.message || err,
          };
        } else if (err?.message && /passphrase|encryption/i.test(err.message)) {
          errorObj = {
            code: FITBIT_ERRORS.ENCRYPTION_ERROR.code || 'encryption_error',
            type: 'encryption',
            message: FITBIT_ERRORS.ENCRYPTION_ERROR.message,
            details: err?.message || err,
          };
        }
        setError(errorObj);
        setStatus(CONNECTION_STATUS.ERROR);
        setIsLoading(false);
        if (onError) onError(errorObj);
        throw errorObj;
      }
    },
    [onSuccess, onError],
  );

  /**
   * Check current authentication status.
   *
   * @param {string} passphrase - User encryption passphrase
   * @returns {Promise<boolean>} Authentication status
   */
  const checkAuthStatus = useCallback(async (passphrase) => {
    try {
      setIsLoading(true);

      if (!passphrase) {
        setStatus(CONNECTION_STATUS.DISCONNECTED);
        return false;
      }

      const isAuthenticated = await fitbitOAuth.isAuthenticated(passphrase);

      if (isAuthenticated) {
        setStatus(CONNECTION_STATUS.CONNECTED);
      } else {
        setStatus(CONNECTION_STATUS.DISCONNECTED);
      }

      setIsLoading(false);
      return isAuthenticated;
    } catch (err) {
      console.error('Auth status check failed:', err);
      setStatus(CONNECTION_STATUS.ERROR);
      setIsLoading(false);
      return false;
    }
  }, []);

  /**
   * Disconnect from Fitbit (revoke tokens).
   *
   * @param {string} passphrase - User encryption passphrase
   * @returns {Promise<boolean>} Success status
   */
  const disconnect = useCallback(
    async (passphrase) => {
      try {
        setIsLoading(true);
        setError(null);

        if (!passphrase) {
          throw new Error('Encryption passphrase required');
        }

        const success = await fitbitOAuth
          .getTokenManager()
          .revokeTokens(passphrase);

        if (success) {
          setStatus(CONNECTION_STATUS.DISCONNECTED);
          if (onSuccess) onSuccess({ disconnected: true });
        } else {
          throw new Error('Token revocation failed');
        }

        setIsLoading(false);
        return success;
      } catch (err) {
        console.error('Disconnect failed:', err);
        setError({
          ...FITBIT_ERRORS.TOKEN_REVOKED,
          details: err?.message || err,
        });
        setIsLoading(false);
        if (onError)
          onError({
            ...FITBIT_ERRORS.TOKEN_REVOKED,
            details: err?.message || err,
          });
        return false;
      }
    },
    [onSuccess, onError],
  );

  /**
   * Handle OAuth errors from URL parameters.
   * Called when OAuth flow returns with error parameters.
   *
   * @param {string} errorCode - Error code from OAuth callback
   * @param {string} errorDescription - Error description
   */
  const handleOAuthError = useCallback(
    (errorCode, errorDescription) => {
      let message = 'Authentication failed';

      switch (errorCode) {
        case 'access_denied':
          message = 'Access was denied by user';
          break;
        case 'invalid_request':
          message = 'Invalid authentication request';
          break;
        case 'unsupported_response_type':
          message = 'Unsupported authentication method';
          break;
        default:
          message = errorDescription || 'Unknown authentication error';
      }

      setError({
        type: FITBIT_ERRORS.OAUTH_ERROR,
        message,
        details: `${errorCode}: ${errorDescription}`,
      });
      setStatus(CONNECTION_STATUS.ERROR);

      if (onError) {
        onError(new Error(message));
      }
    },
    [onError],
  );

  return {
    // State
    status,
    error,
    isLoading,
    isConnected: status === CONNECTION_STATUS.CONNECTED,
    isConnecting: status === CONNECTION_STATUS.CONNECTING,
    hasError: status === CONNECTION_STATUS.ERROR,

    // Actions
    initiateAuth,
    handleCallback,
    checkAuthStatus,
    disconnect,
    clearError,

    handleOAuthError,
  };
}
