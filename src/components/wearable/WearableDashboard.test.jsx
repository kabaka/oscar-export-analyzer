import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WearableDashboard from './WearableDashboard';

const nights = [
  {
    nightDate: '2026-01-08',
    nightKey: '2026-01-08',
    sleep: { efficiencyPct: 92 },
  },
  {
    nightDate: '2026-01-09',
    nightKey: '2026-01-09',
    sleep: { efficiencyPct: 88 },
  },
];

const correlation = {
  nAlignedNights: 2,
  testsRun: 2,
  singleSubjectCaveat: true,
  warnings: ['attenuation-risk: ahi↔spo2.minPct'],
  pairs: [
    {
      id: 1,
      x: 'ahi',
      y: 'spo2.minPct',
      family: 'primary',
      rho: -0.42,
      effectSize: 'medium',
      n: 2,
      qValue: 0.04,
      survivesFDR: true,
      flags: [],
    },
    {
      id: 5,
      x: 'ahi',
      y: 'rr.nightlyBrpm',
      family: 'exploratory',
      rho: 0.1,
      effectSize: 'small',
      n: 2,
      qValue: NaN,
      survivesFDR: false,
      flags: ['serial-correlation'],
    },
  ],
};

describe('WearableDashboard', () => {
  it('renders overview counts and the single-subject caveat', () => {
    render(
      <WearableDashboard
        nights={nights}
        correlation={correlation}
        getNightDetail={vi.fn()}
      />,
    );
    expect(screen.getByText(/Single-subject analysis/i)).toBeInTheDocument();
    expect(screen.getByText('Aligned nights')).toBeInTheDocument();
    // All three overview metrics read 2 here (2 nights, 2 aligned, 2 tests run).
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(3);
  });

  it('surfaces coverage/attenuation diagnostics from warnings', () => {
    render(
      <WearableDashboard
        nights={nights}
        correlation={correlation}
        getNightDetail={vi.fn()}
      />,
    );
    expect(screen.getByTestId('wearable-diagnostics')).toHaveTextContent(
      /attenuation-risk/,
    );
  });

  it('renders the pre-registered pair table with FDR survival', () => {
    render(
      <WearableDashboard
        nights={nights}
        correlation={correlation}
        getNightDetail={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('rowheader', { name: /ahi ↔ spo2.minPct/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('-0.42')).toBeInTheDocument();
  });

  it('explains the jargon column headers for clinicians/patients', () => {
    render(
      <WearableDashboard
        nights={nights}
        correlation={correlation}
        getNightDetail={vi.fn()}
      />,
    );
    // The ρ header carries an expansion so it is not bare jargon. The header
    // renders once per pre-registered family table (primary + exploratory), so
    // assert every occurrence is the same expanded ρ abbreviation rather than
    // weakening the check.
    const rhoAbbrs = screen.getAllByTitle(/Spearman rank correlation/i);
    expect(rhoAbbrs.length).toBeGreaterThanOrEqual(1);
    rhoAbbrs.forEach((abbr) => expect(abbr).toHaveTextContent('ρ'));
    // Diagnostics is a labelled region (not a noisy live region).
    expect(
      screen.getByRole('region', { name: /Diagnostics/i }),
    ).toBeInTheDocument();
  });

  it('opens a night drill-down on click', () => {
    render(
      <WearableDashboard
        nights={nights}
        correlation={correlation}
        getNightDetail={vi.fn().mockResolvedValue(null)}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /2026-01-08/ }));
    expect(screen.getByTestId('wearable-night-detail')).toBeInTheDocument();
  });

  it('shows an empty message when no nights are in range', () => {
    render(
      <WearableDashboard
        nights={[]}
        correlation={null}
        getNightDetail={vi.fn()}
      />,
    );
    expect(
      screen.getByText(/No wearable nights in the current date range/i),
    ).toBeInTheDocument();
  });
});
