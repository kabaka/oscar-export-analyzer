import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterEach,
} from 'vitest';

const swCallbacks = {};
let mockContext;

const createModal = () => ({ isOpen: false, open: vi.fn(), close: vi.fn() });

const createContext = (overrides = {}) => ({
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
  handleEncryptedExport: vi.fn(),
  handleEncryptedImport: vi.fn(),
  onSummaryFile: vi.fn(),
  onDetailsFile: vi.fn(),
  handleLoadSaved: vi.fn(),
  importSessionFile: vi.fn(),
  handleExportJson: vi.fn(),
  exportAggregatesCsv: vi.fn(),
  handleClearSession: vi.fn(),
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
  ...overrides,
});

vi.mock('virtual:pwa-register/react', () => ({
  __esModule: true,
  useRegisterSW: (config = {}) => {
    swCallbacks.onRegistered = config.onRegistered;
    swCallbacks.onRegisterError = config.onRegisterError;
    swCallbacks.onOfflineReady = config.onOfflineReady;
    return { needRefresh: [false, vi.fn()], updateServiceWorker: vi.fn() };
  },
}));

vi.mock('./app/AppProviders', () => ({
  __esModule: true,
  useAppContext: () => mockContext,
}));

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
  default: ({ children, header, beforeHeader, progress, mobileNav }) => (
    <div>
      {beforeHeader}
      {header}
      {progress}
      {mobileNav}
      <main>{children}</main>
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
  PostInstallOnboarding: ({ onComplete, onDismiss }) => (
    <div data-testid="onboarding">
      <button onClick={onComplete}>Complete onboarding</button>
      <button onClick={onDismiss}>Dismiss onboarding</button>
    </div>
  ),
}));

vi.mock('./components/OfflineReadyToast', () => ({
  __esModule: true,
  OfflineReadyToast: ({ show, onDismiss }) =>
    show ? (
      <div data-testid="offline-toast">
        <button onClick={onDismiss}>Close offline toast</button>
      </div>
    ) : null,
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

const setStorageConsent = vi.fn();

vi.mock('./components/ui', () => {
  const StorageConsentDialog = ({ onAllow, onDeny, onDismiss }) => (
    <div data-testid="storage-consent">
      <button onClick={onAllow}>Allow storage</button>
      <button onClick={onDeny}>Deny storage</button>
      <button onClick={onDismiss}>Ask later</button>
    </div>
  );

  return {
    __esModule: true,
    DataImportModal: () => <div data-testid="data-import" />,
    DocsModal: () => null,
    ErrorAlert: () => null,
    PrintWarningDialog: () => <div data-testid="print-dialog" />,
    StorageConsentDialog,
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
  __esModule: true,
  setStorageConsent,
}));

beforeAll(() => {
  class IntersectionObserverMock {
    constructor() {}
    observe() {}
    disconnect() {}
  }
  global.IntersectionObserver = IntersectionObserverMock;
});

beforeEach(() => {
  vi.resetModules();
  mockContext = createContext();
  swCallbacks.onRegistered = undefined;
  swCallbacks.onRegisterError = undefined;
  swCallbacks.onOfflineReady = undefined;
  localStorage.clear();
  window.matchMedia = vi.fn().mockReturnValue({ matches: false });
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('AppShell PWA handlers', () => {
  it('handles service worker events and shows offline toast when ready', async () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });

    const { default: AppShell } = await import('./App');

    render(<AppShell />);

    await act(async () => {
      swCallbacks.onRegistered?.('reg');
      swCallbacks.onRegisterError?.(new Error('fail'));
      swCallbacks.onOfflineReady?.();
    });

    expect(consoleLog).toHaveBeenCalledWith(
      'Service worker registered:',
      'reg',
    );
    expect(consoleError).toHaveBeenCalled();
    expect(await screen.findByTestId('offline-toast')).toBeInTheDocument();
    expect(localStorage.getItem('offline-toast-shown')).toBe('true');
  });

  it('opens onboarding when app is installed and records completion', async () => {
    const { default: AppShell } = await import('./App');

    render(<AppShell />);

    await act(async () => {
      window.dispatchEvent(new Event('appinstalled'));
    });

    expect(await screen.findByTestId('onboarding')).toBeInTheDocument();

    await userEvent.click(screen.getByText(/complete onboarding/i));

    expect(localStorage.getItem('onboarding-completed')).toBe('true');
  });

  it('shows header progress and handles storage consent choices', async () => {
    const pendingSave = vi.fn();
    const setShowStorageConsent = vi.fn();
    const setPendingSave = vi.fn();
    mockContext = createContext({
      loadingSummary: true,
      summaryProgress: 20,
      summaryProgressMax: 100,
      showStorageConsent: true,
      pendingSave,
      setShowStorageConsent,
      setPendingSave,
    });

    const { default: AppShell } = await import('./App');

    render(<AppShell />);

    expect(screen.getByText(/Importing summary CSV/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveValue(20);

    await userEvent.click(screen.getByText(/Allow storage/));
    await userEvent.click(screen.getByText(/Deny storage/));
    await userEvent.click(screen.getByText(/Ask later/));

    expect(setStorageConsent).toHaveBeenCalledWith('allow');
    expect(setStorageConsent).toHaveBeenCalledWith('deny-session');
    expect(setStorageConsent).toHaveBeenCalledWith('ask-later');
    expect(pendingSave).toHaveBeenCalled();
    expect(setShowStorageConsent).toHaveBeenCalled();
    expect(setPendingSave).toHaveBeenCalledWith(null);
  });
});
