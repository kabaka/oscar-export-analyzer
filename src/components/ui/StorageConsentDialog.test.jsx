import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import StorageConsentDialog from './StorageConsentDialog.jsx';

describe('StorageConsentDialog', () => {
  it('does not render when isOpen is false', () => {
    render(
      <StorageConsentDialog
        isOpen={false}
        onAllow={vi.fn()}
        onDeny={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(
      screen.queryByText(/Save Data to This Browser/i),
    ).not.toBeInTheDocument();
  });

  it('renders with correct title and lock icon when open', () => {
    render(
      <StorageConsentDialog
        isOpen
        onAllow={vi.fn()}
        onDeny={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText(/Save Data to This Browser/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Lock')).toBeInTheDocument();
  });

  it('displays all required consent information', () => {
    render(
      <StorageConsentDialog
        isOpen
        onAllow={vi.fn()}
        onDeny={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    // Check for main description
    expect(
      screen.getByText(/remember your uploaded data between visits/i),
    ).toBeInTheDocument();

    // Check for data types included
    expect(
      screen.getByText(/All imported OSCAR CSV data/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Chart filters and settings/i)).toBeInTheDocument();
    expect(screen.getByText(/Analysis parameters/i)).toBeInTheDocument();

    // Check for privacy assurances
    expect(screen.getByText(/Stays on your device/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Is never sent to any server/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Can be deleted anytime/i)).toBeInTheDocument();
  });

  it('calls onAllow when "Save to Browser" button is clicked', async () => {
    const user = userEvent.setup();
    const onAllow = vi.fn();
    render(
      <StorageConsentDialog
        isOpen
        onAllow={onAllow}
        onDeny={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    const allowButton = screen.getByRole('button', {
      name: /^Save data to browser$/i,
    });
    await user.click(allowButton);
    expect(onAllow).toHaveBeenCalledTimes(1);
  });

  it('calls onDeny when "Don\'t Save" button is clicked', async () => {
    const user = userEvent.setup();
    const onDeny = vi.fn();
    render(
      <StorageConsentDialog
        isOpen
        onAllow={vi.fn()}
        onDeny={onDeny}
        onDismiss={vi.fn()}
      />,
    );

    const denyButton = screen.getByRole('button', { name: /Don't Save/i });
    await user.click(denyButton);
    expect(onDeny).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss when "Ask me later" link is clicked', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <StorageConsentDialog
        isOpen
        onAllow={vi.fn()}
        onDeny={vi.fn()}
        onDismiss={onDismiss}
      />,
    );

    const dismissLink = screen.getByRole('button', { name: /Ask me later/i });
    await user.click(dismissLink);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss when Escape key is pressed', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <StorageConsentDialog
        isOpen
        onAllow={vi.fn()}
        onDeny={vi.fn()}
        onDismiss={onDismiss}
      />,
    );

    await user.keyboard('{Escape}');
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss when backdrop is clicked', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <StorageConsentDialog
        isOpen
        onAllow={vi.fn()}
        onDeny={vi.fn()}
        onDismiss={onDismiss}
      />,
    );

    // Find the backdrop element and click directly outside the modal content
    const backdrop = screen.getByRole('alertdialog');
    await user.click(backdrop);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('has proper ARIA attributes for accessibility', () => {
    render(
      <StorageConsentDialog
        isOpen
        onAllow={vi.fn()}
        onDeny={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'storage-consent-title');
    expect(dialog).toHaveAttribute(
      'aria-describedby',
      'storage-consent-description',
    );
  });

  it('focuses "Don\'t Save" button when opened (privacy-safe default)', async () => {
    const { rerender } = render(
      <StorageConsentDialog
        isOpen={false}
        onAllow={vi.fn()}
        onDeny={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    rerender(
      <StorageConsentDialog
        isOpen
        onAllow={vi.fn()}
        onDeny={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    // Wait for focus to be set
    const focusDelay = 10;
    await new Promise((resolve) => setTimeout(resolve, focusDelay));

    const denyButton = screen.getByRole('button', { name: /Don't Save/i });
    expect(denyButton).toHaveFocus();
  });

  it('has minimum touch target sizes (44×44px) for mobile accessibility', () => {
    render(
      <StorageConsentDialog
        isOpen
        onAllow={vi.fn()}
        onDeny={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    const allowButton = screen.getByRole('button', {
      name: /^Save data to browser$/i,
    });
    const denyButton = screen.getByRole('button', { name: /Don't Save/i });
    const dismissLink = screen.getByRole('button', { name: /Ask me later/i });

    expect(allowButton).toHaveStyle({ minHeight: '44px' });
    expect(denyButton).toHaveStyle({ minHeight: '44px' });
    expect(dismissLink).toHaveStyle({ minHeight: '44px' });
  });

  it('maintains focus trap: Tab wraps from last to first element', async () => {
    const user = userEvent.setup();
    render(
      <StorageConsentDialog
        isOpen
        onAllow={vi.fn()}
        onDeny={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    // Wait for focus to be set
    const focusDelay = 10;
    await new Promise((resolve) => setTimeout(resolve, focusDelay));

    const denyButton = screen.getByRole('button', { name: /Don't Save/i });

    // Focus should start on deny button
    expect(denyButton).toHaveFocus();

    // Tab through all elements
    await user.tab(); // -> Save to Browser
    await user.tab(); // -> Ask me later
    await user.tab(); // Should wrap to Don't Save

    expect(denyButton).toHaveFocus();
  });

  it('maintains focus trap: Shift+Tab wraps from first to last element', async () => {
    const user = userEvent.setup();
    render(
      <StorageConsentDialog
        isOpen
        onAllow={vi.fn()}
        onDeny={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    // Wait for focus to be set
    const focusDelay = 10;
    await new Promise((resolve) => setTimeout(resolve, focusDelay));

    const denyButton = screen.getByRole('button', { name: /Don't Save/i });
    const dismissLink = screen.getByRole('button', { name: /Ask me later/i });

    // Initially, focus management doesn't run in JSDOM (testing limitation)
    // Manually set focus for testing purposes
    denyButton.focus();

    // Shift+Tab should wrap to last element
    await user.tab({ shift: true });
    expect(dismissLink).toHaveFocus();
  });
});
