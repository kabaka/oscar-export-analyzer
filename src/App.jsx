import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  lazy,
  Suspense,
} from 'react';
import { useCsvFiles } from './hooks/useCsvFiles';
import { useSessionManager } from './hooks/useSessionManager';
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
} from './utils/clustering';
import Overview from './components/Overview';
const SummaryAnalysis = lazy(() => import('./components/SummaryAnalysis'));
const ApneaClusterAnalysis = lazy(
  () => import('./components/ApneaClusterAnalysis'),
);
const ApneaEventStats = lazy(() => import('./components/ApneaEventStats'));
const FalseNegativesAnalysis = lazy(
  () => import('./components/FalseNegativesAnalysis'),
);
import RangeComparisons from './components/RangeComparisons';
import RawDataExplorer from './components/RawDataExplorer';
import ErrorBoundary from './components/ErrorBoundary';
import ThemeToggle from './components/ThemeToggle';
import DocsModal from './components/DocsModal';
import DataImportModal from './components/DataImportModal';
import GuideLink from './components/GuideLink';
import HeaderMenu from './components/HeaderMenu';
import DateRangeControls from './components/DateRangeControls';
import { buildSummaryAggregatesCSV, downloadTextFile } from './utils/export';
import { clearLastSession } from './utils/db';
import { DataProvider } from './context/DataContext';
import { useAnalyticsProcessing } from './hooks/useAnalyticsProcessing';
import { useDateRangeFilter } from './hooks/useDateRangeFilter';
import { useGuide } from './hooks/useGuide';
import { useModal } from './hooks/useModal';

