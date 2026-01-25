import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CorrelationMatrix from './CorrelationMatrix';

// Mock ThemedPlot
vi.mock('../../ui', () => ({
  ThemedPlot: ({ data, layout, onClick, onHover, onUnhover, ...props }) => (
    <div
      data-testid="plotly-chart"
      onClick={() =>
        onClick?.({
          points: [{ x: 'Heart Rate', y: 'AHI', z: 0.63, customdata: 0.0001 }],
        })
      }
      onMouseEnter={() =>
        onHover?.({
          points: [{ x: 'Heart Rate', y: 'AHI', z: 0.63, customdata: 0.0001 }],
        })
      }
      onMouseLeave={() => onUnhover?.()}
      {...props}
    >
      <div data-testid="chart-data">{JSON.stringify({ data, layout })}</div>
    </div>
  ),
}));

const mockCorrelationData = {
  metrics: ['Heart Rate', 'AHI', 'SpO2 Min', 'Sleep Efficiency'],
  correlations: [
    [1.0, 0.63, -0.45, 0.12],
    [0.63, 1.0, -0.72, -0.34],
    [-0.45, -0.72, 1.0, 0.28],
    [0.12, -0.34, 0.28, 1.0],
  ],
  pValues: [
    [0, 0.0001, 0.003, 0.14],
    [0.0001, 0, 0.00001, 0.08],
    [0.003, 0.00001, 0, 0.15],
    [0.14, 0.08, 0.15, 0],
  ],
  sampleSize: 47,
};

