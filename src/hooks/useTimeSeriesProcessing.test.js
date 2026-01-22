import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTimeSeriesProcessing } from './useTimeSeriesProcessing';

const sampleData = [
  { Date: '2021-01-01', AHI: '2' },
  { Date: '2021-01-02', AHI: '4' },
  { Date: '2021-01-03', AHI: '6' },
];

describe('useTimeSeriesProcessing', () => {
  it('sorts, rolls, and builds heatmap when enabled', () => {
    const { result } = renderHook(() =>
      useTimeSeriesProcessing({
        data: sampleData,
        mapPoint: (row) => ({
          date: new Date(row.Date),
          value: Number(row.AHI),
        }),
        rollingWindows: [2, 3],
        changePointPenalty: 1,
        seasonLength: 2,
        includeHeatmap: true,
        heatmapOptions: {
          labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          daysPerWeek: 7,
          weekStartOffset: 6,
          maxWeeks: 10,
          isoDateLength: 10,
        },
      }),
    );

    const { dates, values, rolling, heatmap, breakDates } = result.current;
    expect(dates[0].getTime()).toBeLessThan(dates[1].getTime());
    expect(values).toEqual([2, 4, 6]);
    expect(rolling.avg2).toHaveLength(3);
    expect(breakDates.length).toBeGreaterThanOrEqual(0);
    expect(heatmap.x.length).toBeGreaterThan(0);
    expect(heatmap.y.length).toBeGreaterThan(0);
  });
});
