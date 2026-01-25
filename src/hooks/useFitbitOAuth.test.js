import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useFitbitOAuth } from './useFitbitOAuth';
import { CONNECTION_STATUS, FITBIT_ERRORS } from '../constants/fitbit';

const fitbitMocks = vi.hoisted(() => ({
  initiateAuthMock: vi.fn(),
  handleCallbackMock: vi.fn(),
  isAuthenticatedMock: vi.fn(),
  revokeTokensMock: vi.fn(),
  getTokenManagerMock: vi.fn(),
}));

vi.mock('../utils/fitbitAuth.js', () => ({
  __esModule: true,
  fitbitOAuth: {
    initiateAuth: fitbitMocks.initiateAuthMock,
    handleCallback: fitbitMocks.handleCallbackMock,
    isAuthenticated: fitbitMocks.isAuthenticatedMock,
    getTokenManager: () => ({ revokeTokens: fitbitMocks.revokeTokensMock }),
  },
}));

describe('useFitbitOAuth', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    fitbitMocks.initiateAuthMock.mockReset();
    fitbitMocks.handleCallbackMock.mockReset();
    fitbitMocks.isAuthenticatedMock.mockReset();
    fitbitMocks.revokeTokensMock.mockReset();
    // Allow tests to set window.location.href
    delete window.location;
    window.location = { href: '' };
  });

  it('initiates OAuth flow and redirects to Fitbit', async () => {
    fitbitMocks.initiateAuthMock.mockResolvedValue(
      'https://fitbit.example/auth',
    );
    const { result } = renderHook(() => useFitbitOAuth());

    await act(async () => {
      await result.current.initiateAuth({ scopes: ['profile'] });
    });

    expect(fitbitMocks.initiateAuthMock).toHaveBeenCalledWith(['profile']);
    expect(result.current.status).toBe(CONNECTION_STATUS.CONNECTING);
    expect(window.location.href).toBe('https://fitbit.example/auth');
  });

  it('captures initiation errors and surfaces them', async () => {
    const onError = vi.fn();
    const failure = new Error('network down');
    fitbitMocks.initiateAuthMock.mockRejectedValue(failure);

    const { result } = renderHook(() => useFitbitOAuth({ onError }));

    await act(async () => {
      await result.current.initiateAuth();
    });

    expect(result.current.status).toBe(CONNECTION_STATUS.ERROR);
    expect(result.current.error).toMatchObject({
      type: FITBIT_ERRORS.OAUTH_ERROR,
      message: 'Failed to start authentication process',
    });
    expect(result.current.isLoading).toBe(false);
    expect(onError).toHaveBeenCalledWith(failure);
  });

  it('completes callback exchange and sets connected state', async () => {
    const tokenData = { accessToken: 'abc' };
    const onSuccess = vi.fn();
    fitbitMocks.handleCallbackMock.mockResolvedValue(tokenData);

    const { result } = renderHook(() => useFitbitOAuth({ onSuccess }));

    await act(async () => {
      const returned = await result.current.handleCallback(
        'auth-code',
        'state123',
        'secret',
      );
      expect(returned).toEqual(tokenData);
    });

    expect(onSuccess).toHaveBeenCalledWith(tokenData);
    expect(result.current.status).toBe(CONNECTION_STATUS.CONNECTED);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasError).toBe(false);
  });

  it('requires a passphrase during callback and reports encryption error', async () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useFitbitOAuth({ onError }));

    await act(async () => {
      await expect(
        result.current.handleCallback('code', 'state', ''),
      ).rejects.toThrow('Encryption passphrase required');
    });

    await waitFor(() =>
      expect(result.current.error).toMatchObject({
        type: FITBIT_ERRORS.ENCRYPTION_ERROR,
      }),
    );
    expect(result.current.status).toBe(CONNECTION_STATUS.ERROR);
    expect(onError).toHaveBeenCalled();
  });

  it('checks auth status and updates connection state', async () => {
    fitbitMocks.isAuthenticatedMock.mockResolvedValue(true);
    const { result } = renderHook(() => useFitbitOAuth());

    await act(async () => {
      const authed = await result.current.checkAuthStatus('secret');
      expect(authed).toBe(true);
    });

    expect(result.current.status).toBe(CONNECTION_STATUS.CONNECTED);
    expect(result.current.isLoading).toBe(false);

    fitbitMocks.isAuthenticatedMock.mockResolvedValue(false);
    await act(async () => {
      const authed = await result.current.checkAuthStatus('secret');
      expect(authed).toBe(false);
    });

    expect(result.current.status).toBe(CONNECTION_STATUS.DISCONNECTED);
  });

  it('disconnects and revokes tokens when passphrase is provided', async () => {
    const onSuccess = vi.fn();
    fitbitMocks.revokeTokensMock.mockResolvedValue(true);
    const { result } = renderHook(() => useFitbitOAuth({ onSuccess }));

    await act(async () => {
      const success = await result.current.disconnect('secret');
      expect(success).toBe(true);
    });

    expect(fitbitMocks.revokeTokensMock).toHaveBeenCalledWith('secret');
    expect(result.current.status).toBe(CONNECTION_STATUS.DISCONNECTED);
    expect(onSuccess).toHaveBeenCalledWith({ disconnected: true });
  });

  afterAll(() => {
    window.location = originalLocation;
  });
});
