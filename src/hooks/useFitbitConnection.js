/**
 * React hook for managing Fitbit connection state and data operations.
 *
 * Provides high-level interface for:
 * - Connection status monitoring
 * - Token management and refresh
 * - Data synchronization
 * - Storage and encryption handling
 *
 * @module hooks/useFitbitConnection
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { fitbitApiClient } from '../utils/fitbitApi.js';
import { fitbitOAuth } from '../utils/fitbitAuth.js';
import {
  getFitbitDataStats,
  setSyncMetadata,
  getSyncMetadata,
} from '../utils/fitbitDb.js';
import { CONNECTION_STATUS } from '../constants/fitbit.js';
import { FITBIT_ERRORS } from '../constants/fitbitErrors.js';
import { parseSyncResults } from '../utils/fitbitHeartRateParser.js';

/**
 * Connection management hook.
 *
 * @param {Object} options - Hook configuration
 * @param {string} options.passphrase - User encryption passphrase
 * @param {boolean} options.autoCheck - Auto-check connection on mount
 * @param {Object} [options.oscarDateRange] - Date range from OSCAR data
 * @param {string} [options.oscarDateRange.start] - Start date (YYYY-MM-DD)
 * @param {string} [options.oscarDateRange.end] - End date (YYYY-MM-DD)
 * @returns {Object} Connection state and methods
 */
