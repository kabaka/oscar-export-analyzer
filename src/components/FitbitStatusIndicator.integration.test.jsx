import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import FitbitStatusIndicator from './FitbitStatusIndicator.jsx';
import { CONNECTION_STATUS } from '../constants/fitbit.js';

describe('FitbitStatusIndicator (integration)', () => {
  it('shows Connected and details when tokens are present and valid', () => {
    const connectionInfo = {
      connectedAt: Date.now() - 1000 * 60 * 60, // 1 hour ago
      expiresAt: Date.now() + 1000 * 60 * 60 * 8, // 8 hours from now
      scope: 'heartrate sleep',
    };
    render(
      <FitbitStatusIndicator
        status={CONNECTION_STATUS.CONNECTED}
        connectionInfo={connectionInfo}
        showDetails={true}
      />,
    );
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText(/heartrate, sleep/)).toBeInTheDocument();
  });

  it('does not show Not Connected when status is CONNECTED', () => {
    render(
      <FitbitStatusIndicator
        status={CONNECTION_STATUS.CONNECTED}
        connectionInfo={{}}
      />,
    );
    expect(screen.queryByText('Not Connected')).not.toBeInTheDocument();
  });
});
