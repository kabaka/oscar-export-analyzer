/**
 * Tests for OAuthCallbackHandler component.
 *
 * NOTE: These tests are currently SKIPPED due to memory issues in CI.
 * See: docs/work/debugging/RCA_vitest_worker_heap_exhaustion.md
 * The test file causes worker heap exhaustion when run with full suite.
 * Tests pass individually but cause OOM when accumulated with 117 other files.
 * TODO: Optimize memory usage or run separately from main test suite.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OAuthCallbackHandler from './OAuthCallbackHandler.jsx';
import '../test-utils/fitbitMocks.js';

// Mock hooks
vi.mock('../hooks/useFitbitOAuth.jsx');

import { useFitbitOAuth } from '../hooks/useFitbitOAuth.jsx';

describe.skip('OAuthCallbackHandler', () => {
  const mockHandleCallback = vi.fn();
  const mockHandleOAuthError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: {
        search: '',
        pathname: '/oauth-callback',
      },
      writable: true,
    });

    // Mock history API
    Object.defineProperty(window, 'history', {
      value: {
        replaceState: vi.fn(),
      },
      writable: true,
    });

    vi.mocked(useFitbitOAuth).mockReturnValue({
      handleCallback: mockHandleCallback,
      handleOAuthError: mockHandleOAuthError,
      error: null,
      isLoading: false,
    });
  });

  it('shows loading state initially', () => {
    window.location.search = '?code=auth123&state=state456';

    render(
      <OAuthCallbackHandler
        passphrase="test-passphrase"
        onSuccess={vi.fn()}
        onError={vi.fn()}
      />,
    );

    expect(screen.getByText('Connecting to Fitbit...')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('processes successful OAuth callback', async () => {
    window.location.search = '?code=auth123&state=state456';
    mockHandleCallback.mockResolvedValue({ access_token: 'token123' });

    const mockOnSuccess = vi.fn();
    const mockOnComplete = vi.fn();

    render(
      <OAuthCallbackHandler
        passphrase="test-passphrase"
        onSuccess={mockOnSuccess}
        onComplete={mockOnComplete}
      />,
    );

    await waitFor(() => {
      expect(mockHandleCallback).toHaveBeenCalledWith(
        'auth123',
        'state456',
        'test-passphrase',
      );
    });
  });

  it('handles OAuth errors from URL parameters', async () => {
    window.location.search =
      '?error=access_denied&error_description=User%20denied%20access';

    const mockOnError = vi.fn();

    render(
      <OAuthCallbackHandler
        passphrase="test-passphrase"
        onError={mockOnError}
      />,
    );

    await waitFor(() => {
      expect(mockHandleOAuthError).toHaveBeenCalledWith(
        'access_denied',
        'User denied access',
      );
    });
  });

  it('shows success state after successful connection', async () => {
    window.location.search = '?code=auth123&state=state456';

    const tokenData = {
      access_token: 'token123',
      scope: 'heartrate sleep',
      expires_in: 28800,
    };

    // Mock successful handleCallback
    mockHandleCallback.mockImplementation(async () => {
      // Directly trigger onSuccess through the hook's onSuccess callback
      return tokenData;
    });

    // Mock hook to call onSuccess when handleCallback succeeds
    vi.mocked(useFitbitOAuth).mockImplementation(({ onSuccess }) => {
      return {
        handleCallback: async (code, state, passphrase) => {
          const result = await mockHandleCallback(code, state, passphrase);
          onSuccess(result);
          return result;
        },
        handleOAuthError: mockHandleOAuthError,
        error: null,
        isLoading: false,
      };
    });

    const mockOnSuccess = vi.fn();

    render(
      <OAuthCallbackHandler
        passphrase="test-passphrase"
        onSuccess={mockOnSuccess}
      />,
    );

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalledWith(tokenData);
    });

    // Should show success UI
    expect(screen.getByText('Successfully Connected!')).toBeInTheDocument();
  });

  it('shows error state with retry options', async () => {
    // No URL params = missing authorization parameters error
    window.location.search = '';

    // Mock hook with error state
    vi.mocked(useFitbitOAuth).mockReturnValue({
      handleCallback: mockHandleCallback,
      handleOAuthError: mockHandleOAuthError,
      error: {
        code: 'oauth_error',
        message: 'Authentication failed',
        type: 'oauth_error',
      },
      isLoading: false,
    });

    const mockOnError = vi.fn();

    render(
      <OAuthCallbackHandler
        passphrase="test-passphrase"
        onError={mockOnError}
      />,
    );

    // Component will process and detect missing parameters
    await waitFor(() => {
      expect(screen.getByText('Connection Failed')).toBeInTheDocument();
    });

    // Should show the error message
    expect(
      screen.getByText(
        /Missing authorization parameters|Authentication failed/i,
      ),
    ).toBeInTheDocument();
  });

  it('waits for passphrase when not provided', () => {
    window.location.search = '?code=auth123&state=state456';

    render(<OAuthCallbackHandler passphrase={null} onSuccess={vi.fn()} />);

    expect(
      screen.getByText('Waiting for encryption passphrase...'),
    ).toBeInTheDocument();
  });

  it('handles missing authorization parameters', async () => {
    window.location.search = '?invalid=params';

    const mockOnError = vi.fn();

    render(
      <OAuthCallbackHandler
        passphrase="test-passphrase"
        onError={mockOnError}
      />,
    );

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Missing authorization parameters',
        }),
      );
    });
  });

  describe('OAuth parameter capture regression tests', () => {
    /**
     * REGRESSION: OAuth parameters were being lost during URL cleanup.
     * These tests verify the fix using useMemo to capture params before cleanup.
     */

    it('captures OAuth parameters BEFORE URL cleanup runs', async () => {
      // Setup: OAuth callback URL with code and state
      window.location.search = '?code=captured123&state=capturedState456';

      const mockOnSuccess = vi.fn();
      mockHandleCallback.mockResolvedValue({ access_token: 'token123' });

      // Mock hook to verify parameters came from captured values
      vi.mocked(useFitbitOAuth).mockImplementation(({ onSuccess }) => {
        return {
          handleCallback: async (code, state, passphrase) => {
            // Verify parameters match what was in URL BEFORE cleanup
            expect(code).toBe('captured123');
            expect(state).toBe('capturedState456');

            const result = await mockHandleCallback(code, state, passphrase);
            onSuccess(result);
            return result;
          },
          handleOAuthError: mockHandleOAuthError,
          error: null,
          isLoading: false,
        };
      });

      render(
        <OAuthCallbackHandler
          passphrase="test-passphrase"
          onSuccess={mockOnSuccess}
        />,
      );

      // Verify URL cleanup happened (synchronously)
      expect(window.history.replaceState).toHaveBeenCalled();

      // Verify processing still works with captured parameters
      await waitFor(() => {
        expect(mockHandleCallback).toHaveBeenCalledWith(
          'captured123',
          'capturedState456',
          'test-passphrase',
        );
      });

      expect(mockOnSuccess).toHaveBeenCalled();
    });

    it('uses captured parameters after URL is cleaned', async () => {
      // Setup: Start with OAuth parameters
      window.location.search = '?code=beforeCleanup&state=stateBeforeCleanup';

      const mockOnSuccess = vi.fn();
      mockHandleCallback.mockResolvedValue({ access_token: 'token123' });

      // Track the sequence of events
      const eventSequence = [];

      // Mock history to track when cleanup happens
      const originalReplaceState = window.history.replaceState;
      window.history.replaceState = vi.fn((...args) => {
        eventSequence.push('url_cleanup');
        originalReplaceState.apply(window.history, args);
      });

      // Mock hook to track when parameters are used
      vi.mocked(useFitbitOAuth).mockImplementation(({ onSuccess }) => {
        return {
          handleCallback: async (code, state, passphrase) => {
            eventSequence.push('params_used');
            // Parameters should still be the original ones
            expect(code).toBe('beforeCleanup');
            expect(state).toBe('stateBeforeCleanup');

            const result = await mockHandleCallback(code, state, passphrase);
            onSuccess(result);
            return result;
          },
          handleOAuthError: mockHandleOAuthError,
          error: null,
          isLoading: false,
        };
      });

      render(
        <OAuthCallbackHandler
          passphrase="test-passphrase"
          onSuccess={mockOnSuccess}
        />,
      );

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
      });

      // Verify URL cleanup happened at least once before params were used
      expect(eventSequence[0]).toBe('url_cleanup');
      expect(eventSequence).toContain('params_used');
      expect(eventSequence.indexOf('url_cleanup')).toBeLessThan(
        eventSequence.indexOf('params_used'),
      );
    });

    it('URL cleanup does not affect OAuth parameter processing', async () => {
      window.location.search = '?code=persistent&state=persistent123';

      // Simulate aggressive URL cleanup that would break old implementation
      window.history.replaceState = vi.fn(() => {
        // Simulate URL being cleaned immediately
        window.location.search = '';
      });

      const mockOnSuccess = vi.fn();
      mockHandleCallback.mockResolvedValue({ access_token: 'token123' });

      vi.mocked(useFitbitOAuth).mockImplementation(({ onSuccess }) => {
        return {
          handleCallback: async (code, state, passphrase) => {
            // Even though window.location.search is now empty,
            // captured params should still be available
            expect(window.location.search).toBe('');
            expect(code).toBe('persistent');
            expect(state).toBe('persistent123');

            const result = await mockHandleCallback(code, state, passphrase);
            onSuccess(result);
            return result;
          },
          handleOAuthError: mockHandleOAuthError,
          error: null,
          isLoading: false,
        };
      });

      render(
        <OAuthCallbackHandler
          passphrase="test-passphrase"
          onSuccess={mockOnSuccess}
        />,
      );

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
      });

      expect(mockHandleCallback).toHaveBeenCalledWith(
        'persistent',
        'persistent123',
        'test-passphrase',
      );
    });

    it('preserves parameters through two-phase flow: passphrase → OAuth processing', async () => {
      window.location.search = '?code=twoPhase&state=twoPhaseState';

      const mockOnSuccess = vi.fn();
      mockHandleCallback.mockResolvedValue({ access_token: 'token123' });

      vi.mocked(useFitbitOAuth).mockImplementation(({ onSuccess }) => {
        return {
          handleCallback: async (code, state, passphrase) => {
            const result = await mockHandleCallback(code, state, passphrase);
            onSuccess(result);
            return result;
          },
          handleOAuthError: mockHandleOAuthError,
          error: null,
          isLoading: false,
        };
      });

      // Phase 1: Render without passphrase (waiting state)
      const { rerender } = render(
        <OAuthCallbackHandler passphrase={null} onSuccess={mockOnSuccess} />,
      );

      // Should show waiting message
      expect(
        screen.getByText('Waiting for encryption passphrase...'),
      ).toBeInTheDocument();

      // URL should be cleaned even in waiting state
      expect(window.history.replaceState).toHaveBeenCalled();

      // Phase 2: Provide passphrase (should trigger processing)
      rerender(
        <OAuthCallbackHandler
          passphrase="delayed-passphrase"
          onSuccess={mockOnSuccess}
        />,
      );

      // Parameters should still be available and processed correctly
      await waitFor(() => {
        expect(mockHandleCallback).toHaveBeenCalledWith(
          'twoPhase',
          'twoPhaseState',
          'delayed-passphrase',
        );
      });

      expect(mockOnSuccess).toHaveBeenCalled();
    });

    it('multiple renders do not re-capture parameters (useMemo stability)', async () => {
      window.location.search = '?code=once&state=onceState';

      const mockOnSuccess = vi.fn();
      mockHandleCallback.mockResolvedValue({ access_token: 'token123' });

      vi.mocked(useFitbitOAuth).mockImplementation(({ onSuccess }) => {
        return {
          handleCallback: async (code, state, passphrase) => {
            const result = await mockHandleCallback(code, state, passphrase);
            onSuccess(result);
            return result;
          },
          handleOAuthError: mockHandleOAuthError,
          error: null,
          isLoading: false,
        };
      });

      const { rerender } = render(
        <OAuthCallbackHandler
          passphrase="test-passphrase"
          onSuccess={mockOnSuccess}
        />,
      );

      // Force multiple re-renders with different props
      rerender(
        <OAuthCallbackHandler
          passphrase="test-passphrase-updated"
          onSuccess={mockOnSuccess}
        />,
      );
      rerender(
        <OAuthCallbackHandler
          passphrase="test-passphrase-updated-again"
          onSuccess={mockOnSuccess}
        />,
      );

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
      });

      // Verify handleCallback was only called once despite multiple rerenders
      // This proves useMemo kept the same captured params across renders
      expect(mockHandleCallback).toHaveBeenCalledTimes(1);
      expect(mockHandleCallback).toHaveBeenCalledWith(
        'once',
        'onceState',
        expect.any(String),
      );
    });

    it('captures OAuth error parameters before URL cleanup', async () => {
      window.location.search =
        '?error=access_denied&error_description=User%20rejected';

      const mockOnError = vi.fn();

      vi.mocked(useFitbitOAuth).mockImplementation(({ onError }) => {
        return {
          handleCallback: mockHandleCallback,
          handleOAuthError: (error, description) => {
            // Verify error params were captured correctly
            expect(error).toBe('access_denied');
            expect(description).toBe('User rejected');

            mockHandleOAuthError(error, description);
            onError({ type: 'oauth_error', message: description });
          },
          error: null,
          isLoading: false,
        };
      });

      render(
        <OAuthCallbackHandler
          passphrase="test-passphrase"
          onError={mockOnError}
        />,
      );

      // URL cleanup should happen
      expect(window.history.replaceState).toHaveBeenCalled();

      // Error handling should still work with captured params
      await waitFor(() => {
        expect(mockHandleOAuthError).toHaveBeenCalledWith(
          'access_denied',
          'User rejected',
        );
      });
    });

    it('handles edge case: parameters with special characters are captured correctly', async () => {
      // URL-encoded parameters
      window.location.search =
        '?code=abc%2B123%3D&state=xyz%2Fstate%3Dtest&error_description=Access%20was%20denied';

      const mockOnSuccess = vi.fn();
      mockHandleCallback.mockResolvedValue({ access_token: 'token123' });

      vi.mocked(useFitbitOAuth).mockImplementation(({ onSuccess }) => {
        return {
          handleCallback: async (code, state, passphrase) => {
            // Verify URL decoding happened during capture
            expect(code).toBe('abc+123=');
            expect(state).toBe('xyz/state=test');

            const result = await mockHandleCallback(code, state, passphrase);
            onSuccess(result);
            return result;
          },
          handleOAuthError: mockHandleOAuthError,
          error: null,
          isLoading: false,
        };
      });

      render(
        <OAuthCallbackHandler
          passphrase="test-passphrase"
          onSuccess={mockOnSuccess}
        />,
      );

      await waitFor(() => {
        expect(mockHandleCallback).toHaveBeenCalledWith(
          'abc+123=',
          'xyz/state=test',
          'test-passphrase',
        );
      });
    });
  });
});
