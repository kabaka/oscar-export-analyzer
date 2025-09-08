import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Papa from 'papaparse';
import App from './App';

describe('Worker Integration Tests', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses summary CSV via worker and displays summary analysis', async () => {
    // Spy on Papa.parse to simulate worker-based parsing
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
        // simulate a parsing chunk with progress update
        if (options.chunk) {
          options.chunk({ data: rows, meta: { cursor: file.size } });
        }
        // simulate completion of parsing
        if (options.complete) {
          options.complete({ data: rows });
        }
      });

    render(<App />);
    // Upload a fake CSV file via the Summary CSV input
    const csvContent = 'Night,Data/Duration\n2025-06-01,8';
    const file = new File([csvContent], 'summary.csv', { type: 'text/csv' });
    const input = screen.getByLabelText(/Summary CSV/i);
    await userEvent.upload(input, file);

    // Expect Papa.parse to be called with worker:true
    expect(parseMock).toHaveBeenCalledWith(
      file,
      expect.objectContaining({ worker: true })
    );

    // Wait for the summary analysis to render
    await waitFor(() => {
      expect(screen.getByText(/Total nights analyzed/i)).toBeInTheDocument();
    });
  });

  it('renders an error message when CSV parsing fails', async () => {
    const parseMock = vi
      .spyOn(Papa, 'parse')
      .mockImplementation((file, options) => {
        if (options.error) {
          options.error(new Error('Malformed CSV'));
        }
      });

    render(<App />);
    const file = new File(['bad'], 'bad.csv', { type: 'text/csv' });
    const input = screen.getByLabelText(/Summary CSV/i);
    await userEvent.upload(input, file);

    expect(parseMock).toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Malformed CSV');
    });
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});
