import { useCallback, useMemo, useState } from 'react';
import { useCsvFiles } from '../hooks/useCsvFiles';
import { useSessionManager } from '../hooks/useSessionManager';
import { useAnalyticsProcessing } from '../hooks/useAnalyticsProcessing';
import { useDateRangeFilter } from '../hooks/useDateRangeFilter';
import { useModal } from '../hooks/useModal';
import {
  FALSE_NEG_CONFIDENCE_MIN,
  FLG_BRIDGE_THRESHOLD,
  APOEA_CLUSTER_MIN_TOTAL_SEC,
  MAX_CLUSTER_DURATION_SEC,
  APNEA_GAP_DEFAULT,
  FLG_CLUSTER_GAP_DEFAULT,
  FLG_EDGE_ENTER_THRESHOLD_DEFAULT,
  FLG_EDGE_EXIT_THRESHOLD_DEFAULT,
  DEFAULT_CLUSTER_ALGORITHM,
  DEFAULT_KMEANS_K,
  DEFAULT_SINGLE_LINK_GAP_SEC,
} from '../utils/clustering';
import { APNEA_CLUSTER_MIN_EVENTS } from '../constants';
import { buildSummaryAggregatesCSV, downloadTextFile } from '../utils/export';
import { clearLastSession } from '../utils/db';

export function useAppState() {
  const csvState = useCsvFiles();
  const {
    summaryData,
    setSummaryData,
    detailsData,
    setDetailsData,
    loadingSummary,
    summaryProgress,
    summaryProgressMax,
    loadingDetails,
    detailsProgress,
    detailsProgressMax,
    onSummaryFile,
    onDetailsFile,
    error,
    cancelCurrent,
  } = csvState;

  const {
    dateFilter,
    setDateFilter,
    quickRange,
    handleQuickRangeChange,
    parseDate,
    formatDate,
    selectCustomRange,
    resetDateFilter,
  } = useDateRangeFilter(summaryData);

  const [rangeA, setRangeA] = useState({ start: null, end: null });
  const [rangeB, setRangeB] = useState({ start: null, end: null });
  const importModal = useModal(true);

  const [clusterParams, setClusterParams] = useState({
    algorithm: DEFAULT_CLUSTER_ALGORITHM,
    gapSec: APNEA_GAP_DEFAULT,
    bridgeThreshold: FLG_BRIDGE_THRESHOLD,
    bridgeSec: FLG_CLUSTER_GAP_DEFAULT,
    minCount: APNEA_CLUSTER_MIN_EVENTS,
    minTotalSec: APOEA_CLUSTER_MIN_TOTAL_SEC,
    maxClusterSec: MAX_CLUSTER_DURATION_SEC,
    minDensity: 0,
    edgeEnter: FLG_EDGE_ENTER_THRESHOLD_DEFAULT,
    edgeExit: FLG_EDGE_EXIT_THRESHOLD_DEFAULT,
    edgeMinDurSec: 10,
    k: DEFAULT_KMEANS_K,
    linkageThresholdSec: DEFAULT_SINGLE_LINK_GAP_SEC,
  });

  const [fnPreset, setFnPreset] = useState('balanced');
  const fnOptions = useMemo(() => {
    const presets = {
      strict: {
        flThreshold: Math.max(0.9, FLG_BRIDGE_THRESHOLD),
        confidenceMin: 0.98,
        gapSec: FLG_CLUSTER_GAP_DEFAULT,
        minDurationSec: 120,
      },
      balanced: {
        flThreshold: FLG_BRIDGE_THRESHOLD,
        confidenceMin: FALSE_NEG_CONFIDENCE_MIN,
        gapSec: FLG_CLUSTER_GAP_DEFAULT,
        minDurationSec: 60,
      },
      lenient: {
        flThreshold: Math.max(0.5, FLG_BRIDGE_THRESHOLD * 0.8),
        confidenceMin: 0.85,
        gapSec: FLG_CLUSTER_GAP_DEFAULT,
        minDurationSec: 45,
      },
    };
    return presets[fnPreset] || presets.balanced;
  }, [fnPreset]);

  const analytics = useAnalyticsProcessing(
    detailsData,
    clusterParams,
    fnOptions,
  );
  const { apneaClusters, falseNegatives, processing } = analytics;

  const session = useSessionManager({
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
  });

  const exportAggregatesCsv = useCallback(() => {
    downloadTextFile(
      'aggregates.csv',
      buildSummaryAggregatesCSV(summaryData || []),
      'text/csv',
    );
  }, [summaryData]);

  const handleClearSession = useCallback(async () => {
    if (
      window.confirm(
        'This will delete the saved session data from your browser. Continue?',
      )
    ) {
      await clearLastSession();
      setSummaryData(null);
      setDetailsData(null);
    }
  }, [setDetailsData, setSummaryData]);

  const hasAnyData = !!(summaryData || detailsData);
  const summaryAvailable = !!summaryData;

  const onClusterParamChange = useCallback((patch) => {
    setClusterParams((prev) => ({ ...prev, ...patch }));
  }, []);

  const filteredSummary = useMemo(() => {
    if (!summaryData) return null;
    const { start, end } = dateFilter || {};
    const dateCol = summaryData.length
      ? Object.keys(summaryData[0]).find((c) => /date/i.test(c))
      : null;
    if (!dateCol || (!start && !end)) return summaryData;
    return summaryData.filter((row) => {
      const d = new Date(row[dateCol]);
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    });
  }, [summaryData, dateFilter]);

  const filteredDetails = useMemo(() => {
    if (!detailsData) return null;
    const { start, end } = dateFilter || {};
    const dateCol = detailsData.length
      ? Object.keys(detailsData[0]).find((c) => /date/i.test(c))
      : null;
    if (!dateCol || (!start && !end)) return detailsData;
    return detailsData.filter((row) => {
      const d = new Date(row[dateCol]);
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    });
  }, [detailsData, dateFilter]);

  const [activeSectionId, setActiveSectionId] = useState('overview');

  return {
    summaryData,
    setSummaryData,
    detailsData,
    setDetailsData,
    loadingSummary,
    summaryProgress,
    summaryProgressMax,
    loadingDetails,
    detailsProgress,
    detailsProgressMax,
    onSummaryFile,
    onDetailsFile,
    error,
    cancelCurrent,
    dateFilter,
    setDateFilter,
    quickRange,
    handleQuickRangeChange,
    parseDate,
    formatDate,
    selectCustomRange,
    resetDateFilter,
    rangeA,
    setRangeA,
    rangeB,
    setRangeB,
    importModal,
    clusterParams,
    setClusterParams,
    fnPreset,
    setFnPreset,
    apneaClusters,
    falseNegatives,
    processing,
    handleLoadSaved: session.handleLoadSaved,
    handleExportJson: session.handleExportJson,
    importSessionFile: session.importSessionFile,
    exportAggregatesCsv,
    handleClearSession,
    hasAnyData,
    summaryAvailable,
    onClusterParamChange,
    filteredSummary,
    filteredDetails,
    activeSectionId,
    setActiveSectionId,
  };
}
