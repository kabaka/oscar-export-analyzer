import React from 'react';
import { render, screen } from '@testing-library/react';
import ApneaEventStats from './ApneaEventStats';

const sampleDetails = [
  { Event: 'Obstructive', 'Data/Duration': '30', DateTime: '2021-01-01T00:00:00Z' },
  { Event: 'ClearAirway', 'Data/Duration': '60', DateTime: '2021-01-01T00:02:00Z' },
];

describe('ApneaEventStats', () => {
  it('renders nothing when no events', () => {
    const { container } = render(<ApneaEventStats data={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders tables and plots for data', () => {
    const { getAllByTestId, getByText, asFragment } = render(
      <ApneaEventStats data={sampleDetails} />
    );
    expect(getByText('Apnea Event Characteristics')).toBeInTheDocument();
    expect(getByText('Total apnea events')).toBeInTheDocument();
    expect(getByText('Apnea Events per Night')).toBeInTheDocument();
    expect(getAllByTestId('plotly-chart').length).toBeGreaterThan(0);
    expect(asFragment()).toMatchSnapshot();
  });
});
