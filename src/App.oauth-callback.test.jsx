/**
 * Tests for OAuth callback handling in App.jsx
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppShell } from './App';
import { AppProviders } from './app/AppProviders';

// Mock PWA
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, vi.fn()],
    updateServiceWorker: vi.fn(),
  }),
}));

// Mock OAuthCallbackHandler
let mockOnCompleteCallback = null;
vi.mock('./components/OAuthCallbackHandler', () => ({
  default: ({ onComplete }) => {
    // Store callback but don't auto-complete
    mockOnCompleteCallback = onComplete;
    return <div data-testid="oauth-handler">Processing OAuth...</div>;
  },
}));

describe('App OAuth Callback Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset location
    delete window.location;
    window.location = {
      search: '',
      hash: '',
      pathname: '/',
      href: 'http://localhost:5173/',
    };

    // Mock history API
    window.history.replaceState = vi.fn();
  });

  it('detects OAuth callback parameters in URL', () => {
    // Simulate OAuth callback URL
    window.location.search = '?code=test-code&state=test-state';

    render(
      <AppProviders>
        <AppShell />
      </AppProviders>,
    );

    // Should show passphrase prompt
    expect(
      screen.getByText(/Encryption Passphrase Required/i),
    ).toBeInTheDocument();
  });

  it('shows passphrase input with validation', async () => {
    window.location.search = '?code=test-code&state=test-state';
    const user = userEvent.setup();

    render(
      <AppProviders>
        <AppShell />
      </AppProviders>,
    );

    const passphraseInput = screen.getByLabelText(/Passphrase:/i);
    const continueButton = screen.getByRole('button', { name: /Continue/i });

    // Initially disabled (no passphrase)
    expect(continueButton).toBeDisabled();

    // Type short passphrase
    await user.type(passphraseInput, 'short');

    // Should show validation message
    expect(
      screen.getByText(/Passphrase must be at least 8 characters/i),
    ).toBeInTheDocument();

    // Still disabled
    expect(continueButton).toBeDisabled();

    // Type valid passphrase
    await user.clear(passphraseInput);
    await user.type(passphraseInput, 'valid-passphrase-123');

    // Should enable continue button
    expect(continueButton).toBeEnabled();
  });

  it('renders OAuthCallbackHandler after passphrase entered', async () => {
    window.location.search = '?code=test-code&state=test-state';
    const user = userEvent.setup();

    render(
      <AppProviders>
        <AppShell />
      </AppProviders>,
    );

    // Enter passphrase and continue
    const passphraseInput = screen.getByLabelText(/Passphrase:/i);
    await user.type(passphraseInput, 'valid-passphrase-123');

    const continueButton = screen.getByRole('button', { name: /Continue/i });
    await user.click(continueButton);

    // Passphrase modal should be hidden
    await waitFor(() => {
      expect(
        screen.queryByText(/Encryption Passphrase Required/i),
      ).not.toBeInTheDocument();
    });

    // Should render OAuth handler
    await waitFor(
      () => {
        expect(screen.getByTestId('oauth-handler')).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it('cleans up URL parameters after OAuth complete', async () => {
    window.location.search = '?code=test-code&state=test-state';
    window.location.hash = '#overview';
    const user = userEvent.setup();

    render(
      <AppProviders>
        <AppShell />
      </AppProviders>,
    );

    // Enter passphrase and continue
    const passphraseInput = screen.getByLabelText(/Passphrase:/i);
    await user.type(passphraseInput, 'valid-passphrase-123');

    const continueButton = screen.getByRole('button', { name: /Continue/i });
    await user.click(continueButton);

    // Should render OAuth handler
    await waitFor(() => {
      expect(screen.getByTestId('oauth-handler')).toBeInTheDocument();
    });

    // Trigger complete callback
    mockOnCompleteCallback({ success: true });

    // Wait for cleanup
    await waitFor(() => {
      expect(window.history.replaceState).toHaveBeenCalledWith(
        {},
        '',
        '/#overview',
      );
    });
  });

  it('allows canceling OAuth flow', async () => {
    window.location.search = '?code=test-code&state=test-state';
    const user = userEvent.setup();

    render(
      <AppProviders>
        <AppShell />
      </AppProviders>,
    );

    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    await user.click(cancelButton);

    // Should clean up URL
    expect(window.history.replaceState).toHaveBeenCalledWith({}, '', '/');

    // Should not show OAuth handler
    expect(screen.queryByTestId('oauth-handler')).not.toBeInTheDocument();
  });

  it('does not show passphrase prompt for normal app usage', () => {
    // No OAuth callback parameters
    window.location.search = '';

    render(
      <AppProviders>
        <AppShell />
      </AppProviders>,
    );

    // Should not show passphrase prompt
    expect(
      screen.queryByText(/Encryption Passphrase Required/i),
    ).not.toBeInTheDocument();
  });

  it('supports show/hide passphrase toggle', async () => {
    window.location.search = '?code=test-code&state=test-state';
    const user = userEvent.setup();

    render(
      <AppProviders>
        <AppShell />
      </AppProviders>,
    );

    const passphraseInput = screen.getByLabelText(/Passphrase:/i);
    const toggleButton = screen.getByRole('button', {
      name: /Show passphrase/i,
    });

    // Initially password type
    expect(passphraseInput).toHaveAttribute('type', 'password');

    // Click toggle
    await user.click(toggleButton);

    // Should change to text
    expect(passphraseInput).toHaveAttribute('type', 'text');

    // Click again to hide
    await user.click(toggleButton);

    // Should change back to password
    expect(passphraseInput).toHaveAttribute('type', 'password');
  });

  it('navigates to Fitbit section after successful OAuth', async () => {
    window.location.search = '?code=test-code&state=test-state';
    window.location.hash = '';
    const user = userEvent.setup();

    render(
      <AppProviders>
        <AppShell />
      </AppProviders>,
    );

    // Enter passphrase and continue
    const passphraseInput = screen.getByLabelText(/Passphrase:/i);
    await user.type(passphraseInput, 'valid-passphrase-123');

    const continueButton = screen.getByRole('button', { name: /Continue/i });
    await user.click(continueButton);

    // Wait for OAuth handler
    await waitFor(() => {
      expect(screen.getByTestId('oauth-handler')).toBeInTheDocument();
    });

    // Trigger successful completion
    mockOnCompleteCallback({ success: true });

    // Should navigate to Fitbit section
    await waitFor(() => {
      expect(window.location.hash).toBe('fitbit-correlation');
    });
  });

  it('does not navigate on OAuth failure', async () => {
    window.location.search = '?code=test-code&state=test-state';
    window.location.hash = '#overview';
    const user = userEvent.setup();

    render(
      <AppProviders>
        <AppShell />
      </AppProviders>,
    );

    // Enter passphrase and continue
    const passphraseInput = screen.getByLabelText(/Passphrase:/i);
    await user.type(passphraseInput, 'valid-passphrase-123');

    const continueButton = screen.getByRole('button', { name: /Continue/i });
    await user.click(continueButton);

    // Wait for OAuth handler
    await waitFor(() => {
      expect(screen.getByTestId('oauth-handler')).toBeInTheDocument();
    });

    // Trigger failed completion
    mockOnCompleteCallback({
      success: false,
      error: { message: 'Auth failed' },
    });

    // Should NOT change hash (stays on overview)
    await waitFor(() => {
      expect(window.history.replaceState).toHaveBeenCalled();
    });
    expect(window.location.hash).toBe('#overview');
  });

  it('supports keyboard shortcuts in passphrase modal', async () => {
    window.location.search = '?code=test-code&state=test-state';
    const user = userEvent.setup();

    render(
      <AppProviders>
        <AppShell />
      </AppProviders>,
    );

    const passphraseInput = screen.getByLabelText(/Passphrase:/i);

    // Type valid passphrase
    await user.type(passphraseInput, 'valid-passphrase-123');

    // Press Enter to submit
    await user.type(passphraseInput, '{Enter}');

    // Should start OAuth process
    await waitFor(() => {
      expect(screen.getByTestId('oauth-handler')).toBeInTheDocument();
    });
  });

  it('handles OAuth callback with missing state parameter', () => {
    // Missing state parameter - invalid OAuth callback
    window.location.search = '?code=test-code';

    render(
      <AppProviders>
        <AppShell />
      </AppProviders>,
    );

    // Should NOT show passphrase prompt (invalid callback)
    expect(
      screen.queryByText(/Encryption Passphrase Required/i),
    ).not.toBeInTheDocument();
  });

  it('preserves deep section hash during cleanup', async () => {
    window.location.search = '?code=test-code&state=test-state';
    window.location.hash = '#apnea-clusters';
    const user = userEvent.setup();

    render(
      <AppProviders>
        <AppShell />
      </AppProviders>,
    );

    // Enter passphrase and continue
    const passphraseInput = screen.getByLabelText(/Passphrase:/i);
    await user.type(passphraseInput, 'valid-passphrase-123');

    const continueButton = screen.getByRole('button', { name: /Continue/i });
    await user.click(continueButton);

    // Wait for OAuth handler
    await waitFor(() => {
      expect(screen.getByTestId('oauth-handler')).toBeInTheDocument();
    });

    // Trigger completion with failure (preserves hash)
    mockOnCompleteCallback({ success: false });

    // Should preserve hash during cleanup
    await waitFor(() => {
      expect(window.history.replaceState).toHaveBeenCalledWith(
        {},
        '',
        '/#apnea-clusters',
      );
    });
  });

  it('cleans passphrase from memory after OAuth complete', async () => {
    window.location.search = '?code=test-code&state=test-state';
    const user = userEvent.setup();

    const { rerender } = render(
      <AppProviders>
        <AppShell />
      </AppProviders>,
    );

    // Enter passphrase
    const passphraseInput = screen.getByLabelText(/Passphrase:/i);
    await user.type(passphraseInput, 'valid-passphrase-123');

    const continueButton = screen.getByRole('button', { name: /Continue/i });
    await user.click(continueButton);

    // Wait for OAuth handler
    await waitFor(() => {
      expect(screen.getByTestId('oauth-handler')).toBeInTheDocument();
    });

    // Trigger completion
    mockOnCompleteCallback({ success: true });

    // Wait for cleanup
    await waitFor(() => {
      expect(window.history.replaceState).toHaveBeenCalled();
    });

    // Re-render to verify state cleared
    rerender(
      <AppProviders>
        <AppShell />
      </AppProviders>,
    );

    // Should not show OAuth handler anymore
    expect(screen.queryByTestId('oauth-handler')).not.toBeInTheDocument();
  });
});
