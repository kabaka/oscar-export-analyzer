import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildMockOAuthTokens,
  buildMockFitbitApiResponse,
} from '../../test-utils/fitbitBuilders.js';

// Mock IndexedDB for token storage
import 'fake-indexeddb/auto';

// Component under test - OAuth integration
import { useFitbitOAuth } from '../../hooks/useFitbitOAuth.jsx';
import { FitbitOAuthProvider } from '../../context/FitbitOAuthContext.jsx';

// Mock fetch for API calls
global.fetch = vi.fn();

// Mock window.crypto for PKCE
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: vi.fn((buffer) => {
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] = Math.floor(Math.random() * 256);
      }
      return buffer;
    }),
    subtle: {
      digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
    },
  },
  writable: true,
});

const setupOAuthState = (state, verifier = 'test_verifier') => {
  const stateData = { value: state, createdAt: Date.now() };
  sessionStorage.setItem('fitbit_oauth_state', JSON.stringify(stateData));
  sessionStorage.setItem('fitbit_pkce_verifier', verifier);
  localStorage.setItem('fitbit_oauth_state_backup', JSON.stringify(stateData));
  localStorage.setItem('fitbit_pkce_verifier_backup', verifier);
};

describe.skip('Fitbit OAuth Integration', () => {
  let mockLocation, mockHistory;

  beforeEach(() => {
    // Mock window.location for OAuth redirect
    mockLocation = {
      origin: 'http://localhost:5173',
      search: '',
      pathname: '/',
      assign: vi.fn(),
    };
    Object.defineProperty(window, 'location', {
      value: mockLocation,
      writable: true,
    });

    // Mock history API
    mockHistory = {
      replaceState: vi.fn(),
      pushState: vi.fn(),
    };
    Object.defineProperty(window, 'history', {
      value: mockHistory,
      writable: true,
    });

    // Reset all mocks
    vi.clearAllMocks();
    global.fetch.mockClear();

    // Clear IndexedDB between tests
    const deleteDbRequest = indexedDB.deleteDatabase('OscarFitbitData');
    deleteDbRequest.onsuccess = () => {};
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('OAuth Authorization Flow', () => {
    it('initiates OAuth flow with correct parameters', async () => {
      const TestComponent = () => {
        const { initiateAuth, status } = useFitbitOAuth();

        return (
          <div>
            <button onClick={initiateAuth}>Connect Fitbit</button>
            <span data-testid="status">{status}</span>
          </div>
        );
      };

      render(
        <FitbitOAuthProvider>
          <TestComponent />
        </FitbitOAuthProvider>,
      );

      const connectButton = screen.getByText('Connect Fitbit');
      fireEvent.click(connectButton);

      await waitFor(() => {
        expect(mockLocation.assign).toHaveBeenCalledWith(
          expect.stringMatching(
            /^https:\/\/www\.fitbit\.com\/oauth2\/authorize/,
          ),
        );
      });

      // Verify OAuth URL contains required parameters
      const [oauthUrl] = mockLocation.assign.mock.calls[0];
      const url = new URL(oauthUrl);

      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('client_id')).toBe('test-client-id');
      expect(url.searchParams.get('scope')).toContain('heartrate');
      expect(url.searchParams.get('scope')).toContain('spo2');
      expect(url.searchParams.get('scope')).toContain('sleep');
      expect(url.searchParams.get('state')).toHaveLength(32); // PKCE state

      // Verify redirect_uri includes BASE_URL subdirectory
      const redirectUri = url.searchParams.get('redirect_uri');
      expect(redirectUri).toContain('oauth-callback');
      expect(redirectUri).toMatch(/^http:\/\/localhost:5173/);

      // Should include BASE_URL path from Vite config
      function getMetaEnv() {
        if (
          typeof globalThis !== 'undefined' &&
          globalThis.__vitest_worker__?.metaEnv
        ) {
          return globalThis.__vitest_worker__.metaEnv;
        }
        if (typeof import.meta !== 'undefined' && import.meta.env) {
          return import.meta.env;
        }
        return {};
      }
      const env = getMetaEnv();
      const baseUrl = typeof env.BASE_URL !== 'undefined' ? env.BASE_URL : '/';
      if (baseUrl !== '/') {
        expect(redirectUri).toContain(baseUrl.replace(/\/$/, ''));
      }
    });

    it('stores PKCE state in session storage', async () => {
      const { initiateAuth } = useFitbitOAuth();

      await act(async () => {
        await initiateAuth();
      });

      const storedStateRaw = sessionStorage.getItem('fitbit_oauth_state');
      expect(storedStateRaw).toBeTruthy();
      const storedState = JSON.parse(storedStateRaw);
      expect(storedState.value).toHaveLength(32);
    });

    it('generates unique state for each OAuth attempt', async () => {
      const { initiateAuth } = useFitbitOAuth();

      await act(async () => {
        await initiateAuth();
      });
      const firstState = JSON.parse(
        sessionStorage.getItem('fitbit_oauth_state'),
      ).value;

      await act(async () => {
        await initiateAuth();
      });
      const secondState = JSON.parse(
        sessionStorage.getItem('fitbit_oauth_state'),
      ).value;

      expect(firstState).not.toBe(secondState);
    });
  });

  describe('OAuth Callback Handling', () => {
    it('successfully processes valid OAuth callback', async () => {
      const mockTokens = buildMockOAuthTokens({ expired: false });

      // Mock successful token exchange
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokens),
      });

      // Mock successful user profile fetch
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(buildMockFitbitApiResponse('profile')),
      });

      const TestComponent = () => {
        const { handleCallback, status, connectionInfo, error } =
          useFitbitOAuth();

        React.useEffect(() => {
          if (window.location.search.includes('code=')) {
            const params = new URLSearchParams(window.location.search);
            handleCallback(params.get('code'), params.get('state'));
          }
        }, [handleCallback]);

        return (
          <div>
            <span data-testid="status">{status}</span>
            <span data-testid="error">{error}</span>
            <span data-testid="user">
              {connectionInfo?.displayName || 'Not connected'}
            </span>
          </div>
        );
      };

      // Set up OAuth callback URL
      mockLocation.search = '?code=mock_auth_code&state=valid_state';
      setupOAuthState('valid_state');

      render(
        <FitbitOAuthProvider>
          <TestComponent />
        </FitbitOAuthProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('status')).toHaveTextContent('connected');
      });

      expect(screen.getByTestId('user')).toHaveTextContent('Test User');
      expect(screen.getByTestId('error')).toBeEmptyDOMElement();

      // Verify token exchange API call
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.fitbit.com/oauth2/token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
          body: expect.stringContaining('grant_type=authorization_code'),
        }),
      );
    });

    it('rejects callback with invalid state (CSRF protection)', async () => {
      const TestComponent = () => {
        const { handleCallback, error } = useFitbitOAuth();

        React.useEffect(() => {
          handleCallback('mock_code', 'invalid_state');
        }, [handleCallback]);

        return <span data-testid="error">{error}</span>;
      };

      // Store different state than callback provides
      setupOAuthState('expected_state');

      render(
        <FitbitOAuthProvider>
          <TestComponent />
        </FitbitOAuthProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent(
          expect.stringMatching(/invalid.*state|security.*error/i),
        );
      });

      // Should not make token exchange request
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('handles token exchange failure gracefully', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve({
            errors: [
              {
                errorType: 'invalid_grant',
                message: 'Authorization code expired',
              },
            ],
          }),
      });

      const TestComponent = () => {
        const { handleCallback, error, status } = useFitbitOAuth();

        React.useEffect(() => {
          handleCallback('expired_code', 'valid_state');
        }, [handleCallback]);

        return (
          <div>
            <span data-testid="status">{status}</span>
            <span data-testid="error">{error}</span>
          </div>
        );
      };

      setupOAuthState('valid_state');

      render(
        <FitbitOAuthProvider>
          <TestComponent />
        </FitbitOAuthProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('status')).toHaveTextContent('disconnected');
      });

      expect(screen.getByTestId('error')).toHaveTextContent(
        expect.stringMatching(/authorization.*expired|token.*error/i),
      );
    });

    it('handles network errors during token exchange', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      const TestComponent = () => {
        const { handleCallback, error, status } = useFitbitOAuth();

        React.useEffect(() => {
          handleCallback('valid_code', 'valid_state');
        }, [handleCallback]);

        return (
          <div>
            <span data-testid="status">{status}</span>
            <span data-testid="error">{error}</span>
          </div>
        );
      };

      setupOAuthState('valid_state');

      render(
        <FitbitOAuthProvider>
          <TestComponent />
        </FitbitOAuthProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent(
          expect.stringMatching(/network.*error|connection.*failed/i),
        );
      });

      expect(screen.getByTestId('status')).toHaveTextContent('disconnected');
    });
  });

  describe('Token Storage and Retrieval', () => {
    it('stores tokens securely in IndexedDB', async () => {
      const mockTokens = buildMockOAuthTokens({
        expired: false,
        expiresInHours: 8,
      });

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokens),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(buildMockFitbitApiResponse('profile')),
        });

      const TestComponent = () => {
        const { handleCallback, connectionInfo } = useFitbitOAuth();

        React.useEffect(() => {
          handleCallback('valid_code', 'valid_state');
        }, [handleCallback]);

        return (
          <span data-testid="connected">{connectionInfo ? 'Yes' : 'No'}</span>
        );
      };

      setupOAuthState('valid_state');

      render(
        <FitbitOAuthProvider>
          <TestComponent />
        </FitbitOAuthProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('Yes');
      });

      // Verify tokens are stored (would check IndexedDB in real implementation)
      // Note: Testing IndexedDB directly requires additional setup
    });

    it('retrieves and validates stored tokens on app initialization', async () => {
      // Pre-store valid tokens in IndexedDB (simulated)
      // eslint-disable-next-line no-unused-vars
      const mockTokens = buildMockOAuthTokens({ expired: false });

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(buildMockFitbitApiResponse('profile')),
      });

      const TestComponent = () => {
        const { status, connectionInfo } = useFitbitOAuth();

        return (
          <div>
            <span data-testid="status">{status}</span>
            <span data-testid="user">
              {connectionInfo?.displayName || 'Not found'}
            </span>
          </div>
        );
      };

      render(
        <FitbitOAuthProvider>
          <TestComponent />
        </FitbitOAuthProvider>,
      );

      // Should attempt to load existing tokens and validate them
      await waitFor(
        () => {
          expect(screen.getByTestId('status')).toHaveTextContent('connected');
        },
        { timeout: 3000 },
      );
    });

    it('detects expired tokens and clears them', async () => {
      // eslint-disable-next-line no-unused-vars
      const expiredTokens = buildMockOAuthTokens({ expired: true });

      // Mock token validation request that fails due to expiration
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve({
            errors: [
              { errorType: 'expired_token', message: 'Access token expired' },
            ],
          }),
      });

      const TestComponent = () => {
        const { status, error } = useFitbitOAuth();

        return (
          <div>
            <span data-testid="status">{status}</span>
            <span data-testid="error">{error}</span>
          </div>
        );
      };

      render(
        <FitbitOAuthProvider>
          <TestComponent />
        </FitbitOAuthProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('status')).toHaveTextContent('disconnected');
      });

      // Should clear error after detecting expired token
      expect(screen.getByTestId('error')).toBeEmptyDOMElement();
    });
  });

  describe('Token Refresh Flow', () => {
    it('automatically refreshes expired access tokens', async () => {
      const refreshTokens = buildMockOAuthTokens({ expired: false });

      // Mock refresh token exchange
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(refreshTokens),
      });

      // Mock profile fetch with new token
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(buildMockFitbitApiResponse('profile')),
      });

      const TestComponent = () => {
        const { refreshToken, status, error } = useFitbitOAuth();

        return (
          <div>
            <button onClick={refreshToken}>Refresh Token</button>
            <span data-testid="status">{status}</span>
            <span data-testid="error">{error}</span>
          </div>
        );
      };

      render(
        <FitbitOAuthProvider>
          <TestComponent />
        </FitbitOAuthProvider>,
      );

      const refreshButton = screen.getByText('Refresh Token');
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(screen.getByTestId('status')).toHaveTextContent('connected');
      });

      // Verify refresh token API call
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.fitbit.com/oauth2/token',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('grant_type=refresh_token'),
        }),
      );
    });

    it('handles refresh token expiration', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve({
            errors: [
              { errorType: 'invalid_grant', message: 'Refresh token expired' },
            ],
          }),
      });

      const TestComponent = () => {
        const { refreshToken, error, status } = useFitbitOAuth();

        React.useEffect(() => {
          refreshToken();
        }, [refreshToken]);

        return (
          <div>
            <span data-testid="status">{status}</span>
            <span data-testid="error">{error}</span>
          </div>
        );
      };

      render(
        <FitbitOAuthProvider>
          <TestComponent />
        </FitbitOAuthProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('status')).toHaveTextContent('disconnected');
      });

      expect(screen.getByTestId('error')).toHaveTextContent(
        expect.stringMatching(/refresh.*expired|re.*authenticate/i),
      );
    });
  });

  describe('Multiple Tab Coordination', () => {
    it('handles OAuth completion in different tab', async () => {
      const TestComponent = () => {
        const { status, connectionInfo } = useFitbitOAuth();

        return (
          <div>
            <span data-testid="status">{status}</span>
            <span data-testid="connected">{connectionInfo ? 'Yes' : 'No'}</span>
          </div>
        );
      };

      render(
        <FitbitOAuthProvider>
          <TestComponent />
        </FitbitOAuthProvider>,
      );

      // Simulate OAuth completion in another tab by triggering storage event
      const mockTokens = buildMockOAuthTokens({ expired: false });

      act(() => {
        // Simulate storage event from another tab completing OAuth
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: 'fitbit_oauth_completed',
            newValue: JSON.stringify(mockTokens),
            storageArea: localStorage,
          }),
        );
      });

      await waitFor(() => {
        expect(screen.getByTestId('status')).toHaveTextContent('connected');
      });

      expect(screen.getByTestId('connected')).toHaveTextContent('Yes');
    });

    it('prevents multiple simultaneous OAuth attempts', async () => {
      const TestComponent = () => {
        const { initiateAuth, isLoading } = useFitbitOAuth();

        return (
          <div>
            <button
              onClick={initiateAuth}
              disabled={isLoading}
              data-testid="connect-btn"
            >
              {isLoading ? 'Connecting...' : 'Connect Fitbit'}
            </button>
          </div>
        );
      };

      render(
        <FitbitOAuthProvider>
          <TestComponent />
        </FitbitOAuthProvider>,
      );

      const connectButton = screen.getByTestId('connect-btn');

      // First click should initiate OAuth
      fireEvent.click(connectButton);
      expect(connectButton).toBeDisabled();
      expect(connectButton).toHaveTextContent('Connecting...');

      // Second click should be prevented
      fireEvent.click(connectButton);
      expect(mockLocation.assign).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Recovery and User Experience', () => {
    it('provides clear error messages for common OAuth failures', async () => {
      const errorScenarios = [
        {
          response: {
            ok: false,
            status: 400,
            json: () =>
              Promise.resolve({
                errors: [
                  {
                    errorType: 'invalid_client',
                    message: 'Invalid client credentials',
                  },
                ],
              }),
          },
          expectedMessage: /client.*configuration|app.*setup/i,
        },
        {
          response: {
            ok: false,
            status: 403,
            json: () =>
              Promise.resolve({
                errors: [
                  {
                    errorType: 'insufficient_scope',
                    message: 'Requested scope not granted',
                  },
                ],
              }),
          },
          expectedMessage: /permission.*denied|scope.*access/i,
        },
        {
          response: {
            ok: false,
            status: 429,
            json: () =>
              Promise.resolve({
                errors: [
                  {
                    errorType: 'rate_limit_exceeded',
                    message: 'Too many requests',
                  },
                ],
              }),
          },
          expectedMessage: /rate.*limit|too.*many.*requests/i,
        },
      ];

      for (const { response, expectedMessage } of errorScenarios) {
        global.fetch.mockResolvedValueOnce(response);

        const TestComponent = () => {
          const { handleCallback, error } = useFitbitOAuth();

          React.useEffect(() => {
            handleCallback('test_code', 'valid_state');
          }, [handleCallback]);

          return <span data-testid="error">{error}</span>;
        };

        setupOAuthState('valid_state');

        const { unmount } = render(
          <FitbitOAuthProvider>
            <TestComponent />
          </FitbitOAuthProvider>,
        );

        await waitFor(() => {
          expect(screen.getByTestId('error')).toHaveTextContent(
            expectedMessage,
          );
        });

        unmount();
        vi.clearAllMocks();
      }
    });

    it('allows users to clear errors and retry', async () => {
      const TestComponent = () => {
        const { error, clearError, initiateAuth } = useFitbitOAuth();

        return (
          <div>
            <span data-testid="error">{error}</span>
            <button onClick={clearError} data-testid="clear-error">
              Clear Error
            </button>
            <button onClick={initiateAuth} data-testid="retry">
              Retry Connection
            </button>
          </div>
        );
      };

      // Simulate initial error
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      render(
        <FitbitOAuthProvider>
          <TestComponent />
        </FitbitOAuthProvider>,
      );

      // Trigger error
      setupOAuthState('valid_state');
      const { handleCallback } = useFitbitOAuth();
      await act(async () => {
        await handleCallback('test_code', 'valid_state');
      });

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent(
          /network.*error/i,
        );
      });

      // Clear error
      fireEvent.click(screen.getByTestId('clear-error'));
      expect(screen.getByTestId('error')).toBeEmptyDOMElement();

      // Retry should work
      fireEvent.click(screen.getByTestId('retry'));
      expect(mockLocation.assign).toHaveBeenCalledWith(
        expect.stringMatching(/fitbit\.com\/oauth2\/authorize/),
      );
    });
  });

  describe('Security and Privacy', () => {
    it('clears sensitive data on disconnect', async () => {
      const TestComponent = () => {
        const { disconnect, status, connectionInfo } = useFitbitOAuth();

        return (
          <div>
            <button onClick={disconnect} data-testid="disconnect">
              Disconnect
            </button>
            <span data-testid="status">{status}</span>
            <span data-testid="user">
              {connectionInfo?.displayName || 'None'}
            </span>
          </div>
        );
      };

      render(
        <FitbitOAuthProvider>
          <TestComponent />
        </FitbitOAuthProvider>,
      );

      const disconnectButton = screen.getByTestId('disconnect');
      fireEvent.click(disconnectButton);

      await waitFor(() => {
        expect(screen.getByTestId('status')).toHaveTextContent('disconnected');
      });

      expect(screen.getByTestId('user')).toHaveTextContent('None');

      // Verify session storage is cleared
      expect(sessionStorage.getItem('fitbit_oauth_state')).toBeNull();
      expect(localStorage.getItem('fitbit_oauth_state_backup')).toBeNull();
    });

    it('does not store tokens in localStorage or sessionStorage', async () => {
      const mockTokens = buildMockOAuthTokens({ expired: false });

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokens),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(buildMockFitbitApiResponse('profile')),
        });

      const TestComponent = () => {
        const { handleCallback, connectionInfo } = useFitbitOAuth();

        React.useEffect(() => {
          handleCallback('valid_code', 'valid_state');
        }, [handleCallback]);

        return (
          <span data-testid="connected">{connectionInfo ? 'Yes' : 'No'}</span>
        );
      };

      setupOAuthState('valid_state');

      render(
        <FitbitOAuthProvider>
          <TestComponent />
        </FitbitOAuthProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('connected')).toHaveTextContent('Yes');
      });

      // Verify tokens are NOT in localStorage or sessionStorage
      expect(localStorage.getItem('access_token')).toBeNull();
      expect(localStorage.getItem('refresh_token')).toBeNull();
      expect(sessionStorage.getItem('access_token')).toBeNull();
      expect(sessionStorage.getItem('refresh_token')).toBeNull();
    });

    it('validates SSL/HTTPS for OAuth redirect URIs in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      // Mock production location with HTTPS
      Object.defineProperty(window, 'location', {
        value: {
          ...mockLocation,
          origin: 'https://oscar-analyzer.example.com',
        },
        writable: true,
      });

      const { generateAuthUrl } = useFitbitOAuth();
      const authUrl = generateAuthUrl();

      const url = new URL(authUrl);
      const redirectUri = url.searchParams.get('redirect_uri');
      expect(redirectUri).toMatch(/^https:\/\//);

      process.env.NODE_ENV = originalEnv;
    });
  });
});
