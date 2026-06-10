import { useCallback, useEffect, useRef, useState } from 'react';
import {
  openAppDb,
  getWearableMeta,
  setWearableMeta,
  clearWearableData,
} from '../utils/appDb.js';

/**
 * Orchestrates wearable-export ingestion (integration §3.1, perf §1.2/§2.5).
 *
 * Responsibilities:
 *   - **Capability gate** — `'showDirectoryPicker' in window` (Chromium-only v1).
 *   - **Directory pick** on a user gesture (`showDirectoryPicker({mode:'read'})`).
 *   - **Worker orchestration** — spawns `wearableIngest.worker.js`, consumes the
 *     `{ workerId, type }` protocol, coalesces progress into throttled state.
 *   - **Cancellation** — `AbortController` + `worker.terminate()` (mirrors
 *     `useCsvFiles.cancelTask`).
 *   - **Incremental re-import** — passes the per-metric `lastIngestedDate`
 *     high-water mark + `{relativePath,size}` identity set to the worker.
 *   - **Opt-in handle persistence** — stores the `FileSystemDirectoryHandle` in
 *     `wearable_meta` only when the caller opts in; restores via
 *     `queryPermission`/`requestPermission` behind a "Reconnect" gesture.
 *
 * Main-thread fallback note: v1 is Chromium/FSA-only by design; non-Chromium
 * browsers get `supported === false` and the UI renders an unsupported
 * empty-state (Phase 4). The ingest engine is also importable in-thread for
 * tests, but no production main-thread ingest path is shipped in v1.
 *
 * @returns {object} `{ supported, state, progress, detection, error, lastImport,
 *   pickDirectory, startIngest, scan, cancelIngest, reconnect, checkForNewData,
 *   forgetFolder }`.
 */
