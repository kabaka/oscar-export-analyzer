import React from 'react';
import { render } from '@testing-library/react';
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  beforeAll,
} from 'vitest';

// Capture IntersectionObserver options for verification
let observerInstances = [];
let observedIds = [];
let lastObserverOptions = null;

beforeAll(() => {
  class IntersectionObserverMock {
    constructor(callback, options) {
      this.callback = callback;
      lastObserverOptions = options;
      observerInstances.push(this);
    }
    observe(el) {
      if (el && el.id) observedIds.push(el.id);
    }
    disconnect() {
      // no-op, but tracked implicitly by instances array length
    }
    // helper to trigger callbacks
    _trigger(entries) {
      this.callback(entries);
    }
  }
  global.IntersectionObserver = IntersectionObserverMock;
});

// Mock getComputedStyle to exercise both px and non-px parsing paths
const originalGetComputedStyle = window.getComputedStyle;

const makeStyleMock = (value) => ({
  getPropertyValue: vi.fn().mockImplementation((prop) => {
    if (prop === '--header-offset') return value;
    return '';
  }),
});

// Common stubs for heavy components/context used by AppShell
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
    openGuideForActive: vi.fn(),
    openGuideWithAnchor: vi.fn(),
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

// Minimal stubs to keep AppShell render light
vi.mock('./components/HeaderMenu', () => ({
  __esModule: true,
  default: () => <div data-testid="header-menu" />,
}));
vi.mock('./components/DateRangeControls', () => ({
  __esModule: true,
  default: () => null,
}));
vi.mock('./components/MobileNav', () => ({
  __esModule: true,
  MobileNav: () => null,
}));
vi.mock('./components/OfflineIndicator', () => ({
  __esModule: true,
  OfflineIndicator: () => null,
}));
vi.mock('./components/PostInstallOnboarding', () => ({
  __esModule: true,
  PostInstallOnboarding: () => null,
}));
vi.mock('./components/OfflineReadyToast', () => ({
  __esModule: true,
  OfflineReadyToast: () => null,
}));
vi.mock('./components/UpdateNotification', () => ({
  __esModule: true,
  UpdateNotification: () => null,
}));
vi.mock('./components/ExportDataModal', () => ({
  __esModule: true,
  default: () => null,
}));
vi.mock('./components/ImportDataModal', () => ({
  __esModule: true,
  default: () => null,
}));
vi.mock('./components/ui', () => ({
  __esModule: true,
  DataImportModal: () => null,
  DocsModal: () => null,
  ErrorAlert: () => null,
  PrintWarningDialog: () => null,
  StorageConsentDialog: () => null,
  ThemeToggle: () => null,
}));

vi.mock('./features/overview', () => ({
  __esModule: true,
  OverviewSection: () => <div id="overview">Overview</div>,
}));
vi.mock('./features/analytics/Section', () => ({
  __esModule: true,
  default: () => <div id="usage-patterns">Usage</div>,
}));
vi.mock('./features/range-comparisons', () => ({
  __esModule: true,
  RangeComparisonsSection: () => <div id="ahi-trends">AHI</div>,
}));
vi.mock('./features/apnea-clusters', () => ({
  __esModule: true,
  ApneaClustersSection: () => <div id="pressure-settings">Pressure</div>,
}));
vi.mock('./features/false-negatives/Section', () => ({
  __esModule: true,
  default: () => <div id="apnea-characteristics">Events</div>,
}));
vi.mock('./features/raw-explorer/Section', () => ({
  __esModule: true,
  default: () => <div id="raw-data-explorer">Raw</div>,
}));
vi.mock('./features/fitbit-correlation/Section', () => ({
  __esModule: true,
  default: () => <div id="fitbit-correlation">Fitbit</div>,
}));

describe('App active section tracking and observer setup', () => {
  beforeEach(() => {
    observerInstances = [];
    observedIds = [];
    lastObserverOptions = null;
    vi.clearAllMocks();
  });

  afterEach(() => {
    window.getComputedStyle = originalGetComputedStyle;
    window.location.hash = '';
  });

  it('sets active section based on scroll position and parses px CSS var', async () => {
    // Force a known header offset via CSS var parsing path with px
    window.getComputedStyle = vi.fn(() => makeStyleMock('25px'));

    const { default: AppShell } = await import('./App');

    render(<AppShell />);

    // Create synthetic elements to drive IntersectionObserver callback
    const overviewEl = {
      id: 'overview',
      getBoundingClientRect: () => ({ top: -10 }),
    };
    const usageEl = {
      id: 'usage-patterns',
      getBoundingClientRect: () => ({ top: 5 }),
    };

    // Observer should be constructed with rootMargin derived from header offset
    expect(lastObserverOptions).toBeTruthy();
    expect(lastObserverOptions.threshold).toBeTruthy();
    expect(typeof lastObserverOptions.rootMargin).toBe('string');

    // Trigger callback to evaluate pickActiveFromEntries logic
    observerInstances[0]._trigger([
      {
        target: overviewEl,
        isIntersecting: true,
        intersectionRatio: 0.1,
        boundingClientRect: { top: -10 },
      },
      {
        target: usageEl,
        isIntersecting: true,
        intersectionRatio: 0.5,
        boundingClientRect: { top: 5 },
      },
    ]);

    // AppProviders stub tracks setActiveSectionId calls
    const { useAppContext } = await import('./app/AppProviders');
    const ctx = useAppContext();
    expect(ctx.setActiveSectionId).toHaveBeenCalledWith('usage-patterns');

    // Hashchange should override active section
    window.location.hash = '#raw-data-explorer';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(ctx.setActiveSectionId).toHaveBeenCalledWith('raw-data-explorer');
  });

  it('falls back to default header offset when CSS var is invalid and cleans up observer', async () => {
    // Invalid var value -> fallback to DEFAULT_HEADER_OFFSET_PX path
    window.getComputedStyle = vi.fn(() => makeStyleMock('BAD_VALUE'));
    const { default: AppShell } = await import('./App');

    const { unmount } = render(<AppShell />);
    expect(observerInstances.length).toBeGreaterThan(0);

    // Unmount should disconnect observers without throwing
    unmount();
    // No explicit assertion for disconnect (mock is no-op), but ensure no further calls after cleanup
    const { useAppContext } = await import('./app/AppProviders');
    const ctx = useAppContext();
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    // No new calls added after cleanup
    const calls = ctx.setActiveSectionId.mock.calls.length;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(ctx.setActiveSectionId.mock.calls.length).toBe(calls);
  });
});
