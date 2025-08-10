import { describe, it, expect } from 'vitest';
import { buildSummaryAggregatesCSV } from './export';

describe('export utils', () => {
  it('builds aggregates CSV with headers', () => {
    const summary = [
      { Date: '2024-01-01', 'Total Time': '01:00:00', AHI: '2', 'Median EPAP': '7' },
      { Date: '2024-01-02', 'Total Time': '02:00:00', AHI: '4', 'Median EPAP': '9' },
    ];
    const csv = buildSummaryAggregatesCSV(summary);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('metric,value');
    expect(lines.some(l => l.startsWith('avg_usage_hours,'))).toBe(true);
    expect(lines.some(l => l.startsWith('median_AHI,'))).toBe(true);
  });
});

