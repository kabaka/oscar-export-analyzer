/**
 * Fitbit connection card component.
 *
 * Primary UI for managing Fitbit integration - connection, status, and basic controls.
 * Follows UX specifications with responsive design and accessibility features.
 *
 * @component
 */

import React, { useState, useEffect } from 'react';
import { useFitbitOAuthContext } from '../context/FitbitOAuthContext.jsx';
import { useFitbitConnection } from '../hooks/useFitbitConnection.js';
import FitbitStatusIndicator from './FitbitStatusIndicator.jsx';
import { CONNECTION_STATUS, MVP_SCOPES } from '../constants/fitbit.js';
import { getTokens } from '../utils/fitbitDb.js';

/**
 * Calculate passphrase strength.
 * @param {string} pass - Passphrase to evaluate
 * @returns {'weak'|'medium'|'strong'} Strength level
 */
const getPassphraseStrength = (pass) => {
  if (!pass || pass.length < 8) return 'weak';
  if (pass.length < 12) return 'medium';

  // Check for variety: uppercase, lowercase, numbers, symbols
  const hasUppercase = /[A-Z]/.test(pass);
  const hasLowercase = /[a-z]/.test(pass);
  const hasNumbers = /[0-9]/.test(pass);
  const hasSymbols = /[^A-Za-z0-9]/.test(pass);

  const varietyCount = [
    hasUppercase,
    hasLowercase,
    hasNumbers,
    hasSymbols,
  ].filter(Boolean).length;

  if (pass.length >= 16 && varietyCount >= 3) return 'strong';
  if (pass.length >= 12 && varietyCount >= 2) return 'medium';
  return 'medium';
};

/**
 * Fitbit connection card component.
 *
 * @param {Object} props - Component props
 * @param {string|null} props.passphrase - Optional user encryption passphrase (for tests)
 * @param {Function} props.onConnectionChange - Callback when connection status changes
 * @param {Function} props.onError - Error callback
 * @param {boolean} props.showDataPreview - Whether to show data preview when connected
 * @param {string} props.variant - Layout variant ('card', 'inline')
 * @returns {JSX.Element} Connection card UI
 */
