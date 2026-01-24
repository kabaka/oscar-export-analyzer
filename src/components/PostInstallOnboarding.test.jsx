import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PostInstallOnboarding } from './PostInstallOnboarding';

describe('PostInstallOnboarding', () => {
  it('should render modal with all content sections', () => {
    const onDismiss = vi.fn();

    render(<PostInstallOnboarding onDismiss={onDismiss} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Welcome to OSCAR Analyzer/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Your CPAP data stays on this device/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Using multiple devices\?/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Each device is independent — no automatic sync/i),
    ).toBeInTheDocument();
  });

  it('should render cross-device instructions as ordered list', () => {
    const onDismiss = vi.fn();

    render(<PostInstallOnboarding onDismiss={onDismiss} />);

    expect(
      screen.getByText(/Export your session \(Menu → Export JSON\)/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Transfer JSON file \(email, USB drive, AirDrop\)/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Import on other device \(Load Data → drop JSON\)/i),
    ).toBeInTheDocument();

    // Verify it's an ordered list
    const steps = screen.getAllByRole('listitem');
    expect(steps).toHaveLength(3);
  });

  it('should have proper ARIA attributes', () => {
    const onDismiss = vi.fn();

    render(<PostInstallOnboarding onDismiss={onDismiss} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'onboarding-title');
    expect(dialog).toHaveAttribute('aria-describedby', 'onboarding-desc');
  });

  it('should auto-focus "Got It" button on open', () => {
    const onDismiss = vi.fn();

    render(<PostInstallOnboarding onDismiss={onDismiss} />);

    const gotItButton = screen.getByRole('button', { name: /got it/i });
    expect(gotItButton).toHaveFocus();
  });

  it('should call onDismiss when "Got It" clicked', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();

    render(<PostInstallOnboarding onDismiss={onDismiss} />);

    const gotItButton = screen.getByRole('button', { name: /got it/i });
    await user.click(gotItButton);

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('should call onComplete before onDismiss', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    const onComplete = vi.fn();
    const callOrder = [];

    onComplete.mockImplementation(() => callOrder.push('complete'));
    onDismiss.mockImplementation(() => callOrder.push('dismiss'));

    render(
      <PostInstallOnboarding onDismiss={onDismiss} onComplete={onComplete} />,
    );

    const gotItButton = screen.getByRole('button', { name: /got it/i });
    await user.click(gotItButton);

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(callOrder).toEqual(['complete', 'dismiss']);
  });

  it('should call onDismiss when close button (×) clicked', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();

    render(<PostInstallOnboarding onDismiss={onDismiss} />);

    const closeButton = screen.getByRole('button', { name: /close/i });
    await user.click(closeButton);

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('should call onDismiss when backdrop clicked', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();

    render(<PostInstallOnboarding onDismiss={onDismiss} />);

    const backdrop = screen.getByRole('presentation');
    await user.click(backdrop);

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('should not close when clicking inside modal', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();

    render(<PostInstallOnboarding onDismiss={onDismiss} />);

    const modalContent = screen.getByText(/Using multiple devices\?/i);
    await user.click(modalContent);

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('should call onDismiss when Escape key pressed', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();

    render(<PostInstallOnboarding onDismiss={onDismiss} />);

    await user.keyboard('{Escape}');

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('should work without onComplete callback', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();

    render(<PostInstallOnboarding onDismiss={onDismiss} />);

    const gotItButton = screen.getByRole('button', { name: /got it/i });
    await user.click(gotItButton);

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
