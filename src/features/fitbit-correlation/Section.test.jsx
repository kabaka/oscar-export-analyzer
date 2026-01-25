import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppProviders } from '../../app/AppProviders';
import FitbitCorrelationSection from './Section';

// Mock the FitbitOAuth context to prevent errors during testing
vi.mock('../../context/FitbitOAuthContext', () => ({
  useFitbitOAuthContext: () => ({
    status: 'disconnected',
    initiateAuth: vi.fn(),
    disconnect: vi.fn(),
    error: null,
    clearError: vi.fn(),
  }),
  FitbitOAuthProvider: ({ children }) => children,
}));

// Mock the Fitbit connection hook
vi.mock('../../hooks/useFitbitConnection', () => ({
  useFitbitConnection: () => ({
    fitbitData: null,
    syncState: {
      status: 'idle',
      lastSync: null,
      nextAutoSync: null,
      autoSyncEnabled: false,
      dataMetrics: {},
      recentActivity: [],
      errorMessage: null,
    },
    syncFitbitData: vi.fn(),
    clearFitbitData: vi.fn(),
  }),
}));

describe('FitbitCorrelationSection Integration', () => {
  it('renders the Fitbit correlation section', () => {
    render(
      <AppProviders>
        <FitbitCorrelationSection />
      </AppProviders>,
    );

    // Check that the section renders with proper title
    expect(
      screen.getByText(/Fitbit Correlation Analysis/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Connect your Fitbit account to analyze correlations/i),
    ).toBeInTheDocument();
  });

  it('has proper section structure', () => {
    render(
      <AppProviders>
        <FitbitCorrelationSection />
      </AppProviders>,
    );

    // Check for section element with correct id
    const section = screen.getByRole('region', {
      name: /Fitbit Correlation Analysis/i,
    });
    expect(section).toHaveAttribute('id', 'fitbit-correlation');
    expect(section).toHaveClass('chart-section');
  });
});