export function FitbitConnectionCard({
  passphrase = null,
  onConnectionChange = null,
  onError = null,
  showDataPreview = true,
  variant = 'card',
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSecurityInfo, setShowSecurityInfo] = useState(false);
  const [tokensExist, setTokensExist] = useState(false);
  const [recoveryError, setRecoveryError] = useState(null);

  // Internal passphrase state (used when passphrase prop not provided)
  const [internalPassphrase, setInternalPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);

  // Seed internal passphrase from context (e.g., recovered from sessionStorage after redirect)
  const {
    initiateAuth,
    status: oauthStatus,
    error: oauthError,
    isLoading: oauthLoading,
    clearError: clearOAuthError,
    passphrase: contextPassphrase,
    setPassphrase: setContextPassphrase,
    recoverWithPassphrase,
  } = useFitbitOAuthContext();

  React.useEffect(() => {
    if (passphrase === null && !internalPassphrase && contextPassphrase) {
      setInternalPassphrase(contextPassphrase);
    }
  }, [passphrase, internalPassphrase, contextPassphrase]);

  // Use prop passphrase if provided (for tests), otherwise use internal state
  const effectivePassphrase =
    passphrase !== null ? passphrase : internalPassphrase;
  const passphraseStrength = getPassphraseStrength(effectivePassphrase);

  // Connection state management
  const {
    status: connectionStatus,
    error: connectionError,
    connectionInfo,
    dataStats,
    lastSync,
    isRefreshing,
    checkConnection,
    refreshToken,
    disconnect,
    clearError: clearConnectionError,
  } = useFitbitConnection({
    passphrase: effectivePassphrase,
    autoCheck: !!effectivePassphrase,
  });

  // Combined status and error
  const currentStatus = oauthStatus || connectionStatus;
  const currentError = oauthError || connectionError;
  const isLoading = oauthLoading || isRefreshing;

  // Check if encrypted tokens exist in IndexedDB (for passphrase recovery)
  useEffect(() => {
    let cancelled = false;
    async function checkTokens() {
      try {
        const tokens = await getTokens();
        if (!cancelled) setTokensExist(!!tokens);
      } catch {
        if (!cancelled) setTokensExist(false);
      }
    }
    checkTokens();
    return () => {
      cancelled = true;
    };
  }, [currentStatus]);

  // Recovery mode: tokens exist but no active connection (passphrase lost)
  const isRecoveryMode =
    tokensExist && currentStatus !== CONNECTION_STATUS.CONNECTED;

  // Handle connection actions
  const handleConnect = async () => {
    try {
      clearOAuthError();
      clearConnectionError();
      setRecoveryError(null);

      if (!effectivePassphrase || effectivePassphrase.length < 8) {
        throw new Error(
          'Encryption passphrase required (minimum 8 characters)',
        );
      }

      // FIX: Pass passphrase to initiateAuth so it can be stored for OAuth callback.
      // This ensures passphrase is available when user is redirected back from Fitbit.
      await initiateAuth({
        scopes: MVP_SCOPES,
        passphrase: effectivePassphrase,
      });
    } catch (error) {
      console.error('Failed to initiate Fitbit connection:', error);
      if (onError) onError(error);
    }
  };

  /**
   * Attempt to recover Fitbit connection with a passphrase.
   * Tries to decrypt stored tokens without going through OAuth again.
   */
  const handleRecover = async () => {
    try {
      setRecoveryError(null);
      clearOAuthError();
      clearConnectionError();

      if (!effectivePassphrase || effectivePassphrase.length < 8) {
        setRecoveryError(
          'Encryption passphrase required (minimum 8 characters)',
        );
        return;
      }

      const success = await recoverWithPassphrase(effectivePassphrase);
      if (!success) {
        setRecoveryError('Incorrect passphrase. Please try again.');
      } else if (onConnectionChange) {
        onConnectionChange({
          type: 'recovered',
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      console.error('Passphrase recovery failed:', error);
      setRecoveryError('Failed to restore connection. Please try again.');
    }
  };

  const handleDisconnect = async () => {
    try {
      clearConnectionError();

      const success = await disconnect();
      if (success && onConnectionChange) {
        onConnectionChange({
          type: 'disconnected',
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      console.error('Failed to disconnect from Fitbit:', error);
      if (onError) onError(error);
    }
  };

  const handleRefresh = async () => {
    try {
      clearConnectionError();
      await refreshToken();
    } catch (error) {
      console.error('Failed to refresh Fitbit token:', error);
      if (onError) onError(error);
    }
  };

  const handleStatusAction = (action) => {
    switch (action) {
      case 'refresh':
        handleRefresh();
        break;
      case 'retry':
        if (currentStatus === CONNECTION_STATUS.DISCONNECTED) {
          handleConnect();
        } else {
          checkConnection();
        }
        break;
      default:
        console.warn('Unknown status action:', action);
    }
  };

  /**
   * Render Fitbit logo.
   */
  const renderFitbitLogo = () => (
    <div className="fitbit-logo" aria-hidden="true">
      <svg width="32" height="32" viewBox="0 0 32 32" fill="currentColor">
        <path d="M16 2C8.27 2 2 8.27 2 16s6.27 14 14 14 14-6.27 14-14S23.73 2 16 2zm0 25.2C9.49 27.2 4.8 22.51 4.8 16S9.49 4.8 16 4.8s11.2 4.69 11.2 11.2-4.69 11.2-11.2 11.2z" />
        <circle cx="16" cy="12" r="2" />
        <circle cx="16" cy="20" r="2" />
        <circle cx="12" cy="16" r="1.5" />
        <circle cx="20" cy="16" r="1.5" />
      </svg>
    </div>
  );

  /**
   * Render data preview for connected state.
   */
  const renderDataPreview = () => {
    if (!showDataPreview || !dataStats) return null;

    return (
      <div className="data-preview">
        <h4>Available Data</h4>
        <div className="data-stats">
          <div className="stat-item">
            <span className="stat-label">Records:</span>
            <span className="stat-value">{dataStats.totalRecords}</span>
          </div>

          {dataStats.dateRange && (
            <div className="stat-item">
              <span className="stat-label">Date range:</span>
              <span className="stat-value">
                {dataStats.dateRange[0]} to {dataStats.dateRange[1]}
              </span>
            </div>
          )}

          {dataStats.dataSources.length > 0 && (
            <div className="stat-item">
              <span className="stat-label">Metrics:</span>
              <span className="stat-value">
                {dataStats.dataSources.join(', ')}
              </span>
            </div>
          )}
        </div>

        {lastSync && (
          <div className="last-sync">
            <span className="sync-label">Last sync:</span>
            <span className="sync-time">
              {new Date(lastSync).toLocaleString()}
            </span>
          </div>
        )}
      </div>
    );
  };

  /**
   * Render security notice.
   */
  const renderSecurityNotice = () => (
    <div className="security-notice">
      <div className="security-summary">
        <span className="security-icon" aria-hidden="true">
          🔒
        </span>
        <span>Your data stays on your device</span>
        <button
          type="button"
          onClick={() => setShowSecurityInfo(!showSecurityInfo)}
          aria-expanded={showSecurityInfo}
          aria-controls="security-details"
          className="info-toggle"
        >
          {showSecurityInfo ? '▼' : '▶'}
        </button>
      </div>

      {showSecurityInfo && (
        <div id="security-details" className="security-details">
          <ul>
            <li>🔐 Tokens encrypted with your passphrase</li>
            <li>📱 No data sent to external servers</li>
            <li>🛡️ PKCE OAuth flow for maximum security</li>
            <li>🗑️ Easy to disconnect and remove all data</li>
          </ul>
        </div>
      )}
    </div>
  );

  /**
   * Render passphrase input UI (only when passphrase not provided as prop).
   */
  const renderPassphraseInput = () => {
    // Don't render if passphrase provided via prop (test mode)
    if (passphrase !== null) return null;

    // Don't render if already connected
    if (currentStatus === CONNECTION_STATUS.CONNECTED) return null;

    const strengthColors = {
      weak: '#dc3545',
      medium: '#ffc107',
      strong: '#28a745',
    };

    const strengthLabels = {
      weak: 'Weak',
      medium: 'Medium',
      strong: 'Strong',
    };

    return (
      <div className="passphrase-input-section">
        <label htmlFor="fitbit-passphrase" className="passphrase-label">
          Encryption Passphrase
          <span className="required-indicator" aria-label="required">
            *
          </span>
        </label>

        <div className="passphrase-input-wrapper">
          <input
            id="fitbit-passphrase"
            type={showPassphrase ? 'text' : 'password'}
            value={internalPassphrase}
            onChange={(e) => {
              setInternalPassphrase(e.target.value);
              if (setContextPassphrase) {
                setContextPassphrase(e.target.value || null);
              }
            }}
            placeholder="Enter strong passphrase (min 8 characters)"
            className="passphrase-input"
            aria-describedby="passphrase-help passphrase-strength"
            aria-required="true"
            autoComplete="off"
            disabled={isLoading}
          />

          <button
            type="button"
            onClick={() => setShowPassphrase(!showPassphrase)}
            className="passphrase-toggle"
            aria-label={showPassphrase ? 'Hide passphrase' : 'Show passphrase'}
            tabIndex={0}
          >
            {showPassphrase ? '👁️' : '👁️‍🗨️'}
          </button>
        </div>

        {internalPassphrase.length > 0 && (
          <div
            id="passphrase-strength"
            className="passphrase-strength"
            style={{ color: strengthColors[passphraseStrength] }}
            role="status"
            aria-live="polite"
          >
            Strength: <strong>{strengthLabels[passphraseStrength]}</strong>
            {passphraseStrength === 'weak' && internalPassphrase.length < 8 && (
              <span className="strength-hint"> (minimum 8 characters)</span>
            )}
          </div>
        )}

        <p id="passphrase-help" className="passphrase-help">
          Enter a strong passphrase to encrypt your Fitbit tokens. This keeps
          your data secure on your device.
          <span className="sr-only">
            Requirements: Minimum 8 characters. Recommended: 12+ characters with
            mixed case, numbers, and symbols for strong protection.
          </span>
        </p>
      </div>
    );
  };

  /**
   * Render action buttons based on connection state.
   */
  const renderActions = () => {
    if (currentStatus === CONNECTION_STATUS.CONNECTED) {
      return (
        <div className="action-buttons connected">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="secondary-button"
            aria-expanded={isExpanded}
          >
            {isExpanded ? 'Hide Details' : 'View Analysis'}
          </button>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoading}
            className="secondary-button"
            aria-label="Refresh connection"
          >
            {isRefreshing ? 'Refreshing...' : 'Sync Now'}
          </button>

          <div className="dropdown">
            <button
              type="button"
              className="dropdown-toggle"
              aria-haspopup="true"
              aria-label="More options"
            >
              •••
            </button>
            <div className="dropdown-menu">
              <button onClick={handleDisconnect}>Disconnect</button>
            </div>
          </div>
        </div>
      );
    } else if (currentStatus === CONNECTION_STATUS.CONNECTING) {
      return (
        <div className="action-buttons connecting">
          <button type="button" disabled className="primary-button loading">
            Connecting...
          </button>
        </div>
      );
    } else {
      // Check if passphrase is valid (at least 8 characters)
      const isPassphraseValid =
        effectivePassphrase && effectivePassphrase.length >= 8;

      // Recovery mode: tokens exist but passphrase was lost (e.g., page refresh)
      if (isRecoveryMode) {
        return (
          <div className="action-buttons disconnected">
            <button
              type="button"
              onClick={handleRecover}
              disabled={isLoading || !isPassphraseValid}
              className="primary-button"
              aria-describedby="passphrase-help"
            >
              {isLoading ? 'Restoring...' : 'Restore Connection'}
            </button>

            <button
              type="button"
              onClick={handleConnect}
              disabled={isLoading || !isPassphraseValid}
              className="secondary-button"
            >
              Connect with new account
            </button>
          </div>
        );
      }

      return (
        <div className="action-buttons disconnected">
          <button
            type="button"
            onClick={handleConnect}
            disabled={isLoading || !isPassphraseValid}
            className="primary-button"
            aria-describedby="security-notice passphrase-help"
          >
            {isLoading ? 'Connecting...' : 'Connect to Fitbit'}
          </button>

          <button
            type="button"
            onClick={() => setShowSecurityInfo(!showSecurityInfo)}
            className="secondary-button"
            aria-label="Learn more about security"
          >
            Learn More
          </button>
        </div>
      );
    }
  };

  return (
    <div
      className={`fitbit-connection-card ${variant} ${currentStatus}`}
      role="region"
      aria-labelledby="fitbit-card-title"
      aria-describedby="fitbit-card-description"
      data-testid="fitbit-connection-card"
    >
      <header className="card-header">
        {renderFitbitLogo()}
        <div className="header-content">
          <h3 id="fitbit-card-title">Connect Fitbit Data</h3>
          <FitbitStatusIndicator
            status={currentStatus}
            connectionInfo={connectionInfo}
            error={currentError}
            showDetails={false}
            size="medium"
            onAction={handleStatusAction}
          />
        </div>
      </header>

      <div className="card-body">
        <p id="fitbit-card-description" className="card-description">
          {currentStatus === CONNECTION_STATUS.CONNECTED
            ? 'Your Fitbit data is connected and ready for correlation analysis with your CPAP therapy data.'
            : isRecoveryMode
              ? 'Enter your passphrase to restore your Fitbit connection. Your encrypted tokens are still stored on this device.'
              : 'Correlate heart rate, SpO2, and sleep stages with your CPAP therapy data for deeper insights.'}
        </p>

        {currentStatus === CONNECTION_STATUS.CONNECTED && renderDataPreview()}

        {currentStatus !== CONNECTION_STATUS.CONNECTED &&
          renderPassphraseInput()}

        {currentStatus !== CONNECTION_STATUS.CONNECTED &&
          !isRecoveryMode &&
          renderSecurityNotice()}

        {recoveryError && (
          <div className="error-message" role="alert">
            <p>{recoveryError}</p>
          </div>
        )}

        {currentError && (
          <div className="error-message" role="alert">
            <p>{currentError.message}</p>
            {currentError.type && (
              <p className="error-type">Error: {currentError.type}</p>
            )}
          </div>
        )}
      </div>

      <footer className="card-footer">{renderActions()}</footer>

      {isExpanded && currentStatus === CONNECTION_STATUS.CONNECTED && (
        <div className="expanded-details">
          <FitbitStatusIndicator
            status={currentStatus}
            connectionInfo={connectionInfo}
            error={currentError}
            showDetails={true}
            size="large"
            onAction={handleStatusAction}
          />

          <div className="analysis-preview">
            <h4>Correlation Analysis</h4>
            <p>
              With Fitbit connected, you can now analyze correlations between:
            </p>
            <ul>
              <li>Heart rate variability and apnea events</li>
              <li>SpO2 levels and CPAP pressure settings</li>
              <li>Sleep stages and therapy effectiveness</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default FitbitConnectionCard;
