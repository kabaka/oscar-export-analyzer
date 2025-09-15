import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

describe('In-page navigation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.location.hash = '';
  });

  it('renders Overview with only Summary CSV and updates hash on click', async () => {
    render(<App />);

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

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /Overview Dashboard/i }),
      ).toBeInTheDocument();
    });
    expect(
      await screen.findByRole('heading', { name: /Usage Patterns/i }),
    ).toBeInTheDocument();

    const overviewLink = screen.getByRole('link', { name: /Overview/i });
    expect(overviewLink).toHaveAttribute('href', '#overview');
    await userEvent.click(overviewLink);
    expect(window.location.hash).toBe('#overview');
  });
});
