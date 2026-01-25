import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Papa from 'papaparse';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AppProviders } from './app/AppProviders';
import { AppShell } from './App';

// Basic IntersectionObserver mock capturing instances
class IO {
  constructor(cb, options) {
    IO._instances.push({ cb, options, observed: new Set() });
    this._idx = IO._instances.length - 1;
  }
  observe(el) {
    IO._instances[this._idx].observed.add(el);
  }
  unobserve(el) {
    IO._instances[this._idx].observed.delete(el);
  }
  disconnect() {
    const inst = IO._instances[this._idx];
    if (inst) inst.observed.clear();
  }
}
IO._instances = [];

describe('TOC active highlighting', () => {
  beforeEach(() => {
    // Mock Papa.parse for fast CSV processing
    vi.spyOn(Papa, 'parse').mockImplementation((file, options) => {
      const rows = [
        {
          Date: '2025-06-01',
          'Total Time': '08:00:00',
          AHI: '5',
          'Median EPAP': '6',
        },
      ];
      if (options.chunk)
        options.chunk({ data: rows, meta: { cursor: file.size } });
      if (options.complete) options.complete({ data: rows });
    });
    // @ts-ignore
    global.IntersectionObserver = IO;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    // @ts-ignore
    delete global.IntersectionObserver;
    window.location.hash = '';
    IO._instances = [];
  });

  it('sets active class on click and on intersection change', async () => {
    render(
      <AppProviders>
        <AppShell />
      </AppProviders>,
    );

    const summaryFile = new File(
      ['Date,Total Time,AHI,Median EPAP\n2025-06-01,08:00:00,5,6'],
      'summary.csv',
      { type: 'text/csv' },
    );
    const detailsFile = new File(
      ['Event,DateTime,Data/Duration\nClearAirway,2025-06-01T00:00:00,12'],
      'details.csv',
      { type: 'text/csv' },
    );
    const input = await screen.findByLabelText(/CSV or session files/i);
    await userEvent.upload(input, [summaryFile, detailsFile]);

    await waitFor(
      () => {
        expect(
          screen.getByRole('heading', { name: /Overview Dashboard/i }),
        ).toBeInTheDocument();
      },
      { timeout: 8000 },
    );

    expect(IO._instances.length).toBe(1);

    await screen.findByRole(
      'heading',
      { name: /Pressure Settings/i },
      { timeout: 6000 },
    );

    // Click-based activation
    const ahiLink = screen.getByRole('link', { name: /AHI Trends/i });
    await userEvent.click(ahiLink);
    expect(ahiLink).toHaveClass('active');

    // Intersection-based activation
    // Simulate that #pressure-settings is intersecting
    const inst = IO._instances[0];
    const sectionIds = [
      'overview',
      'usage-patterns',
      'ahi-trends',
      'pressure-settings',
      'apnea-characteristics',
      'clustered-apnea',
      'false-negatives',
      'raw-data-explorer',
      'fitbit-correlation',
    ];
    // Force geometry to stay below the fold so the observer callback must use its entries
    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.getBoundingClientRect = () => ({ top: 800 });
    });
    const pressureEl = document.getElementById('pressure-settings');
    expect(pressureEl).toBeTruthy();
    await act(async () => {
      inst.cb([
        {
          target: pressureEl,
          isIntersecting: true,
          intersectionRatio: 0.5,
          boundingClientRect: { top: 100 },
        },
      ]);
    });
    const pressureLink = screen.getByRole('link', {
      name: /Pressure Settings/i,
    });
    expect(pressureLink).toHaveClass('active');

    // Scroll-based activation using mocked geometry
    const overviewEl = document.getElementById('overview');
    const ahiEl = document.getElementById('ahi-trends');
    // Mock positions: overview above header, AHI newly above threshold after scroll
    overviewEl.getBoundingClientRect = () => ({ top: -200 });
    ahiEl.getBoundingClientRect = () => ({ top: -10 });
    const others = [
      'usage-patterns',
      'pressure-settings',
      'apnea-characteristics',
      'clustered-apnea',
      'false-negatives',
      'raw-data-explorer',
    ];
    others.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.getBoundingClientRect = () => ({ top: 500 });
    });
    await act(async () => {
      window.dispatchEvent(new Event('scroll'));
    });
    const ahiLink2 = screen.getByRole('link', { name: /AHI Trends/i });
    expect(ahiLink2).toHaveClass('active');
  });
});
