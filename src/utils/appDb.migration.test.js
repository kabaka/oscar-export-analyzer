/**
 * Migration tests for the shared application IndexedDB (`oscar_app`).
 *
 * Covers the v4 upgrade (integration/UX §4.2, §6 atomic OAuth removal) that
 * DROPS the legacy Fitbit OAuth/API era stores:
 * - **v3 -> v4:** an existing v3 DB with a `sessions` record and a
 *   `fitbit_tokens` record upgrades to v4; the `sessions` record SURVIVES, the
 *   three legacy Fitbit stores are GONE, and the three wearable stores exist.
 * - **fresh install (`oldVersion === 0`):** opening v4 with no prior DB creates
 *   `sessions` + the three wearable stores and references NO Fitbit store.
 *
 * Together these confirm the `onupgradeneeded` handler is idempotent across
 * `oldVersion` ∈ {0, 3}.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { openAppDb } from './appDb.js';

const DB_NAME = 'oscar_app';

const WEARABLE_STORES = [
  'wearable_nights',
  'wearable_intraday',
  'wearable_meta',
];
const LEGACY_FITBIT_STORES = ['fitbit_tokens', 'fitbit_data', 'sync_metadata'];

/** Promisify an IDBOpenDBRequest, optionally running an upgrade callback. */
function openWithUpgrade(version, onUpgrade) {
  return new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(DB_NAME, version);
    if (onUpgrade) {
      request.onupgradeneeded = (event) => onUpgrade(event.target.result);
    }
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('blocked'));
  });
}

/** Put a value into a store and resolve when the transaction commits. */
function putValue(db, store, value, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    if (key === undefined) {
      tx.objectStore(store).put(value);
    } else {
      tx.objectStore(store).put(value, key);
    }
  });
}

/** Get a value from a store. */
function getValue(db, store, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Build a v3-shaped DB matching the pre-v4 schema: `sessions`, the three legacy
 * Fitbit stores, and the three wearable stores (v3 was additive).
 */
function createV3Db() {
  return openWithUpgrade(3, (db) => {
    db.createObjectStore('sessions');
    const tokenStore = db.createObjectStore('fitbit_tokens', {
      keyPath: 'id',
    });
    tokenStore.createIndex('expires_at', 'metadata.expires_at', {
      unique: false,
    });
    tokenStore.createIndex('created_at', 'metadata.created_at', {
      unique: false,
    });
    const dataStore = db.createObjectStore('fitbit_data', {
      keyPath: 'id',
      autoIncrement: true,
    });
    dataStore.createIndex('data_source', 'data_source', { unique: false });
    dataStore.createIndex('date_range', 'date_range', { unique: false });
    dataStore.createIndex('created_at', 'created_at', { unique: false });
    const syncStore = db.createObjectStore('sync_metadata', {
      keyPath: 'key',
    });
    syncStore.createIndex('last_sync', 'last_sync', { unique: false });
    db.createObjectStore('wearable_nights', { keyPath: 'nightDate' });
    db.createObjectStore('wearable_intraday', {
      keyPath: ['nightDate', 'metric'],
    });
    db.createObjectStore('wearable_meta', { keyPath: 'key' });
  });
}

describe('appDb migration (oscar_app v3 -> v4)', () => {
  let originalIndexedDB;

  beforeEach(() => {
    // Isolate each test with a fresh in-memory IndexedDB.
    originalIndexedDB = globalThis.indexedDB;
    globalThis.indexedDB = new IDBFactory();
  });

  afterEach(() => {
    globalThis.indexedDB = originalIndexedDB;
  });

  describe('v3 -> v4 upgrade', () => {
    it('preserves the sessions record across the upgrade', async () => {
      const v3 = await createV3Db();
      const session = {
        summaryData: [{ Date: '2024-01-01' }],
        detailsData: [],
      };
      await putValue(v3, 'sessions', session, 'last');
      await putValue(v3, 'fitbit_tokens', { id: 'current', encrypted: [1, 2] });
      v3.close();

      const v4 = await openAppDb();
      expect(v4.version).toBe(4);

      const survived = await getValue(v4, 'sessions', 'last');
      expect(survived).toEqual(session);
      v4.close();
    });

    it('drops the three legacy Fitbit stores', async () => {
      const v3 = await createV3Db();
      v3.close();

      const v4 = await openAppDb();
      for (const store of LEGACY_FITBIT_STORES) {
        expect(v4.objectStoreNames.contains(store)).toBe(false);
      }
      v4.close();
    });

    it('keeps the three wearable stores', async () => {
      const v3 = await createV3Db();
      v3.close();

      const v4 = await openAppDb();
      for (const store of WEARABLE_STORES) {
        expect(v4.objectStoreNames.contains(store)).toBe(true);
      }
      v4.close();
    });

    it('preserves a wearable_nights record across the upgrade', async () => {
      const v3 = await createV3Db();
      const night = { nightDate: '2026-01-08', sleepEfficiency: 0.92 };
      await putValue(v3, 'wearable_nights', night);
      v3.close();

      const v4 = await openAppDb();
      const got = await getValue(v4, 'wearable_nights', '2026-01-08');
      expect(got).toEqual(night);
      v4.close();
    });
  });

  describe('fresh install (oldVersion === 0)', () => {
    it('creates sessions + the three wearable stores at v4', async () => {
      const db = await openAppDb();
      expect(db.version).toBe(4);
      expect(db.objectStoreNames.contains('sessions')).toBe(true);
      for (const store of WEARABLE_STORES) {
        expect(db.objectStoreNames.contains(store)).toBe(true);
      }
      db.close();
    });

    it('references no legacy Fitbit store on a fresh DB', async () => {
      const db = await openAppDb();
      for (const store of LEGACY_FITBIT_STORES) {
        expect(db.objectStoreNames.contains(store)).toBe(false);
      }
      db.close();
    });

    it('persists and reads back a CPAP session on a fresh DB', async () => {
      const db = await openAppDb();
      const session = { summaryData: [{ Date: '2026-06-10' }] };
      await putValue(db, 'sessions', session, 'last');
      const got = await getValue(db, 'sessions', 'last');
      expect(got).toEqual(session);
      db.close();
    });

    it('keys wearable_intraday on a compound [nightDate, metric] keyPath', async () => {
      const db = await openAppDb();
      const keyPath = db
        .transaction('wearable_intraday', 'readonly')
        .objectStore('wearable_intraday').keyPath;
      expect(keyPath).toEqual(['nightDate', 'metric']);
      db.close();
    });
  });

  describe('idempotency', () => {
    it('opening v4 twice does not error and keeps stores stable', async () => {
      const first = await openAppDb();
      const stores = Array.from(first.objectStoreNames).sort();
      first.close();

      const second = await openAppDb();
      expect(Array.from(second.objectStoreNames).sort()).toEqual(stores);
      second.close();
    });
  });
});
