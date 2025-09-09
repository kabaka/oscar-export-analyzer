import '@testing-library/jest-dom';
import React from 'react';
import { vi } from 'vitest';

// Mock Plotly charts to simplify component tests
const plotlyMock = vi.fn((props) =>
  React.createElement('div', { 'data-testid': 'plotly-chart', ...props })
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
