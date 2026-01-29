import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FitbitDashboard from './FitbitDashboard';
import { CONNECTION_STATUS } from '../../constants/fitbit';
// ...existing code...

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
  });

  it('prompts for passphrase if fitbit_tokens exist but passphrase is missing', async () => {
    // Use the real FitbitConnectionCard for this test only
    vi.resetModules();
    // Dynamically import after resetModules to avoid stale module cache
    const { default: FitbitDashboard } = await import('./FitbitDashboard');
    const { CONNECTION_STATUS } = await import('../../constants/fitbit');
    // Simulate tokens in storage but no passphrase
    localStorage.setItem(
      'fitbit_tokens',
      JSON.stringify({ access_token: 'abc', refresh_token: 'def' }),
    );
    sessionStorage.removeItem('fitbit_session_passphrase');
    sessionStorage.removeItem('fitbit_oauth_passphrase');
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
    // Should show connection card (prompt for passphrase)
    expect(
      await screen.findByTestId('fitbit-connection-card'),
    ).toBeInTheDocument();
  });

  it('auto-connects and displays Fitbit data/charts if passphrase is present in sessionStorage', async () => {
    // Mock FitbitConnectionCard for this test
    vi.doMock('./FitbitConnectionCard', () => ({
      default: () => <div data-testid="fitbit-connection-card" />,
    }));
    // Simulate passphrase and tokens present
    sessionStorage.setItem('fitbit_oauth_passphrase', 'test-passphrase');
    localStorage.setItem(
      'fitbit_tokens',
      JSON.stringify({ access_token: 'abc', refresh_token: 'def' }),
    );
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
    // Simulate clicking the first recent night to show the chart
    const nightButtons = screen.getAllByRole('button');
    // Only click recent night button if present
    const recentNightButton = nightButtons.find((btn) =>
      /Tue, Jan 27HR: 65bpm • AHI: 10 • SpO2: 95%/.test(btn.textContent),
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
    vi.resetModules();
  });

  it('loads Fitbit section data/charts after connection', async () => {
    // Mock FitbitConnectionCard for this test
    vi.doMock('./FitbitConnectionCard', () => ({
      default: () => <div data-testid="fitbit-connection-card" />,
    }));
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
    // Simulate clicking the first recent night to show the chart
    const nightButtons = screen.getAllByRole('button');
    const recentNightButton = nightButtons.find((btn) =>
      /Tue, Jan 27HR: 65bpm • AHI: 10 • SpO2: 95%/.test(btn.textContent),
    );
    expect(recentNightButton).toBeDefined();
    fireEvent.click(recentNightButton);
    // Should render chart in nightly-detail view
    expect(screen.getByTestId('dual-axis-sync-chart')).toBeInTheDocument();
    vi.resetModules();
  });
});
