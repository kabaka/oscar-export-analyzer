/* eslint-disable no-magic-numbers -- test-specific autocorrelation test data and lag values */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutocorrelation } from './useAutocorrelation';

const series = [1, 2, 3, 4, 5, 6];

describe('useAutocorrelation', () => {
  it('computes acf/pacf and clamps lag input', () => {
    const { result } = renderHook(() =>
      useAutocorrelation(series, {
        initialMaxLag: 4,
        minLag: 1,
        maxLag: 5,
      }),
    );

    expect(result.current.acfValues.length).toBeGreaterThan(0);
    expect(result.current.pacfValues.length).toBeGreaterThan(0);
    expect(result.current.maxLag).toBe(4);

    act(() => {
      result.current.handleLagChange({ target: { value: '100' } });
    });

    expect(result.current.maxLag).toBe(5);
  });
});
