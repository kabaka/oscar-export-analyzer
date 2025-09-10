import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Papa from 'papaparse';
import React from 'react';
import App from './App.jsx';

// In-memory stub store to simulate IndexedDB-backed persistence
const memoryStore = { last: null };

vi.mock('./utils/db', () => {
  return {
    putLastSession: vi.fn(async (session) => {
      memoryStore.last = session;
      return true;
    }),
    getLastSession: vi.fn(async () => memoryStore.last),
    clearLastSession: vi.fn(async () => {
      memoryStore.last = null;
      return true;
    }),
  };
});

describe('App persistence flow', () => {
  beforeEach(() => {
    // Ensure a clean store and timers per test
    memoryStore.last = null;
    vi.useFakeTimers();
    // Clear persistEnabled between tests
    try {
      window.localStorage.removeItem('persistEnabled');
    } catch {
      // ignore storage errors
    }
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces auto-save when enabled and supports save/load/clear controls', async () => {
    render(<App />);

    const remember = screen.getByLabelText(/remember data locally/i);
    const saveNow = screen.getByRole('button', { name: /save session now/i });
    const loadSaved = screen.getByRole('button', {
      name: /load saved session/i,
    });
    const clearSaved = screen.getByRole('button', {
      name: /clear saved session/i,
    });

    // Initially disabled until opt-in
    expect(saveNow).toBeDisabled();

    // Enable persistence; localStorage flag should be set and a debounced save should occur
    fireEvent.click(remember);
    vi.advanceTimersByTime(600);

    const { putLastSession, getLastSession, clearLastSession } = await import(
      './utils/db'
    );
    expect(putLastSession).toHaveBeenCalledTimes(1);
    expect(memoryStore.last).toBeTruthy();
    expect(memoryStore.last).toHaveProperty('clusterParams');

    // Manual save should call put again
    fireEvent.click(saveNow);
    expect(putLastSession).toHaveBeenCalledTimes(2);

    // Load should fetch the saved session
    fireEvent.click(loadSaved);
    expect(getLastSession).toHaveBeenCalledTimes(1);

    // Clear should remove the saved session
    fireEvent.click(clearSaved);
    expect(clearLastSession).toHaveBeenCalledTimes(1);
    expect(memoryStore.last).toBeNull();

    // Disabling persistence should clear again
    fireEvent.click(remember);
    expect(clearLastSession).toHaveBeenCalledTimes(2);
  });

  it('loads saved session and overwrites current data', async () => {
    vi.useRealTimers();
    const { buildSession } = await import('./utils/session');
    memoryStore.last = buildSession({
      summaryData: [
        {
          Date: '2025-06-02',
          'Total Time': '07:00:00',
          AHI: '1',
          'Median EPAP': '5',
        },
      ],
      detailsData: [],
    });

    const parseMock = vi
      .spyOn(Papa, 'parse')
      .mockImplementation((file, options) => {
        const rows = [
          {
            Date: '2025-06-01',
            'Total Time': '08:00:00',
            AHI: '5',
            'Median EPAP': '6',
          },
        ];
        if (options.chunk) {
          options.chunk({ data: rows, meta: { cursor: file.size } });
        }
        if (options.complete) {
          options.complete({ data: rows });
        }
      });

    render(<App />);

    const summaryInput = screen.getByLabelText(/Summary CSV/i);
    const summaryFile = new File(['Date,AHI\n2025-06-01,5'], 'summary.csv', {
      type: 'text/csv',
    });
    await userEvent.upload(summaryInput, summaryFile);

    const card = await screen.findByText('Median AHI');
    const cardEl = card.closest('.kpi-card');
    expect(cardEl).not.toBeNull();
    expect(within(cardEl).getByText('5.00')).toBeInTheDocument();

    const loadSaved = screen.getByRole('button', { name: /load saved session/i });
    fireEvent.click(loadSaved);

    await waitFor(() => {
      const updated = screen.getByText('Median AHI').closest('.kpi-card');
      expect(within(updated).getByText('1.00')).toBeInTheDocument();
    });

    parseMock.mockRestore();
  });

  it('skips invalid duration strings when loading a saved session', async () => {
    const { buildSession } = await import('./utils/session');
    const stats = await import('./utils/stats');
    const spy = vi.spyOn(stats, 'parseDuration');

    memoryStore.last = buildSession({
      summaryData: [
        { Date: '2021-01-01', 'Total Time': '1:00:00', AHI: '1', 'Median EPAP': '5' },
        { Date: '2021-01-02', 'Total Time': 'bad', AHI: '2', 'Median EPAP': '6' },
      ],
      detailsData: [],
    });

    render(<App />);
    const loadSaved = screen.getByRole('button', { name: /load saved session/i });
    fireEvent.click(loadSaved);

    await vi.waitFor(() => expect(spy).toHaveBeenCalled());
    expect(spy.mock.calls.some((c) => c[0] === 'bad')).toBe(true);
    expect(spy.mock.results.some((r) => Number.isNaN(r.value))).toBe(true);
    spy.mockRestore();
  });

});
