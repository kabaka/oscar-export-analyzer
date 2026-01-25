import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { CONNECTION_STATUS } from '../../constants/fitbit';

/**
 * Primary entry point for Fitbit integration, displayed in settings or dashboard.
 *
 * Shows connection status, data preview, and controls for connecting/disconnecting
 * Fitbit account. Provides security information and guides users through OAuth flow.
 *
 * @param {Object} props - Component props
 * @param {string} props.connectionStatus - Current connection state
 * @param {Function} props.onConnect - Callback to initiate connection
 * @param {Function} props.onDisconnect - Callback to disconnect account
 * @param {Date} [props.lastSyncDate] - Last successful sync timestamp
 * @param {Object} [props.dataPreview] - Preview of available data
 * @param {number} props.dataPreview.nightsAvailable - Number of nights with data
 * @param {Array<Date>} props.dataPreview.dateRange - [start, end] date range
 * @param {Array<string>} props.dataPreview.metrics - Available metric types
 * @param {string} [props.errorMessage] - Error message if connection failed
 * @param {string} [props.className] - CSS class for styling
 * @returns {JSX.Element} Fitbit connection card component
 *
 * @example
 * <FitbitConnectionCard
 *   connectionStatus="disconnected"
 *   onConnect={() => startOAuthFlow()}
 *   onDisconnect={() => clearFitbitData()}
 *   dataPreview={{
 *     nightsAvailable: 47,
 *     dateRange: [new Date('2025-12-08'), new Date('2026-01-24')],
 *     metrics: ['Heart Rate', 'SpO2', 'Sleep Stages']
 *   }}
 * />
 */
