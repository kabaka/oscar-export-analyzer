import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
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
let needRefreshValue;
let setNeedRefreshMock;
let updateServiceWorkerMock;

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
    return {
      needRefresh: [needRefreshValue, setNeedRefreshMock],
      updateServiceWorker: updateServiceWorkerMock,
    };
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
  default: ({ beforeHeader, header, progress, toc, mobileNav, children }) => (
    <div>
      <div role="banner">
        {beforeHeader}
        {header}
        {progress}
      </div>
      <nav>{toc}</nav>
      <div>{mobileNav}</div>
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
  PostInstallOnboarding: () => <div data-testid="onboarding" />,
}));

vi.mock('./components/OfflineReadyToast', () => ({
  __esModule: true,
  OfflineReadyToast: ({ show, onDismiss }) =>
    show ? (
      <div data-testid="offline-toast">
        <button onClick={onDismiss}>Dismiss offline toast</button>
      </div>
    ) : null,
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
  const StorageConsentDialog = ({ isOpen, onAllow, onDeny, onDismiss }) =>
    isOpen ? (
      <div data-testid="storage-consent">
        <button onClick={onAllow}>Allow storage</button>
        <button onClick={onDeny}>Deny storage</button>
        <button onClick={onDismiss}>Ask later</button>
      </div>
    ) : null;

  return {
    __esModule: true,
    DataImportModal: () => null,
    DocsModal: () => null,
    ErrorAlert: () => null,
    PrintWarningDialog: () => null,
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
    observe() {}
    disconnect() {}
  }
  global.IntersectionObserver = IntersectionObserverMock;
});

beforeEach(() => {
  vi.resetModules();
  mockContext = createContext();
  needRefreshValue = false;
  setNeedRefreshMock = vi.fn();
  updateServiceWorkerMock = vi.fn();
  swCallbacks.onRegistered = undefined;
  swCallbacks.onRegisterError = undefined;
  swCallbacks.onOfflineReady = undefined;
  localStorage.clear();
  window.matchMedia = vi.fn().mockReturnValue({ matches: false });
});

afterEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

const renderApp = async () => {
  const { AppShell } = await import('./App');
  return render(<AppShell />);
};

describe('AppShell edge states', () => {
  it('renders update notification and handles confirm and dismiss', async () => {
    needRefreshValue = true;
    const user = userEvent.setup();

    await renderApp();

    expect(
      screen.getByRole('alertdialog', { name: /new version available/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /update now/i }));
    expect(updateServiceWorkerMock).toHaveBeenCalledWith(true);

    await user.click(
      screen.getByRole('button', {
        name: /dismiss update notification/i,
      }),
    );
    expect(setNeedRefreshMock).toHaveBeenCalledWith(false);
  });

  it('shows offline toast only when standalone and hides after dismiss', async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    const user = userEvent.setup();

    await renderApp();

    await act(async () => {
      swCallbacks.onOfflineReady?.();
    });

    const toast = screen.getByTestId('offline-toast');
    expect(toast).toBeInTheDocument();

    await user.click(screen.getByText(/dismiss offline toast/i));

    await waitFor(() => {
      expect(screen.queryByTestId('offline-toast')).not.toBeInTheDocument();
    });
  });

  it('does not show offline toast when not in standalone mode or already seen', async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    await renderApp();

    await act(async () => {
      swCallbacks.onOfflineReady?.();
    });

    expect(screen.queryByTestId('offline-toast')).not.toBeInTheDocument();

    localStorage.setItem('offline-toast-shown', 'true');
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });

    await renderApp();
    await act(async () => {
      swCallbacks.onOfflineReady?.();
    });

    expect(screen.queryByTestId('offline-toast')).not.toBeInTheDocument();
  });

  it('handles storage consent allow, deny, and dismiss actions', async () => {
    const pendingSave = vi.fn();
    const setShowStorageConsent = vi.fn();
    const setPendingSave = vi.fn();
    mockContext = createContext({
      showStorageConsent: true,
      pendingSave,
      setShowStorageConsent,
      setPendingSave,
    });
    const user = userEvent.setup();

    await renderApp();

    await user.click(screen.getByText(/allow storage/i));
    expect(setStorageConsent).toHaveBeenCalledWith('allow');
    expect(setShowStorageConsent).toHaveBeenCalledWith(false);
    expect(pendingSave).toHaveBeenCalled();
    expect(setPendingSave).toHaveBeenCalledWith(null);

    await user.click(screen.getByText(/deny storage/i));
    expect(setStorageConsent).toHaveBeenCalledWith('deny-session');
    expect(setShowStorageConsent).toHaveBeenCalledWith(false);
    expect(setPendingSave).toHaveBeenCalledWith(null);

    await user.click(screen.getByText(/ask later/i));
    expect(setStorageConsent).toHaveBeenCalledWith('ask-later');
    expect(setShowStorageConsent).toHaveBeenCalledWith(false);
    expect(setPendingSave).toHaveBeenCalledWith(null);
  });

  it('renders summary import progress with percentage', async () => {
    mockContext = createContext({
      loadingSummary: true,
      summaryProgress: 50,
      summaryProgressMax: 100,
    });

    await renderApp();

    expect(
      screen.getByText(/importing summary csv \(50%\)/i),
    ).toBeInTheDocument();
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveValue(50);
    expect(progressBar).toHaveAttribute('max', '100');
  });

  it('renders details import progress when summary already available', async () => {
    mockContext = createContext({
      filteredSummary: [{ id: 1 }],
      loadingDetails: true,
      detailsProgress: 25,
      detailsProgressMax: 50,
    });

    await renderApp();

    expect(
      screen.getByText(/importing details csv \(50%\)/i),
    ).toBeInTheDocument();
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveValue(25);
    expect(progressBar).toHaveAttribute('max', '50');
  });
});
