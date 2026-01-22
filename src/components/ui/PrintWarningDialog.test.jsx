import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import PrintWarningDialog from './PrintWarningDialog.jsx';

describe('PrintWarningDialog', () => {
  let user;

  beforeEach(() => {
    user = userEvent.setup();
  });

  describe('Rendering', () => {
    it('returns null when isOpen is false', () => {
      const { container } = render(
        <PrintWarningDialog
          isOpen={false}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
        />,
      );
      expect(container).toBeEmptyDOMElement();
    });

    it('renders dialog when isOpen is true', () => {
      render(
        <PrintWarningDialog isOpen onClose={vi.fn()} onConfirm={vi.fn()} />,
      );
      expect(
        screen.getByRole('alertdialog', {
          name: /print sensitive health data/i,
        }),
      ).toBeInTheDocument();
    });

    it('displays warning title with emoji', () => {
      render(
        <PrintWarningDialog isOpen onClose={vi.fn()} onConfirm={vi.fn()} />,
      );
      const heading = screen.getByRole('heading', {
        name: /warning.*print sensitive health data/i,
      });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent('⚠️');
    });

    it('lists all sensitive data types', () => {
      render(
        <PrintWarningDialog isOpen onClose={vi.fn()} onConfirm={vi.fn()} />,
      );
      expect(
        screen.getByText(/ahi.*apnea-hypopnea index/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/spo2.*oxygen saturation/i)).toBeInTheDocument();
      expect(screen.getByText(/leak rates and pressure/i)).toBeInTheDocument();
      expect(
        screen.getByText(/session dates.*usage patterns/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/statistical analyses/i)).toBeInTheDocument();
    });

    it('displays security checklist', () => {
      render(
        <PrintWarningDialog isOpen onClose={vi.fn()} onConfirm={vi.fn()} />,
      );
      expect(screen.getByText(/private location/i)).toBeInTheDocument();
      expect(screen.getByText(/printer is secure/i)).toBeInTheDocument();
      expect(screen.getByText(/handle printed pages/i)).toBeInTheDocument();
      expect(screen.getByText(/stored securely/i)).toBeInTheDocument();
    });

    it('displays privacy notice', () => {
      render(
        <PrintWarningDialog isOpen onClose={vi.fn()} onConfirm={vi.fn()} />,
      );
      expect(
        screen.getByText(
          /processed locally.*printing creates a physical copy/i,
        ),
      ).toBeInTheDocument();
    });

    it('renders cancel and print anyway buttons', () => {
      render(
        <PrintWarningDialog isOpen onClose={vi.fn()} onConfirm={vi.fn()} />,
      );
      expect(
        screen.getByRole('button', { name: /cancel/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /confirm and print/i }),
      ).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('uses alertdialog role', () => {
      render(
        <PrintWarningDialog isOpen onClose={vi.fn()} onConfirm={vi.fn()} />,
      );
      const dialog = screen.getByRole('alertdialog');
      expect(dialog).toBeInTheDocument();
    });

    it('has aria-modal attribute', () => {
      render(
        <PrintWarningDialog isOpen onClose={vi.fn()} onConfirm={vi.fn()} />,
      );
      const dialog = screen.getByRole('alertdialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('has aria-labelledby pointing to title', () => {
      render(
        <PrintWarningDialog isOpen onClose={vi.fn()} onConfirm={vi.fn()} />,
      );
      const dialog = screen.getByRole('alertdialog');
      expect(dialog).toHaveAttribute('aria-labelledby', 'print-warning-title');
      expect(document.getElementById('print-warning-title')).toHaveTextContent(
        /print sensitive health data/i,
      );
    });

    it('has aria-describedby pointing to description', () => {
      render(
        <PrintWarningDialog isOpen onClose={vi.fn()} onConfirm={vi.fn()} />,
      );
      const dialog = screen.getByRole('alertdialog');
      expect(dialog).toHaveAttribute(
        'aria-describedby',
        'print-warning-description',
      );
      expect(
        document.getElementById('print-warning-description'),
      ).toHaveTextContent(/protected health information/i);
    });

    it('has appropriate aria-labels on buttons', () => {
      render(
        <PrintWarningDialog isOpen onClose={vi.fn()} onConfirm={vi.fn()} />,
      );
      expect(
        screen.getByRole('button', { name: /cancel printing/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', {
          name: /confirm and print sensitive health data/i,
        }),
      ).toBeInTheDocument();
    });
  });

  describe('Focus Management', () => {
    it('focuses cancel button on open', async () => {
      render(
        <PrintWarningDialog isOpen onClose={vi.fn()} onConfirm={vi.fn()} />,
      );
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancel/i })).toHaveFocus();
      });
    });

    it('restores focus to previous element on close', async () => {
      const onClose = vi.fn();
      const triggerButton = document.createElement('button');
      triggerButton.textContent = 'Trigger';
      document.body.appendChild(triggerButton);
      triggerButton.focus();

      const { rerender } = render(
        <PrintWarningDialog
          isOpen={false}
          onClose={onClose}
          onConfirm={vi.fn()}
        />,
      );

      // Open dialog
      rerender(
        <PrintWarningDialog isOpen onClose={onClose} onConfirm={vi.fn()} />,
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancel/i })).toHaveFocus();
      });

      // Close dialog
      rerender(
        <PrintWarningDialog
          isOpen={false}
          onClose={onClose}
          onConfirm={vi.fn()}
        />,
      );

      await waitFor(() => {
        expect(triggerButton).toHaveFocus();
      });

      document.body.removeChild(triggerButton);
    });
  });

  describe('User Interactions', () => {
    it('calls onClose when cancel button is clicked', async () => {
      const onClose = vi.fn();
      render(
        <PrintWarningDialog isOpen onClose={onClose} onConfirm={vi.fn()} />,
      );
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onConfirm and onClose when print anyway button is clicked', async () => {
      const onClose = vi.fn();
      const onConfirm = vi.fn();
      render(
        <PrintWarningDialog isOpen onClose={onClose} onConfirm={onConfirm} />,
      );
      const printButton = screen.getByRole('button', {
        name: /confirm and print/i,
      });
      await user.click(printButton);
      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when backdrop is clicked', async () => {
      const onClose = vi.fn();
      render(
        <PrintWarningDialog isOpen onClose={onClose} onConfirm={vi.fn()} />,
      );
      const backdrop = screen.getByRole('alertdialog');
      await user.click(backdrop);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when clicking inside modal content', async () => {
      const onClose = vi.fn();
      render(
        <PrintWarningDialog isOpen onClose={onClose} onConfirm={vi.fn()} />,
      );
      const heading = screen.getByRole('heading', {
        name: /print sensitive health data/i,
      });
      await user.click(heading);
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard Navigation', () => {
    it('closes dialog when Escape key is pressed', async () => {
      const onClose = vi.fn();
      render(
        <PrintWarningDialog isOpen onClose={onClose} onConfirm={vi.fn()} />,
      );
      await user.keyboard('{Escape}');
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('activates cancel button when Enter is pressed while focused', async () => {
      const onClose = vi.fn();
      render(
        <PrintWarningDialog isOpen onClose={onClose} onConfirm={vi.fn()} />,
      );
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancel/i })).toHaveFocus();
      });
      await user.keyboard('{Enter}');
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('activates print anyway button when Enter is pressed while focused', async () => {
      const onConfirm = vi.fn();
      const onClose = vi.fn();
      render(
        <PrintWarningDialog isOpen onClose={onClose} onConfirm={onConfirm} />,
      );
      const printButton = screen.getByRole('button', {
        name: /confirm and print/i,
      });
      await user.click(printButton);
      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('cycles focus forward with Tab key', async () => {
      render(
        <PrintWarningDialog isOpen onClose={vi.fn()} onConfirm={vi.fn()} />,
      );
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      const printButton = screen.getByRole('button', {
        name: /confirm and print/i,
      });

      await waitFor(() => {
        expect(cancelButton).toHaveFocus();
      });

      await user.keyboard('{Tab}');
      expect(printButton).toHaveFocus();

      await user.keyboard('{Tab}');
      expect(cancelButton).toHaveFocus(); // wraps to first
    });

    it('cycles focus backward with Shift+Tab key', async () => {
      render(
        <PrintWarningDialog isOpen onClose={vi.fn()} onConfirm={vi.fn()} />,
      );
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      const printButton = screen.getByRole('button', {
        name: /confirm and print/i,
      });

      await waitFor(() => {
        expect(cancelButton).toHaveFocus();
      });

      await user.keyboard('{Shift>}{Tab}{/Shift}');
      expect(printButton).toHaveFocus(); // wraps to last

      await user.keyboard('{Shift>}{Tab}{/Shift}');
      expect(cancelButton).toHaveFocus();
    });
  });

  describe('Button Styling', () => {
    it('applies primary button style to cancel', () => {
      render(
        <PrintWarningDialog isOpen onClose={vi.fn()} onConfirm={vi.fn()} />,
      );
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      expect(cancelButton).toHaveClass('btn-primary');
    });

    it('applies warning style to print anyway button', () => {
      render(
        <PrintWarningDialog isOpen onClose={vi.fn()} onConfirm={vi.fn()} />,
      );
      const printButton = screen.getByRole('button', {
        name: /confirm and print/i,
      });
      expect(printButton).toHaveClass('btn-warning');
      // Check inline warning color style includes the orange warning color
      const style = printButton.getAttribute('style');
      expect(style).toContain('#d97706');
    });
  });
});
