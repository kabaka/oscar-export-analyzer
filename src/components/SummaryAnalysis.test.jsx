import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('./UsagePatternsCharts', () => ({ default: vi.fn(() => null) }));
vi.mock('./AhiTrendsCharts', () => ({ default: vi.fn(() => null) }));
vi.mock('./EpapTrendsCharts', () => ({ default: () => null }));

import SummaryAnalysis from './SummaryAnalysis';
import UsagePatternsCharts from './UsagePatternsCharts';
import AhiTrendsCharts from './AhiTrendsCharts';

const sample = [{ Date: '2025-06-01', 'Total Time': '08:00:00', AHI: '5', 'Median EPAP': '6' }];

describe('SummaryAnalysis', () => {
  it('renders charts without range selection logging', () => {
    render(<SummaryAnalysis data={sample} />);
    expect(UsagePatternsCharts.mock.calls[0][0].onRangeSelect).toBeUndefined();
    expect(AhiTrendsCharts.mock.calls[0][0].onRangeSelect).toBeUndefined();
  });
});

