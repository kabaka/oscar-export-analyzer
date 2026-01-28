/**
 * OAuth callback handler component.
 *
 * Handles the OAuth redirect from Fitbit after user authorization.
 * Processes authorization codes, errors, and updates connection state.
 *
 * @component
 */

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useFitbitOAuth } from '../hooks/useFitbitOAuth.js';
import { FITBIT_ERRORS } from '../constants/fitbit.js';

/**
 * OAuth callback handler component.
 *
 * @param {Object} props - Component props
 * @param {Function} props.onSuccess - Success callback with token data
 * @param {Function} props.onError - Error callback
 * @param {string} props.passphrase - User encryption passphrase
 * @param {Function} props.onComplete - Called when processing complete (success or error)
 * @returns {JSX.Element} Callback handler UI
 */
export function OAuthCallbackHandler({
  onSuccess,
  onError,
  passphrase,
  onComplete,
}) {
  // FIX: Retrieve passphrase from sessionStorage if not provided as prop.
  // The passphrase is stored by initiateAuth when user clicks "Connect to Fitbit".
  // This ensures we have the passphrase for token encryption without requiring
  // a secondary passphrase prompt, preventing the double-validation race condition.
  const effectivePassphrase = useMemo(() => {
    if (passphrase) {
      return passphrase;
    }
    // Retrieve from sessionStorage (set by useFitbitOAuth.initiateAuth)
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('fitbit_oauth_passphrase');
    }
    return null;
  }, [passphrase]);

  // CRITICAL: Capture OAuth parameters BEFORE cleanup to prevent race condition
  // useMemo runs during render phase, guaranteeing params are captured before any cleanup
  const oauthParams = useMemo(() => {
    if (typeof window === 'undefined') return null;

    const urlParams = new URLSearchParams(window.location.search);
    return {
      code: urlParams.get('code'),
      state: urlParams.get('state'),
      error: urlParams.get('error'),
      errorDescription: urlParams.get('error_description'),
    };
  }, []); // Empty deps - only capture on initial mount

  // SECURITY: Clean URL immediately on mount (synchronously) to prevent browser history capture
  // This must happen BEFORE any async processing or useEffect to avoid ?code=... in back button
  // Now safe because params are already captured above
  // Also clean error parameters (?error=...&error_description=...) to prevent sensitive info leakage
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    if (
      urlParams.has('code') ||
      urlParams.has('state') ||
      urlParams.has('error')
    ) {
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, '', cleanUrl);
    }
  }

  const [processing, setProcessing] = useState(true);
  const [result, setResult] = useState(null);
  const hasProcessedRef = useRef(false);

  const {
    handleCallback,
    handleOAuthError,
    error: oauthError,
    isLoading,
  } = useFitbitOAuth({
    onSuccess: (tokenData) => {
      setResult({ type: 'success', data: tokenData });
      setProcessing(false);
      if (onSuccess) onSuccess(tokenData);
      if (onComplete) onComplete({ success: true, data: tokenData });
    },
    onError: (err) => {
      setResult({ type: 'error', error: err });
      setProcessing(false);
      if (onError) onError(err);
      if (onComplete) onComplete({ success: false, error: err });
    },
  });

  useEffect(() => {
    const processCallback = async () => {
      try {
        // Use captured OAuth parameters instead of reading from window.location
        // This prevents race condition where URL cleanup runs before params are read
        const { code, state, error, errorDescription } = oauthParams || {};

        // Handle OAuth errors
        if (error) {
          handleOAuthError(error, errorDescription);
          return;
        }

        // Handle successful authorization
        if (code && state && effectivePassphrase) {
          await handleCallback(code, state, effectivePassphrase);
          // Persist passphrase for this session so users can sync immediately after OAuth.
          if (typeof window !== 'undefined') {
            const storedPassphrase = sessionStorage.getItem(
              'fitbit_oauth_passphrase',
            );
            if (storedPassphrase) {
              sessionStorage.setItem(
                'fitbit_session_passphrase',
                storedPassphrase,
              );
            }
            sessionStorage.removeItem('fitbit_oauth_passphrase');
          }
        } else if (code && state && !effectivePassphrase) {
          throw new Error('Encryption passphrase required');
        } else {
          throw new Error('Missing authorization parameters');
        }
      } catch (err) {
        console.error('OAuth callback processing failed:', err);
        setResult({ type: 'error', error: err });
        setProcessing(false);
        if (onError) onError(err);
        if (onComplete) onComplete({ success: false, error: err });
      }
    };

    if (processing && (effectivePassphrase || oauthParams?.error)) {
      if (hasProcessedRef.current) return;
      hasProcessedRef.current = true;
      processCallback();
    } else if (processing && !effectivePassphrase) {
      // Wait for passphrase to be provided
      setResult({
        type: 'waiting',
        message: 'Waiting for encryption passphrase...',
      });
    }
  }, [
    processing,
    effectivePassphrase,
    oauthParams,
    handleCallback,
    handleOAuthError,
    onSuccess,
    onError,
    onComplete,
  ]);

  // Loading state
  if (processing || isLoading) {
    return (
      <div
        className="oauth-callback-handler loading"
        role="status"
        aria-live="polite"
      >
        <div className="loading-spinner" aria-hidden="true">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            className="animate-spin"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeDasharray="32 32"
            />
          </svg>
        </div>
        <h2>Connecting to Fitbit...</h2>
        <p>
          {result?.type === 'waiting'
            ? result.message
            : 'Processing your authorization...'}
        </p>
      </div>
    );
  }

  // Success state
  if (result?.type === 'success') {
    return (
      <div
        className="oauth-callback-handler success"
        role="status"
        aria-live="polite"
      >
        <div className="success-icon" aria-hidden="true">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        </div>
        <h2>Successfully Connected!</h2>
        <p>Your Fitbit account has been connected securely.</p>
        <details className="connection-details">
          <summary>Connection Details</summary>
          <ul>
            <li>Scopes: {result.data.scope}</li>
            <li>Connected: {new Date().toLocaleString()}</li>
            <li>
              Token expires:{' '}
              {new Date(
                Date.now() + result.data.expires_in * 1000,
              ).toLocaleString()}
            </li>
          </ul>
        </details>
      </div>
    );
  }

  // Error state
  if (result?.type === 'error' || oauthError) {
    const error = result?.error || oauthError;

    return (
      <div className="oauth-callback-handler error" role="alert">
        <div className="error-icon" aria-hidden="true">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
        </div>
        <h2>Connection Failed</h2>
        <p>{error?.message || 'An error occurred during authentication'}</p>

        {error?.type === FITBIT_ERRORS.OAUTH_CANCELLED && (
          <div className="error-suggestion">
            <p>
              <strong>Why did this happen?</strong>
              <br />
              You may have cancelled the authorization or denied access to
              required permissions.
            </p>
            <p>
              <strong>What can you do?</strong>
              <br />
              Try connecting again and make sure to grant the requested
              permissions.
            </p>
          </div>
        )}

        {error?.type === FITBIT_ERRORS.ENCRYPTION_ERROR && (
          <div className="error-suggestion">
            <p>
              <strong>Why did this happen?</strong>
              <br />
              An encryption passphrase is required to securely store your Fitbit
              tokens.
            </p>
            <p>
              <strong>What can you do?</strong>
              <br />
              Make sure you have set up data encryption in the app settings
              first.
            </p>
          </div>
        )}

        {error?.details && (
          <details className="error-details">
            <summary>Technical Details</summary>
            <pre>{error.details}</pre>
          </details>
        )}

        <div className="error-actions">
          <button
            type="button"
            onClick={() => {
              // Clear URL parameters and go back to main app
              const url = new URL(window.location);
              url.search = '';
              window.history.replaceState({}, '', url.pathname);
              if (onComplete)
                onComplete({ success: false, error, retry: true });
            }}
            className="primary-button"
          >
            Try Again
          </button>
          <button
            type="button"
            onClick={() => {
              // Go to main app without retry
              const url = new URL(window.location);
              url.search = '';
              window.history.replaceState({}, '', url.pathname);
              if (onComplete)
                onComplete({ success: false, error, retry: false });
            }}
            className="secondary-button"
          >
            Return to App
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export default OAuthCallbackHandler;
