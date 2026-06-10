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

vi.mock('../../hooks/useWearableImport', () => ({
  __esModule: true,
  useWearableImport: () => importState,
}));

vi.mock('../../hooks/useWearableData', () => ({
  __esModule: true,
  useWearableData: () => dataState,
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
    dataState.nights = [];
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
});
