import { describe, it, expect } from 'vitest';
import { clusterApneaEvents, detectFalseNegatives } from './clustering';

describe('clusterApneaEvents', () => {
  it('returns empty array when no events', () => {
    expect(clusterApneaEvents([], [])).toEqual([]);
  });

  it('clusters events within gap and computes duration and count', () => {
    const base = new Date('2021-01-01T00:00:00Z');
    const events = [
      { date: base, durationSec: 10 },
      { date: new Date(base.getTime() + 50000), durationSec: 5 }
    ];
    const clusters = clusterApneaEvents(events, []);
    expect(clusters).toHaveLength(1);
    const [c] = clusters;
    // start at first event, end at last event + its duration
    expect(c.start).toEqual(base);
    expect(c.end.getTime()).toBe(base.getTime() + 50000 + 5000);
    expect(c.count).toBe(2);
  });
});

describe('detectFalseNegatives', () => {
  it('filters FLG clusters by duration, absence of apnea, and confidence', () => {
    const details = [
    { Event: 'FLG', 'Data/Duration': 1.0, DateTime: '2021-01-01T00:00:00Z' },
    { Event: 'FLG', 'Data/Duration': 1.0, DateTime: '2021-01-01T00:01:00Z' },
      { Event: 'ClearAirway', 'Data/Duration': '10', DateTime: '2021-01-02T00:00:00Z' }
    ];
    const fns = detectFalseNegatives(details);
    // One FLG cluster of ~60s before ClearAirway occurs next day
    expect(fns).toHaveLength(1);
    expect(fns[0].durationSec).toBeGreaterThanOrEqual(60);
    expect(fns[0].confidence).toBe(1);
  });
});
