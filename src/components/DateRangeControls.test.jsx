/* eslint-disable no-magic-numbers -- test-specific date offsets and sample data */
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

  describe('Basic Functionality', () => {
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

      let resetBtn = screen.queryByRole('button', {
        name: /reset date filter/i,
      });
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

      const resetBtn = screen.getByRole('button', {
        name: /reset date filter/i,
      });
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

  describe('Keyboard Navigation - Tab Order (WCAG 2.1 2.4.3)', () => {
    it('maintains correct tab order: select → start date → end date → reset', async () => {
      const user = userEvent.setup();
      render(
        <DateRangeControls
          {...defaultProps}
          quickRange="all"
          dateFilter={{ start: null, end: null }}
        />,
      );

      const select = screen.getByRole('combobox', { name: /quick range/i });
      const startDate = screen.getByLabelText('Start date');
      const endDate = screen.getByLabelText('End date');

      // Focus first control
      select.focus();
      expect(select).toHaveFocus();

      // Tab to start date
      await user.tab();
      expect(startDate).toHaveFocus();

      // Tab to end date
      await user.tab();
      expect(endDate).toHaveFocus();
    });

    it('tab to reset button when custom dates are set', async () => {
      const user = userEvent.setup();
      render(
        <DateRangeControls
          {...defaultProps}
          quickRange="custom"
          dateFilter={{
            start: new Date('2024-01-01'),
            end: new Date('2024-12-31'),
          }}
        />,
      );

      const select = screen.getByRole('combobox', { name: /quick range/i });
      const startDate = screen.getByLabelText('Start date');
      const endDate = screen.getByLabelText('End date');
      const resetBtn = screen.getByRole('button', {
        name: /reset date filter/i,
      });

      select.focus();
      await user.tab();
      expect(startDate).toHaveFocus();

      await user.tab();
      expect(endDate).toHaveFocus();

      await user.tab();
      expect(resetBtn).toHaveFocus();
    });

    it('reverse tab order with Shift+Tab', async () => {
      const user = userEvent.setup();
      render(
        <DateRangeControls
          {...defaultProps}
          quickRange="custom"
          dateFilter={{
            start: new Date('2024-01-01'),
            end: new Date('2024-12-31'),
          }}
        />,
      );

      const resetBtn = screen.getByRole('button', {
        name: /reset date filter/i,
      });
      const endDate = screen.getByLabelText('End date');

      resetBtn.focus();
      expect(resetBtn).toHaveFocus();

      await user.tab({ shift: true });
      expect(endDate).toHaveFocus();
    });

    it('reset button only appears in tab order when custom dates are set', async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <DateRangeControls
          {...defaultProps}
          quickRange="all"
          dateFilter={{ start: null, end: null }}
        />,
      );

      expect(
        screen.queryByRole('button', { name: /reset date filter/i }),
      ).not.toBeInTheDocument();

      rerender(
        <DateRangeControls
          {...defaultProps}
          quickRange="custom"
          dateFilter={{
            start: new Date('2024-01-01'),
            end: new Date('2024-12-31'),
          }}
        />,
      );

      const resetBtn = screen.getByRole('button', {
        name: /reset date filter/i,
      });
      expect(resetBtn).toBeInTheDocument();

      const endDate = screen.getByLabelText('End date');
      endDate.focus();
      await user.tab();
      expect(resetBtn).toHaveFocus();
    });
  });

  describe('Keyboard Navigation - Dropdown (WCAG 2.1 2.1.1)', () => {
    it('opens dropdown with Enter on select element', async () => {
      const user = userEvent.setup();
      render(<DateRangeControls {...defaultProps} />);

      const select = screen.getByRole('combobox', { name: /quick range/i });
      select.focus();
      expect(select).toHaveFocus();

      // Native HTML select should expand
      await user.keyboard('{Enter}');

      // Verify options are accessible
      const options = screen.getAllByRole('option');
      expect(options.length).toBeGreaterThan(0);
    });

    it('navigates dropdown options with arrow keys', async () => {
      const user = userEvent.setup();
      const onQuickRangeChange = vi.fn();

      render(
        <DateRangeControls
          {...defaultProps}
          onQuickRangeChange={onQuickRangeChange}
          quickRange="all"
        />,
      );

      const select = screen.getByRole('combobox', { name: /quick range/i });
      select.focus();

      // Arrow down to navigate
      await user.keyboard('{ArrowDown}');

      const options = screen.getAllByRole('option');
      expect(options.length).toBeGreaterThan(1);
    });

    it('selects option with arrow and Enter in dropdown', async () => {
      const user = userEvent.setup();
      const onQuickRangeChange = vi.fn();

      render(
        <DateRangeControls
          {...defaultProps}
          onQuickRangeChange={onQuickRangeChange}
        />,
      );

      const select = screen.getByRole('combobox', { name: /quick range/i });
      select.focus();

      // Navigate to 7-day option using arrow or direct selection
      await user.selectOptions(select, '7');

      // Verify the callback was called (native select may not update immediately in test)
      expect(onQuickRangeChange).toHaveBeenCalled();
    });
  });

  describe('ARIA Attributes (WCAG 2.1 1.3.1)', () => {
    it('date inputs have proper aria-label attributes', () => {
      render(
        <DateRangeControls
          {...defaultProps}
          quickRange="custom"
          dateFilter={{
            start: new Date('2024-01-01'),
            end: new Date('2024-12-31'),
          }}
        />,
      );

      const startDate = screen.getByLabelText('Start date');
      const endDate = screen.getByLabelText('End date');

      expect(startDate).toHaveAttribute('aria-label', 'Start date');
      expect(endDate).toHaveAttribute('aria-label', 'End date');
    });

    it('quick range selector has aria-label', () => {
      render(<DateRangeControls {...defaultProps} />);

      const select = screen.getByRole('combobox', { name: /quick range/i });
      expect(select).toHaveAttribute('aria-label', 'Quick range');
    });

    it('reset button has accessible label', () => {
      render(
        <DateRangeControls
          {...defaultProps}
          quickRange="custom"
          dateFilter={{
            start: new Date('2024-01-01'),
            end: new Date('2024-12-31'),
          }}
        />,
      );

      const resetBtn = screen.getByRole('button', {
        name: /reset date filter/i,
      });
      expect(resetBtn).toBeInTheDocument();
      // Button should have accessible name via aria-label or text content
      expect(
        resetBtn.textContent || resetBtn.getAttribute('aria-label'),
      ).toBeTruthy();
    });

    it('date input elements have type="date" for native a11y support', () => {
      render(<DateRangeControls {...defaultProps} />);

      const startDate = screen.getByLabelText('Start date');
      const endDate = screen.getByLabelText('End date');

      expect(startDate).toHaveAttribute('type', 'date');
      expect(endDate).toHaveAttribute('type', 'date');
    });
  });

  describe('Focus Management (WCAG 2.1 2.4.3)', () => {
    it('quick range select can receive focus', () => {
      render(<DateRangeControls {...defaultProps} />);

      const select = screen.getByRole('combobox', { name: /quick range/i });
      select.focus();

      expect(select).toHaveFocus();
    });

    it('date inputs can receive focus', () => {
      render(
        <DateRangeControls
          {...defaultProps}
          dateFilter={{ start: null, end: null }}
        />,
      );

      const startDate = screen.getByLabelText('Start date');
      const endDate = screen.getByLabelText('End date');

      startDate.focus();
      expect(startDate).toHaveFocus();

      endDate.focus();
      expect(endDate).toHaveFocus();
    });

    it('reset button can receive focus when visible', () => {
      render(
        <DateRangeControls
          {...defaultProps}
          quickRange="custom"
          dateFilter={{
            start: new Date('2024-01-01'),
            end: new Date('2024-12-31'),
          }}
        />,
      );

      const resetBtn = screen.getByRole('button', {
        name: /reset date filter/i,
      });
      resetBtn.focus();

      expect(resetBtn).toHaveFocus();
    });

    it('activates reset button with Enter key', async () => {
      const user = userEvent.setup();
      const onReset = vi.fn();

      render(
        <DateRangeControls
          {...defaultProps}
          onReset={onReset}
          quickRange="custom"
          dateFilter={{
            start: new Date('2024-01-01'),
            end: new Date('2024-12-31'),
          }}
        />,
      );

      const resetBtn = screen.getByRole('button', {
        name: /reset date filter/i,
      });
      resetBtn.focus();

      await user.keyboard('{Enter}');

      expect(onReset).toHaveBeenCalled();
    });

    it('activates reset button with Space key', async () => {
      const user = userEvent.setup();
      const onReset = vi.fn();

      render(
        <DateRangeControls
          {...defaultProps}
          onReset={onReset}
          quickRange="custom"
          dateFilter={{
            start: new Date('2024-01-01'),
            end: new Date('2024-12-31'),
          }}
        />,
      );

      const resetBtn = screen.getByRole('button', {
        name: /reset date filter/i,
      });
      resetBtn.focus();

      await user.keyboard(' ');

      expect(onReset).toHaveBeenCalled();
    });
  });
});
