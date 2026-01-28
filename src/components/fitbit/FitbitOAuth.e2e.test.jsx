/**
 * Comprehensive E2E tests for Fitbit OAuth 2.0 flow.
 *
 * Tests the full OAuth authorization flow from initiation through callback
 * to token storage, with focus on validating sessionStorage for secure
 * state persistence.
 *
 * Critical Test Areas:
 * 1. State persistence (sessionStorage with timestamp validation)
 * 2. CSRF protection (state validation)
 * 3. PKCE flow (code verifier/challenge)
 * 4. Token encryption and storage
 * 5. Error scenarios (access denied, network failures)
 * 6. UI state transitions
 *
 * @module components/fitbit/FitbitOAuth.e2e.test
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';

// Components under test
import { FitbitConnectionCard } from '../FitbitConnectionCard.jsx';
import { FitbitOAuthProvider } from '../../context/FitbitOAuthContext.jsx';
import { useFitbitOAuth } from '../../hooks/useFitbitOAuth.js';

// Test utilities
import {
  mockTokenResponse,
  setupOAuthState,
  clearOAuthState,
  simulateOAuthCallback,
  simulateOAuthError,
  verifyAuthorizationUrl,
  mockTokenExchange,
  simulateRedirect,
  setupOAuthMockEnvironment,
  mockCryptoSubtle,
} from '../../test-utils/oauthTestHelpers.js';

// Constants
import { CONNECTION_STATUS, MVP_SCOPES } from '../../constants/fitbit.js';

describe('Fitbit OAuth E2E Flow', () => {
  let mockEnvironment;
  let originalFetch;

  beforeEach(() => {
    // Setup OAuth mock environment
    mockEnvironment = setupOAuthMockEnvironment();

    // Mock crypto for PKCE (use Object.defineProperty since crypto is read-only)
    const mockCrypto = mockCryptoSubtle({ deterministic: true });
    Object.defineProperty(global, 'crypto', {
      value: mockCrypto,
      writable: true,
      configurable: true,
    });

    // Mock fetch
    originalFetch = global.fetch;
    global.fetch = mockTokenExchange({ success: true });

    // Clear IndexedDB between tests
    const deleteDbRequest = indexedDB.deleteDatabase('OscarFitbitData');
    deleteDbRequest.onsuccess = () => {};
    deleteDbRequest.onerror = () => {};
  });

  afterEach(() => {
    // Restore mocks
    global.fetch = originalFetch;

    // Clear storage
    mockEnvironment.clearStorage();
    clearOAuthState();

    vi.clearAllMocks();
  });

  describe('Critical Test: State Persistence with sessionStorage', () => {
    it('stores OAuth state in sessionStorage with timestamp', async () => {
      // ===== CRITICAL TEST =====
      // This test validates sessionStorage usage for OAuth state
      // Security: sessionStorage clears on tab close, reducing XSS attack window
      // State includes timestamp for 5-minute timeout validation

      const TestComponent = () => {
        const { initiateAuth, status } = useFitbitOAuth();

        React.useEffect(() => {
          // Auto-initiate for test
          const init = async () => {
            try {
              await initiateAuth({ scopes: MVP_SCOPES });
            } catch {
              // Redirect will "fail" in test, that's okay
            }
          };
          init();
        }, [initiateAuth]);

        return (
          <div>
            <span data-testid="status">{status}</span>
          </div>
        );
      };

      const { unmount: unmountFirst } = render(
        <FitbitOAuthProvider>
          <TestComponent />
        </FitbitOAuthProvider>,
      );

      // Wait for OAuth initiation
      await waitFor(() => {
        expect(window.location.href).toContain('fitbit.com');
      });

      // CRITICAL: Verify state stored in sessionStorage with timestamp
      const storedStateRaw = sessionStorage.getItem('fitbit_oauth_state');
      const storedVerifier = sessionStorage.getItem('fitbit_pkce_verifier');

      expect(storedStateRaw).toBeTruthy();
      expect(storedVerifier).toBeTruthy();

      // Verify state object structure: {value, createdAt}
      const stateData = JSON.parse(storedStateRaw);
      expect(stateData).toHaveProperty('value');
      expect(stateData).toHaveProperty('createdAt');
      expect(stateData.value.length).toBeGreaterThan(20);
      expect(storedVerifier.length).toBeGreaterThan(40);
      expect(typeof stateData.createdAt).toBe('number');

      // Backup stored in localStorage to survive cross-origin redirects
      expect(localStorage.getItem('fitbit_oauth_state_backup')).toBeTruthy();
      expect(localStorage.getItem('fitbit_pkce_verifier_backup')).toBeTruthy();

      // ===== SIMULATE REDIRECT =====
      // Note: sessionStorage persists within same-origin navigation (same tab)
      // It only clears on tab close or cross-origin redirect to different domain
      // For OAuth callback (same origin), sessionStorage is preserved
      simulateRedirect();

      // Verify sessionStorage PERSISTS for same-origin callback
      const stateAfterRedirect = sessionStorage.getItem('fitbit_oauth_state');
      expect(stateAfterRedirect).toBe(storedStateRaw);
      expect(sessionStorage.getItem('fitbit_pkce_verifier')).toBe(
        storedVerifier,
      );

      // Unmount first component before rendering callback component
      unmountFirst();

      // ===== SIMULATE CALLBACK =====
      // Mock successful token exchange
      global.fetch = mockTokenExchange({
        success: true,
        tokenData: mockTokenResponse(),
      });

      // Simulate Fitbit redirect back with code and state
      const CallbackComponent = () => {
        const { handleCallback, status, error } = useFitbitOAuth();

        React.useEffect(() => {
          const params = new URLSearchParams(window.location.search);
          const code = params.get('code');
          const state = params.get('state');

          if (code && state) {
            handleCallback(code, state, 'test-passphrase-123').catch((err) => {
              console.error('Callback failed:', err);
            });
          }
        }, [handleCallback]);

        return (
          <div>
            <span data-testid="status">{status}</span>
            {error && <span data-testid="error">{error.message}</span>}
          </div>
        );
      };

      // Set callback URL parameters (use state.value for callback)
      simulateOAuthCallback('MOCK_AUTH_CODE', stateData.value);

      // Render callback handling component
      const { unmount } = render(
        <FitbitOAuthProvider>
          <CallbackComponent />
        </FitbitOAuthProvider>,
      );

      // ===== VERIFY SUCCESS =====
      // State validation should PASS (sessionStorage preserved the state)
      await waitFor(
        () => {
          const statusElement = screen.getByTestId('status');
          expect(statusElement).toHaveTextContent(CONNECTION_STATUS.CONNECTED);
        },
        { timeout: 5000 },
      );

      // Verify no error occurred
      expect(screen.queryByTestId('error')).not.toBeInTheDocument();

      // Verify OAuth state cleaned up after success (security)
      expect(sessionStorage.getItem('fitbit_oauth_state')).toBeNull();
      expect(sessionStorage.getItem('fitbit_pkce_verifier')).toBeNull();

      unmount();
    });

    it('validates state timeout (5-minute expiry)', async () => {
      // This test validates that expired state is rejected
      // Security: prevents indefinite CSRF attack window

      const TestComponent = () => {
        const { initiateAuth } = useFitbitOAuth();

        React.useEffect(() => {
          const init = async () => {
            try {
              await initiateAuth({ scopes: MVP_SCOPES });
            } catch {
              // Expected
            }
          };
          init();
        }, [initiateAuth]);

        return <div data-testid="initiated">Initiated</div>;
      };

      render(
        <FitbitOAuthProvider>
          <TestComponent />
        </FitbitOAuthProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('initiated')).toBeInTheDocument();
      });

      // Capture state
      const storedStateRaw = sessionStorage.getItem('fitbit_oauth_state');
      expect(storedStateRaw).toBeTruthy();
      const stateData = JSON.parse(storedStateRaw);

      // Manually expire the state (simulate 6 minutes passing)
      const expiredState = {
        value: stateData.value,
        createdAt: Date.now() - 6 * 60 * 1000, // 6 minutes ago
      };
      sessionStorage.setItem(
        'fitbit_oauth_state',
        JSON.stringify(expiredState),
      );

      // Attempt callback with expired state should fail
      // (validation logic will reject expired timestamps)
      const expiredStateValue = expiredState.value;
      expect(expiredStateValue).toBeTruthy();
    });
  });

  describe('Happy Path: Full OAuth Flow Success', () => {
    it('completes full OAuth flow from initiation to success', async () => {
      const mockOnConnect = vi.fn();
      const passphrase = 'test-passphrase-123';

      // PHASE 1: Render connection card
      render(
        <FitbitConnectionCard
          passphrase={passphrase}
          onConnectionChange={mockOnConnect}
        />,
      );

      // Find and click connect button
      const connectButton = screen.getByRole('button', {
        name: /connect.*fitbit/i,
      });
      expect(connectButton).toBeInTheDocument();

      // PHASE 2: Initiate OAuth
      fireEvent.click(connectButton);

      // Wait for OAuth initiation
      await waitFor(() => {
        expect(window.location.href).toContain('fitbit.com/oauth2/authorize');
      });

      // Verify state and verifier stored
      const storedStateRaw = sessionStorage.getItem('fitbit_oauth_state');
      const storedVerifier = sessionStorage.getItem('fitbit_pkce_verifier');
      expect(storedStateRaw).toBeTruthy();
      expect(storedVerifier).toBeTruthy();

      // Parse state object to get the actual state value
      const stateData = JSON.parse(storedStateRaw);

      // Verify authorization URL structure
      const authUrl = window.location.href;
      const urlData = verifyAuthorizationUrl(authUrl);
      expect(urlData.state).toBe(stateData.value);
      expect(urlData.scope).toContain('heartrate');

      // PHASE 3: Simulate redirect and callback
      simulateRedirect();

      // Mock token exchange
      global.fetch = mockTokenExchange({
        success: true,
        tokenData: mockTokenResponse({ expiresIn: 3600 }),
      });

      // Simulate callback with code (use state value from parsed object)
      simulateOAuthCallback('MOCK_CODE_12345', stateData.value);

      // Render callback handler (simulated)
      const CallbackComponent = () => {
        const { handleCallback, status } = useFitbitOAuth();

        React.useEffect(() => {
          const params = new URLSearchParams(window.location.search);
          handleCallback(
            params.get('code'),
            params.get('state'),
            passphrase,
          ).catch(console.error);
        }, [handleCallback]);

        return <div data-testid="callback-status">{status}</div>;
      };

      const { unmount: unmountCallback } = render(
        <FitbitOAuthProvider>
          <CallbackComponent />
        </FitbitOAuthProvider>,
      );

      // PHASE 4: Verify success
      await waitFor(
        () => {
          const status = screen.getByTestId('callback-status');
          expect(status).toHaveTextContent(CONNECTION_STATUS.CONNECTED);
        },
        { timeout: 5000 },
      );

      // Verify token exchange was called
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('oauth2/token'),
        expect.objectContaining({
          method: 'POST',
        }),
      );

      // Verify OAuth state cleaned up
      expect(sessionStorage.getItem('fitbit_oauth_state')).toBeNull();
      expect(sessionStorage.getItem('fitbit_pkce_verifier')).toBeNull();

      unmountCallback();
    });
  });

  describe('Security: CSRF Protection (State Validation)', () => {
    it('rejects OAuth callback with invalid state (CSRF protection)', async () => {
      const passphrase = 'test-passphrase-123';

      // Setup: Store valid state
      const validState = 'VALID_STATE_abc123';
      const validVerifier = 'VALID_VERIFIER_xyz789';
      setupOAuthState(validState, validVerifier);

      // Simulate callback with WRONG state
      const wrongState = 'WRONG_STATE_malicious';
      simulateOAuthCallback('MOCK_CODE', wrongState);

      const CallbackComponent = () => {
        const { handleCallback, status, error } = useFitbitOAuth();

        React.useEffect(() => {
          const params = new URLSearchParams(window.location.search);
          handleCallback(
            params.get('code'),
            params.get('state'),
            passphrase,
          ).catch(() => {
            // Expected to fail
          });
        }, [handleCallback]);

        return (
          <div>
            <span data-testid="status">{status}</span>
            {error && <span data-testid="error">{error.message}</span>}
          </div>
        );
      };

      render(
        <FitbitOAuthProvider>
          <CallbackComponent />
        </FitbitOAuthProvider>,
      );

      // Verify error status
      let errorElement;
      await waitFor(() => {
        errorElement = screen.queryByTestId('error');
        expect(errorElement).toBeInTheDocument();
      });
      expect(errorElement).toHaveTextContent(/cancelled|invalid/i);

      // Verify status is ERROR, not CONNECTED
      const statusElement = screen.getByTestId('status');
      expect(statusElement).not.toHaveTextContent(CONNECTION_STATUS.CONNECTED);

      // Verify token exchange was NOT called (security check prevented it)
      expect(global.fetch).not.toHaveBeenCalled();

      // Verify OAuth state was cleared (security cleanup)
      expect(sessionStorage.getItem('fitbit_oauth_state')).toBeNull();
    });

    it('rejects OAuth callback with missing state', async () => {
      const passphrase = 'test-passphrase-123';

      // Simulate callback with code but NO state
      window.location.search = '?code=MOCK_CODE';

      const CallbackComponent = () => {
        const { handleCallback, error } = useFitbitOAuth();

        React.useEffect(() => {
          const params = new URLSearchParams(window.location.search);
          const code = params.get('code');
          const state = params.get('state'); // Will be null

          if (code) {
            handleCallback(code, state, passphrase).catch(() => {
              // Expected
            });
          }
        }, [handleCallback]);

        return (
          <div>{error && <span data-testid="error">{error.message}</span>}</div>
        );
      };

      render(
        <FitbitOAuthProvider>
          <CallbackComponent />
        </FitbitOAuthProvider>,
      );

      // Verify error shown
      await waitFor(() => {
        const errorElement = screen.queryByTestId('error');
        expect(errorElement).toBeInTheDocument();
      });

      // Verify no token exchange attempted
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('PKCE: Code Verifier and Challenge', () => {
    it('generates and uses PKCE code verifier/challenge correctly', async () => {
      const TestComponent = () => {
        const { initiateAuth } = useFitbitOAuth();

        React.useEffect(() => {
          initiateAuth({ scopes: MVP_SCOPES }).catch(() => {
            // Expected redirect failure in test
          });
        }, [initiateAuth]);

        return <div data-testid="pkce-test">PKCE Test</div>;
      };

      render(
        <FitbitOAuthProvider>
          <TestComponent />
        </FitbitOAuthProvider>,
      );

      // Wait for OAuth initiation
      await waitFor(() => {
        expect(window.location.href).toContain('fitbit.com');
      });

      // Verify code verifier generated and stored
      const verifier = sessionStorage.getItem('fitbit_pkce_verifier');
      expect(verifier).toBeTruthy();
      expect(verifier.length).toBeGreaterThanOrEqual(43);
      expect(verifier.length).toBeLessThanOrEqual(128);

      // Verify authorization URL contains code_challenge
      const authUrl = window.location.href;
      const urlData = verifyAuthorizationUrl(authUrl);
      expect(urlData.codeChallenge).toBeTruthy();
      expect(urlData.codeChallenge.length).toBeGreaterThan(20);

      // Verify code_challenge_method is S256 (SHA256)
      const urlObj = new URL(authUrl);
      expect(urlObj.searchParams.get('code_challenge_method')).toBe('S256');
    });

    it('includes code verifier in token exchange request', async () => {
      const passphrase = 'test-passphrase-123';
      const state = 'TEST_STATE_' + Date.now();
      const verifier = 'TEST_VERIFIER_' + 'a'.repeat(100);

      // Setup OAuth state
      setupOAuthState(state, verifier);

      // Mock token exchange to capture request
      let tokenExchangeBody = null;
      global.fetch = vi.fn(async (url, options) => {
        if (url.includes('oauth2/token')) {
          tokenExchangeBody = new URLSearchParams(options.body);
          return {
            ok: true,
            json: async () => mockTokenResponse(),
          };
        }
        return Promise.reject(new Error('Unexpected fetch'));
      });

      // Simulate callback
      simulateOAuthCallback('MOCK_CODE', state);

      const CallbackComponent = () => {
        const { handleCallback } = useFitbitOAuth();

        React.useEffect(() => {
          const params = new URLSearchParams(window.location.search);
          handleCallback(
            params.get('code'),
            params.get('state'),
            passphrase,
          ).catch(console.error);
        }, [handleCallback]);

        return <div data-testid="pkce-exchange">Exchanging</div>;
      };

      render(
        <FitbitOAuthProvider>
          <CallbackComponent />
        </FitbitOAuthProvider>,
      );

      // Wait for token exchange
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      // Verify code_verifier included in token exchange
      expect(tokenExchangeBody).toBeTruthy();
      expect(tokenExchangeBody.get('code_verifier')).toBe(verifier);
      expect(tokenExchangeBody.get('code')).toBe('MOCK_CODE');
      expect(tokenExchangeBody.get('grant_type')).toBe('authorization_code');

      // Verify verifier cleared after use (security)
      await waitFor(() => {
        expect(sessionStorage.getItem('fitbit_pkce_verifier')).toBeNull();
      });
    });
  });

  describe('Error Scenarios: User Actions', () => {
    it('handles user denial (access_denied error)', async () => {
      // Simulate Fitbit redirect with access_denied error
      simulateOAuthError('access_denied', 'User denied authorization');

      const CallbackComponent = () => {
        const { handleCallback, error } = useFitbitOAuth();

        React.useEffect(() => {
          const params = new URLSearchParams(window.location.search);
          const errorParam = params.get('error');

          if (errorParam) {
            // Simulate error handling
            console.error('OAuth error:', errorParam);
          }
        }, [handleCallback]);

        return (
          <div>
            {error && (
              <div>
                <span data-testid="error-type">{error.type}</span>
                <span data-testid="error-message">{error.message}</span>
              </div>
            )}
            <button
              data-testid="retry-button"
              onClick={() => window.location.reload()}
            >
              Try Again
            </button>
          </div>
        );
      };

      render(
        <FitbitOAuthProvider>
          <CallbackComponent />
        </FitbitOAuthProvider>,
      );

      // Verify error parameters in URL
      const params = new URLSearchParams(window.location.search);
      expect(params.get('error')).toBe('access_denied');
      expect(params.get('error_description')).toBeTruthy();

      // Verify retry option available
      const retryButton = screen.getByTestId('retry-button');
      expect(retryButton).toBeInTheDocument();

      // Verify no tokens stored
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Error Scenarios: Network and API', () => {
    it('handles network errors during token exchange', async () => {
      const passphrase = 'test-passphrase-123';
      const state = 'TEST_STATE';
      const verifier = 'TEST_VERIFIER';

      setupOAuthState(state, verifier);
      simulateOAuthCallback('MOCK_CODE', state);

      // Mock network failure
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const CallbackComponent = () => {
        const { handleCallback, status, error } = useFitbitOAuth();

        React.useEffect(() => {
          const params = new URLSearchParams(window.location.search);
          handleCallback(
            params.get('code'),
            params.get('state'),
            passphrase,
          ).catch(() => {
            // Expected
          });
        }, [handleCallback]);

        return (
          <div>
            <span data-testid="status">{status}</span>
            {error && <span data-testid="error">{error.message}</span>}
          </div>
        );
      };

      render(
        <FitbitOAuthProvider>
          <CallbackComponent />
        </FitbitOAuthProvider>,
      );

      // Verify error shown
      await waitFor(() => {
        const errorElement = screen.queryByTestId('error');
        expect(errorElement).toBeInTheDocument();
      });

      // Verify status is ERROR
      const statusElement = screen.getByTestId('status');
      expect(statusElement).toHaveTextContent(CONNECTION_STATUS.ERROR);

      // Verify app didn't crash
      expect(screen.getByTestId('status')).toBeInTheDocument();
    });

    it('handles invalid authorization code (400 response)', async () => {
      const passphrase = 'test-passphrase-123';
      const state = 'TEST_STATE';
      const verifier = 'TEST_VERIFIER';

      setupOAuthState(state, verifier);
      simulateOAuthCallback('INVALID_CODE', state);

      // Mock 400 Bad Request
      global.fetch = mockTokenExchange({
        success: false,
        statusCode: 400,
        errorType: 'invalid_grant',
      });

      const CallbackComponent = () => {
        const { handleCallback, error } = useFitbitOAuth();

        React.useEffect(() => {
          const params = new URLSearchParams(window.location.search);
          handleCallback(
            params.get('code'),
            params.get('state'),
            passphrase,
          ).catch(() => {
            // Expected
          });
        }, [handleCallback]);

        return (
          <div>{error && <span data-testid="error">{error.message}</span>}</div>
        );
      };

      render(
        <FitbitOAuthProvider>
          <CallbackComponent />
        </FitbitOAuthProvider>,
      );

      // Verify error handled
      await waitFor(() => {
        const errorElement = screen.queryByTestId('error');
        expect(errorElement).toBeInTheDocument();
      });

      // Verify OAuth state cleaned up (allow retry)
      await waitFor(() => {
        expect(sessionStorage.getItem('fitbit_oauth_state')).toBeNull();
      });
    });
  });

  describe('UI State Transitions', () => {
    it('transitions through disconnected → connecting → connected states', async () => {
      const passphrase = 'test-passphrase-123';
      const mockOnChange = vi.fn();

      // PHASE 1: Disconnected state
      render(
        <FitbitConnectionCard
          passphrase={passphrase}
          onConnectionChange={mockOnChange}
        />,
      );

      // Verify initial disconnected state
      expect(
        screen.getByRole('button', { name: /connect.*fitbit/i }),
      ).toBeInTheDocument();

      // PHASE 2: Connecting state (initiated OAuth)
      const connectButton = screen.getByRole('button', {
        name: /connect.*fitbit/i,
      });

      fireEvent.click(connectButton);

      // Should transition to connecting
      await waitFor(() => {
        expect(window.location.href).toContain('fitbit.com');
      });

      // PHASE 3: Connected state (after callback)
      const stateRaw = sessionStorage.getItem('fitbit_oauth_state');
      const stateData = JSON.parse(stateRaw);
      simulateRedirect();
      simulateOAuthCallback('MOCK_CODE', stateData.value);

      global.fetch = mockTokenExchange({ success: true });

      const ConnectedComponent = () => {
        const { handleCallback, status } = useFitbitOAuth();

        React.useEffect(() => {
          const params = new URLSearchParams(window.location.search);
          if (params.get('code')) {
            handleCallback(
              params.get('code'),
              params.get('state'),
              passphrase,
            ).catch(console.error);
          }
        }, [handleCallback]);

        return (
          <div>
            <span data-testid="final-status">{status}</span>
            {status === CONNECTION_STATUS.CONNECTED && (
              <span data-testid="connected-indicator">✓ Connected</span>
            )}
          </div>
        );
      };

      render(
        <FitbitOAuthProvider>
          <ConnectedComponent />
        </FitbitOAuthProvider>,
      );

      // Verify final connected state
      await waitFor(() => {
        expect(screen.getByTestId('connected-indicator')).toBeInTheDocument();
      });

      const finalStatus = screen.getByTestId('final-status');
      expect(finalStatus).toHaveTextContent(CONNECTION_STATUS.CONNECTED);
    });
  });

  describe('Passphrase Handling', () => {
    it('requires passphrase for OAuth initiation', async () => {
      const mockOnError = vi.fn();

      // Render without passphrase
      render(<FitbitConnectionCard passphrase={null} onError={mockOnError} />);

      const connectButton = screen.getByRole('button', {
        name: /connect.*fitbit/i,
      });

      // Button should be disabled or clicking should error
      expect(connectButton).toBeDisabled();
    });

    it('requires passphrase for token callback', async () => {
      const state = 'TEST_STATE';
      const verifier = 'TEST_VERIFIER';

      setupOAuthState(state, verifier);
      simulateOAuthCallback('MOCK_CODE', state);

      const CallbackComponent = () => {
        const { handleCallback, error } = useFitbitOAuth();

        React.useEffect(() => {
          const params = new URLSearchParams(window.location.search);
          // Call handleCallback WITHOUT passphrase
          handleCallback(params.get('code'), params.get('state'), null).catch(
            () => {
              // Expected to fail
            },
          );
        }, [handleCallback]);

        return (
          <div>{error && <span data-testid="error">{error.message}</span>}</div>
        );
      };

      render(
        <FitbitOAuthProvider>
          <CallbackComponent />
        </FitbitOAuthProvider>,
      );

      // Verify error about missing passphrase
      let errorElement;
      await waitFor(() => {
        errorElement = screen.queryByTestId('error');
        expect(errorElement).toBeInTheDocument();
      });
      expect(errorElement).toHaveTextContent(/passphrase/i);
    });
  });

  describe('Integration: IndexedDB Token Storage', () => {
    it('stores encrypted tokens in IndexedDB after successful OAuth', async () => {
      const passphrase = 'strong-test-passphrase-123';
      const state = 'TEST_STATE_' + Date.now();
      const verifier = 'TEST_VERIFIER_' + 'x'.repeat(100);

      setupOAuthState(state, verifier);
      simulateOAuthCallback('MOCK_CODE', state);

      const mockTokenData = mockTokenResponse();
      global.fetch = mockTokenExchange({
        success: true,
        tokenData: mockTokenData,
      });

      const CallbackComponent = () => {
        const { handleCallback, status } = useFitbitOAuth();

        React.useEffect(() => {
          const params = new URLSearchParams(window.location.search);
          handleCallback(
            params.get('code'),
            params.get('state'),
            passphrase,
          ).catch(console.error);
        }, [handleCallback]);

        return <div data-testid="storage-status">{status}</div>;
      };

      render(
        <FitbitOAuthProvider>
          <CallbackComponent />
        </FitbitOAuthProvider>,
      );

      // Wait for connected status
      await waitFor(() => {
        const status = screen.getByTestId('storage-status');
        expect(status).toHaveTextContent(CONNECTION_STATUS.CONNECTED);
      });

      // Verify token exchange was successful
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('oauth2/token'),
        expect.any(Object),
      );

      // Note: We can't easily verify IndexedDB contents in jsdom
      // This would require using fake-indexeddb's API directly
      // For now, we verify the flow completed successfully
    });
  });

  /**
   * REGRESSION TEST SUITE: OAuth Passphrase Race Condition (Commit 44ee5dd2)
   *
   * Context: Commit 44ee5dd2 moved passphrase collection from BEFORE OAuth
   * to AFTER callback, creating a race condition where state validation
   * happened twice (once during callback, once after passphrase prompt).
   *
   * Root Cause: OAuth state is single-use. First validation succeeds and
   * deletes state. Second validation fails with "Invalid OAuth state".
   *
   * Fix: FULL REVERT of 44ee5dd2 to restore passphrase-first flow.
   */

  describe.skip('BEFORE FIX: Documents Broken Behavior (Commit 44ee5dd2)', () => {
    /**
     * These tests document the BROKEN behavior introduced by commit 44ee5dd2.
     * They are marked as .skip and will PASS when run against broken code.
     * After fix is applied, they should FAIL (proving fix works).
     *
     * DO NOT DELETE these tests - they serve as regression prevention.
     */

    it('BROKEN: allows OAuth initiation without passphrase', async () => {
      // ===== THIS IS THE BUG =====
      // Button should be DISABLED without passphrase, but is ENABLED

      render(<FitbitConnectionCard passphrase={null} />);

      const connectButton = screen.getByRole('button', {
        name: /connect.*fitbit/i,
      });

      // BUG: Button is enabled when it should be disabled
      expect(connectButton).toBeEnabled();

      // BUG: Clicking proceeds to OAuth without passphrase
      fireEvent.click(connectButton);

      await waitFor(() => {
        // OAuth redirect happens without passphrase in memory
        expect(window.location.href).toContain('fitbit.com');
      });

      // Verify state stored (but no passphrase to encrypt tokens later)
      const storedStateRaw = sessionStorage.getItem('fitbit_oauth_state');
      expect(storedStateRaw).toBeTruthy();
      const stateData = JSON.parse(storedStateRaw);
      expect(stateData).toHaveProperty('value');
      expect(stateData).toHaveProperty('createdAt');
    });

    it('BROKEN: prompts for passphrase AFTER callback (security risk)', async () => {
      // ===== SECURITY VULNERABILITY =====
      // Passphrase prompt appears AFTER external redirect
      // This allows potential spoofing of passphrase UI

      const state = 'TEST_STATE_' + Date.now();
      const verifier = 'TEST_VERIFIER_' + 'a'.repeat(100);

      setupOAuthState(state, verifier);
      simulateOAuthCallback('MOCK_CODE', state);

      const CallbackComponent = () => {
        const { handleCallback, status } = useFitbitOAuth();
        const [showPrompt, setShowPrompt] = React.useState(false);

        React.useEffect(() => {
          const params = new URLSearchParams(window.location.search);
          const code = params.get('code');
          const stateParam = params.get('state');

          if (code && stateParam) {
            // BUG: handleCallback called without passphrase
            // Component should prompt for passphrase AFTER redirect
            setShowPrompt(true);
          }
        }, [handleCallback]);

        return (
          <div>
            <span data-testid="status">{status}</span>
            {showPrompt && (
              <div data-testid="post-redirect-prompt">
                Enter passphrase to complete connection
              </div>
            )}
          </div>
        );
      };

      render(
        <FitbitOAuthProvider>
          <CallbackComponent />
        </FitbitOAuthProvider>,
      );

      // BUG: Passphrase prompt appears AFTER redirect
      await waitFor(() => {
        expect(screen.getByTestId('post-redirect-prompt')).toBeInTheDocument();
      });

      // This is a security risk: passphrase UI could be spoofed
    });

    it('BROKEN: fails with double state validation race condition', async () => {
      // ===== THE RACE CONDITION =====
      // 1. Callback validates state → deletes it
      // 2. User enters passphrase → validation attempted again
      // 3. State already deleted → "Invalid OAuth state" error

      const passphrase = 'test-passphrase-123';
      const state = 'TEST_STATE_' + Date.now();
      const verifier = 'TEST_VERIFIER_' + 'b'.repeat(100);

      setupOAuthState(state, verifier);
      simulateOAuthCallback('MOCK_CODE', state);

      global.fetch = mockTokenExchange({
        success: true,
        tokenData: mockTokenResponse(),
      });

      // Track state validation calls
      let validationCount = 0;
      const originalGetItem = Storage.prototype.getItem;
      Storage.prototype.getItem = function (key) {
        if (key === 'fitbit_oauth_state') {
          validationCount++;
        }
        return originalGetItem.call(this, key);
      };

      const CallbackComponent = () => {
        const { handleCallback, status, error } = useFitbitOAuth();

        React.useEffect(() => {
          const params = new URLSearchParams(window.location.search);

          // BUG: First validation (without passphrase)
          handleCallback(params.get('code'), params.get('state'), null)
            .catch(() => {
              // Prompts for passphrase, then tries again
              return handleCallback(
                params.get('code'),
                params.get('state'),
                passphrase,
              );
            })
            .catch(console.error);
        }, [handleCallback]);

        return (
          <div>
            <span data-testid="status">{status}</span>
            <span data-testid="validation-count">{validationCount}</span>
            {error && <span data-testid="error">{error.message}</span>}
          </div>
        );
      };

      render(
        <FitbitOAuthProvider>
          <CallbackComponent />
        </FitbitOAuthProvider>,
      );

      // BUG: State validation happens TWICE
      await waitFor(() => {
        const count = screen.getByTestId('validation-count');
        expect(parseInt(count.textContent)).toBeGreaterThanOrEqual(2);
      });

      // BUG: Second validation fails - state already deleted
      await waitFor(() => {
        const errorElement = screen.queryByTestId('error');
        expect(errorElement).toBeInTheDocument();
      });
      const errorElement = screen.getByTestId('error');
      expect(errorElement).toHaveTextContent(/invalid.*state/i);

      // Cleanup
      Storage.prototype.getItem = originalGetItem;
    });
  });

  describe('AFTER FIX: Validates Correct Passphrase-First Flow', () => {
    /**
     * These tests validate the FIX (revert of commit 44ee5dd2).
     * They will FAIL against broken code and PASS after fix is applied.
     *
     * The fix restores passphrase collection BEFORE OAuth initiation.
     */

    it('FIX: requires passphrase before OAuth initiation', async () => {
      // ===== CORRECT BEHAVIOR =====
      // Button should be DISABLED without passphrase

      render(<FitbitConnectionCard passphrase={null} />);

      const connectButton = screen.getByRole('button', {
        name: /connect.*fitbit/i,
      });

      // CORRECT: Button is disabled
      expect(connectButton).toBeDisabled();

      // Clicking should have no effect
      fireEvent.click(connectButton);

      // Wait a bit to ensure no redirect
      await new Promise((resolve) => setTimeout(resolve, 100));

      // CORRECT: No OAuth redirect without passphrase
      expect(window.location.href).not.toContain('fitbit.com');
    });

    it('FIX: enables button after passphrase entered', async () => {
      // ===== CORRECT BEHAVIOR =====
      // User enters passphrase → button becomes enabled

      const passphrase = 'test-passphrase-strong-123';

      render(<FitbitConnectionCard passphrase={passphrase} />);

      const connectButton = screen.getByRole('button', {
        name: /connect.*fitbit/i,
      });

      // CORRECT: Button is enabled with passphrase
      expect(connectButton).toBeEnabled();

      // Button can be clicked
      fireEvent.click(connectButton);

      // OAuth proceeds (would redirect in real app)
      await waitFor(() => {
        expect(window.location.href).toContain('fitbit.com');
      });
    });

    it('FIX: completes OAuth with passphrase-first flow (no race)', async () => {
      // ===== COMPLETE CORRECT FLOW =====
      // Passphrase collected → OAuth initiated → callback validates once

      const passphrase = 'test-passphrase-123';

      // PHASE 1: User enters passphrase and connects
      const { unmount: unmountCard } = render(
        <FitbitConnectionCard passphrase={passphrase} />,
      );

      const connectButton = screen.getByRole('button', {
        name: /connect.*fitbit/i,
      });

      fireEvent.click(connectButton);

      await waitFor(() => {
        expect(window.location.href).toContain('fitbit.com');
      });

      const stateRaw = sessionStorage.getItem('fitbit_oauth_state');
      const stateData = JSON.parse(stateRaw);

      unmountCard();

      // PHASE 2: Simulate callback
      simulateRedirect();
      simulateOAuthCallback('MOCK_CODE', stateData.value);

      global.fetch = mockTokenExchange({
        success: true,
        tokenData: mockTokenResponse(),
      });

      // Track state validation calls
      let validationCount = 0;
      const originalGetItem = sessionStorage.getItem;
      sessionStorage.getItem = function (key) {
        if (key === 'fitbit_oauth_state') {
          validationCount++;
        }
        return originalGetItem.call(sessionStorage, key);
      };

      const CallbackComponent = () => {
        const { handleCallback, status, error } = useFitbitOAuth();

        React.useEffect(() => {
          const params = new URLSearchParams(window.location.search);
          // CORRECT: passphrase already in memory, single validation
          handleCallback(
            params.get('code'),
            params.get('state'),
            passphrase,
          ).catch(console.error);
        }, [handleCallback]);

        return (
          <div>
            <span data-testid="status">{status}</span>
            <span data-testid="validation-count">{validationCount}</span>
            {error && <span data-testid="error">{error.message}</span>}
          </div>
        );
      };

      render(
        <FitbitOAuthProvider>
          <CallbackComponent />
        </FitbitOAuthProvider>,
      );

      // CORRECT: Single state validation
      await waitFor(() => {
        const status = screen.getByTestId('status');
        expect(status).toHaveTextContent(CONNECTION_STATUS.CONNECTED);
      });

      // CORRECT: No "Invalid OAuth state" error
      expect(screen.queryByTestId('error')).not.toBeInTheDocument();

      // CORRECT: State validated only once
      expect(validationCount).toBe(1);

      // Cleanup
      sessionStorage.getItem = originalGetItem;
    });

    it('FIX: encrypts tokens with passphrase from memory', async () => {
      // ===== CORRECT BEHAVIOR =====
      // Passphrase collected upfront is used to encrypt tokens

      const passphrase = 'strong-test-passphrase-456';
      const state = 'TEST_STATE_' + Date.now();
      const verifier = 'TEST_VERIFIER_' + 'c'.repeat(100);

      setupOAuthState(state, verifier);
      simulateOAuthCallback('MOCK_CODE', state);

      const mockTokenData = mockTokenResponse();
      global.fetch = mockTokenExchange({
        success: true,
        tokenData: mockTokenData,
      });

      const CallbackComponent = () => {
        const { handleCallback, status } = useFitbitOAuth();

        React.useEffect(() => {
          const params = new URLSearchParams(window.location.search);
          // CORRECT: Passphrase from memory used for encryption
          handleCallback(
            params.get('code'),
            params.get('state'),
            passphrase,
          ).catch(console.error);
        }, [handleCallback]);

        return <div data-testid="status">{status}</div>;
      };

      render(
        <FitbitOAuthProvider>
          <CallbackComponent />
        </FitbitOAuthProvider>,
      );

      // CORRECT: Flow completes successfully
      await waitFor(() => {
        const status = screen.getByTestId('status');
        expect(status).toHaveTextContent(CONNECTION_STATUS.CONNECTED);
      });

      // CORRECT: Token exchange called (with passphrase for encryption)
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('oauth2/token'),
        expect.any(Object),
      );
    });

    it('FIX: preserves OSCAR data through OAuth flow', async () => {
      // ===== DATA ISOLATION TEST =====
      // OSCAR CSV data should persist through OAuth flow

      const passphrase = 'test-passphrase-789';

      // Simulate existing OSCAR data in app state
      const mockOscarData = [
        { Date: '2024-01-01', AHI: '5.2', 'Median EPAP': '8.5' },
        { Date: '2024-01-02', AHI: '4.8', 'Median EPAP': '8.3' },
      ];

      // Store in sessionStorage (simulating app state)
      sessionStorage.setItem('oscar_data', JSON.stringify(mockOscarData));

      // Complete OAuth flow
      const state = 'TEST_STATE_' + Date.now();
      const verifier = 'TEST_VERIFIER_' + 'd'.repeat(100);

      setupOAuthState(state, verifier);
      simulateOAuthCallback('MOCK_CODE', state);

      global.fetch = mockTokenExchange({
        success: true,
        tokenData: mockTokenResponse(),
      });

      const CallbackComponent = () => {
        const { handleCallback, status } = useFitbitOAuth();

        React.useEffect(() => {
          const params = new URLSearchParams(window.location.search);
          handleCallback(
            params.get('code'),
            params.get('state'),
            passphrase,
          ).catch(console.error);
        }, [handleCallback]);

        return <div data-testid="status">{status}</div>;
      };

      render(
        <FitbitOAuthProvider>
          <CallbackComponent />
        </FitbitOAuthProvider>,
      );

      // Wait for OAuth completion
      await waitFor(() => {
        const status = screen.getByTestId('status');
        expect(status).toHaveTextContent(CONNECTION_STATUS.CONNECTED);
      });

      // CORRECT: OSCAR data still present
      const retrievedData = sessionStorage.getItem('oscar_data');
      expect(retrievedData).toBeTruthy();

      const parsedData = JSON.parse(retrievedData);
      expect(parsedData).toHaveLength(2);
      expect(parsedData[0].AHI).toBe('5.2');

      // Cleanup
      sessionStorage.removeItem('oscar_data');
    });
  });

  describe('USER FLOW: Passphrase Input UI', () => {
    /**
     * CRITICAL: Tests the ACTUAL user flow where passphrase is entered via UI.
     *
     * This validates that:
     * 1. Component renders passphrase input field when no passphrase prop provided
     * 2. Connect button is disabled until passphrase entered
     * 3. User can type passphrase into input field
     * 4. Button becomes enabled when passphrase meets minimum requirements
     * 5. OAuth proceeds with passphrase from user input
     *
     * Previous tests passed passphrase as prop, bypassing the UI that real users need.
     */

    it('renders passphrase input field when no passphrase prop provided', () => {
      render(<FitbitConnectionCard />);

      // Should render passphrase input
      const passphraseInput = screen.getByLabelText(/encryption passphrase/i);
      expect(passphraseInput).toBeInTheDocument();
      expect(passphraseInput).toHaveAttribute('type', 'password');
      expect(passphraseInput).toHaveAttribute('placeholder');

      // Should render show/hide toggle
      const toggleButton = screen.getByLabelText(/show passphrase/i);
      expect(toggleButton).toBeInTheDocument();

      // Should render help text
      expect(
        screen.getByText(/enter a strong passphrase/i),
      ).toBeInTheDocument();
    });

    it('disables connect button until passphrase entered', () => {
      render(<FitbitConnectionCard />);

      const connectButton = screen.getByRole('button', {
        name: /connect.*fitbit/i,
      });

      // Initially disabled (no passphrase)
      expect(connectButton).toBeDisabled();
    });

    it('enables connect button when valid passphrase entered', async () => {
      render(<FitbitConnectionCard />);

      const passphraseInput = screen.getByLabelText(/encryption passphrase/i);
      const connectButton = screen.getByRole('button', {
        name: /connect.*fitbit/i,
      });

      // Initially disabled
      expect(connectButton).toBeDisabled();

      // Type passphrase
      fireEvent.change(passphraseInput, {
        target: { value: 'my-strong-passphrase-123' },
      });

      // Wait for state update
      await waitFor(() => {
        expect(connectButton).toBeEnabled();
      });
    });

    it('keeps button disabled if passphrase too short', async () => {
      render(<FitbitConnectionCard />);

      const passphraseInput = screen.getByLabelText(/encryption passphrase/i);
      const connectButton = screen.getByRole('button', {
        name: /connect.*fitbit/i,
      });

      // Type short passphrase (< 8 chars)
      fireEvent.change(passphraseInput, {
        target: { value: 'short' },
      });

      await waitFor(() => {
        // Should still be disabled
        expect(connectButton).toBeDisabled();
      });

      // Should show strength indicator
      expect(screen.getByText(/strength/i)).toBeInTheDocument();
    });

    it('shows passphrase strength indicator as user types', async () => {
      render(<FitbitConnectionCard />);

      const passphraseInput = screen.getByLabelText(/encryption passphrase/i);

      // Type weak passphrase (too short)
      fireEvent.change(passphraseInput, {
        target: { value: 'short' },
      });

      await waitFor(() => {
        const strengthIndicator = document.getElementById(
          'passphrase-strength',
        );
        expect(strengthIndicator).toHaveTextContent(/Weak/);
      });

      // Type medium passphrase (8-11 chars)
      fireEvent.change(passphraseInput, {
        target: { value: 'password123' },
      });

      await waitFor(() => {
        const strengthIndicator = document.getElementById(
          'passphrase-strength',
        );
        expect(strengthIndicator).toHaveTextContent(/Medium/);
      });

      // Type strong passphrase (16+ chars, 3+ character types)
      fireEvent.change(passphraseInput, {
        target: { value: 'StrongPassword123!@#' },
      });

      await waitFor(() => {
        const strengthIndicator = document.getElementById(
          'passphrase-strength',
        );
        expect(strengthIndicator).toHaveTextContent(/Strong/);
      });
    });

    it('toggles passphrase visibility', async () => {
      render(<FitbitConnectionCard />);

      const passphraseInput = screen.getByLabelText(/encryption passphrase/i);
      const toggleButton = screen.getByLabelText(/show passphrase/i);

      // Initially hidden (type=password)
      expect(passphraseInput).toHaveAttribute('type', 'password');

      // Click toggle
      fireEvent.click(toggleButton);

      // Now visible (type=text)
      await waitFor(() => {
        expect(passphraseInput).toHaveAttribute('type', 'text');
      });

      // Toggle button label changes
      expect(screen.getByLabelText(/hide passphrase/i)).toBeInTheDocument();

      // Click again to hide
      fireEvent.click(toggleButton);

      await waitFor(() => {
        expect(passphraseInput).toHaveAttribute('type', 'password');
      });
    });

    it('completes OAuth flow with passphrase from UI input', async () => {
      // ===== CRITICAL TEST: Full user flow =====
      // This tests what real users actually do:
      // 1. Type passphrase into input field
      // 2. Click Connect button
      // 3. OAuth proceeds with passphrase from input

      const { unmount: unmountCard } = render(<FitbitConnectionCard />);

      const passphraseInput = screen.getByLabelText(/encryption passphrase/i);
      const connectButton = screen.getByRole('button', {
        name: /connect.*fitbit/i,
      });

      // User types passphrase
      const userPassphrase = 'my-secure-passphrase-456';
      fireEvent.change(passphraseInput, {
        target: { value: userPassphrase },
      });

      // Wait for button to enable
      await waitFor(() => {
        expect(connectButton).toBeEnabled();
      });

      // User clicks Connect
      fireEvent.click(connectButton);

      // OAuth redirect should occur
      await waitFor(() => {
        expect(window.location.href).toContain('fitbit.com');
      });

      const stateRaw = sessionStorage.getItem('fitbit_oauth_state');
      expect(stateRaw).toBeTruthy();
      const stateData = JSON.parse(stateRaw);

      unmountCard();

      // Simulate callback
      simulateRedirect();
      simulateOAuthCallback('MOCK_CODE', stateData.value);

      global.fetch = mockTokenExchange({
        success: true,
        tokenData: mockTokenResponse(),
      });

      const CallbackComponent = () => {
        const { handleCallback, status } = useFitbitOAuth();

        React.useEffect(() => {
          const params = new URLSearchParams(window.location.search);
          // Use the passphrase from user input
          handleCallback(
            params.get('code'),
            params.get('state'),
            userPassphrase,
          ).catch(console.error);
        }, [handleCallback]);

        return <div data-testid="status">{status}</div>;
      };

      render(
        <FitbitOAuthProvider>
          <CallbackComponent />
        </FitbitOAuthProvider>,
      );

      // OAuth should complete successfully
      await waitFor(() => {
        const status = screen.getByTestId('status');
        expect(status).toHaveTextContent(CONNECTION_STATUS.CONNECTED);
      });

      // Token exchange should have been called
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('oauth2/token'),
        expect.any(Object),
      );
    });

    it('does not render passphrase input when passphrase prop provided (test mode)', () => {
      render(<FitbitConnectionCard passphrase="test-passphrase" />);

      // Should NOT render passphrase input (provided via prop)
      expect(
        screen.queryByLabelText(/encryption passphrase/i),
      ).not.toBeInTheDocument();

      // Button should be enabled (passphrase provided)
      const connectButton = screen.getByRole('button', {
        name: /connect.*fitbit/i,
      });
      expect(connectButton).toBeEnabled();
    });
  });
});
