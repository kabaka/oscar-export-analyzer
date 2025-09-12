import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

// Tests cross-component behavior triggered by CSV uploads

describe('CSV uploads and cross-component interactions', () => {
  it('shows overview after summary upload and raw data explorer after details upload', async () => {
    render(<App />);

    const summaryInput = screen.getByLabelText(/Summary CSV/i);
    const summaryFile = new File(['Date,AHI\n2025-06-01,5'], 'summary.csv', {
      type: 'text/csv',
    });
    await userEvent.upload(summaryInput, summaryFile);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /Overview Dashboard/i }),
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByRole('heading', { name: /Raw Data Explorer/i }),
    ).not.toBeInTheDocument();

    const detailsInput = screen.getByLabelText(/Details CSV/i);
    const detailsFile = new File(
      ['Event,DateTime,Data/Duration\nClearAirway,2025-06-01T00:00:00,12'],
      'details.csv',
      { type: 'text/csv' },
    );
    await userEvent.upload(detailsInput, detailsFile);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /Raw Data Explorer/i }),
      ).toBeInTheDocument();
    });

    // Default worker stub handles parsing; reaching here implies workers executed
  });
});
