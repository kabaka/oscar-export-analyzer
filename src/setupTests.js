import '@testing-library/jest-dom';
import React from 'react';
import { vi } from 'vitest';

// Mock Plotly charts to simplify component tests
vi.mock('react-plotly.js', () => {
  return {
    default: (props) => React.createElement('div', { 'data-testid': 'plotly-chart', ...props }),
  };
});
