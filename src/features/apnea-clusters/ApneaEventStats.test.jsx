/* eslint-disable no-magic-numbers -- test-specific event counts and statistical assertions */
import React from 'react';
import { render } from '@testing-library/react';
import ApneaEventStats from './ApneaEventStats';
import { DataProvider } from '../../context/DataContext';
import {
  APNEA_DURATION_HIGH_SEC,
  APNEA_DURATION_THRESHOLD_SEC,
} from '../../constants';
import { DEFAULT_CHART_HEIGHT } from '../../constants/charts';

const sampleDetails = [
  {
    Event: 'Obstructive',
    'Data/Duration': String(APNEA_DURATION_THRESHOLD_SEC),
    DateTime: '2021-01-01T00:00:00Z',
  },
  {
    Event: 'ClearAirway',
    'Data/Duration': String(APNEA_DURATION_HIGH_SEC),
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
    expect(container).toBeEmptyDOMElement();
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
    expect(getAllByTestId('plotly-chart')[0]).toHaveStyle(
      `height: ${DEFAULT_CHART_HEIGHT}px`,
    );
    expect(getAllByTestId('viz-help').length).toBeGreaterThanOrEqual(4);
  });
});