function FitbitConnectionCard({
  connectionStatus,
  onConnect,
  onDisconnect,
  lastSyncDate,
  dataPreview,
  errorMessage,
  className = '',
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const isConnected = connectionStatus === CONNECTION_STATUS.CONNECTED;
  const isConnecting = connectionStatus === CONNECTION_STATUS.CONNECTING;
  const hasError = connectionStatus === CONNECTION_STATUS.ERROR;

  const formatDateRange = (dateRange) => {
    if (!dateRange || dateRange.length !== 2) return 'No data range';
    const [start, end] = dateRange;
    return `${start.toLocaleDateString()} to ${end.toLocaleDateString()}`;
  };

  const getStatusIndicator = () => {
    const statusConfig = {
      [CONNECTION_STATUS.DISCONNECTED]: {
        icon: '●',
        text: 'Not Connected',
        color: '#6c757d',
      },
      [CONNECTION_STATUS.CONNECTING]: {
        icon: '◐',
        text: 'Connecting...',
        color: '#ffc107',
      },
      [CONNECTION_STATUS.CONNECTED]: {
        icon: '●',
        text: 'Connected',
        color: '#28a745',
      },
      [CONNECTION_STATUS.ERROR]: {
        icon: '●',
        text: 'Connection Error',
        color: '#dc3545',
      },
      [CONNECTION_STATUS.TOKEN_EXPIRED]: {
        icon: '●',
        text: 'Reconnection Required',
        color: '#fd7e14',
      },
    };

    const config =
      statusConfig[connectionStatus] ||
      statusConfig[CONNECTION_STATUS.DISCONNECTED];

    return (
      <span
        style={{
          color: config.color,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        <span aria-hidden="true">{config.icon}</span>
        <span>{config.text}</span>
        {isConnected && dataPreview && (
          <span style={{ color: '#6c757d', fontWeight: 'normal' }}>
            - {dataPreview.nightsAvailable} nights available
          </span>
        )}
      </span>
    );
  };

  return (
    <div
      className={`fitbit-connection-card ${className}`}
      style={{
        width: '100%',
        maxWidth: '400px',
        padding: '2rem',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        backgroundColor: '#ffffff',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      }}
      role="region"
      aria-labelledby="fitbit-card-title"
      aria-describedby="fitbit-card-description"
    >
      {/* Header */}
      <header style={{ marginBottom: '1.5rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            marginBottom: '0.5rem',
          }}
        >
          {/* Fitbit Logo */}
          <div
            style={{
              width: '32px',
              height: '32px',
              backgroundColor: '#00b0b9',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '18px',
              fontWeight: 'bold',
            }}
            aria-label="Fitbit logo"
          >
            F
          </div>
          <h3
            id="fitbit-card-title"
            style={{
              margin: 0,
              fontSize: '1.25rem',
              fontWeight: '600',
              color: '#212529',
            }}
          >
            {isConnected ? 'Fitbit Connected' : 'Connect Fitbit Data'}
          </h3>
          {isConnected && (
            <span
              style={{
                color: '#28a745',
                fontSize: '1.25rem',
                fontWeight: 'bold',
              }}
              aria-label="Connected successfully"
            >
              ✓
            </span>
          )}
        </div>

        <div style={{ marginBottom: '0.5rem' }}>{getStatusIndicator()}</div>

        {isConnected && lastSyncDate && (
          <div style={{ fontSize: '0.9em', color: '#6c757d' }}>
            Last sync: {lastSyncDate.toLocaleString()}
          </div>
        )}
      </header>

      {/* Body */}
      <div style={{ marginBottom: '1.5rem' }}>
        {/* Data Preview */}
        {isConnected && dataPreview ? (
          <div style={{ marginBottom: '1rem' }}>
            <p
              style={{
                margin: '0 0 0.5rem 0',
                fontSize: '0.95em',
                color: '#495057',
              }}
            >
              <strong>Data range:</strong>{' '}
              {formatDateRange(dataPreview.dateRange)}
            </p>
            <p
              style={{
                margin: '0 0 0.5rem 0',
                fontSize: '0.95em',
                color: '#495057',
              }}
            >
              <strong>Metrics:</strong> {dataPreview.metrics.join(', ')}
            </p>
          </div>
        ) : (
          !isConnected && (
            <div id="fitbit-card-description" style={{ marginBottom: '1rem' }}>
              <p
                style={{
                  margin: '0 0 1rem 0',
                  fontSize: '0.95em',
                  lineHeight: 1.4,
                  color: '#495057',
                }}
              >
                Correlate heart rate, SpO2, and sleep stages with your CPAP
                therapy data for deeper insights into your sleep health.
              </p>
            </div>
          )
        )}

        {/* Security Notice */}
        <div
          style={{
            backgroundColor: '#f8f9fa',
            padding: '1rem',
            borderRadius: '6px',
            border: '1px solid #e9ecef',
            fontSize: '0.9em',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '0.5rem',
            }}
          >
            <span aria-hidden="true">🔒</span>
            <strong>Your data stays on your device</strong>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: '#6c757d',
            }}
          >
            <span aria-hidden="true">🔐</span>
            <span>Optional encryption available</span>
          </div>
        </div>

        {/* Error Message */}
        {hasError && errorMessage && (
          <div
            style={{
              backgroundColor: '#f8d7da',
              color: '#721c24',
              padding: '0.75rem',
              borderRadius: '4px',
              border: '1px solid #f5c6cb',
              marginTop: '1rem',
              fontSize: '0.9em',
            }}
            role="alert"
          >
            <strong>Connection Failed:</strong> {errorMessage}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        {!isConnected ? (
          <>
            <button
              onClick={onConnect}
              disabled={isConnecting}
              aria-describedby="security-notice"
              aria-label={
                isConnecting ? 'Connecting to Fitbit...' : 'Connect to Fitbit'
              }
              style={{
                flex: '1',
                minWidth: '120px',
                padding: '0.75rem 1rem',
                backgroundColor: isConnecting ? '#6c757d' : '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '0.95em',
                fontWeight: '500',
                cursor: isConnecting ? 'not-allowed' : 'pointer',
                opacity: isConnecting ? 0.7 : 1,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (!isConnecting) {
                  e.target.style.backgroundColor = '#0056b3';
                }
              }}
              onMouseLeave={(e) => {
                if (!isConnecting) {
                  e.target.style.backgroundColor = '#007bff';
                }
              }}
            >
              {isConnecting ? (
                <>
                  <span aria-hidden="true">◐ </span>
                  Connecting...
                </>
              ) : (
                'Connect to Fitbit'
              )}
            </button>

            <button
              onClick={() => setIsExpanded(!isExpanded)}
              style={{
                padding: '0.75rem 1rem',
                backgroundColor: 'transparent',
                color: '#6c757d',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                fontSize: '0.95em',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#f8f9fa';
                e.target.style.borderColor = '#adb5bd';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'transparent';
                e.target.style.borderColor = '#dee2e6';
              }}
            >
              Learn More
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => (window.location.href = '/fitbit/analysis')}
              style={{
                flex: '1',
                minWidth: '100px',
                padding: '0.75rem 1rem',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '0.95em',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#1e7e34';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#28a745';
              }}
            >
              View Analysis
            </button>

            <button
              onClick={() => (window.location.href = '/fitbit/sync')}
              style={{
                padding: '0.75rem 1rem',
                backgroundColor: 'transparent',
                color: '#6c757d',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                fontSize: '0.95em',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#f8f9fa';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'transparent';
              }}
            >
              Sync Now
            </button>

            <button
              onClick={onDisconnect}
              style={{
                padding: '0.75rem 1rem',
                backgroundColor: 'transparent',
                color: '#dc3545',
                border: '1px solid #dc3545',
                borderRadius: '4px',
                fontSize: '0.95em',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#dc3545';
                e.target.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'transparent';
                e.target.style.color = '#dc3545';
              }}
            >
              ••• More
            </button>
          </>
        )}
      </div>

      {/* Learn More Expansion */}
      {isExpanded && !isConnected && (
        <div
          style={{
            marginTop: '1.5rem',
            paddingTop: '1.5rem',
            borderTop: '1px solid #dee2e6',
            fontSize: '0.9em',
            color: '#495057',
          }}
        >
          <h4
            style={{
              margin: '0 0 1rem 0',
              fontSize: '1em',
              fontWeight: '600',
              color: '#212529',
            }}
          >
            What data will be accessed?
          </h4>

          <ul
            style={{
              margin: '0 0 1rem 0',
              paddingLeft: '1.5rem',
              lineHeight: 1.5,
            }}
          >
            <li>
              <strong>Heart Rate:</strong> Minute-by-minute measurements during
              sleep
            </li>
            <li>
              <strong>Blood Oxygen:</strong> SpO2 readings every 5 minutes
            </li>
            <li>
              <strong>Sleep Stages:</strong> Light, Deep, and REM sleep periods
            </li>
          </ul>

          <p style={{ margin: 0, fontSize: '0.85em', color: '#6c757d' }}>
            Data is processed locally on your device and never sent to external
            servers. You can disconnect and delete all data at any time.
          </p>
        </div>
      )}

      {/* Screen reader only security notice */}
      <div id="security-notice" className="sr-only">
        Data remains on your device. Optional encryption available for sensitive
        health information.
      </div>
    </div>
  );
}

FitbitConnectionCard.propTypes = {
  connectionStatus: PropTypes.oneOf(Object.values(CONNECTION_STATUS))
    .isRequired,
  onConnect: PropTypes.func.isRequired,
  onDisconnect: PropTypes.func.isRequired,
  lastSyncDate: PropTypes.instanceOf(Date),
  dataPreview: PropTypes.shape({
    nightsAvailable: PropTypes.number.isRequired,
    dateRange: PropTypes.arrayOf(PropTypes.instanceOf(Date)).isRequired,
    metrics: PropTypes.arrayOf(PropTypes.string).isRequired,
  }),
  errorMessage: PropTypes.string,
  className: PropTypes.string,
};

export default FitbitConnectionCard;
