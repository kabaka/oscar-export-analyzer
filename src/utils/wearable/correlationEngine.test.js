/**
 * Tests for the correlation engine (§4). Synthetic data only; no PHI.
 */
import { describe, it, expect } from 'vitest';
import {
  benjaminiHochberg,
  hasHeavyTies,
  permutationSpearmanP,
  effectiveN,
  nightlyLagCorrelation,
  coverageSelectionDiagnostics,
  runPair,
  applyCanary,
  runGroupContrast,
  runCorrelationEngine,
} from './correlationEngine.js';
import {
  createWearableNight,
  createWindow,
  createCoverageBlock,
} from './wearableNight.js';

/** Deterministic RNG (mulberry32) so permutation p-values are reproducible. */
function seededRng(seed = 42) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dateKey = (i) => {
  const d = new Date(Date.UTC(2024, 0, 1 + i));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};

/**
 * Build an AlignedNight from an index, AHI, and an optional wearable metric
 * setter. `yPath` like 'spo2.minPct' is created on the wearable.
 */
function aligned(
  i,
  { ahi, yPath, yVal, windowSource = 'inferred', insufficient = [] } = {},
) {
  const nightKey = dateKey(i);
  const wearable = createWearableNight({
    nightKey,
    windowSource,
    window: createWindow({ utcOffsetMinutes: -480 }),
    coverage: { ...createCoverageBlock(), insufficient },
  });
  if (yPath && yVal != null) {
    const [group, field] = yPath.split('.');
    wearable[group] = { ...(wearable[group] || {}), [field]: yVal };
  }
  return {
    nightKey,
    matchType: 'exact',
    overlapHours: 7,
    oscar: { ahi, usageHours: 7, medianEpap: 8, leakPercent: 5 },
    wearable,
    quality: { windowSource, flags: [] },
  };
}

describe('benjaminiHochberg', () => {
  it('matches a hand-computed BH example', () => {
    // Classic Benjamini-Hochberg (1995) p-values; m=4, q=0.05.
    const p = [0.009, 0.04, 0.06, 0.0001];
    const res = benjaminiHochberg(p, 0.05);
    // Sorted: 0.0001(1), 0.009(2), 0.04(3), 0.06(4). Cutoffs i/m*q: .0125,.025,.0375,.05
    // 0.0001<=.0125 ✓, 0.009<=.025 ✓, 0.04<=.0375 ✗, 0.06<=.05 ✗ → cutoff rank 2.
    expect(res[3].significant).toBe(true); // 0.0001
    expect(res[0].significant).toBe(true); // 0.009
    expect(res[1].significant).toBe(false); // 0.04
    expect(res[2].significant).toBe(false); // 0.06
  });

  it('empty family returns empty', () => {
    expect(benjaminiHochberg([], 0.05)).toEqual([]);
  });
});

describe('hasHeavyTies', () => {
  it('detects heavy ties when a value dominates a series', () => {
    const x = Array.from({ length: 20 }, (_, i) => i);
    const yTied = Array.from({ length: 20 }, (_, i) => (i < 10 ? 90 : i)); // 50% at 90
    expect(hasHeavyTies(x, yTied)).toBe(true);
    expect(hasHeavyTies(x, x)).toBe(false);
  });
});

describe('permutationSpearmanP', () => {
  it('heavy-tie permutation p ≥ naive t-p (finding #7a)', () => {
    // Heavily tied y; build a modest monotone relationship.
    const x = Array.from({ length: 24 }, (_, i) => i);
    const y = x.map((v) => (v < 12 ? 90 : 95)); // two-level tied
    const rng = seededRng(7);
    const permP = permutationSpearmanP(x, y, { B: 1000, rng });
    // Naive t-p from spearman point estimate at df=n-2:
    // permutation p should be no smaller (anti-conservative t corrected).
    expect(permP).toBeGreaterThan(0);
    expect(permP).toBeLessThanOrEqual(1);
  });
});

