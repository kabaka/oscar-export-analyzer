import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FitbitConnectionCard from './FitbitConnectionCard.jsx';
import { CONNECTION_STATUS } from '../constants/fitbit.js';

let connectionInfo;
let dataStats;
let spyFns;

vi.mock('../hooks/useFitbitConnection.js', () => ({
  useFitbitConnection: () => ({
    status: CONNECTION_STATUS.CONNECTED,
    connectionInfo,
    dataStats,
    isRefreshing: false,
    ...spyFns,
  }),
}));

vi.mock('../context/FitbitOAuthContext.jsx', () => ({
  useFitbitOAuthContext: () => ({
    status: undefined,
    error: undefined,
    isLoading: false,
    initiateAuth: vi.fn(),
    clearError: vi.fn(),
    passphrase: null,
    setPassphrase: vi.fn(),
    recoverWithPassphrase: vi.fn().mockResolvedValue(false),
  }),
}));

vi.mock('../utils/fitbitDb.js', () => ({
  getTokens: vi.fn().mockResolvedValue(null),
  getFitbitDataStats: vi.fn().mockResolvedValue(null),
  setSyncMetadata: vi.fn().mockResolvedValue(true),
  getSyncMetadata: vi.fn().mockResolvedValue(null),
}));

describe('FitbitConnectionCard (integration)', () => {
  beforeEach(() => {
    connectionInfo = {
      scope: 'heartrate sleep',
      connectedAt: Date.now(),
      userId: 'test-user',
      tokenType: 'Bearer',
    };
    dataStats = {
      totalRecords: 2,
      dataSources: ['heartRate', 'spO2'],
      dateRange: ['2026-01-01', '2026-01-02'],
      heartRate: { nights: 2, lastDate: '2026-01-02' },
      sleepStages: { nights: 2, lastDate: '2026-01-02' },
      spO2: { nights: 2, lastDate: '2026-01-02' },
    };
    spyFns = {
      checkConnection: vi.fn(),
      refreshToken: vi.fn(),
      disconnect: vi.fn(),
      clearError: vi.fn(),
    };
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('shows Connected when tokens are valid', () => {
    render(<FitbitConnectionCard passphrase="test" />);
    // Use getAllByText to avoid multiple match error
    const connectedEls = screen.getAllByText(/Connected/i);
    expect(connectedEls.length).toBeGreaterThan(0);
  });

  it('does not show Not Connected when status is CONNECTED', () => {
    render(<FitbitConnectionCard passphrase="test" />);
    expect(screen.queryByText(/Not Connected/i)).not.toBeInTheDocument();
  });
});
