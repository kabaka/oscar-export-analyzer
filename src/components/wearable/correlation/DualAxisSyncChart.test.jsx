import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DualAxisSyncChart from './DualAxisSyncChart';

// Mock ThemedPlot to avoid Plotly complexities in tests
vi.mock('../../ui', () => ({
  // eslint-disable-next-line no-unused-vars
  ThemedPlot: ({ data, layout, onClick, onRelayout, ...props }) => (
    <div
      data-testid="plotly-chart"
      onClick={() =>
        onClick?.({ points: [{ data: { name: 'AHI Events' }, pointIndex: 0 }] })
      }
      {...props}
    >
      <div data-testid="chart-data">{JSON.stringify({ data, layout })}</div>
    </div>
  ),
}));

const mockNightData = {
  timestamps: [
    new Date('2026-01-24T22:00:00'),
    new Date('2026-01-24T23:00:00'),
    new Date('2026-01-25T00:00:00'),
    new Date('2026-01-25T01:00:00'),
  ],
  heartRate: [62, 59, 61, 58],
  spO2: [96, 95, 97, 94],
  sleepStages: ['WAKE', 'LIGHT', 'DEEP', 'LIGHT'],
  ahiEvents: [
    {
      time: new Date('2026-01-24T23:15:00'),
      type: 'Apnea',
      severity: 8.5,
      duration: 12,
    },
    {
      time: new Date('2026-01-25T00:30:00'),
      type: 'Hypopnea',
      severity: 5.2,
      duration: 8,
    },
  ],
  sleepStart: new Date('2026-01-24T22:30:00'),
  sleepEnd: new Date('2026-01-25T06:45:00'),
};

