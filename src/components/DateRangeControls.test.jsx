/* eslint-disable no-magic-numbers -- test-specific date offsets and sample data */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import DateRangeControls from './DateRangeControls';

describe('DateRangeControls', () => {
  const mockCallbacks = {
    onQuickRangeChange: vi.fn(),
    onDateFilterChange: vi.fn(),
    onCustomRange: vi.fn(),
    onReset: vi.fn(),
    parseDate: vi.fn((val) => (val ? new Date(val) : null)),
    formatDate: vi.fn((date) => {
      if (!date) return '';
      const d = new Date(date);
      return d.toISOString().slice(0, 10);
    }),
  };

  const defaultProps = {
    quickRange: 'all',
    dateFilter: { start: null, end: null },
    ...mockCallbacks,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders quick range selector with all preset options', () => {
    render(<DateRangeControls {...defaultProps} />);

    const select = screen.getByDisplayValue('All');
    expect(select).toBeInTheDocument();
    expect(select).toHaveAttribute('aria-label', 'Quick range');

    const options = screen.getAllByRole('option');
    expect(options.length).toBeGreaterThan(5); // Should have multiple presets
    expect(options[0]).toHaveTextContent('All');
    expect(options[1]).toHaveTextContent('Last 7 days');
  });

  it('changes quick range when preset is selected', async () => {
    const user = userEvent.setup();
    render(<DateRangeControls {...defaultProps} />);

    const select = screen.getByRole('combobox', { name: /quick range/i });
    await user.selectOptions(select, '30');

    expect(defaultProps.onQuickRangeChange).toHaveBeenCalledWith('30');
  });

  it('renders start and end date inputs with aria labels', () => {
    render(<DateRangeControls {...defaultProps} />);

    const startInput = screen.getByLabelText('Start date');
    const endInput = screen.getByLabelText('End date');

    expect(startInput).toHaveAttribute('type', 'date');
    expect(endInput).toHaveAttribute('type', 'date');
  });

  it('updates start date and triggers custom range mode', async () => {
    const user = userEvent.setup();
    const newDate = '2024-01-15';

    render(
      <DateRangeControls
        {...defaultProps}
        parseDate={(val) => (val ? new Date(val) : null)}
      />,
    );

    const startInput = screen.getByLabelText('Start date');
    await user.clear(startInput);
    await user.type(startInput, newDate);

    expect(defaultProps.onCustomRange).toHaveBeenCalled();
    expect(defaultProps.onDateFilterChange).toHaveBeenCalled();
  });

  it('updates end date and triggers custom range mode', async () => {
    const user = userEvent.setup();
    const newDate = '2024-02-15';

    render(
      <DateRangeControls
        {...defaultProps}
        parseDate={(val) => (val ? new Date(val) : null)}
      />,
    );

    const endInput = screen.getByLabelText('End date');
    await user.clear(endInput);
    await user.type(endInput, newDate);

    expect(defaultProps.onCustomRange).toHaveBeenCalled();
    expect(defaultProps.onDateFilterChange).toHaveBeenCalled();
  });

  it('shows reset button only when filter has dates', () => {
    const { rerender } = render(
      <DateRangeControls
        {...defaultProps}
        dateFilter={{ start: null, end: null }}
      />,
    );

    let resetBtn = screen.queryByRole('button', { name: /reset date filter/i });
    expect(resetBtn).not.toBeInTheDocument();

    rerender(
      <DateRangeControls
        {...defaultProps}
        dateFilter={{ start: new Date('2024-01-01'), end: null }}
      />,
    );

    resetBtn = screen.getByRole('button', { name: /reset date filter/i });
    expect(resetBtn).toBeInTheDocument();
  });

  it('calls onReset when reset button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <DateRangeControls
        {...defaultProps}
        dateFilter={{
          start: new Date('2024-01-01'),
          end: new Date('2024-02-01'),
        }}
      />,
    );

    const resetBtn = screen.getByRole('button', { name: /reset date filter/i });
    await user.click(resetBtn);

    expect(defaultProps.onReset).toHaveBeenCalled();
  });

  it('formats and displays dates in start/end inputs', () => {
    const startDate = new Date('2024-01-15');
    const endDate = new Date('2024-02-15');

    render(
      <DateRangeControls
        {...defaultProps}
        dateFilter={{ start: startDate, end: endDate }}
        formatDate={(date) => {
          if (!date) return '';
          return date.toISOString().slice(0, 10);
        }}
      />,
    );

    const startInput = screen.getByLabelText('Start date');
    const endInput = screen.getByLabelText('End date');

    expect(startInput).toHaveValue('2024-01-15');
    expect(endInput).toHaveValue('2024-02-15');
  });

  it('maintains selected quick range value', () => {
    render(
      <DateRangeControls
        {...defaultProps}
        quickRange="30"
        dateFilter={{ start: null, end: null }}
      />,
    );

    const select = screen.getByRole('combobox', { name: /quick range/i });
    expect(select).toHaveValue('30');
  });

  it('handles edge case: switching between custom range and presets', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <DateRangeControls {...defaultProps} quickRange="custom" />,
    );

    const startInput = screen.getByLabelText('Start date');
    await user.clear(startInput);
    await user.type(startInput, '2024-01-10');

    rerender(
      <DateRangeControls
        {...defaultProps}
        quickRange="7"
        dateFilter={{ start: null, end: null }}
      />,
    );

    const select = screen.getByRole('combobox', { name: /quick range/i });
    expect(select).toHaveValue('7');
  });
});