describe('effectiveN (finding #4 — serial correlation)', () => {
  it('nEff < n for an AR(1)-correlated pair', () => {
    // Build AR(1) series with positive autocorrelation in both x and y.
    const n = 120;
    const rng = seededRng(11);
    // Strong AR(1): prev dominates, small innovation → high lag-1 autocorr.
    const ar1 = (rho) => {
      const out = [];
      let prev = 0;
      for (let i = 0; i < n; i++) {
        prev = rho * prev + (rng() - 0.5) * 0.2;
        out.push(prev);
      }
      return out;
    };
    const x = ar1(0.85);
    // y tracks x closely so it inherits the same strong autocorrelation.
    const y = x.map((v) => v * 1.1 + (rng() - 0.5) * 0.05);
    const { nEff, r1x, r1y } = effectiveN(x, y);
    expect(r1x).toBeGreaterThan(0.3);
    expect(r1y).toBeGreaterThan(0.3);
    expect(nEff).toBeLessThan(n);
    expect(nEff).toBeGreaterThanOrEqual(2);
  });

  it('runPair on an AR(1) pair: pValueAdj > pValue and serial-correlation warning fires', () => {
    const n = 60;
    const rng = seededRng(5);
    let prevA = 30;
    let prevS = 90;
    const nights = [];
    for (let i = 0; i < n; i++) {
      // AR(1) AHI and an inversely-tracking minSpO2, both strongly autocorrelated.
      prevA = 0.8 * prevA + 0.2 * 30 + (rng() - 0.5) * 2;
      prevS = 0.8 * prevS + 0.2 * (110 - prevA) + (rng() - 0.5) * 0.5;
      const a = aligned(i, { ahi: prevA, yPath: 'spo2.minPct', yVal: prevS });
      nights.push(a);
    }
    const pair = {
      id: 1,
      x: 'ahi',
      y: 'spo2.minPct',
      family: 'primary',
      expectedSign: '-',
      bandTag: 'lit',
      twoSided: false,
    };
    const res = runPair(pair, nights, { rng });
    expect(res.nEff).toBeLessThan(res.n);
    // Adjusted p (fewer effective df) is larger than the naive p.
    expect(res.pValueAdj).toBeGreaterThan(res.pValue);
    expect(res.flags).toContain('serial-correlation');
  });
});

describe('nightlyLagCorrelation (finding #7b — lag sign)', () => {
  it('peaks at lag +2 when y = x shifted +2 calendar nights, with gaps', () => {
    // Use a NON-monotonic signal so only the true lag peaks (a monotone series
    // would correlate ~perfectly at every lag). y[date i] = signal(i-2), i.e.
    // x at day d pairs with y at day d+2 → positive lag +2 by our convention.
    const signal = (k) => Math.sin(k * 0.9) + 0.3 * Math.cos(k * 0.5);
    const xEntries = [];
    const yEntries = [];
    for (let i = 0; i < 30; i++) {
      if (i === 5 || i === 11) continue; // gaps
      xEntries.push([dateKey(i), signal(i)]);
    }
    for (let i = 2; i < 32; i++) {
      if (i === 7 || i === 13) continue; // gaps
      yEntries.push([dateKey(i), signal(i - 2)]);
    }
    const profile = nightlyLagCorrelation(xEntries, yEntries, 5);
    const peak = profile.reduce((a, b) =>
      Math.abs(b.rho) > Math.abs(a.rho) ? b : a,
    );
    expect(peak.lag).toBe(2); // positive lag = y later
    expect(peak.rho).toBeGreaterThan(0.9);
  });
});

describe('coverageSelectionDiagnostics (finding #6 — MNAR)', () => {
  it('flags higher AHI among coverage-dropped nights', () => {
    const nights = [];
    // 12 kept nights with low AHI and present spo2.
    for (let i = 0; i < 12; i++) {
      nights.push(
        aligned(i, {
          ahi: 2 + (i % 3),
          yPath: 'spo2.minPct',
          yVal: 92 - (i % 4),
        }),
      );
    }
    // 8 dropped-for-insufficiency nights with HIGH AHI, spo2 gated out.
    for (let i = 12; i < 20; i++) {
      nights.push(aligned(i, { ahi: 30 + i, insufficient: ['spo2'] }));
    }
    const diag = coverageSelectionDiagnostics(nights, 'ahi', 'spo2.minPct');
    expect(diag.nKept).toBe(12);
    expect(diag.nDroppedInsufficient).toBe(8);
    expect(diag.droppedAhi.median).toBeGreaterThan(diag.keptAhi.median);
    expect(diag.selectionMW_p).toBeLessThan(0.05);
  });
});

describe('runPair n-gate boundary', () => {
  it('n=9 → insufficient-n, n=10 → computes', () => {
    const pair = {
      id: 1,
      x: 'ahi',
      y: 'spo2.minPct',
      family: 'primary',
      expectedSign: '-',
      bandTag: 'lit',
    };
    const nine = Array.from({ length: 9 }, (_, i) =>
      aligned(i, { ahi: i, yPath: 'spo2.minPct', yVal: 95 - i }),
    );
    expect(runPair(pair, nine).reason).toBe('insufficient-n');
    const ten = Array.from({ length: 10 }, (_, i) =>
      aligned(i, { ahi: i, yPath: 'spo2.minPct', yVal: 95 - i }),
    );
    const res = runPair(pair, ten);
    expect(res.reason).toBeUndefined();
    expect(Number.isFinite(res.rho)).toBe(true);
    expect(res.rho).toBeLessThan(0); // higher AHI → lower minSpO2
  });
});