describe('DualAxisSyncChart', () => {
  it('renders chart with data', () => {
    render(
      <DualAxisSyncChart
        title="Heart Rate & AHI Events - January 24, 2026"
        data={mockNightData}
      />,
    );

    expect(screen.getByTestId('plotly-chart')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute(
      'aria-label',
      'Dual-axis correlation chart: Heart Rate & AHI Events - January 24, 2026',
    );
  });

  it('shows accessibility summary', () => {
    render(<DualAxisSyncChart title="Test Chart" data={mockNightData} />);

    const summary = screen.getByRole('region', { name: 'Chart summary' });
    expect(summary).toBeInTheDocument();
    expect(summary).toHaveTextContent(
      'Heart rate and AHI events correlation chart',
    );
    expect(summary).toHaveTextContent('4 heart rate measurements');
    expect(summary).toHaveTextContent('2 AHI events');
  });

  it('renders empty state when no data', () => {
    render(<DualAxisSyncChart title="Empty Chart" data={{}} />);

    expect(
      screen.getByText('No correlation data available'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Ensure both CPAP and wearable data/),
    ).toBeInTheDocument();
  });

  it('handles event clicks', () => {
    const onEventClick = vi.fn();
    render(
      <DualAxisSyncChart
        title="Interactive Chart"
        data={mockNightData}
        onEventClick={onEventClick}
      />,
    );

    const chart = screen.getByTestId('plotly-chart');
    fireEvent.click(chart);

    expect(onEventClick).toHaveBeenCalledWith(mockNightData.ahiEvents[0]);
  });

  it('handles relayout events', () => {
    const onRelayout = vi.fn();
    render(
      <DualAxisSyncChart
        title="Zoomable Chart"
        data={mockNightData}
        onRelayout={onRelayout}
      />,
    );

    // Would trigger onRelayout in real Plotly interaction
    expect(screen.getByTestId('plotly-chart')).toBeInTheDocument();
  });

  it('supports legend toggle', () => {
    const { rerender } = render(
      <DualAxisSyncChart
        title="Chart with Legend"
        data={mockNightData}
        showLegend={true}
      />,
    );

    expect(screen.getByTestId('plotly-chart')).toBeInTheDocument();

    rerender(
      <DualAxisSyncChart
        title="Chart without Legend"
        data={mockNightData}
        showLegend={false}
      />,
    );

    expect(screen.getByTestId('plotly-chart')).toBeInTheDocument();
  });

  it('processes heart rate and SpO2 data correctly', () => {
    render(<DualAxisSyncChart title="Data Processing" data={mockNightData} />);

    const chartData = screen.getByTestId('chart-data');
    const parsedData = JSON.parse(chartData.textContent);

    // Should have heart rate trace
    const heartRateTrace = parsedData.data.find(
      (trace) => trace.name === 'Heart Rate',
    );
    expect(heartRateTrace).toBeDefined();
    expect(heartRateTrace.y).toEqual(mockNightData.heartRate);

    // Should have SpO2 trace on its own axis, in true % units (not "scaled")
    const spO2Trace = parsedData.data.find((trace) => trace.name === 'SpO₂');
    expect(spO2Trace).toBeDefined();
    expect(spO2Trace.name).not.toMatch(/scaled/i);
    // Values are the raw SpO2 percentages, not rescaled onto the HR axis
    expect(spO2Trace.y).toEqual(mockNightData.spO2);
    expect(spO2Trace.yaxis).toBe('y3');

    // Should have AHI events trace
    const ahiTrace = parsedData.data.find(
      (trace) => trace.name === 'AHI Events',
    );
    expect(ahiTrace).toBeDefined();
    expect(ahiTrace.x).toHaveLength(2); // Two events
  });

  it('handles missing data gracefully', () => {
    const incompleteData = {
      timestamps: mockNightData.timestamps,
      heartRate: mockNightData.heartRate,
      // Missing spO2, sleepStages, ahiEvents
    };

    render(<DualAxisSyncChart title="Incomplete Data" data={incompleteData} />);

    expect(screen.getByTestId('plotly-chart')).toBeInTheDocument();

    const chartData = screen.getByTestId('chart-data');
    const parsedData = JSON.parse(chartData.textContent);

    // Should only have heart rate trace
    expect(parsedData.data).toHaveLength(1);
    expect(parsedData.data[0].name).toBe('Heart Rate');
  });

  it('applies correct dual-axis layout', () => {
    render(<DualAxisSyncChart title="Dual Axis Test" data={mockNightData} />);

    const chartData = screen.getByTestId('chart-data');
    const parsedData = JSON.parse(chartData.textContent);

    // Primary y-axis for heart rate
    expect(parsedData.layout.yaxis.title).toBe('Heart Rate (bpm)');
    expect(parsedData.layout.yaxis.side).toBe('left');

    // Secondary y-axis for AHI events. Title is given in object form so an
    // explicit standoff keeps the right-hand axis title from clipping.
    expect(parsedData.layout.yaxis2.title.text).toBe('AHI Events per Hour');
    expect(parsedData.layout.yaxis2.side).toBe('right');
    expect(parsedData.layout.yaxis2.overlaying).toBe('y');

    // Tertiary y-axis for SpO2 — true % units, NOT scaled onto the HR axis
    expect(parsedData.layout.yaxis3.title.text).toBe('SpO₂ (%)');
    expect(parsedData.layout.yaxis3.title.text).not.toMatch(/scaled/i);
    expect(parsedData.layout.yaxis3.overlaying).toBe('y');
    // Range sits in real SpO2 territory (70–100%), not the HR range. Floor is
    // 70 (not 80) so genuine apnea desaturations into the low-80s/70s are
    // shown rather than clipped at the axis floor.
    expect(parsedData.layout.yaxis3.range).toEqual([70, 100]);

    // Time axis
    expect(parsedData.layout.xaxis.title).toBe('Sleep Time');
    expect(parsedData.layout.xaxis.type).toBe('date');
  });

  it('themes the secondary and tertiary axes for dark mode legibility', () => {
    render(<DualAxisSyncChart title="Themed Chart" data={mockNightData} />);

    const parsedData = JSON.parse(screen.getByTestId('chart-data').textContent);

    // jsdom defaults to light mode, so axis/spike colors use the light
    // theme-aware token (chartTheme.js light axisColor). The point is that the
    // SpO2 axis is themed at all rather than left to a hardcoded default.
    expect(parsedData.layout.yaxis3.color).toBe('#5b6472');
    expect(parsedData.layout.xaxis.spikecolor).toBe('#5b6472');
  });

  it('sets correct ARIA attributes', () => {
    render(<DualAxisSyncChart title="Accessible Chart" data={mockNightData} />);

    const chartWrapper = screen.getByRole('img');
    expect(chartWrapper).toHaveAttribute(
      'aria-describedby',
      'dual-axis-chart-summary',
    );

    const summary = document.getElementById('dual-axis-chart-summary');
    expect(summary).toHaveClass('sr-only');
    expect(summary).toHaveAttribute('role', 'region');
  });

  it('strips script tags from event labels regardless of casing', () => {
    const maliciousData = {
      ...mockNightData,
      ahiEvents: [
        {
          ...mockNightData.ahiEvents[0],
          type: '<SCRIPT>alert("xss")</SCRIPT>Obstructive',
        },
      ],
    };

    render(<DualAxisSyncChart title="Sanitized Chart" data={maliciousData} />);

    const chartData = screen.getByTestId('chart-data');
    const parsedData = JSON.parse(chartData.textContent);
    const ahiTrace = parsedData.data.find(
      (trace) => trace.name === 'AHI Events',
    );

    expect(ahiTrace.text[0]).toBe('Obstructive');
    expect(ahiTrace.text[0]).not.toMatch(/script/i);
  });
});
