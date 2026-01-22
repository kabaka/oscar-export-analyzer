/* eslint-disable no-magic-numbers -- test-specific event durations, thresholds, and clustering scenarios */
import { describe, it, expect, vi } from 'vitest';
import {
  clusterApneaEvents,
  clusterApneaEventsBridged,
  clusterApneaEventsKMeans,
  clusterApneaEventsAgglomerative,
  detectFalseNegatives,
  computeClusterSeverity,
  clustersToCsv,
  CLUSTER_ALGORITHMS,
  CLUSTERING_DEFAULTS,
} from './clustering';
import {
  APNEA_CLUSTER_MIN_EVENTS,
  EVENT_WINDOW_MS,
  SECONDS_PER_MINUTE,
} from '../constants';
import { DEFAULT_APNEA_CLUSTER_GAP_SEC } from '../test-utils/testConstants';

const EDGE_ENTER_THRESHOLD = CLUSTERING_DEFAULTS.EDGE_ENTER_THRESHOLD;
const EDGE_EXIT_THRESHOLD =
  CLUSTERING_DEFAULTS.EDGE_ENTER_THRESHOLD *
  CLUSTERING_DEFAULTS.EDGE_EXIT_FRACTION;
const BRIDGE_THRESHOLD = CLUSTERING_DEFAULTS.FLG_BRIDGE_THRESHOLD;
const BRIDGED_GAP_SECONDS = CLUSTERING_DEFAULTS.FLG_CLUSTER_GAP_SEC;
const MIN_DENSITY_THRESHOLD = 1.5;
const STRICT_FL_THRESHOLD = 0.9;
const LENIENT_FL_THRESHOLD = 0.7;
const MIN_DURATION_THRESHOLD = 30;
const CUSTOM_BRIDGE_THRESHOLD = 0.15;
const FLG_LEVEL_STRONG = 0.2;
const FLG_LEVEL_TRANSITION = 0.45;
const FLG_LEVEL_DECAY = 0.38;
const FLG_LEVEL_ENTER = 0.6;
const EDGE_MIN_DURATION = 5;
const LENIENT_PEAK_FLG_LEVEL = 0.7;
const BRIDGE_DURATION_MULTIPLIER = 1.5;

