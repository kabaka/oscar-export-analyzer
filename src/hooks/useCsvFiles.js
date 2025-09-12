import { useState } from 'react';

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
    (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setLoading(true);
      setError(null);
      setProgress(0);
      setProgressMax(file.size);
      setter([]);
      const worker = new Worker(
        new URL('../workers/csv.worker.js', import.meta.url),
        { type: 'module' },
      );
      worker.onmessage = (ev) => {
        const { type, rows, cursor, error: msg } = ev.data || {};
        if (type === 'progress') {
          setProgress(cursor);
        } else if (type === 'rows') {
          setter((prev) => [...prev, ...rows]);
        } else if (type === 'complete') {
          setLoading(false);
          worker.terminate();
        } else if (type === 'error') {
          setLoading(false);
          setError(msg);
          worker.terminate();
        }
      };
      worker.postMessage({ file, filterEvents });
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
    onSummaryFile: (e) => {
      setDetailsData(null);
      handleFile(
        setSummaryData,
        setLoadingSummary,
        setSummaryProgress,
        setSummaryProgressMax,
      )(e);
    },
    onDetailsFile: handleFile(
      setDetailsData,
      setLoadingDetails,
      setDetailsProgress,
      setDetailsProgressMax,
      true /* filter to only apnea & FLG events */,
    ),
  };
}
