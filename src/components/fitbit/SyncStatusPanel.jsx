import React from 'react';
import PropTypes from 'prop-types';

/**
 * Compact data synchronization status panel.
 *
 * Shows sync status indicator, sync button, and data availability metrics
 * in a compact card that integrates with the dashboard styling.
 *
 * @param {Object} props - Component props
 * @param {string} props.syncStatus - Current sync state: 'idle', 'syncing', 'error', 'completed'
 * @param {Date} [props.lastSync] - Last successful sync timestamp
 * @param {Date} [props.nextAutoSync] - Next scheduled auto-sync time
 * @param {boolean} props.autoSyncEnabled - Whether auto-sync is enabled
 * @param {Object} props.dataMetrics - Data availability by metric type
 * @param {Function} props.onSyncNow - Callback to trigger manual sync
 * @param {string} [props.errorMessage] - Error message if sync failed
 * @param {string} [props.className] - CSS class for styling
 * @returns {JSX.Element} Sync status panel component
 */
function SyncStatusPanel({
  syncStatus,
  lastSync,
  nextAutoSync,
  autoSyncEnabled,
  dataMetrics,
  onSyncNow,
  errorMessage,
  className = '',
}) {
  const isSyncing = syncStatus === 'syncing';
  const hasError = syncStatus === 'error';

  const getTimeAgo = (date) => {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  const getStatusColor = () => {
    if (syncStatus === 'error') return 'var(--color-text-error, #dc3545)';
    if (syncStatus === 'syncing') return 'var(--color-text-muted)';
    return 'var(--color-accent)';
  };

  const getStatusText = () => {
    if (syncStatus === 'syncing') return 'Syncing...';
    if (syncStatus === 'error') return 'Sync failed';
    if (syncStatus === 'completed') return 'Sync completed';
    return lastSync ? `Synced (${getTimeAgo(lastSync)})` : 'Ready to sync';
  };

  return (
    <div
      className={`sync-status-panel ${className}`}
      style={{
        padding: '1.5rem',
        backgroundColor: 'var(--color-surface)',
        borderRadius: '8px',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-2)',
      }}
      role="region"
      aria-labelledby="sync-panel-title"
    >
      {/* Header: title + status + sync button */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            flexWrap: 'wrap',
          }}
        >
          <h3
            id="sync-panel-title"
            style={{
              margin: 0,
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--color-text)',
            }}
          >
            Data Synchronization
          </h3>
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              fontSize: '0.875rem',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                color: getStatusColor(),
                animation: isSyncing ? 'spin 2s linear infinite' : 'none',
              }}
            >
              {isSyncing ? '◐' : '●'}
            </span>
            <span style={{ color: 'var(--color-text-muted)' }}>
              {getStatusText()}
            </span>
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          {nextAutoSync && autoSyncEnabled && (
            <span
              style={{
                fontSize: '0.8em',
                color: 'var(--color-text-muted)',
                whiteSpace: 'nowrap',
              }}
            >
              Next sync:{' '}
              {nextAutoSync.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
          <button
            onClick={onSyncNow}
            disabled={isSyncing}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: isSyncing
                ? 'var(--color-border)'
                : 'var(--color-accent)',
              color: 'var(--color-button-text, #ffffff)',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: isSyncing ? 'not-allowed' : 'pointer',
              opacity: isSyncing ? 0.7 : 1,
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap',
            }}
          >
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      </div>

      {/* Data metrics row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '1.5rem',
          marginTop: '1rem',
          paddingTop: '1rem',
          borderTop: '1px solid var(--color-border-light, var(--color-border))',
        }}
      >
        {[
          { key: 'heartRate', label: 'Heart Rate' },
          { key: 'sleepStages', label: 'Sleep Stages' },
          { key: 'spO2', label: 'SpO2' },
        ].map(({ key, label }) => {
          const nights = dataMetrics?.[key]?.nights ?? 0;
          const lastDate = dataMetrics?.[key]?.lastDate;
          return (
            <div
              key={key}
              className="metric-item"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.125rem',
                textAlign: 'center',
              }}
            >
              <span
                style={{
                  fontSize: '0.8em',
                  color: 'var(--color-text-muted)',
                }}
              >
                {label}
              </span>
              <span
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'var(--color-text)',
                }}
              >
                ✓ {nights} nights
              </span>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--color-text-muted)',
                }}
              >
                Last:{' '}
                {lastDate
                  ? lastDate.toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                    })
                  : 'N/A'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Error display */}
      {hasError && errorMessage && (
        <div
          style={{
            marginTop: '1rem',
            padding: '0.75rem 1rem',
            backgroundColor: 'var(--color-bg-error, #fef2f2)',
            border: '1px solid var(--color-border-error, #fecaca)',
            borderRadius: '6px',
            color: 'var(--color-text-error, #991b1b)',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
          role="alert"
        >
          <span aria-hidden="true">⚠️</span>
          <span>
            <strong>Sync failed:</strong> {errorMessage}
          </span>
          <button
            onClick={onSyncNow}
            style={{
              marginLeft: 'auto',
              backgroundColor: 'transparent',
              color: 'var(--color-text-error, #991b1b)',
              border: '1px solid var(--color-border-error, #fecaca)',
              borderRadius: '4px',
              padding: '0.25rem 0.5rem',
              fontSize: '0.8em',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Spinning animation for sync indicator */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

SyncStatusPanel.propTypes = {
  syncStatus: PropTypes.oneOf(['idle', 'syncing', 'error', 'completed'])
    .isRequired,
  lastSync: PropTypes.instanceOf(Date),
  nextAutoSync: PropTypes.instanceOf(Date),
  autoSyncEnabled: PropTypes.bool.isRequired,
  dataMetrics: PropTypes.shape({
    heartRate: PropTypes.shape({
      nights: PropTypes.number.isRequired,
      lastDate: PropTypes.instanceOf(Date).isRequired,
    }).isRequired,
    sleepStages: PropTypes.shape({
      nights: PropTypes.number.isRequired,
      lastDate: PropTypes.instanceOf(Date).isRequired,
    }).isRequired,
    spO2: PropTypes.shape({
      nights: PropTypes.number.isRequired,
      lastDate: PropTypes.instanceOf(Date).isRequired,
    }).isRequired,
  }).isRequired,
  onSyncNow: PropTypes.func.isRequired,
  errorMessage: PropTypes.string,
  className: PropTypes.string,
};

export default SyncStatusPanel;
