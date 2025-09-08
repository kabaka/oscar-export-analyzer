import { useState } from 'react';
import Papa from 'papaparse';
import { FLG_BRIDGE_THRESHOLD } from '../utils/clustering';

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
      const rows = [];
      Papa.parse(file, {
        worker: true,
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        chunkSize: 1024 * 1024,
        chunk: (results) => {
          setProgress(results.meta.cursor);
          if (filterEvents) {
            // retain only apnea annotations and sufficiently high-FLG events
            const keep = results.data.filter((r) => {
              const e = r['Event'];
              if (e === 'FLG')
                return r['Data/Duration'] >= FLG_BRIDGE_THRESHOLD;
              return ['ClearAirway', 'Obstructive', 'Mixed'].includes(e);
            });
            rows.push(...keep);
          } else {
            rows.push(...results.data);
          }
        },
        complete: () => {
          setter(rows);
          setLoading(false);
        },
        error: (err) => {
          setLoading(false);
          setError(err?.message || String(err));
        },
      });
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
    onSummaryFile: handleFile(
      setSummaryData,
      setLoadingSummary,
      setSummaryProgress,
      setSummaryProgressMax
    ),
    onDetailsFile: handleFile(
      setDetailsData,
      setLoadingDetails,
      setDetailsProgress,
      setDetailsProgressMax,
      true /* filter to only apnea & FLG events */
    ),
  };
}
