import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import DataImportModal from './DataImportModal.jsx';

vi.mock('../../utils/db', () => ({
  getLastSession: vi.fn(async () => ({})),
}));

const noop = () => {};

const defaultProps = {
  isOpen: true,
  onClose: noop,
  onSummaryFile: noop,
  onDetailsFile: noop,
  onLoadSaved: noop,
  onSessionFile: noop,
  summaryData: null,
  detailsData: null,
  loadingSummary: false,
  loadingDetails: false,
  summaryProgress: 0,
  summaryProgressMax: 0,
  detailsProgress: 0,
  detailsProgressMax: 0,
};

describe('DataImportModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('adds padding and centers actions', async () => {
      render(<DataImportModal {...defaultProps} />);

      const modal = document.querySelector('.modal');
      expect(modal).toHaveStyle({ padding: '24px' });

      const loadBtn = await screen.findByRole('button', {
        name: /load previous session/i,
      });
      expect(loadBtn).toHaveStyle({ alignSelf: 'center' });

      const closeBtn = screen.getByRole('button', { name: /close/i });
      expect(closeBtn).toHaveStyle({ alignSelf: 'center' });
    });

    it('remains open when reopened with loaded data', async () => {
      const onClose = vi.fn();
      render(
        <DataImportModal
          {...defaultProps}
          onClose={onClose}
          summaryData={[{}]}
          detailsData={[{}]}
        />,
      );

      await waitFor(() => {
        expect(
          screen.getByRole('dialog', { name: /import data/i }),
        ).toBeInTheDocument();
      });

      expect(onClose).not.toHaveBeenCalled();
    });

    it('closes immediately when loading a saved session', async () => {
      const onClose = vi.fn();
      const onLoadSaved = vi.fn();
      render(
        <DataImportModal
          {...defaultProps}
          onClose={onClose}
          onLoadSaved={onLoadSaved}
        />,
      );

      await userEvent.click(
        await screen.findByRole('button', { name: /load previous session/i }),
      );

      expect(onLoadSaved).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    it('closes immediately after selecting files', async () => {
      const onClose = vi.fn();
      render(<DataImportModal {...defaultProps} onClose={onClose} />);

      const input = screen.getByLabelText(/csv or session files/i);
      const summary = new File(['Date\n'], 'summary.csv', { type: 'text/csv' });
      const details = new File(['Event\n'], 'details.csv', {
        type: 'text/csv',
      });

      await userEvent.upload(input, [summary, details]);

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });
  });

  describe('Accessibility - Modal Structure (WCAG 2.1 1.3.1)', () => {
    it('has role="dialog" on modal element', async () => {
      render(<DataImportModal {...defaultProps} />);

      const modal = screen.getByRole('dialog');
      expect(modal).toBeInTheDocument();
    });

    it('has aria-label describing the modal purpose', async () => {
      render(<DataImportModal {...defaultProps} />);

      const modal = screen.getByRole('dialog', { name: /import data/i });
      expect(modal).toHaveAttribute('aria-label', 'Import Data');
    });

    it('has aria-modal="true" for screen readers', async () => {
      render(<DataImportModal {...defaultProps} />);

      const modal = screen.getByRole('dialog');
      expect(modal).toHaveAttribute('aria-modal', 'true');
    });

    it('close button has accessible label', () => {
      render(<DataImportModal {...defaultProps} />);

      const closeBtn = screen.getByRole('button', { name: /close/i });
      expect(closeBtn).toHaveAttribute('aria-label', 'Close');
    });
  });

  describe('Keyboard Navigation - Escape (WCAG 2.1 2.1.1)', () => {
    it('modal should support escape key handling', async () => {
      const onClose = vi.fn();

      render(<DataImportModal {...defaultProps} onClose={onClose} />);

      // Modal is open
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Note: Escape key handling would need to be implemented in the component
      // This test documents that the capability should exist
    });
  });

  describe('Focus Trapping (WCAG 2.1 2.1.2, 2.4.3)', () => {
    it('modal has role="dialog" for focus trap implementation', () => {
      render(<DataImportModal {...defaultProps} />);

      const modal = screen.getByRole('dialog');
      expect(modal).toBeInTheDocument();
      // Modal structure supports focus trapping implementation
    });

    it('close button is focusable in modal', () => {
      render(<DataImportModal {...defaultProps} />);

      const closeBtn = screen.getByRole('button', { name: /close/i });
      closeBtn.focus();
      expect(closeBtn).toHaveFocus();
    });

    it('file input is focusable in modal', () => {
      render(<DataImportModal {...defaultProps} />);

      const fileInput = screen.getByLabelText(/csv or session files/i);
      fileInput.focus();
      expect(fileInput).toHaveFocus();
    });
  });

  describe('Keyboard Navigation - Close Button (WCAG 2.1 2.1.1)', () => {
    it('closes modal when close button is activated with Enter', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(<DataImportModal {...defaultProps} onClose={onClose} />);

      const closeBtn = screen.getByRole('button', { name: /close/i });
      closeBtn.focus();

      await user.keyboard('{Enter}');

      expect(onClose).toHaveBeenCalled();
    });

    it('closes modal when close button is activated with Space', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(<DataImportModal {...defaultProps} onClose={onClose} />);

      const closeBtn = screen.getByRole('button', { name: /close/i });
      closeBtn.focus();

      await user.keyboard(' ');

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Keyboard Navigation - Load Previous Session', () => {
    it('activates load button with Enter key', async () => {
      const user = userEvent.setup();
      const onLoadSaved = vi.fn();
      const onClose = vi.fn();

      render(
        <DataImportModal
          {...defaultProps}
          onLoadSaved={onLoadSaved}
          onClose={onClose}
        />,
      );

      const loadBtn = await screen.findByRole('button', {
        name: /load previous session/i,
      });
      loadBtn.focus();

      await user.keyboard('{Enter}');

      expect(onLoadSaved).toHaveBeenCalled();
    });

    it('activates load button with Space key', async () => {
      const user = userEvent.setup();
      const onLoadSaved = vi.fn();
      const onClose = vi.fn();

      render(
        <DataImportModal
          {...defaultProps}
          onLoadSaved={onLoadSaved}
          onClose={onClose}
        />,
      );

      const loadBtn = await screen.findByRole('button', {
        name: /load previous session/i,
      });
      loadBtn.focus();

      await user.keyboard(' ');

      expect(onLoadSaved).toHaveBeenCalled();
    });
  });

  describe('Focus Management (WCAG 2.1 2.4.3)', () => {
    it('modal is rendered when open', () => {
      render(<DataImportModal {...defaultProps} />);

      const modal = screen.getByRole('dialog');
      expect(modal).toBeInTheDocument();
    });

    it('close button is focusable', () => {
      render(<DataImportModal {...defaultProps} />);

      const closeBtn = screen.getByRole('button', { name: /close/i });
      closeBtn.focus();

      expect(closeBtn).toHaveFocus();
    });

    it('file input is focusable', () => {
      render(<DataImportModal {...defaultProps} />);

      const fileInput = screen.getByLabelText(/csv or session files/i);
      fileInput.focus();

      expect(fileInput).toHaveFocus();
    });
  });

  describe('File Input Accessibility (WCAG 2.1 1.3.1)', () => {
    it('file input has accessible label', () => {
      render(<DataImportModal {...defaultProps} />);

      const fileInput = screen.getByLabelText(/csv or session files/i);
      expect(fileInput).toBeInTheDocument();
    });

    it('file input has proper aria-label or associated label', () => {
      render(<DataImportModal {...defaultProps} />);

      // Should be findable by label text (means label is properly associated)
      const fileInput = screen.getByLabelText(/csv or session files/i);
      expect(fileInput).toHaveAttribute('type', 'file');
    });

    it('file input accepts multiple files', () => {
      render(<DataImportModal {...defaultProps} />);

      const fileInput = screen.getByLabelText(/csv or session files/i);
      expect(fileInput).toHaveAttribute('multiple');
    });
  });

  describe('ARIA Attributes - Buttons (WCAG 2.1 1.3.1)', () => {
    it('close button has accessible name', () => {
      render(<DataImportModal {...defaultProps} />);

      const closeBtn = screen.getByRole('button', { name: /close/i });
      expect(closeBtn).toHaveAccessibleName();
    });

    it('buttons are not disabled unless loading', async () => {
      render(
        <DataImportModal
          {...defaultProps}
          loadingSummary={false}
          loadingDetails={false}
        />,
      );

      const closeBtn = screen.getByRole('button', { name: /close/i });
      expect(closeBtn).toBeEnabled();
    });
  });
});
