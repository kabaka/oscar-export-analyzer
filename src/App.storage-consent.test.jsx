import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as storageConsent from './utils/storageConsent';

// Capture setter mocks to assert AppShell handlers
const setShowStorageConsentMock = vi.fn();
const pendingSaveMock = vi.fn();
const setPendingSaveMock = vi.fn();

// Spy on storage consent utility
const setStorageConsentSpy = vi.spyOn(storageConsent, 'setStorageConsent');

// Mock app context to control StorageConsentDialog state
vi.mock('./app/AppProviders', () => ({
  __esModule: true,
  useAppContext: () => ({
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
    importModal: { isOpen: false, open: vi.fn(), close: vi.fn() },
    printWarningModal: { isOpen: false, open: vi.fn(), close: vi.fn() },
    exportEncryptedModal: { isOpen: false, open: vi.fn(), close: vi.fn() },
    importEncryptedModal: { isOpen: false, open: vi.fn(), close: vi.fn() },
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
    filteredSummary: null,
    filteredDetails: null,
    // Add date filter fields used by DateRangeControls
    dateFilter: { start: null, end: null },
    // eslint-disable-next-line no-magic-numbers -- test data
    formatDate: (d) => (d ? '2024-01-01' : ''),
    selectCustomRange: vi.fn(),
    resetDateFilter: vi.fn(),
    showStorageConsent: true,
    setShowStorageConsent: setShowStorageConsentMock,
    pendingSave: pendingSaveMock,
    setPendingSave: setPendingSaveMock,
  }),
}));

// Minimal guide context to satisfy AppShell
vi.mock('./context/GuideContext', () => ({
  __esModule: true,
  useGuideContext: () => ({
    guideOpen: false,
    guideAnchor: null,
    openGuideForActive: vi.fn(),
    openGuideWithAnchor: vi.fn(),
    closeGuide: vi.fn(),
  }),
}));

// Avoid DateRangeControls accessing dateFilter
vi.mock('./components/DateRangeControls', () => ({
  __esModule: true,
  default: () => null,
}));

// Avoid theme context dependencies in header
vi.mock('./components/ui/ThemeToggle', () => ({
  __esModule: true,
  default: () => null,
}));

// Avoid PWA registration side effects
vi.mock('virtual:pwa-register/react', () => ({
  __esModule: true,
  useRegisterSW: () => ({
    needRefresh: [false, vi.fn()],
    updateServiceWorker: vi.fn(),
  }),
}));

import AppShell from './App.jsx';

describe('Storage consent dialog actions', () => {
  it('invokes onAllow and triggers save + closes via setter', async () => {
    render(<AppShell />);

    const dialog = await screen.findByRole('alertdialog', {
      name: /Save Data to This Browser/i,
    });

    expect(dialog).toBeInTheDocument();

    const allowBtn = screen.getByRole('button', {
      name: /^Save data to browser$/i,
    });
    allowBtn.click();

    // Assert AppShell wired handlers executed
    expect(setStorageConsentSpy).toHaveBeenCalledWith('allow');
    expect(setShowStorageConsentMock).toHaveBeenCalledWith(false);
    expect(pendingSaveMock).toHaveBeenCalled();
    expect(setPendingSaveMock).toHaveBeenCalledWith(null);
  });
});
