import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Papa from 'papaparse';
import { AppProviders } from './app/AppProviders';
import { AppShell } from './App';

describe('Print Page control', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('invokes window.print and hides old report button', async () => {
    window.print = vi.fn();
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

    const menuBtn = await screen.findByRole('button', { name: /menu/i });
    await userEvent.click(menuBtn);
    const printItem = await screen.findByRole('menuitem', {
      name: /Print Page/i,
    });
    expect(printItem).toBeEnabled();
    await userEvent.click(printItem);
    expect(window.print).toHaveBeenCalled();

    expect(
      screen.queryByRole('button', { name: /Open Print Report/i }),
    ).not.toBeInTheDocument();
  });
});
