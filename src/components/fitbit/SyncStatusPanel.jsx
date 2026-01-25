import React, { useState } from 'react';
import PropTypes from 'prop-types';

/**
 * Data synchronization status panel with controls and metrics.
 *
 * Shows current sync status, allows manual sync, manages auto-sync settings,
 * and displays sync history with data availability metrics.
 *
 * @param {Object} props - Component props
 * @param {string} props.syncStatus - Current sync state: 'idle', 'syncing', 'error', 'completed'
 * @param {Date} [props.lastSync] - Last successful sync timestamp
 * @param {Date} [props.nextAutoSync] - Next scheduled auto-sync time
 * @param {boolean} props.autoSyncEnabled - Whether auto-sync is enabled
 * @param {Object} props.dataMetrics - Data availability by metric type
 * @param {Object} props.dataMetrics.heartRate - Heart rate data info
 * @param {number} props.dataMetrics.heartRate.nights - Number of nights with data
 * @param {Date} props.dataMetrics.heartRate.lastDate - Most recent data date
 * @param {Object} props.dataMetrics.sleepStages - Sleep stages data info
 * @param {Object} props.dataMetrics.spO2 - SpO2 data info
 * @param {Array<Object>} props.recentActivity - Recent sync activity log
 * @param {Function} props.onSyncNow - Callback to trigger manual sync
 * @param {Function} props.onAutoSyncToggle - Callback when auto-sync setting changed
 * @param {Function} props.onViewHistory - Callback to view detailed sync history
 * @param {string} [props.errorMessage] - Error message if sync failed
 * @param {string} [props.className] - CSS class for styling
 * @returns {JSX.Element} Sync status panel component
 *
 * @example
 * <SyncStatusPanel
 *   syncStatus="idle"
 *   lastSync={new Date('2026-01-24T08:30:00')}
 *   nextAutoSync={new Date('2026-01-25T06:00:00')}
 *   autoSyncEnabled={true}
 *   dataMetrics={{
 *     heartRate: { nights: 47, lastDate: new Date('2026-01-24') },
 *     sleepStages: { nights: 47, lastDate: new Date('2026-01-24') },
 *     spO2: { nights: 45, lastDate: new Date('2026-01-22') }
 *   }}
 *   recentActivity={[
 *     { time: new Date(), message: 'Synced 1 night (Jan 24)', type: 'success' }
 *   ]}
 *   onSyncNow={() => triggerSync()}
 *   onAutoSyncToggle={(enabled) => setAutoSync(enabled)}
 * />
 */
