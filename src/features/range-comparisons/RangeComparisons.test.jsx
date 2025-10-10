import React from 'react';
import { render, screen } from '@testing-library/react';
import RangeComparisons from './RangeComparisons';
import { DataProvider } from '../../context/DataContext';

const summary = [
  { Date: '2024-01-01', 'Total Time': '01:00:00', AHI: '2' },
  { Date: '2024-01-02', 'Total Time': '02:00:00', AHI: '4' },
  { Date: '2024-02-01', 'Total Time': '03:00:00', AHI: '1' },
  { Date: '2024-02-02', 'Total Time': '04:00:00', AHI: '5' },
];

describe('RangeComparisons', () => {
  it('renders comparison table with MW stats', () => {
    render(
      <DataProvider summaryData={summary}>
        <RangeComparisons
          rangeA={{
            start: new Date('2024-01-01'),
            end: new Date('2024-01-10'),
          }}
          rangeB={{
            start: new Date('2024-02-01'),
            end: new Date('2024-02-10'),
          }}
        />
      </DataProvider>,
    );
    expect(screen.getByText(/Range Comparisons/)).toBeInTheDocument();
    expect(screen.getByText(/Usage/)).toBeInTheDocument();
    expect(screen.getByText(/AHI/)).toBeInTheDocument();
  });
});
