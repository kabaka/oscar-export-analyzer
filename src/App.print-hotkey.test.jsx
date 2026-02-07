import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';
import Papa from 'papaparse';
import { AppProviders } from './app/AppProviders';
import { AppShell } from './App';

describe('Print hotkey interception', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens print warning dialog when Cmd/Ctrl+P is pressed and data available', async () => {
    // Fast-parse minimal CSVs to mark summaryAvailable true
    vi.spyOn(Papa, 'parse').mockImplementation((file, options) => {
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

    // Wait for app ready state (menu button appears)
    await waitFor(
      () => {
        expect(
          screen.getByRole('button', { name: /^menu$/i }),
        ).toBeInTheDocument();
      },
      { timeout: 8000 },
    );

    // Fire Cmd/Ctrl+P using userEvent for proper event simulation
    const user = userEvent.setup();
    await user.keyboard('{Meta>}p{/Meta}');

    // Print warning dialog should open due to interception when summaryAvailable is true
    const warningDialog = await screen.findByRole('alertdialog', {
      name: /print sensitive health data/i,
    });
    expect(warningDialog).toBeInTheDocument();
  });
});
