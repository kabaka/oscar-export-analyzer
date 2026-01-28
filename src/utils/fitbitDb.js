/**
 * Enhanced IndexedDB wrapper for Fitbit data and token storage.
 *
 * Extends the existing database pattern with new object stores for:
 * - Encrypted Fitbit authentication tokens
 * - Encrypted Fitbit health data
 * - Sync metadata and status
 *
 * Maintains separation from OSCAR CPAP data for security isolation.
 *
 * @module utils/fitbitDb
 */

const DB_NAME = 'oscar_app';
const DB_VERSION = 2; // Increment from existing version
const SESSIONS_STORE = 'sessions'; // Existing store
const FITBIT_TOKENS_STORE = 'fitbit_tokens';
const FITBIT_DATA_STORE = 'fitbit_data';
const SYNC_METADATA_STORE = 'sync_metadata';

/**
 * Opens enhanced IndexedDB with Fitbit object stores.
 * Handles database upgrades gracefully.
 *
 * @returns {Promise<IDBDatabase|null>} Database connection or null if unavailable
 */
export function openFitbitDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      console.warn('IndexedDB not available - persistence disabled');
      return resolve(null);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Preserve existing sessions store
      if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
        db.createObjectStore(SESSIONS_STORE);
      }

      // Create Fitbit token store (encrypted)
      if (!db.objectStoreNames.contains(FITBIT_TOKENS_STORE)) {
        const tokenStore = db.createObjectStore(FITBIT_TOKENS_STORE, {
          keyPath: 'id',
        });
        tokenStore.createIndex('expires_at', 'metadata.expires_at', {
          unique: false,
        });
        tokenStore.createIndex('created_at', 'metadata.created_at', {
          unique: false,
        });
      }

      // Create Fitbit data store (encrypted)
      if (!db.objectStoreNames.contains(FITBIT_DATA_STORE)) {
        const dataStore = db.createObjectStore(FITBIT_DATA_STORE, {
          keyPath: 'id',
          autoIncrement: true,
        });
        dataStore.createIndex('data_source', 'data_source', { unique: false });
        dataStore.createIndex('date_range', 'date_range', { unique: false });
        dataStore.createIndex('created_at', 'created_at', { unique: false });
      }

      // Create sync metadata store
      if (!db.objectStoreNames.contains(SYNC_METADATA_STORE)) {
        const syncStore = db.createObjectStore(SYNC_METADATA_STORE, {
          keyPath: 'key',
        });
        syncStore.createIndex('last_sync', 'last_sync', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Store encrypted Fitbit tokens securely.
 *
 * @param {Object} tokenData - Token data object
 * @param {string} tokenData.access_token - Access token
 * @param {string} tokenData.refresh_token - Refresh token
 * @param {number} tokenData.expires_in - Expires in seconds
 * @param {string} tokenData.scope - Granted scopes
 * @param {Uint8Array} encrypted - Encrypted token data
 * @param {Uint8Array} salt - Encryption salt
 * @param {Uint8Array} iv - Encryption IV
 * @returns {Promise<boolean>} Success status
 */
export async function storeTokens(tokenData, encrypted, salt, iv) {
  const db = await openFitbitDb();
  if (!db) return false;

  const record = {
    id: 'current',
    encrypted,
    salt,
    iv,
    metadata: {
      expires_at: Date.now() + tokenData.expires_in * 1000,
      created_at: Date.now(),
      scope: tokenData.scope,
    },
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(FITBIT_TOKENS_STORE, 'readwrite');
    const store = transaction.objectStore(FITBIT_TOKENS_STORE);

    const request = store.put(record);
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Retrieve encrypted token data.
 *
 * @returns {Promise<Object|null>} Encrypted token record or null
 */
export async function getTokens() {
  const db = await openFitbitDb();
  if (!db) return null;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(FITBIT_TOKENS_STORE, 'readonly');
    const store = transaction.objectStore(FITBIT_TOKENS_STORE);

    const request = store.get('current');
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Store encrypted Fitbit health data.
 *
 * @param {Object} params - Storage parameters
 * @param {string} params.dataSource - Data type ('heart_rate', 'sleep', 'spo2')
 * @param {Array} params.dateRange - [startDate, endDate] as ISO strings
 * @param {Uint8Array} params.encrypted - Encrypted data
 * @param {Uint8Array} params.salt - Encryption salt
 * @param {Uint8Array} params.iv - Encryption IV
 * @param {boolean} params.encryptionEnabled - Whether data is encrypted
 * @returns {Promise<number>} Record ID
 */
export async function storeFitbitData({
  dataSource,
  dateRange,
  encrypted,
  salt,
  iv,
  encryptionEnabled = true,
}) {
  const db = await openFitbitDb();
  if (!db) throw new Error('Database unavailable');

  const record = {
    data_source: dataSource,
    date_range: dateRange,
    created_at: Date.now(),
    encryption_enabled: encryptionEnabled,
  };

  if (encryptionEnabled) {
    record.encrypted = encrypted;
    record.salt = salt;
    record.iv = iv;
  } else {
    // For development/testing with unencrypted data
    record.data = encrypted; // Actually unencrypted in this case
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(FITBIT_DATA_STORE, 'readwrite');
    const store = transaction.objectStore(FITBIT_DATA_STORE);

    const request = store.add(record);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Retrieve Fitbit data by source and date range.
 *
 * @param {string} dataSource - Data type to retrieve
 * @param {Array} dateRange - Optional [startDate, endDate] filter
 * @returns {Promise<Array>} Array of encrypted data records
 */
export async function getFitbitData(dataSource, dateRange = null) {
  const db = await openFitbitDb();
  if (!db) return [];

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(FITBIT_DATA_STORE, 'readonly');
    const store = transaction.objectStore(FITBIT_DATA_STORE);
    const index = store.index('data_source');

    const request = index.getAll(dataSource);
    request.onsuccess = () => {
      let results = request.result || [];

      // Filter by date range if specified
      if (dateRange) {
        const [startDate, endDate] = dateRange;
        results = results.filter((record) => {
          const [recordStart, recordEnd] = record.date_range;
          return recordStart >= startDate && recordEnd <= endDate;
        });
      }

      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Store sync metadata (last sync times, status, etc.).
 *
 * @param {string} key - Metadata key
 * @param {Object} value - Metadata value
 * @returns {Promise<boolean>} Success status
 */
export async function setSyncMetadata(key, value) {
  const db = await openFitbitDb();
  if (!db) return false;

  const record = {
    key,
    value,
    last_sync: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SYNC_METADATA_STORE, 'readwrite');
    const store = transaction.objectStore(SYNC_METADATA_STORE);

    const request = store.put(record);
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Retrieve sync metadata.
 *
 * @param {string} key - Metadata key
 * @returns {Promise<Object|null>} Metadata value or null
 */
export async function getSyncMetadata(key) {
  const db = await openFitbitDb();
  if (!db) return null;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SYNC_METADATA_STORE, 'readonly');
    const store = transaction.objectStore(SYNC_METADATA_STORE);

    const request = store.get(key);
    request.onsuccess = () => {
      const result = request.result;
      resolve(result ? result.value : null);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear all Fitbit data securely.
 * Removes tokens, data, and metadata.
 *
 * @returns {Promise<boolean>} Success status
 */
export async function clearFitbitData() {
  const db = await openFitbitDb();
  if (!db) return false;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      [FITBIT_TOKENS_STORE, FITBIT_DATA_STORE, SYNC_METADATA_STORE],
      'readwrite',
    );

    let completed = 0;
    const total = 3;

    const checkCompletion = () => {
      completed++;
      if (completed === total) resolve(true);
    };

    transaction.onerror = () => reject(transaction.error);

    // Clear each store
    transaction.objectStore(FITBIT_TOKENS_STORE).clear().onsuccess =
      checkCompletion;
    transaction.objectStore(FITBIT_DATA_STORE).clear().onsuccess =
      checkCompletion;
    transaction.objectStore(SYNC_METADATA_STORE).clear().onsuccess =
      checkCompletion;
  });
}

/**
 * Get Fitbit data statistics for UI display.
 *
 * @returns {Promise<Object>} Stats object with counts and date ranges
 */
export async function getFitbitDataStats() {
  const db = await openFitbitDb();
  if (!db) return { totalRecords: 0, dataSources: [], dateRange: null };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(FITBIT_DATA_STORE, 'readonly');
    const store = transaction.objectStore(FITBIT_DATA_STORE);

    const request = store.getAll();
    request.onsuccess = () => {
      const records = request.result || [];

      const stats = {
        totalRecords: records.length,
        dataSources: [...new Set(records.map((r) => r.data_source))],
        dateRange: null,
      };

      if (records.length > 0) {
        const allDates = records.flatMap((r) => r.date_range);
        stats.dateRange = [
          Math.min(...allDates.map((d) => new Date(d).getTime())),
          Math.max(...allDates.map((d) => new Date(d).getTime())),
        ].map((timestamp) => new Date(timestamp).toISOString().split('T')[0]);
      }

      resolve(stats);
    };
    request.onerror = () => reject(request.error);
  });
}
