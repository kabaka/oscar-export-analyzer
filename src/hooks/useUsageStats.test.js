import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useUsageStats } from './useUsageStats';

const values = [1, 2, 3, 4, 5];

describe('useUsageStats', () => {
  it('produces basic descriptive stats', () => {
    const { result } = renderHook(() => useUsageStats(values));

    expect(result.current.p25).toBe(2);
    expect(result.current.median).toBe(3);
    expect(result.current.p75).toBe(4);
    expect(result.current.mean).toBe(3);
    expect(result.current.iqr).toBe(2);
    expect(result.current.range).toBe(4);
    expect(result.current.nbins).toBe(2);
  });
});
