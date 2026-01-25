/**
 * Fitbit connection status indicator component.
 *
 * Displays current connection status with appropriate visual indicators.
 * Provides quick status information and basic actions.
 *
 * @component
 */

import React, { useMemo } from 'react';
import { CONNECTION_STATUS } from '../constants/fitbit.js';

/**
 * Connection status indicator component.
 *
 * @param {Object} props - Component props
 * @param {string} props.status - Connection status from CONNECTION_STATUS
 * @param {Object} props.connectionInfo - Connection metadata
 * @param {Object} props.error - Error information if status is ERROR
 * @param {boolean} props.showDetails - Whether to show detailed information
 * @param {string} props.size - Size variant ('small', 'medium', 'large')
 * @param {Function} props.onAction - Callback for status-specific actions
 * @returns {JSX.Element} Status indicator UI
 */
export function FitbitStatusIndicator({
  status = CONNECTION_STATUS.DISCONNECTED,
  connectionInfo = null,
  error = null,
  showDetails = false,
  size = 'medium',
  onAction = null,
}) {
  /**
   * Get status display properties.
   */
  const getStatusProps = () => {
    switch (status) {
      case CONNECTION_STATUS.CONNECTED:
        return {
          icon: 'check-circle',
          label: 'Connected',
          color: 'success',
          bgColor: '#10B981',
          textColor: '#065F46',
          description: 'Your Fitbit data is available for analysis',
        };

      case CONNECTION_STATUS.CONNECTING:
        return {
          icon: 'loading',
          label: 'Connecting',
          color: 'warning',
          bgColor: '#F59E0B',
          textColor: '#92400E',
          description: 'Establishing connection to Fitbit...',
        };

      case CONNECTION_STATUS.TOKEN_EXPIRED:
        return {
          icon: 'refresh',
          label: 'Token Expired',
          color: 'warning',
          bgColor: '#F59E0B',
          textColor: '#92400E',
          description: 'Connection expired, refresh required',
        };

      case CONNECTION_STATUS.ERROR:
        return {
          icon: 'x-circle',
          label: 'Error',
          color: 'error',
          bgColor: '#EF4444',
          textColor: '#991B1B',
          description: error?.message || 'Connection error occurred',
        };

      default:
        return {
          icon: 'minus-circle',
          label: 'Not Connected',
          color: 'neutral',
          bgColor: '#6B7280',
          textColor: '#374151',
          description: 'Connect your Fitbit to enable data correlation',
        };
    }
  };

  /**
   * Render status icon.
   */
  const renderIcon = (iconType) => {
    const iconSize = {
      small: 16,
      medium: 20,
      large: 24,
    }[size];

    switch (iconType) {
      case 'check-circle':
        return (
          <svg
            width={iconSize}
            height={iconSize}
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
          </svg>
        );

      case 'loading':
        return (
          <svg
            width={iconSize}
            height={iconSize}
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
        );

      case 'refresh':
        return (
          <svg
            width={iconSize}
            height={iconSize}
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
          </svg>
        );

      case 'x-circle':
        return (
          <svg
            width={iconSize}
            height={iconSize}
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z" />
          </svg>
        );

      default:
        return (
          <svg
            width={iconSize}
            height={iconSize}
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h2v-6h-2v6zm1-8c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z" />
          </svg>
        );
    }
  };

  /**
   * Format time remaining until token expiry.
   */
  const formatTimeToExpiry = useMemo(() => {
    return (expiresAt) => {
      if (!expiresAt) return '';

      const now = Date.now();
      const diff = expiresAt - now;

      if (diff <= 0) return 'Expired';

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      } else {
        return `${minutes}m`;
      }
    };
  }, []); // Empty dependency array since we don't depend on any props/state

  const statusProps = getStatusProps();

  return (
    <div
      className={`fitbit-status-indicator ${status} ${size}`}
      role="status"
      aria-live="polite"
      aria-label={`Fitbit connection status: ${statusProps.label}`}
    >
      <div className="status-main">
        <div
          className="status-icon"
          style={{ color: statusProps.bgColor }}
          aria-hidden="true"
        >
          {renderIcon(statusProps.icon, statusProps.color)}
        </div>

        <div className="status-content">
          <span className="status-label">{statusProps.label}</span>

          {showDetails && (
            <span className="status-description">
              {statusProps.description}
            </span>
          )}
        </div>
      </div>

      {showDetails &&
        connectionInfo &&
        status === CONNECTION_STATUS.CONNECTED && (
          <div className="status-details">
            <div className="detail-item">
              <span className="detail-label">Connected:</span>
              <span className="detail-value">
                {new Date(connectionInfo.connectedAt).toLocaleDateString()}
              </span>
            </div>

            {connectionInfo.expiresAt && (
              <div className="detail-item">
                <span className="detail-label">Token expires:</span>
                <span className="detail-value">
                  {formatTimeToExpiry(connectionInfo.expiresAt)}
                </span>
              </div>
            )}

            {connectionInfo.scope && (
              <div className="detail-item">
                <span className="detail-label">Permissions:</span>
                <span className="detail-value">
                  {connectionInfo.scope.replace(/ /g, ', ')}
                </span>
              </div>
            )}
          </div>
        )}

      {showDetails && error && status === CONNECTION_STATUS.ERROR && (
        <div className="status-error">
          <div className="error-message">{error.message}</div>
          {error.details && (
            <details className="error-details">
              <summary>Details</summary>
              <pre>{error.details}</pre>
            </details>
          )}
        </div>
      )}

      {onAction &&
        (status === CONNECTION_STATUS.TOKEN_EXPIRED ||
          status === CONNECTION_STATUS.ERROR) && (
          <div className="status-actions">
            <button
              type="button"
              onClick={() =>
                onAction(
                  status === CONNECTION_STATUS.TOKEN_EXPIRED
                    ? 'refresh'
                    : 'retry',
                )
              }
              className="status-action-button"
              aria-label={
                status === CONNECTION_STATUS.TOKEN_EXPIRED
                  ? 'Refresh connection'
                  : 'Retry connection'
              }
            >
              {status === CONNECTION_STATUS.TOKEN_EXPIRED ? 'Refresh' : 'Retry'}
            </button>
          </div>
        )}
    </div>
  );
}

export default FitbitStatusIndicator;
