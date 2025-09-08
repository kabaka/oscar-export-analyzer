import '@testing-library/jest-dom';
import React from 'react';
import { vi } from 'vitest';

// Mock Plotly charts to simplify component tests
vi.mock('react-plotly.js', () => {
  return {
    default: (props) =>
      React.createElement('div', { 'data-testid': 'plotly-chart', ...props }),
  };
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
