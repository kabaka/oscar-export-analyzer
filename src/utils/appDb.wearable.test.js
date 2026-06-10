/**
 * Wearable store accessor tests for appDb (perf §2.3a/§3): putBatch, range
 * reads, lazy intraday, key/value meta, and clearWearableData.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import {
  openAppDb,
  putBatch,
  getWearableNightsInRange,
  getWearableIntraday,
  getWearableMeta,
  setWearableMeta,
  clearWearableData,
} from './appDb.js';

describe('appDb wearable accessors', () => {
  let originalIdb;
  let originalKeyRange;
  let db;

  beforeEach(async () => {
    originalIdb = globalThis.indexedDB;
    originalKeyRange = globalThis.IDBKeyRange;
    globalThis.indexedDB = new IDBFactory();
    globalThis.IDBKeyRange = IDBKeyRange;
    db = await openAppDb();
  });
  afterEach(() => {
    db?.close();
    globalThis.indexedDB = originalIdb;
    globalThis.IDBKeyRange = originalKeyRange;
  });

  it('putBatch commits N items across both wearable stores in one tx', async () => {
    const committed = await putBatch(db, [
      { store: 'wearable_nights', value: { nightDate: '2024-02-22', x: 1 } },
      {
        store: 'wearable_intraday',
        value: {
          nightDate: '2024-02-22',
          metric: 'spo2',
          values: new Int16Array([95]),
        },
      },
    ]);
    expect(committed).toBe(2);
    const nights = await getWearableNightsInRange(db);
    expect(nights).toHaveLength(1);
  });

  it('putBatch resolves 0 on an empty batch', async () => {
    expect(await putBatch(db, [])).toBe(0);
  });

  it('getWearableNightsInRange returns date-ascending records within bounds', async () => {
    await putBatch(db, [
      { store: 'wearable_nights', value: { nightDate: '2024-02-22' } },
      { store: 'wearable_nights', value: { nightDate: '2024-02-20' } },
      { store: 'wearable_nights', value: { nightDate: '2024-03-10' } },
    ]);
    const inRange = await getWearableNightsInRange(
      db,
      '2024-02-01',
      '2024-02-28',
    );
    expect(inRange.map((n) => n.nightDate)).toEqual([
      '2024-02-20',
      '2024-02-22',
    ]);
  });

  it('getWearableIntraday fetches one [nightDate, metric] record', async () => {
    await putBatch(db, [
      {
        store: 'wearable_intraday',
        value: {
          nightDate: '2024-02-22',
          metric: 'hr',
          values: new Int16Array([55, 56]),
        },
      },
    ]);
    const rec = await getWearableIntraday(db, '2024-02-22', 'hr');
    expect(Array.from(rec.values)).toEqual([55, 56]);
    expect(await getWearableIntraday(db, '2024-02-22', 'spo2')).toBeNull();
  });

  it('set/getWearableMeta round-trips key/value metadata', async () => {
    await setWearableMeta(db, 'lastIngestedDate', { hr: '2024-02-22' });
    expect(await getWearableMeta(db, 'lastIngestedDate')).toEqual({
      hr: '2024-02-22',
    });
    expect(await getWearableMeta(db, 'missing')).toBeNull();
  });

  it('clearWearableData empties all three wearable stores', async () => {
    await putBatch(db, [
      { store: 'wearable_nights', value: { nightDate: '2024-02-22' } },
    ]);
    await setWearableMeta(db, 'stats', { nights: 1 });
    await clearWearableData(db);
    expect(await getWearableNightsInRange(db)).toHaveLength(0);
    expect(await getWearableMeta(db, 'stats')).toBeNull();
  });
});
