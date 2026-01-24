import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { UpdateNotification } from './UpdateNotification';

describe('UpdateNotification', () => {
  it('renders update notification with correct content', () => {
    render(<UpdateNotification onUpdate={vi.fn()} onDismiss={vi.fn()} />);

    expect(screen.getByText('New Version Available')).toBeInTheDocument();
    expect(
      screen.getByText(/OSCAR Analyzer has been updated/),
    ).toBeInTheDocument();
    expect(screen.getByText('Update Now')).toBeInTheDocument();
    expect(screen.getByText('Not Now')).toBeInTheDocument();
  });

  it('has proper ARIA attributes for alertdialog', () => {
    render(<UpdateNotification onUpdate={vi.fn()} onDismiss={vi.fn()} />);

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-labelledby', 'update-title');
    expect(dialog).toHaveAttribute('aria-describedby', 'update-desc');
  });

  it('auto-focuses the notification on mount', () => {
    render(<UpdateNotification onUpdate={vi.fn()} onDismiss={vi.fn()} />);

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveFocus();
  });

  it('calls onUpdate when "Update Now" button is clicked', async () => {
    const user = userEvent.setup();
    const mockUpdate = vi.fn();

    render(<UpdateNotification onUpdate={mockUpdate} onDismiss={vi.fn()} />);

    const updateButton = screen.getByRole('button', { name: /Update Now/i });
    await user.click(updateButton);

    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss when "Not Now" button is clicked', async () => {
    const user = userEvent.setup();
    const mockDismiss = vi.fn();

    render(<UpdateNotification onUpdate={vi.fn()} onDismiss={mockDismiss} />);

    const dismissButton = screen.getByText('Not Now');
    await user.click(dismissButton);

    expect(mockDismiss).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss when Escape key is pressed', async () => {
    const user = userEvent.setup();
    const mockDismiss = vi.fn();

    render(<UpdateNotification onUpdate={vi.fn()} onDismiss={mockDismiss} />);

    const dialog = screen.getByRole('alertdialog');
    dialog.focus();
    await user.keyboard('{Escape}');

    expect(mockDismiss).toHaveBeenCalledTimes(1);
  });

  it('supports keyboard navigation between buttons', async () => {
    const user = userEvent.setup();

    render(<UpdateNotification onUpdate={vi.fn()} onDismiss={vi.fn()} />);

    const dismissButton = screen.getByText('Not Now');
    const updateButton = screen.getByText('Update Now');

    // Tab to first button
    await user.tab();
    expect(dismissButton).toHaveFocus();

    // Tab to second button
    await user.tab();
    expect(updateButton).toHaveFocus();
  });

  it('triggers callbacks with Enter key on focused buttons', async () => {
    const user = userEvent.setup();
    const mockUpdate = vi.fn();
    const mockDismiss = vi.fn();

    render(
      <UpdateNotification onUpdate={mockUpdate} onDismiss={mockDismiss} />,
    );

    // Focus and activate "Not Now" button with Enter
    const dismissButton = screen.getByText('Not Now');
    dismissButton.focus();
    await user.keyboard('{Enter}');
    expect(mockDismiss).toHaveBeenCalledTimes(1);

    // Focus and activate "Update Now" button with Enter
    const updateButton = screen.getByText('Update Now');
    updateButton.focus();
    await user.keyboard('{Enter}');
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it('includes decorative icon with aria-hidden', () => {
    render(<UpdateNotification onUpdate={vi.fn()} onDismiss={vi.fn()} />);

    const icon = screen.getByText('↻');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  it('provides descriptive aria-labels for buttons', () => {
    render(<UpdateNotification onUpdate={vi.fn()} onDismiss={vi.fn()} />);

    const dismissButton = screen.getByText('Not Now');
    const updateButton = screen.getByText('Update Now');

    expect(dismissButton).toHaveAttribute(
      'aria-label',
      'Dismiss update notification and continue with current version',
    );
    expect(updateButton).toHaveAttribute(
      'aria-label',
      'Update now and reload the application',
    );
  });
});
