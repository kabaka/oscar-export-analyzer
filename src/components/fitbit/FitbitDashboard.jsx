import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import FitbitConnectionCard from '../FitbitConnectionCard.jsx';
import { getTokens } from '../../utils/fitbitDb.js';
import SyncStatusPanel from './SyncStatusPanel';
import DualAxisSyncChart from './correlation/DualAxisSyncChart';
import CorrelationMatrix from './correlation/CorrelationMatrix';
import BivariateScatterPlot from './correlation/BivariateScatterPlot';
import { CONNECTION_STATUS } from '../../constants/fitbit';

/**
 * Main dashboard for Fitbit integration and correlation analysis.
 *
 * Orchestrates connection management, data sync, and visualization components.
 * Provides responsive layout that adapts from mobile to desktop viewports.
 *
 * @param {Object} props - Component props
 * @param {Object} props.fitbitData - Combined CPAP and Fitbit data
 * @param {string} props.connectionStatus - Current Fitbit connection state
 * @param {Object} props.syncState - Data synchronization state
 * @param {Function} props.onConnect - Callback to initiate Fitbit connection
 * @param {Function} props.onDisconnect - Callback to disconnect Fitbit
 * @param {Function} props.onSync - Callback to trigger data sync
 * @param {Function} props.onCorrelationAnalysis - Callback to run correlation analysis
 * @param {string} [props.className] - CSS class for container styling
 * @returns {JSX.Element} Complete Fitbit integration dashboard
 *
 * @example
 * <FitbitDashboard
 *   fitbitData={combinedData}
 *   connectionStatus="connected"
 *   syncState={{ status: 'idle', lastSync: new Date(), autoSync: true }}
 *   onConnect={() => startOAuthFlow()}
 *   onDisconnect={() => clearFitbitData()}
 *   onSync={() => syncFitbitData()}
 *   onCorrelationAnalysis={() => runCorrelationAnalysis()}
 * />
 */
