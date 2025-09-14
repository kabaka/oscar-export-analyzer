import { useState, useEffect, useRef } from 'react';
import { buildSession, applySession } from '../utils/session';
import { putLastSession, getLastSession, clearLastSession } from '../utils/db';

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
  const [persistEnabled, setPersistEnabled] = useState(() => {
    try {
      return localStorage.getItem('persistEnabled') === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('persistEnabled', persistEnabled ? '1' : '0');
    } catch {
      // ignore persistence errors
    }
  }, [persistEnabled]);

  const prevPersistRef = useRef(persistEnabled);
  useEffect(() => {
    if (!persistEnabled && prevPersistRef.current) {
      clearLastSession().catch(() => {});
    }
    prevPersistRef.current = persistEnabled;
  }, [persistEnabled]);

  useEffect(() => {
    if (!persistEnabled) return;
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
    persistEnabled,
    summaryData,
    detailsData,
    clusterParams,
    dateFilter,
    rangeA,
    rangeB,
    fnPreset,
  ]);

  const handleSaveNow = async () => {
    if (!summaryData && !detailsData) return;
    const session = buildSession({
      summaryData,
      detailsData,
      clusterParams,
      dateFilter,
      rangeA,
      rangeB,
      fnPreset,
    });
    await putLastSession(session).catch(() => {});
  };

  const handleLoadSaved = async () => {
    const sess = await getLastSession().catch(() => null);
    if (sess) {
      const patch = applySession(sess);
      if (patch) {
        setClusterParams(patch.clusterParams || clusterParams);
        setDateFilter(patch.dateFilter || { start: null, end: null });
        setRangeA(patch.rangeA || { start: null, end: null });
        setRangeB(patch.rangeB || { start: null, end: null });
        setSummaryData(patch.summaryData || null);
        setDetailsData(patch.detailsData || null);
      }
    }
  };

  const handleClearSaved = async () => {
    await clearLastSession().catch(() => {});
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

  const handleImportJson = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const sess = JSON.parse(reader.result);
        const patch = applySession(sess);
        if (patch) {
          setClusterParams(patch.clusterParams || clusterParams);
          setDateFilter(patch.dateFilter || { start: null, end: null });
          setRangeA(patch.rangeA || { start: null, end: null });
          setRangeB(patch.rangeB || { start: null, end: null });
          setSummaryData(patch.summaryData || null);
          setDetailsData(patch.detailsData || null);
        }
      } catch {
        // silently discard malformed JSON
      }
    };
    reader.readAsText(file);
  };

  return {
    persistEnabled,
    setPersistEnabled,
    handleSaveNow,
    handleLoadSaved,
    handleClearSaved,
    handleExportJson,
    handleImportJson,
  };
}
