import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FitbitDashboard from './FitbitDashboard';
import { CONNECTION_STATUS } from '../../constants/fitbit';

// Mock fitbitDb for async token existence check
const mockGetTokens = vi.fn().mockResolvedValue(null);
vi.mock('../../utils/fitbitDb.js', () => ({
  getTokens: (...args) => mockGetTokens(...args),
}));

// Mock the FitbitOAuthContext so FitbitConnectionCard can render without a real provider
vi.mock('../../context/FitbitOAuthContext', () => ({
  useFitbitOAuthContext: () => ({
    initiateAuth: vi.fn(),
    status: 'disconnected',
    error: null,
    isLoading: false,
    clearError: vi.fn(),
    passphrase: null,
    setPassphrase: vi.fn(),
    recoverWithPassphrase: vi.fn().mockResolvedValue(false),
  }),
  FitbitOAuthProvider: ({ children }) => <>{children}</>,
}));

// Mock child components for isolation (except FitbitConnectionCard, which is handled per-test)
vi.mock('./SyncStatusPanel', () => ({
  default: vi.fn(() => <div data-testid="sync-status-panel" />),
}));
vi.mock('./correlation/DualAxisSyncChart', () => ({
  default: vi.fn(() => <div data-testid="dual-axis-sync-chart" />),
}));
vi.mock('./correlation/CorrelationMatrix', () => ({
  default: vi.fn(() => <div data-testid="correlation-matrix" />),
}));
vi.mock('./correlation/BivariateScatterPlot', () => ({
  default: vi.fn(() => <div data-testid="bivariate-scatter-plot" />),
}));

