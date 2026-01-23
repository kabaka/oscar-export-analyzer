import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRangeComparisons } from './useRangeComparisons';
import * as AppProviders from '../app/AppProviders';

describe('useRangeComparisons', () => {
  it('returns range comparison state and operations from context', () => {
    const mockRangeA = {
      start: new Date('2024-01-01'),
      end: new Date('2024-01-15'),
    };
    const mockSetRangeA = vi.fn();
    const mockRangeB = {
      start: new Date('2024-02-01'),
      end: new Date('2024-02-15'),
    };
    const mockSetRangeB = vi.fn();

    vi.spyOn(AppProviders, 'useAppContext').mockReturnValue({
      rangeA: mockRangeA,
      setRangeA: mockSetRangeA,
      rangeB: mockRangeB,
      setRangeB: mockSetRangeB,
    });

    const { result } = renderHook(() => useRangeComparisons());

    expect(result.current.rangeA).toBe(mockRangeA);
    expect(result.current.setRangeA).toBe(mockSetRangeA);
    expect(result.current.rangeB).toBe(mockRangeB);
    expect(result.current.setRangeB).toBe(mockSetRangeB);
  });

  it('returns correct properties when ranges are null', () => {
    const mockRangeA = { start: null, end: null };
    const mockSetRangeA = vi.fn();
    const mockRangeB = { start: null, end: null };
    const mockSetRangeB = vi.fn();

    vi.spyOn(AppProviders, 'useAppContext').mockReturnValue({
      rangeA: mockRangeA,
      setRangeA: mockSetRangeA,
      rangeB: mockRangeB,
      setRangeB: mockSetRangeB,
    });

    const { result } = renderHook(() => useRangeComparisons());

    expect(result.current.rangeA.start).toBeNull();
    expect(result.current.rangeA.end).toBeNull();
    expect(result.current.rangeB.start).toBeNull();
    expect(result.current.rangeB.end).toBeNull();
  });

  it('provides setRangeA function that can update range A', () => {
    const mockSetRangeA = vi.fn();

    vi.spyOn(AppProviders, 'useAppContext').mockReturnValue({
      rangeA: { start: null, end: null },
      setRangeA: mockSetRangeA,
      rangeB: { start: null, end: null },
      setRangeB: vi.fn(),
    });

    const { result } = renderHook(() => useRangeComparisons());

    const newRangeA = {
      start: new Date('2024-01-01'),
      end: new Date('2024-01-31'),
    };
    result.current.setRangeA(newRangeA);

    expect(mockSetRangeA).toHaveBeenCalledWith(newRangeA);
    expect(mockSetRangeA).toHaveBeenCalledTimes(1);
  });

  it('provides setRangeB function that can update range B', () => {
    const mockSetRangeB = vi.fn();

    vi.spyOn(AppProviders, 'useAppContext').mockReturnValue({
      rangeA: { start: null, end: null },
      setRangeA: vi.fn(),
      rangeB: { start: null, end: null },
      setRangeB: mockSetRangeB,
    });

    const { result } = renderHook(() => useRangeComparisons());

    const newRangeB = {
      start: new Date('2024-02-01'),
      end: new Date('2024-02-29'),
    };
    result.current.setRangeB(newRangeB);

    expect(mockSetRangeB).toHaveBeenCalledWith(newRangeB);
    expect(mockSetRangeB).toHaveBeenCalledTimes(1);
  });

  it('handles updating only start date of range A', () => {
    const mockSetRangeA = vi.fn();
    const currentRangeA = {
      start: new Date('2024-01-01'),
      end: new Date('2024-01-31'),
    };

    vi.spyOn(AppProviders, 'useAppContext').mockReturnValue({
      rangeA: currentRangeA,
      setRangeA: mockSetRangeA,
      rangeB: { start: null, end: null },
      setRangeB: vi.fn(),
    });

    const { result } = renderHook(() => useRangeComparisons());

    const updatedRangeA = {
      ...currentRangeA,
      start: new Date('2024-01-15'),
    };
    result.current.setRangeA(updatedRangeA);

    expect(mockSetRangeA).toHaveBeenCalledWith(updatedRangeA);
  });

  it('handles updating only end date of range B', () => {
    const mockSetRangeB = vi.fn();
    const currentRangeB = {
      start: new Date('2024-02-01'),
      end: new Date('2024-02-15'),
    };

    vi.spyOn(AppProviders, 'useAppContext').mockReturnValue({
      rangeA: { start: null, end: null },
      setRangeA: vi.fn(),
      rangeB: currentRangeB,
      setRangeB: mockSetRangeB,
    });

    const { result } = renderHook(() => useRangeComparisons());

    const updatedRangeB = {
      ...currentRangeB,
      end: new Date('2024-02-29'),
    };
    result.current.setRangeB(updatedRangeB);

    expect(mockSetRangeB).toHaveBeenCalledWith(updatedRangeB);
  });

  it('throws error when used outside AppProviders', () => {
    vi.spyOn(AppProviders, 'useAppContext').mockImplementation(() => {
      throw new Error('useAppContext must be used within AppProviders');
    });

    expect(() => {
      renderHook(() => useRangeComparisons());
    }).toThrow('useAppContext must be used within AppProviders');
  });
});
