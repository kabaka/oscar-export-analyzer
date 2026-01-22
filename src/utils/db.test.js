import { describe, it, expect, beforeEach, vi } from 'vitest';
import { putLastSession, getLastSession, clearLastSession } from './db';

describe('db.js - IndexedDB wrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('putLastSession', () => {
    it('returns false when IndexedDB is unavailable', async () => {
      const origIndexedDB = globalThis.indexedDB;
      delete globalThis.indexedDB;

      const result = await putLastSession({ data: 'test' });
      expect(result).toBe(false);

      globalThis.indexedDB = origIndexedDB;
    });

    it('handles async operations gracefully', async () => {
      // Test that function is properly async
      const promise = putLastSession({ data: 'test' });
      expect(promise).toBeInstanceOf(Promise);
    });
  });

  describe('getLastSession', () => {
    it('returns null when IndexedDB is unavailable', async () => {
      const origIndexedDB = globalThis.indexedDB;
      delete globalThis.indexedDB;

      const result = await getLastSession();
      expect(result).toBeNull();

      globalThis.indexedDB = origIndexedDB;
    });

    it('handles async operations gracefully', async () => {
      // Test that function is properly async
      const promise = getLastSession();
      expect(promise).toBeInstanceOf(Promise);
    });
  });

  describe('clearLastSession', () => {
    it('returns false when IndexedDB is unavailable', async () => {
      const origIndexedDB = globalThis.indexedDB;
      delete globalThis.indexedDB;

      const result = await clearLastSession();
      expect(result).toBe(false);

      globalThis.indexedDB = origIndexedDB;
    });

    it('handles async operations gracefully', async () => {
      // Test that function is properly async
      const promise = clearLastSession();
      expect(promise).toBeInstanceOf(Promise);
    });
  });

  describe('Function exports', () => {
    it('exports putLastSession as a function', () => {
      expect(typeof putLastSession).toBe('function');
    });

    it('exports getLastSession as a function', () => {
      expect(typeof getLastSession).toBe('function');
    });

    it('exports clearLastSession as a function', () => {
      expect(typeof clearLastSession).toBe('function');
    });
  });

  describe('Type contracts', () => {
    it('putLastSession accepts session objects', async () => {
      const testSession = {
        summaryData: [{ Date: '2024-01-01' }],
        detailsData: [],
      };

      const origIndexedDB = globalThis.indexedDB;
      delete globalThis.indexedDB;

      const result = await putLastSession(testSession);
      expect(typeof result).toBe('boolean');

      globalThis.indexedDB = origIndexedDB;
    });

    it('getLastSession returns Promise that resolves to object or null', async () => {
      const origIndexedDB = globalThis.indexedDB;
      delete globalThis.indexedDB;

      const result = await getLastSession();
      expect(result === null || typeof result === 'object').toBe(true);

      globalThis.indexedDB = origIndexedDB;
    });

    it('clearLastSession returns Promise resolving to boolean', async () => {
      const origIndexedDB = globalThis.indexedDB;
      delete globalThis.indexedDB;

      const result = await clearLastSession();
      expect(typeof result).toBe('boolean');

      globalThis.indexedDB = origIndexedDB;
    });
  });

  describe('Database unavailable scenarios', () => {
    it('gracefully handles IndexedDB not available in all functions', async () => {
      const origIndexedDB = globalThis.indexedDB;
      delete globalThis.indexedDB;

      const putResult = await putLastSession({});
      const getResult = await getLastSession();
      const clearResult = await clearLastSession();

      expect(putResult).toBe(false);
      expect(getResult).toBeNull();
      expect(clearResult).toBe(false);

      globalThis.indexedDB = origIndexedDB;
    });
  });

  describe('Error resilience', () => {
    it('functions can be called sequentially without errors', async () => {
      const origIndexedDB = globalThis.indexedDB;
      delete globalThis.indexedDB;

      const p1 = putLastSession({ id: 1 });
      const p2 = getLastSession();
      const p3 = clearLastSession();

      const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

      expect(typeof r1).toBe('boolean');
      expect(r2 === null || typeof r2 === 'object').toBe(true);
      expect(typeof r3).toBe('boolean');

      globalThis.indexedDB = origIndexedDB;
    });
  });
});
