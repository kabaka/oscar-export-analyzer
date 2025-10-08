import { vi } from 'vitest';

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

  afterEach(() => {
    global.Worker = originalWorker;
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

    await waitFor(() => {
      expect(screen.getByText(/Valid nights analyzed/i)).toBeInTheDocument();
    });
  });

  it('renders an error message when CSV parsing fails', async () => {
    class ErrorWorker {
      constructor() {}
      postMessage() {
        setTimeout(() => {
          this.onmessage?.({
            data: { type: 'error', error: 'Malformed CSV' },
          });
        }, 0);
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

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Malformed CSV');
    });
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

});
