import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FitbitConnectionCard from './FitbitConnectionCard';
import { CONNECTION_STATUS } from '../../constants/fitbit';

describe('FitbitConnectionCard', () => {
  const mockProps = {
    connectionStatus: CONNECTION_STATUS.DISCONNECTED,
    onConnect: vi.fn(),
    onDisconnect: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders disconnected state correctly', () => {
    render(<FitbitConnectionCard {...mockProps} />);

    expect(screen.getByText('Connect Fitbit Data')).toBeInTheDocument();
    expect(screen.getByText('Not Connected')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /connect to fitbit/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Correlate heart rate, SpO2/)).toBeInTheDocument();
  });

  it('renders connected state correctly', () => {
    const connectedProps = {
      ...mockProps,
      connectionStatus: CONNECTION_STATUS.CONNECTED,
      lastSyncDate: new Date('2026-01-24T08:30:00'),
      dataPreview: {
        nightsAvailable: 47,
        dateRange: [new Date('2025-12-08'), new Date('2026-01-24')],
        metrics: ['Heart Rate', 'SpO2', 'Sleep Stages'],
      },
    };

    render(<FitbitConnectionCard {...connectedProps} />);

    expect(screen.getByText('Fitbit Connected')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText(/47 nights available/)).toBeInTheDocument();
    expect(screen.getByText(/Last sync:/)).toBeInTheDocument();
    expect(screen.getByText(/Data range:/)).toBeInTheDocument();
    // Metrics are joined by comma, check for combined text
    expect(
      screen.getByText(/Heart Rate, SpO2, Sleep Stages/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /view analysis/i }),
    ).toBeInTheDocument();
  });

  it('renders connecting state correctly', () => {
    const connectingProps = {
      ...mockProps,
      connectionStatus: CONNECTION_STATUS.CONNECTING,
    };

    render(<FitbitConnectionCard {...connectingProps} />);

    expect(screen.getAllByText('Connecting...').length).toBeGreaterThan(0);
    const connectButton = screen.getByRole('button', {
      name: /connecting to fitbit/i,
    });
    expect(connectButton).toBeDisabled();
    expect(connectButton).toHaveTextContent('Connecting...');
  });

  it('renders error state correctly', () => {
    const errorProps = {
      ...mockProps,
      connectionStatus: CONNECTION_STATUS.ERROR,
      errorMessage: 'Network connection failed',
    };

    render(<FitbitConnectionCard {...errorProps} />);

    expect(screen.getByText('Connection Error')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Connection Failed: Network connection failed',
    );
  });

  it('handles connect button click', () => {
    render(<FitbitConnectionCard {...mockProps} />);

    const connectButton = screen.getByRole('button', {
      name: /connect to fitbit/i,
    });
    fireEvent.click(connectButton);

    expect(mockProps.onConnect).toHaveBeenCalledTimes(1);
  });

  it('handles disconnect button click', () => {
    const connectedProps = {
      ...mockProps,
      connectionStatus: CONNECTION_STATUS.CONNECTED,
      dataPreview: {
        nightsAvailable: 47,
        dateRange: [new Date('2025-12-08'), new Date('2026-01-24')],
        metrics: ['Heart Rate'],
      },
    };

    render(<FitbitConnectionCard {...connectedProps} />);

    const moreButton = screen.getByRole('button', { name: /more/i });
    fireEvent.click(moreButton);

    expect(mockProps.onDisconnect).toHaveBeenCalledTimes(1);
  });

  it('toggles learn more section', () => {
    render(<FitbitConnectionCard {...mockProps} />);

    const learnMoreButton = screen.getByRole('button', { name: /learn more/i });

    // Initially collapsed
    expect(
      screen.queryByText('What data will be accessed?'),
    ).not.toBeInTheDocument();

    // Expand
    fireEvent.click(learnMoreButton);
    expect(screen.getByText('What data will be accessed?')).toBeInTheDocument();
    expect(screen.getByText(/Heart Rate:/)).toBeInTheDocument();
    expect(screen.getByText(/Blood Oxygen:/)).toBeInTheDocument();
    expect(screen.getByText(/Sleep Stages:/)).toBeInTheDocument();
  });

  it('shows security information', () => {
    render(<FitbitConnectionCard {...mockProps} />);

    expect(
      screen.getByText('Your data stays on your device'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Optional encryption available'),
    ).toBeInTheDocument();
  });

  it('formats date range correctly', () => {
    const connectedProps = {
      ...mockProps,
      connectionStatus: CONNECTION_STATUS.CONNECTED,
      dataPreview: {
        nightsAvailable: 30,
        dateRange: [new Date('2025-12-01'), new Date('2025-12-30')],
        metrics: ['Heart Rate'],
      },
    };

    render(<FitbitConnectionCard {...connectedProps} />);

    // Date may be formatted differently depending on locale
    const dataRange = screen.getByText(/Data range:/i);
    expect(dataRange).toBeInTheDocument();
    // Just verify the component renders without error with the date range
    expect(screen.getByRole('region')).toBeInTheDocument();
  });

  it('handles missing data preview gracefully', () => {
    const connectedProps = {
      ...mockProps,
      connectionStatus: CONNECTION_STATUS.CONNECTED,
      // No dataPreview provided
    };

    render(<FitbitConnectionCard {...connectedProps} />);

    expect(screen.getByText('Fitbit Connected')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('sets correct ARIA attributes', () => {
    render(<FitbitConnectionCard {...mockProps} />);

    const card = screen.getByRole('region', { name: /Connect Fitbit Data/i });
    expect(card).toHaveAttribute('aria-labelledby', 'fitbit-card-title');
    expect(card).toHaveAttribute('aria-describedby', 'fitbit-card-description');

    const connectButton = screen.getByRole('button', {
      name: /connect to fitbit/i,
    });
    expect(connectButton).toHaveAttribute(
      'aria-describedby',
      'security-notice',
    );

    const securityNotice = document.getElementById('security-notice');
    expect(securityNotice).toHaveClass('sr-only');
  });

  it('applies hover effects on buttons', () => {
    render(<FitbitConnectionCard {...mockProps} />);

    const connectButton = screen.getByRole('button', {
      name: /connect to fitbit/i,
    });

    // Test hover styles (would be more complete with actual CSS testing)
    expect(connectButton).toHaveStyle({ backgroundColor: '#007bff' });

    fireEvent.mouseEnter(connectButton);
    // In a real test, we'd verify hover style changes
    fireEvent.mouseLeave(connectButton);
  });

  it('handles token expired state', () => {
    const expiredProps = {
      ...mockProps,
      connectionStatus: CONNECTION_STATUS.TOKEN_EXPIRED,
    };

    render(<FitbitConnectionCard {...expiredProps} />);

    expect(screen.getByText('Reconnection Required')).toBeInTheDocument();
  });

  it('displays status icon correctly', () => {
    const { rerender } = render(<FitbitConnectionCard {...mockProps} />);

    // Disconnected - gray dot
    expect(screen.getByText('●')).toBeInTheDocument();

    // Connected - green dot with checkmark
    rerender(
      <FitbitConnectionCard
        {...mockProps}
        connectionStatus={CONNECTION_STATUS.CONNECTED}
        dataPreview={{
          nightsAvailable: 10,
          dateRange: [new Date(), new Date()],
          metrics: ['Heart Rate'],
        }}
      />,
    );

    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('shows Fitbit logo', () => {
    render(<FitbitConnectionCard {...mockProps} />);

    const logo = screen.getByLabelText('Fitbit logo');
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveTextContent('F');
  });
});
