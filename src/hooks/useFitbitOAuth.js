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
import {
  FITBIT_ERRORS,
  CONNECTION_STATUS,
  MVP_SCOPES,
} from '../constants/fitbit.js';

/**
 * OAuth flow management hook.
 *
 * @param {Object} options - Hook configuration
 * @param {Function} options.onSuccess - Success callback
 * @param {Function} options.onError - Error callback
 * @returns {Object} OAuth flow state and methods
 */
export function useFitbitOAuth({ onSuccess, onError } = {}) {
  const [status, setStatus] = useState(CONNECTION_STATUS.DISCONNECTED);
  const [error, setError] = useState(null);
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
   * @returns {Promise<void>}
   */
  const initiateAuth = useCallback(
    async ({ scopes = MVP_SCOPES } = {}) => {
      try {
        setIsLoading(true);
        setError(null);
        setStatus(CONNECTION_STATUS.CONNECTING);

        const authUrl = await fitbitOAuth.initiateAuth(scopes);

        // Redirect to Fitbit authorization
        window.location.href = authUrl;
      } catch (err) {
        console.error('OAuth initiation failed:', err);
        setError({
          type: FITBIT_ERRORS.OAUTH_ERROR,
          message: 'Failed to start authentication process',
          details: err.message,
        });
        setStatus(CONNECTION_STATUS.ERROR);
        setIsLoading(false);

        if (onError) onError(err);
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
  const handleCallback = useCallback(
    async (authorizationCode, state, passphrase) => {
      try {
        setIsLoading(true);
        setError(null);
        setStatus(CONNECTION_STATUS.CONNECTING);

        if (!authorizationCode || !state) {
          throw new Error('Missing authorization parameters');
        }

        if (!passphrase) {
          throw new Error('Encryption passphrase required');
        }

        const tokenData = await fitbitOAuth.handleCallback(
          authorizationCode,
          state,
          passphrase,
        );

        setStatus(CONNECTION_STATUS.CONNECTED);
        setIsLoading(false);

        if (onSuccess) onSuccess(tokenData);

        return tokenData;
      } catch (err) {
        console.error('OAuth callback failed:', err);

        let errorType = FITBIT_ERRORS.OAUTH_ERROR;
        let message = 'Authentication failed';

        if (err.message.includes('state')) {
          errorType = FITBIT_ERRORS.OAUTH_CANCELLED;
          message = 'Authentication was cancelled or invalid';
        } else if (err.message.includes('passphrase')) {
          errorType = FITBIT_ERRORS.ENCRYPTION_ERROR;
          message = 'Encryption passphrase required';
        }

        setError({
          type: errorType,
          message,
          details: err.message,
        });
        setStatus(CONNECTION_STATUS.ERROR);
        setIsLoading(false);

        if (onError) onError(err);
        throw err;
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
          type: FITBIT_ERRORS.API_ERROR,
          message: 'Failed to disconnect from Fitbit',
          details: err.message,
        });
        setIsLoading(false);

        if (onError) onError(err);
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
    handleOAuthError,
    clearError,
  };
}
