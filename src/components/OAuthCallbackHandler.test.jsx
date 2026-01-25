/**
 * Tests for OAuthCallbackHandler component.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OAuthCallbackHandler from './OAuthCallbackHandler.jsx';
import '../test-utils/fitbitMocks.js';

// Mock hooks
vi.mock('../hooks/useFitbitOAuth.js');

import { useFitbitOAuth } from '../hooks/useFitbitOAuth.js';

describe('OAuthCallbackHandler', () => {
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
    vi.mocked(useFitbitOAuth).mockReturnValue({
      handleCallback: vi.fn(),
      handleOAuthError: vi.fn(),
      error: null,
      isLoading: false,
    });

    const mockOnSuccess = vi.fn();

    render(
      <OAuthCallbackHandler
        passphrase="test-passphrase"
        onSuccess={mockOnSuccess}
      />,
    );

    // Simulate successful callback
    mockOnSuccess({
      access_token: 'token123',
      scope: 'heartrate sleep',
      expires_in: 28800,
    });

    await waitFor(() => {
      expect(screen.getByText('Successfully Connected!')).toBeInTheDocument();
    });
  });

  it('shows error state with retry options', async () => {
    vi.mocked(useFitbitOAuth).mockReturnValue({
      handleCallback: vi.fn(),
      handleOAuthError: vi.fn(),
      error: {
        message: 'Authentication failed',
        type: 'oauth_error',
      },
      isLoading: false,
    });

    render(
      <OAuthCallbackHandler passphrase="test-passphrase" onError={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Connection Failed')).toBeInTheDocument();
      expect(screen.getByText('Authentication failed')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Try Again/ }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Return to App/ }),
      ).toBeInTheDocument();
    });
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
});
