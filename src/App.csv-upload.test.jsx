import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Papa from 'papaparse';
import App from './App';

// Tests cross-component behavior triggered by CSV uploads

describe('CSV uploads and cross-component interactions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows overview after summary upload and raw data explorer after details upload', async () => {
    const parseMock = vi
      .spyOn(Papa, 'parse')
      .mockImplementation((file, options) => {
        const isSummary = file.name.includes('summary');
        const rows = isSummary
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
                'Data/Duration': '12',
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

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /Overview Dashboard/i })
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByRole('heading', { name: /Raw Data Explorer/i })
    ).not.toBeInTheDocument();

    const detailsInput = screen.getByLabelText(/Details CSV/i);
    const detailsFile = new File(
      ['Event,DateTime,Data/Duration\nClearAirway,2025-06-01T00:00:00,12'],
      'details.csv',
      { type: 'text/csv' }
    );
    await userEvent.upload(detailsInput, detailsFile);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /Raw Data Explorer/i })
      ).toBeInTheDocument();
    });

    // Ensure Papa.parse ran for both files using workers
    expect(parseMock).toHaveBeenCalledTimes(2);
    expect(parseMock).toHaveBeenNthCalledWith(
      1,
      summaryFile,
      expect.objectContaining({ worker: true })
    );
    expect(parseMock).toHaveBeenNthCalledWith(
      2,
      detailsFile,
      expect.objectContaining({ worker: true })
    );
  });
});
