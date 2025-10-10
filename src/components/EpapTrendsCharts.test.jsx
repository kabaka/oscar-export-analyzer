import React from 'react';
import { render } from '@testing-library/react';
import * as ETC from './EpapTrendsCharts';
import { EPAP_HELP_TOOLTIP_MIN_COUNT } from '../test-utils/fixtures/chartExpectations.js';
import { DEFAULT_CHART_HEIGHT } from '../constants/charts';

const EpapTrendsCharts = ETC.default;

const data = [
  { Date: '2021-01-01', 'Median EPAP': '5', AHI: '1' },
  { Date: '2021-01-02', 'Median EPAP': '9', AHI: '3' },
];

describe('EpapTrendsCharts', () => {
  it('renders plotly charts with help tooltips', () => {
    const { getAllByTestId } = render(<EpapTrendsCharts data={data} />);
    expect(getAllByTestId('plotly-chart').length).toBeGreaterThan(0);
    expect(getAllByTestId('plotly-chart')[0]).toHaveStyle(
      `height: ${DEFAULT_CHART_HEIGHT}px`,
    );
    // 5 charts are always present for provided data
    expect(getAllByTestId('viz-help').length).toBeGreaterThanOrEqual(
      EPAP_HELP_TOOLTIP_MIN_COUNT,
    );
  });
});

describe('EpapTrendsCharts memoization', () => {
  it('exports a memoized component', () => {
    expect(EpapTrendsCharts.type).toBe(ETC.EpapTrendsCharts);
  });
});
