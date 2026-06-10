/**
 * Application-wide IndexedDB wrapper (`oscar_app`).
 *
 * Owns the single physical database shared by:
 * - CPAP session persistence (`sessions` store, via `utils/db.js`)
 * - The wearable-export era stores (`wearable_nights`, `wearable_intraday`,
 *   `wearable_meta`)
 *
 * **Schema v4** drops the legacy Fitbit OAuth/API era stores
 * (`fitbit_tokens`, `fitbit_data`, `sync_metadata`) that the removed OAuth
 * integration used. CPAP `sessions` are preserved; any prior Fitbit sync data
 * is abandoned (the canonical source is now the local export folder, which the
 * user re-ingests).
 *
 * @module utils/appDb
 */

const DB_NAME = 'oscar_app';
const DB_VERSION = 4; // v3 -> v4: drop legacy fitbit stores
const SESSIONS_STORE = 'sessions'; // Existing store (CPAP)
// Legacy Fitbit OAuth/API era stores (dropped at v4).
const LEGACY_FITBIT_STORES = ['fitbit_tokens', 'fitbit_data', 'sync_metadata'];
// Wearable-export era stores.
const WEARABLE_NIGHTS_STORE = 'wearable_nights';
const WEARABLE_INTRADAY_STORE = 'wearable_intraday';
const WEARABLE_META_STORE = 'wearable_meta';

/**
 * Opens the shared application IndexedDB, creating/upgrading stores as needed.
 *
 * The `onupgradeneeded` handler is idempotent across `oldVersion` ∈ {0, 1, 2, 3}:
 * - `sessions` (CPAP) is created if absent on every upgrade path, so a fresh
 *   install (`oldVersion === 0`) still gets it, and its records survive the
 *   upgrade (we never delete the sessions store).
 * - The three wearable stores are created if absent.
 * - The three legacy Fitbit stores are dropped if present (v4). A fresh install
 *   never references them.
 *
 * @returns {Promise<IDBDatabase|null>} Database connection or null if unavailable
 */
export function openAppDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      console.warn('IndexedDB not available - persistence disabled');
      return resolve(null);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Preserve/create the sessions store (CPAP). Runs on every oldVersion
      // (incl. 0) so a fresh install still creates it; never dropped, so
      // existing CPAP sessions survive the v4 upgrade.
      if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
        db.createObjectStore(SESSIONS_STORE);
      }

      // Create the wearable-export stores if absent.

      // Nightly rollups, one record per night, keyed by `nightDate`
      // (YYYY-MM-DD). Range queries via IDBKeyRange.bound on the key.
      if (!db.objectStoreNames.contains(WEARABLE_NIGHTS_STORE)) {
        db.createObjectStore(WEARABLE_NIGHTS_STORE, { keyPath: 'nightDate' });
      }

      // Optional per-night intraday arrays, compound-keyed by
      // [nightDate, metric]; lazy-loaded for the night drill-down only.
      if (!db.objectStoreNames.contains(WEARABLE_INTRADAY_STORE)) {
        db.createObjectStore(WEARABLE_INTRADAY_STORE, {
          keyPath: ['nightDate', 'metric'],
        });
      }

      // Ingest metadata (dirHandle, lastImport, per-metric high-water marks,
      // schema/app version, source counts), keyed by `key`.
      if (!db.objectStoreNames.contains(WEARABLE_META_STORE)) {
        db.createObjectStore(WEARABLE_META_STORE, { keyPath: 'key' });
      }

      // Drop the legacy Fitbit OAuth/API era stores if present (v4). Guarded by
      // `contains(...)` so a fresh install (oldVersion === 0) is a no-op here.
      for (const store of LEGACY_FITBIT_STORES) {
        if (db.objectStoreNames.contains(store)) {
          db.deleteObjectStore(store);
        }
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/* ===========================================================================
 * Wearable-export stores — batched writes, range reads, lazy intraday,
 * key/value metadata. See perf-storage design rev2 §2.3a / §3.
 * =========================================================================== */

/**
 * Batched write primitive (perf §2.3a). Issues all `put`s within ONE
 * `readwrite` transaction spanning both wearable stores and resolves on
 * `transaction.oncomplete` (the commit) — never per-request. Typed-array
 * (ArrayBuffer) values are stored via structured clone (no JSON.stringify).
 *
 * @param {IDBDatabase} db - An open `oscar_app` connection.
 * @param {Array<{store: 'wearable_nights'|'wearable_intraday', value: object}>} items
 * @returns {Promise<number>} Number of items committed.
 */
export function putBatch(db, items) {
  return new Promise((resolve, reject) => {
    if (!db) return resolve(0);
    if (!Array.isArray(items) || items.length === 0) return resolve(0);
    let tx;
    try {
      tx = db.transaction(
        [WEARABLE_NIGHTS_STORE, WEARABLE_INTRADAY_STORE],
        'readwrite',
      );
    } catch (err) {
      return reject(err);
    }
    tx.oncomplete = () => resolve(items.length); // resolve on COMMIT
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('putBatch aborted'));
    const stores = {
      [WEARABLE_NIGHTS_STORE]: tx.objectStore(WEARABLE_NIGHTS_STORE),
      [WEARABLE_INTRADAY_STORE]: tx.objectStore(WEARABLE_INTRADAY_STORE),
    };
    for (const { store, value } of items) {
      const target = stores[store];
      if (target) target.put(value);
    }
  });
}