function SyncStatusPanel({
  syncStatus,
  lastSync,
  nextAutoSync,
  autoSyncEnabled,
  dataMetrics,
  recentActivity,
  onSyncNow,
  onAutoSyncToggle,
  onViewHistory,
  errorMessage,
  className = '',
}) {
  const [autoSyncMenuOpen, setAutoSyncMenuOpen] = useState(false);

  const isSyncing = syncStatus === 'syncing';
  const hasError = syncStatus === 'error';
  // isCompleted computed but not currently used

  const getStatusDisplay = () => {
    const statusConfig = {
      idle: {
        icon: '●',
        text: lastSync ? `Synced (${getTimeAgo(lastSync)})` : 'Ready to sync',
        color: '#28a745',
      },
      syncing: { icon: '◐', text: 'Syncing...', color: '#ffc107' },
      error: { icon: '●', text: 'Sync failed', color: '#dc3545' },
      completed: { icon: '●', text: 'Sync completed', color: '#28a745' },
    };

    const config = statusConfig[syncStatus] || statusConfig.idle;

    return (
      <span
        style={{
          color: config.color,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        <span
          aria-hidden="true"
          style={{ animation: isSyncing ? 'spin 2s linear infinite' : 'none' }}
        >
          {config.icon}
        </span>
        <span>{config.text}</span>
      </span>
    );
  };

  const formatNextSync = () => {
    if (!autoSyncEnabled || !nextAutoSync) return null;

    const now = new Date();
    const isToday = nextAutoSync.toDateString() === now.toDateString();

    if (isToday) {
      return `Today at ${nextAutoSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return nextAutoSync.toLocaleDateString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  };

  const getTimeAgo = (date) => {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  return (
    <div
      className={`sync-status-panel ${className}`}
      style={{
        width: '100%',
        maxWidth: '600px',
        padding: '2rem',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        backgroundColor: '#ffffff',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      }}
      role="region"
      aria-labelledby="sync-panel-title"
    >
      {/* Header */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <h3
          id="sync-panel-title"
          style={{
            margin: 0,
            fontSize: '1.25rem',
            fontWeight: '600',
            color: '#212529',
          }}
        >
          Data Synchronization
        </h3>
        <button
          onClick={onViewHistory}
          style={{
            padding: '0.5rem',
            backgroundColor: 'transparent',
            border: 'none',
            color: '#6c757d',
            cursor: 'pointer',
            fontSize: '1.2rem',
            borderRadius: '4px',
          }}
          aria-label="Sync settings"
          title="Sync settings"
        >
          ⚙️
        </button>
      </header>

      {/* Status Section */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ marginBottom: '0.5rem' }}>
          <strong style={{ color: '#495057' }}>Status: </strong>
          {getStatusDisplay()}
        </div>

        {nextAutoSync && autoSyncEnabled && (
          <div style={{ fontSize: '0.9em', color: '#6c757d' }}>
            Next automatic sync: {formatNextSync()}
          </div>
        )}
      </div>

      {/* Data Metrics Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
          padding: '1rem',
          backgroundColor: '#f8f9fa',
          borderRadius: '6px',
          border: '1px solid #e9ecef',
        }}
      >
        <div className="metric-item" style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: '0.85em',
              color: '#6c757d',
              marginBottom: '0.25rem',
            }}
          >
            Heart Rate
          </div>
          <div style={{ fontWeight: 'bold', color: '#495057' }}>
            ✓ {dataMetrics.heartRate.nights} nights
          </div>
          <div style={{ fontSize: '0.8em', color: '#6c757d' }}>
            Last:{' '}
            {dataMetrics.heartRate.lastDate.toLocaleDateString([], {
              month: 'short',
              day: 'numeric',
            })}
          </div>
        </div>

        <div className="metric-item" style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: '0.85em',
              color: '#6c757d',
              marginBottom: '0.25rem',
            }}
          >
            Sleep Stages
          </div>
          <div style={{ fontWeight: 'bold', color: '#495057' }}>
            ✓ {dataMetrics.sleepStages.nights} nights
          </div>
          <div style={{ fontSize: '0.8em', color: '#6c757d' }}>
            Last:{' '}
            {dataMetrics.sleepStages.lastDate.toLocaleDateString([], {
              month: 'short',
              day: 'numeric',
            })}
          </div>
        </div>

        <div className="metric-item" style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: '0.85em',
              color: '#6c757d',
              marginBottom: '0.25rem',
            }}
          >
            SpO2
          </div>
          <div style={{ fontWeight: 'bold', color: '#495057' }}>
            ✓ {dataMetrics.spO2.nights} nights
          </div>
          <div style={{ fontSize: '0.8em', color: '#6c757d' }}>
            Last:{' '}
            {dataMetrics.spO2.lastDate.toLocaleDateString([], {
              month: 'short',
              day: 'numeric',
            })}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <button
          onClick={onSyncNow}
          disabled={isSyncing}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: isSyncing ? '#6c757d' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '0.95em',
            fontWeight: '500',
            cursor: isSyncing ? 'not-allowed' : 'pointer',
            opacity: isSyncing ? 0.7 : 1,
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            if (!isSyncing) {
              e.target.style.backgroundColor = '#0056b3';
            }
          }}
          onMouseLeave={(e) => {
            if (!isSyncing) {
              e.target.style.backgroundColor = '#007bff';
            }
          }}
        >
          {isSyncing ? (
            <>
              <span aria-hidden="true">◐ </span>
              Syncing...
            </>
          ) : (
            'Sync Now'
          )}
        </button>

        {/* Auto-sync toggle */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setAutoSyncMenuOpen(!autoSyncMenuOpen)}
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'transparent',
              color: autoSyncEnabled ? '#28a745' : '#6c757d',
              border: `1px solid ${autoSyncEnabled ? '#28a745' : '#dee2e6'}`,
              borderRadius: '4px',
              fontSize: '0.95em',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            Auto-sync: {autoSyncEnabled ? 'ON' : 'OFF'}
            <span aria-hidden="true">▼</span>
          </button>

          {/* Auto-sync menu */}
          {autoSyncMenuOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                zIndex: 10,
                marginTop: '0.25rem',
                minWidth: '200px',
                backgroundColor: 'white',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              }}
            >
              <button
                onClick={() => {
                  onAutoSyncToggle(false);
                  setAutoSyncMenuOpen(false);
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  backgroundColor: !autoSyncEnabled ? '#f8f9fa' : 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '0.9em',
                }}
              >
                Manual only
              </button>
              <button
                onClick={() => {
                  onAutoSyncToggle(true, 'daily');
                  setAutoSyncMenuOpen(false);
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  backgroundColor: autoSyncEnabled ? '#f8f9fa' : 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '0.9em',
                }}
              >
                Daily at 6:00 AM
              </button>
              <button
                onClick={() => {
                  onAutoSyncToggle(true, '12h');
                  setAutoSyncMenuOpen(false);
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  backgroundColor: 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '0.9em',
                }}
              >
                Every 12 hours
              </button>
            </div>
          )}
        </div>

        <button
          onClick={onViewHistory}
          style={{
            padding: '0.75rem 1rem',
            backgroundColor: 'transparent',
            color: '#6c757d',
            border: '1px solid #dee2e6',
            borderRadius: '4px',
            fontSize: '0.95em',
            cursor: 'pointer',
          }}
        >
          View History
        </button>
      </div>

      {/* Error Display */}
      {hasError && errorMessage && (
        <div
          style={{
            backgroundColor: '#f8d7da',
            color: '#721c24',
            padding: '1rem',
            borderRadius: '4px',
            border: '1px solid #f5c6cb',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
          role="alert"
        >
          <span aria-hidden="true">⚠️</span>
          <div>
            <strong>Sync failed:</strong> {errorMessage}
            <div style={{ marginTop: '0.5rem' }}>
              <button
                onClick={onSyncNow}
                style={{
                  backgroundColor: 'transparent',
                  color: '#721c24',
                  border: '1px solid #f5c6cb',
                  borderRadius: '4px',
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.85em',
                  cursor: 'pointer',
                  marginRight: '0.5rem',
                }}
              >
                Retry
              </button>
              <button
                onClick={onViewHistory}
                style={{
                  backgroundColor: 'transparent',
                  color: '#721c24',
                  border: '1px solid #f5c6cb',
                  borderRadius: '4px',
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.85em',
                  cursor: 'pointer',
                }}
              >
                Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div>
        <h4
          style={{
            margin: '0 0 1rem 0',
            fontSize: '1rem',
            fontWeight: '600',
            color: '#495057',
          }}
        >
          Recent Activity:
        </h4>

        <ul
          style={{
            margin: 0,
            paddingLeft: '1.5rem',
            listStyle: 'none',
            fontSize: '0.9em',
            color: '#495057',
          }}
        >
          {recentActivity.map((activity, index) => (
            <li
              key={index}
              style={{
                marginBottom: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span style={{ color: getActivityColor(activity.type) }}>
                {getActivityIcon(activity.type)}
              </span>
              <span style={{ fontSize: '0.85em', color: '#6c757d' }}>
                {activity.time.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                -
              </span>
              <span>{activity.message}</span>
            </li>
          ))}
          {recentActivity.length === 0 && (
            <li style={{ color: '#6c757d', fontStyle: 'italic' }}>
              No recent sync activity
            </li>
          )}
        </ul>
      </div>

      {/* CSS for spinning animation */}
      <style>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

// Helper functions
function getActivityColor(type) {
  const colors = {
    success: '#28a745',
    error: '#dc3545',
    warning: '#ffc107',
    info: '#17a2b8',
  };
  return colors[type] || '#6c757d';
}

function getActivityIcon(type) {
  const icons = {
    success: '✓',
    error: '✗',
    warning: '⚠',
    info: 'ℹ',
  };
  return icons[type] || '•';
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
  recentActivity: PropTypes.arrayOf(
    PropTypes.shape({
      time: PropTypes.instanceOf(Date).isRequired,
      message: PropTypes.string.isRequired,
      type: PropTypes.oneOf(['success', 'error', 'warning', 'info']).isRequired,
    }),
  ).isRequired,
  onSyncNow: PropTypes.func.isRequired,
  onAutoSyncToggle: PropTypes.func.isRequired,
  onViewHistory: PropTypes.func.isRequired,
  errorMessage: PropTypes.string,
  className: PropTypes.string,
};

export default SyncStatusPanel;