export function useFitbitConnection({
  passphrase = null,
  autoCheck = true,
  oscarDateRange = null,
} = {}) {
  const [status, setStatus] = useState(CONNECTION_STATUS.DISCONNECTED);
  const [error, setError] = useState(null);
  const [connectionInfo, setConnectionInfo] = useState(null);
  const [dataStats, setDataStats] = useState(null);
  const [syncedData, setSyncedData] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const passphraseRef = useRef(passphrase);
  const checkTimeoutRef = useRef(null);

  // Update passphrase ref when prop changes
  useEffect(() => {
    passphraseRef.current = passphrase;
    if (passphrase) {
      fitbitApiClient.setPassphrase(passphrase);
    }
  }, [passphrase]);

  /**
   * Clear error state.
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Update data statistics from stored data.
   */
  const updateDataStats = useCallback(async () => {
    try {
      const stats = await getFitbitDataStats();
      setDataStats(stats);
    } catch (err) {
      console.error('Failed to update data stats:', err);
    }
  }, []);

  /**
   * Check connection status and update state.
   */
  const checkConnection = useCallback(async () => {
    try {
      const currentPassphrase = passphraseRef.current;
      if (!currentPassphrase) {
        setStatus(CONNECTION_STATUS.DISCONNECTED);
        setConnectionInfo(null);
        return false;
      }

      setError(null);

      // Check if authenticated
      const isAuthenticated =
        await fitbitOAuth.isAuthenticated(currentPassphrase);

      if (isAuthenticated) {
        setStatus(CONNECTION_STATUS.CONNECTED);

        // Get connection info
        try {
          const tokenManager = fitbitOAuth.getTokenManager();
          const tokens = await tokenManager.getStoredTokens(currentPassphrase);

          if (tokens) {
            setConnectionInfo({
              connectedAt: tokens.created_at || Date.now(),
              expiresAt: tokens.expires_at,
              scope: tokens.scope,
              timeToExpiry: Math.max(0, tokens.expires_at - Date.now()),
            });
          }
        } catch (infoError) {
          console.warn('Failed to get connection info:', infoError);
        }

        // Update data stats and sync metadata
        await updateDataStats();

        const lastSyncTime = await getSyncMetadata('last_sync_time');
        setLastSync(lastSyncTime);

        return true;
      } else {
        setStatus(CONNECTION_STATUS.DISCONNECTED);
        setConnectionInfo(null);
        setDataStats(null);
        setLastSync(null);
        return false;
      }
    } catch (err) {
      console.error('Connection check failed:', err);
      setError({
        code: FITBIT_ERRORS.API_ERROR.code || 'api_error',
        type: 'api',
        message:
          FITBIT_ERRORS.API_ERROR.message ||
          'Failed to check connection status',
        details: err.message,
      });
      setStatus(CONNECTION_STATUS.ERROR);
      return false;
    }
  }, [updateDataStats]);

  /**
   * Refresh access token manually.
   */
  const refreshToken = useCallback(async () => {
    try {
      const currentPassphrase = passphraseRef.current;
      if (!currentPassphrase) {
        throw new Error('Passphrase required for token refresh');
      }

      setIsRefreshing(true);
      setError(null);

      const tokenManager = fitbitOAuth.getTokenManager();
      const newToken = await tokenManager.refreshAccessToken(currentPassphrase);

      if (newToken) {
        await checkConnection(); // Update connection info
        return true;
      } else {
        throw new Error('Token refresh returned null');
      }
    } catch (err) {
      console.error('Token refresh failed:', err);
      setError({
        code: FITBIT_ERRORS.TOKEN_EXPIRED.code || 'token_expired',
        type: 'token',
        message:
          FITBIT_ERRORS.TOKEN_EXPIRED.message ||
          'Failed to refresh access token',
        details: err.message,
      });

      // If refresh fails, user might need to re-authenticate
      setStatus(CONNECTION_STATUS.TOKEN_EXPIRED);
      return false;
    } finally {
      setIsRefreshing(false);
    }
  }, [checkConnection]);

  /**
   * Sync data from Fitbit API.
   *
   * Date range priority:
   *   1. Explicit startDate/endDate parameters
   *   2. oscarDateRange from OSCAR data
   *   3. Fall back to last 30 days
   *
   * @param {Object} params - Sync parameters
   * @param {Date|string} params.startDate - Start date for sync
   * @param {Date|string} params.endDate - End date for sync
   * @param {Array} params.dataTypes - Data types to sync
   * @param {Function} params.onProgress - Progress callback
   * @returns {Promise<Object>} Sync results
   */
  const syncData = useCallback(
    async ({
      startDate,
      endDate,
      dataTypes = ['heartRate', 'spo2'],
      onProgress,
    } = {}) => {
      try {
        // Date range priority: explicit params > oscarDateRange > last 30 days
        let syncStartDate = startDate;
        let syncEndDate = endDate;

        if (!syncStartDate || !syncEndDate) {
          if (oscarDateRange?.start && oscarDateRange?.end) {
            syncStartDate = syncStartDate || oscarDateRange.start;
            syncEndDate = syncEndDate || oscarDateRange.end;
          } else {
            syncEndDate = syncEndDate || new Date().toISOString().split('T')[0];
            syncStartDate =
              syncStartDate ||
              (() => {
                const d = new Date();
                d.setDate(d.getDate() - 30);
                return d.toISOString().split('T')[0];
              })();
          }
        }

        const currentPassphrase = passphraseRef.current;
        if (!currentPassphrase) {
          throw new Error('Passphrase required for data sync');
        }

        if (status !== CONNECTION_STATUS.CONNECTED) {
          throw new Error('Not connected to Fitbit');
        }

        setError(null);

        // Ensure API client has current passphrase
        fitbitApiClient.setPassphrase(currentPassphrase);

        // Perform batch sync
        const results = await fitbitApiClient.batchSync({
          startDate: syncStartDate,
          endDate: syncEndDate,
          dataTypes,
          onProgress,
        });

        // Parse and store synced data in React state
        const parsed = parseSyncResults(results);
        setSyncedData(parsed);

        // Update sync metadata
        await setSyncMetadata('last_sync_time', Date.now());
        await setSyncMetadata('last_sync_range', [syncStartDate, syncEndDate]);
        await setSyncMetadata('last_sync_types', dataTypes);

        // Update local state
        await updateDataStats();
        setLastSync(Date.now());

        return results;
      } catch (err) {
        console.error('Data sync failed:', err);
        setError({
          code: FITBIT_ERRORS.API_ERROR.code || 'api_error',
          type: 'api',
          message:
            FITBIT_ERRORS.API_ERROR.message ||
            'Failed to sync data from Fitbit',
          details: err.message,
        });
        throw err;
      }
    },
    [status, updateDataStats, oscarDateRange],
  );

  /**
   * Disconnect and clear all data.
   */
  const disconnect = useCallback(async () => {
    try {
      const currentPassphrase = passphraseRef.current;
      if (!currentPassphrase) {
        throw new Error('Passphrase required for disconnect');
      }

      setError(null);

      const tokenManager = fitbitOAuth.getTokenManager();
      const success = await tokenManager.revokeTokens(currentPassphrase);

      if (success) {
        setStatus(CONNECTION_STATUS.DISCONNECTED);
        setConnectionInfo(null);
        setDataStats(null);
        setLastSync(null);
      }

      return success;
    } catch (err) {
      console.error('Disconnect failed:', err);
      setError({
        code: FITBIT_ERRORS.API_ERROR.code || 'api_error',
        type: 'api',
        message:
          FITBIT_ERRORS.API_ERROR.message || 'Failed to disconnect from Fitbit',
        details: err.message,
      });
      return false;
    }
  }, []);

  /**
   * Get user profile from Fitbit.
   */
  const getUserProfile = useCallback(async () => {
    try {
      const currentPassphrase = passphraseRef.current;
      if (!currentPassphrase) {
        throw new Error('Passphrase required');
      }

      if (status !== CONNECTION_STATUS.CONNECTED) {
        throw new Error('Not connected to Fitbit');
      }

      fitbitApiClient.setPassphrase(currentPassphrase);
      return await fitbitApiClient.getUserProfile();
    } catch (err) {
      console.error('Failed to get user profile:', err);
      throw err;
    }
  }, [status]);

  // Auto-check connection on mount and passphrase change
  useEffect(() => {
    // On mount or passphrase change, check connection if:
    // - autoCheck is true AND (passphrase is present OR tokens are present in IndexedDB)
    let cancelled = false;
    async function checkIfTokens() {
      if (autoCheck) {
        let shouldCheck = !!passphrase && passphrase.length >= 8;
        if (!shouldCheck) {
          // Check if tokens exist in IndexedDB (fitbit_tokens.current)
          try {
            const db = await window.indexedDB.open('fitbit_tokens');
            if (db.result && db.result.objectStoreNames.contains('current')) {
              const tx = db.result.transaction('current', 'readonly');
              const store = tx.objectStore('current');
              const req = store.get('access_token');
              req.onsuccess = function () {
                if (req.result && !cancelled) {
                  checkConnection();
                }
              };
            }
          } catch {
            // Ignore errors, fallback to normal flow
          }
        } else {
          checkConnection();
        }
      }
    }
    checkIfTokens();
    const timeout = checkTimeoutRef.current;
    return () => {
      cancelled = true;
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [passphrase, autoCheck, checkConnection]);

  // Cleanup on unmount
  useEffect(() => {
    const timeout = checkTimeoutRef.current;
    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, []);

  return {
    // State
    status,
    error,
    connectionInfo,
    dataStats,
    syncedData,
    lastSync,
    isRefreshing,

    // Computed state
    isConnected: status === CONNECTION_STATUS.CONNECTED,
    isDisconnected: status === CONNECTION_STATUS.DISCONNECTED,
    hasError: status === CONNECTION_STATUS.ERROR,
    isTokenExpired: status === CONNECTION_STATUS.TOKEN_EXPIRED,

    // Sync state for FitbitDashboard compatibility
    syncState: {
      status: status === CONNECTION_STATUS.CONNECTED ? 'idle' : 'disconnected',
      lastSync: lastSync,
      nextAutoSync: null, // TODO: implement auto-sync scheduling
      autoSyncEnabled: false, // TODO: implement auto-sync toggle
      dataMetrics: (() => {
        const hr = syncedData?.heartRateData || [];
        const sp = syncedData?.spo2Data || [];
        const sl = syncedData?.sleepData || [];
        return {
          heartRate: {
            nights: hr.length,
            lastDate:
              hr.length > 0
                ? new Date(
                    hr[hr.length - 1]?.date || hr[hr.length - 1]?.dateTime,
                  )
                : new Date(),
          },
          sleepStages: {
            nights: sl.length,
            lastDate:
              sl.length > 0
                ? new Date(
                    sl[sl.length - 1]?.date || sl[sl.length - 1]?.dateTime,
                  )
                : new Date(),
          },
          spO2: {
            nights: sp.length,
            lastDate:
              sp.length > 0
                ? new Date(
                    sp[sp.length - 1]?.date || sp[sp.length - 1]?.dateTime,
                  )
                : new Date(),
          },
        };
      })(),
      recentActivity: [], // TODO: implement activity tracking
      errorMessage: error?.message || null,
    },

    // Fitbit data: synced heart rate data takes precedence, falls back to IndexedDB stats
    fitbitData: syncedData || dataStats,

    // Actions
    checkConnection,
    refreshToken,
    syncData,
    syncFitbitData: syncData, // Alias for backward compatibility
    disconnect,
    getUserProfile,
    updateDataStats,
    clearError,
    clearFitbitData: disconnect, // Alias for backward compatibility
  };
}
