import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import Papa from 'papaparse';
import { AppProviders } from './app/AppProviders.jsx';
import { AppShell } from './App.jsx';
import { AUTO_SAVE_FLUSH_DELAY_MS } from './test-utils/fixtures/timings.js';

const memoryStore = { last: null };

// Mock storage consent to allow auto-saves
vi.mock('./utils/storageConsent', () => ({
  getStorageConsent: vi.fn(() => true),
  setStorageConsent: vi.fn(),
  revokeStorageConsent: vi.fn(),
}));

vi.mock('./utils/db', () => ({
  putLastSession: vi.fn(async (session) => {
    memoryStore.last = session;
    return true;
  }),
  getLastSession: vi.fn(async () => memoryStore.last),
}));

describe('App persistence flow', () => {
  beforeEach(() => {
    memoryStore.last = null;
    vi.clearAllMocks();
    // Mock Papa.parse for fast CSV processing in tests
    vi.spyOn(Papa, 'parse').mockImplementation((file, options) => {
      const rows = (file.name || '').includes('summary')
        ? [
            {
              Date: '2025-06-01',
              'Total Time': '08:00:00',
              AHI: '5',
              'Median EPAP': '6',
            },
          ]
        : [
            {
              Event: 'ClearAirway',
              DateTime: '2025-06-01T00:00:00',
              'Data/Duration': 12,
            },
          ];
      if (options.chunk)
        options.chunk({ data: rows, meta: { cursor: file.size } });
      if (options.complete) options.complete({ data: rows });
    });
  });

  it('auto-saves after loading CSVs', async () => {
    render(
      <AppProviders>
        <AppShell />
      </AppProviders>,
    );
    const input = await screen.findByLabelText(/CSV or session files/i);
    const summaryFile = new File(['Date,AHI\n2025-06-01,5'], 'summary.csv', {
      type: 'text/csv',
    });
    const detailsFile = new File(
      ['Event,DateTime,Data/Duration\nClearAirway,2025-06-01T00:00:00,12'],
      'details.csv',
      { type: 'text/csv' },
    );
    await userEvent.upload(input, [summaryFile, detailsFile]);
    // Wait for CSV processing to complete - use getAllByText since "Median AHI" appears in multiple places
    await waitFor(
      () => {
        expect(screen.getAllByText('Median AHI').length).toBeGreaterThan(0);
      },
      { timeout: 8000 },
    );
    await new Promise((r) => setTimeout(r, AUTO_SAVE_FLUSH_DELAY_MS));
    const { putLastSession } = await import('./utils/db');
    expect(putLastSession).toHaveBeenCalled();
    expect(memoryStore.last).not.toBeNull();
  });

  it('imports a session JSON file from the splash modal', async () => {
    const { buildSession } = await import('./utils/session');
    const session = buildSession({
      summaryData: [{ Date: '2025-06-02', AHI: '3', 'Total Time': '07:00:00' }],
      detailsData: [],
    });
    const file = new File([JSON.stringify(session)], 'sess.json', {
      type: 'application/json',
    });

    render(
      <AppProviders>
        <AppShell />
      </AppProviders>,
    );
    const input = await screen.findByLabelText(/CSV or session files/i);
    await userEvent.upload(input, file);
    const cards = await waitFor(() => screen.findAllByText('Median AHI'), {
      timeout: 8000,
    });
    const cardEl = cards[0].closest('.kpi-card');
    expect(cardEl).not.toBeNull();
    expect(within(cardEl).getByText('3.00')).toBeInTheDocument();
  });

  it('loads a saved session from the splash screen', async () => {
    const { buildSession } = await import('./utils/session');
    memoryStore.last = buildSession({
      summaryData: [{ Date: '2025-06-03', AHI: '2', 'Total Time': '06:00:00' }],
      detailsData: [],
    });

    render(
      <AppProviders>
        <AppShell />
      </AppProviders>,
    );
    const loadBtn = await screen.findByRole('button', {
      name: /Load previous session/i,
    });
    await userEvent.click(loadBtn);
    await waitFor(
      () => {
        // Use findAllByText to get all instances, then check at least one exists
        const elems = screen.queryAllByText('Median AHI');
        expect(elems.length).toBeGreaterThan(0);
      },
      { timeout: 8000 },
    );
    const { getLastSession } = await import('./utils/db');
    expect(getLastSession).toHaveBeenCalled();
  });

  it('shows an error for invalid session JSON', async () => {
    render(
      <AppProviders>
        <AppShell />
      </AppProviders>,
    );
    const input = await screen.findByLabelText(/CSV or session files/i);
    const badFile = new File(['{'], 'bad.json', { type: 'application/json' });
    await userEvent.upload(input, badFile);
    await screen.findByRole('alert');
    expect(memoryStore.last).toBeNull();
  });
});
