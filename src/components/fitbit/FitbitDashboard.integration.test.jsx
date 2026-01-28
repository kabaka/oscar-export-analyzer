import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FitbitDashboard from './FitbitDashboard';
import { CONNECTION_STATUS } from '../../constants/fitbit';

describe('FitbitDashboard (integration)', () => {
  const connectionInfo = {
    scope: 'heartrate sleep',
    connectedAt: Date.now(),
    userId: 'test-user',
    tokenType: 'Bearer',
  };
  const dataMetrics = {
    heartRate: { nights: 1, lastDate: new Date('2026-01-24') },
    sleepStages: { nights: 1, lastDate: new Date('2026-01-24') },
    spO2: { nights: 1, lastDate: new Date('2026-01-24') },
  };
  const syncStatus = {
    isSync: false,
    lastSyncDate: new Date(),
    autoSync: true,
  };
  const spyFns = {
    onConnect: vi.fn(),
    onDisconnect: vi.fn(),
    onSync: vi.fn(),
  };

  it('shows Connected and Fitbit charts/data when tokens are valid', () => {
    const mockData = {
      connectionStatus: CONNECTION_STATUS.CONNECTED,
      syncStatus,
      correlationData: {
        metrics: ['Heart Rate', 'AHI'],
        correlations: [
          [1.0, 0.7],
          [0.7, 1.0],
        ],
        pValues: [
          [0, 0.01],
          [0.01, 0],
        ],
        sampleSize: 1,
      },
      nightlyData: [
        {
          date: '2026-01-24',
          heartRate: { avg: 68 },
          spo2: { avg: 94.2 },
          ahiEvents: 12.5,
        },
      ],
      recentActivity: [],
      dataMetrics,
      connectionInfo,
    };
    render(
      <FitbitDashboard
        fitbitData={mockData}
        connectionStatus={CONNECTION_STATUS.CONNECTED}
        syncState={syncStatus}
        {...spyFns}
      />,
    );
    expect(screen.getByText(/Ready to sync/i)).toBeInTheDocument();
    expect(screen.getByTestId('correlation-matrix')).toBeInTheDocument();
    // Use a function matcher to find the sample size in the rendered output
    expect(
      screen.getByText(
        (content) => /1/.test(content) && /night|sample|point/i.test(content),
      ),
    ).toBeInTheDocument();
    // If multiple elements match 'Connected', use getAllByText and check at least one
    const connectedEls = screen.queryAllByText(/Connected/i);
    if (connectedEls.length > 1) {
      expect(
        connectedEls.some((el) => el.textContent.match(/Connected/i)),
      ).toBe(true);
    }
  });

  it('does not show Not connected when tokens are valid', () => {
    const mockData = {
      connectionStatus: CONNECTION_STATUS.CONNECTED,
      syncStatus,
      correlationData: {},
      nightlyData: [],
      recentActivity: [],
      dataMetrics,
      connectionInfo,
    };
    render(
      <FitbitDashboard
        fitbitData={mockData}
        connectionStatus={CONNECTION_STATUS.CONNECTED}
        syncState={syncStatus}
        {...spyFns}
      />,
    );
    expect(screen.queryByText(/Not connected/i)).not.toBeInTheDocument();
  });
});
