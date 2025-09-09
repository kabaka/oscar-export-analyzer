import React from 'react';
import { render, screen, within } from '@testing-library/react';
import AhiTrendsCharts from './AhiTrendsCharts';

const data = [
  { Date: '2021-01-01', AHI: '1' },
  { Date: '2021-01-02', AHI: '5' },
  { Date: '2021-01-03', AHI: '10' },
];

describe('AhiTrendsCharts', () => {
  it('renders plotly charts with help tooltips', () => {
    const { getAllByTestId } = render(<AhiTrendsCharts data={data} />);
    expect(getAllByTestId('plotly-chart').length).toBeGreaterThan(0);
    // 5 charts => at least 5 help tooltips
    expect(getAllByTestId('viz-help').length).toBeGreaterThanOrEqual(5);
  });

  it('computes severity band counts', () => {
    const bandData = [
      { Date: '2021-01-01', AHI: '2' },
      { Date: '2021-01-02', AHI: '10' },
      { Date: '2021-01-03', AHI: '20' },
      { Date: '2021-01-04', AHI: '40' },
    ];
    render(<AhiTrendsCharts data={bandData} />);
    const getCount = (label) => {
      const row = screen.getByText(label).closest('tr');
      return within(row).getAllByRole('cell')[1].textContent;
    };
    expect(getCount('≤ 5')).toBe('1');
    expect(getCount('5–15')).toBe('1');
    expect(getCount('15–30')).toBe('1');
    expect(getCount('> 30')).toBe('1');
  });
});
