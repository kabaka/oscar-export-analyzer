import { describe, it, expect } from 'vitest';
import { timeSeriesHeatmap, adherenceMetrics } from './timeSeries';

const series = [
  { date: new Date('2023-01-01'), value: 1 },
  { date: new Date('2023-01-02'), value: 2 },
  { date: new Date('2023-01-03'), value: 3 },
];

describe('timeSeriesHeatmap', () => {
  it('builds plotly heatmap axes', () => {
    const dates = series.map((row) => row.date);
    const values = series.map((row) => row.value);
    const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const heatmap = timeSeriesHeatmap(dates, values, {
      labels,
      daysPerWeek: 7,
      weekStartOffset: 0,
      maxWeeks: 52,
      isoDateLength: 10,
    });

    expect(heatmap.x.length).toBeGreaterThan(0);
    expect(heatmap.x.every((d) => d instanceof Date)).toBe(true);
    expect(heatmap.y).toEqual(labels);
    expect(heatmap.z).toHaveLength(labels.length);
    heatmap.z.forEach((row) => expect(row).toHaveLength(heatmap.x.length));

    const weekIndex = heatmap.x.findIndex((d) =>
      d.toISOString().startsWith('2023-01-01'),
    );
    expect(weekIndex).toBeGreaterThanOrEqual(0);
    expect(heatmap.z[0][weekIndex]).toBe(1);
    expect(heatmap.z[1][weekIndex]).toBe(2);
    expect(heatmap.z[2][weekIndex]).toBe(3);
  });
});

describe('adherenceMetrics', () => {
  it('computes streaks and coverage', () => {
    const usageHours = [4, 5, 4, 6, 2, 6, 7];
    const rolling = { compliance4_7: [0.25, 0.5, 0.75] };
    const metrics = adherenceMetrics(usageHours, rolling, {
      complianceThreshold: 4,
      strictThreshold: 6,
      longWindowDays: 7,
    });

    expect(metrics.longestCompliance).toBe(4);
    expect(metrics.longestStrict).toBe(2);
    expect(metrics.complianceSeries).toBe(rolling.compliance4_7);
  });
});
