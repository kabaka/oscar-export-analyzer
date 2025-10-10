import React from 'react';
import { render, screen, within } from '@testing-library/react';
import AhiTrendsCharts from './AhiTrendsCharts';
import { AHI_SEVERITY_LIMITS } from '../constants';
import { buildSummaryRow } from '../test-utils/builders';

const data = [
  buildSummaryRow({ date: '2021-01-01', ahi: 1 }),
  buildSummaryRow({ date: '2021-01-02', ahi: 5 }),
  buildSummaryRow({ date: '2021-01-03', ahi: 10 }),
];

describe('AhiTrendsCharts', () => {
  it('renders plotly charts with help tooltips', () => {
    const { getAllByTestId } = render(<AhiTrendsCharts data={data} />);
    expect(getAllByTestId('plotly-chart').length).toBeGreaterThan(0);
    // Additional autocorrelation charts increase help tooltips count
    expect(getAllByTestId('viz-help').length).toBeGreaterThanOrEqual(8);
    expect(
      screen.getByText(
        /Trend\/Seasonal\/Residual view shows the STL decomposition/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Autocorrelation shows how strongly tonight's AHI relates/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Max lag/i)).toBeInTheDocument();
  });

  it('computes severity band counts', () => {
    const bandData = [
      buildSummaryRow({ date: '2021-01-01', ahi: 2 }),
      buildSummaryRow({ date: '2021-01-02', ahi: 10 }),
      buildSummaryRow({ date: '2021-01-03', ahi: 20 }),
      buildSummaryRow({ date: '2021-01-04', ahi: 40 }),
    ];
    render(<AhiTrendsCharts data={bandData} />);
    const severityLabels = {
      normal: `≤ ${AHI_SEVERITY_LIMITS.normal}`,
      mild: `${AHI_SEVERITY_LIMITS.normal}–${AHI_SEVERITY_LIMITS.mild}`,
      moderate: `${AHI_SEVERITY_LIMITS.mild}–${AHI_SEVERITY_LIMITS.moderate}`,
      severe: `> ${AHI_SEVERITY_LIMITS.moderate}`,
    };
    const getCount = (label) => {
      const row = screen.getByText(label).closest('tr');
      return within(row).getAllByRole('cell')[1].textContent;
    };
    expect(getCount(severityLabels.normal)).toBe('1');
    expect(getCount(severityLabels.mild)).toBe('1');
    expect(getCount(severityLabels.moderate)).toBe('1');
    expect(getCount(severityLabels.severe)).toBe('1');
  });
});
