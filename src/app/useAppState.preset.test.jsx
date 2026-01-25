import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

// Hoist mocks before importing modules that consume them
vi.mock('../hooks/useAnalyticsProcessing', () => ({
  __esModule: true,
  useAnalyticsProcessing: vi.fn(() => ({
    apneaClusters: [],
    falseNegatives: [],
    processing: { step: 'idle', done: true, error: null },
  })),
}));

vi.mock('../hooks/useSessionManager', () => ({
  __esModule: true,
  useSessionManager: vi.fn(() => ({
    // Methods expected by useAppState
    handleLoadSaved: vi.fn(async () => undefined),
    handleExportJson: vi.fn(() => undefined),
    importSessionFile: vi.fn(async () => ({ ok: true })),
    // Extra no-op shape to satisfy potential consumers
    saveSession: vi.fn(async () => undefined),
    loadSession: vi.fn(async () => null),
    hasSavedSession: false,
  })),
}));

vi.mock('../utils/exportImport', () => ({
  __esModule: true,
  exportEncryptedData: vi.fn(async () => undefined),
  importEncryptedData: vi.fn(async () => ({
    summaryData: null,
    detailsData: null,
  })),
}));

import { AppProviders, useAppContext } from './AppProviders';

function PresetTester() {
  const { fnPreset, setFnPreset } = useAppContext();
  return (
    <div>
      <div data-testid="preset">{fnPreset}</div>
      <button onClick={() => setFnPreset('strict')}>strict</button>
      <button onClick={() => setFnPreset('lenient')}>lenient</button>
      <button onClick={() => setFnPreset('invalid')}>invalid</button>
    </div>
  );
}

describe('useAppState false-negative preset transitions', () => {
  it('switches between presets and exercises fnOptions memoization', async () => {
    render(
      <AppProviders>
        <PresetTester />
      </AppProviders>,
    );

    // Default is balanced
    expect(screen.getByTestId('preset')).toHaveTextContent('balanced');

    await userEvent.click(screen.getByRole('button', { name: 'strict' }));
    expect(screen.getByTestId('preset')).toHaveTextContent('strict');

    await userEvent.click(screen.getByRole('button', { name: 'lenient' }));
    expect(screen.getByTestId('preset')).toHaveTextContent('lenient');

    // Invalid value should still set fnPreset, and fnOptions memo will use balanced fallback internally
    await userEvent.click(screen.getByRole('button', { name: 'invalid' }));
    expect(screen.getByTestId('preset')).toHaveTextContent('invalid');
  });
});
