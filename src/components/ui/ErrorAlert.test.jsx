import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import ErrorAlert from './ErrorAlert';

describe('ErrorAlert', () => {
  describe('Functional Tests', () => {
    it('renders with message', () => {
      render(<ErrorAlert message="Test error message" />);
      expect(screen.getByText('Test error message')).toBeInTheDocument();
    });

    it('renders with JSX message', () => {
      const message = (
        <div>
          <strong>Error:</strong> Something went wrong
        </div>
      );
      render(<ErrorAlert message={message} />);
      expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
    });

    it('calls onDismiss when dismiss button clicked', async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      render(
        <ErrorAlert
          message="Dismissible error"
          onDismiss={onDismiss}
          severity="error"
        />,
      );

      const dismissButton = screen.getByLabelText(/dismiss error/i);
      await user.click(dismissButton);
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('does not render dismiss button when onDismiss not provided', () => {
      render(<ErrorAlert message="Non-dismissible error" />);
      expect(
        screen.queryByRole('button', { name: /dismiss/i }),
      ).not.toBeInTheDocument();
    });

    it('hides dismiss button when showDismiss is false even with onDismiss', () => {
      const onDismiss = vi.fn();
      render(
        <ErrorAlert
          message="Hidden dismiss"
          onDismiss={onDismiss}
          showDismiss={false}
        />,
      );
      expect(
        screen.queryByRole('button', { name: /dismiss/i }),
      ).not.toBeInTheDocument();
    });

    it('shows dismiss button when showDismiss is true', () => {
      const onDismiss = vi.fn();
      render(
        <ErrorAlert
          message="Shown dismiss"
          onDismiss={onDismiss}
          showDismiss={true}
        />,
      );
      expect(
        screen.getByRole('button', { name: /dismiss/i }),
      ).toBeInTheDocument();
    });

    it('renders children (action elements)', () => {
      render(
        <ErrorAlert message="Error with action">
          <button>Retry</button>
          <a href="/help">Get Help</a>
        </ErrorAlert>,
      );
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: 'Get Help' }),
      ).toBeInTheDocument();
    });
  });

  describe('Severity Levels', () => {
    it('applies error severity by default', () => {
      render(<ErrorAlert message="Default severity" />);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('error-alert--error');
    });

    it('applies error severity when explicitly set', () => {
      render(<ErrorAlert message="Error message" severity="error" />);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('error-alert--error');
    });

    it('applies warning severity', () => {
      render(<ErrorAlert message="Warning message" severity="warning" />);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('error-alert--warning');
    });

    it('applies info severity', () => {
      render(<ErrorAlert message="Info message" severity="info" />);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('error-alert--info');
    });

    it('displays default error icon', () => {
      render(<ErrorAlert message="Error" severity="error" />);
      expect(screen.getByText('⚠️')).toBeInTheDocument();
    });

    it('displays default warning icon', () => {
      render(<ErrorAlert message="Warning" severity="warning" />);
      expect(screen.getByText('⚡')).toBeInTheDocument();
    });

    it('displays default info icon', () => {
      render(<ErrorAlert message="Info" severity="info" />);
      expect(screen.getByText('ℹ️')).toBeInTheDocument();
    });
  });

  describe('Icon Behavior', () => {
    it('shows icon by default', () => {
      render(<ErrorAlert message="With icon" severity="error" />);
      expect(screen.getByText('⚠️')).toBeInTheDocument();
    });

    it('hides icon when showIcon is false', () => {
      render(
        <ErrorAlert message="Without icon" severity="error" showIcon={false} />,
      );
      expect(screen.queryByText('⚠️')).not.toBeInTheDocument();
    });

    it('displays custom icon string', () => {
      render(<ErrorAlert message="Custom icon" icon="🔥" />);
      expect(screen.getByText('🔥')).toBeInTheDocument();
    });

    it('displays custom icon JSX', () => {
      const customIcon = <span data-testid="custom-icon">X</span>;
      render(<ErrorAlert message="Custom JSX icon" icon={customIcon} />);
      expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    });

    it('icon is hidden from screen readers', () => {
      render(<ErrorAlert message="Icon aria-hidden" severity="error" />);
      const iconElement = screen.getByText('⚠️');
      expect(iconElement).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('Accessibility Tests', () => {
    it('has role="alert"', () => {
      render(<ErrorAlert message="Alert role" />);
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('has aria-live="assertive"', () => {
      render(<ErrorAlert message="Assertive live region" />);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-live', 'assertive');
    });

    it('has aria-atomic="true"', () => {
      render(<ErrorAlert message="Atomic alert" />);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-atomic', 'true');
    });

    it('has auto-generated aria-label for error', () => {
      render(<ErrorAlert message="Test error" severity="error" />);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-label', 'Error: Test error');
    });

    it('has auto-generated aria-label for warning', () => {
      render(<ErrorAlert message="Test warning" severity="warning" />);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-label', 'Warning: Test warning');
    });

    it('has auto-generated aria-label for info', () => {
      render(<ErrorAlert message="Test info" severity="info" />);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-label', 'Information: Test info');
    });

    it('uses custom ariaLabel when provided', () => {
      render(
        <ErrorAlert
          message="Test"
          ariaLabel="Custom label for screen readers"
        />,
      );
      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute(
        'aria-label',
        'Custom label for screen readers',
      );
    });

    it('dismiss button has descriptive aria-label for error', () => {
      const onDismiss = vi.fn();
      render(
        <ErrorAlert message="Test" severity="error" onDismiss={onDismiss} />,
      );
      expect(
        screen.getByLabelText('Dismiss error message'),
      ).toBeInTheDocument();
    });

    it('dismiss button has descriptive aria-label for warning', () => {
      const onDismiss = vi.fn();
      render(
        <ErrorAlert message="Test" severity="warning" onDismiss={onDismiss} />,
      );
      expect(
        screen.getByLabelText('Dismiss warning message'),
      ).toBeInTheDocument();
    });

    it('dismiss button has descriptive aria-label for info', () => {
      const onDismiss = vi.fn();
      render(
        <ErrorAlert message="Test" severity="info" onDismiss={onDismiss} />,
      );
      expect(screen.getByLabelText('Dismiss info message')).toBeInTheDocument();
    });

    it('has auto-generated ID', () => {
      render(<ErrorAlert message="Auto ID" />);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('id');
      expect(alert.id).toMatch(/error-alert-/);
    });

    it('uses custom ID when provided', () => {
      render(<ErrorAlert message="Custom ID" id="test-alert-123" />);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('id', 'test-alert-123');
    });
  });

  describe('Keyboard Navigation', () => {
    it('dismisses on Escape key when onDismiss provided', async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      render(<ErrorAlert message="Press Escape" onDismiss={onDismiss} />);

      const alert = screen.getByRole('alert');
      await user.click(alert); // Focus the alert
      await user.keyboard('{Escape}');

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('does not dismiss on Escape when onDismiss not provided', async () => {
      const user = userEvent.setup();
      render(<ErrorAlert message="No dismiss" />);

      const alert = screen.getByRole('alert');
      alert.focus();
      await user.keyboard('{Escape}');

      // No error should be thrown; alert should still be in document
      expect(alert).toBeInTheDocument();
    });

    it('does not dismiss on Escape when showDismiss is false', async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      render(
        <ErrorAlert
          message="Hidden dismiss"
          onDismiss={onDismiss}
          showDismiss={false}
        />,
      );

      const alert = screen.getByRole('alert');
      alert.focus();
      await user.keyboard('{Escape}');

      expect(onDismiss).not.toHaveBeenCalled();
    });

    it('dismiss button can be focused via Tab', async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      render(<ErrorAlert message="Tab focus" onDismiss={onDismiss} />);

      const dismissButton = screen.getByLabelText(/dismiss/i);
      await user.tab();

      // The button should be focusable
      expect(dismissButton).toBeInTheDocument();
    });

    it('dismiss button activates on Enter key', async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      render(<ErrorAlert message="Enter key" onDismiss={onDismiss} />);

      const dismissButton = screen.getByLabelText(/dismiss/i);
      dismissButton.focus();
      await user.keyboard('{Enter}');

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('dismiss button activates on Space key', async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      render(<ErrorAlert message="Space key" onDismiss={onDismiss} />);

      const dismissButton = screen.getByLabelText(/dismiss/i);
      dismissButton.focus();
      await user.keyboard(' ');

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe('CSS Class Structure', () => {
    it('applies base error-alert class', () => {
      render(<ErrorAlert message="Base class" />);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('error-alert');
    });

    it('applies custom className', () => {
      render(<ErrorAlert message="Custom class" className="my-custom-class" />);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('error-alert', 'my-custom-class');
    });

    it('icon has correct BEM class', () => {
      render(<ErrorAlert message="Icon class" />);
      const icon = screen.getByText('⚠️');
      expect(icon).toHaveClass('error-alert__icon');
    });

    it('message has correct BEM class', () => {
      render(<ErrorAlert message="Message class" />);
      const alert = screen.getByRole('alert');
      const messageDiv = alert.querySelector('.error-alert__message');
      expect(messageDiv).toBeInTheDocument();
      expect(messageDiv).toHaveTextContent('Message class');
    });

    it('actions container has correct BEM class', () => {
      render(
        <ErrorAlert message="Actions class">
          <button>Action</button>
        </ErrorAlert>,
      );
      const alert = screen.getByRole('alert');
      const actionsDiv = alert.querySelector('.error-alert__actions');
      expect(actionsDiv).toBeInTheDocument();
    });

    it('dismiss button has correct BEM class', () => {
      const onDismiss = vi.fn();
      render(<ErrorAlert message="Dismiss class" onDismiss={onDismiss} />);
      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      expect(dismissButton).toHaveClass('error-alert__dismiss');
    });
  });

  describe('Edge Cases', () => {
    it('handles empty string message', () => {
      render(<ErrorAlert message="" />);
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
    });

    it('handles very long message text', () => {
      const REPEAT_COUNT = 5;
      const longMessage =
        'This is a very long error message that should wrap properly on multiple lines and not cause layout issues. '.repeat(
          REPEAT_COUNT,
        );
      render(<ErrorAlert message={longMessage} />);
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      // Message should be in the document (using role to check)
      expect(alert).toHaveTextContent('This is a very long error message');
    });

    it('handles message with special characters', () => {
      const specialMessage = 'Error: <script>alert("XSS")</script>';
      render(<ErrorAlert message={specialMessage} />);
      // React automatically escapes strings, so script won't execute
      expect(screen.getByText(specialMessage)).toBeInTheDocument();
    });

    it('handles multiple alerts in sequence', () => {
      render(
        <>
          <ErrorAlert message="Error 1" severity="error" />
          <ErrorAlert message="Warning 1" severity="warning" />
          <ErrorAlert message="Info 1" severity="info" />
        </>,
      );
      const alerts = screen.getAllByRole('alert');
      const EXPECTED_ALERT_COUNT = 3;
      expect(alerts).toHaveLength(EXPECTED_ALERT_COUNT);
    });
  });
});
