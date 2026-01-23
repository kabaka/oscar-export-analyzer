import { describe, it, expect } from 'vitest';
import {
  toValidDate,
  normalizeCluster,
  normalizeFalseNegative,
  normalizeClusters,
  normalizeFalseNegatives,
} from './normalization';

/* eslint-disable no-magic-numbers */

describe('toValidDate', () => {
  it('returns valid Date object unchanged', () => {
    const date = new Date('2025-06-01T12:00:00Z');
    expect(toValidDate(date)).toBe(date);
  });

  it('converts valid timestamp number to Date', () => {
    const timestamp = 1717243200000; // 2024-06-01T12:00:00Z
    const result = toValidDate(timestamp);
    expect(result).toBeInstanceOf(Date);
    expect(result.getTime()).toBe(timestamp);
  });

  it('converts valid ISO string to Date', () => {
    const isoString = '2025-06-01T12:00:00Z';
    const result = toValidDate(isoString);
    expect(result).toBeInstanceOf(Date);
    expect(result.toISOString()).toBe('2025-06-01T12:00:00.000Z');
  });

  it('returns null for invalid Date object', () => {
    const invalidDate = new Date('invalid');
    expect(toValidDate(invalidDate)).toBeNull();
  });

  it('returns null for invalid string', () => {
    expect(toValidDate('not-a-date')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(toValidDate('')).toBeNull();
  });

  it('returns null for null', () => {
    expect(toValidDate(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(toValidDate(undefined)).toBeNull();
  });

  it('returns null for invalid number', () => {
    expect(toValidDate(NaN)).toBeNull();
  });
});

describe('normalizeCluster', () => {
  it('normalizes cluster with valid ISO string dates', () => {
    const cluster = {
      id: 'cluster-1',
      start: '2025-06-01T00:00:00Z',
      end: '2025-06-01T01:00:00Z',
      events: [
        { date: '2025-06-01T00:00:00Z', durationSec: 30 },
        { date: '2025-06-01T00:30:00Z', durationSec: 45 },
      ],
    };

    const result = normalizeCluster(cluster);
    expect(result).toBeDefined();
    expect(result.start).toBeInstanceOf(Date);
    expect(result.end).toBeInstanceOf(Date);
    expect(result.events[0].date).toBeInstanceOf(Date);
    expect(result.events[1].date).toBeInstanceOf(Date);
  });

  it('normalizes cluster with timestamp dates', () => {
    const cluster = {
      id: 'cluster-2',
      start: 1717243200000,
      end: 1717246800000,
      events: [{ date: 1717243200000, durationSec: 30 }],
    };

    const result = normalizeCluster(cluster);
    expect(result).toBeDefined();
    expect(result.start).toBeInstanceOf(Date);
    expect(result.end).toBeInstanceOf(Date);
    expect(result.events[0].date).toBeInstanceOf(Date);
  });

  it('falls back to first event date when start is missing', () => {
    const cluster = {
      id: 'cluster-3',
      events: [
        { date: '2025-06-01T00:00:00Z', durationSec: 30 },
        { date: '2025-06-01T00:30:00Z', durationSec: 45 },
      ],
    };

    const result = normalizeCluster(cluster);
    expect(result).toBeDefined();
    expect(result.start).toBeInstanceOf(Date);
    expect(result.start.toISOString()).toBe('2025-06-01T00:00:00.000Z');
  });

  it('falls back to last event date when end is missing', () => {
    const cluster = {
      id: 'cluster-4',
      start: '2025-06-01T00:00:00Z',
      events: [
        { date: '2025-06-01T00:00:00Z', durationSec: 30 },
        { date: '2025-06-01T00:30:00Z', durationSec: 45 },
      ],
    };

    const result = normalizeCluster(cluster);
    expect(result).toBeDefined();
    expect(result.end).toBeInstanceOf(Date);
    expect(result.end.toISOString()).toBe('2025-06-01T00:30:00.000Z');
  });

  it('uses start as end when both end and events are missing', () => {
    const cluster = {
      id: 'cluster-5',
      start: '2025-06-01T00:00:00Z',
      events: [],
    };

    const result = normalizeCluster(cluster);
    expect(result).toBeDefined();
    expect(result.end).toBeInstanceOf(Date);
    expect(result.end).toEqual(result.start);
  });

  it('filters out events with invalid dates', () => {
    const cluster = {
      id: 'cluster-6',
      start: '2025-06-01T00:00:00Z',
      end: '2025-06-01T01:00:00Z',
      events: [
        { date: '2025-06-01T00:00:00Z', durationSec: 30 },
        { date: 'invalid', durationSec: 45 },
        { date: '2025-06-01T00:30:00Z', durationSec: 20 },
      ],
    };

    const result = normalizeCluster(cluster);
    expect(result).toBeDefined();
    expect(result.events).toHaveLength(2);
  });

  it('returns null when cluster is null', () => {
    expect(normalizeCluster(null)).toBeNull();
  });

  it('returns null when cluster has no valid start date', () => {
    const cluster = {
      id: 'cluster-7',
      start: 'invalid',
      events: [],
    };

    expect(normalizeCluster(cluster)).toBeNull();
  });

  it('returns null when cluster has no start and no events', () => {
    const cluster = {
      id: 'cluster-8',
      events: [],
    };

    expect(normalizeCluster(cluster)).toBeNull();
  });
});

describe('normalizeFalseNegative', () => {
  it('normalizes false negative with valid ISO string dates', () => {
    const entry = {
      start: '2025-06-01T00:00:00Z',
      end: '2025-06-01T01:00:00Z',
      durationSec: 60,
      confidence: 0.8,
    };

    const result = normalizeFalseNegative(entry);
    expect(result).toBeDefined();
    expect(result.start).toBeInstanceOf(Date);
    expect(result.end).toBeInstanceOf(Date);
    expect(result.durationSec).toBe(60);
    expect(result.confidence).toBe(0.8);
  });

  it('normalizes false negative with timestamp dates', () => {
    const entry = {
      start: 1717243200000,
      end: 1717246800000,
      durationSec: 60,
    };

    const result = normalizeFalseNegative(entry);
    expect(result).toBeDefined();
    expect(result.start).toBeInstanceOf(Date);
    expect(result.end).toBeInstanceOf(Date);
  });

  it('falls back to start date when end is missing', () => {
    const entry = {
      start: '2025-06-01T00:00:00Z',
      durationSec: 60,
    };

    const result = normalizeFalseNegative(entry);
    expect(result).toBeDefined();
    expect(result.end).toBeInstanceOf(Date);
    expect(result.end).toEqual(result.start);
  });

  it('falls back to start date when end is invalid', () => {
    const entry = {
      start: '2025-06-01T00:00:00Z',
      end: 'invalid',
      durationSec: 60,
    };

    const result = normalizeFalseNegative(entry);
    expect(result).toBeDefined();
    expect(result.end).toBeInstanceOf(Date);
    expect(result.end).toEqual(result.start);
  });

  it('returns null when entry is null', () => {
    expect(normalizeFalseNegative(null)).toBeNull();
  });

  it('returns null when start is missing', () => {
    const entry = {
      end: '2025-06-01T01:00:00Z',
      durationSec: 60,
    };

    expect(normalizeFalseNegative(entry)).toBeNull();
  });

  it('returns null when start is invalid', () => {
    const entry = {
      start: 'invalid',
      end: '2025-06-01T01:00:00Z',
      durationSec: 60,
    };

    expect(normalizeFalseNegative(entry)).toBeNull();
  });
});

describe('normalizeClusters', () => {
  it('normalizes array of clusters', () => {
    const clusters = [
      {
        id: 'cluster-1',
        start: '2025-06-01T00:00:00Z',
        end: '2025-06-01T01:00:00Z',
        events: [{ date: '2025-06-01T00:00:00Z', durationSec: 30 }],
      },
      {
        id: 'cluster-2',
        start: '2025-06-02T00:00:00Z',
        end: '2025-06-02T01:00:00Z',
        events: [{ date: '2025-06-02T00:00:00Z', durationSec: 45 }],
      },
    ];

    const result = normalizeClusters(clusters);
    expect(result).toHaveLength(2);
    expect(result[0].start).toBeInstanceOf(Date);
    expect(result[1].start).toBeInstanceOf(Date);
  });

  it('filters out invalid clusters', () => {
    const clusters = [
      {
        id: 'cluster-1',
        start: '2025-06-01T00:00:00Z',
        events: [{ date: '2025-06-01T00:00:00Z', durationSec: 30 }],
      },
      {
        id: 'cluster-2',
        start: 'invalid',
        events: [],
      },
      {
        id: 'cluster-3',
        start: '2025-06-03T00:00:00Z',
        events: [{ date: '2025-06-03T00:00:00Z', durationSec: 20 }],
      },
    ];

    const result = normalizeClusters(clusters);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('cluster-1');
    expect(result[1].id).toBe('cluster-3');
  });

  it('returns empty array for non-array input', () => {
    expect(normalizeClusters(null)).toEqual([]);
    expect(normalizeClusters(undefined)).toEqual([]);
    expect(normalizeClusters('not-array')).toEqual([]);
  });

  it('returns empty array for empty array input', () => {
    expect(normalizeClusters([])).toEqual([]);
  });
});

describe('normalizeFalseNegatives', () => {
  it('normalizes array of false negatives', () => {
    const entries = [
      {
        start: '2025-06-01T00:00:00Z',
        end: '2025-06-01T01:00:00Z',
        durationSec: 60,
      },
      {
        start: '2025-06-02T00:00:00Z',
        end: '2025-06-02T01:00:00Z',
        durationSec: 45,
      },
    ];

    const result = normalizeFalseNegatives(entries);
    expect(result).toHaveLength(2);
    expect(result[0].start).toBeInstanceOf(Date);
    expect(result[1].start).toBeInstanceOf(Date);
  });

  it('filters out invalid entries', () => {
    const entries = [
      {
        start: '2025-06-01T00:00:00Z',
        durationSec: 60,
      },
      {
        start: 'invalid',
        durationSec: 45,
      },
      {
        start: '2025-06-03T00:00:00Z',
        durationSec: 30,
      },
    ];

    const result = normalizeFalseNegatives(entries);
    expect(result).toHaveLength(2);
  });

  it('returns empty array for non-array input', () => {
    expect(normalizeFalseNegatives(null)).toEqual([]);
    expect(normalizeFalseNegatives(undefined)).toEqual([]);
    expect(normalizeFalseNegatives('not-array')).toEqual([]);
  });

  it('returns empty array for empty array input', () => {
    expect(normalizeFalseNegatives([])).toEqual([]);
  });
});
