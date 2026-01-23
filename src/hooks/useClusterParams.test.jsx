import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useClusterParams } from './useClusterParams';
import * as AppProviders from '../app/AppProviders';

describe('useClusterParams', () => {
  it('returns cluster params and operations from context', () => {
    const mockClusterParams = {
      algorithm: 'edge',
      gapSec: 120,
      bridgeThreshold: 2,
      bridgeSec: 60,
    };
    const mockOnClusterParamChange = vi.fn();
    const mockApneaClusters = [
      { id: 1, start: new Date('2024-01-01'), events: 5 },
      { id: 2, start: new Date('2024-01-02'), events: 3 },
    ];

    vi.spyOn(AppProviders, 'useAppContext').mockReturnValue({
      clusterParams: mockClusterParams,
      onClusterParamChange: mockOnClusterParamChange,
      apneaClusters: mockApneaClusters,
    });

    const { result } = renderHook(() => useClusterParams());

    expect(result.current.clusterParams).toBe(mockClusterParams);
    expect(result.current.onClusterParamChange).toBe(mockOnClusterParamChange);
    expect(result.current.apneaClusters).toBe(mockApneaClusters);
  });

  it('returns correct properties when clusters array is empty', () => {
    const mockClusterParams = {
      algorithm: 'time-gap',
      gapSec: 90,
    };
    const mockOnClusterParamChange = vi.fn();

    vi.spyOn(AppProviders, 'useAppContext').mockReturnValue({
      clusterParams: mockClusterParams,
      onClusterParamChange: mockOnClusterParamChange,
      apneaClusters: [],
    });

    const { result } = renderHook(() => useClusterParams());

    expect(result.current.clusterParams).toBe(mockClusterParams);
    expect(result.current.onClusterParamChange).toBe(mockOnClusterParamChange);
    expect(result.current.apneaClusters).toEqual([]);
  });

  it('provides function that can be called', () => {
    const mockOnClusterParamChange = vi.fn();

    vi.spyOn(AppProviders, 'useAppContext').mockReturnValue({
      clusterParams: { gapSec: 120 },
      onClusterParamChange: mockOnClusterParamChange,
      apneaClusters: [],
    });

    const { result } = renderHook(() => useClusterParams());

    // Test that the function can be called
    result.current.onClusterParamChange({ gapSec: 180 });

    expect(mockOnClusterParamChange).toHaveBeenCalledWith({ gapSec: 180 });
    expect(mockOnClusterParamChange).toHaveBeenCalledTimes(1);
  });

  it('throws error when used outside AppProviders', () => {
    vi.spyOn(AppProviders, 'useAppContext').mockImplementation(() => {
      throw new Error('useAppContext must be used within AppProviders');
    });

    expect(() => {
      renderHook(() => useClusterParams());
    }).toThrow('useAppContext must be used within AppProviders');
  });
});
