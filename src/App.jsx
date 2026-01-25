import React, { useEffect, useMemo, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import HeaderMenu from './components/HeaderMenu';
import DateRangeControls from './components/DateRangeControls';
import { MobileNav } from './components/MobileNav';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PostInstallOnboarding } from './components/PostInstallOnboarding';
import { OfflineReadyToast } from './components/OfflineReadyToast';
import { UpdateNotification } from './components/UpdateNotification';
import ExportDataModal from './components/ExportDataModal';
import ImportDataModal from './components/ImportDataModal';
import {
  DataImportModal,
  DocsModal,
  ErrorAlert,
  PrintWarningDialog,
  StorageConsentDialog,
  ThemeToggle,
} from './components/ui';
import AppLayout from './app/AppLayout';
import { useAppContext } from './app/AppProviders';
import { useGuideContext } from './context/GuideContext';
import { OverviewSection } from './features/overview';
import AnalyticsSection from './features/analytics/Section';
import { RangeComparisonsSection } from './features/range-comparisons';
import { ApneaClustersSection } from './features/apnea-clusters';
import FalseNegativesSection from './features/false-negatives/Section';
import RawExplorerSection from './features/raw-explorer/Section';
import FitbitCorrelationSection from './features/fitbit-correlation/Section';
import { setStorageConsent } from './utils/storageConsent';
import {
  DEFAULT_HEADER_OFFSET_PX,
  OBSERVER_THRESHOLDS,
  PERCENT_SCALE,
  SCROLL_RESIZE_THROTTLE_MS,
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
    exportEncryptedModal,
    importEncryptedModal,
    exportEncryptedLoading,
    exportEncryptedError,
    setExportEncryptedError,
    importEncryptedLoading,
    importEncryptedError,
    setImportEncryptedError,
    crossDeviceDetected,
    handleEncryptedExport,
    handleEncryptedImport,
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
    setError,
    setWarning,
    activeSectionId,
    setActiveSectionId,
    filteredSummary,
    filteredDetails,
    showStorageConsent,
    setShowStorageConsent,
    pendingSave,
    setPendingSave,
  } = useAppContext();

  const { guideOpen, guideAnchor, openGuideForActive, closeGuide } =
    useGuideContext();

  // PWA UI state
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showOfflineToast, setShowOfflineToast] = useState(false);

  // Service worker registration and update notification
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('Service worker registered:', r);
    },
    onRegisterError(error) {
      console.error('Service worker registration error:', error);
    },
    onOfflineReady() {
      console.log('App ready to work offline');

      // Only show toast in installed PWA (standalone mode)
      const isStandalone = window.matchMedia(
        '(display-mode: standalone)',
      ).matches;
      const hasSeenToast = localStorage.getItem('offline-toast-shown');

      if (isStandalone && !hasSeenToast) {
        setShowOfflineToast(true);
        localStorage.setItem('offline-toast-shown', 'true');
      }
    },
  });

  const handleUpdateClick = () => {
    updateServiceWorker(true); // Force reload to apply update
  };

  const handleUpdateDismiss = () => {
    setNeedRefresh(false);
  };

  // Listen for app installation event
  useEffect(() => {
    const handleAppInstalled = () => {
      // Check if onboarding has been completed before
      const hasCompletedOnboarding = localStorage.getItem(
        'onboarding-completed',
      );
      if (!hasCompletedOnboarding) {
        setShowOnboarding(true);
      }
    };

    window.addEventListener('appinstalled', handleAppInstalled);
    return () => window.removeEventListener('appinstalled', handleAppInstalled);
  }, []);

  const handleOnboardingComplete = () => {
    localStorage.setItem('onboarding-completed', 'true');
  };

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
      { id: 'fitbit-correlation', label: 'Fitbit Analysis' },
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

    const pickActiveFromEntries = (entries) => {
      if (!entries || entries.length === 0) {
        pickActive();
        return;
      }

      const intersecting = entries.filter(
        (entry) => entry.isIntersecting || entry.intersectionRatio > 0,
      );
      const candidates = intersecting.length ? intersecting : entries;

      const best = candidates.reduce((bestEntry, entry) => {
        if (!bestEntry) return entry;

        if (entry.intersectionRatio !== bestEntry.intersectionRatio) {
          return entry.intersectionRatio > bestEntry.intersectionRatio
            ? entry
            : bestEntry;
        }

        const entryTop =
          entry.boundingClientRect?.top ?? Number.POSITIVE_INFINITY;
        const bestTop =
          bestEntry.boundingClientRect?.top ?? Number.POSITIVE_INFINITY;

        return entryTop < bestTop ? entry : bestEntry;
      }, null);

      if (best?.target?.id) {
        setActiveSectionId(best.target.id);
        return;
      }

      pickActive();
    };

    // Throttle implementation for scroll/resize handlers
    let lastCallTime = 0;
    let timeoutId = null;
    const throttledPickActive = () => {
      const now = Date.now();
      const timeSinceLastCall = now - lastCallTime;

      if (timeSinceLastCall >= SCROLL_RESIZE_THROTTLE_MS) {
        // Enough time has passed, execute immediately
        lastCallTime = now;
        pickActive();
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      } else {
        // Not enough time has passed, schedule for later
        if (!timeoutId) {
          const remainingDelay = SCROLL_RESIZE_THROTTLE_MS - timeSinceLastCall;
          timeoutId = setTimeout(() => {
            lastCallTime = Date.now();
            pickActive();
            timeoutId = null;
          }, remainingDelay);
        }
      }
    };

    // Use IntersectionObserver which handles its own throttling naturally
    const observer = new IntersectionObserver(
      (entries) => {
        pickActiveFromEntries(entries);
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

    window.addEventListener('scroll', throttledPickActive, { passive: true });
    window.addEventListener('resize', throttledPickActive);

    pickActive();

    return () => {
      observer.disconnect();
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('scroll', throttledPickActive);
      window.removeEventListener('resize', throttledPickActive);
      if (timeoutId) clearTimeout(timeoutId);
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
      <ExportDataModal
        isOpen={exportEncryptedModal.isOpen}
        onClose={() => {
          exportEncryptedModal.close();
          setExportEncryptedError(null);
        }}
        onExport={handleEncryptedExport}
        isExporting={exportEncryptedLoading}
        error={exportEncryptedError}
      />
      <ImportDataModal
        isOpen={importEncryptedModal.isOpen}
        onClose={() => {
          importEncryptedModal.close();
          setImportEncryptedError(null);
        }}
        onImport={handleEncryptedImport}
        isImporting={importEncryptedLoading}
        error={importEncryptedError}
        crossDevice={crossDeviceDetected}
      />
      {error && (
        <ErrorAlert
          message={error}
          severity="error"
          onDismiss={() => setError(null)}
        />
      )}
      {warning && !error && (
        <ErrorAlert
          message={warning}
          severity="warning"
          onDismiss={() => setWarning(null)}
        />
      )}
    </>
  );

  const header = (
    <div className="inner">
      <div className="title">
        <h1>OSCAR Sleep Data Analysis</h1>
        <span className="badge">beta</span>
      </div>
      <DateRangeControls />
      <div className="actions">
        <ThemeToggle />
        <OfflineIndicator />
        <HeaderMenu
          onOpenImport={importModal.open}
          onExportJson={handleExportJson}
          onExportCsv={exportAggregatesCsv}
          onExportEncrypted={exportEncryptedModal.open}
          onImportEncrypted={importEncryptedModal.open}
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

  const mobileNav = (
    <MobileNav
      sections={tocSections}
      activeSectionId={activeSectionId}
      onNavigate={(id) => {
        setActiveSectionId(id);
        // Scroll to section
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }}
    />
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
        mobileNav={mobileNav}
      >
        {summaryHasRows && (
          <>
            <OverviewSection />
            <AnalyticsSection />
            <RangeComparisonsSection />
            <FitbitCorrelationSection />
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
      {showOnboarding && (
        <PostInstallOnboarding
          onDismiss={() => setShowOnboarding(false)}
          onComplete={handleOnboardingComplete}
        />
      )}
      <OfflineReadyToast
        show={showOfflineToast}
        onDismiss={() => setShowOfflineToast(false)}
      />
      {needRefresh && (
        <UpdateNotification
          onUpdate={handleUpdateClick}
          onDismiss={handleUpdateDismiss}
        />
      )}
    </>
  );
}

export default AppShell;
