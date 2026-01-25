/**
 * Fitbit connection card component.
 *
 * Primary UI for managing Fitbit integration - connection, status, and basic controls.
 * Follows UX specifications with responsive design and accessibility features.
 *
 * @component
 */

import React, { useState } from 'react';
import { useFitbitOAuth } from '../hooks/useFitbitOAuth.js';
import { useFitbitConnection } from '../hooks/useFitbitConnection.js';
import FitbitStatusIndicator from './FitbitStatusIndicator.jsx';
import { CONNECTION_STATUS, MVP_SCOPES } from '../constants/fitbit.js';

/**
 * Fitbit connection card component.
 *
 * @param {Object} props - Component props
 * @param {string} props.passphrase - User encryption passphrase
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

  // OAuth flow management
  const {
    initiateAuth,
    status: oauthStatus,
    error: oauthError,
    isLoading: oauthLoading,
    clearError: clearOAuthError,
  } = useFitbitOAuth({
    onSuccess: (tokenData) => {
      if (onConnectionChange) {
        onConnectionChange({
          type: 'connected',
          data: tokenData,
          timestamp: Date.now(),
        });
      }
    },
    onError: (error) => {
      if (onError) onError(error);
    },
  });

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
    passphrase,
    autoCheck: !!passphrase,
  });

  // Combined status and error
  const currentStatus = oauthStatus || connectionStatus;
  const currentError = oauthError || connectionError;
  const isLoading = oauthLoading || isRefreshing;

  // Handle connection actions
  const handleConnect = async () => {
    try {
      clearOAuthError();
      clearConnectionError();

      if (!passphrase) {
        throw new Error('Encryption passphrase required for secure connection');
      }

      await initiateAuth({ scopes: MVP_SCOPES });
    } catch (error) {
      console.error('Failed to initiate Fitbit connection:', error);
      if (onError) onError(error);
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
      return (
        <div className="action-buttons disconnected">
          <button
            type="button"
            onClick={handleConnect}
            disabled={isLoading || !passphrase}
            className="primary-button"
            aria-describedby="security-notice"
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
            : 'Correlate heart rate, SpO2, and sleep stages with your CPAP therapy data for deeper insights.'}
        </p>

        {currentStatus === CONNECTION_STATUS.CONNECTED && renderDataPreview()}

        {currentStatus !== CONNECTION_STATUS.CONNECTED &&
          renderSecurityNotice()}

        {currentError && (
          <div className="error-message" role="alert">
            <p>{currentError.message}</p>
            {currentError.type && (
              <p className="error-type">Error: {currentError.type}</p>
            )}
          </div>
        )}

        {!passphrase && currentStatus === CONNECTION_STATUS.DISCONNECTED && (
          <div className="setup-notice" role="alert">
            <p>
              <strong>Setup Required:</strong> Enable data encryption in
              settings before connecting to Fitbit for secure token storage.
            </p>
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
