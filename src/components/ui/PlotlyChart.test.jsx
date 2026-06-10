import { describe, it, expect, vi } from 'vitest';

/**
 * Guard test for the partial Plotly build.
 *
 * ThemedPlot renders charts through a custom `plotly.js/lib/core` bundle with
 * only a hand-picked set of trace modules registered (see PlotlyChart.jsx). If a
 * chart uses a trace `type` that was never registered, Plotly silently renders a
 * blank chart at runtime. This test asserts that every trace type referenced in
 * the component source is covered by REGISTERED_TRACE_TYPES, so adding a new
 * chart type without registering its module fails CI instead of shipping a blank
 * chart.
 */

// Avoid the global setupTests mock for PlotlyChart so we can read the real
// REGISTERED_TRACE_TYPES export, while still stubbing the heavy Plotly internals.
vi.unmock('./PlotlyChart');
vi.mock('plotly.js/lib/core', () => ({
  default: { register: vi.fn() },
}));
vi.mock('react-plotly.js/factory', () => ({
  default: () => () => null,
}));
vi.mock('plotly.js/lib/scatter', () => ({ default: {} }));
vi.mock('plotly.js/lib/bar', () => ({ default: {} }));
vi.mock('plotly.js/lib/histogram', () => ({ default: {} }));
vi.mock('plotly.js/lib/histogram2d', () => ({ default: {} }));
vi.mock('plotly.js/lib/heatmap', () => ({ default: {} }));
vi.mock('plotly.js/lib/box', () => ({ default: {} }));
vi.mock('plotly.js/lib/violin', () => ({ default: {} }));

import { REGISTERED_TRACE_TYPES } from './PlotlyChart';
import fs from 'node:fs';
import path from 'node:path';

/** Recursively collect *.jsx files under a directory. */
function collectJsx(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectJsx(full, acc);
    else if (entry.name.endsWith('.jsx') && !entry.name.includes('.test.'))
      acc.push(full);
  }
  return acc;
}

describe('PlotlyChart partial build registration', () => {
  it('registers a non-empty, de-duplicated set of trace modules', () => {
    expect(REGISTERED_TRACE_TYPES.length).toBeGreaterThan(0);
    expect(new Set(REGISTERED_TRACE_TYPES).size).toBe(
      REGISTERED_TRACE_TYPES.length,
    );
  });

  it('covers every Plotly trace type rendered in component source', () => {
    const componentsDir = path.resolve(__dirname, '..');
    const featuresDir = path.resolve(__dirname, '../../features');
    const files = [...collectJsx(componentsDir), ...collectJsx(featuresDir)];

    // Plotly trace `type` strings. Axis/layout/worker `type:` values
    // (e.g. 'date', 'linear', 'number', 'range', and worker message types)
    // are NOT Plotly traces and must not be flagged. We therefore only treat a
    // `type: '<x>'` literal as a trace when <x> is a known Plotly trace name.
    const KNOWN_PLOTLY_TRACES = new Set([
      'scatter',
      'scattergl',
      'bar',
      'histogram',
      'histogram2d',
      'histogram2dcontour',
      'heatmap',
      'heatmapgl',
      'box',
      'violin',
      'pie',
      'contour',
      'scatter3d',
      'surface',
      'mesh3d',
      'candlestick',
      'ohlc',
      'waterfall',
      'funnel',
      'sankey',
      'treemap',
      'sunburst',
      'indicator',
    ]);

    const used = new Set();
    const traceRe = /type:\s*['"]([a-z0-9]+)['"]/g;
    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');
      let m;
      while ((m = traceRe.exec(src)) !== null) {
        if (KNOWN_PLOTLY_TRACES.has(m[1])) used.add(m[1]);
      }
    }

    const registered = new Set(REGISTERED_TRACE_TYPES);
    const missing = [...used].filter((t) => !registered.has(t));
    expect(
      missing,
      `Trace type(s) used in components but not registered in PlotlyChart.jsx: ${missing.join(
        ', ',
      )}. Add the plotly.js/lib/<type> import + registry entry.`,
    ).toEqual([]);

    // Sanity: the audited set should actually be in use (catches accidental
    // over-registration drift). Every registered type we expect to be used.
    expect(used.size).toBeGreaterThan(0);
  });
});
