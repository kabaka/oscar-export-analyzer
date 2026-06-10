import { useCallback, useEffect, useRef, useState } from 'react';
import {
  openAppDb,
  getWearableNightsInRange,
  getWearableIntraday,
} from '../utils/appDb.js';

/**
 * Reads persisted wearable nightly rollups from IndexedDB by date range, and
 * lazily fetches per-night intraday typed arrays for the drill-down
 * (integration §3.1). It does NOT touch raw export files — only the aggregated
 * stores the ingest worker wrote (`wearable_nights`, `wearable_intraday`).
 *
 * The nightly rollups (`nights`) are the contract Phase 4's dashboard/correlation
 * consume directly (one record per night, keyed by `nightDate === dateOfSleep`).
 * `getNightDetail(date, metric)` is the lazy heavy-array loader for
 * `NightDetailView` so all minute data is never resident at once.
 *
 * @param {object} [args]
 * @param {string|null} [args.start] - Inclusive `YYYY-MM-DD` lower bound.
 * @param {string|null} [args.end] - Inclusive `YYYY-MM-DD` upper bound.
 * @returns {{ nights: object[], loading: boolean, error: string|null,
 *   reload: () => void, getNightDetail: (date: string, metric: string) => Promise<object|null> }}
 */
export function useWearableData({ start = null, end = null } = {}) {
  const [nights, setNights] = useState([]);
  // Start in the loading state: the initial range query is kicked off by the
  // mount effect, so consumers should treat the first render as "loading".
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reqIdRef = useRef(0);

  const load = useCallback(async () => {
    const reqId = ++reqIdRef.current;
    // Yield a microtask first so the synchronous setState is not called
    // directly within the effect body (avoids cascading-render lint/runtime).
    await Promise.resolve();
    if (reqId !== reqIdRef.current) return;
    setLoading(true);
    setError(null);
    try {
      const db = await openAppDb();
      if (!db) {
        if (reqId === reqIdRef.current) {
          setNights([]);
          setLoading(false);
        }
        return;
      }
      const rows = await getWearableNightsInRange(db, start, end);
      db.close();
      // Ignore stale responses if a newer load started.
      if (reqId !== reqIdRef.current) return;
      setNights(rows);
      setLoading(false);
    } catch {
      if (reqId !== reqIdRef.current) return;
      setError('Could not load wearable data.');
      setNights([]);
      setLoading(false);
    }
  }, [start, end]);

  useEffect(() => {
    // `load` awaits a microtask before any setState, so the state update is
    // deferred (not synchronous within the effect body); the static rule can't
    // see the runtime `await` boundary.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setState is deferred past an await in load()
    load();
  }, [load]);

  /** Lazily fetch one night's intraday typed array for one metric. */
  const getNightDetail = useCallback(async (date, metric) => {
    if (!date || !metric) return null;
    try {
      const db = await openAppDb();
      if (!db) return null;
      const rec = await getWearableIntraday(db, date, metric);
      db.close();
      return rec;
    } catch {
      return null;
    }
  }, []);

  return { nights, loading, error, reload: load, getNightDetail };
}
