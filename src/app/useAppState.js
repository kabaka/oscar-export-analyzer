import { useCallback, useMemo, useState } from 'react';
import { useCsvFiles } from '../hooks/useCsvFiles';
import { useSessionManager } from '../hooks/useSessionManager';
import { useAnalyticsProcessing } from '../hooks/useAnalyticsProcessing';
import { useDateRangeFilter } from '../hooks/useDateRangeFilter';
import { useModal } from '../hooks/useModal';
import {
  FALSE_NEG_PEAK_FLG_LEVEL_MIN,
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
  CLUSTERING_DEFAULTS,
} from '../utils/clustering';
import {
  APNEA_CLUSTER_MIN_EVENTS,
  FALSE_NEG_BALANCED_MIN_DURATION_SEC,
  FALSE_NEG_LENIENT_BASE_FL_THRESHOLD,
  FALSE_NEG_LENIENT_BRIDGE_SCALE,
  FALSE_NEG_LENIENT_MIN_CONFIDENCE,
  FALSE_NEG_LENIENT_MIN_DURATION_SEC,
  FALSE_NEG_STRICT_FALLBACK_FL_THRESHOLD,
  FALSE_NEG_STRICT_MIN_CONFIDENCE,
  FALSE_NEG_STRICT_MIN_DURATION_SEC,
} from '../constants';
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
  const printWarningModal = useModal(false);

  const [clusterParams, setClusterParams] = useState({
    algorithm: DEFAULT_CLUSTER_ALGORITHM,
    gapSec: APNEA_GAP_DEFAULT,
    bridgeThreshold: FLG_BRIDGE_THRESHOLD,
    bridgeSec: FLG_CLUSTER_GAP_DEFAULT,
    minCount: APNEA_CLUSTER_MIN_EVENTS,
    minTotalSec: APOEA_CLUSTER_MIN_TOTAL_SEC,
    maxClusterSec: MAX_CLUSTER_DURATION_SEC,
    minDensity: CLUSTERING_DEFAULTS.MIN_DENSITY_CUTOFF,
    edgeEnter: FLG_EDGE_ENTER_THRESHOLD_DEFAULT,
    edgeExit: FLG_EDGE_EXIT_THRESHOLD_DEFAULT,
    edgeMinDurSec: CLUSTERING_DEFAULTS.EDGE_MIN_DURATION_SEC,
    k: DEFAULT_KMEANS_K,
    linkageThresholdSec: DEFAULT_SINGLE_LINK_GAP_SEC,
  });

  const [fnPreset, setFnPreset] = useState('balanced');
  const fnOptions = useMemo(() => {
    const presets = {
      strict: {
        flThreshold: Math.max(
          FALSE_NEG_STRICT_FALLBACK_FL_THRESHOLD,
          FLG_BRIDGE_THRESHOLD,
        ),
        peakFLGLevelMin: FALSE_NEG_STRICT_MIN_CONFIDENCE,
        gapSec: FLG_CLUSTER_GAP_DEFAULT,
        minDurationSec: FALSE_NEG_STRICT_MIN_DURATION_SEC,
      },
      balanced: {
        flThreshold: FLG_BRIDGE_THRESHOLD,
        peakFLGLevelMin: FALSE_NEG_PEAK_FLG_LEVEL_MIN,
        gapSec: FLG_CLUSTER_GAP_DEFAULT,
        minDurationSec: FALSE_NEG_BALANCED_MIN_DURATION_SEC,
      },
      lenient: {
        flThreshold: Math.max(
          FALSE_NEG_LENIENT_BASE_FL_THRESHOLD,
          FLG_BRIDGE_THRESHOLD * FALSE_NEG_LENIENT_BRIDGE_SCALE,
        ),
        peakFLGLevelMin: FALSE_NEG_LENIENT_MIN_CONFIDENCE,
        gapSec: FLG_CLUSTER_GAP_DEFAULT,
        minDurationSec: FALSE_NEG_LENIENT_MIN_DURATION_SEC,
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
    printWarningModal,
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
