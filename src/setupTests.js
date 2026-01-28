import '@testing-library/jest-dom';
import React from 'react';
import { vi, beforeAll, beforeEach } from 'vitest';

// Mirror helpers are applied after jsdom creates the window
const mirrorToWindow = (name, value) => {
  const scope = globalThis;
  scope[name] = value;
  if (scope.window) {
    scope.window[name] = value;
  }
};

// Mock localStorage/sessionStorage - complete implementation with all methods
const makeStorageMock = () => {
  let store = {};
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index) => {
      const keys = Object.keys(store);
      return keys[index] ?? null;
    },
  };
};

const localStorageMock = makeStorageMock();
const sessionStorageMock = makeStorageMock();

beforeAll(() => {
  // Apply localStorage/sessionStorage mocks to window and global
  mirrorToWindow('localStorage', localStorageMock);
  mirrorToWindow('sessionStorage', sessionStorageMock);

  // Provide a minimal MutationObserver polyfill for jsdom and expose it on window
  class MockMutationObserver {
    constructor(callback) {
      this.callback = callback;
    }
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  mirrorToWindow('MutationObserver', MockMutationObserver);

  // Provide a minimal matchMedia polyfill for jsdom (needed for PWA features)
  if (!globalThis.matchMedia || typeof globalThis.matchMedia !== 'function') {
    const mockMatchMedia = vi.fn((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    mirrorToWindow('matchMedia', mockMatchMedia);
  }

  // Provide a minimal IntersectionObserver polyfill for jsdom
  if (
    !globalThis.IntersectionObserver ||
    typeof globalThis.IntersectionObserver !== 'function'
  ) {
    class MockIO {
      constructor() {}
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    }
    mirrorToWindow('IntersectionObserver', MockIO);
  }

  // Basic Web Worker stub for tests; individual tests can override as needed
  if (!globalThis.Worker || typeof globalThis.Worker !== 'function') {
    class MockWorker {
      constructor() {
        this.workerId = null;
      }
      postMessage({ file, workerId } = {}) {
        if (!file) return;
        this.workerId = workerId;
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
        // Use Promise.resolve to defer execution, allowing async test operations to complete
        Promise.resolve().then(() => {
          this.onmessage?.({
            data: { workerId, type: 'progress', cursor: file.size },
          });
          this.onmessage?.({ data: { workerId, type: 'rows', rows } });
          this.onmessage?.({ data: { workerId, type: 'complete' } });
        });
      }
      terminate() {}
    }
    mirrorToWindow('Worker', MockWorker);
  }
});

// Reset localStorage/sessionStorage before each test
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

// Also mock Plotly charts to simplify component tests
const plotlyMock = vi.fn((props) =>
  React.createElement('div', { 'data-testid': 'plotly-chart', ...props }),
);
vi.mock('react-plotly.js', () => {
  return { default: plotlyMock };
});
