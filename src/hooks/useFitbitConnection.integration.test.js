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

  it('syncFitbitData works when called with no arguments (defaults dates)', async () => {
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
    mockFns.batchSync.mockResolvedValue({ heartRate: [], spo2: [], sleep: [] });

    const { result } = renderHook(() =>
      useFitbitConnection({ passphrase: 'test', autoCheck: false }),
    );
    await act(async () => {
      await result.current.checkConnection();
    });
    expect(result.current.status).toBe(CONNECTION_STATUS.CONNECTED);

    // Call syncFitbitData with no arguments — should NOT throw
    await act(async () => {
      await result.current.syncFitbitData();
    });

    expect(mockFns.batchSync).toHaveBeenCalledTimes(1);
    const callArgs = mockFns.batchSync.mock.calls[0][0];
    // Should have computed default dates (YYYY-MM-DD strings)
    expect(callArgs.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(callArgs.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(callArgs.dataTypes).toEqual(['heartRate', 'spo2']);
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

  it('stores parsed heart rate data in syncedData and fitbitData after sync', async () => {
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

    // Simulate the real Fitbit API response format
    mockFns.batchSync.mockResolvedValue({
      heartRate: {
        'activities-heart': [
          {
            dateTime: '2026-01-08',
            value: {
              restingHeartRate: 68,
              heartRateZones: [
                {
                  name: 'Out of Range',
                  minutes: 1439,
                  caloriesOut: 1200,
                  min: 30,
                  max: 100,
                },
              ],
            },
          },
          {
            dateTime: '2026-01-09',
            value: {
              restingHeartRate: 70,
              heartRateZones: [],
            },
          },
        ],
      },
    });

    const { result } = renderHook(() =>
      useFitbitConnection({ passphrase: 'test', autoCheck: false }),
    );

    // Connect first
    await act(async () => {
      await result.current.checkConnection();
    });
    expect(result.current.status).toBe(CONNECTION_STATUS.CONNECTED);

    // Sync data
    await act(async () => {
      await result.current.syncFitbitData();
    });

    // Verify syncedData is populated with parsed heart rate data
    expect(result.current.syncedData).toBeTruthy();
    expect(result.current.syncedData.heartRateData).toHaveLength(2);
    expect(result.current.syncedData.heartRateData[0]).toMatchObject({
      date: '2026-01-08',
      restingHeartRate: 68,
    });
    expect(result.current.syncedData.heartRateData[1]).toMatchObject({
      date: '2026-01-09',
      restingHeartRate: 70,
    });

    // Verify fitbitData includes the synced data
    expect(result.current.fitbitData).toBeTruthy();
    expect(result.current.fitbitData.heartRateData).toHaveLength(2);
  });

  it('fitbitData falls back to dataStats when no synced data', async () => {
    mockFns.isAuthenticated.mockResolvedValue(true);
    mockFns.getStoredTokens.mockResolvedValue({
      access_token: 'mock_access_token',
      refresh_token: 'mock_refresh_token',
      expires_at: Date.now() + 100000,
      scope: 'heartrate',
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

    // Before sync, fitbitData should be dataStats (from mocked getFitbitDataStats)
    expect(result.current.syncedData).toBeNull();
    expect(result.current.fitbitData).toEqual({ nights: 2 });
  });
});