/**
 * Load nightly rollups within an inclusive `YYYY-MM-DD` date range via the
 * native `nightDate` keyPath (perf §3.2). Returns date-ascending records.
 *
 * @param {IDBDatabase} db - An open connection.
 * @param {string} [startDate] - Inclusive lower bound (`YYYY-MM-DD`).
 * @param {string} [endDate] - Inclusive upper bound (`YYYY-MM-DD`).
 * @returns {Promise<object[]>} Nightly rollup records.
 */
export function getWearableNightsInRange(db, startDate, endDate) {
  return new Promise((resolve, reject) => {
    if (!db) return resolve([]);
    const KeyRange = globalThis.IDBKeyRange;
    let range = null;
    if (KeyRange) {
      if (startDate && endDate) range = KeyRange.bound(startDate, endDate);
      else if (startDate) range = KeyRange.lowerBound(startDate);
      else if (endDate) range = KeyRange.upperBound(endDate);
    }
    const tx = db.transaction(WEARABLE_NIGHTS_STORE, 'readonly');
    const req = tx.objectStore(WEARABLE_NIGHTS_STORE).getAll(range);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Lazily fetch one night's intraday typed-array for one metric (perf §3.3).
 *
 * @param {IDBDatabase} db - An open connection.
 * @param {string} nightDate - `YYYY-MM-DD`.
 * @param {string} metric - `'hr'|'spo2'|'hrv'|'snore'|...`.
 * @returns {Promise<object|null>} The intraday record or `null` if absent.
 */
export function getWearableIntraday(db, nightDate, metric) {
  return new Promise((resolve, reject) => {
    if (!db) return resolve(null);
    const tx = db.transaction(WEARABLE_INTRADAY_STORE, 'readonly');
    const req = tx
      .objectStore(WEARABLE_INTRADAY_STORE)
      .get([nightDate, metric]);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Read a `wearable_meta` value by key (perf §3.4 — `lastIngestedDate`, `files`,
 * `dirHandle`, `cursor`, `ranges`, `stats`).
 *
 * @param {IDBDatabase} db - An open connection.
 * @param {string} key - Metadata key.
 * @returns {Promise<*>} The stored value, or `null`.
 */
export function getWearableMeta(db, key) {
  return new Promise((resolve, reject) => {
    if (!db) return resolve(null);
    const tx = db.transaction(WEARABLE_META_STORE, 'readonly');
    const req = tx.objectStore(WEARABLE_META_STORE).get(key);
    req.onsuccess = () => resolve(req.result ? req.result.value : null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Write a `wearable_meta` value by key.
 *
 * @param {IDBDatabase} db - An open connection.
 * @param {string} key - Metadata key.
 * @param {*} value - Structured-cloneable value (incl. a `FileSystemDirectoryHandle`).
 * @returns {Promise<boolean>} Resolves true on commit.
 */
export function setWearableMeta(db, key, value) {
  return new Promise((resolve, reject) => {
    if (!db) return resolve(false);
    const tx = db.transaction(WEARABLE_META_STORE, 'readwrite');
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
    tx.objectStore(WEARABLE_META_STORE).put({ key, value });
  });
}

/**
 * Clear all wearable-export data (nights, intraday, meta incl. the dir handle).
 * The "Forget folder" / wearable reset action.
 *
 * @param {IDBDatabase} db - An open connection.
 * @returns {Promise<boolean>} Resolves true on commit.
 */
export function clearWearableData(db) {
  return new Promise((resolve, reject) => {
    if (!db) return resolve(false);
    const tx = db.transaction(
      [WEARABLE_NIGHTS_STORE, WEARABLE_INTRADAY_STORE, WEARABLE_META_STORE],
      'readwrite',
    );
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
    tx.objectStore(WEARABLE_NIGHTS_STORE).clear();
    tx.objectStore(WEARABLE_INTRADAY_STORE).clear();
    tx.objectStore(WEARABLE_META_STORE).clear();
  });
}