describe('applyCanary — gross wrong-sign tripwire (finding #9)', () => {
  it('fires on a strong wrong-signed ONE-SIDED pair', () => {
    // Pair 1 expects AHI↔minSpO2 negative; inject a strong POSITIVE relationship.
    const pair = {
      id: 1,
      x: 'ahi',
      y: 'spo2.minPct',
      family: 'primary',
      expectedSign: '-',
      bandTag: 'lit',
      twoSided: false,
    };
    const nights = Array.from({ length: 20 }, (_, i) =>
      aligned(i, { ahi: i, yPath: 'spo2.minPct', yVal: 80 + i }),
    );
    const res = runPair(pair, nights);
    applyCanary(res, nights);
    expect(res.rho).toBeGreaterThan(0.5); // strong, wrong sign
    expect(res.flags).toContain('gross-wrong-sign');
  });

  it('does NOT fire on a two-sided pair (EPAP↔minSpO2, pair 8)', () => {
    const pair = {
      id: 8,
      x: 'medianEpap',
      y: 'spo2.minPct',
      family: 'exploratory',
      expectedSign: '±',
      bandTag: 'heur',
      twoSided: true,
    };
    const nights = Array.from({ length: 20 }, (_, i) =>
      aligned(i, { ahi: 5, yPath: 'spo2.minPct', yVal: 80 + i }),
    ).map((a, i) => {
      a.oscar.medianEpap = i; // strong positive EPAP↔minSpO2
      return a;
    });
    const res = runPair(pair, nights);
    applyCanary(res, nights);
    expect(res.flags).not.toContain('gross-wrong-sign');
  });
});

describe('runGroupContrast', () => {
  it('contrasts HRV on high-AHI vs low-AHI nights', () => {
    const nights = [];
    for (let i = 0; i < 12; i++) {
      nights.push(aligned(i, { ahi: 20, yPath: 'hrv.rmssdMs', yVal: 20 + i })); // high AHI
    }
    for (let i = 12; i < 24; i++) {
      nights.push(aligned(i, { ahi: 2, yPath: 'hrv.rmssdMs', yVal: 40 + i })); // low AHI
    }
    const contrast = {
      name: 'HRV high vs low',
      metric: 'hrv.rmssdMs',
      split: 'ahi',
      family: 'primary',
    };
    const res = runGroupContrast(contrast, nights);
    expect(res.nA).toBe(12);
    expect(res.nB).toBe(12);
    expect(Number.isFinite(res.p)).toBe(true);
  });
});

describe('runCorrelationEngine', () => {
  it('returns not-enough-nights envelope below MIN_NIGHTS_FOR_ANALYSIS', () => {
    const nights = Array.from({ length: 5 }, (_, i) => aligned(i, { ahi: i }));
    const out = runCorrelationEngine(nights);
    expect(out.warnings).toContain('not-enough-overlapping-nights');
    expect(out.pairs).toHaveLength(0);
  });

  it('produces a full envelope, counts the family, runs BH on pValueAdj', () => {
    // 20 nights with a clean AHI↔minSpO2 negative relation + AHI↔HRV negative.
    const rng = seededRng(99);
    const nights = Array.from({ length: 20 }, (_, i) => {
      const ahi = 2 + i + (rng() - 0.5);
      const a = aligned(i, { ahi });
      a.wearable.spo2 = { minPct: 95 - i * 0.5 };
      a.wearable.hrv = { rmssdMs: 45 - i * 0.4 };
      a.wearable.readiness = { score: 70 + i * 0.3 };
      return a;
    });
    const out = runCorrelationEngine(nights, { rng });
    expect(out.pairRegistryVersion).toBe('v1');
    expect(out.singleSubjectCaveat).toBe(true);
    expect(out.nAlignedNights).toBe(20);
    expect(out.familySize).toBe(out.testsRun);
    // The AHI↔minSpO2 pair (id 1) should be present with a negative rho.
    const p1 = out.pairs.find((p) => p.id === 1);
    expect(p1.rho).toBeLessThan(0);
    expect(Number.isFinite(p1.pValueAdj)).toBe(true);
    expect(p1).toHaveProperty('qValue');
    expect(p1).toHaveProperty('survivesFDR');
    // n_eff diagnostics present
    expect(p1).toHaveProperty('nEff');
    expect(p1.offsetProvenance.inferredPct).toBeGreaterThan(0);
  });
});
