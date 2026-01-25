import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  beforeAll,
} from 'vitest';

const openGuideWithAnchor = vi.fn();
const openGuideForActive = vi.fn();
const docsModalRender = vi.fn();
let headerMenuHandlers = {};

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
    summaryProgress: 0,
    summaryProgressMax: 0,
    loadingDetails: false,
    detailsProgress: 0,
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
    openGuideForActive,
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
  default: ({ onOpenGuide }) => {
    headerMenuHandlers.openGuide = onOpenGuide;
    return (
      <button data-testid="header-menu" onClick={() => onOpenGuide()}>
        Menu
      </button>
    );
  },
}));

vi.mock('./components/DateRangeControls', () => ({
  __esModule: true,
  default: () => <div data-testid="date-range" />, // avoid rendering real controls
}));

vi.mock('./components/MobileNav', () => ({
  __esModule: true,
  MobileNav: () => <div data-testid="mobile-nav" />, // keep layout simple
}));

vi.mock('./components/OfflineIndicator', () => ({
  __esModule: true,
  OfflineIndicator: () => <div data-testid="offline-indicator" />, // render stub
}));

vi.mock('./components/PostInstallOnboarding', () => ({
  __esModule: true,
  PostInstallOnboarding: () => <div data-testid="onboarding" />, // stub onboarding
}));

vi.mock('./components/OfflineReadyToast', () => ({
  __esModule: true,
  OfflineReadyToast: () => <div data-testid="offline-toast" />, // stub toast
}));

vi.mock('./components/UpdateNotification', () => ({
  __esModule: true,
  UpdateNotification: () => <div data-testid="update" />, // stub update
}));

vi.mock('./components/ExportDataModal', () => ({
  __esModule: true,
  default: () => <div data-testid="export-modal" />, // stub modal
}));

vi.mock('./components/ImportDataModal', () => ({
  __esModule: true,
  default: () => <div data-testid="import-modal" />, // stub modal
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
    DataImportModal: () => <div data-testid="data-import" />, // stub import
    DocsModal,
    ErrorAlert: () => null,
    PrintWarningDialog: () => <div data-testid="print-dialog" />, // stub print
    StorageConsentDialog: () => <div data-testid="storage-consent" />, // stub consent
    ThemeToggle: () => <div data-testid="theme-toggle" />, // stub toggle
  };
});

vi.mock('./features/overview', () => ({
  __esModule: true,
  OverviewSection: () => <div data-testid="overview-section" />, // stub overview
}));

vi.mock('./features/analytics/Section', () => ({
  __esModule: true,
  default: () => <div data-testid="analytics-section" />, // stub analytics
}));

vi.mock('./features/range-comparisons', () => ({
  __esModule: true,
  RangeComparisonsSection: () => <div data-testid="range-section" />, // stub range
}));

vi.mock('./features/apnea-clusters', () => ({
  __esModule: true,
  ApneaClustersSection: () => <div data-testid="clusters-section" />, // stub clusters
}));

vi.mock('./features/false-negatives/Section', () => ({
  __esModule: true,
  default: () => <div data-testid="false-negatives" />, // stub false negatives
}));

vi.mock('./features/raw-explorer/Section', () => ({
  __esModule: true,
  default: () => <div data-testid="raw-explorer" />, // stub raw explorer
}));

vi.mock('./features/fitbit-correlation/Section', () => ({
  __esModule: true,
  default: () => <div data-testid="fitbit-correlation" />, // stub fitbit correlation
}));

vi.mock('./utils/storageConsent', () => ({
  setStorageConsent: vi.fn(),
}));

beforeAll(() => {
  class IntersectionObserverMock {
    constructor() {}
    observe() {}
    disconnect() {}
  }
  global.IntersectionObserver = IntersectionObserverMock;
});

describe('App hash + guide anchors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    headerMenuHandlers = {};
    window.location.hash = '';
  });

  afterEach(() => {
    window.location.hash = '';
  });

  it('opens docs with footer anchor clicks and updates hash', async () => {
    const { default: AppShell } = await import('./App');

    render(<AppShell />);

    const termsLink = screen.getByRole('link', { name: /terms/i });
    await userEvent.click(termsLink);

    expect(window.location.hash).toBe('#terms-of-service');
    expect(openGuideWithAnchor).toHaveBeenCalledWith('terms-of-service');
  });

  it('ignores unrelated hashes on load', async () => {
    window.location.hash = '#not-docs';
    const { default: AppShell } = await import('./App');

    render(<AppShell />);

    await waitFor(() => {
      expect(openGuideWithAnchor).not.toHaveBeenCalled();
    });
  });

  it('opens guide for active section when invoked without anchor', async () => {
    const { default: AppShell } = await import('./App');

    render(<AppShell />);

    await userEvent.click(screen.getByTestId('header-menu'));

    expect(openGuideForActive).toHaveBeenCalled();
    expect(window.location.hash).toBe('');
  });
});
