import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Papa from 'papaparse';
import { AppProviders } from './app/AppProviders';
import { AppShell } from './App';
import { HEADER_IMPORT_COMPLETION_DELAY_MS } from './test-utils/fixtures/timings.js';

describe('Header import progress', () => {
  const OriginalWorker = global.Worker;

  beforeEach(() => {
    // Mock Papa.parse for fast CSV processing
    vi.spyOn(Papa, 'parse').mockImplementation((file, options) => {
      const rows = [{ Date: '2025-06-01' }];
      if (options.chunk)
        options.chunk({ data: rows, meta: { cursor: file.size } });
      if (options.complete) options.complete({ data: rows });
    });

    class MockWorker {
      constructor() {
        this.workerId = null;
      }
      postMessage({ workerId } = {}) {
        this.workerId = workerId;
        // Use Promise.resolve for proper async handling
        Promise.resolve().then(() => {
          this.onmessage?.({ data: { workerId, type: 'progress', cursor: 50 } });
        });
        Promise.resolve().then(() => {
          setTimeout(() => {
            this.onmessage?.({ data: { workerId, type: 'rows', rows: [], cursor: 50 } });
            this.onmessage?.({ data: { workerId, type: 'complete' } });
          }, HEADER_IMPORT_COMPLETION_DELAY_MS);
        });
      }
      terminate() {}
    }
    global.Worker = MockWorker;
  });

  afterEach(() => {
    global.Worker = OriginalWorker;
  });

  it('shows progress text and bar in the header during import', async () => {
    render(
      <AppProviders>
        <AppShell />
      </AppProviders>,
    );
    const input = screen.getByLabelText(/CSV or session files/i);
    const file = new File(['Date\n2025-06-01'], 'summary.csv', {
      type: 'text/csv',
    });
    await userEvent.upload(input, file);

    const header = screen.getByRole('banner');
    expect(
      await within(header).findByText(/Importing summary CSV/i),
    ).toBeInTheDocument();
    expect(within(header).getByRole('progressbar')).toBeInTheDocument();

    await waitFor(
      () => {
        expect(
          within(header).queryByText(/Importing summary CSV/i),
        ).not.toBeInTheDocument();
      },
      { timeout: 8000 },
    );
  });
});
