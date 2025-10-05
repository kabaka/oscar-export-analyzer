import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import App from './App.jsx';
import { buildSession } from './utils/session.js';

const sampleSummary = [
  {
    Date: '2025-01-01',
    'Total Time': '07:15:00',
    AHI: '2.5',
    'Median EPAP': '7.2',
  },
];

describe('App prehydration', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    window.__OSCAR_PREHYDRATED_SESSION__ = undefined;
    window.history.replaceState({}, '', '/');
    vi.restoreAllMocks();
    if (originalFetch) {
      global.fetch = originalFetch;
    }
  });

  afterEach(() => {
    window.__OSCAR_PREHYDRATED_SESSION__ = undefined;
    window.history.replaceState({}, '', '/');
    if (originalFetch) {
      global.fetch = originalFetch;
    } else {
      delete global.fetch;
    }
  });

  it('hydrates immediately from a pre-injected session object', async () => {
    window.__OSCAR_PREHYDRATED_SESSION__ = buildSession({
      summaryData: sampleSummary,
      detailsData: [],
    });

    render(<App />);

    await screen.findAllByText('Median AHI');
    await waitFor(() => {
      expect(screen.queryByLabelText(/CSV or session files/i)).toBeNull();
    });
    expect(screen.getAllByText('2.50')).not.toHaveLength(0);
  });

  it('fetches and applies a session from the query string', async () => {
    const session = buildSession({
      summaryData: sampleSummary,
      detailsData: [],
    });

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => session,
    }));
    global.fetch = fetchMock;
    window.history.replaceState({}, '', '/?session=https://example.test/session.json');

    render(<App />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    await screen.findAllByText('Median AHI');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
});
