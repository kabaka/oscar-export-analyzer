import { useEffect, useCallback } from 'react';
import { buildSession, applySession } from '../utils/session';
import { putLastSession, getLastSession } from '../utils/db';

export function useSessionManager({
  summaryData,
  detailsData,
  clusterParams,
  dateFilter,
  rangeA,
  rangeB,
  fnPreset,
  setClusterParams,
  setDateFilter,
  setRangeA,
  setRangeB,
  setSummaryData,
  setDetailsData,
}) {
  const applySessionPatch = useCallback(
    (session) => {
      const patch = applySession(session);
      if (!patch) return false;
      setClusterParams((prev) => patch.clusterParams || prev || {});
      setDateFilter(patch.dateFilter || { start: null, end: null });
      setRangeA(patch.rangeA || { start: null, end: null });
      setRangeB(patch.rangeB || { start: null, end: null });
      setSummaryData(patch.summaryData || null);
      setDetailsData(patch.detailsData || null);
      return true;
    },
    [
      setClusterParams,
      setDateFilter,
      setRangeA,
      setRangeB,
      setSummaryData,
      setDetailsData,
    ],
  );

  useEffect(() => {
    if (!summaryData && !detailsData) return;
    const timer = setTimeout(() => {
      const session = buildSession({
        summaryData,
        detailsData,
        clusterParams,
        dateFilter,
        rangeA,
        rangeB,
        fnPreset,
      });
      putLastSession(session).catch(() => {});
    }, 500);
    return () => clearTimeout(timer);
  }, [
    summaryData,
    detailsData,
    clusterParams,
    dateFilter,
    rangeA,
    rangeB,
    fnPreset,
  ]);

  const handleLoadSaved = async () => {
    const sess = await getLastSession().catch(() => null);
    if (sess) {
      applySessionPatch(sess);
    }
  };

  const handleExportJson = () => {
    const session = buildSession({
      summaryData,
      detailsData,
      clusterParams,
      dateFilter,
      rangeA,
      rangeB,
      fnPreset,
    });
    const blob = new Blob([JSON.stringify(session, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'oscar_session.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importSessionFile = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = (e) => reject(e);
      reader.onload = () => {
        try {
          const sess = JSON.parse(reader.result);
          const applied = applySessionPatch(sess);
          if (applied) {
            resolve();
            return;
          }
          throw new Error('Session file missing required data');
        } catch (err) {
          console.error('Session import failed:', err);
          reject(err);
        }
      };
      reader.readAsText(file);
    });

  return {
    applySessionPatch,
    handleLoadSaved,
    handleExportJson,
    importSessionFile,
  };
}
