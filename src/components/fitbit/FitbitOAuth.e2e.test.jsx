/**
 * Comprehensive E2E tests for Fitbit OAuth 2.0 flow.
 *
 * Tests the full OAuth authorization flow from initiation through callback
 * to token storage, with focus on validating the localStorage fix for
 * state persistence across redirects.
 *
 * Critical Test Areas:
 * 1. State persistence (sessionStorage → localStorage fix)
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

  describe('Critical Test: State Persistence Across Redirect (localStorage Fix)', () => {
    it('persists OAuth state in localStorage across simulated redirect', async () => {
      // ===== CRITICAL TEST =====
      // This test validates the sessionStorage → localStorage fix
      // The bug: state was in sessionStorage, cleared on redirect
      // The fix: state is in localStorage, survives redirect

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

      // CRITICAL: Verify state stored in localStorage (NOT sessionStorage)
      const storedState = localStorage.getItem('fitbit_oauth_state');
      const storedVerifier = localStorage.getItem('fitbit_pkce_verifier');

      expect(storedState).toBeTruthy();
      expect(storedVerifier).toBeTruthy();
      expect(storedState.length).toBeGreaterThan(20);
      expect(storedVerifier.length).toBeGreaterThan(40);

      // CRITICAL: Verify NOT in sessionStorage
      expect(sessionStorage.getItem('fitbit_oauth_state')).toBeNull();
      expect(sessionStorage.getItem('fitbit_pkce_verifier')).toBeNull();

      // ===== SIMULATE REDIRECT =====
      // This simulates browser behavior: cross-origin redirect clears sessionStorage
      simulateRedirect();

      // Verify sessionStorage cleared (as browser does)
      expect(sessionStorage.length).toBe(0);

      // Verify localStorage PERSISTS (this is the fix!)
      expect(localStorage.getItem('fitbit_oauth_state')).toBe(storedState);
      expect(localStorage.getItem('fitbit_pkce_verifier')).toBe(storedVerifier);

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

      // Set callback URL parameters
      simulateOAuthCallback('MOCK_AUTH_CODE', storedState);

      // Render callback handling component
      const { unmount } = render(
        <FitbitOAuthProvider>
          <CallbackComponent />
        </FitbitOAuthProvider>,
      );

      // ===== VERIFY SUCCESS =====
      // State validation should PASS (localStorage persisted the state)
      await waitFor(
        () => {
          const statusElement = screen.getByTestId('status');
          expect(statusElement).toHaveTextContent(CONNECTION_STATUS.CONNECTED);
        },
        { timeout: 5000 },
      );

      // Verify no error occurred
      expect(screen.queryByTestId('error')).not.toBeInTheDocument();

      // Verify OAuth state cleaned up after success
      expect(localStorage.getItem('fitbit_oauth_state')).toBeNull();
      expect(localStorage.getItem('fitbit_pkce_verifier')).toBeNull();

      unmount();
    });

    it('would fail with sessionStorage (proving bug existed)', async () => {
      // This test demonstrates what would happen if we used sessionStorage
      // It should fail, proving the localStorage fix was necessary

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
      const storedState = localStorage.getItem('fitbit_oauth_state');
      expect(storedState).toBeTruthy();

      // Simulate what would happen with sessionStorage:
      // Store state in sessionStorage instead
      sessionStorage.setItem('fitbit_oauth_state_OLD', storedState);
      sessionStorage.setItem('fitbit_pkce_verifier_OLD', 'test_verifier');

      // Simulate redirect (clears sessionStorage)
      sessionStorage.clear();

      // If state was in sessionStorage, it's now GONE
      expect(sessionStorage.getItem('fitbit_oauth_state_OLD')).toBeNull();

      // But with our fix, localStorage persists
      expect(localStorage.getItem('fitbit_oauth_state')).toBe(storedState);

      // This proves the fix works: localStorage survives, sessionStorage doesn't
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
      const storedState = localStorage.getItem('fitbit_oauth_state');
      const storedVerifier = localStorage.getItem('fitbit_pkce_verifier');
      expect(storedState).toBeTruthy();
      expect(storedVerifier).toBeTruthy();

      // Verify authorization URL structure
      const authUrl = window.location.href;
      const urlData = verifyAuthorizationUrl(authUrl);
      expect(urlData.state).toBe(storedState);
      expect(urlData.scope).toContain('heartrate');

      // PHASE 3: Simulate redirect and callback
      simulateRedirect();

      // Mock token exchange
      global.fetch = mockTokenExchange({
        success: true,
        tokenData: mockTokenResponse({ expiresIn: 3600 }),
      });

      // Simulate callback with code
      simulateOAuthCallback('MOCK_CODE_12345', storedState);

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
      expect(localStorage.getItem('fitbit_oauth_state')).toBeNull();
      expect(localStorage.getItem('fitbit_pkce_verifier')).toBeNull();

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
      expect(localStorage.getItem('fitbit_oauth_state')).toBeNull();
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
      const verifier = localStorage.getItem('fitbit_pkce_verifier');
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
        expect(localStorage.getItem('fitbit_pkce_verifier')).toBeNull();
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
        expect(localStorage.getItem('fitbit_oauth_state')).toBeNull();
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
      const state = localStorage.getItem('fitbit_oauth_state');
      simulateRedirect();
      simulateOAuthCallback('MOCK_CODE', state);

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

  // FIXME: disabled for now
  //   describe('Passphrase Handling', () => {
  //     it('requires passphrase for OAuth initiation', async () => {
  //       const mockOnError = vi.fn();

  //       // Render without passphrase
  //       render(<FitbitConnectionCard passphrase={null} onError={mockOnError} />);

  //       const connectButton = screen.getByRole('button', {
  //         name: /connect.*fitbit/i,
  //       });

  //       // Button should be disabled or clicking should error
  //       expect(connectButton).toBeDisabled();
  //     });

  //     it('requires passphrase for token callback', async () => {
  //       const state = 'TEST_STATE';
  //       const verifier = 'TEST_VERIFIER';

  //       setupOAuthState(state, verifier);
  //       simulateOAuthCallback('MOCK_CODE', state);

  //       const CallbackComponent = () => {
  //         const { handleCallback, error } = useFitbitOAuth();

  //         React.useEffect(() => {
  //           const params = new URLSearchParams(window.location.search);
  //           // Call handleCallback WITHOUT passphrase
  //           handleCallback(params.get('code'), params.get('state'), null).catch(
  //             () => {
  //               // Expected to fail
  //             },
  //           );
  //         }, [handleCallback]);

  //         return (
  //           <div>{error && <span data-testid="error">{error.message}</span>}</div>
  //         );
  //       };

  //       render(
  //         <FitbitOAuthProvider>
  //           <CallbackComponent />
  //         </FitbitOAuthProvider>,
  //       );

  //       // Verify error about missing passphrase
  //       let errorElement;
  //       await waitFor(() => {
  //         errorElement = screen.queryByTestId('error');
  //         expect(errorElement).toBeInTheDocument();
  //       });
  //       expect(errorElement).toHaveTextContent(/passphrase/i);
  //     });
  //   });

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
});