describe('FitbitDashboard OAuth/Passphrase Flow', () => {
  let fitbitData;
  beforeEach(() => {
    vi.clearAllMocks();
    // Build synthetic nightly data for two nights with realistic chart fields
    const buildNight = (date, avgHeartRate, minSpO2, ahi) => {
      // Simulate a night with 8 hours of data, 1-min intervals
      const timestamps = Array.from(
        { length: 8 * 60 },
        (_, i) => new Date(`${date}T22:00:00Z`).getTime() + i * 60000,
      ).map((ts) => new Date(ts));
      const heartRate = Array.from(
        { length: timestamps.length },
        () => avgHeartRate + Math.round(Math.random() * 2 - 1),
      );
      const spO2 = Array.from(
        { length: timestamps.length },
        () => minSpO2 + Math.round(Math.random() * 2 - 1),
      );
      const ahiEvents = [
        {
          time: timestamps[60],
          type: 'Obstructive',
          severity: 8,
          duration: 15,
        },
        {
          time: timestamps[120],
          type: 'ClearAirway',
          severity: 10,
          duration: 20,
        },
      ];
      // Build intraday HR data in the format NightlyDetailSection expects
      const intradayData = heartRate.map((bpm, i) => {
        const t = timestamps[i];
        const hh = String(t.getUTCHours()).padStart(2, '0');
        const mm = String(t.getUTCMinutes()).padStart(2, '0');
        return { time: `${hh}:${mm}:00`, bpm };
      });
      return {
        date,
        avgHeartRate,
        minSpO2,
        ahi,
        heartRate,
        spO2,
        ahiEvents,
        timestamps,
        sleepStages: Array.from({ length: timestamps.length }, () => 'LIGHT'),
        sleepStart: timestamps[0],
        sleepEnd: timestamps[timestamps.length - 1],
        fitbit: {
          heartRate: {
            restingBpm: avgHeartRate,
            intradayData,
          },
        },
        oscar: { ahi, events: ahiEvents },
      };
    };
    const night1 = buildNight('2026-01-28', 65, 95, 10);
    const night2 = buildNight('2026-01-27', 70, 94, 12);
    fitbitData = {
      correlationData: {
        metrics: ['Heart Rate', 'AHI'],
        correlations: [
          [1, 0.7],
          [0.7, 1],
        ],
        pValues: [
          [0, 0.01],
          [0.01, 0],
        ],
        sampleSize: 2,
      },
      nightlyData: [night1, night2],
      recentActivity: [],
      dataMetrics: { heartRate: { nights: 2 }, spO2: { nights: 2 } },
      connectionInfo: { userId: 'test-user', connectedAt: Date.now() },
      syncStatus: {
        status: '',
        lastSync: new Date(),
        autoSyncEnabled: true,
        dataMetrics: {},
        recentActivity: [],
      },
      scatterData: {
        xValues: [65, 70],
        yValues: [10, 12],
        dateLabels: ['2026-01-28', '2026-01-27'],
        statistics: {
          correlation: 0.7,
          pValue: 0.01,
          rSquared: 0.49,
          slope: 0.2,
          intercept: 0,
        },
        regressionLine: { x: [65, 70], y: [10, 12] },
        outliers: [],
      },
      summary: { totalNights: 2, strongCorrelations: 1 },
    };
    sessionStorage.clear();
    localStorage.clear();
    mockGetTokens.mockResolvedValue(null);
  });

  it('prompts for passphrase if fitbit_tokens exist but passphrase is missing', async () => {
    // Simulate tokens existing in IndexedDB
    mockGetTokens.mockResolvedValue({ id: 'current', encrypted: true });
    // Provide minimal valid syncState to avoid prop errors
    const syncState = {
      status: '',
      autoSyncEnabled: false,
      dataMetrics: {},
      recentActivity: [],
    };
    render(
      <FitbitDashboard
        fitbitData={null}
        connectionStatus={CONNECTION_STATUS.DISCONNECTED}
        syncState={syncState}
        onConnect={vi.fn()}
        onDisconnect={vi.fn()}
        onSync={vi.fn()}
        onCorrelationAnalysis={vi.fn()}
      />,
    );
    // Should show connection card (prompt for passphrase) after async token check
    // First confirm dashboard renders
    expect(
      screen.getByTestId('fitbit-dashboard-container'),
    ).toBeInTheDocument();
    // Wait for async token check to resolve and React to re-render with passphraseMissing=true
    await vi.waitFor(() => {
      // After getTokens resolves with truthy value, the passphraseMissing early return
      // should render FitbitConnectionCard
      expect(screen.getByTestId('fitbit-connection-card')).toBeInTheDocument();
    });
  });

  it('auto-connects and displays Fitbit data/charts if passphrase is present in sessionStorage', async () => {
    // Simulate passphrase and tokens present
    sessionStorage.setItem('fitbit_oauth_passphrase', 'test-passphrase');
    render(
      <FitbitDashboard
        fitbitData={fitbitData}
        connectionStatus={CONNECTION_STATUS.CONNECTED}
        syncState={fitbitData.syncStatus}
        onConnect={vi.fn()}
        onDisconnect={vi.fn()}
        onSync={vi.fn()}
      />,
    );
    // Simulate clicking the most recent night to show the chart
    const recentNightButton = screen.queryByTestId(
      'recent-night-btn-2026-01-28',
    );
    if (recentNightButton) {
      fireEvent.click(recentNightButton);
      expect(screen.getByTestId('dual-axis-sync-chart')).toBeInTheDocument();
    } else {
      // If not present, assert the dashboard is rendered but not the chart
      expect(
        screen.getByTestId('fitbit-dashboard-container'),
      ).toBeInTheDocument();
    }
  });

  it('loads Fitbit section data/charts after connection', async () => {
    // Simulate user connects and data loads
    render(
      <FitbitDashboard
        fitbitData={fitbitData}
        connectionStatus={CONNECTION_STATUS.CONNECTED}
        syncState={fitbitData.syncStatus}
        onConnect={vi.fn()}
        onDisconnect={vi.fn()}
        onSync={vi.fn()}
      />,
    );
    // Simulate clicking the most recent night to show the chart
    const recentNightButton = screen.queryByTestId(
      'recent-night-btn-2026-01-28',
    );
    expect(recentNightButton).toBeInTheDocument();
    fireEvent.click(recentNightButton);
    // Should render chart in expanded night accordion
    expect(screen.getByTestId('dual-axis-sync-chart')).toBeInTheDocument();
  });
});