describe('CorrelationMatrix', () => {
  it('renders heatmap with correlation data', () => {
    render(<CorrelationMatrix correlationData={mockCorrelationData} />);

    expect(screen.getByTestId('plotly-chart')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('Correlation matrix heatmap'),
    );
  });

  it('shows accessibility summary', () => {
    render(<CorrelationMatrix correlationData={mockCorrelationData} />);

    const summary = screen.getByRole('region', {
      name: 'Correlation matrix summary',
    });
    expect(summary).toBeInTheDocument();
    expect(summary).toHaveTextContent('4 metrics across 47 nights');
  });

  it('renders accessible data table', () => {
    render(<CorrelationMatrix correlationData={mockCorrelationData} />);

    const table = screen.getByRole('table', {
      name: 'Correlation matrix data',
    });
    expect(table).toBeInTheDocument();
    expect(table).toHaveClass('sr-only');

    // Check table headers
    expect(screen.getByText('Metric Pair')).toBeInTheDocument();
    expect(screen.getByText('Correlation (r)')).toBeInTheDocument();
    expect(screen.getByText('P-value')).toBeInTheDocument();
    expect(screen.getByText('Significance')).toBeInTheDocument();
    expect(screen.getByText('Interpretation')).toBeInTheDocument();
  });

  it('renders empty state when no data', () => {
    render(<CorrelationMatrix correlationData={{}} />);

    expect(
      screen.getByText('No correlation data available'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Ensure sufficient nights/)).toBeInTheDocument();
  });

  it('handles cell clicks for drill-down', () => {
    const onCellClick = vi.fn();
    render(
      <CorrelationMatrix
        correlationData={mockCorrelationData}
        onCellClick={onCellClick}
      />,
    );

    const chart = screen.getByTestId('plotly-chart');
    fireEvent.click(chart);

    expect(onCellClick).toHaveBeenCalledWith('Heart Rate', 'AHI', {
      correlation: 0.63,
      pValue: 0.0001,
      sampleSize: 47,
    });
  });

  it('generates correct heatmap data', () => {
    render(<CorrelationMatrix correlationData={mockCorrelationData} />);

    const chartData = screen.getByTestId('chart-data');
    const parsedData = JSON.parse(chartData.textContent);

    // Should have heatmap trace
    const heatmapTrace = parsedData.data[0];
    expect(heatmapTrace.type).toBe('heatmap');
    expect(heatmapTrace.z).toEqual(mockCorrelationData.correlations);
    expect(heatmapTrace.x).toEqual(mockCorrelationData.metrics);
    expect(heatmapTrace.customdata).toEqual(mockCorrelationData.pValues);
  });

  it('applies correct colorscale', () => {
    render(<CorrelationMatrix correlationData={mockCorrelationData} />);

    const chartData = screen.getByTestId('chart-data');
    const parsedData = JSON.parse(chartData.textContent);

    const heatmapTrace = parsedData.data[0];
    expect(heatmapTrace.colorscale).toBeDefined();
    expect(heatmapTrace.zmin).toBe(-1);
    expect(heatmapTrace.zmax).toBe(1);
  });

  it('supports annotation toggle', () => {
    const { rerender } = render(
      <CorrelationMatrix
        correlationData={mockCorrelationData}
        showAnnotations={true}
      />,
    );

    let chartData = screen.getByTestId('chart-data');
    let parsedData = JSON.parse(chartData.textContent);
    expect(parsedData.layout.annotations).toBeDefined();
    expect(parsedData.layout.annotations.length).toBeGreaterThan(0);

    rerender(
      <CorrelationMatrix
        correlationData={mockCorrelationData}
        showAnnotations={false}
      />,
    );

    chartData = screen.getByTestId('chart-data');
    parsedData = JSON.parse(chartData.textContent);
    expect(parsedData.layout.annotations).toEqual([]);
  });

  it('handles hover states', () => {
    render(<CorrelationMatrix correlationData={mockCorrelationData} />);

    const chart = screen.getByTestId('plotly-chart');

    // Hover should work without errors
    fireEvent.mouseEnter(chart);
    fireEvent.mouseLeave(chart);

    expect(chart).toBeInTheDocument();
  });

  it('displays custom title', () => {
    const customTitle = 'Custom Correlation Analysis';
    render(
      <CorrelationMatrix
        correlationData={mockCorrelationData}
        title={customTitle}
      />,
    );

    const chartData = screen.getByTestId('chart-data');
    const parsedData = JSON.parse(chartData.textContent);
    expect(parsedData.layout.title).toBe(customTitle);
  });

  it('calculates correlation table data correctly', () => {
    render(<CorrelationMatrix correlationData={mockCorrelationData} />);

    // Check some correlation pairs in the table
    expect(screen.getByText('Heart Rate ↔ AHI')).toBeInTheDocument();
    expect(screen.getByText('0.630')).toBeInTheDocument(); // Heart Rate-AHI correlation
    expect(screen.getAllByText('***').length).toBeGreaterThan(0); // Highly significant markers

    // Check interpretation
    expect(screen.getByText(/strong positive correlation/)).toBeInTheDocument();
  });

  it('handles selected metrics highlighting', () => {
    const selectedMetrics = ['Heart Rate', 'AHI'];
    render(
      <CorrelationMatrix
        correlationData={mockCorrelationData}
        selectedMetrics={selectedMetrics}
      />,
    );

    expect(screen.getByTestId('plotly-chart')).toBeInTheDocument();
    // Visual highlighting would be tested with actual Plotly rendering
  });

  it('sets correct ARIA attributes', () => {
    render(<CorrelationMatrix correlationData={mockCorrelationData} />);

    const chartWrapper = screen.getByRole('img');
    expect(chartWrapper).toHaveAttribute(
      'aria-describedby',
      'correlation-matrix-summary',
    );

    const summary = document.getElementById('correlation-matrix-summary');
    expect(summary).toHaveClass('sr-only');
    expect(summary).toHaveAttribute('role', 'region');
  });

  it('renders responsive layout', () => {
    render(<CorrelationMatrix correlationData={mockCorrelationData} />);

    const chartData = screen.getByTestId('chart-data');
    const parsedData = JSON.parse(chartData.textContent);

    // Should have square aspect ratio
    expect(parsedData.layout.height).toBeDefined();
    expect(parsedData.layout.width).toBeDefined();

    // Should have proper margins for labels
    expect(parsedData.layout.margin).toBeDefined();
  });
});
