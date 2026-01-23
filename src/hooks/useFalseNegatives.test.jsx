import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFalseNegatives } from './useFalseNegatives';
import * as AppProviders from '../app/AppProviders';

describe('useFalseNegatives', () => {
  it('returns false negative state and operations from context', () => {
    const mockFalseNegatives = [
      {
        id: 1,
        start: new Date('2024-01-01T02:00:00'),
        events: 4,
        confidence: 0.85,
      },
      {
        id: 2,
        start: new Date('2024-01-02T03:00:00'),
        events: 3,
        confidence: 0.72,
      },
    ];
    const mockFnPreset = 'balanced';
    const mockSetFnPreset = vi.fn();

    vi.spyOn(AppProviders, 'useAppContext').mockReturnValue({
      falseNegatives: mockFalseNegatives,
      fnPreset: mockFnPreset,
      setFnPreset: mockSetFnPreset,
    });

    const { result } = renderHook(() => useFalseNegatives());

    expect(result.current.falseNegatives).toBe(mockFalseNegatives);
    expect(result.current.fnPreset).toBe(mockFnPreset);
    expect(result.current.setFnPreset).toBe(mockSetFnPreset);
  });

  it('returns correct properties when false negatives array is empty', () => {
    const mockFnPreset = 'strict';
    const mockSetFnPreset = vi.fn();

    vi.spyOn(AppProviders, 'useAppContext').mockReturnValue({
      falseNegatives: [],
      fnPreset: mockFnPreset,
      setFnPreset: mockSetFnPreset,
    });

    const { result } = renderHook(() => useFalseNegatives());

    expect(result.current.falseNegatives).toEqual([]);
    expect(result.current.fnPreset).toBe('strict');
  });

  it('provides setFnPreset function that can be called with different presets', () => {
    const mockSetFnPreset = vi.fn();

    vi.spyOn(AppProviders, 'useAppContext').mockReturnValue({
      falseNegatives: [],
      fnPreset: 'balanced',
      setFnPreset: mockSetFnPreset,
    });

    const { result } = renderHook(() => useFalseNegatives());

    // Test setting to strict
    result.current.setFnPreset('strict');
    expect(mockSetFnPreset).toHaveBeenCalledWith('strict');

    // Test setting to lenient
    result.current.setFnPreset('lenient');
    expect(mockSetFnPreset).toHaveBeenCalledWith('lenient');

    expect(mockSetFnPreset).toHaveBeenCalledTimes(2);
  });

  it('handles lenient preset with larger false negatives array', () => {
    const mockFalseNegatives = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      start: new Date(`2024-01-${String(i + 1).padStart(2, '0')}T02:00:00`),
      events: 2 + i,
      confidence: 0.5 + i * 0.05,
    }));
    const mockFnPreset = 'lenient';
    const mockSetFnPreset = vi.fn();

    vi.spyOn(AppProviders, 'useAppContext').mockReturnValue({
      falseNegatives: mockFalseNegatives,
      fnPreset: mockFnPreset,
      setFnPreset: mockSetFnPreset,
    });

    const { result } = renderHook(() => useFalseNegatives());

    expect(result.current.falseNegatives).toHaveLength(10);
    expect(result.current.fnPreset).toBe('lenient');
  });

  it('throws error when used outside AppProviders', () => {
    vi.spyOn(AppProviders, 'useAppContext').mockImplementation(() => {
      throw new Error('useAppContext must be used within AppProviders');
    });

    expect(() => {
      renderHook(() => useFalseNegatives());
    }).toThrow('useAppContext must be used within AppProviders');
  });
});
