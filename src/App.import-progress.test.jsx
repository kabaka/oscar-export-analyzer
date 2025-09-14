import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

describe('Header import progress', () => {
  const OriginalWorker = global.Worker;

  beforeEach(() => {
    class MockWorker {
      postMessage() {
        setTimeout(() => {
          this.onmessage?.({ data: { type: 'progress', cursor: 50 } });
        }, 0);
        setTimeout(() => {
          this.onmessage?.({ data: { type: 'rows', rows: [], cursor: 50 } });
          this.onmessage?.({ data: { type: 'complete' } });
        }, 500);
      }
      terminate() {}
    }
    global.Worker = MockWorker;
  });

  afterEach(() => {
    global.Worker = OriginalWorker;
  });

  it('shows progress text and bar in the header during import', async () => {
    render(<App />);
    const input = screen.getByLabelText(/CSV files/i);
    const file = new File(['Date\n2025-06-01'], 'summary.csv', {
      type: 'text/csv',
    });
    await userEvent.upload(input, file);

    const header = screen.getByRole('banner');
    expect(
      await within(header).findByText(/Importing summary CSV/i),
    ).toBeInTheDocument();
    expect(within(header).getByRole('progressbar')).toBeInTheDocument();

    await waitFor(() => {
      expect(
        within(header).queryByText(/Importing summary CSV/i),
      ).not.toBeInTheDocument();
    });
  });
});
