import { useEffect } from 'react';
import { buildSession, applySession } from '../utils/session';
import { putLastSession, getLastSession } from '../utils/db';
import { getStorageConsent } from '../utils/storageConsent';
import { DECIMAL_PLACES_2 } from '../constants';

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
  onNeedConsent,
}) {
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

      // Check storage consent before saving
      const consent = getStorageConsent();
      if (consent === null) {
        // First time or "ask later" - need to ask user
        if (onNeedConsent) {
          onNeedConsent(() => {
            putLastSession(session).catch(() => {});
          });
        }
        return;
      }

      if (consent === true) {
        // User has consented - proceed with save
        putLastSession(session).catch(() => {});
      }
      // If consent === false (denied), skip save silently
    }, 500); // eslint-disable-line no-magic-numbers -- debounce timeout (ms) for session persistence
    return () => clearTimeout(timer);
  }, [
    summaryData,
    detailsData,
    clusterParams,
    dateFilter,
    rangeA,
    rangeB,
    fnPreset,
    onNeedConsent,
  ]);

  const handleLoadSaved = async () => {
    const sess = await getLastSession().catch(() => null);
    if (sess) {
      const patch = applySession(sess);
      if (patch) {
        setClusterParams({ ...clusterParams, ...(patch.clusterParams || {}) });
        setDateFilter(patch.dateFilter || { start: null, end: null });
        setRangeA(patch.rangeA || { start: null, end: null });
        setRangeB(patch.rangeB || { start: null, end: null });
        setSummaryData(patch.summaryData || null);
        setDetailsData(patch.detailsData || null);
      }
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
    const blob = new Blob([JSON.stringify(session, null, DECIMAL_PLACES_2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'oscar_session_PHI.json';
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
          const patch = applySession(sess);
          if (patch) {
            setClusterParams({
              ...clusterParams,
              ...(patch.clusterParams || {}),
            });
            setDateFilter(patch.dateFilter || { start: null, end: null });
            setRangeA(patch.rangeA || { start: null, end: null });
            setRangeB(patch.rangeB || { start: null, end: null });
            setSummaryData(patch.summaryData || null);
            setDetailsData(patch.detailsData || null);
            resolve();
            return;
          }
          throw new Error('Session file missing required data');
        } catch (err) {
          if (import.meta.env.DEV) {
            console.error('Session import failed:', err);
          }
          reject(err);
        }
      };
      reader.readAsText(file);
    });

  return {
    handleLoadSaved,
    handleExportJson,
    importSessionFile,
  };
}