function FitbitDashboard({
  fitbitData,
  connectionStatus,
  syncState,
  onConnect,
  onDisconnect,
  onSync,
  className = '',
}) {
  const [activeView, setActiveView] = useState('overview');
  const [selectedNight, setSelectedNight] = useState(null);
  const [selectedMetricPair, setSelectedMetricPair] = useState(null);

  const isConnected = connectionStatus === CONNECTION_STATUS.CONNECTED;
  const hasData =
    fitbitData && fitbitData.correlationData && fitbitData.nightlyData;

  // Async check for tokens in IndexedDB (tokens are stored there, not sessionStorage/localStorage)
  const [tokensExist, setTokensExist] = useState(false);
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
  }, [connectionStatus]);

  const passphraseMissing = !isConnected && tokensExist;

  // Auto-select most recent night on data load
  useEffect(() => {
    if (
      hasData &&
      fitbitData?.nightlyData &&
      fitbitData.nightlyData.length > 0
    ) {
      const sortedNights = [...fitbitData.nightlyData].sort(
        (a, b) => new Date(b.date) - new Date(a.date),
      );
      // Use queueMicrotask to avoid synchronous setState in effect
      queueMicrotask(() => setSelectedNight(sortedNights[0]));
    }
  }, [hasData, fitbitData]);

  const handleNightSelection = (nightData) => {
    setSelectedNight(nightData);
    setActiveView('nightly-detail');
  };

  const handleCorrelationDrillDown = (xMetric, yMetric, statistics) => {
    setSelectedMetricPair({ xMetric, yMetric, statistics });
    setActiveView('scatter-detail');
  };

  const handleViewChange = (view) => {
    setActiveView(view);
    if (view !== 'nightly-detail') setSelectedNight(null);
    if (view !== 'scatter-detail') setSelectedMetricPair(null);
  };

  // If tokens exist but passphrase is missing, always show connection card (prompt for passphrase)
  if (passphraseMissing) {
    return (
      <div
        className={`fitbit-dashboard-container ${className}`}
        data-testid="fitbit-dashboard-container"
      >
        <section style={{ marginBottom: '3rem' }}>
          <FitbitConnectionCard
            connectionStatus={connectionStatus}
            onConnect={onConnect}
            onDisconnect={onDisconnect}
            errorMessage={syncState.errorMessage}
            data-testid="fitbit-connection-card"
          />
        </section>
      </div>
    );
  }

  return (
    <div
      className={`fitbit-dashboard-container ${className}`}
      data-testid="fitbit-dashboard-container"
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Dashboard Header */}
        <header style={{ marginBottom: '2rem' }}>
          <h1
            style={{
              margin: '0 0 1rem 0',
              fontSize: '2rem',
              fontWeight: 'bold',
              color: 'var(--color-text)',
            }}
          >
            Fitbit + CPAP Correlation Analysis
          </h1>

          <p
            style={{
              margin: 0,
              fontSize: '1.1em',
              color: 'var(--color-text-muted)',
              lineHeight: 1.5,
            }}
          >
            Correlate heart rate, SpO2, and sleep stage data with your CPAP
            therapy metrics for deeper insights into sleep health patterns.
          </p>
        </header>

        {/* Connection Status Section */}
        {!isConnected && (
          <section style={{ marginBottom: '3rem' }}>
            <FitbitConnectionCard
              connectionStatus={connectionStatus}
              onConnect={onConnect}
              onDisconnect={onDisconnect}
              errorMessage={syncState.errorMessage}
              data-testid="fitbit-connection-card"
            />
          </section>
        )}

        {/* Sync Management Section (Connected only) */}
        {isConnected && (
          <section style={{ marginBottom: '3rem' }}>
            <SyncStatusPanel
              syncStatus={syncState.status}
              lastSync={syncState.lastSync}
              nextAutoSync={syncState.nextAutoSync}
              autoSyncEnabled={syncState.autoSyncEnabled}
              dataMetrics={syncState.dataMetrics}
              recentActivity={syncState.recentActivity}
              onSyncNow={onSync}
              onAutoSyncToggle={(enabled, interval) => {
                // Handle auto-sync toggle
                console.log('Auto-sync toggled:', enabled, interval);
              }}
              onViewHistory={() => {
                // Handle view history
                console.log('View sync history');
              }}
              errorMessage={syncState.errorMessage}
            />
          </section>
        )}

        {/* Navigation Tabs (Data available only) */}
        {hasData && (
          <nav
            style={{
              marginBottom: '2rem',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              gap: '2rem',
              overflowX: 'auto',
            }}
          >
            {[
              { key: 'overview', label: 'Overview', icon: '📊' },
              { key: 'correlations', label: 'Correlations', icon: '🔗' },
              {
                key: 'nightly-detail',
                label: selectedNight
                  ? `Night: ${selectedNight.date}`
                  : 'Night Detail',
                icon: '🌙',
              },
              {
                key: 'scatter-detail',
                label: selectedMetricPair
                  ? `${selectedMetricPair.xMetric} vs ${selectedMetricPair.yMetric}`
                  : 'Scatter Analysis',
                icon: '📈',
              },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleViewChange(tab.key)}
                disabled={tab.key === 'nightly-detail' && !selectedNight}
                style={{
                  padding: '1rem 1.5rem',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderBottom:
                    activeView === tab.key
                      ? '3px solid var(--color-accent)'
                      : '3px solid transparent',
                  color:
                    activeView === tab.key
                      ? 'var(--color-accent)'
                      : 'var(--color-text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.95em',
                  fontWeight: activeView === tab.key ? '600' : 'normal',
                  whiteSpace: 'nowrap',
                  opacity:
                    (tab.key === 'nightly-detail' && !selectedNight) ||
                    (tab.key === 'scatter-detail' && !selectedMetricPair)
                      ? 0.5
                      : 1,
                  transition: 'all 0.2s ease',
                }}
              >
                <span aria-hidden="true" style={{ marginRight: '0.5rem' }}>
                  {tab.icon}
                </span>
                {tab.label}
              </button>
            ))}
          </nav>
        )}

        {/* Main Content Area */}
        <main>
          {activeView === 'overview' && hasData && (
            <OverviewSection
              fitbitData={fitbitData}
              onNightSelect={handleNightSelection}
              onCorrelationSelect={handleCorrelationDrillDown}
            />
          )}

          {activeView === 'correlations' && hasData && (
            <CorrelationsSection
              correlationData={fitbitData.correlationData}
              onCellClick={handleCorrelationDrillDown}
            />
          )}

          {activeView === 'nightly-detail' && selectedNight && (
            <NightlyDetailSection
              nightData={selectedNight}
              onBackToOverview={() => handleViewChange('overview')}
            />
          )}

          {activeView === 'scatter-detail' && selectedMetricPair && (
            <ScatterDetailSection
              metricPair={selectedMetricPair}
              scatterData={fitbitData.scatterData}
              onBackToCorrelations={() => handleViewChange('correlations')}
            />
          )}

          {/* Empty States */}
          {!isConnected && (
            <EmptyStateCard
              icon="🔗"
              title="Connect Your Fitbit"
              description="Link your Fitbit account to start analyzing correlations between your heart rate, SpO2, sleep stages, and CPAP therapy data."
              action="Connect above to get started"
            />
          )}

          {isConnected && !hasData && (
            <EmptyStateCard
              icon="🔄"
              title="Sync Your Data"
              description="Synchronize your Fitbit data to begin correlation analysis with your CPAP metrics."
              action="Click 'Sync Now' above to begin"
            />
          )}
        </main>
      </div>
    </div>
  );
}

