import { describe, it, expect } from 'vitest';
import {
  clusterApneaEvents,
  detectFalseNegatives,
  computeClusterSeverity,
  clustersToCsv,
} from './clustering';

describe('clusterApneaEvents', () => {
  it('returns empty array when no events', () => {
    expect(clusterApneaEvents([], [])).toEqual([]);
  });

  it('clusters events within gap and computes duration and count', () => {
    const base = new Date('2021-01-01T00:00:00Z');
    const events = [
      { date: base, durationSec: 10 },
      { date: new Date(base.getTime() + 50000), durationSec: 5 },
    ];
    const clusters = clusterApneaEvents(events, []);
    expect(clusters).toHaveLength(1);
    const [c] = clusters;
    // start at first event, end at last event + its duration
    expect(c.start).toEqual(base);
    expect(c.end.getTime()).toBe(base.getTime() + 50000 + 5000);
    expect(c.count).toBe(2);
  });

  it('applies density filter when minDensityPerMin > 0', () => {
    const base = new Date('2021-01-01T00:00:00Z');
    // events far apart -> low density
    const events = [
      { date: new Date(base.getTime() + 0), durationSec: 10 },
      { date: new Date(base.getTime() + 180000), durationSec: 10 }, // 3 minutes later
    ];
    const clusters = clusterApneaEvents(
      events,
      [],
      300,
      0.1,
      60,
      0.5,
      0.35,
      10,
      1.5
    );
    // density = 2 events over ~3+ minutes -> < 1.5 ev/min, so filtered out
    expect(clusters.length).toBe(0);
  });

  it('extends boundaries using FLG hysteresis enter/exit', () => {
    const base = new Date('2021-01-01T00:00:00Z');
    const events = [
      { date: new Date(base.getTime() + 60000), durationSec: 10 },
    ]; // event at t=60s
    // FLG just before event: starts above enter (0.5), then decays above exit (0.35)
    const flg = [
      { date: new Date(base.getTime() + 30000), level: 0.6 },
      { date: new Date(base.getTime() + 40000), level: 0.45 },
      { date: new Date(base.getTime() + 50000), level: 0.38 },
    ];
    const clusters = clusterApneaEvents(
      events,
      flg,
      120,
      0.1,
      60,
      0.5,
      0.35,
      5,
      0
    );
    expect(clusters.length).toBe(1);
    // start should be extended back to first FLG in edge segment (30s)
    expect(clusters[0].start.getTime()).toBe(base.getTime() + 30000);
  });
});

describe('detectFalseNegatives', () => {
  it('filters FLG clusters by duration, absence of apnea, and confidence', () => {
    const details = [
      { Event: 'FLG', 'Data/Duration': 1.0, DateTime: '2021-01-01T00:00:00Z' },
      { Event: 'FLG', 'Data/Duration': 1.0, DateTime: '2021-01-01T00:01:00Z' },
      {
        Event: 'ClearAirway',
        'Data/Duration': '10',
        DateTime: '2021-01-02T00:00:00Z',
      },
    ];
    const fns = detectFalseNegatives(details);
    // One FLG cluster of ~60s before ClearAirway occurs next day
    expect(fns).toHaveLength(1);
    expect(fns[0].durationSec).toBeGreaterThanOrEqual(60);
    expect(fns[0].confidence).toBe(1);
  });

  it('respects false-negative detection options (threshold and confidence)', () => {
    const details = [
      { Event: 'FLG', 'Data/Duration': 0.8, DateTime: '2021-01-01T00:00:00Z' },
      { Event: 'FLG', 'Data/Duration': 0.8, DateTime: '2021-01-01T00:00:40Z' },
    ];
    const strict = detectFalseNegatives(details, {
      flThreshold: 0.9,
      confidenceMin: 0.95,
      gapSec: 60,
      minDurationSec: 30,
    });
    const lenient = detectFalseNegatives(details, {
      flThreshold: 0.7,
      confidenceMin: 0.7,
      gapSec: 60,
      minDurationSec: 30,
    });
    expect(strict.length).toBe(0);
    expect(lenient.length).toBe(1);
  });
});

describe('computeClusterSeverity', () => {
  it('returns higher score for higher duration and density and extension', () => {
    const base = new Date('2021-01-01T00:00:00Z');
    const mk = (evts, startOffset = 0, extraPadSec = 0) => {
      const events = evts.map(([offsetSec, dur]) => ({
        date: new Date(base.getTime() + (startOffset + offsetSec) * 1000),
        durationSec: dur,
      }));
      const start = events[0].date;
      const last = events[events.length - 1];
      let end = new Date(last.date.getTime() + last.durationSec * 1000);
      if (extraPadSec) end = new Date(end.getTime() + extraPadSec * 1000);
      const cl = {
        start,
        end,
        durationSec: (end - start) / 1000,
        count: events.length,
        events,
      };
      return computeClusterSeverity(cl);
    };
    const s1 = mk([
      [0, 10],
      [30, 10],
    ]); // baseline
    const s2 = mk([
      [0, 20],
      [30, 20],
    ]); // more total duration -> higher
    const s3 = mk([
      [0, 10],
      [10, 10],
      [20, 10],
    ]); // more dense -> higher
    const s4 = mk(
      [
        [0, 10],
        [30, 10],
      ],
      0,
      60
    ); // extension -> higher
    expect(s2).toBeGreaterThan(s1);
    expect(s3).toBeGreaterThan(s1);
    expect(s4).toBeGreaterThan(s1);
  });
});

describe('clustersToCsv', () => {
  it('produces CSV header and rows', () => {
    const base = new Date('2021-01-01T00:00:00Z');
    const cl = {
      start: base,
      end: new Date(base.getTime() + 60000),
      durationSec: 60,
      count: 3,
      severity: 1.2345,
      events: [
        { date: base, durationSec: 10 },
        { date: new Date(base.getTime() + 20000), durationSec: 10 },
        { date: new Date(base.getTime() + 40000), durationSec: 10 },
      ],
    };
    const csv = clustersToCsv([cl]);
    const lines = csv.split('\n');
    expect(lines[0]).toContain('index,start,end,durationSec,count,severity');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain(',60,3,');
    const cols = lines[1].split(',');
    const sev = Number(cols[5]);
    expect(sev).toBeGreaterThan(1.23);
    expect(sev).toBeLessThan(1.24);
  });
});
