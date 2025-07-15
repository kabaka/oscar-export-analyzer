import { describe, it, expect } from 'vitest';
import { parseDuration, quantile } from './stats';

describe('parseDuration', () => {
  it('parses HH:MM:SS format', () => {
    expect(parseDuration('1:02:03')).toBe(3723);
  });

  it('handles MM:SS format', () => {
    expect(parseDuration('2:03')).toBe(123);
  });
});

describe('quantile', () => {
  it('computes median for odd-length array', () => {
    expect(quantile([1, 3, 2], 0.5)).toBe(2);
  });

  it('interpolates for even-length array', () => {
    expect(quantile([0, 10], 0.5)).toBe(5);
  });
});