/**
 * Overview section with key metrics and recent nights.
 */
function OverviewSection({ fitbitData, onNightSelect, onCorrelationSelect }) {
  const recentNights = fitbitData.nightlyData?.slice(0, 7) || [];

  return (
    <div className="overview-section">
      <div
        style={{
          display: 'grid',
          gap: '2rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          marginBottom: '3rem',
        }}
      >
        {/* Quick Stats */}
        <div
          style={{
            padding: '2rem',
            backgroundColor: 'var(--color-surface)',
            borderRadius: '8px',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-2)',
          }}
        >
          <h3 style={{ margin: '0 0 1rem 0', color: 'var(--color-text)' }}>
            📊 Analysis Summary
          </h3>
          <div
            style={{
              display: 'grid',
              gap: '1rem',
              gridTemplateColumns: '1fr 1fr',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 'bold',
                  color: 'var(--color-accent)',
                }}
              >
                {fitbitData.summary?.totalNights || 0}
              </div>
              <div
                style={{ fontSize: '0.9em', color: 'var(--color-text-muted)' }}
              >
                Nights Analyzed
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 'bold',
                  color: 'var(--color-accent)',
                }}
              >
                {fitbitData.summary?.strongCorrelations || 0}
              </div>
              <div
                style={{ fontSize: '0.9em', color: 'var(--color-text-muted)' }}
              >
                Strong Correlations
              </div>
            </div>
          </div>
        </div>

        {/* Recent Nights */}
        <div
          style={{
            padding: '2rem',
            backgroundColor: 'var(--color-surface)',
            borderRadius: '8px',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-2)',
          }}
        >
          <h3 style={{ margin: '0 0 1rem 0', color: 'var(--color-text)' }}>
            🌙 Recent Nights
          </h3>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {recentNights.map((night) => (
              <button
                key={night.date}
                data-testid={`recent-night-btn-${night.date}`}
                onClick={() => onNightSelect(night)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--color-border)',
                  borderRadius: '4px',
                  marginBottom: '0.5rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s ease',
                  color: 'var(--color-text)',
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = 'var(--color-kpi-bg)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = 'transparent';
                }}
              >
                <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>
                  {new Date(night.date).toLocaleDateString([], {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </div>
                <div
                  style={{
                    fontSize: '0.85em',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  HR: {night.avgHeartRate}bpm • AHI: {night.ahi} • SpO2:{' '}
                  {night.minSpO2}%
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mini correlation matrix preview */}
      {fitbitData.correlationData && (
        <div
          style={{
            padding: '2rem',
            backgroundColor: 'var(--color-surface)',
            borderRadius: '8px',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-2)',
          }}
        >
          <h3 style={{ margin: '0 0 1rem 0', color: 'var(--color-text)' }}>
            🔗 Correlation Preview
          </h3>
          <div style={{ height: '300px' }}>
            <CorrelationMatrix
              correlationData={fitbitData.correlationData}
              onCellClick={onCorrelationSelect}
              showAnnotations={false}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Full correlations section.
 */
function CorrelationsSection({ correlationData, onCellClick }) {
  return (
    <div className="correlations-section">
      <CorrelationMatrix
        correlationData={correlationData}
        onCellClick={onCellClick}
        title={`Metric Correlations (${correlationData.sampleSize} nights)`}
      />
    </div>
  );
}

/**
 * Detailed nightly analysis section.
 */
function NightlyDetailSection({ nightData, onBackToOverview }) {
  return (
    <div className="nightly-detail-section">
      <div style={{ marginBottom: '2rem' }}>
        <button
          onClick={onBackToOverview}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: 'transparent',
            color: 'var(--color-accent)',
            border: '1px solid var(--color-accent)',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.9em',
            marginBottom: '1rem',
          }}
        >
          ← Back to Overview
        </button>

        <h2 style={{ margin: '0', color: 'var(--color-text)' }}>
          Night Detail:{' '}
          {new Date(nightData.date).toLocaleDateString([], {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </h2>
      </div>

      <DualAxisSyncChart
        title={`Heart Rate & AHI Events - ${nightData.date}`}
        data={nightData}
        onEventClick={(event) => {
          console.log('Event clicked:', event);
        }}
      />
    </div>
  );
}

/**
 * Detailed scatter plot analysis section.
 */
function ScatterDetailSection({
  metricPair,
  scatterData,
  onBackToCorrelations,
}) {
  return (
    <div className="scatter-detail-section">
      <div style={{ marginBottom: '2rem' }}>
        <button
          onClick={onBackToCorrelations}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: 'transparent',
            color: 'var(--color-accent)',
            border: '1px solid var(--color-accent)',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.9em',
            marginBottom: '1rem',
          }}
        >
          ← Back to Correlations
        </button>

        <h2 style={{ margin: '0', color: 'var(--color-text)' }}>
          {metricPair.yMetric} vs {metricPair.xMetric}
        </h2>
      </div>

      <BivariateScatterPlot
        xMetric={metricPair.xMetric}
        yMetric={metricPair.yMetric}
        scatterData={scatterData}
        onPointClick={(date) => {
          console.log('Point clicked:', date);
        }}
      />
    </div>
  );
}

/**
 * Empty state display component.
 */
function EmptyStateCard({ icon, title, description, action }) {
  return (
    <div
      style={{
        padding: '4rem 2rem',
        backgroundColor: 'var(--color-surface)',
        borderRadius: '8px',
        border: '1px solid var(--color-border)',
        textAlign: 'center',
        boxShadow: 'var(--shadow-2)',
      }}
    >
      <div
        style={{ fontSize: '3rem', marginBottom: '1rem' }}
        aria-hidden="true"
      >
        {icon}
      </div>
      <h3 style={{ margin: '0 0 1rem 0', color: 'var(--color-text)' }}>
        {title}
      </h3>
      <p
        style={{
          margin: '0 0 1rem 0',
          color: 'var(--color-text-muted)',
          fontSize: '1.1em',
          lineHeight: 1.5,
          maxWidth: '500px',
          marginLeft: 'auto',
          marginRight: 'auto',
        }}
      >
        {description}
      </p>
      <p
        style={{
          margin: 0,
          color: 'var(--color-accent)',
          fontSize: '0.95em',
          fontWeight: '500',
        }}
      >
        {action}
      </p>
    </div>
  );
}

FitbitDashboard.propTypes = {
  fitbitData: PropTypes.shape({
    nightlyData: PropTypes.arrayOf(PropTypes.object),
    correlationData: PropTypes.object,
    scatterData: PropTypes.object,
    summary: PropTypes.object,
  }),
  connectionStatus: PropTypes.oneOf(Object.values(CONNECTION_STATUS))
    .isRequired,
  syncState: PropTypes.shape({
    status: PropTypes.string.isRequired,
    lastSync: PropTypes.instanceOf(Date),
    nextAutoSync: PropTypes.instanceOf(Date),
    autoSyncEnabled: PropTypes.bool.isRequired,
    dataMetrics: PropTypes.object.isRequired,
    recentActivity: PropTypes.arrayOf(PropTypes.object).isRequired,
    errorMessage: PropTypes.string,
  }).isRequired,
  onConnect: PropTypes.func.isRequired,
  onDisconnect: PropTypes.func.isRequired,
  onSync: PropTypes.func.isRequired,
  onCorrelationAnalysis: PropTypes.func.isRequired,
  className: PropTypes.string,
};

OverviewSection.propTypes = {
  fitbitData: PropTypes.object.isRequired,
  onNightSelect: PropTypes.func.isRequired,
  onCorrelationSelect: PropTypes.func.isRequired,
};

CorrelationsSection.propTypes = {
  correlationData: PropTypes.object.isRequired,
  onCellClick: PropTypes.func.isRequired,
};

NightlyDetailSection.propTypes = {
  nightData: PropTypes.object.isRequired,
  onBackToOverview: PropTypes.func.isRequired,
};

ScatterDetailSection.propTypes = {
  metricPair: PropTypes.object.isRequired,
  scatterData: PropTypes.object.isRequired,
  onBackToCorrelations: PropTypes.func.isRequired,
};

EmptyStateCard.propTypes = {
  icon: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  action: PropTypes.string.isRequired,
};

export default FitbitDashboard;