function App() {
  const tocSections = useMemo(
    () => [
      { id: 'overview', label: 'Overview' },
      { id: 'usage-patterns', label: 'Usage Patterns' },
      { id: 'ahi-trends', label: 'AHI Trends' },
      { id: 'pressure-settings', label: 'Pressure Settings' },
      { id: 'apnea-characteristics', label: 'Apnea Events' },
      { id: 'clustered-apnea', label: 'Clusters' },
      { id: 'false-negatives', label: 'False Negatives' },
      { id: 'raw-data-explorer', label: 'Raw Data' },
    ],
    [],
  );
  const [activeId, setActiveId] = useState('overview');
  const {
    summaryData,
    detailsData,
    loadingSummary,
    summaryProgress,
    summaryProgressMax,
    loadingDetails,
    detailsProgress,
    detailsProgressMax,
    onSummaryFile,
    onDetailsFile,
    setSummaryData,
    setDetailsData,
    error,
  } = useCsvFiles();
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
  const { isOpen: importOpen, open: openImportModal, close: closeImportModal } =
    useModal(true);
  const [clusterParams, setClusterParams] = useState({
    algorithm: DEFAULT_CLUSTER_ALGORITHM,
    gapSec: APNEA_GAP_DEFAULT,
    bridgeThreshold: FLG_BRIDGE_THRESHOLD,
    bridgeSec: FLG_CLUSTER_GAP_DEFAULT,
    minCount: 3,
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
  const { apneaClusters, falseNegatives, processing } = useAnalyticsProcessing(
    detailsData,
    clusterParams,
    fnOptions,
  );
  const { guideOpen, guideAnchor, openGuideForActive, closeGuide } = useGuide(activeId);
  const { handleLoadSaved, handleExportJson, importSessionFile } =
    useSessionManager({
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
  }, [setSummaryData, setDetailsData]);

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
    return summaryData.filter((r) => {
      const d = new Date(r[dateCol]);
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
    return detailsData.filter((r) => {
      const d = new Date(r[dateCol]);
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    });
  }, [detailsData, dateFilter]);

  // Highlight active TOC link based on visible section
  useEffect(() => {
    const root = document.documentElement;
    const cssVar = getComputedStyle(root)
      .getPropertyValue('--header-offset')
      .trim();
    const headerOffset = cssVar.endsWith('px')
      ? parseFloat(cssVar)
      : Number(cssVar) || 58;
    const topMargin = headerOffset + 8;

    const pickActive = () => {
      // choose the last heading whose top is above the threshold
      const ids = tocSections.map((s) => s.id);
      let current = ids[0];
      ids.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        const rect = el.getBoundingClientRect();
        if (rect.top - topMargin <= 0) {
          current = id;
        }
      });
      setActiveId(current);
    };

    const observer = new IntersectionObserver(
      () => {
        pickActive();
      },
      {
        root: null,
        // Trigger when headings cross just below the sticky header and before bottom of viewport
        rootMargin: `-${topMargin}px 0px -70% 0px`,
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );

    // Observe any headings currently in the DOM
    tocSections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    // Also recompute on hash change (e.g., when user clicks a link)
    const onHash = () => {
      const h = (window.location.hash || '').replace('#', '');
      if (h) setActiveId(h);
    };
    window.addEventListener('hashchange', onHash);

    // Update on scroll/resize to ensure responsiveness in all browsers
    const onScroll = () => pickActive();
    const onResize = () => pickActive();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);

    // Initial selection
    pickActive();

    return () => {
      observer.disconnect();
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
    // Re-run when data presence changes which may mount/unmount sections
  }, [filteredSummary, filteredDetails, tocSections]);

  return (
    <DataProvider
      summaryData={summaryData}
      setSummaryData={setSummaryData}
      detailsData={detailsData}
      setDetailsData={setDetailsData}
      filteredSummary={filteredSummary}
      filteredDetails={filteredDetails}
    >
      <DataImportModal
        isOpen={importOpen}
        onClose={closeImportModal}
        onSummaryFile={onSummaryFile}
        onDetailsFile={onDetailsFile}
        onLoadSaved={handleLoadSaved}
        onSessionFile={importSessionFile}
        loadingSummary={loadingSummary}
        loadingDetails={loadingDetails || processing}
        summaryProgress={summaryProgress}
        summaryProgressMax={summaryProgressMax}
        detailsProgress={detailsProgress}
        detailsProgressMax={detailsProgressMax}
        error={error}
      />
      {error && (
        <div
          role="alert"
          style={{
            margin: '8px 0',
            color: 'red',
            textAlign: 'center',
          }}
        >
          {error}
        </div>
      )}
      <header className="app-header">
        <div className="inner">
          <div className="title">
            <h1>OSCAR Sleep Data Analysis</h1>
            <span className="badge">beta</span>
          </div>
          <DateRangeControls
            quickRange={quickRange}
            onQuickRangeChange={handleQuickRangeChange}
            dateFilter={dateFilter}
            onDateFilterChange={setDateFilter}
            onCustomRange={selectCustomRange}
            onReset={resetDateFilter}
            parseDate={parseDate}
            formatDate={formatDate}
          />
          <div className="actions">
            <ThemeToggle />
            <HeaderMenu
              onOpenImport={openImportModal}
              onExportJson={handleExportJson}
              onExportCsv={exportAggregatesCsv}
              onClearSession={handleClearSession}
              onPrint={() => window.print()}
              onOpenGuide={openGuideForActive}
              hasAnyData={hasAnyData}
              summaryAvailable={summaryAvailable}
            />
          </div>
        </div>
        {(loadingSummary || loadingDetails || processing) && (
          <div className="import-progress" aria-live="polite">
            <span>
              {loadingSummary &&
                `Importing summary CSV${
                  summaryProgressMax
                    ? ` (${Math.round(
                        (summaryProgress / summaryProgressMax) * 100,
                      )}%)`
                    : ''
                }`}
              {loadingDetails &&
                !loadingSummary &&
                `Importing details CSV${
                  detailsProgressMax
                    ? ` (${Math.round(
                        (detailsProgress / detailsProgressMax) * 100,
                      )}%)`
                    : ''
                }`}
              {processing &&
                !loadingSummary &&
                !loadingDetails &&
                'Processing events...'}
            </span>
            <progress
              value={
                loadingSummary
                  ? summaryProgress
                  : loadingDetails
                    ? detailsProgress
                    : undefined
              }
              max={
                loadingSummary
                  ? summaryProgressMax
                  : loadingDetails
                    ? detailsProgressMax
                    : undefined
              }
            />
          </div>
        )}
      </header>
      <div className="container">
        <nav className="toc">
          {tocSections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className={activeId === s.id ? 'active' : undefined}
              onClick={() => setActiveId(s.id)}
            >
              {s.label}
            </a>
          ))}
        </nav>
        {filteredSummary?.length > 0 && (
          <div className="section">
            <Overview
              clusters={apneaClusters}
              falseNegatives={falseNegatives}
            />
          </div>
        )}
        {filteredSummary?.length > 0 && (
          <div className="section">
            <ErrorBoundary>
              <Suspense fallback={<div>Loading...</div>}>
                <SummaryAnalysis clusters={apneaClusters} />
              </Suspense>
            </ErrorBoundary>
            <div style={{ marginTop: 8 }}>
              <h2 id="range-compare">
                Range Comparisons{' '}
                <GuideLink anchor="range-comparisons-a-vs-b" label="Guide" />
              </h2>
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap',
                  alignItems: 'end',
                }}
              >
                <div>
                  <label>
                    Range A start{' '}
                    <input
                      type="date"
                      onChange={(e) =>
                        setRangeA((prev) => ({
                          ...prev,
                          start: e.target.value
                            ? new Date(e.target.value)
                            : null,
                        }))
                      }
                    />
                  </label>
                </div>
                <div>
                  <label>
                    Range A end{' '}
                    <input
                      type="date"
                      onChange={(e) =>
                        setRangeA((prev) => ({
                          ...prev,
                          end: e.target.value ? new Date(e.target.value) : null,
                        }))
                      }
                    />
                  </label>
                </div>
                <button onClick={() => setRangeA(dateFilter)}>
                  Use current filter as A
                </button>
                <div style={{ width: 12 }} />
                <div>
                  <label>
                    Range B start{' '}
                    <input
                      type="date"
                      onChange={(e) =>
                        setRangeB((prev) => ({
                          ...prev,
                          start: e.target.value
                            ? new Date(e.target.value)
                            : null,
                        }))
                      }
                    />
                  </label>
                </div>
                <div>
                  <label>
                    Range B end{' '}
                    <input
                      type="date"
                      onChange={(e) =>
                        setRangeB((prev) => ({
                          ...prev,
                          end: e.target.value ? new Date(e.target.value) : null,
                        }))
                      }
                    />
                  </label>
                </div>
                <button onClick={() => setRangeB(dateFilter)}>
                  Use current filter as B
                </button>
              </div>
              <ErrorBoundary>
                <RangeComparisons rangeA={rangeA} rangeB={rangeB} />
              </ErrorBoundary>
            </div>
          </div>
        )}
        {filteredDetails?.length > 0 && (
          <>
            <div className="section">
              <ErrorBoundary>
                <Suspense fallback={<div>Loading...</div>}>
                  <ApneaEventStats />
                </Suspense>
              </ErrorBoundary>
            </div>
            <div className="section">
              <ErrorBoundary>
                <Suspense fallback={<div>Loading...</div>}>
                  <ApneaClusterAnalysis
                    clusters={apneaClusters}
                    params={clusterParams}
                    onParamChange={onClusterParamChange}
                    details={filteredDetails}
                  />
                </Suspense>
              </ErrorBoundary>
            </div>
            <div className="section">
              <ErrorBoundary>
                <Suspense fallback={<div>Loading...</div>}>
                  <FalseNegativesAnalysis
                    list={falseNegatives}
                    preset={fnPreset}
                    onPresetChange={setFnPreset}
                  />
                </Suspense>
              </ErrorBoundary>
            </div>
            <div className="section">
              <ErrorBoundary>
                <RawDataExplorer
                  onApplyDateFilter={({ start, end }) =>
                    setDateFilter({ start, end })
                  }
                />
              </ErrorBoundary>
            </div>
          </>
        )}
        <DocsModal
          isOpen={guideOpen}
          onClose={closeGuide}
          initialAnchor={guideAnchor}
        />
      </div>
    </DataProvider>
  );
}

export default App;
