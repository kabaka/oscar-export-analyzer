import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import FitbitConnectionCard from '../FitbitConnectionCard.jsx';
import { getTokens } from '../../utils/fitbitDb.js';
import SyncStatusPanel from './SyncStatusPanel';
import DualAxisSyncChart from './correlation/DualAxisSyncChart';
import CorrelationMatrix from './correlation/CorrelationMatrix';
import BivariateScatterPlot from './correlation/BivariateScatterPlot';
import { CONNECTION_STATUS } from '../../constants/fitbit';
import { computeHeartRateSummary } from '../../utils/fitbitHeartRateParser';
import { METRIC_LABELS } from '../../hooks/useFitbitAnalysis';

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
    fitbitData &&
    fitbitData.correlationData &&
    fitbitData.correlationData.metrics &&
    fitbitData.correlationData.metrics.length > 0 &&
    fitbitData.nightlyData;
  const hasSyncedHeartRateData =
    fitbitData &&
    fitbitData.heartRateData &&
    fitbitData.heartRateData.length > 0;
  const hasAnyData = hasData || hasSyncedHeartRateData;

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
            Syncs heart rate and SpO2 data for correlation with AHI and other
            CPAP metrics for deeper insights into sleep health patterns.
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
              description="Link your Fitbit account to start analyzing correlations between your heart rate, SpO2, and CPAP therapy data."
              action="Connect above to get started"
            />
          )}

          {isConnected && !hasAnyData && (
            <EmptyStateCard
              icon="🔄"
              title="Sync Your Data"
              description="Synchronize your Fitbit data to begin correlation analysis with your CPAP metrics."
              action="Click 'Sync Now' above to begin"
            />
          )}

          {/* Synced Heart Rate Data (when no full correlation data yet) */}
          {isConnected && hasSyncedHeartRateData && !hasData && (
            <HeartRateDataSection
              heartRateData={fitbitData.heartRateData}
              heartRateIntraday={fitbitData.heartRateIntraday}
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
        title={`Metric Correlations (${correlationData.sampleSize ?? 'N/A'} nights)`}
      />
    </div>
  );
}

/**
 * Converts a time string "HH:MM:SS" or "HH:MM" to minutes since midnight.
 */
