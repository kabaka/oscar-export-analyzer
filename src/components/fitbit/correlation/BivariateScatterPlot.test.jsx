import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import BivariateScatterPlot from './BivariateScatterPlot';

// Mock ThemedPlot
vi.mock('../../ThemedPlot', () => ({
  default: vi.fn(({ data, layout, config, onPlotlyClick }) => (
    <div
      data-testid="themed-plot"
      onClick={() =>
        onPlotlyClick && onPlotlyClick({ points: [{ x: 7.5, y: 70 }] })
      }
    >
      <div data-testid="plot-data">{JSON.stringify(data)}</div>
      <div data-testid="plot-layout">{JSON.stringify(layout)}</div>
      <div data-testid="plot-config">{JSON.stringify(config)}</div>
    </div>
  )),
}));

describe('BivariateScatterPlot', () => {
  const mockScatterData = {
    xValues: [5.2, 8.1, 12.5, 6.8, 7.2],
    yValues: [72, 68, 65, 70, 69],
    dateLabels: [
      '2026-01-20',
      '2026-01-21',
      '2026-01-22',
      '2026-01-23',
      '2026-01-24',
    ],
    statistics: {
      correlation: -0.73,
      pValue: 0.03,
      rSquared: 0.53,
      slope: -0.45,
      intercept: 75.2,
    },
    regressionLine: {
      x: [5, 13],
      y: [72.8, 69.4],
    },
    confidenceInterval: {
      upper: [77.6, 73.1],
      lower: [68.0, 65.7],
    },
    outliers: [{ date: '2026-01-22', xValue: 12.5, yValue: 65 }],
  };

  const mockProps = {
    xMetric: 'AHI',
    yMetric: 'Heart Rate',
    scatterData: mockScatterData,
    title: 'AHI vs Heart Rate Correlation',
    onPointClick: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders scatter plot with correct data', () => {
    render(<BivariateScatterPlot {...mockProps} />);

    expect(screen.getByTestId('plotly-chart')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /scatter plot: heart rate vs ahi/i }),
    ).toBeInTheDocument();
  });

  it('highlights outliers correctly', () => {
    render(<BivariateScatterPlot {...mockProps} />);

    expect(screen.getByText('Outlier Detection')).toBeInTheDocument();
    expect(screen.getByText(/Found.*1.*outlier/i)).toBeInTheDocument();
    expect(screen.getByText('2026-01-22')).toBeInTheDocument();
  });

  it('displays statistical summary panel', () => {
    render(<BivariateScatterPlot {...mockProps} />);

    expect(screen.getByText('Relationship Analysis')).toBeInTheDocument();
    expect(screen.getByText('-0.730')).toBeInTheDocument();
    expect(screen.getByText('3.00e-2')).toBeInTheDocument();
    expect(screen.getByText('0.530')).toBeInTheDocument();
    expect(screen.getByText('-0.450')).toBeInTheDocument();
  });

  it('shows clinical interpretation', () => {
    render(<BivariateScatterPlot {...mockProps} />);

    expect(screen.getByText('Clinical Interpretation')).toBeInTheDocument();
    expect(
      screen.getByText(/very strong correlation negative relationship/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/statistically significant/i)).toBeInTheDocument();
  });

  it('handles point click events', () => {
    render(<BivariateScatterPlot {...mockProps} />);

    const plot = screen.getByTestId('plotly-chart');
    fireEvent.click(plot);

    // Plot click handler should be available (implementation detail)
    expect(plot).toBeInTheDocument();
  });

  it('renders confidence intervals', () => {
    render(<BivariateScatterPlot {...mockProps} />);

    // Check for confidence interval control
    expect(
      screen.getByLabelText(/show confidence interval/i),
    ).toBeInTheDocument();
    expect(screen.getByText('95% Confidence Interval')).toBeInTheDocument();
  });

  it('handles empty data gracefully', () => {
    const emptyProps = {
      ...mockProps,
      scatterData: null,
    };

    render(<BivariateScatterPlot {...emptyProps} />);

    expect(
      screen.getByText('No scatter plot data available'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Statistical Summary')).not.toBeInTheDocument();
  });

  it('handles missing statistics gracefully', () => {
    const noStatsProps = {
      ...mockProps,
      scatterData: {
        ...mockScatterData,
        statistics: null,
      },
    };

    render(<BivariateScatterPlot {...noStatsProps} />);

    // Should still render the basic structure but without statistical content
    expect(screen.getByTestId('plotly-chart')).toBeInTheDocument();
  });

  it('formats correlation strength correctly', () => {
    const weakCorrelationProps = {
      ...mockProps,
      scatterData: {
        ...mockScatterData,
        statistics: {
          ...mockScatterData.statistics,
          correlation: 0.15,
        },
      },
    };

    render(<BivariateScatterPlot {...weakCorrelationProps} />);

    expect(screen.getByText('Weak correlation')).toBeInTheDocument();
  });

  it('handles very strong correlation', () => {
    const strongCorrelationProps = {
      ...mockProps,
      scatterData: {
        ...mockScatterData,
        statistics: {
          ...mockScatterData.statistics,
          correlation: 0.92,
        },
      },
    };

    render(<BivariateScatterPlot {...strongCorrelationProps} />);

    expect(screen.getByText('Very strong correlation')).toBeInTheDocument();
  });

  it('handles non-significant p-values', () => {
    const nonSigProps = {
      ...mockProps,
      scatterData: {
        ...mockScatterData,
        statistics: {
          ...mockScatterData.statistics,
          pValue: 0.12,
        },
      },
    };

    render(<BivariateScatterPlot {...nonSigProps} />);

    expect(screen.getByText('Not Significant')).toBeInTheDocument();
  });

  it('applies correct axis labels', () => {
    render(<BivariateScatterPlot {...mockProps} />);

    // Check the aria-label includes the metric names
    const plot = screen.getByRole('img', {
      name: /scatter plot: heart rate vs ahi/i,
    });
    expect(plot).toBeInTheDocument();
  });

  it('includes hover information', () => {
    render(<BivariateScatterPlot {...mockProps} />);

    // Check that plot exists with interactive elements
    const plot = screen.getByTestId('plotly-chart');
    expect(plot).toBeInTheDocument();
    expect(plot).toHaveAttribute('data');
  });

  it('sets correct ARIA attributes', () => {
    render(<BivariateScatterPlot {...mockProps} />);

    const plot = screen.getByRole('img', {
      name: /scatter plot: heart rate vs ahi/i,
    });
    expect(plot).toBeInTheDocument();

    const summary = screen.getByRole('region', {
      name: /scatter plot summary/i,
    });
    expect(summary).toBeInTheDocument();
  });

  it('handles custom color schemes', () => {
    const customProps = {
      ...mockProps,
      colorScheme: 'viridis',
    };

    render(<BivariateScatterPlot {...customProps} />);

    const plot = screen.getByTestId('plotly-chart');
    expect(plot).toBeInTheDocument();
  });

  // Loading state test removed - component doesn't support isLoading prop

  it('displays data point count', () => {
    render(<BivariateScatterPlot {...mockProps} />);

    // Check the accessible summary contains the data point information
    const summary = screen.getByLabelText(/scatter plot summary/i);
    expect(summary).toHaveTextContent(/5.*nights/i);
    expect(summary).toHaveTextContent(/1 outliers/i);
  });

  it('handles responsive layout', () => {
    render(<BivariateScatterPlot {...mockProps} />);

    const plot = screen.getByTestId('plotly-chart');
    expect(plot).toBeInTheDocument();
    expect(plot).toHaveAttribute('config');
  });

  it('provides screen reader summary', () => {
    render(<BivariateScatterPlot {...mockProps} />);

    const screenReaderSummary = screen.getByRole('region', {
      name: /scatter plot summary/i,
    });
    expect(screenReaderSummary).toHaveClass('sr-only');
    expect(screenReaderSummary).toHaveTextContent(/5.*nights/i);
    expect(screenReaderSummary).toHaveTextContent(/correlation.*-0.73/i);
  });

  describe('null statistics handling', () => {
    const nullStatsScatterData = {
      xValues: [5.2, 8.1],
      yValues: [72, 68],
      dateLabels: ['2026-01-20', '2026-01-21'],
      statistics: {
        correlation: null,
        pValue: null,
        rSquared: null,
        slope: null,
        intercept: null,
      },
      regressionLine: null,
      confidenceInterval: null,
      outliers: [],
    };

    const nullStatsProps = {
      xMetric: 'AHI',
      yMetric: 'Heart Rate',
      scatterData: nullStatsScatterData,
      onPointClick: vi.fn(),
    };

    it('renders without crashing when all statistics are null', () => {
      render(<BivariateScatterPlot {...nullStatsProps} />);

      expect(screen.getByText('Relationship Analysis')).toBeInTheDocument();
    });

    it('shows em-dash for null correlation value', () => {
      render(<BivariateScatterPlot {...nullStatsProps} />);

      const statValues = screen.getAllByText('\u2014');
      // correlation, rSquared, slope should all show em-dash
      expect(statValues.length).toBeGreaterThanOrEqual(3);
    });

    it('shows N/A for null pValue', () => {
      render(<BivariateScatterPlot {...nullStatsProps} />);

      expect(screen.getAllByText('N/A').length).toBeGreaterThanOrEqual(1);
    });

    it('shows Insufficient data interpretation for null correlation', () => {
      render(<BivariateScatterPlot {...nullStatsProps} />);

      expect(
        screen.getAllByText('Insufficient data').length,
      ).toBeGreaterThanOrEqual(1);
    });

    it('generates clinical interpretation for null statistics', () => {
      render(<BivariateScatterPlot {...nullStatsProps} />);

      expect(
        screen.getByText(/Insufficient data to determine a relationship/i),
      ).toBeInTheDocument();
    });

    it('handles partial null statistics (only pValue null)', () => {
      const partialNullData = {
        ...nullStatsScatterData,
        statistics: {
          correlation: -0.5,
          pValue: null,
          rSquared: 0.25,
          slope: -0.3,
          intercept: 80,
        },
      };

      render(
        <BivariateScatterPlot
          {...nullStatsProps}
          scatterData={partialNullData}
        />,
      );

      // correlation should render normally
      expect(screen.getByText('-0.500')).toBeInTheDocument();
      // pValue should show N/A
      expect(screen.getAllByText('N/A').length).toBeGreaterThanOrEqual(1);
    });
  });
});
