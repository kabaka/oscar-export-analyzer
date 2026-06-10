import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const importState = {
  supported: true,
  state: 'idle',
  progress: null,
  detection: null,
  error: null,
  lastImport: null,
  pickDirectory: vi.fn(),
  scan: vi.fn(),
  startIngest: vi.fn(),
  cancelIngest: vi.fn(),
  reconnect: vi.fn(),
  checkForNewData: vi.fn(),
  forgetFolder: vi.fn(),
};

const dataState = { nights: [], getNightDetail: vi.fn() };
const correlationState = { aligned: [], correlation: null, hasResult: false };

// Capture the args the Section passes into useWearableData so we can assert the
// import-completion signal is wired through as `reloadKey` (BUG 2).
let lastDataArgs = null;

vi.mock('../../hooks/useWearableImport', () => ({
  __esModule: true,
  useWearableImport: () => importState,
}));

vi.mock('../../hooks/useWearableData', () => ({
  __esModule: true,
  useWearableData: (args) => {
    lastDataArgs = args;
    return dataState;
  },
}));

vi.mock('../../hooks/useWearableCorrelation', () => ({
  __esModule: true,
  useWearableCorrelation: () => correlationState,
}));

vi.mock('../../context/DataContext', () => ({
  __esModule: true,
  useData: () => ({ filteredSummary: [{ Date: '2026-01-08' }] }),
}));

vi.mock('../../hooks/useDateFilter', () => ({
  __esModule: true,
  useDateFilter: () => ({ dateFilter: { start: null, end: null } }),
}));

import { WearableCorrelationSection } from './Section';

describe('WearableCorrelationSection', () => {
  beforeEach(() => {
    importState.supported = true;
    importState.state = 'idle';
    importState.lastImport = null;
    dataState.nights = [];
    lastDataArgs = null;
  });

  it('renders the section heading and import card', () => {
    render(<WearableCorrelationSection />);
    expect(
      screen.getByRole('heading', { name: /Wearable Correlation Analysis/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('wearable-import-card')).toBeInTheDocument();
  });

  it('uses the wearable-correlation section id', () => {
    render(<WearableCorrelationSection />);
    const region = screen.getByRole('region', {
      name: /Wearable Correlation Analysis/i,
    });
    expect(region).toHaveAttribute('id', 'wearable-correlation');
  });

  it('renders the unsupported empty-state when not supported', () => {
    importState.supported = false;
    render(<WearableCorrelationSection />);
    expect(
      screen.getByTestId('wearable-import-unsupported'),
    ).toBeInTheDocument();
  });

  it('mounts the dashboard only when wearable nights exist', () => {
    const { rerender } = render(<WearableCorrelationSection />);
    expect(
      screen.queryByTestId('wearable-dashboard-container'),
    ).not.toBeInTheDocument();

    dataState.nights = [{ nightDate: '2026-01-08', nightKey: '2026-01-08' }];
    rerender(<WearableCorrelationSection />);
    expect(
      screen.getByTestId('wearable-dashboard-container'),
    ).toBeInTheDocument();
  });

  it('passes the import-completion signal into useWearableData as reloadKey (BUG 2)', () => {
    // No import yet → no reload signal.
    render(<WearableCorrelationSection />);
    expect(lastDataArgs.reloadKey).toBeNull();

    // An import completes: lastImport is set. The Section must thread its `at`
    // timestamp into useWearableData so the query reloads and the dashboard
    // appears without a date-filter change or refresh.
    importState.lastImport = { at: 1736300000000, nights: 1, dateRange: null };
    // The dashboard becomes visible once the (reloaded) query yields nights.
    dataState.nights = [{ nightDate: '2026-01-08', nightKey: '2026-01-08' }];
    render(<WearableCorrelationSection />);
    expect(lastDataArgs.reloadKey).toBe(1736300000000);
    expect(
      screen.getAllByTestId('wearable-dashboard-container').length,
    ).toBeGreaterThan(0);
  });
});
