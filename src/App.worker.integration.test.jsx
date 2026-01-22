import { vi, describe, it, expect, afterEach, beforeEach } from 'vitest';
import Papa from 'papaparse';

vi.mock('./utils/analytics', async () => {
  const actual = await vi.importActual('./utils/analytics');
  return {
    ...actual,
    finalizeClusters: vi.fn(actual.finalizeClusters),
  };
});

vi.mock('./components/UsagePatternsCharts', () => ({
  __esModule: true,
  default: () => null,
}));

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProviders } from './app/AppProviders';
import { AppShell } from './App';

describe('Worker Integration Tests', () => {
  const originalWorker = global.Worker;

  beforeEach(() => {
    // Mock Papa.parse for fast CSV processing
    vi.spyOn(Papa, 'parse').mockImplementation((file, options) => {
      const rows = (file.name || '').includes('summary')
        ? [{ Date: '2025-06-01', 'Total Time': '08:00:00' }]
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

  afterEach(() => {
    global.Worker = originalWorker;
    vi.restoreAllMocks();
  });

  it('parses CSVs via worker and displays summary analysis', async () => {
    render(
      <AppProviders>
        <AppShell />
      </AppProviders>,
    );
    const summary = new File(
      ['Date,Total Time\n2025-06-01,08:00:00'],
      'summary.csv',
      { type: 'text/csv' },
    );
    const details = new File(
      ['Event,DateTime,Data/Duration\nClearAirway,2025-06-01T00:00:00,12'],
      'details.csv',
      { type: 'text/csv' },
    );
    const input = screen.getByLabelText(/CSV or session files/i);
    await userEvent.upload(input, [summary, details]);

    await waitFor(
      () => {
        expect(screen.getByText(/Valid nights analyzed/i)).toBeInTheDocument();
      },
      { timeout: 8000 },
    );
  });

  it('renders an error message when CSV parsing fails', async () => {
    class ErrorWorker {
      constructor() {
        this.workerId = null;
      }
      postMessage({ workerId } = {}) {
        this.workerId = workerId;
        // Defer the error callback to allow test infrastructure to set up
        Promise.resolve().then(() => {
          this.onmessage?.({
            data: { workerId, type: 'error', error: 'Malformed CSV' },
          });
        });
      }
      terminate() {}
    }
    global.Worker = ErrorWorker;

    render(
      <AppProviders>
        <AppShell />
      </AppProviders>,
    );
    const file = new File(['bad'], 'bad.csv', { type: 'text/csv' });
    const input = screen.getByLabelText(/CSV or session files/i);
    await userEvent.upload(input, file);

    await waitFor(
      () => {
        expect(screen.getByRole('alert')).toHaveTextContent('Malformed CSV');
      },
      { timeout: 8000 },
    );
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});
