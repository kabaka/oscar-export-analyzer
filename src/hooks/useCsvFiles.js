import { useCallback, useEffect, useRef, useState } from 'react';

// Hook for loading CSV files via file input
export function useCsvFiles() {
  const [summaryData, setSummaryData] = useState(null);
  const [detailsData, setDetailsData] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryProgress, setSummaryProgress] = useState(0);
  const [summaryProgressMax, setSummaryProgressMax] = useState(0);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsProgress, setDetailsProgress] = useState(0);
  const [detailsProgressMax, setDetailsProgressMax] = useState(0);
  const [error, setError] = useState(null);
  const activeTaskRef = useRef({
    worker: null,
    workerId: null,
    setLoading: null,
    cleanup: null,
  });
  const workerSeqRef = useRef(0);
  const workerEpochRef = useRef(null);

  const createWorkerId = useCallback(() => {
    if (workerEpochRef.current === null) {
      workerEpochRef.current = Date.now();
    }
    workerSeqRef.current += 1;
    return `csv-worker-${workerEpochRef.current}-${workerSeqRef.current}`;
  }, []);

  const resetActiveTask = () => {
    activeTaskRef.current = {
      worker: null,
      workerId: null,
      setLoading: null,
      cleanup: null,
    };
  };

  const cancelCurrent = useCallback(() => {
    const { worker, setLoading, cleanup } = activeTaskRef.current || {};
    if (cleanup) {
      cleanup();
    }
    if (worker) {
      worker.terminate();
    }
    if (setLoading) {
      setLoading(false);
    }
    resetActiveTask();
  }, []);

  useEffect(() => cancelCurrent, [cancelCurrent]);

  const extractFirstFile = (input) => {
    if (!input) return null;
    if (typeof File !== 'undefined' && input instanceof File) return input;
    if (typeof Blob !== 'undefined' && input instanceof Blob) return input;
    if (input.file) return input.file;
    const files = input?.target?.files || input?.dataTransfer?.files;
    return files?.[0] ?? null;
  };

  /**
   * Generic CSV loader with optional event filtering.
   * @param {Function} setter - state setter for parsed rows
   * @param {Function} setLoading - state setter for loading flag
   * @param {Function} setProgress - state setter for progress cursor
   * @param {Function} setProgressMax - state setter for progress max
   * @param {boolean} filterEvents - if true, only retain ClearAirway, Obstructive, Mixed, FLG rows
   */
  const handleFile =
    (setter, setLoading, setProgress, setProgressMax, filterEvents = false) =>
    (input, options = {}) => {
      const file = extractFirstFile(input);
      if (!file) return;
      const { signal } = options || {};

      cancelCurrent();

      if (signal?.aborted) {
        return;
      }
      setLoading(true);
      setError(null);
      setProgress(0);
      setProgressMax(file.size || 0);
      setter([]);
      const worker = new Worker(
        new URL('../workers/csv.worker.js', import.meta.url),
        { type: 'module' },
      );
      const workerId = createWorkerId();
      const clearTask = () => {
        if (activeTaskRef.current.workerId !== workerId) return;
        const { cleanup } = activeTaskRef.current;
        if (cleanup) cleanup();
        resetActiveTask();
      };
      worker.onmessage = (ev) => {
        const {
          workerId: messageWorkerId,
          type,
          rows,
          cursor,
          error: msg,
        } = ev.data || {};
        if (activeTaskRef.current.workerId !== messageWorkerId) return;
        if (type === 'progress') {
          setProgress(cursor);
        } else if (type === 'rows') {
          setter((prev) => [...prev, ...rows]);
        } else if (type === 'complete') {
          setLoading(false);
          worker.terminate();
          clearTask();
        } else if (type === 'error') {
          setLoading(false);
          setError(msg);
          worker.terminate();
          clearTask();
        }
      };
      activeTaskRef.current = {
        worker,
        workerId,
        setLoading,
        cleanup: null,
      };
      if (signal) {
        const onAbort = () => {
          cancelCurrent();
        };
        signal.addEventListener('abort', onAbort, { once: true });
        activeTaskRef.current.cleanup = () => {
          signal.removeEventListener('abort', onAbort);
        };
      }
      worker.postMessage({ workerId, file, filterEvents });
    };

  return {
    summaryData,
    detailsData,
    loadingSummary,
    summaryProgress,
    summaryProgressMax,
    loadingDetails,
    detailsProgress,
    detailsProgressMax,
    error,
    // Expose setters so App can restore from saved sessions
    setSummaryData,
    setDetailsData,
    onSummaryFile: (e, options) => {
      setDetailsData(null);
      handleFile(
        setSummaryData,
        setLoadingSummary,
        setSummaryProgress,
        setSummaryProgressMax,
      )(e, options);
    },
    onDetailsFile: handleFile(
      setDetailsData,
      setLoadingDetails,
      setDetailsProgress,
      setDetailsProgressMax,
      true /* filter to only apnea & FLG events */,
    ),
    cancelCurrent,
  };
}
