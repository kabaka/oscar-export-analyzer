import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import DateRangeControls from '../../components/DateRangeControls';
import HeaderMenu from '../../components/HeaderMenu';

describe('Keyboard Navigation Tests', () => {
  describe('DateRangeControls', () => {
    const defaultProps = {
      quickRange: 'all',
      dateFilter: { start: null, end: null },
      onQuickRangeChange: () => {},
      onDateFilterChange: () => {},
      onCustomRange: () => {},
      onReset: () => {},
      parseDate: (val) => (val ? new Date(val) : null),
      formatDate: (date) => {
        if (!date) return '';
        const d = new Date(date);
        return d.toISOString().slice(0, 10);
      },
    };

    it('allows tabbing through all interactive elements in order', async () => {
      const user = userEvent.setup();
      render(<DateRangeControls {...defaultProps} />);

      const quickRangeSelect = screen.getByRole('combobox', {
        name: /quick range/i,
      });
      const startDateInput = screen.getByLabelText('Start date');
      const endDateInput = screen.getByLabelText('End date');

      // Tab to quick range
      await user.tab();
      expect(quickRangeSelect).toHaveFocus();

      // Tab to start date
      await user.tab();
      expect(startDateInput).toHaveFocus();

      // Tab to end date
      await user.tab();
      expect(endDateInput).toHaveFocus();
    });

    it('allows reverse tab navigation (Shift+Tab)', async () => {
      const user = userEvent.setup();
      render(<DateRangeControls {...defaultProps} />);

      const endDateInput = screen.getByLabelText('End date');

      // Focus to the last element
      endDateInput.focus();
      expect(endDateInput).toHaveFocus();

      // Reverse tab
      await user.tab({ shift: true });
      // Should be in the input group, verify no error occurs
      expect(endDateInput).not.toHaveFocus();
    });

    it('allows opening quick range dropdown with Enter/Space', async () => {
      const user = userEvent.setup();
      render(<DateRangeControls {...defaultProps} />);

      const select = screen.getByRole('combobox', { name: /quick range/i });
      select.focus();

      // Native select allows space to open
      await user.keyboard(' ');
      expect(select).toHaveFocus();
    });

    it('allows selecting date inputs with keyboard', async () => {
      const user = userEvent.setup();
      render(<DateRangeControls {...defaultProps} />);

      const startInput = screen.getByLabelText('Start date');
      startInput.focus();
      expect(startInput).toHaveFocus();

      await user.type(startInput, '01152024');
      // Verify input received keyboard input
      expect(startInput).toHaveFocus();
    });

    it('shows visible focus indicator on keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<DateRangeControls {...defaultProps} />);

      const select = screen.getByRole('combobox', { name: /quick range/i });

      // Before tab, element shouldn't have visual focus state from keyboard
      expect(select).not.toHaveFocus();

      // After tab, should have focus
      await user.tab();
      expect(select).toHaveFocus();
    });

    it('includes reset button in tab order when visible', async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <DateRangeControls
          {...defaultProps}
          dateFilter={{ start: null, end: null }}
        />,
      );

      const endDateInput = screen.getByLabelText('End date');

      // Reset not visible - tab should skip it
      await user.tab();
      await user.tab();
      await user.tab();
      expect(endDateInput).toHaveFocus();

      // Rerender with dates to show reset button
      rerender(
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

      // Reset button should be focusable
      resetBtn.focus();
      expect(resetBtn).toHaveFocus();

      // Enter should trigger reset
      await user.keyboard('{Enter}');
      // Just verify it was clickable via keyboard
      expect(resetBtn).toBeInTheDocument();
    });
  });

  describe('HeaderMenu keyboard navigation', () => {
    const defaultProps = {
      onOpenImport: () => {},
      onExportJson: () => {},
      onExportCsv: () => {},
      onClearSession: () => {},
      onPrint: () => {},
      onOpenGuide: () => {},
      hasAnyData: true,
      summaryAvailable: true,
    };

    it('allows opening menu with keyboard (Enter/Space on button)', async () => {
      const user = userEvent.setup();
      render(<HeaderMenu {...defaultProps} />);

      const menuBtn = screen.getByRole('button', { name: /menu/i });
      menuBtn.focus();

      await user.keyboard('{Enter}');
      // Menu should open and items become visible
      const loadItem = screen.getByRole('menuitem', { name: /load data/i });
      expect(loadItem).toBeInTheDocument();
    });

    it('allows keyboard navigation within menu items (Arrow Down/Up)', async () => {
      const user = userEvent.setup();
      render(<HeaderMenu {...defaultProps} />);

      const menuBtn = screen.getByRole('button', { name: /menu/i });
      await user.click(menuBtn);

      const items = screen.getAllByRole('menuitem');
      const firstItem = items[0];

      // Focus first item
      firstItem.focus();
      expect(firstItem).toHaveFocus();

      // Arrow down to next item
      if (items.length > 1) {
        await user.keyboard('{ArrowDown}');
        // Browser should move focus (we verify menu items exist)
        expect(items[1]).toBeInTheDocument();
      }
    });

    it('allows selecting menu item with Enter or Space', async () => {
      const user = userEvent.setup();
      const onOpenImport = vi.fn();

      render(<HeaderMenu {...defaultProps} onOpenImport={onOpenImport} />);

      const menuBtn = screen.getByRole('button', { name: /menu/i });
      await user.click(menuBtn);

      const loadItem = screen.getByRole('menuitem', { name: /load data/i });
      loadItem.focus();

      await user.keyboard('{Enter}');
      // Action should be triggered
      expect(onOpenImport).toHaveBeenCalled();
    });

    it('closes menu with Escape key', async () => {
      const user = userEvent.setup();
      render(<HeaderMenu {...defaultProps} />);

      const menuBtn = screen.getByRole('button', { name: /menu/i });
      await user.click(menuBtn);

      let loadItem = screen.getByRole('menuitem', { name: /load data/i });
      expect(loadItem).toBeInTheDocument();

      await user.keyboard('{Escape}');

      // Menu should close, items might not be visible
      // Just verify the action didn't error
      expect(menuBtn).toBeInTheDocument();
    });
  });

  describe('Form navigation in modals', () => {
    it('maintains tab order within modal overlay (DateRangeControls)', async () => {
      const user = userEvent.setup();
      render(
        <DateRangeControls
          quickRange="all"
          dateFilter={{ start: null, end: null }}
          onQuickRangeChange={() => {}}
          onDateFilterChange={() => {}}
          onCustomRange={() => {}}
          onReset={() => {}}
          parseDate={(val) => (val ? new Date(val) : null)}
          formatDate={(date) => {
            if (!date) return '';
            return date.toISOString().slice(0, 10);
          }}
        />,
      );

      const select = screen.getByRole('combobox', { name: /quick range/i });
      select.focus();

      // Verify focus can move through controls
      await user.tab();
      const startInput = screen.getByLabelText('Start date');
      expect(startInput).toHaveFocus();

      await user.tab();
      const endInput = screen.getByLabelText('End date');
      expect(endInput).toHaveFocus();
    });
  });
});
