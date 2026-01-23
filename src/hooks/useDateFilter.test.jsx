import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDateFilter } from './useDateFilter';
import * as AppProviders from '../app/AppProviders';

describe('useDateFilter', () => {
  it('returns date filter state and operations from context', () => {
    const mockDateFilter = {
      start: new Date('2024-01-01'),
      end: new Date('2024-01-31'),
    };
    const mockSetDateFilter = vi.fn();
    const mockQuickRange = '30';
    const mockHandleQuickRangeChange = vi.fn();
    const mockParseDate = vi.fn((str) => (str ? new Date(str) : null));
    const mockFormatDate = vi.fn((date) =>
      date ? date.toISOString().split('T')[0] : '',
    );
    const mockSelectCustomRange = vi.fn();
    const mockResetDateFilter = vi.fn();

    vi.spyOn(AppProviders, 'useAppContext').mockReturnValue({
      dateFilter: mockDateFilter,
      setDateFilter: mockSetDateFilter,
      quickRange: mockQuickRange,
      handleQuickRangeChange: mockHandleQuickRangeChange,
      parseDate: mockParseDate,
      formatDate: mockFormatDate,
      selectCustomRange: mockSelectCustomRange,
      resetDateFilter: mockResetDateFilter,
    });

    const { result } = renderHook(() => useDateFilter());

    expect(result.current.dateFilter).toBe(mockDateFilter);
    expect(result.current.setDateFilter).toBe(mockSetDateFilter);
    expect(result.current.quickRange).toBe(mockQuickRange);
    expect(result.current.handleQuickRangeChange).toBe(
      mockHandleQuickRangeChange,
    );
    expect(result.current.parseDate).toBe(mockParseDate);
    expect(result.current.formatDate).toBe(mockFormatDate);
    expect(result.current.selectCustomRange).toBe(mockSelectCustomRange);
    expect(result.current.resetDateFilter).toBe(mockResetDateFilter);
  });

  it('returns correct properties when date filter is null', () => {
    const mockDateFilter = { start: null, end: null };
    const mockSetDateFilter = vi.fn();
    const mockQuickRange = 'all';
    const mockHandleQuickRangeChange = vi.fn();
    const mockParseDate = vi.fn();
    const mockFormatDate = vi.fn();
    const mockSelectCustomRange = vi.fn();
    const mockResetDateFilter = vi.fn();

    vi.spyOn(AppProviders, 'useAppContext').mockReturnValue({
      dateFilter: mockDateFilter,
      setDateFilter: mockSetDateFilter,
      quickRange: mockQuickRange,
      handleQuickRangeChange: mockHandleQuickRangeChange,
      parseDate: mockParseDate,
      formatDate: mockFormatDate,
      selectCustomRange: mockSelectCustomRange,
      resetDateFilter: mockResetDateFilter,
    });

    const { result } = renderHook(() => useDateFilter());

    expect(result.current.dateFilter.start).toBeNull();
    expect(result.current.dateFilter.end).toBeNull();
    expect(result.current.quickRange).toBe('all');
  });

  it('provides functions that can be called', () => {
    const mockSetDateFilter = vi.fn();
    const mockHandleQuickRangeChange = vi.fn();
    const mockSelectCustomRange = vi.fn();
    const mockResetDateFilter = vi.fn();

    vi.spyOn(AppProviders, 'useAppContext').mockReturnValue({
      dateFilter: { start: null, end: null },
      setDateFilter: mockSetDateFilter,
      quickRange: 'all',
      handleQuickRangeChange: mockHandleQuickRangeChange,
      parseDate: vi.fn(),
      formatDate: vi.fn(),
      selectCustomRange: mockSelectCustomRange,
      resetDateFilter: mockResetDateFilter,
    });

    const { result } = renderHook(() => useDateFilter());

    // Test setDateFilter
    result.current.setDateFilter({ start: new Date('2024-01-01'), end: null });
    expect(mockSetDateFilter).toHaveBeenCalledWith({
      start: new Date('2024-01-01'),
      end: null,
    });

    // Test handleQuickRangeChange
    result.current.handleQuickRangeChange('7');
    expect(mockHandleQuickRangeChange).toHaveBeenCalledWith('7');

    // Test selectCustomRange
    result.current.selectCustomRange();
    expect(mockSelectCustomRange).toHaveBeenCalledTimes(1);

    // Test resetDateFilter
    result.current.resetDateFilter();
    expect(mockResetDateFilter).toHaveBeenCalledTimes(1);
  });

  it('parseDate and formatDate utility functions work as expected', () => {
    const mockParseDate = vi.fn((str) => (str ? new Date(str) : null));
    const mockFormatDate = vi.fn((date) =>
      date ? date.toISOString().split('T')[0] : '',
    );

    vi.spyOn(AppProviders, 'useAppContext').mockReturnValue({
      dateFilter: { start: null, end: null },
      setDateFilter: vi.fn(),
      quickRange: 'all',
      handleQuickRangeChange: vi.fn(),
      parseDate: mockParseDate,
      formatDate: mockFormatDate,
      selectCustomRange: vi.fn(),
      resetDateFilter: vi.fn(),
    });

    const { result } = renderHook(() => useDateFilter());

    // Test parseDate
    const parsedDate = result.current.parseDate('2024-01-15');
    expect(mockParseDate).toHaveBeenCalledWith('2024-01-15');
    expect(parsedDate).toEqual(new Date('2024-01-15'));

    // Test formatDate
    const formattedDate = result.current.formatDate(new Date('2024-01-15'));
    expect(mockFormatDate).toHaveBeenCalledWith(new Date('2024-01-15'));
    expect(formattedDate).toBe('2024-01-15');
  });

  it('throws error when used outside AppProviders', () => {
    vi.spyOn(AppProviders, 'useAppContext').mockImplementation(() => {
      throw new Error('useAppContext must be used within AppProviders');
    });

    expect(() => {
      renderHook(() => useDateFilter());
    }).toThrow('useAppContext must be used within AppProviders');
  });
});
