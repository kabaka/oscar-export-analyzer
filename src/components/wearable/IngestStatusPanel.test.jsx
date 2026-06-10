import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import IngestStatusPanel from './IngestStatusPanel';

describe('IngestStatusPanel', () => {
  it('renders nothing when idle with no history', () => {
    const { container } = render(
      <IngestStatusPanel state="idle" progress={null} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows two-level progress and a live region while ingesting', () => {
    render(
      <IngestStatusPanel
        state="ingesting"
        progress={{
          phase: 'parsing-hr',
          filesDone: 8,
          filesTotal: 3541,
          nights: 120,
        }}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByTestId('wearable-ingest-panel')).toBeInTheDocument();
    // Coarse phase label is humanized.
    expect(
      screen.getAllByText(/Aggregating heart rate/i).length,
    ).toBeGreaterThan(0);
    // Within-phase counts + nights in the aria-live text.
    const live = screen.getByText(/3,541 files/);
    expect(live).toHaveTextContent(/120 nights/);
  });

  it('wires the cancel button', () => {
    const onCancel = vi.fn();
    render(
      <IngestStatusPanel
        state="ingesting"
        progress={{
          phase: 'discovering',
          filesDone: 0,
          filesTotal: 0,
          nights: 0,
        }}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByTestId('wearable-ingest-cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('shows the partial-cancel message', () => {
    render(<IngestStatusPanel state="partial" progress={null} />);
    expect(screen.getByRole('status')).toHaveTextContent(/cancelled/i);
  });

  it('renders a last-import summary when not ingesting', () => {
    render(
      <IngestStatusPanel
        state="ready"
        progress={null}
        lastImport={{
          at: Date.parse('2026-06-10T08:00:00Z'),
          nights: 42,
          dateRange: { start: '2026-01-01', end: '2026-02-12' },
        }}
      />,
    );
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('2026-01-01 → 2026-02-12')).toBeInTheDocument();
  });
});
