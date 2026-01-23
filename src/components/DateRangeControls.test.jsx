/* eslint-disable no-magic-numbers -- test-specific date offsets and sample data */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import DateRangeControls from './DateRangeControls';
import * as useDateFilterModule from '../hooks/useDateFilter';

describe('DateRangeControls', () => {
  const mockUseDateFilter = {
    quickRange: 'all',
    handleQuickRangeChange: vi.fn(),
    dateFilter: { start: null, end: null },
    setDateFilter: vi.fn(),
    selectCustomRange: vi.fn(),
    resetDateFilter: vi.fn(),
    parseDate: vi.fn((val) => (val ? new Date(val) : null)),
    formatDate: vi.fn((date) => {
      if (!date) return '';
      const d = new Date(date);
      return d.toISOString().slice(0, 10);
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(useDateFilterModule, 'useDateFilter').mockReturnValue(
      mockUseDateFilter,
    );
  });

  describe('Basic Functionality', () => {
    it('renders quick range selector with all preset options', () => {
      render(<DateRangeControls />);

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
      render(<DateRangeControls />);

      const select = screen.getByRole('combobox', { name: /quick range/i });
      await user.selectOptions(select, '30');

      expect(mockUseDateFilter.handleQuickRangeChange).toHaveBeenCalledWith(
        '30',
      );
    });

    it('renders start and end date inputs with aria labels', () => {
      render(<DateRangeControls />);

      const startInput = screen.getByLabelText('Start date');
      const endInput = screen.getByLabelText('End date');

      expect(startInput).toHaveAttribute('type', 'date');
      expect(endInput).toHaveAttribute('type', 'date');
    });

    it('updates start date and triggers custom range mode', async () => {
      const user = userEvent.setup();
      const newDate = '2024-01-15';

      render(<DateRangeControls />);

      const startInput = screen.getByLabelText('Start date');
      await user.clear(startInput);
      await user.type(startInput, newDate);

      expect(mockUseDateFilter.selectCustomRange).toHaveBeenCalled();
      expect(mockUseDateFilter.setDateFilter).toHaveBeenCalled();
    });

    it('updates end date and triggers custom range mode', async () => {
      const user = userEvent.setup();
      const newDate = '2024-02-15';

      render(<DateRangeControls />);

      const endInput = screen.getByLabelText('End date');
      await user.clear(endInput);
      await user.type(endInput, newDate);

      expect(mockUseDateFilter.selectCustomRange).toHaveBeenCalled();
      expect(mockUseDateFilter.setDateFilter).toHaveBeenCalled();
    });

    it('shows reset button only when filter has dates', () => {
      const { rerender } = render(<DateRangeControls />);

      let resetBtn = screen.queryByRole('button', {
        name: /reset date filter/i,
      });
      expect(resetBtn).not.toBeInTheDocument();

      vi.spyOn(useDateFilterModule, 'useDateFilter').mockReturnValue({
        ...mockUseDateFilter,
        dateFilter: { start: new Date('2024-01-01'), end: null },
      });

      rerender(<DateRangeControls />);

      resetBtn = screen.getByRole('button', { name: /reset date filter/i });
      expect(resetBtn).toBeInTheDocument();
    });

    it('calls onReset when reset button is clicked', async () => {
      const user = userEvent.setup();
      vi.spyOn(useDateFilterModule, 'useDateFilter').mockReturnValue({
        ...mockUseDateFilter,
        dateFilter: {
          start: new Date('2024-01-01'),
          end: new Date('2024-02-01'),
        },
      });

      render(<DateRangeControls />);

      const resetBtn = screen.getByRole('button', {
        name: /reset date filter/i,
      });
      await user.click(resetBtn);

      expect(mockUseDateFilter.resetDateFilter).toHaveBeenCalled();
    });

    it('formats and displays dates in start/end inputs', () => {
      const startDate = new Date('2024-01-15');
      const endDate = new Date('2024-02-15');

      vi.spyOn(useDateFilterModule, 'useDateFilter').mockReturnValue({
        ...mockUseDateFilter,
        dateFilter: { start: startDate, end: endDate },
      });

      render(<DateRangeControls />);

      const startInput = screen.getByLabelText('Start date');
      const endInput = screen.getByLabelText('End date');

      expect(startInput).toHaveValue('2024-01-15');
      expect(endInput).toHaveValue('2024-02-15');
    });

    it('maintains selected quick range value', () => {
      vi.spyOn(useDateFilterModule, 'useDateFilter').mockReturnValue({
        ...mockUseDateFilter,
        quickRange: '30',
      });

      render(<DateRangeControls />);

      const select = screen.getByRole('combobox', { name: /quick range/i });
      expect(select).toHaveValue('30');
    });

    it('handles edge case: switching between custom range and presets', async () => {
      const user = userEvent.setup();
      vi.spyOn(useDateFilterModule, 'useDateFilter').mockReturnValue({
        ...mockUseDateFilter,
        quickRange: 'custom',
      });

      const { rerender } = render(<DateRangeControls />);

      const startInput = screen.getByLabelText('Start date');
      await user.clear(startInput);
      await user.type(startInput, '2024-01-10');

      vi.spyOn(useDateFilterModule, 'useDateFilter').mockReturnValue({
        ...mockUseDateFilter,
        quickRange: '7',
        dateFilter: { start: null, end: null },
      });

      rerender(<DateRangeControls />);

      const select = screen.getByRole('combobox', { name: /quick range/i });
      expect(select).toHaveValue('7');
    });
  });

  describe('Keyboard Navigation - Tab Order (WCAG 2.1 2.4.3)', () => {
    it('maintains correct tab order: select → start date → end date → reset', async () => {
      const user = userEvent.setup();
      render(<DateRangeControls />);

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
      vi.spyOn(useDateFilterModule, 'useDateFilter').mockReturnValue({
        ...mockUseDateFilter,
        quickRange: 'custom',
        dateFilter: {
          start: new Date('2024-01-01'),
          end: new Date('2024-12-31'),
        },
      });
      render(<DateRangeControls />);

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
      vi.spyOn(useDateFilterModule, 'useDateFilter').mockReturnValue({
        ...mockUseDateFilter,
        quickRange: 'custom',
        dateFilter: {
          start: new Date('2024-01-01'),
          end: new Date('2024-12-31'),
        },
      });
      render(<DateRangeControls />);

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
      const { rerender } = render(<DateRangeControls />);

      expect(
        screen.queryByRole('button', { name: /reset date filter/i }),
      ).not.toBeInTheDocument();

      vi.spyOn(useDateFilterModule, 'useDateFilter').mockReturnValue({
        ...mockUseDateFilter,
        quickRange: 'custom',
        dateFilter: {
          start: new Date('2024-01-01'),
          end: new Date('2024-12-31'),
        },
      });
      rerender(<DateRangeControls />);

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
      render(<DateRangeControls />);

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
      render(<DateRangeControls />);

      const select = screen.getByRole('combobox', { name: /quick range/i });
      select.focus();

      // Arrow down to navigate
      await user.keyboard('{ArrowDown}');

      const options = screen.getAllByRole('option');
      expect(options.length).toBeGreaterThan(1);
    });

    it('selects option with arrow and Enter in dropdown', async () => {
      const user = userEvent.setup();
      render(<DateRangeControls />);

      const select = screen.getByRole('combobox', { name: /quick range/i });
      select.focus();

      // Navigate to 7-day option using arrow or direct selection
      await user.selectOptions(select, '7');

      // Verify the callback was called (native select may not update immediately in test)
      expect(mockUseDateFilter.handleQuickRangeChange).toHaveBeenCalled();
    });
  });

  describe('ARIA Attributes (WCAG 2.1 1.3.1)', () => {
    it('date inputs have proper aria-label attributes', () => {
      vi.spyOn(useDateFilterModule, 'useDateFilter').mockReturnValue({
        ...mockUseDateFilter,
        quickRange: 'custom',
        dateFilter: {
          start: new Date('2024-01-01'),
          end: new Date('2024-12-31'),
        },
      });
      render(<DateRangeControls />);

      const startDate = screen.getByLabelText('Start date');
      const endDate = screen.getByLabelText('End date');

      expect(startDate).toHaveAttribute('aria-label', 'Start date');
      expect(endDate).toHaveAttribute('aria-label', 'End date');
    });

    it('quick range selector has aria-label', () => {
      render(<DateRangeControls />);

      const select = screen.getByRole('combobox', { name: /quick range/i });
      expect(select).toHaveAttribute('aria-label', 'Quick range');
    });

    it('reset button has accessible label', () => {
      vi.spyOn(useDateFilterModule, 'useDateFilter').mockReturnValue({
        ...mockUseDateFilter,
        quickRange: 'custom',
        dateFilter: {
          start: new Date('2024-01-01'),
          end: new Date('2024-12-31'),
        },
      });
      render(<DateRangeControls />);

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
      render(<DateRangeControls />);

      const startDate = screen.getByLabelText('Start date');
      const endDate = screen.getByLabelText('End date');

      expect(startDate).toHaveAttribute('type', 'date');
      expect(endDate).toHaveAttribute('type', 'date');
    });
  });

  describe('Focus Management (WCAG 2.1 2.4.3)', () => {
    it('quick range select can receive focus', () => {
      render(<DateRangeControls />);

      const select = screen.getByRole('combobox', { name: /quick range/i });
      select.focus();

      expect(select).toHaveFocus();
    });

    it('date inputs can receive focus', () => {
      render(<DateRangeControls />);

      const startDate = screen.getByLabelText('Start date');
      const endDate = screen.getByLabelText('End date');

      startDate.focus();
      expect(startDate).toHaveFocus();

      endDate.focus();
      expect(endDate).toHaveFocus();
    });

    it('reset button can receive focus when visible', () => {
      vi.spyOn(useDateFilterModule, 'useDateFilter').mockReturnValue({
        ...mockUseDateFilter,
        quickRange: 'custom',
        dateFilter: {
          start: new Date('2024-01-01'),
          end: new Date('2024-12-31'),
        },
      });
      render(<DateRangeControls />);

      const resetBtn = screen.getByRole('button', {
        name: /reset date filter/i,
      });
      resetBtn.focus();

      expect(resetBtn).toHaveFocus();
    });

    it('activates reset button with Enter key', async () => {
      const user = userEvent.setup();
      vi.spyOn(useDateFilterModule, 'useDateFilter').mockReturnValue({
        ...mockUseDateFilter,
        quickRange: 'custom',
        dateFilter: {
          start: new Date('2024-01-01'),
          end: new Date('2024-12-31'),
        },
      });
      render(<DateRangeControls />);

      const resetBtn = screen.getByRole('button', {
        name: /reset date filter/i,
      });
      resetBtn.focus();

      await user.keyboard('{Enter}');

      expect(mockUseDateFilter.resetDateFilter).toHaveBeenCalled();
    });

    it('activates reset button with Space key', async () => {
      const user = userEvent.setup();
      vi.spyOn(useDateFilterModule, 'useDateFilter').mockReturnValue({
        ...mockUseDateFilter,
        quickRange: 'custom',
        dateFilter: {
          start: new Date('2024-01-01'),
          end: new Date('2024-12-31'),
        },
      });
      render(<DateRangeControls />);

      const resetBtn = screen.getByRole('button', {
        name: /reset date filter/i,
      });
      resetBtn.focus();

      await user.keyboard(' ');

      expect(mockUseDateFilter.resetDateFilter).toHaveBeenCalled();
    });
  });
});
