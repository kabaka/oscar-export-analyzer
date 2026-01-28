// Define all mock functions at the top level to avoid hoisting issues
const isAuthenticated = vi.fn();
const getStoredTokens = vi.fn();
const revokeTokens = vi.fn();
const refreshAccessToken = vi.fn();
const setPassphrase = vi.fn();
const batchSync = vi.fn();
const getUserProfile = vi.fn();

// Export a single mockFns object for convenience
const mockFns = {
  isAuthenticated,
  getStoredTokens,
  revokeTokens,
  refreshAccessToken,
  setPassphrase,
  batchSync,
  getUserProfile,
};

vi.mock('../utils/fitbitAuth.js', () => ({
  fitbitOAuth: {
    isAuthenticated: (...args) => isAuthenticated(...args),
    getTokenManager: () => ({
      getStoredTokens: (...args) => getStoredTokens(...args),
      revokeTokens: (...args) => revokeTokens(...args),
      refreshAccessToken: (...args) => refreshAccessToken(...args),
    }),
  },
}));
vi.mock('../utils/fitbitApi.js', () => ({
  fitbitApiClient: {
    setPassphrase: (...args) => setPassphrase(...args),
    batchSync: (...args) => batchSync(...args),
    getUserProfile: (...args) => getUserProfile(...args),
  },
}));
beforeEach(() => {
  // Reset all mock functions
  for (const fn of Object.values(mockFns)) {
    if (fn && fn.mockClear) fn.mockClear();
  }
  vi.resetModules();
  vi.clearAllMocks();
});
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { useFitbitConnection } from './useFitbitConnection';
import { CONNECTION_STATUS } from '../constants/fitbit';

// (All mocks and beforeEach are now handled at the top of the file with mockFns)

// Remove legacy variable mocks; all handled via mockFns above
// (No need to re-mock fitbitAuth.js and fitbitApi.js here)
vi.mock('../utils/fitbitDb.js', () => ({
  getFitbitDataStats: vi.fn().mockResolvedValue({ nights: 2 }),
  setSyncMetadata: vi.fn(),
  getSyncMetadata: vi.fn().mockResolvedValue(new Date('2026-01-24T08:30:00')),
}));

describe('useFitbitConnection', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('sets status CONNECTED and exposes tokens/data when tokens are present and valid', async () => {
    mockFns.isAuthenticated.mockResolvedValue(true);
    mockFns.getStoredTokens.mockResolvedValue({
      access_token: 'mock_access_token',
      refresh_token: 'mock_refresh_token',
      expires_at: Date.now() + 100000,
      scope: 'heartrate sleep',
      created_at: Date.now() - 10000,
      token_type: 'Bearer',
      user_id: 'mock_user_id',
    });

    const view = renderHook(() =>
      useFitbitConnection({ passphrase: 'test', autoCheck: false }),
    );
    await act(async () => {
      await view.result.current.checkConnection();
    });
    expect(view.result.current.status).toBe(CONNECTION_STATUS.CONNECTED);
    expect(view.result.current.connectionInfo).toMatchObject({
      scope: 'heartrate sleep',
    });
    expect(view.result.current.dataStats).toBeTruthy();
  });

  it('makes passphrase available to hooks and API', async () => {
    const { rerender } = renderHook(
      ({ passphrase }) => useFitbitConnection({ passphrase, autoCheck: false }),
      { initialProps: { passphrase: 'secret' } },
    );
    rerender({ passphrase: 'newpass' });
    expect(mockFns.setPassphrase).toHaveBeenCalledWith('newpass');
  });

  it('does not show Not Connected when tokens are valid', async () => {
    mockFns.isAuthenticated.mockResolvedValue(true);
    mockFns.getStoredTokens.mockResolvedValue({
      access_token: 'mock_access_token',
      refresh_token: 'mock_refresh_token',
      expires_at: Date.now() + 100000,
      scope: 'heartrate sleep',
      created_at: Date.now() - 10000,
      token_type: 'Bearer',
      user_id: 'mock_user_id',
    });
    const { result } = renderHook(() =>
      useFitbitConnection({ passphrase: 'test', autoCheck: false }),
    );
    await act(async () => {
      await result.current.checkConnection();
    });
    expect(result.current.status).not.toBe(CONNECTION_STATUS.DISCONNECTED);
    expect(result.current.status).toBe(CONNECTION_STATUS.CONNECTED);
  });
});
