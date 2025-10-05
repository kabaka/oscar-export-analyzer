import React from 'react';
import { render, screen } from '@testing-library/react';
import * as UPC from './UsagePatternsCharts';

const UsagePatternsCharts = UPC.default;

const data = [
  { Date: '2021-01-01', 'Total Time': '1:00:00' },
  { Date: '2021-01-02', 'Total Time': '2:00:00' },
  { Date: '2021-01-03', 'Total Time': '3:00:00' },
];

describe('UsagePatternsCharts', () => {
  it('renders plotly charts with help tooltips', () => {
    const { getAllByTestId } = render(<UsagePatternsCharts data={data} />);
    expect(getAllByTestId('plotly-chart').length).toBeGreaterThan(0);
    // 5 charts => at least 5 help tooltips (including STL decomposition)
    expect(getAllByTestId('viz-help').length).toBeGreaterThanOrEqual(5);
    expect(
      screen.getByText(/Trend\/Seasonal\/Residual view decomposes nightly usage/i),
    ).toBeInTheDocument();
  });
});

describe('UsagePatternsCharts memoization', () => {
  it('exports a memoized component', () => {
    expect(UsagePatternsCharts.type).toBe(UPC.UsagePatternsCharts);
  });
});
