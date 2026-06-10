/* eslint-disable no-magic-numbers -- test fixtures */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { useWearableData } from './useWearableData';
import { openAppDb, putBatch } from '../utils/appDb.js';

/**
 * `useWearableData` reads persisted rollups by range and lazily loads intraday.
 * Drives `fake-indexeddb` directly — no worker, no real files.
 */
describe('useWearableData', () => {
  let originalIdb;
  let originalKeyRange;

  async function seed() {
    const db = await openAppDb();
    await putBatch(db, [
      {
        store: 'wearable_nights',
        value: { nightDate: '2024-02-20', sleep: { score: 80 } },
      },
      {
        store: 'wearable_nights',
        value: { nightDate: '2024-02-22', sleep: { score: 88 } },
      },
      {
        store: 'wearable_nights',
        value: { nightDate: '2024-03-05', sleep: { score: 70 } },
      },
      {
        store: 'wearable_intraday',
        value: {
          nightDate: '2024-02-22',
          metric: 'hr',
          cadenceSec: 60,
          t0Ms: 0,
          values: new Int16Array([55, 56, 57]),
        },
      },
    ]);
    db.close();
  }

  beforeEach(async () => {
    originalIdb = globalThis.indexedDB;
    originalKeyRange = globalThis.IDBKeyRange;
    globalThis.indexedDB = new IDBFactory();
    globalThis.IDBKeyRange = IDBKeyRange;
    await seed();
  });

  afterEach(() => {
    globalThis.indexedDB = originalIdb;
    globalThis.IDBKeyRange = originalKeyRange;
  });

  it('loads nights within an inclusive date range', async () => {
    const { result } = renderHook(() =>
      useWearableData({ start: '2024-02-01', end: '2024-02-28' }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.nights.map((n) => n.nightDate)).toEqual([
      '2024-02-20',
      '2024-02-22',
    ]);
    expect(result.current.error).toBeNull();
  });

  it('loads all nights when no bounds are given', async () => {
    const { result } = renderHook(() => useWearableData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.nights).toHaveLength(3);
  });

  it('lazily fetches one night/metric intraday array', async () => {
    const { result } = renderHook(() => useWearableData({}));
    await waitFor(() => expect(result.current.loading).toBe(false));
    let detail;
    await act(async () => {
      detail = await result.current.getNightDetail('2024-02-22', 'hr');
    });
    expect(detail.cadenceSec).toBe(60);
    expect(Array.from(detail.values)).toEqual([55, 56, 57]);
  });

  it('returns null for an absent night/metric', async () => {
    const { result } = renderHook(() => useWearableData({}));
    await waitFor(() => expect(result.current.loading).toBe(false));
    let detail;
    await act(async () => {
      detail = await result.current.getNightDetail('1999-01-01', 'hr');
    });
    expect(detail).toBeNull();
  });
});
