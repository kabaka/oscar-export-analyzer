import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ApneaClusterAnalysis from './ApneaClusterAnalysis.jsx';

describe('ApneaClusterAnalysis overlay', () => {
  it('shows leak/pressure chart when selecting a cluster', async () => {
    const base = new Date('2021-01-01T00:00:00Z');
    const cluster = {
      start: new Date(base.getTime() + 60000),
      end: new Date(base.getTime() + 120000),
      durationSec: 60,
      count: 3,
      severity: 1,
      events: [
        { date: new Date(base.getTime() + 60000), durationSec: 10 },
        { date: new Date(base.getTime() + 80000), durationSec: 10 },
        { date: new Date(base.getTime() + 100000), durationSec: 10 },
      ],
    };
    const details = [
      { Event: 'Leak', 'Data/Duration': 20, DateTime: new Date(base.getTime() + 55000).toISOString() },
      { Event: 'Pressure', 'Data/Duration': 8, DateTime: new Date(base.getTime() + 70000).toISOString() },
    ];
    const params = {
      gapSec: 120,
      bridgeThreshold: 0.1,
      bridgeSec: 60,
      edgeEnter: 0.5,
      edgeExit: 0.35,
      minCount: 1,
      minTotalSec: 0,
      maxClusterSec: 300,
      minDensity: 0,
    };
    render(
      <ApneaClusterAnalysis
        clusters={[cluster]}
        params={params}
        onParamChange={() => {}}
        details={details}
      />
    );
    const rows = screen.getAllByRole('row');
    await userEvent.click(rows[1]);
    expect(await screen.findByText(/Leak\/Pressure around Cluster/)).toBeInTheDocument();
  });
});
