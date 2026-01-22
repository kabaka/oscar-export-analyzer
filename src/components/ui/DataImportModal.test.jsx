import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import DataImportModal from './DataImportModal.jsx';

vi.mock('../../utils/db', () => ({
  getLastSession: vi.fn(async () => ({})),
}));

const noop = () => {};

describe('DataImportModal layout', () => {
  it('adds padding and centers actions', async () => {
    render(
      <DataImportModal
        isOpen
        onClose={noop}
        onSummaryFile={noop}
        onDetailsFile={noop}
        onLoadSaved={noop}
        onSessionFile={noop}
        summaryData={null}
        detailsData={null}
        loadingSummary={false}
        loadingDetails={false}
        summaryProgress={0}
        summaryProgressMax={0}
        detailsProgress={0}
        detailsProgressMax={0}
      />,
    );

    const modal = document.querySelector('.modal');
    expect(modal).toHaveStyle({ padding: '24px' });

    const loadBtn = await screen.findByRole('button', {
      name: /load previous session/i,
    });
    expect(loadBtn).toHaveStyle({ alignSelf: 'center' });

    const closeBtn = screen.getByRole('button', { name: /close/i });
    expect(closeBtn).toHaveStyle({ alignSelf: 'center' });
  });

  it('remains open when reopened with loaded data', async () => {
    const onClose = vi.fn();
    render(
      <DataImportModal
        isOpen
        onClose={onClose}
        onSummaryFile={noop}
        onDetailsFile={noop}
        onLoadSaved={noop}
        onSessionFile={noop}
        summaryData={[{}]}
        detailsData={[{}]}
        loadingSummary={false}
        loadingDetails={false}
        summaryProgress={0}
        summaryProgressMax={0}
        detailsProgress={0}
        detailsProgressMax={0}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByRole('dialog', { name: /import data/i }),
      ).toBeInTheDocument();
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes immediately when loading a saved session', async () => {
    const onClose = vi.fn();
    const onLoadSaved = vi.fn();
    render(
      <DataImportModal
        isOpen
        onClose={onClose}
        onSummaryFile={noop}
        onDetailsFile={noop}
        onLoadSaved={onLoadSaved}
        onSessionFile={noop}
        summaryData={null}
        detailsData={null}
        loadingSummary={false}
        loadingDetails={false}
        summaryProgress={0}
        summaryProgressMax={0}
        detailsProgress={0}
        detailsProgressMax={0}
      />,
    );

    await userEvent.click(
      await screen.findByRole('button', { name: /load previous session/i }),
    );

    expect(onLoadSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('closes immediately after selecting files', async () => {
    const onClose = vi.fn();
    render(
      <DataImportModal
        isOpen
        onClose={onClose}
        onSummaryFile={noop}
        onDetailsFile={noop}
        onLoadSaved={noop}
        onSessionFile={noop}
        summaryData={null}
        detailsData={null}
        loadingSummary={false}
        loadingDetails={false}
        summaryProgress={0}
        summaryProgressMax={0}
        detailsProgress={0}
        detailsProgressMax={0}
      />,
    );

    const input = screen.getByLabelText(/csv or session files/i);
    const summary = new File(['Date\n'], 'summary.csv', { type: 'text/csv' });
    const details = new File(['Event\n'], 'details.csv', { type: 'text/csv' });

    await userEvent.upload(input, [summary, details]);

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });
});