export function useWearableImport() {
  const supported =
    typeof window !== 'undefined' &&
    typeof window.showDirectoryPicker === 'function';

  const [state, setState] = useState('idle'); // see integration §1.2 state machine
  const [progress, setProgress] = useState(null);
  const [detection, setDetection] = useState(null);
  const [error, setError] = useState(null);
  const [lastImport, setLastImport] = useState(null);

  const handleRef = useRef(null);
  const workerRef = useRef(null);
  const workerIdRef = useRef(0);
  const abortRef = useRef(null);

  const nextWorkerId = useCallback(() => {
    workerIdRef.current += 1;
    return `wearable-ingest-${workerIdRef.current}`;
  }, []);

  const terminateWorker = useCallback(() => {
    if (workerRef.current) {
      try {
        workerRef.current.terminate();
      } catch {
        /* noop */
      }
      workerRef.current = null;
    }
  }, []);

  // Cleanup on unmount.
  useEffect(() => () => terminateWorker(), [terminateWorker]);

  const spawnWorker = useCallback(() => {
    terminateWorker();
    const worker = new Worker(
      new URL('../workers/wearableIngest.worker.js', import.meta.url),
      { type: 'module' },
    );
    workerRef.current = worker;
    return worker;
  }, [terminateWorker]);

  /** Pick a directory (must be a user gesture). */
  const pickDirectory = useCallback(async () => {
    if (!supported) {
      setState('unsupported');
      return null;
    }
    setError(null);
    try {
      setState('picking');
      const handle = await window.showDirectoryPicker({ mode: 'read' });
      handleRef.current = handle;
      setState('detected');
      return handle;
    } catch (err) {
      // AbortError = user dismissed the picker; return to idle quietly.
      if (err?.name === 'AbortError') {
        setState('idle');
        return null;
      }
      setError('Could not open the folder picker.');
      setState('error');
      return null;
    }
  }, [supported]);

  /** Run a name-only scan via the worker (pre-consent detection). */
  const scan = useCallback(
    (handle = handleRef.current) =>
      new Promise((resolve) => {
        if (!handle) return resolve(null);
        setState('scanning');
        const worker = spawnWorker();
        const workerId = nextWorkerId();
        worker.onmessage = (ev) => {
          const {
            workerId: id,
            type,
            detection: det,
            error: msg,
          } = ev.data || {};
          if (id !== workerId) return;
          if (type === 'scan-result') {
            setDetection(det);
            setState('detected');
            resolve(det);
          } else if (type === 'error') {
            setError(msg);
            setState('error');
            resolve(null);
          }
        };
        worker.postMessage({
          workerId,
          action: 'scan',
          payload: { dirHandle: handle },
        });
      }),
    [spawnWorker, nextWorkerId],
  );

  /**
   * Start ingestion. Pass `{ rememberFolder }` to opt into handle persistence.
   * Incremental re-import is driven by `wearable_meta.lastIngestedDate` + `files`.
   */
  const startIngest = useCallback(
    async ({ rememberFolder = false, menstrualOptIn = false } = {}) => {
      const handle = handleRef.current;
      if (!handle) return;
      setError(null);
      setState('ingesting');
      setProgress({
        phase: 'discovering',
        filesDone: 0,
        filesTotal: 0,
        nights: 0,
      });

      const abort = new AbortController();
      abortRef.current = abort;

      // Incremental inputs from the manifest.
      let sinceDate = null;
      let knownFiles = null;
      try {
        const db = await openAppDb();
        if (db) {
          const hw = await getWearableMeta(db, 'lastIngestedDate');
          if (hw && typeof hw === 'object') {
            sinceDate = Object.values(hw).sort()[0] ?? null; // most conservative
          }
          knownFiles = await getWearableMeta(db, 'files');
          if (rememberFolder) {
            await setWearableMeta(db, 'dirHandle', handle);
          }
          db.close();
        }
      } catch {
        /* manifest read is best-effort; fall back to full ingest */
      }

      const worker = spawnWorker();
      const workerId = nextWorkerId();

      worker.onmessage = async (ev) => {
        const { workerId: id, type, stats, error: msg } = ev.data || {};
        if (id !== workerId) return;
        if (type === 'progress') {
          const { phase, filesDone, filesTotal, nights } = ev.data;
          setProgress({ phase, filesDone, filesTotal, nights });
        } else if (type === 'complete') {
          setLastImport({
            at: Date.now(),
            nights: ev.data.nights ?? stats?.nights ?? 0,
            dateRange: stats?.dateRange ?? null,
          });
          setState('ready');
          terminateWorker();
        } else if (type === 'error') {
          setError(msg);
          setState('error');
          terminateWorker();
        }
      };

      const onAbort = () => {
        worker.postMessage({ workerId, action: 'cancel' });
        terminateWorker();
        setState('partial');
      };
      abort.signal.addEventListener('abort', onAbort, { once: true });

      worker.postMessage({
        workerId,
        action: 'ingest',
        payload: { dirHandle: handle, sinceDate, knownFiles, menstrualOptIn },
      });
    },
    [spawnWorker, nextWorkerId, terminateWorker],
  );

  /** Cancel an in-flight ingest (worker.terminate + abort). */
  const cancelIngest = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    terminateWorker();
    setState((s) => (s === 'ingesting' ? 'partial' : s));
  }, [terminateWorker]);

  /** Restore a persisted handle and re-grant permission (user gesture). */
  const reconnect = useCallback(async () => {
    if (!supported) return false;
    try {
      const db = await openAppDb();
      const handle = db ? await getWearableMeta(db, 'dirHandle') : null;
      db?.close();
      if (!handle) {
        setState('idle');
        return false;
      }
      const perm = await handle.queryPermission?.({ mode: 'read' });
      if (perm !== 'granted') {
        const req = await handle.requestPermission?.({ mode: 'read' });
        if (req !== 'granted') {
          setState('needs-permission');
          return false;
        }
      }
      handleRef.current = handle;
      setState('detected');
      return true;
    } catch {
      setState('needs-permission');
      return false;
    }
  }, [supported]);

  /** Re-scan an already-connected folder for new nights (incremental trigger). */
  const checkForNewData = useCallback(async () => {
    if (!handleRef.current) {
      const ok = await reconnect();
      if (!ok) return null;
    }
    return scan();
  }, [reconnect, scan]);

  /** Delete all wearable data + the persisted handle ("Forget folder"). */
  const forgetFolder = useCallback(async () => {
    const db = await openAppDb();
    if (db) {
      await clearWearableData(db);
      db.close();
    }
    handleRef.current = null;
    setDetection(null);
    setLastImport(null);
    setState('idle');
  }, []);

  return {
    supported,
    state,
    progress,
    detection,
    error,
    lastImport,
    pickDirectory,
    scan,
    startIngest,
    cancelIngest,
    reconnect,
    checkForNewData,
    forgetFolder,
  };
}
