import React from 'react';
import { render } from '@testing-library/react';
import UsagePatternsCharts from './UsagePatternsCharts';

const data = [
  { Date: '2021-01-01', 'Total Time': '1:00:00' },
  { Date: '2021-01-02', 'Total Time': '2:00:00' },
  { Date: '2021-01-03', 'Total Time': '3:00:00' },
];

describe('UsagePatternsCharts', () => {
  it('renders plotly charts with help tooltips', () => {
    const { getAllByTestId } = render(<UsagePatternsCharts data={data} />);
    expect(getAllByTestId('plotly-chart').length).toBeGreaterThan(0);
    // 4 charts => at least 4 help tooltips
    expect(getAllByTestId('viz-help').length).toBeGreaterThanOrEqual(4);
  });
});
