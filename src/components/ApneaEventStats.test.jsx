import React from 'react';
import { render } from '@testing-library/react';
import ApneaEventStats from './ApneaEventStats';
import { DataProvider } from '../context/DataContext';

const sampleDetails = [
  {
    Event: 'Obstructive',
    'Data/Duration': '30',
    DateTime: '2021-01-01T00:00:00Z',
  },
  {
    Event: 'ClearAirway',
    'Data/Duration': '60',
    DateTime: '2021-01-01T00:02:00Z',
  },
];

describe('ApneaEventStats', () => {
  it('renders nothing when no events', () => {
    const { container } = render(
      <DataProvider filteredDetails={[]}>
        <ApneaEventStats />
      </DataProvider>,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders tables and plots for data with help tooltips', () => {
    const { getAllByTestId, getByText } = render(
      <DataProvider filteredDetails={sampleDetails}>
        <ApneaEventStats />
      </DataProvider>,
    );
    expect(getByText('Apnea Event Characteristics')).toBeInTheDocument();
    expect(getByText('Total apnea events')).toBeInTheDocument();
    expect(getByText('Apnea Events per Night')).toBeInTheDocument();
    expect(getAllByTestId('plotly-chart').length).toBeGreaterThan(0);
    expect(getAllByTestId('viz-help').length).toBeGreaterThanOrEqual(4);
  });
});
