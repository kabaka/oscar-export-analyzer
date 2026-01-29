import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const openGuideWithAnchor = vi.fn();
const docsModalRender = vi.fn();

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, vi.fn()],
    updateServiceWorker: vi.fn(),
  }),
}));

vi.mock('./app/AppProviders', () => {
  const createModal = () => ({ isOpen: false, open: vi.fn(), close: vi.fn() });
  const noop = vi.fn();
  const baseContext = {
    loadingSummary: false,
    // eslint-disable-next-line no-magic-numbers -- test data
    summaryProgress: 0,
    // eslint-disable-next-line no-magic-numbers -- test data
    summaryProgressMax: 0,
    loadingDetails: false,
    // eslint-disable-next-line no-magic-numbers -- test data
    detailsProgress: 0,
    // eslint-disable-next-line no-magic-numbers -- test data
    detailsProgressMax: 0,
    processing: false,
    importModal: createModal(),
    printWarningModal: createModal(),
    exportEncryptedModal: createModal(),
    importEncryptedModal: createModal(),
    exportEncryptedLoading: false,
    exportEncryptedError: null,
    setExportEncryptedError: vi.fn(),
    importEncryptedLoading: false,
    importEncryptedError: null,
    setImportEncryptedError: vi.fn(),
    crossDeviceDetected: false,
    handleEncryptedExport: noop,
    handleEncryptedImport: noop,
    onSummaryFile: noop,
    onDetailsFile: noop,
    handleLoadSaved: noop,
    importSessionFile: noop,
    handleExportJson: noop,
    exportAggregatesCsv: noop,
    handleClearSession: noop,
    hasAnyData: false,
    summaryAvailable: false,
    error: null,
    warning: null,
    setError: vi.fn(),
    setWarning: vi.fn(),
    activeSectionId: 'overview',
    setActiveSectionId: vi.fn(),
    filteredSummary: [],
    filteredDetails: [],
    showStorageConsent: false,
    setShowStorageConsent: vi.fn(),
    pendingSave: null,
    setPendingSave: vi.fn(),
  };

  return {
    __esModule: true,
    useAppContext: () => baseContext,
  };
});

vi.mock('./context/GuideContext', () => ({
  __esModule: true,
  useGuideContext: () => ({
    guideOpen: false,
    guideAnchor: '',
    openGuideForActive: vi.fn(),
    openGuideWithAnchor,
    closeGuide: vi.fn(),
  }),
}));

vi.mock('./app/AppLayout', () => ({
  __esModule: true,
  default: ({ children, toc, header, beforeHeader, progress, mobileNav }) => (
    <div data-testid="layout">
      {beforeHeader}
      {header}
      {progress}
      {toc}
      {mobileNav}
      {children}
    </div>
  ),
}));

vi.mock('./components/HeaderMenu', () => ({
  __esModule: true,
  default: () => <div data-testid="header-menu" />,
}));

vi.mock('./components/DateRangeControls', () => ({
  __esModule: true,
  default: () => <div data-testid="date-range" />,
}));

vi.mock('./components/MobileNav', () => ({
  __esModule: true,
  MobileNav: () => <div data-testid="mobile-nav" />,
}));

vi.mock('./components/OfflineIndicator', () => ({
  __esModule: true,
  OfflineIndicator: () => <div data-testid="offline-indicator" />,
}));

vi.mock('./components/PostInstallOnboarding', () => ({
  __esModule: true,
  PostInstallOnboarding: () => <div data-testid="onboarding" />,
}));

vi.mock('./components/OfflineReadyToast', () => ({
  __esModule: true,
  OfflineReadyToast: () => <div data-testid="offline-toast" />,
}));

vi.mock('./components/UpdateNotification', () => ({
  __esModule: true,
  UpdateNotification: () => <div data-testid="update" />,
}));

vi.mock('./components/ExportDataModal', () => ({
  __esModule: true,
  default: () => <div data-testid="export-modal" />,
}));

vi.mock('./components/ImportDataModal', () => ({
  __esModule: true,
  default: () => <div data-testid="import-modal" />,
}));

vi.mock('./components/AppFooter', () => ({
  __esModule: true,
  default: () => <div data-testid="footer" />,
}));

vi.mock('./components/ui', () => {
  const DocsModal = ({ isOpen, initialAnchor }) => {
    docsModalRender({ isOpen, initialAnchor });
    if (!isOpen) return null;
    return (
      <div data-testid="docs-modal" data-anchor={initialAnchor}>
        Docs
      </div>
    );
  };

  return {
    __esModule: true,
    DataImportModal: () => <div data-testid="data-import" />,
    DocsModal,
    ErrorAlert: () => null,
    PrintWarningDialog: () => <div data-testid="print-dialog" />,
    StorageConsentDialog: () => <div data-testid="storage-consent" />,
    ThemeToggle: () => <div data-testid="theme-toggle" />,
  };
});

vi.mock('./features/overview', () => ({
  __esModule: true,
  OverviewSection: () => <div data-testid="overview-section" />,
}));

vi.mock('./features/analytics/Section', () => ({
  __esModule: true,
  default: () => <div data-testid="analytics-section" />,
}));

vi.mock('./features/range-comparisons', () => ({
  __esModule: true,
  RangeComparisonsSection: () => <div data-testid="range-section" />,
}));

vi.mock('./features/apnea-clusters', () => ({
  __esModule: true,
  ApneaClustersSection: () => <div data-testid="clusters-section" />,
}));

vi.mock('./features/false-negatives/Section', () => ({
  __esModule: true,
  default: () => <div data-testid="false-negatives" />,
}));

vi.mock('./features/raw-explorer/Section', () => ({
  __esModule: true,
  default: () => <div data-testid="raw-explorer" />,
}));

vi.mock('./features/fitbit-correlation/Section', () => ({
  __esModule: true,
  default: () => <div data-testid="fitbit-correlation" />,
}));

vi.mock('./utils/storageConsent', () => ({
  setStorageConsent: vi.fn(),
}));

describe('Legal docs hash handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.hash = '';
  });

  afterEach(() => {
    window.location.hash = '';
  });

  it('opens the guide at privacy policy when hash matches and leaves modal closed by default', async () => {
    window.location.hash = '#privacy-policy';
    const { default: AppShell } = await import('./App');

    render(<AppShell />);

    await waitFor(() => {
      expect(openGuideWithAnchor).toHaveBeenCalledWith('privacy-policy');
    });

    expect(screen.queryByTestId('docs-modal')).not.toBeInTheDocument();
    expect(docsModalRender).toHaveBeenCalledWith(
      expect.objectContaining({ isOpen: false, initialAnchor: '' }),
    );
  });
});
