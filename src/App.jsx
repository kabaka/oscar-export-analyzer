import React, { useEffect, useMemo } from 'react';
import HeaderMenu from './components/HeaderMenu';
import DateRangeControls from './components/DateRangeControls';
import {
  DataImportModal,
  DocsModal,
  PrintWarningDialog,
  StorageConsentDialog,
  ThemeToggle,
} from './components/ui';
import AppLayout from './app/AppLayout';
import { useAppContext } from './app/AppProviders';
import { OverviewSection } from './features/overview';
import AnalyticsSection from './features/analytics/Section';
import { RangeComparisonsSection } from './features/range-comparisons';
import { ApneaClustersSection } from './features/apnea-clusters';
import FalseNegativesSection from './features/false-negatives/Section';
import RawExplorerSection from './features/raw-explorer/Section';
import { setStorageConsent } from './utils/storageConsent';
import {
  DEFAULT_HEADER_OFFSET_PX,
  HEADER_SCROLL_MARGIN_PX,
  OBSERVER_THRESHOLDS,
  PERCENT_SCALE,
  buildObserverRootMargin,
  computeTopMargin,
} from './constants';

/**
 * Top-level application shell that wires uploads, global navigation, and all feature sections.
 * Gated rendering prevents feature dashboards from mounting until summary/detail data is available.
 *
 * @component
 * @returns {JSX.Element} App layout with header controls, table of contents highlighting, and feature sections.
 */
export function AppShell() {
  const {
    loadingSummary,
    summaryProgress,
    summaryProgressMax,
    loadingDetails,
    detailsProgress,
    detailsProgressMax,
    processing,
    importModal,
    printWarningModal,
    onSummaryFile,
    onDetailsFile,
    handleLoadSaved,
    importSessionFile,
    handleExportJson,
    exportAggregatesCsv,
    handleClearSession,
    hasAnyData,
    summaryAvailable,
    error,
    warning,
    quickRange,
    handleQuickRangeChange,
    dateFilter,
    setDateFilter,
    selectCustomRange,
    resetDateFilter,
    parseDate,
    formatDate,
    activeSectionId,
    setActiveSectionId,
    guideOpen,
    guideAnchor,
    openGuideForActive,
    closeGuide,
    filteredSummary,
    filteredDetails,
    showStorageConsent,
    setShowStorageConsent,
    pendingSave,
    setPendingSave,
  } = useAppContext();

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

  useEffect(() => {
    const root = document.documentElement;
    const cssVar = getComputedStyle(root)
      .getPropertyValue('--header-offset')
      .trim();
    const parsedOffset = cssVar.endsWith('px')
      ? parseFloat(cssVar)
      : Number(cssVar);
    const headerOffset = Number.isFinite(parsedOffset)
      ? parsedOffset
      : DEFAULT_HEADER_OFFSET_PX;
    const topMargin = computeTopMargin(headerOffset);

    const pickActive = () => {
      const ids = tocSections.map((section) => section.id);
      let current = ids[0];
      ids.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        const rect = el.getBoundingClientRect();
        if (rect.top - topMargin <= 0) {
          current = id;
        }
      });
      setActiveSectionId(current);
    };

    const observer = new IntersectionObserver(
      () => {
        pickActive();
      },
      {
        root: null,
        rootMargin: buildObserverRootMargin(topMargin),
        threshold: OBSERVER_THRESHOLDS,
      },
    );

    tocSections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    const onHash = () => {
      const h = (window.location.hash || '').replace('#', '');
      if (h) setActiveSectionId(h);
    };
    window.addEventListener('hashchange', onHash);

    const onScroll = () => pickActive();
    const onResize = () => pickActive();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);

    pickActive();

    return () => {
      observer.disconnect();
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, [tocSections, setActiveSectionId]);

  // Intercept Ctrl+P/Cmd+P to show print warning dialog
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Check for Ctrl+P (Windows/Linux) or Cmd+P (Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        // Only intercept if we have data to print
        if (summaryAvailable) {
          e.preventDefault();
          printWarningModal.open();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [summaryAvailable, printWarningModal]);

  const ERROR_MARGIN_STYLE = `${HEADER_SCROLL_MARGIN_PX}px 0`;

  const beforeHeader = (
    <>
      <DataImportModal
        isOpen={importModal.isOpen}
        onClose={importModal.close}
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
        warning={warning}
      />
      {error && (
        <div
          role="alert"
          style={{
            margin: ERROR_MARGIN_STYLE,
            color: 'red',
            textAlign: 'center',
          }}
        >
          {error}
        </div>
      )}
      {warning && !error && (
        <div
          role="status"
          style={{
            margin: ERROR_MARGIN_STYLE,
            color: 'orange',
            textAlign: 'center',
          }}
        >
          {warning}
        </div>
      )}
    </>
  );

  const header = (
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
          onOpenImport={importModal.open}
          onExportJson={handleExportJson}
          onExportCsv={exportAggregatesCsv}
          onClearSession={handleClearSession}
          onPrint={printWarningModal.open}
          onOpenGuide={openGuideForActive}
          hasAnyData={hasAnyData}
          summaryAvailable={summaryAvailable}
        />
      </div>
    </div>
  );

  const progress =
    loadingSummary || loadingDetails || processing ? (
      <div className="import-progress" aria-live="polite">
        <span>
          {loadingSummary &&
            `Importing summary CSV${
              summaryProgressMax
                ? ` (${Math.round(
                    (summaryProgress / summaryProgressMax) * PERCENT_SCALE,
                  )}%)`
                : ''
            }`}
          {loadingDetails &&
            !loadingSummary &&
            `Importing details CSV${
              detailsProgressMax
                ? ` (${Math.round(
                    (detailsProgress / detailsProgressMax) * PERCENT_SCALE,
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
    ) : null;

  const toc = (
    <>
      {tocSections.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          className={activeSectionId === section.id ? 'active' : undefined}
          onClick={() => setActiveSectionId(section.id)}
        >
          {section.label}
        </a>
      ))}
    </>
  );

  const summaryHasRows = !!filteredSummary?.length;
  const detailsHasRows = !!filteredDetails?.length;

  return (
    <>
      <AppLayout
        beforeHeader={beforeHeader}
        header={header}
        progress={progress}
        toc={toc}
      >
        {summaryHasRows && (
          <>
            <OverviewSection />
            <AnalyticsSection />
            <RangeComparisonsSection />
          </>
        )}
        {detailsHasRows && (
          <>
            <ApneaClustersSection />
            <FalseNegativesSection />
            <RawExplorerSection />
          </>
        )}
      </AppLayout>
      <DocsModal
        isOpen={guideOpen}
        onClose={closeGuide}
        initialAnchor={guideAnchor}
      />
      <PrintWarningDialog
        isOpen={printWarningModal.isOpen}
        onClose={printWarningModal.close}
        onConfirm={() => window.print()}
      />
      <StorageConsentDialog
        isOpen={showStorageConsent}
        onAllow={() => {
          setStorageConsent('allow');
          setShowStorageConsent(false);
          if (pendingSave) {
            pendingSave();
            setPendingSave(null);
          }
        }}
        onDeny={() => {
          setStorageConsent('deny-session');
          setShowStorageConsent(false);
          setPendingSave(null);
        }}
        onDismiss={() => {
          setStorageConsent('ask-later');
          setShowStorageConsent(false);
          setPendingSave(null);
        }}
      />
    </>
  );
}

export default AppShell;
