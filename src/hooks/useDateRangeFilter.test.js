import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDateRangeFilter } from './useDateRangeFilter';

describe('useDateRangeFilter', () => {
  const sampleSummary = [
    { Date: '2024-01-01', AHI: '2' },
    { Date: '2024-01-05', AHI: '3' },
  ];

  it('applies quick ranges relative to latest date', () => {
    const { result } = renderHook(() => useDateRangeFilter(sampleSummary));

    act(() => result.current.handleQuickRangeChange('7'));

    expect(result.current.quickRange).toBe('7');
    expect(result.current.dateFilter.end.toISOString().slice(0, 10)).toBe(
      '2024-01-05',
    );
    expect(result.current.dateFilter.start.toISOString().slice(0, 10)).toBe(
      '2023-12-30',
    );

    act(() => result.current.handleQuickRangeChange('all'));
    expect(result.current.dateFilter).toEqual({ start: null, end: null });
    expect(result.current.quickRange).toBe('all');
  });

  it('supports custom selection and parsing helpers', () => {
    const { result } = renderHook(() => useDateRangeFilter(sampleSummary));

    act(() => result.current.selectCustomRange());
    expect(result.current.quickRange).toBe('custom');

    expect(result.current.parseDate('not-a-date')).toBeNull();
    const formatted = result.current.formatDate(new Date('2024-02-02T12:00:00Z'));
    expect(formatted).toBe('2024-02-02');

    act(() => result.current.setDateFilter({ start: new Date(), end: new Date() }));
    act(() => result.current.resetDateFilter());
    expect(result.current.dateFilter).toEqual({ start: null, end: null });
    expect(result.current.quickRange).toBe('all');
  });
});