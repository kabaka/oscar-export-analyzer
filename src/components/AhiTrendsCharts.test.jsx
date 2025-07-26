import React from 'react';
import { render } from '@testing-library/react';
import AhiTrendsCharts from './AhiTrendsCharts';

const data = [
  { Date: '2021-01-01', AHI: '1' },
  { Date: '2021-01-02', AHI: '5' },
  { Date: '2021-01-03', AHI: '10' },
];

describe('AhiTrendsCharts', () => {
  it('renders plotly charts and matches snapshot', () => {
    const { getAllByTestId, asFragment } = render(<AhiTrendsCharts data={data} />);
    expect(getAllByTestId('plotly-chart').length).toBeGreaterThan(0);
    expect(asFragment()).toMatchSnapshot();
  });
});
