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
    render(<UsagePatternsCharts data={data} />);
    expect(screen.getAllByTestId('plotly-chart').length).toBeGreaterThan(0);
    // Additional autocorrelation charts increase help tooltips count
    expect(screen.getAllByTestId('viz-help').length).toBeGreaterThanOrEqual(7);
    expect(
      screen.getByText(
        /Trend\/Seasonal\/Residual view decomposes nightly usage/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Autocorrelation reveals whether short nights cluster/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Max lag/i)).toBeInTheDocument();
  });
});

describe('UsagePatternsCharts memoization', () => {
  it('exports a memoized component', () => {
    expect(UsagePatternsCharts.type).toBe(UPC.UsagePatternsCharts);
  });
});
