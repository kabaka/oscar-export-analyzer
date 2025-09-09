import React from 'react';
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import Plot from 'react-plotly.js';
import * as darkHook from '../hooks/useEffectiveDarkMode';
import ThemedPlot from './ThemedPlot';

describe('ThemedPlot', () => {
  beforeEach(() => {
    Plot.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('applies light theme layout when dark mode is disabled', () => {
    vi.spyOn(darkHook, 'useEffectiveDarkMode').mockReturnValue(false);
    render(<ThemedPlot data={[]} />);
    const layout = Plot.mock.calls[0][0].layout;
    expect(layout.paper_bgcolor).toBe('#ffffff');
  });

  it('applies dark theme layout when dark mode is enabled', () => {
    vi.spyOn(darkHook, 'useEffectiveDarkMode').mockReturnValue(true);
    render(<ThemedPlot data={[]} />);
    const layout = Plot.mock.calls[0][0].layout;
    expect(layout.paper_bgcolor).toBe('#121821');
  });
});
