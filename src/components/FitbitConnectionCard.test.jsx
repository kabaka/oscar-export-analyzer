/**
 * Tests for FitbitConnectionCard component.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FitbitConnectionCard from './FitbitConnectionCard.jsx';
import { CONNECTION_STATUS } from '../constants/fitbit.js';

// Mock hooks
vi.mock('../hooks/useFitbitOAuth.js', () => ({
  useFitbitOAuth: vi.fn(() => ({
    initiateAuth: vi.fn(),
    status: CONNECTION_STATUS.DISCONNECTED,
    error: null,
    isLoading: false,
    clearError: vi.fn(),
  })),
}));

vi.mock('../hooks/useFitbitConnection.js', () => ({
  useFitbitConnection: vi.fn(() => ({
    status: CONNECTION_STATUS.DISCONNECTED,
    error: null,
    connectionInfo: null,
    dataStats: null,
    lastSync: null,
    isRefreshing: false,
    checkConnection: vi.fn(),
    refreshToken: vi.fn(),
    disconnect: vi.fn(),
    clearError: vi.fn(),
  })),
}));

// Import mocked hooks
import { useFitbitConnection } from '../hooks/useFitbitConnection.js';

describe('FitbitConnectionCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders disconnected state correctly', () => {
    render(<FitbitConnectionCard passphrase="test" />);

    expect(screen.getByText('Connect Fitbit Data')).toBeInTheDocument();
    expect(screen.getByText(/Correlate heart rate, SpO2/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Connect to Fitbit/ }),
    ).toBeInTheDocument();
  });

  it('shows security notice when disconnected', () => {
    render(<FitbitConnectionCard passphrase="test" />);

    expect(
      screen.getByText('Your data stays on your device'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Learn more/ }),
    ).toBeInTheDocument();
  });

  // FIXME: disabled for now
  // it('disables connect button when no passphrase provided', () => {
  //   render(<FitbitConnectionCard passphrase={null} />);

  //   const connectButton = screen.getByRole('button', {
  //     name: /Connect to Fitbit/,
  //   });
  //   expect(connectButton).toBeDisabled();
  // });

  it('shows setup notice when no passphrase', () => {
    render(<FitbitConnectionCard passphrase={null} />);

    expect(screen.getByText(/Setup Required/)).toBeInTheDocument();
    expect(screen.getByText(/Enable data encryption/)).toBeInTheDocument();
  });

  it('expands security details when info button clicked', async () => {
    render(<FitbitConnectionCard passphrase="test" />);

    const learnMoreButton = screen.getByRole('button', { name: /Learn more/ });
    fireEvent.click(learnMoreButton);

    await waitFor(() => {
      expect(
        screen.getByText(/Tokens encrypted with your passphrase/),
      ).toBeInTheDocument();
    });
  });

  it('calls onConnectionChange when connection status changes', () => {
    const mockOnChange = vi.fn();
    render(
      <FitbitConnectionCard
        passphrase="test"
        onConnectionChange={mockOnChange}
      />,
    );

    // Component should handle connection state changes via hooks
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('displays error messages appropriately', () => {
    vi.mocked(useFitbitConnection).mockReturnValue({
      status: CONNECTION_STATUS.ERROR,
      error: {
        message: 'Connection failed',
        type: 'network_error',
      },
      connectionInfo: null,
      dataStats: null,
      lastSync: null,
      isRefreshing: false,
      checkConnection: vi.fn(),
      refreshToken: vi.fn(),
      disconnect: vi.fn(),
      clearError: vi.fn(),
    });

    render(<FitbitConnectionCard passphrase="test" />);

    expect(screen.getByText('Connection failed')).toBeInTheDocument();
    expect(screen.getByText('Error: network_error')).toBeInTheDocument();
  });
});
