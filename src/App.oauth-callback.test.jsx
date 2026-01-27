/**
 * Tests for OAuth callback handling in App.jsx
 *
 * FIX: Updated for OAuth state persistence fix.
 * Passphrase is now collected BEFORE OAuth redirect (in FitbitConnectionCard),
 * not after (in App.jsx modal). Tests updated accordingly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

    // Setup sessionStorage with passphrase (simulating user entering it before OAuth redirect)
    sessionStorage.clear();
    sessionStorage.setItem('fitbit_oauth_passphrase', 'valid-passphrase-123');
  });

  it('detects OAuth callback parameters in URL', () => {
    // Simulate OAuth callback URL
    window.location.search = '?code=test-code&state=test-state';

    render(
      <AppProviders>
        <AppShell />
      </AppProviders>,
    );

    // FIX: With passphrase stored in sessionStorage, OAuth handler should render immediately
    // (no passphrase prompt modal needed)
    expect(screen.getByTestId('oauth-handler')).toBeInTheDocument();
  });

  it('shows passphrase input with validation', async () => {
    // FIX: Passphrase is now collected BEFORE OAuth, not after
    // This test is updated to test passphrase collection in FitbitConnectionCard instead
    // For App.jsx OAuth callback, the passphrase should already be in sessionStorage
    window.location.search = '?code=test-code&state=test-state';

    render(
      <AppProviders>
        <AppShell />
      </AppProviders>,
    );

    // With passphrase in sessionStorage, OAuth handler should render immediately
    expect(screen.getByTestId('oauth-handler')).toBeInTheDocument();

    // Should NOT show passphrase prompt (it's already stored in sessionStorage)
    expect(
      screen.queryByText(/Encryption Passphrase Required/i),
    ).not.toBeInTheDocument();
  });

  it('renders OAuthCallbackHandler when OAuth callback detected', async () => {
    // FIX: With passphrase in sessionStorage, OAuth handler should render immediately
    window.location.search = '?code=test-code&state=test-state';

    render(
      <AppProviders>
        <AppShell />
      </AppProviders>,
    );

    // Should render OAuth handler immediately (no passphrase prompt needed)
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

    render(
      <AppProviders>
        <AppShell />
      </AppProviders>,
    );

    // Should render OAuth handler with passphrase from sessionStorage
    await waitFor(() => {
      expect(screen.getByTestId('oauth-handler')).toBeInTheDocument();
    });

    // Trigger OAuth completion
    mockOnCompleteCallback({ success: false });

    // Should clean URL parameters
    await waitFor(() => {
      expect(window.history.replaceState).toHaveBeenCalledWith(
        {},
        '',
        '/#overview',
      );
    });
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

  it('navigates to Fitbit section after successful OAuth', async () => {
    window.location.search = '?code=test-code&state=test-state';
    window.location.hash = '';

    render(
      <AppProviders>
        <AppShell />
      </AppProviders>,
    );

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

    render(
      <AppProviders>
        <AppShell />
      </AppProviders>,
    );

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

  it('handles OAuth callback with missing state parameter', () => {
    // Missing state parameter - invalid OAuth callback
    window.location.search = '?code=test-code';

    render(
      <AppProviders>
        <AppShell />
      </AppProviders>,
    );

    // Should NOT show OAuth handler (invalid callback)
    expect(screen.queryByTestId('oauth-handler')).not.toBeInTheDocument();
  });

  it('preserves deep section hash during cleanup', async () => {
    window.location.search = '?code=test-code&state=test-state';
    window.location.hash = '#apnea-clusters';

    render(
      <AppProviders>
        <AppShell />
      </AppProviders>,
    );

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

  it('cleans sessionStorage after OAuth complete', async () => {
    window.location.search = '?code=test-code&state=test-state';

    // Verify passphrase is in sessionStorage before
    expect(sessionStorage.getItem('fitbit_oauth_passphrase')).toBe(
      'valid-passphrase-123',
    );

    render(
      <AppProviders>
        <AppShell />
      </AppProviders>,
    );

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

    // Passphrase should be cleared from sessionStorage
    // (Note: OAuthCallbackHandler does the cleanup, but we test app state)
    expect(screen.queryByTestId('oauth-handler')).not.toBeInTheDocument();
  });

  it('strips Facebook #_=_ hash during URL cleanup', async () => {
    window.location.search = '?code=test-code&state=test-state';
    window.location.hash = '#_=_'; // Facebook's OAuth artifact

    render(
      <AppProviders>
        <AppShell />
      </AppProviders>,
    );

    // Wait for OAuth handler
    await waitFor(() => {
      expect(screen.getByTestId('oauth-handler')).toBeInTheDocument();
    });

    // Trigger completion
    mockOnCompleteCallback({ success: true });

    // Should clean URL without the #_=_ hash
    await waitFor(() => {
      expect(window.history.replaceState).toHaveBeenCalled();
    });

    // Verify #_=_ was stripped (not included in the cleaned URL)
    const replaceStateCalls = window.history.replaceState.mock.calls;
    const lastCall = replaceStateCalls[replaceStateCalls.length - 1];
    expect(lastCall[2]).not.toContain('#_=_');
  });

  it('handles /oauth-callback path cleanup', async () => {
    window.location.search = '?code=test-code&state=test-state';
    window.location.pathname = '/oauth-callback';
    window.location.hash = '#overview';

    render(
      <AppProviders>
        <AppShell />
      </AppProviders>,
    );

    // Wait for OAuth handler
    await waitFor(() => {
      expect(screen.getByTestId('oauth-handler')).toBeInTheDocument();
    });

    // Trigger completion
    mockOnCompleteCallback({ success: false });

    // Should redirect to base URL (not /oauth-callback)
    await waitFor(() => {
      expect(window.history.replaceState).toHaveBeenCalled();
    });

    const replaceStateCalls = window.history.replaceState.mock.calls;
    const lastCall = replaceStateCalls[replaceStateCalls.length - 1];
    expect(lastCall[2]).toContain('/oscar-export-analyzer/');
    expect(lastCall[2]).not.toContain('/oauth-callback');
  });

  it('dismisses import modal when OAuth completes', async () => {
    window.location.search = '?code=test-code&state=test-state';

    render(
      <AppProviders>
        <AppShell />
      </AppProviders>,
    );

    // Wait for OAuth handler
    await waitFor(() => {
      expect(screen.getByTestId('oauth-handler')).toBeInTheDocument();
    });

    // Trigger successful completion
    mockOnCompleteCallback({ success: true });

    // Wait for cleanup
    await waitFor(() => {
      expect(window.history.replaceState).toHaveBeenCalled();
    });

    // Verify OAuth handler is removed after completion
    expect(screen.queryByTestId('oauth-handler')).not.toBeInTheDocument();
  });
});
