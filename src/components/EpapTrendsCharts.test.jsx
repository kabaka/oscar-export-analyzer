import React from 'react';
import { render } from '@testing-library/react';
import * as ETC from './EpapTrendsCharts';

const EpapTrendsCharts = ETC.default;

const data = [
  { Date: '2021-01-01', 'Median EPAP': '5', AHI: '1' },
  { Date: '2021-01-02', 'Median EPAP': '9', AHI: '3' },
];

describe('EpapTrendsCharts', () => {
  it('renders plotly charts with help tooltips', () => {
    const { getAllByTestId } = render(<EpapTrendsCharts data={data} />);
    expect(getAllByTestId('plotly-chart').length).toBeGreaterThan(0);
    // 5 charts are always present for provided data
    expect(getAllByTestId('viz-help').length).toBeGreaterThanOrEqual(5);
  });
});

describe('EpapTrendsCharts memoization', () => {
  it('exports a memoized component', () => {
    expect(EpapTrendsCharts.type).toBe(ETC.EpapTrendsCharts);
  });
});
