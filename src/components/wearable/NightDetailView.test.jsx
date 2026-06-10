import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import NightDetailView from './NightDetailView';

const night = {
  nightDate: '2026-01-08',
  sleep: {
    asleepMin: 420,
    efficiencyPct: 92,
    deepMin: 80,
    remMin: 90,
    lightMin: 230,
    wakeMin: 20,
  },
  intradayMetrics: ['spo2', 'hr'],
};

describe('NightDetailView', () => {
  it('renders the night date and an off-screen summary', async () => {
    render(
      <NightDetailView
        night={night}
        getNightDetail={vi.fn().mockResolvedValue(null)}
      />,
    );
    expect(
      screen.getByRole('heading', { name: /Night detail — 2026-01-08/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Sleep efficiency 92%/)).toBeInTheDocument();
  });

  it('renders the hypnogram with an accessible label', () => {
    render(
      <NightDetailView
        night={night}
        getNightDetail={vi.fn().mockResolvedValue(null)}
      />,
    );
    expect(
      screen.getByRole('img', {
        name: /Sleep stage duration breakdown for 2026-01-08/,
      }),
    ).toBeInTheDocument();
  });

  it('describes the per-stage minutes in the off-screen text alternative', () => {
    render(
      <NightDetailView
        night={night}
        getNightDetail={vi.fn().mockResolvedValue(null)}
      />,
    );
    // Stage minutes are exposed to screen readers, not just encoded in color.
    expect(
      screen.getByText(
        /Sleep stages: Awake 20 minutes, REM 90 minutes, Light 230 minutes, Deep 80 minutes/,
      ),
    ).toBeInTheDocument();
  });

  it('lazily fetches intraday metrics and renders the overlay', async () => {
    const getNightDetail = vi.fn(async (date, metric) => {
      if (metric === 'spo2') {
        return {
          cadenceSec: 60,
          t0Ms: Date.parse('2026-01-08T00:00:00Z'),
          values: new Int16Array([95, 96, 0, 94]),
        };
      }
      return null;
    });
    render(<NightDetailView night={night} getNightDetail={getNightDetail} />);
    await waitFor(() =>
      expect(getNightDetail).toHaveBeenCalledWith('2026-01-08', 'spo2'),
    );
    expect(
      await screen.findByRole('img', { name: /Per-minute SpO2/ }),
    ).toBeInTheDocument();
  });

  it('calls onClose', async () => {
    const onClose = vi.fn();
    render(
      <NightDetailView
        night={night}
        getNightDetail={vi.fn().mockResolvedValue(null)}
        onClose={onClose}
      />,
    );
    screen.getByRole('button', { name: /Close night detail/ }).click();
    expect(onClose).toHaveBeenCalled();
  });
});
