import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Papa from 'papaparse';
import App from './App';

// Basic IntersectionObserver mock capturing instances
class IO {
  constructor(cb, options) {
    IO._instances.push({ cb, options, observed: new Set() });
    this._idx = IO._instances.length - 1;
  }
  observe(el) { IO._instances[this._idx].observed.add(el); }
  unobserve(el) { IO._instances[this._idx].observed.delete(el); }
  disconnect() {
    const inst = IO._instances[this._idx];
    if (inst) inst.observed.clear();
  }
}
IO._instances = [];

describe('TOC active highlighting', () => {
  beforeEach(() => {
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

  function mockSummaryParse() {
    return vi.spyOn(Papa, 'parse').mockImplementation((file, options) => {
      const rows = [{
        Date: '2025-06-01',
        'Total Time': '08:00:00',
        AHI: '5',
        'Median EPAP': '6'
      }];
      if (options.chunk) options.chunk({ data: rows, meta: { cursor: file.size } });
      if (options.complete) options.complete({ data: rows });
    });
  }

  it('sets active class on click and on intersection change', async () => {
    mockSummaryParse();
    render(<App />);

    const file = new File(['Date,AHI\n2025-06-01,5'], 'summary.csv', { type: 'text/csv' });
    await userEvent.upload(screen.getByLabelText(/Summary CSV/i), file);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Overview Dashboard/i })).toBeInTheDocument();
    });

    // Click-based activation
    const ahiLink = screen.getByRole('link', { name: /AHI Trends/i });
    await userEvent.click(ahiLink);
    expect(ahiLink).toHaveClass('active');

    // Intersection-based activation
    // Simulate that #pressure-settings is intersecting
    const inst = IO._instances[0];
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
    const pressureLink = screen.getByRole('link', { name: /Pressure Settings/i });
    expect(pressureLink).toHaveClass('active');
  });
});