function timeToMinutes(timeStr) {
  const parts = timeStr.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

/**
 * Peak-preserving downsampling for SVG rendering performance.
 * Divides data into buckets and keeps min/max in each bucket to preserve
 * signal peaks and troughs, which are clinically important for HR data.
 *
 * @param {Array} data - Array of { time, bpm } objects
 * @param {number} targetPoints - Approximate number of output points
 * @returns {Array} Downsampled array preserving extremes
 */
function downsampleIntraday(data, targetPoints = 200) {
  if (!data || data.length <= targetPoints) return data;

  const bucketSize = Math.ceil(data.length / targetPoints);
  const result = [];

  for (let i = 0; i < data.length; i += bucketSize) {
    const bucket = data.slice(i, i + bucketSize);
    let minItem = bucket[0];
    let maxItem = bucket[0];

    for (const item of bucket) {
      if (item.bpm < minItem.bpm) minItem = item;
      if (item.bpm > maxItem.bpm) maxItem = item;
    }

    if (minItem === maxItem) {
      result.push(minItem);
    } else {
      // Emit in chronological order to keep the path smooth
      const minIdx = bucket.indexOf(minItem);
      const maxIdx = bucket.indexOf(maxItem);
      if (minIdx <= maxIdx) {
        result.push(minItem, maxItem);
      } else {
        result.push(maxItem, minItem);
      }
    }
  }

  return result;
}

/**
 * Inline SVG chart for intraday heart rate data.
 * Uses viewBox for responsiveness and CSS custom properties for dark mode support.
 * Downsamples ~1440 points to ~200 for SVG rendering performance.
 */
function IntradayHeartRateChart({
  intradayData,
  intradayStats,
  date,
  restingHR,
}) {
  const downsampled = useMemo(
    () => downsampleIntraday(intradayData, 200),
    [intradayData],
  );

  if (!downsampled || downsampled.length === 0) return null;

  const svgWidth = 800;
  const svgHeight = 200;
  const pad = { top: 20, right: 60, bottom: 30, left: 50 };
  const chartW = svgWidth - pad.left - pad.right;
  const chartH = svgHeight - pad.top - pad.bottom;

  // Y-axis: auto-scale with 10% padding
  const bpmValues = downsampled.map((d) => d.bpm).filter(Number.isFinite);
  const rawMin = Math.min(...bpmValues);
  const rawMax = Math.max(...bpmValues);
  const bpmRange = rawMax - rawMin || 1;
  const yMin = Math.floor(rawMin - bpmRange * 0.1);
  const yMax = Math.ceil(rawMax + bpmRange * 0.1);

  const xScale = (minutes) => pad.left + (minutes / 1440) * chartW;
  const yScale = (bpm) =>
    pad.top + chartH - ((bpm - yMin) / (yMax - yMin)) * chartH;

  // Build SVG path
  const linePath = downsampled
    .map((d, i) => {
      const x = xScale(timeToMinutes(d.time)).toFixed(1);
      const y = yScale(d.bpm).toFixed(1);
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    })
    .join(' ');

  // Overnight shading rects (10PM–midnight and midnight–7AM)
  const nightStartX = xScale(22 * 60);
  const nightEndX = xScale(7 * 60);
  const dayEndX = xScale(1440);

  // Resting HR reference line
  const restingY =
    restingHR != null && restingHR >= yMin && restingHR <= yMax
      ? yScale(restingHR)
      : null;

  // Time labels at 3-hour intervals
  const timeLabels = [0, 3, 6, 9, 12, 15, 18, 21].map((h) => ({
    label: h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`,
    x: xScale(h * 60),
  }));

  // Y-axis ticks
  const yTickCount = 5;
  const yLabels = Array.from({ length: yTickCount + 1 }, (_, i) => {
    const val = yMin + (i * (yMax - yMin)) / yTickCount;
    return { label: Math.round(val), y: yScale(val) };
  });

  return (
    <div
      style={{
        padding: '1.5rem',
        backgroundColor: 'var(--color-surface)',
        borderRadius: '8px',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-2)',
        marginBottom: '1.5rem',
      }}
    >
      <h3
        style={{
          margin: '0 0 0.5rem 0',
          color: 'var(--color-text)',
          fontSize: '1.1em',
        }}
      >
        <span aria-hidden="true" style={{ marginRight: '0.5rem' }}>
          💓
        </span>
        Intraday Heart Rate — {date}
      </h3>

      {/* Stats row */}
      {intradayStats && (
        <div
          style={{
            display: 'flex',
            gap: '1.5rem',
            marginBottom: '1rem',
            flexWrap: 'wrap',
            fontSize: '0.9em',
          }}
        >
          <span style={{ color: 'var(--color-text-muted)' }}>
            Min:{' '}
            <strong style={{ color: 'var(--color-text)' }}>
              {intradayStats.minBpm} bpm
            </strong>
          </span>
          <span style={{ color: 'var(--color-text-muted)' }}>
            Max:{' '}
            <strong style={{ color: 'var(--color-text)' }}>
              {intradayStats.maxBpm} bpm
            </strong>
          </span>
          <span style={{ color: 'var(--color-text-muted)' }}>
            Avg:{' '}
            <strong style={{ color: 'var(--color-text)' }}>
              {intradayStats.avgBpm} bpm
            </strong>
          </span>
          <span style={{ color: 'var(--color-text-muted)' }}>
            Data points:{' '}
            <strong style={{ color: 'var(--color-text)' }}>
              {intradayStats.dataPoints}
            </strong>
          </span>
        </div>
      )}

      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        width="100%"
        role="img"
        aria-label={`Intraday heart rate chart for ${date}. ${intradayStats ? `Range: ${intradayStats.minBpm} to ${intradayStats.maxBpm} bpm, average ${intradayStats.avgBpm} bpm.` : ''}`}
        style={{ display: 'block' }}
      >
        {/* Overnight shading: 10PM to midnight */}
        <rect
          x={nightStartX}
          y={pad.top}
          width={dayEndX - nightStartX}
          height={chartH}
          fill="var(--color-kpi-bg)"
          opacity="0.5"
        />
        {/* Overnight shading: midnight to 7AM */}
        <rect
          x={pad.left}
          y={pad.top}
          width={nightEndX - pad.left}
          height={chartH}
          fill="var(--color-kpi-bg)"
          opacity="0.5"
        />

        {/* Horizontal grid lines + Y labels */}
        {yLabels.map((tick, i) => (
          <g key={`y-${i}`}>
            <line
              x1={pad.left}
              y1={tick.y}
              x2={svgWidth - pad.right}
              y2={tick.y}
              stroke="var(--color-border)"
              strokeWidth="0.5"
            />
            <text
              x={pad.left - 8}
              y={tick.y + 4}
              textAnchor="end"
              fontSize="10"
              fill="var(--color-text-muted)"
            >
              {tick.label}
            </text>
          </g>
        ))}

        {/* Vertical grid lines + time labels */}
        {timeLabels.map((tick, i) => (
          <g key={`x-${i}`}>
            <line
              x1={tick.x}
              y1={pad.top}
              x2={tick.x}
              y2={pad.top + chartH}
              stroke="var(--color-border)"
              strokeWidth="0.5"
              strokeDasharray="3,3"
            />
            <text
              x={tick.x}
              y={svgHeight - 5}
              textAnchor="middle"
              fontSize="10"
              fill="var(--color-text-muted)"
            >
              {tick.label}
            </text>
          </g>
        ))}

        {/* Resting HR reference line */}
        {restingY != null && (
          <g>
            <line
              x1={pad.left}
              y1={restingY}
              x2={svgWidth - pad.right}
              y2={restingY}
              stroke="var(--color-accent)"
              strokeWidth="1"
              strokeDasharray="6,4"
              opacity="0.6"
            />
            <text
              x={svgWidth - pad.right + 4}
              y={restingY + 4}
              fontSize="9"
              fill="var(--color-accent)"
            >
              Rest {restingHR}
            </text>
          </g>
        )}

        {/* Data line */}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
      </svg>
    </div>
  );
}

IntradayHeartRateChart.propTypes = {
  intradayData: PropTypes.arrayOf(
    PropTypes.shape({
      time: PropTypes.string.isRequired,
      bpm: PropTypes.number.isRequired,
    }),
  ).isRequired,
  intradayStats: PropTypes.shape({
    minBpm: PropTypes.number,
    maxBpm: PropTypes.number,
    avgBpm: PropTypes.number,
    dataPoints: PropTypes.number,
  }),
  date: PropTypes.string.isRequired,
  restingHR: PropTypes.number,
};

/** KPI-style card for a single metric. */
function KpiCard({ label, value, unit, icon }) {
  return (
    <div
      style={{
        padding: '1rem',
        backgroundColor: 'var(--color-kpi-bg)',
        borderRadius: '6px',
        textAlign: 'center',
        minWidth: '100px',
      }}
    >
      {icon && (
        <div
          style={{ fontSize: '1.2rem', marginBottom: '0.25rem' }}
          aria-hidden="true"
        >
          {icon}
        </div>
      )}
      <div
        style={{
          fontSize: '1.25rem',
          fontWeight: 'bold',
          color: 'var(--color-accent)',
        }}
      >
        {value != null ? `${value}${unit || ''}` : '—'}
      </div>
      <div
        style={{
          fontSize: '0.8em',
          color: 'var(--color-text-muted)',
          marginTop: '0.25rem',
        }}
      >
        {label}
      </div>
    </div>
  );
}

KpiCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  unit: PropTypes.string,
  icon: PropTypes.string,
};

/**
 * Detailed nightly analysis section with intraday HR chart, SpO2 panel,
 * and side-by-side OSCAR + Fitbit summary cards.
 */
function NightlyDetailSection({ nightData, onBackToOverview }) {
  const hrIntraday = nightData.fitbit?.heartRate?.intradayData;
  const hrStats = nightData.fitbit?.heartRate?.intradayStats;
  const restingHR =
    nightData.fitbit?.heartRate?.restingBpm ?? nightData.avgHeartRate;
  const spo2 = nightData.fitbit?.oxygenSaturation;

  // Look up intraday SpO2 from top-level heartRateIntraday by date (future-proof)
  const spo2Intraday = useMemo(() => {
    if (spo2?.intradayData) return spo2.intradayData;
    // Not available in the current data pipeline — placeholder for future
    return null;
  }, [spo2]);

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

      {/* Night Summary Cards — side-by-side OSCAR and Fitbit KPIs */}
      <div
        style={{
          display: 'grid',
          gap: '1.5rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          marginBottom: '1.5rem',
        }}
      >
        {/* OSCAR Metrics */}
        <div
          style={{
            padding: '1.5rem',
            backgroundColor: 'var(--color-surface)',
            borderRadius: '8px',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-2)',
          }}
        >
          <h4
            style={{
              margin: '0 0 1rem 0',
              color: 'var(--color-text)',
              fontSize: '0.95em',
            }}
          >
            <span aria-hidden="true" style={{ marginRight: '0.5rem' }}>
              🫁
            </span>
            OSCAR Metrics
          </h4>
          <div
            style={{
              display: 'grid',
              gap: '0.75rem',
              gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
            }}
          >
            <KpiCard
              label="AHI"
              value={nightData.oscar?.ahi ?? nightData.ahi}
              icon="📊"
            />
            <KpiCard
              label="Total Time"
              value={
                nightData.oscar?.totalTime != null
                  ? `${(nightData.oscar.totalTime / 60).toFixed(1)}`
                  : null
              }
              unit="h"
              icon="⏱️"
            />
            <KpiCard
              label="Leak Rate"
              value={nightData.oscar?.leakRate}
              unit=" L/m"
              icon="💨"
            />
          </div>
        </div>

        {/* Fitbit Metrics */}
        <div
          style={{
            padding: '1.5rem',
            backgroundColor: 'var(--color-surface)',
            borderRadius: '8px',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-2)',
          }}
        >
          <h4
            style={{
              margin: '0 0 1rem 0',
              color: 'var(--color-text)',
              fontSize: '0.95em',
            }}
          >
            <span aria-hidden="true" style={{ marginRight: '0.5rem' }}>
              ⌚
            </span>
            Fitbit Metrics
          </h4>
          <div
            style={{
              display: 'grid',
              gap: '0.75rem',
              gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
            }}
          >
            <KpiCard
              label="Resting HR"
              value={restingHR}
              unit=" bpm"
              icon="❤️"
            />
            <KpiCard
              label="Min HR"
              value={hrStats?.minBpm}
              unit=" bpm"
              icon="📉"
            />
            <KpiCard
              label="Avg SpO2"
              value={spo2?.avgPercent}
              unit="%"
              icon="🫧"
            />
            <KpiCard
              label="Min SpO2"
              value={spo2?.minPercent}
              unit="%"
              icon="⚠️"
            />
          </div>
        </div>
      </div>

      {/* Intraday Heart Rate Chart */}
      {hrIntraday && hrIntraday.length > 0 && (
        <IntradayHeartRateChart
          intradayData={hrIntraday}
          intradayStats={hrStats}
          date={nightData.date}
          restingHR={restingHR}
        />
      )}

      {/* SpO2 Data Panel */}
      {spo2 && (
        <div
          style={{
            padding: '1.5rem',
            backgroundColor: 'var(--color-surface)',
            borderRadius: '8px',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-2)',
            marginBottom: '1.5rem',
          }}
        >
          <h3
            style={{
              margin: '0 0 1rem 0',
              color: 'var(--color-text)',
              fontSize: '1.1em',
            }}
          >
            <span aria-hidden="true" style={{ marginRight: '0.5rem' }}>
              🫧
            </span>
            Blood Oxygen Saturation (SpO2)
          </h3>
          <div
            style={{
              display: 'grid',
              gap: '0.75rem',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            }}
          >
            <KpiCard label="Average" value={spo2.avgPercent} unit="%" />
            <KpiCard label="Minimum" value={spo2.minPercent} unit="%" />
            <KpiCard label="Maximum" value={spo2.maxPercent} unit="%" />
          </div>

          {/* Intraday SpO2 chart (future — data layer doesn't expose yet) */}
          {spo2Intraday && spo2Intraday.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <h4
                style={{
                  margin: '0 0 0.5rem 0',
                  color: 'var(--color-text)',
                  fontSize: '0.95em',
                }}
              >
                Intraday SpO2
              </h4>
              <svg
                viewBox="0 0 800 120"
                width="100%"
                role="img"
                aria-label={`Intraday SpO2 for ${nightData.date}`}
                style={{ display: 'block' }}
              >
                {/* Simple bar chart for minute-level SpO2 */}
                {spo2Intraday.map((pt, i) => {
                  const x = 50 + (i / spo2Intraday.length) * 690;
                  const barH = ((pt.value - 85) / 15) * 80;
                  return (
                    <rect
                      key={i}
                      x={x}
                      y={100 - Math.max(0, barH)}
                      width={Math.max(1, 690 / spo2Intraday.length - 0.5)}
                      height={Math.max(0, barH)}
                      fill="var(--color-accent)"
                      opacity="0.7"
                    />
                  );
                })}
                {/* 95% reference line */}
                <line
                  x1={50}
                  y1={100 - ((95 - 85) / 15) * 80}
                  x2={740}
                  y2={100 - ((95 - 85) / 15) * 80}
                  stroke="var(--color-text-muted)"
                  strokeWidth="0.5"
                  strokeDasharray="4,3"
                />
                <text
                  x={745}
                  y={100 - ((95 - 85) / 15) * 80 + 4}
                  fontSize="9"
                  fill="var(--color-text-muted)"
                >
                  95%
                </text>
              </svg>
            </div>
          )}
        </div>
      )}

      {/* Dual-axis correlation chart */}
      {(() => {
        const hrIntradayArr = nightData.fitbit?.heartRate?.intradayData;
        if (!hrIntradayArr || hrIntradayArr.length === 0) return null;

        const timestamps = hrIntradayArr.map((pt) => {
          const [h, m, s] = (pt.time || '00:00:00').split(':').map(Number);
          const d = new Date(nightData.date);
          d.setHours(h, m, s || 0, 0);
          return d;
        });
        const heartRateVals = hrIntradayArr.map((pt) => pt.bpm);

        // SpO2 intraday if available
        const spo2Arr = nightData.fitbit?.oxygenSaturation?.intradayData;
        const spO2Vals = spo2Arr ? spo2Arr.map((pt) => pt.value) : [];

        // OSCAR events if available
        const oscarEvents = nightData.oscar?.events || [];

        const dualData = {
          timestamps,
          heartRate: heartRateVals,
          spO2: spO2Vals,
          ahiEvents: oscarEvents,
          sleepStages: [],
        };

        return (
          <DualAxisSyncChart
            title={`Heart Rate & AHI Events - ${nightData.date}`}
            data={dualData}
            onEventClick={(event) => {
              console.log('Event clicked:', event);
            }}
          />
        );
      })()}
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
  // Build reverse lookup: display label → internal key
  const labelToKey = useMemo(() => {
    const map = {};
    for (const [key, label] of Object.entries(METRIC_LABELS)) {
      map[label] = key;
    }
    return map;
  }, []);

  // Look up the scatter pair matching the selected metric display labels
  const transformedScatterData = useMemo(() => {
    if (!scatterData || !metricPair) return null;

    const xKey = labelToKey[metricPair.xMetric] || metricPair.xMetric;
    const yKey = labelToKey[metricPair.yMetric] || metricPair.yMetric;

    // Try both key orderings since buildScatterData uses sorted pairs
    const pair =
      scatterData[`${xKey}_${yKey}`] || scatterData[`${yKey}_${xKey}`];

    if (!pair || !pair.points || pair.points.length === 0) return null;

    return {
      xValues: pair.points.map((p) => p.x),
      yValues: pair.points.map((p) => p.y),
      dateLabels: pair.points.map((p) => p.date || `Point ${p.index ?? ''}`),
      statistics: metricPair.statistics || null,
    };
  }, [scatterData, metricPair, labelToKey]);

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
        scatterData={transformedScatterData}
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

/**
 * Display synced heart rate data when full correlation data isn't available yet.
 * Shows resting heart rate time series and summary statistics.
 */
function HeartRateDataSection({ heartRateData, heartRateIntraday = [] }) {
  const summary = computeHeartRateSummary(heartRateData);

  // Build lookup for intraday stats by date
  const intradayByDate = useMemo(() => {
    const map = new Map();
    if (Array.isArray(heartRateIntraday)) {
      for (const entry of heartRateIntraday) {
        if (entry?.date && entry?.intradayStats) {
          map.set(entry.date, entry.intradayStats);
        }
      }
    }
    return map;
  }, [heartRateIntraday]);

  const hasAnyIntraday = intradayByDate.size > 0;

  return (
    <div
      className="heart-rate-data-section"
      data-testid="heart-rate-data-section"
    >
      {/* Summary Stats */}
      <div
        style={{
          display: 'grid',
          gap: '1.5rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          marginBottom: '2rem',
        }}
      >
        <div
          style={{
            padding: '1.5rem',
            backgroundColor: 'var(--color-surface)',
            borderRadius: '8px',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-2)',
          }}
        >
          <div
            style={{
              fontSize: '0.85em',
              color: 'var(--color-text-muted)',
              marginBottom: '0.5rem',
            }}
          >
            Days Synced
          </div>
          <div
            style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: 'var(--color-accent)',
            }}
          >
            {summary.totalDays}
          </div>
        </div>

        {summary.avgRestingHR != null && (
          <div
            style={{
              padding: '1.5rem',
              backgroundColor: 'var(--color-surface)',
              borderRadius: '8px',
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow-2)',
            }}
          >
            <div
              style={{
                fontSize: '0.85em',
                color: 'var(--color-text-muted)',
                marginBottom: '0.5rem',
              }}
            >
              Avg Resting HR
            </div>
            <div
              style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: 'var(--color-accent)',
              }}
            >
              {summary.avgRestingHR} bpm
            </div>
          </div>
        )}

        {summary.minRestingHR != null && summary.maxRestingHR != null && (
          <div
            style={{
              padding: '1.5rem',
              backgroundColor: 'var(--color-surface)',
              borderRadius: '8px',
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow-2)',
            }}
          >
            <div
              style={{
                fontSize: '0.85em',
                color: 'var(--color-text-muted)',
                marginBottom: '0.5rem',
              }}
            >
              HR Range
            </div>
            <div
              style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: 'var(--color-accent)',
              }}
            >
              {summary.minRestingHR}–{summary.maxRestingHR} bpm
            </div>
          </div>
        )}

        {summary.dateRange && (
          <div
            style={{
              padding: '1.5rem',
              backgroundColor: 'var(--color-surface)',
              borderRadius: '8px',
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow-2)',
            }}
          >
            <div
              style={{
                fontSize: '0.85em',
                color: 'var(--color-text-muted)',
                marginBottom: '0.5rem',
              }}
            >
              Date Range
            </div>
            <div
              style={{
                fontSize: '1rem',
                fontWeight: 'bold',
                color: 'var(--color-accent)',
              }}
            >
              {summary.dateRange.start} — {summary.dateRange.end}
            </div>
          </div>
        )}
      </div>

      {/* Daily Heart Rate Table */}
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
          <span aria-hidden="true" style={{ marginRight: '0.5rem' }}>
            ❤️
          </span>
          Resting Heart Rate by Day
        </h3>

        <div
          style={{ overflowX: 'auto' }}
          role="table"
          aria-label="Daily resting heart rate data"
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.95em',
            }}
          >
            <thead>
              <tr>
                <th
                  scope="col"
                  style={{
                    textAlign: 'left',
                    padding: '0.75rem',
                    borderBottom: '2px solid var(--color-border)',
                    color: 'var(--color-text-muted)',
                    fontWeight: '600',
                  }}
                >
                  Date
                </th>
                <th
                  scope="col"
                  style={{
                    textAlign: 'right',
                    padding: '0.75rem',
                    borderBottom: '2px solid var(--color-border)',
                    color: 'var(--color-text-muted)',
                    fontWeight: '600',
                  }}
                >
                  Resting HR (bpm)
                </th>
                <th
                  scope="col"
                  style={{
                    textAlign: 'right',
                    padding: '0.75rem',
                    borderBottom: '2px solid var(--color-border)',
                    color: 'var(--color-text-muted)',
                    fontWeight: '600',
                  }}
                >
                  Heart Rate Zones
                </th>
                {hasAnyIntraday && (
                  <th
                    scope="col"
                    style={{
                      textAlign: 'right',
                      padding: '0.75rem',
                      borderBottom: '2px solid var(--color-border)',
                      color: 'var(--color-text-muted)',
                      fontWeight: '600',
                    }}
                  >
                    Intraday
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {heartRateData.map((day) => (
                <tr key={day.date}>
                  <td
                    style={{
                      padding: '0.75rem',
                      borderBottom: '1px solid var(--color-border)',
                      color: 'var(--color-text)',
                    }}
                  >
                    {new Date(day.date + 'T00:00:00').toLocaleDateString([], {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>
                  <td
                    style={{
                      padding: '0.75rem',
                      borderBottom: '1px solid var(--color-border)',
                      textAlign: 'right',
                      color: 'var(--color-text)',
                      fontWeight: '500',
                    }}
                  >
                    {day.restingHeartRate != null ? day.restingHeartRate : '—'}
                  </td>
                  <td
                    style={{
                      padding: '0.75rem',
                      borderBottom: '1px solid var(--color-border)',
                      textAlign: 'right',
                      color: 'var(--color-text-muted)',
                      fontSize: '0.85em',
                    }}
                  >
                    {day.heartRateZones.length > 0
                      ? day.heartRateZones
                          .filter((z) => z.minutes > 0)
                          .map((z) => `${z.name}: ${z.minutes}m`)
                          .join(', ')
                      : '—'}
                  </td>
                  {hasAnyIntraday && (
                    <td
                      style={{
                        padding: '0.75rem',
                        borderBottom: '1px solid var(--color-border)',
                        textAlign: 'right',
                        color: 'var(--color-text-muted)',
                        fontSize: '0.85em',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {(() => {
                        const stats = intradayByDate.get(day.date);
                        if (!stats) return '—';
                        return `${stats.minBpm}–${stats.maxBpm} (avg ${stats.avgBpm})`;
                      })()}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p
          style={{
            marginTop: '1rem',
            fontSize: '0.85em',
            color: 'var(--color-text-muted)',
            fontStyle: 'italic',
          }}
        >
          Heart rate data synced from Fitbit. Upload OSCAR data to enable
          correlation analysis between CPAP metrics and heart rate trends.
        </p>
      </div>
    </div>
  );
}

FitbitDashboard.propTypes = {
  fitbitData: PropTypes.shape({
    nightlyData: PropTypes.arrayOf(PropTypes.object),
    correlationData: PropTypes.object,
    scatterData: PropTypes.object,
    summary: PropTypes.object,
    heartRateData: PropTypes.arrayOf(
      PropTypes.shape({
        date: PropTypes.string.isRequired,
        restingHeartRate: PropTypes.number,
        heartRateZones: PropTypes.array,
      }),
    ),
    heartRateIntraday: PropTypes.arrayOf(
      PropTypes.shape({
        date: PropTypes.string.isRequired,
        intradayData: PropTypes.array,
        intradayStats: PropTypes.shape({
          minBpm: PropTypes.number,
          maxBpm: PropTypes.number,
          avgBpm: PropTypes.number,
          dataPoints: PropTypes.number,
        }),
      }),
    ),
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
  onCorrelationAnalysis: PropTypes.func,
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

HeartRateDataSection.propTypes = {
  heartRateData: PropTypes.arrayOf(
    PropTypes.shape({
      date: PropTypes.string.isRequired,
      restingHeartRate: PropTypes.number,
      heartRateZones: PropTypes.array,
    }),
  ).isRequired,
  heartRateIntraday: PropTypes.arrayOf(
    PropTypes.shape({
      date: PropTypes.string.isRequired,
      intradayData: PropTypes.array,
      intradayStats: PropTypes.object,
    }),
  ),
};

export default FitbitDashboard;
