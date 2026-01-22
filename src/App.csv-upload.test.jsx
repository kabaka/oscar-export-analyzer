import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AppProviders } from './app/AppProviders';
import { AppShell } from './App';

// Tests cross-component behavior triggered by CSV uploads

describe('CSV uploads and cross-component interactions', () => {
  const OriginalWorker = global.Worker;

  beforeEach(() => {
    class MockWorker {
      constructor() {
        this.workerId = null;
      }
      postMessage({ file, filterEvents, workerId } = {}) {
        this.workerId = workerId;
        const rows = filterEvents
          ? [
              {
                Event: 'ClearAirway',
                DateTime: '2025-06-01T00:00:00',
                'Data/Duration': '12',
              },
            ]
          : [
              {
                Date: '2025-06-01',
                'Total Time': '08:00:00',
                AHI: '5',
                'Median EPAP': '6',
              },
            ];
        // Use Promise.resolve for proper async handling
        Promise.resolve().then(() => {
          this.onmessage?.({
            data: { workerId, type: 'rows', rows, cursor: file.size },
          });
          this.onmessage?.({ data: { workerId, type: 'complete' } });
        });
      }
      terminate() {}
    }
    global.Worker = MockWorker;
  });

  afterEach(() => {
    global.Worker = OriginalWorker;
  });

  it('auto-classifies dropped files and closes the modal', async () => {
    render(
      <AppProviders>
        <AppShell />
      </AppProviders>,
    );

    expect(
      screen.getByRole('dialog', { name: /Import Data/i }),
    ).toBeInTheDocument();

    const input = screen.getByLabelText(/CSV or session files/i);
    const summaryFile = new File(['Date,AHI\n2025-06-01,5'], 'summary.csv', {
      type: 'text/csv',
    });
    const detailsFile = new File(
      ['Event,DateTime,Data/Duration\nClearAirway,2025-06-01T00:00:00,12'],
      'details.csv',
      { type: 'text/csv' },
    );
    await userEvent.upload(input, [summaryFile, detailsFile]);

    await waitFor(
      () => {
        expect(
          screen.getByRole('heading', { name: /Overview Dashboard/i }),
        ).toBeInTheDocument();
      },
      { timeout: 8000 },
    );

    // Default worker stub handles parsing; reaching here implies workers executed
  });
});
