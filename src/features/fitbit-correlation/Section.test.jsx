import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const dashboardCalls = [];

const oauthState = {
  status: 'disconnected',
  initiateAuth: vi.fn(),
  disconnect: vi.fn(),
  error: null,
  clearError: vi.fn(),
};

const connectionState = {
  fitbitData: null,
  syncState: 'idle',
  syncFitbitData: vi.fn(),
  clearFitbitData: vi.fn(),
};

const analysisState = {
  analysisData: { heartRateData: [] },
  hasAnalysis: false,
  analysisError: null,
};

vi.mock('../../context/FitbitOAuthContext', () => ({
  __esModule: true,
  useFitbitOAuthContext: () => oauthState,
}));

vi.mock('../../hooks/useFitbitConnection', () => ({
  __esModule: true,
  useFitbitConnection: () => connectionState,
}));

vi.mock('../../hooks/useFitbitAnalysis', () => ({
  __esModule: true,
  useFitbitAnalysis: () => analysisState,
}));

vi.mock('../../context/DataContext', () => ({
  __esModule: true,
  useData: () => ({ filteredSummary: null }),
}));

vi.mock('../../components/fitbit/FitbitDashboard', () => ({
  __esModule: true,
  default: ({
    fitbitData,
    connectionStatus,
    syncState,
    onConnect,
    onDisconnect,
    onSync,
  }) => {
    dashboardCalls.push({ fitbitData, connectionStatus, syncState });
    return (
      <div data-testid="fitbit-dashboard">
        <button onClick={onConnect}>Connect</button>
        <button onClick={onDisconnect}>Disconnect</button>
        <button onClick={onSync}>Sync</button>
        <span>{connectionStatus}</span>
        <span>{fitbitData ? 'with-data' : 'no-data'}</span>
        {fitbitData && <div data-testid="dual-axis-sync-chart">Mock Chart</div>}
      </div>
    );
  },
}));

import { FitbitCorrelationSection } from './Section';

describe('FitbitCorrelationSection', () => {
  beforeEach(() => {
    dashboardCalls.length = 0;
    oauthState.status = 'disconnected';
    oauthState.error = null;
    oauthState.initiateAuth = vi.fn().mockResolvedValue();
    oauthState.disconnect = vi.fn().mockResolvedValue();
    oauthState.clearError = vi.fn();
    connectionState.fitbitData = null;
    connectionState.syncState = 'idle';
    connectionState.syncFitbitData = vi.fn().mockResolvedValue();
    connectionState.clearFitbitData = vi.fn();
    analysisState.analysisData = { heartRateData: [] };
    analysisState.hasAnalysis = false;
    analysisState.analysisError = null;
  });

  it('renders dashboard with props and forwards actions', async () => {
    render(<FitbitCorrelationSection />);

    expect(
      screen.getByRole('heading', { name: /Fitbit Correlation Analysis/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('fitbit-dashboard')).toBeInTheDocument();

    const dashboard = screen.getByTestId('fitbit-dashboard');
    await userEvent.click(
      within(dashboard).getByRole('button', { name: /^Connect$/i }),
    );
    await userEvent.click(
      within(dashboard).getByRole('button', { name: /^Disconnect$/i }),
    );
    await userEvent.click(
      within(dashboard).getByRole('button', { name: /^Sync$/i }),
    );

    expect(oauthState.clearError).toHaveBeenCalled();
    expect(oauthState.initiateAuth).toHaveBeenCalled();
    expect(oauthState.disconnect).toHaveBeenCalled();
    expect(connectionState.clearFitbitData).toHaveBeenCalled();
    expect(connectionState.syncFitbitData).toHaveBeenCalled();
  });

  it('passes analysisData to dashboard as fitbitData', () => {
    analysisState.analysisData = {
      heartRateData: [
        { date: '2026-01-08', restingHeartRate: 68, heartRateZones: [] },
      ],
    };

    render(<FitbitCorrelationSection />);

    const lastCall = dashboardCalls.at(-1);
    expect(lastCall.fitbitData).toEqual(analysisState.analysisData);
    expect(lastCall.connectionStatus).toBe('disconnected');
  });

  it('shows oauth error details when provided', async () => {
    oauthState.error = { message: 'Boom', details: 'stack trace' };
    connectionState.fitbitData = { sample: true };

    render(<FitbitCorrelationSection />);

    expect(screen.getByRole('alert')).toHaveTextContent('Connection Error');
    expect(screen.getByText(/stack trace/i)).toBeInTheDocument();

    await userEvent.click(screen.getByText(/Dismiss/));
    expect(oauthState.clearError).toHaveBeenCalled();
  });
});
