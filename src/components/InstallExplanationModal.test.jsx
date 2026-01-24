import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InstallExplanationModal } from './InstallExplanationModal';

describe('InstallExplanationModal', () => {
  it('should render modal with all content sections', () => {
    const onInstall = vi.fn();
    const onDismiss = vi.fn();

    render(
      <InstallExplanationModal onInstall={onInstall} onDismiss={onDismiss} />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Install OSCAR Analyzer')).toBeInTheDocument();
    expect(screen.getByText(/What is "Installing"\?/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Privacy: All your data stays on this device/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Recommended for frequent users/i),
    ).toBeInTheDocument();
  });

  it('should render all benefit bullet points', () => {
    const onInstall = vi.fn();
    const onDismiss = vi.fn();

    render(
      <InstallExplanationModal onInstall={onInstall} onDismiss={onDismiss} />,
    );

    expect(
      screen.getByText(/Works fully offline — analyze data without internet/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Opens in own window — fewer distractions, no browser tabs/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Access from desktop\/home screen — no bookmarks needed/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Faster startup — app assets cached locally/i),
    ).toBeInTheDocument();
  });

  it('should have proper ARIA attributes', () => {
    const onInstall = vi.fn();
    const onDismiss = vi.fn();

    render(
      <InstallExplanationModal onInstall={onInstall} onDismiss={onDismiss} />,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'install-modal-title');
    expect(dialog).toHaveAttribute('aria-describedby', 'install-modal-desc');
  });

  it('should auto-focus "Not Now" button on open', () => {
    const onInstall = vi.fn();
    const onDismiss = vi.fn();

    render(
      <InstallExplanationModal onInstall={onInstall} onDismiss={onDismiss} />,
    );

    const notNowButton = screen.getByRole('button', { name: /not now/i });
    expect(notNowButton).toHaveFocus();
  });

  it('should call onDismiss when "Not Now" clicked', async () => {
    const user = userEvent.setup();
    const onInstall = vi.fn();
    const onDismiss = vi.fn();

    render(
      <InstallExplanationModal onInstall={onInstall} onDismiss={onDismiss} />,
    );

    const notNowButton = screen.getByRole('button', { name: /not now/i });
    await user.click(notNowButton);

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onInstall).not.toHaveBeenCalled();
  });

  it('should call onInstall when "Install App" clicked', async () => {
    const user = userEvent.setup();
    const onInstall = vi.fn();
    const onDismiss = vi.fn();

    render(
      <InstallExplanationModal onInstall={onInstall} onDismiss={onDismiss} />,
    );

    const installButton = screen.getByRole('button', { name: /install app/i });
    await user.click(installButton);

    expect(onInstall).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('should call onDismiss when close button (×) clicked', async () => {
    const user = userEvent.setup();
    const onInstall = vi.fn();
    const onDismiss = vi.fn();

    render(
      <InstallExplanationModal onInstall={onInstall} onDismiss={onDismiss} />,
    );

    const closeButton = screen.getByRole('button', { name: /close dialog/i });
    await user.click(closeButton);

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onInstall).not.toHaveBeenCalled();
  });

  it('should call onDismiss when backdrop clicked', async () => {
    const user = userEvent.setup();
    const onInstall = vi.fn();
    const onDismiss = vi.fn();

    render(
      <InstallExplanationModal onInstall={onInstall} onDismiss={onDismiss} />,
    );

    const backdrop = screen.getByRole('presentation');
    await user.click(backdrop);

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('should not close when clicking inside modal', async () => {
    const user = userEvent.setup();
    const onInstall = vi.fn();
    const onDismiss = vi.fn();

    render(
      <InstallExplanationModal onInstall={onInstall} onDismiss={onDismiss} />,
    );

    const modalContent = screen.getByText(/What is "Installing"\?/i);
    await user.click(modalContent);

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('should call onDismiss when Escape key pressed', async () => {
    const user = userEvent.setup();
    const onInstall = vi.fn();
    const onDismiss = vi.fn();

    render(
      <InstallExplanationModal onInstall={onInstall} onDismiss={onDismiss} />,
    );

    await user.keyboard('{Escape}');

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('should support keyboard navigation between buttons', async () => {
    const onInstall = vi.fn();
    const onDismiss = vi.fn();

    render(
      <InstallExplanationModal onInstall={onInstall} onDismiss={onDismiss} />,
    );

    const notNowButton = screen.getByRole('button', { name: /not now/i });
    const installButton = screen.getByRole('button', { name: /install app/i });
    const closeButton = screen.getByRole('button', { name: /close dialog/i });

    // Verify "Not Now" button has focus initially
    expect(notNowButton).toHaveFocus();

    // Verify all buttons are in tab order (have tabIndex >= 0 or no tabIndex attribute)
    expect(notNowButton).not.toHaveAttribute('tabindex', '-1');
    expect(installButton).not.toHaveAttribute('tabindex', '-1');
    expect(closeButton).not.toHaveAttribute('tabindex', '-1');

    // Test that buttons can be focused programmatically
    installButton.focus();
    expect(installButton).toHaveFocus();

    closeButton.focus();
    expect(closeButton).toHaveFocus();
  });
});
