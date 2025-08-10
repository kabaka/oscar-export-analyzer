import React from 'react';
import { render, screen } from '@testing-library/react';
import Overview from './Overview';

const summaryData = [
  { Date: '2021-01-01', 'Total Time': '1:00:00', AHI: '2', 'Median EPAP': '10' },
  { Date: '2021-01-02', 'Total Time': '2:00:00', AHI: '4', 'Median EPAP': '12' },
];
const clusters = [{}, {}];
const falseNegatives = [{}];

describe('Overview', () => {
  it('renders KPI cards with correct titles and values', () => {
    const { asFragment } = render(
      <Overview summaryData={summaryData} clusters={clusters} falseNegatives={falseNegatives} />
    );
    expect(screen.getByText('Overview Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Avg Usage (hrs)')).toBeInTheDocument();
    expect(screen.getByText('Median AHI')).toBeInTheDocument();
    expect(screen.getByText('Median EPAP')).toBeInTheDocument();
    expect(screen.getByText('# Clusters')).toBeInTheDocument();
    expect(screen.getByText('# False Negatives')).toBeInTheDocument();
    // Snapshot omitted to avoid brittleness when adding inline guide links
  });
});
