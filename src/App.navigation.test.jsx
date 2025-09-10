import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Papa from 'papaparse';
import App from './App';

describe('In-page navigation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    // Reset hash between tests
    window.location.hash = '';
  });

  it('renders Overview with only Summary CSV and updates hash on click', async () => {
    const parseMock = vi
      .spyOn(Papa, 'parse')
      .mockImplementation((file, options) => {
        // Simulate parsing a minimal Summary row
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

    // Upload only the Summary CSV
    const input = screen.getByLabelText(/Summary CSV/i);
    const file = new File(['Date,AHI\n2025-06-01,5'], 'summary.csv', {
      type: 'text/csv',
    });
    await userEvent.upload(input, file);

    // Overview section should render (no Details required)
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /Overview Dashboard/i }),
      ).toBeInTheDocument();
    });

    // SummaryAnalysis section should also render
    expect(
      await screen.findByRole('heading', { name: /Usage Patterns/i }),
    ).toBeInTheDocument();

    // Clicking the Overview link should update the hash
    const overviewLink = screen.getByRole('link', { name: /Overview/i });
    expect(overviewLink).toHaveAttribute('href', '#overview');
    await userEvent.click(overviewLink);
    expect(window.location.hash).toBe('#overview');

    // Ensure Papa.parse was invoked using worker mode
    expect(parseMock).toHaveBeenCalledWith(
      file,
      expect.objectContaining({ worker: true }),
    );
  });
});