describe('clusterApneaEvents', () => {
  it('returns empty array when no events', () => {
    expect(clusterApneaEvents({ events: [], flgEvents: [] })).toEqual([]);
  });

  it('clusters events within gap and computes duration and count', () => {
    const base = new Date('2021-01-01T00:00:00Z');
    const events = [
      { date: base, durationSec: 10 },
      { date: new Date(base.getTime() + 50000), durationSec: 5 },
    ];
    const clusters = clusterApneaEvents({ events, flgEvents: [] });
    expect(clusters).toHaveLength(1);
    const [c] = clusters;
    // start at first event, end at last event + its duration
    expect(c.start).toEqual(base);
    expect(c.end.getTime()).toBe(base.getTime() + 50000 + EVENT_WINDOW_MS);
    expect(c.count).toBe(2);
  });

  it('bridges gaps using qualifying FLG readings', () => {
    const base = new Date('2021-01-01T00:00:00Z');
    const events = [
      { date: base, durationSec: 10 },
      { date: new Date(base.getTime() + 50000), durationSec: 5 }, // 50s later
    ];
    const flg = [
      { date: new Date(base.getTime() + 30000), level: FLG_LEVEL_STRONG },
    ]; // FLG between events above threshold
    const clusters = clusterApneaEvents({
      events,
      flgEvents: flg,
      gapSec: BRIDGED_GAP_SECONDS / 2,
      bridgeThreshold: BRIDGE_THRESHOLD,
      bridgeSec: BRIDGED_GAP_SECONDS,
    });
    expect(clusters).toHaveLength(1);
  });

  it('applies density filter when minDensityPerMin > 0', () => {
    const base = new Date('2021-01-01T00:00:00Z');
    // events far apart -> low density
    const events = [
      { date: new Date(base.getTime() + 0), durationSec: 10 },
      { date: new Date(base.getTime() + 180000), durationSec: 10 }, // 3 minutes later
    ];
    const clusters = clusterApneaEvents({
      events,
      flgEvents: [],
      gapSec: DEFAULT_APNEA_CLUSTER_GAP_SEC * 2.5,
      bridgeThreshold: BRIDGE_THRESHOLD,
      bridgeSec: BRIDGED_GAP_SECONDS,
      edgeEnter: EDGE_ENTER_THRESHOLD,
      edgeExit: EDGE_EXIT_THRESHOLD,
      edgeMinDurSec: CLUSTERING_DEFAULTS.EDGE_MIN_DURATION_SEC,
      minDensity: MIN_DENSITY_THRESHOLD,
    });
    // density = 2 events over ~3+ minutes -> < MIN_DENSITY_THRESHOLD ev/min, so filtered out
    expect(clusters.length).toBe(0);
  });

  it('extends boundaries using FLG hysteresis enter/exit', () => {
    const base = new Date('2021-01-01T00:00:00Z');
    const events = [
      {
        date: new Date(base.getTime() + SECONDS_PER_MINUTE * 1000),
        durationSec: 10,
      },
    ]; // event at t=60s
    // FLG just before event: starts above enter (0.5), then decays above exit (0.35)
    const flg = [
      { date: new Date(base.getTime() + 30000), level: FLG_LEVEL_ENTER },
      { date: new Date(base.getTime() + 40000), level: FLG_LEVEL_TRANSITION },
      { date: new Date(base.getTime() + 50000), level: FLG_LEVEL_DECAY },
    ];
    const clusters = clusterApneaEvents({
      events,
      flgEvents: flg,
      gapSec: CLUSTERING_DEFAULTS.APNEA_GAP_SEC,
      bridgeThreshold: BRIDGE_THRESHOLD,
      bridgeSec: BRIDGED_GAP_SECONDS,
      edgeEnter: EDGE_ENTER_THRESHOLD,
      edgeExit: EDGE_EXIT_THRESHOLD,
      edgeMinDurSec: EDGE_MIN_DURATION,
    });
    expect(clusters.length).toBe(1);
    // start should be extended back to first FLG in edge segment (30s)
    expect(clusters[0].start.getTime()).toBe(base.getTime() + 30000);
  });

  it('clusters with k-means when requested', () => {
    const base = new Date('2021-01-01T00:00:00Z');
    const events = Array.from({ length: 6 }).map((_, idx) => ({
      date: new Date(base.getTime() + idx * 60_000),
      durationSec: 10,
    }));
    const clusters = clusterApneaEvents({
      algorithm: CLUSTER_ALGORITHMS.KMEANS,
      events,
      k: 2,
    });
    expect(clusters).toHaveLength(2);
    expect(clusters[0].count + clusters[1].count).toBe(6);
  });

  it('k-means attaches convergence metadata and WCSS', () => {
    const base = new Date('2024-01-01T00:00:00Z');
    const events = Array.from({ length: 6 }).map((_, idx) => ({
      date: new Date(
        base.getTime() +
          (idx < 3 ? idx * 60_000 : (idx - 3) * 60_000 + 24 * 3600 * 1000),
      ),
      durationSec: 10,
    }));
    const clusters = clusterApneaEventsKMeans({ events, k: 2 });
    expect(Array.isArray(clusters)).toBe(true);
    expect(clusters.meta).toBeDefined();
    expect(typeof clusters.meta.converged).toBe('boolean');
    expect(typeof clusters.meta.iterations).toBe('number');
    expect(typeof clusters.meta.wcss).toBe('number');
    expect(clusters.meta.kOverspecified).toBe(false);
  });

  it('k-means converges quickly on well-separated bimodal events', () => {
    const base = new Date('2025-01-01T00:00:00Z');
    const clusterA = Array.from({ length: 5 }).map((_, idx) => ({
      date: new Date(base.getTime() + idx * 60_000),
      durationSec: 8,
    }));
    const clusterBBase = new Date(base.getTime() + 24 * 3600 * 1000);
    const clusterB = Array.from({ length: 5 }).map((_, idx) => ({
      date: new Date(clusterBBase.getTime() + idx * 60_000),
      durationSec: 8,
    }));
    const clusters = clusterApneaEventsKMeans({
      events: [...clusterA, ...clusterB],
      k: 2,
    });
    expect(clusters.meta.converged).toBe(true);
    expect(clusters.meta.iterations).toBeLessThan(
      CLUSTERING_DEFAULTS.KMEANS_MAX_ITERATIONS,
    );
    expect(clusters).toHaveLength(2);
  });

  it('k-means marks overspecified k when k approaches half the sample size', () => {
    const base = new Date('2025-02-01T00:00:00Z');
    const events = Array.from({ length: 12 }).map((_, idx) => ({
      date: new Date(base.getTime() + idx * 45_000),
      durationSec: 6,
    }));
    const clusters = clusterApneaEventsKMeans({ events, k: 6 });
    expect(clusters.meta.kOverspecified).toBe(true);
    expect(clusters.meta.converged).toBe(true);
  });

  it('k-means flags max iterations reached under adversarial iteration limits', () => {
    const base = new Date('2025-03-01T00:00:00Z');
    const events = Array.from({ length: 8 }).map((_, idx) => ({
      date: new Date(
        base.getTime() + (idx % 2 === 0 ? idx * 5_000 : idx * 90_000),
      ),
      durationSec: 10,
    }));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const clusters = clusterApneaEventsKMeans({
      events,
      k: 2,
      maxIterations: 1,
    });
    expect(clusters.meta.maxIterationsReached).toBe(true);
    expect(clusters.meta.converged).toBe(false);
    warnSpy.mockRestore();
  });

  it('computes finite positive WCSS for clustered events', () => {
    const base = new Date('2025-04-01T00:00:00Z');
    const events = Array.from({ length: 9 }).map((_, idx) => ({
      date: new Date(base.getTime() + idx * 30_000),
      durationSec: 12,
    }));
    const clusters = clusterApneaEventsKMeans({ events, k: 3 });
    expect(Number.isFinite(clusters.meta.wcss)).toBe(true);
    expect(clusters.meta.wcss).toBeGreaterThan(0);
  });

  it('k-means warns when max iterations reached', () => {
    const base = new Date('2024-01-01T00:00:00Z');
    const events = Array.from({ length: 6 }).map((_, idx) => ({
      date: new Date(base.getTime() + idx * 10_000),
      durationSec: 10,
    }));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const clusters = clusterApneaEventsKMeans({
      events,
      k: 2,
      maxIterations: 1,
    });
    expect(clusters.meta.maxIterationsReached).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('clusters with single-link agglomerative when requested', () => {
    const base = new Date('2021-01-01T00:00:00Z');
    const events = [
      { date: base, durationSec: 10 },
      { date: new Date(base.getTime() + 20_000), durationSec: 10 },
      { date: new Date(base.getTime() + 600_000), durationSec: 10 },
    ];
    const clusters = clusterApneaEvents({
      algorithm: CLUSTER_ALGORITHMS.AGGLOMERATIVE,
      events,
      linkageThresholdSec: CLUSTERING_DEFAULTS.FLG_CLUSTER_GAP_SEC / 2,
    });
    expect(clusters).toHaveLength(2);
    expect(clusters[0].count).toBe(2);
    expect(clusters[1].count).toBe(1);
  });
});

describe('dedicated apnea clustering implementations', () => {
  const base = new Date('2023-01-01T00:00:00Z');
  const mkEvent = (offsetSec, durationSec = 10) => ({
    date: new Date(base.getTime() + offsetSec * 1000),
    durationSec,
  });

  it('bridged variant merges events that share FLG support', () => {
    const events = [mkEvent(0), mkEvent(70)];
    const flgEvents = [{ date: mkEvent(40).date, level: FLG_LEVEL_STRONG }];
    const clusters = clusterApneaEventsBridged({
      events,
      flgEvents,
      gapSec: BRIDGED_GAP_SECONDS / 2,
      bridgeSec: BRIDGED_GAP_SECONDS * BRIDGE_DURATION_MULTIPLIER,
      bridgeThreshold: CUSTOM_BRIDGE_THRESHOLD,
    });
    expect(clusters).toHaveLength(1);
    expect(clusters[0].count).toBe(2);
  });

  it('k-means variant obeys cluster count', () => {
    const events = Array.from({ length: 5 }).map((_, idx) =>
      mkEvent(idx * DEFAULT_APNEA_CLUSTER_GAP_SEC),
    );
    const clusters = clusterApneaEventsKMeans({ events, k: 3 });
    expect(clusters).toHaveLength(3);
    expect(clusters.reduce((acc, cl) => acc + cl.count, 0)).toBe(5);
  });

  it('agglomerative variant splits when gaps exceed threshold', () => {
    const events = [mkEvent(0), mkEvent(50), mkEvent(500)];
    const clusters = clusterApneaEventsAgglomerative({
      events,
      linkageThresholdSec: CLUSTERING_DEFAULTS.FLG_CLUSTER_GAP_SEC,
    });
    expect(clusters).toHaveLength(2);
    expect(clusters.map((cl) => cl.count)).toEqual([2, 1]);
  });
});

describe('k-means metadata and convergence', () => {
  it('attaches metadata and converges quickly on bimodal data', () => {
    const base = new Date('2021-01-01T00:00:00Z');
    const clusterA = Array.from({ length: 5 }).map((_, i) => ({
      date: new Date(base.getTime() + i * 30_000),
      durationSec: 10,
    }));
    const clusterB = Array.from({ length: 5 }).map((_, i) => ({
      date: new Date(base.getTime() + 3_600_000 + i * 30_000),
      durationSec: 10,
    }));
    const clusters = clusterApneaEventsKMeans({
      events: [...clusterA, ...clusterB],
      k: 2,
    });
    expect(Array.isArray(clusters)).toBe(true);
    expect(clusters.meta).toBeDefined();
    expect(clusters.meta.converged).toBe(true);
    expect(clusters.meta.iterations).toBeLessThanOrEqual(
      CLUSTERING_DEFAULTS.KMEANS_MAX_ITERATIONS,
    );
    expect(clusters.meta.wcss).toBeGreaterThan(0);
  });

  it('flags overspecified k when k > n/3', () => {
    const base = new Date('2021-01-01T00:00:00Z');
    const events = Array.from({ length: 9 }).map((_, i) => ({
      date: new Date(base.getTime() + i * 60_000),
      durationSec: 10,
    }));
    const clusters = clusterApneaEventsKMeans({ events, k: 4 });
    expect(clusters.meta.kOverspecified).toBe(true);
  });

  it('sets maxIterationsReached when capped and warns', () => {
    const base = new Date('2021-01-01T00:00:00Z');
    const events = Array.from({ length: 10 }).map((_, i) => ({
      date: new Date(base.getTime() + i * 30_000),
      durationSec: 10,
    }));
    const clusters = clusterApneaEventsKMeans({
      events,
      k: 3,
      maxIterations: 1,
    });
    expect(clusters.meta.maxIterationsReached).toBe(true);
    expect(clusters.meta.iterations).toBe(1);
  });
});

describe('detectFalseNegatives', () => {
  it('filters FLG clusters by duration, absence of apnea, and peakFLGLevel', () => {
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
    expect(fns[0].durationSec).toBeGreaterThanOrEqual(
      CLUSTERING_DEFAULTS.MIN_CLUSTER_DURATION_SEC,
    );
    expect(fns[0].peakFLGLevel).toBe(1);
  });

  it('respects false-negative detection options (threshold and peakFLGLevel)', () => {
    const details = [
      { Event: 'FLG', 'Data/Duration': 0.8, DateTime: '2021-01-01T00:00:00Z' },
      { Event: 'FLG', 'Data/Duration': 0.8, DateTime: '2021-01-01T00:00:40Z' },
    ];
    const strict = detectFalseNegatives(details, {
      flThreshold: STRICT_FL_THRESHOLD,
      peakFLGLevelMin: CLUSTERING_DEFAULTS.FALSE_NEG_PEAK_FLG_LEVEL_MIN,
      gapSec: BRIDGED_GAP_SECONDS,
      minDurationSec: MIN_DURATION_THRESHOLD,
    });
    const lenient = detectFalseNegatives(details, {
      flThreshold: LENIENT_FL_THRESHOLD,
      peakFLGLevelMin: LENIENT_PEAK_FLG_LEVEL,
      gapSec: BRIDGED_GAP_SECONDS,
      minDurationSec: MIN_DURATION_THRESHOLD,
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
      SECONDS_PER_MINUTE,
    ); // extension -> higher
    expect(s2).toBeGreaterThan(s1);
    expect(s3).toBeGreaterThan(s1);
    expect(s4).toBeGreaterThan(s1);
  });
});

describe('weighted density metrics', () => {
  it('calculates weightedDensity as total apnea duration / window duration', () => {
    const base = new Date('2021-01-01T00:00:00Z');
    // 3 events, each 10 seconds, within a 90 second window (last event ends at 90s)
    const events = [
      { date: base, durationSec: 10 },
      { date: new Date(base.getTime() + 40000), durationSec: 10 },
      { date: new Date(base.getTime() + 80000), durationSec: 10 },
    ];
    const clusters = clusterApneaEvents({ events, flgEvents: [] });
    expect(clusters).toHaveLength(1);
    const cl = clusters[0];
    // window = 90s (last event starts at 80s, duration 10s), total apnea duration = 30s
    // weightedDensity = 30 / (90/60) = 30 / 1.5 = 20
    expect(cl.totalApneaDurationSec).toBe(30);
    expect(cl.weightedDensity).toBeCloseTo(20, 1);
  });

  it('distinguishes density from weightedDensity', () => {
    const base = new Date('2021-01-01T00:00:00Z');
    // 6 events over approximately 50 seconds: high density but varying duration
    const events = [
      { date: new Date(base.getTime() + 0), durationSec: 5 },
      { date: new Date(base.getTime() + 10000), durationSec: 5 },
      { date: new Date(base.getTime() + 20000), durationSec: 8 },
      { date: new Date(base.getTime() + 30000), durationSec: 8 },
      { date: new Date(base.getTime() + 40000), durationSec: 3 },
      { date: new Date(base.getTime() + 50000), durationSec: 3 },
    ];
    const clusters = clusterApneaEvents({ events, flgEvents: [] });
    expect(clusters).toHaveLength(1);
    const cl = clusters[0];
    // Last event starts at 50s, duration 3s -> window ends at 53s, window duration ≈ 53s
    // count=6 over ~53s window -> density = 6 / (53/60) ≈ 6.79 events/min
    expect(cl.density).toBeCloseTo(6.79, 1);
    // total duration=32s over ~53s window -> weightedDensity = 32/(53/60) ≈ 36.23
    expect(cl.weightedDensity).toBeCloseTo(36.23, 1);
  });

  it('maintains backward compatibility with existing cluster data', () => {
    const base = new Date('2021-01-01T00:00:00Z');
    const events = [
      { date: base, durationSec: 10 },
      { date: new Date(base.getTime() + 30000), durationSec: 10 },
    ];
    const clusters = clusterApneaEvents({ events, flgEvents: [] });
    expect(clusters).toHaveLength(1);
    const cl = clusters[0];
    // Original fields still present and accessible
    expect(cl.start).toBeDefined();
    expect(cl.end).toBeDefined();
    expect(cl.durationSec).toBeDefined();
    expect(cl.count).toBeDefined();
    expect(cl.density).toBeDefined();
    expect(cl.events).toBeDefined();
    // New fields also available
    expect(cl.weightedDensity).toBeDefined();
    expect(cl.totalApneaDurationSec).toBeDefined();
  });
});

describe('clustersToCsv', () => {
  it('produces CSV header and rows', () => {
    const base = new Date('2021-01-01T00:00:00Z');
    const severity = 1.2345;
    const severityLowerBound = 1.23;
    const severityUpperBound = 1.24;
    const cl = {
      start: base,
      end: new Date(base.getTime() + SECONDS_PER_MINUTE * 1000),
      durationSec: CLUSTERING_DEFAULTS.MIN_CLUSTER_DURATION_SEC,
      count: APNEA_CLUSTER_MIN_EVENTS,
      severity,
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
    expect(lines[1]).toContain(
      `,${CLUSTERING_DEFAULTS.MIN_CLUSTER_DURATION_SEC},${APNEA_CLUSTER_MIN_EVENTS},`,
    );
    const cols = lines[1].split(',');
    const sev = Number(cols[5]);
    expect(sev).toBeGreaterThan(severityLowerBound);
    expect(sev).toBeLessThan(severityUpperBound);
  });
});
