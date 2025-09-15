import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import DataImportModal from './DataImportModal.jsx';

vi.mock('../utils/db', () => ({
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
});
