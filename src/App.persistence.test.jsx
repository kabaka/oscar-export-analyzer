import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { AppProviders } from './app/AppProviders.jsx';
import { AppShell } from './App.jsx';

const memoryStore = { last: null };

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
    await screen.findAllByText('Median AHI');
    await new Promise((r) => setTimeout(r, 600));
    const { putLastSession } = await import('./utils/db');
    expect(putLastSession).toHaveBeenCalled();
    expect(memoryStore.last).not.toBeNull();
  });

  it('imports a session JSON file from the splash modal', async () => {
    const { buildSession } = await import('./utils/session');
    const session = buildSession({
      summaryData: [
        { Date: '2025-06-02', AHI: '3', 'Total Time': '07:00:00' },
      ],
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
    const cards = await screen.findAllByText('Median AHI');
    const cardEl = cards[0].closest('.kpi-card');
    expect(cardEl).not.toBeNull();
    expect(within(cardEl).getByText('3.00')).toBeInTheDocument();
  });

  it('loads a saved session from the splash screen', async () => {
    const { buildSession } = await import('./utils/session');
    memoryStore.last = buildSession({
      summaryData: [
        { Date: '2025-06-03', AHI: '2', 'Total Time': '06:00:00' },
      ],
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
    await screen.findAllByText('Median AHI');
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
