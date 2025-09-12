import '@testing-library/jest-dom';
import React from 'react';
import { vi } from 'vitest';

// Mock Plotly charts to simplify component tests
const plotlyMock = vi.fn((props) =>
  React.createElement('div', { 'data-testid': 'plotly-chart', ...props }),
);
vi.mock('react-plotly.js', () => {
  return { default: plotlyMock };
});

// Provide a minimal IntersectionObserver polyfill for jsdom
if (typeof global.IntersectionObserver === 'undefined') {
  class MockIO {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  // eslint-disable-next-line no-undef
  global.IntersectionObserver = MockIO;
}

// Basic Web Worker stub for tests; individual tests can override as needed
if (typeof global.Worker === 'undefined') {
  class MockWorker {
    constructor() {}
    postMessage({ file } = {}) {
      if (!file) return;
      let rows;
      if ((file.name || '').includes('summary')) {
        rows = [
          {
            Date: '2025-06-01',
            'Total Time': '08:00:00',
            AHI: '5',
            'Median EPAP': '6',
          },
        ];
      } else {
        rows = [
          {
            Event: 'ClearAirway',
            DateTime: new Date('2025-06-01T00:00:00').getTime(),
            'Data/Duration': 12,
          },
        ];
      }
      this.onmessage?.({ data: { type: 'progress', cursor: file.size } });
      this.onmessage?.({ data: { type: 'rows', rows } });
      this.onmessage?.({ data: { type: 'complete' } });
    }
    terminate() {}
  }
  // eslint-disable-next-line no-undef
  global.Worker = MockWorker;
}
