/**
 * Tests for FitbitStatusIndicator component.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FitbitStatusIndicator from './FitbitStatusIndicator.jsx';
import { CONNECTION_STATUS } from '../constants/fitbit.js';

describe('FitbitStatusIndicator', () => {
  it('renders disconnected status correctly', () => {
    render(<FitbitStatusIndicator status={CONNECTION_STATUS.DISCONNECTED} />);

    expect(screen.getByText('Not Connected')).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Fitbit connection status: Not Connected/),
    ).toBeInTheDocument();
  });

  it('renders connected status correctly', () => {
    const connectionInfo = {
      connectedAt: Date.now() - 1000 * 60 * 60, // 1 hour ago
      expiresAt: Date.now() + 1000 * 60 * 60 * 8, // 8 hours from now
      scope: 'heartrate sleep oxygen_saturation',
    };

    render(
      <FitbitStatusIndicator
        status={CONNECTION_STATUS.CONNECTED}
        connectionInfo={connectionInfo}
        showDetails={true}
      />,
    );

    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText(/Connected:/)).toBeInTheDocument();
    expect(
      screen.getByText(/heartrate, sleep, oxygen_saturation/),
    ).toBeInTheDocument();
  });

  it('renders loading status with spinner', () => {
    render(<FitbitStatusIndicator status={CONNECTION_STATUS.CONNECTING} />);

    expect(screen.getByText('Connecting')).toBeInTheDocument();
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders error status with details', () => {
    const error = {
      message: 'Network connection failed',
      details: 'fetch() timeout after 5000ms',
    };

    render(
      <FitbitStatusIndicator
        status={CONNECTION_STATUS.ERROR}
        error={error}
        showDetails={true}
      />,
    );

    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getAllByText('Network connection failed')).toHaveLength(2); // Both in description and error section
    expect(screen.getByText('Details')).toBeInTheDocument();
  });

  it('shows refresh button for expired tokens', () => {
    const mockOnAction = vi.fn();

    render(
      <FitbitStatusIndicator
        status={CONNECTION_STATUS.TOKEN_EXPIRED}
        onAction={mockOnAction}
      />,
    );

    const refreshButton = screen.getByRole('button', {
      name: /Refresh connection/,
    });
    expect(refreshButton).toBeInTheDocument();

    fireEvent.click(refreshButton);
    expect(mockOnAction).toHaveBeenCalledWith('refresh');
  });

  it('formats time to expiry correctly', () => {
    const connectionInfo = {
      connectedAt: Date.now(),
      expiresAt: Date.now() + 1000 * 60 * 125, // 2h 5m from now
      scope: 'heartrate',
    };

    render(
      <FitbitStatusIndicator
        status={CONNECTION_STATUS.CONNECTED}
        connectionInfo={connectionInfo}
        showDetails={true}
      />,
    );

    expect(screen.getByText(/2h [4-5]m/)).toBeInTheDocument();
  });

  it('handles different size variants', () => {
    const { rerender } = render(
      <FitbitStatusIndicator
        status={CONNECTION_STATUS.CONNECTED}
        size="small"
      />,
    );

    expect(
      document.querySelector('.fitbit-status-indicator.small'),
    ).toBeInTheDocument();

    rerender(
      <FitbitStatusIndicator
        status={CONNECTION_STATUS.CONNECTED}
        size="large"
      />,
    );

    expect(
      document.querySelector('.fitbit-status-indicator.large'),
    ).toBeInTheDocument();
  });
});
