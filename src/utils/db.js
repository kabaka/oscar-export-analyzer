// Minimal IndexedDB wrapper for saving the last session locally.
// Uses the shared Fitbit-aware DB initializer to keep schema versions in sync.
import { openFitbitDb } from './fitbitDb.js';

const STORE = 'sessions';

async function openDb() {
  return openFitbitDb();
}

export async function putLastSession(session) {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).put(session, 'last');
  });
}

export async function getLastSession() {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    tx.onerror = () => reject(tx.error);
    const req = tx.objectStore(STORE).get('last');
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function clearLastSession() {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).delete('last');
  });
}
