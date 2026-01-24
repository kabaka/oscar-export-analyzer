/* eslint-disable no-magic-numbers -- test-specific numerical data and statistical test scenarios */
import { describe, it, expect } from 'vitest';
import {
  computeAHITrends,
  computeApneaEventStats,
  computeAutocorrelation,
  computeEPAPTrends,
  computePartialAutocorrelation,
  computeUsageRolling,
  detectChangePoints,
  kmSurvival,
  loessSmooth,
  mannWhitneyUTest,
  normalCdf,
  normalQuantile,
  parseDuration,
  partialCorrelation,
  pearson,
  quantile,
  runningQuantileXY,
  stlDecompose,
  summarizeUsage,
} from './stats';
import {
  AHI_SEVERITY_LIMITS,
  APNEA_DURATION_HIGH_SEC,
  APNEA_DURATION_THRESHOLD_SEC,
  EPAP_SPLIT_THRESHOLD,
  PERCENTILE_95TH,
  QUARTILE_LOWER,
  QUARTILE_MEDIAN,
  QUARTILE_UPPER,
  SECONDS_PER_HOUR,
  SECONDS_PER_MINUTE,
  USAGE_COMPLIANCE_THRESHOLD_HOURS,
  USAGE_STRICT_THRESHOLD_HOURS,
} from '../constants';
import { buildApneaDetail, buildSummaryRow } from '../test-utils/builders';
import {
  DEFAULT_CHANGE_POINT_WINDOW,
  DEFAULT_KAPLAN_MEIER_DATA,
  LINEAR_SERIES,
  LOESS_BANDWIDTH,
  LOESS_SAMPLE_POINTS,
  RUNNING_QUANTILE_HIGH,
  RUNNING_QUANTILE_MEDIAN,
  RUNNING_QUANTILE_SAMPLE_POINTS,
  RUNNING_QUANTILE_SERIES_LENGTH,
  RUNNING_QUANTILE_WINDOW,
  SMALL_SAMPLE_SIZE,
  STL_RESIDUAL_MEAN_ABS_LIMIT,
  STL_SEASONAL_PATTERN_DIFF_LIMIT,
  STL_TREND_MEAN_ABS_ERROR_LIMIT,
  STRICT_LINEAR_TOLERANCE,
  STL_SEASON_LENGTH,
} from '../test-utils/testConstants';

const AUTOCORRELATION_SERIES = [1, 2, 3, 4, 5];
const AUTOCORRELATION_EXPECTED = [1, 0.4, -0.1, -0.4, -0.4];
const PARTIAL_AUTOCORRELATION_SERIES = [
  0.8, 0.46, 0.11, 0.23, -0.05, 0.02, 0.1, 0.04,
];
const GREENWOOD_LOWER_BOUNDS = [0.0578428, 0.00894687, Number.NaN];
const GREENWOOD_UPPER_BOUNDS = [0.844865, 0.665331, Number.NaN];
const LOESS_SLOPE = 2;
const LOESS_INTERCEPT = 1;
const PARTIAL_CORRELATION_NOISE_SCALE = 0.1;
const PARTIAL_CORRELATION_SIN_FREQ = 10;
const PARTIAL_CORRELATION_COS_FREQ = 8;
const CHANGE_POINT_FIRST_SEGMENT = 30;
const STL_WEEK_MULTIPLIER = 6;
const GREENWOOD_PRECISION = 5;
const AUTOCORRELATION_MAX_LAG = 6;
const PARTIAL_CORRELATION_SLOPE = 0.8;
const STL_TREND_SLOPE = 0.2;
const STEP_FIRST_MEAN_RANGE = { min: 0.5, max: 1.5 };
const STEP_SECOND_MEAN_RANGE = { min: 4, max: 6 };

describe('parseDuration', () => {
  it('parses HH:MM:SS format', () => {
    expect(parseDuration('1:02:03')).toBe(
      SECONDS_PER_HOUR + 2 * SECONDS_PER_MINUTE + 3,
    );
  });

  it('handles MM:SS format', () => {
    expect(parseDuration('2:03')).toBe(2 * SECONDS_PER_MINUTE + 3);
  });

  it('returns NaN for malformed strings', () => {
    expect(parseDuration('abc')).toBeNaN();
    expect(parseDuration('1:2:3:4')).toBeNaN();
  });

  it('throws on malformed input when requested', () => {
    expect(() => parseDuration('bad', { throwOnError: true })).toThrow(
      /invalid duration/i,
    );
  });
});

describe('kmSurvival (Kaplan–Meier) uncensored', () => {
  it('computes stepwise survival for simple data', () => {
    const { times, survival, lower, upper } = kmSurvival(
      DEFAULT_KAPLAN_MEIER_DATA,
    );
    expect(times).toEqual([1, 2, 3]);
    expect(survival[0]).toBeCloseTo(0.5);
    expect(survival[1]).toBeCloseTo(0.25);
    expect(survival[2]).toBeCloseTo(0);
    // monotone non-increasing
    for (let i = 1; i < survival.length; i++)
      expect(survival[i]).toBeLessThanOrEqual(survival[i - 1]);
    expect(lower.length).toBe(times.length);
    expect(upper.length).toBe(times.length);
  });

  it('produces log-log Greenwood CIs matching reference values', () => {
    const { lower, upper } = kmSurvival(DEFAULT_KAPLAN_MEIER_DATA);
    GREENWOOD_LOWER_BOUNDS.forEach((bound, index) => {
      if (Number.isNaN(bound)) {
        expect(lower[index]).toBeNaN();
      } else {
        expect(lower[index]).toBeCloseTo(bound, GREENWOOD_PRECISION);
      }
    });
    GREENWOOD_UPPER_BOUNDS.forEach((bound, index) => {
      if (Number.isNaN(bound)) {
        expect(upper[index]).toBeNaN();
      } else {
        expect(upper[index]).toBeCloseTo(bound, GREENWOOD_PRECISION);
      }
    });
  });
});

describe('computeAutocorrelation', () => {
  it('matches hand-computed autocorrelation for a simple trend', () => {
    const { values, sampleSize } = computeAutocorrelation(
      AUTOCORRELATION_SERIES,
      AUTOCORRELATION_MAX_LAG,
    );
    expect(sampleSize).toBe(AUTOCORRELATION_SERIES.length);
    expect(values.map((v) => v.lag)).toEqual([0, 1, 2, 3, 4]);
    AUTOCORRELATION_EXPECTED.forEach((target, idx) => {
      expect(values[idx].autocorrelation).toBeCloseTo(target, 6);
      expect(values[idx].pairs).toBe(
        AUTOCORRELATION_SERIES.length - values[idx].lag,
      );
    });
  });

  it('ignores NaNs while counting valid pairs', () => {
    const series = [1, 2, NaN, 3, 4];
    const { values } = computeAutocorrelation(series, 3);
    const lag1 = values.find((v) => v.lag === 1);
    expect(lag1.pairs).toBe(2);
    expect(lag1.autocorrelation).toBeGreaterThan(0);
  });
});

describe('computePartialAutocorrelation', () => {
  it('agrees with partial correlations computed directly', () => {
    const { values, sampleSize } = computePartialAutocorrelation(
      PARTIAL_AUTOCORRELATION_SERIES,
      3,
    );
    expect(sampleSize).toBe(PARTIAL_AUTOCORRELATION_SERIES.length);
    values.forEach(({ lag, partialAutocorrelation }) => {
      const y = PARTIAL_AUTOCORRELATION_SERIES.slice(lag);
      const x = PARTIAL_AUTOCORRELATION_SERIES.slice(
        0,
        PARTIAL_AUTOCORRELATION_SERIES.length - lag,
      );
      const controls = y.map((_, idx) => {
        const ctrl = [];
        for (let j = 1; j < lag; j++) {
          ctrl.push(PARTIAL_AUTOCORRELATION_SERIES[idx + j]);
        }
        return ctrl;
      });
      const reference =
        lag === 1 ? pearson(y, x) : partialCorrelation(y, x, controls);
      expect(partialAutocorrelation).toBeCloseTo(reference, 6);
    });
  });

  it('attaches PACF stability metadata and recommended max lag', () => {
    const n = 90;
    const series = Array.from({ length: n }, (_, i) => Math.sin(i / 10));
    const out = computePartialAutocorrelation(series, 60);
    expect(out.meta).toBeDefined();
    expect(out.meta.recommendedMaxLag).toBe(
      Math.min(Math.floor(out.sampleSize / 3), 40),
    );
    expect(Array.isArray(out.meta.unstableLags)).toBe(true);
    expect(Array.isArray(out.meta.warnings)).toBe(true);
  });

  it('warns when requested maxLag exceeds recommended stability threshold', () => {
    const series = Array(90).fill(1);
    const result = computePartialAutocorrelation(series, 60);
    expect(result.meta.recommendedMaxLag).toBeLessThanOrEqual(40);
    expect(result.meta.warnings.length).toBeGreaterThanOrEqual(1);
  });

  it('exposes meta and unstableLags array even for low-lag requests', () => {
    const series = Array.from({ length: 12 }, (_, idx) => Math.cos(idx / 3));
    const result = computePartialAutocorrelation(series, 4);
    expect(result.meta).toBeDefined();
    expect(Array.isArray(result.meta.unstableLags)).toBe(true);
    expect(result.meta.unstableLags.length).toBeGreaterThanOrEqual(0);
  });

  it('flags high-lag instability and sets PACF to NaN', () => {
    const n = 120;
    const series = Array(n).fill(5); // constant series -> ill-conditioned
    const out = computePartialAutocorrelation(series, 80);
    expect(out.meta.warnings.length).toBeGreaterThan(0);
    // Unstable lags should include some > 40
    const hasHighLag = out.meta.unstableLags.some((k) => k > 40);
    expect(hasHighLag).toBe(true);
    // Values for unstable lags should be NaN
    out.meta.unstableLags.forEach((lag) => {
      const entry = out.values.find((v) => v.lag === lag);
      if (entry) {
        expect(entry.partialAutocorrelation).toBeNaN();
      }
    });
  });

  it('provides meta with recommendedMaxLag and warnings for high lags', () => {
    // synthetic constant series to trigger instability at high lags
    const series = Array(90).fill(1);
    const result = computePartialAutocorrelation(series, 60);
    expect(result.meta).toBeDefined();
    expect(result.meta.recommendedMaxLag).toBeLessThanOrEqual(40);
    expect(Array.isArray(result.meta.unstableLags)).toBe(true);
    expect(Array.isArray(result.meta.warnings)).toBe(true);
    // When exceeding recommended max lag, warnings should be present
    expect(result.meta.warnings.length).toBeGreaterThanOrEqual(1);
  });
});

describe('partialCorrelation (controls reduce confounding)', () => {
  it('shrinks correlation when controlling for confounder', () => {
    const n = SMALL_SAMPLE_SIZE;
    const z = Array.from({ length: n }, (_, index) => index / n);
    const x = z.map(
      (value) =>
        value +
        PARTIAL_CORRELATION_NOISE_SCALE *
          Math.sin(PARTIAL_CORRELATION_SIN_FREQ * value),
    );
    const y = z.map(
      (value) =>
        PARTIAL_CORRELATION_SLOPE * value +
        PARTIAL_CORRELATION_NOISE_SCALE *
          Math.cos(PARTIAL_CORRELATION_COS_FREQ * value),
    );
    const r = (a, b) => pearson(a, b);
    const naive = r(x, y);
    // controls matrix: one column z
    const controls = z.map((v) => [v]);
    const pc = partialCorrelation(x, y, controls);
    expect(Math.abs(pc)).toBeLessThan(Math.abs(naive));
  });
});

describe('pearson', () => {
  it('ignores NaN pairs without skewing results', () => {
    const x = [1, 2, 3, NaN];
    const y = [1, 2, 3, 4];
    const fx = [1, 2, 3];
    const fy = [1, 2, 3];
    expect(pearson(x, y)).toBeCloseTo(pearson(fx, fy));
  });

  it('ignores NaNs in either array', () => {
    const x = [1, 2, 3, 4];
    const y = [1, 2, NaN, 4];
    const fx = [1, 2, 4];
    const fy = [1, 2, 4];
    expect(pearson(x, y)).toBeCloseTo(pearson(fx, fy));
  });
});

describe('loessSmooth and runningQuantileXY', () => {
  it('loess reproduces linear relationship approximately', () => {
    const y = LINEAR_SERIES.map(
      (value) => LOESS_SLOPE * value + LOESS_INTERCEPT,
    );
    const sm = loessSmooth(
      LINEAR_SERIES,
      y,
      LOESS_SAMPLE_POINTS,
      LOESS_BANDWIDTH,
    );
    expect(sm).toHaveLength(LOESS_SAMPLE_POINTS.length);
    // Expect close to true line
    sm.forEach((yv, i) => {
      const xv = LOESS_SAMPLE_POINTS[i];
      expect(Math.abs(yv - (LOESS_SLOPE * xv + LOESS_INTERCEPT))).toBeLessThan(
        STRICT_LINEAR_TOLERANCE,
      );
    });
  });

  it('runningQuantileXY returns plausible quantiles', () => {
    const x = Array.from(
      { length: RUNNING_QUANTILE_SERIES_LENGTH },
      (_, i) => i,
    );
    const y = x.map((v) => v); // identity
    const q50 = runningQuantileXY(
      x,
      y,
      RUNNING_QUANTILE_SAMPLE_POINTS,
      RUNNING_QUANTILE_MEDIAN,
      RUNNING_QUANTILE_WINDOW,
    );
    expect(q50).toHaveLength(RUNNING_QUANTILE_SAMPLE_POINTS.length);
    // p50 should be non-decreasing and within overall range
    for (let i = 1; i < q50.length; i++) {
      expect(q50[i]).toBeGreaterThanOrEqual(q50[i - 1]);
    }
    q50.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(RUNNING_QUANTILE_SERIES_LENGTH - 1);
    });
    const q90 = runningQuantileXY(
      x,
      y,
      RUNNING_QUANTILE_SAMPLE_POINTS,
      RUNNING_QUANTILE_HIGH,
      RUNNING_QUANTILE_WINDOW,
    );
    q90.forEach((v, i) => {
      expect(v).toBeGreaterThanOrEqual(q50[i]);
    });
  });
});

describe('detectChangePoints', () => {
  it('detects a single change around a step', () => {
    const n1 = CHANGE_POINT_FIRST_SEGMENT;
    const n2 = CHANGE_POINT_FIRST_SEGMENT;
    const series = Array(n1).fill(1).concat(Array(n2).fill(5));
    const dates = series.map((_, i) => new Date(2021, 0, i + 1));
    const cps = detectChangePoints(series, dates, DEFAULT_CHANGE_POINT_WINDOW);
    // expect one change near index 30
    expect(cps.length).toBeGreaterThanOrEqual(1);
    const idx = cps.findIndex((d) => d instanceof Date);
    expect(idx).toBeGreaterThanOrEqual(0);
  });
});

describe('stlDecompose', () => {
  it('recovers weekly trend and seasonal structure from a synthetic sine wave', () => {
    const season = STL_SEASON_LENGTH;
    const n = season * STL_WEEK_MULTIPLIER;
    const trendTrue = Array.from(
      { length: n },
      (_, index) => STL_TREND_SLOPE * index,
    );
    const seasonalTrue = Array.from({ length: n }, (_, index) =>
      Math.sin((2 * Math.PI * (index % season)) / season),
    );
    const series = trendTrue.map((t, i) => t + seasonalTrue[i]);
    const { trend, seasonal, residual } = stlDecompose(series, {
      seasonLength: season,
    });

    const midStart = season;
    const midEnd = n - season;
    const midError =
      trend.slice(midStart, midEnd).reduce((sum, v, idx) => {
        const trueVal = trendTrue[midStart + idx];
        return sum + Math.abs(v - trueVal);
      }, 0) / Math.max(1, midEnd - midStart);
    expect(midError).toBeLessThan(STL_TREND_MEAN_ABS_ERROR_LIMIT);

    const seasonalPattern = Array.from({ length: season }, (_, pos) => {
      const vals = seasonal.filter((_, idx) => idx % season === pos);
      const denom = vals.length || 1;
      return vals.reduce((sum, v) => sum + v, 0) / denom;
    });
    const targetPattern = Array.from({ length: season }, (_, pos) =>
      Math.sin((2 * Math.PI * pos) / season),
    );
    const avgDiff =
      seasonalPattern.reduce(
        (sum, value, index) => sum + Math.abs(value - targetPattern[index]),
        0,
      ) / seasonalPattern.length;
    expect(avgDiff).toBeLessThan(STL_SEASONAL_PATTERN_DIFF_LIMIT);
    const avgResidual =
      residual.reduce((sum, value) => sum + Math.abs(value), 0) /
      residual.length;
    expect(avgResidual).toBeLessThan(STL_RESIDUAL_MEAN_ABS_LIMIT);
  });

  it('tracks a structural break in a step series', () => {
    const season = STL_SEASON_LENGTH;
    const first = Array(14).fill(1);
    const second = Array(14).fill(5);
    const series = first.concat(second);
    const { trend, seasonal, residual } = stlDecompose(series, {
      seasonLength: season,
    });
    const firstMean =
      trend.slice(0, first.length).reduce((sum, v) => sum + v, 0) /
      first.length;
    const secondMean =
      trend.slice(first.length).reduce((sum, v) => sum + v, 0) / second.length;
    expect(firstMean).toBeGreaterThan(STEP_FIRST_MEAN_RANGE.min);
    expect(firstMean).toBeLessThan(STEP_FIRST_MEAN_RANGE.max);
    expect(secondMean).toBeGreaterThan(STEP_SECOND_MEAN_RANGE.min);
    expect(secondMean).toBeLessThan(STEP_SECOND_MEAN_RANGE.max);
    const seasonalAbsMean =
      seasonal.reduce((sum, value) => sum + Math.abs(value), 0) /
      seasonal.length;
    expect(seasonalAbsMean).toBeLessThan(STL_RESIDUAL_MEAN_ABS_LIMIT);
    residual.forEach((value) => {
      expect(Number.isFinite(value)).toBe(true);
    });
  });

  it('handles very short series without NaN output', () => {
    const { trend, seasonal, residual } = stlDecompose([2], {
      seasonLength: 7,
    });
    expect(trend).toEqual([2]);
    expect(seasonal).toEqual([0]);
    expect(residual).toEqual([0]);
  });
});

describe('mannWhitneyUTest (exact small-n and ties)', () => {
  it('computes exact p for small samples', () => {
    const a = [1, 2];
    const b = [3, 4];
    const res = mannWhitneyUTest(a, b);
    expect(res.method).toBe('exact');
    // Exact two-sided p = 2/6 = 0.333...
    expect(res.p).toBeLessThan(0.34);
    expect(res.effect).toBeCloseTo(1, 10);
    expect(res.effect_ci_low).toBeLessThanOrEqual(res.effect_ci_high);
    expect(res.effect).toBeGreaterThan(0);
  });

  it('flips sign when group ordering reverses', () => {
    const a = [3, 4];
    const b = [1, 2];
    const res = mannWhitneyUTest(a, b);
    expect(res.method).toBe('exact');
    expect(res.effect).toBeCloseTo(-1, 10);
    expect(res.effect_ci_low).toBeLessThanOrEqual(res.effect_ci_high);
  });

  it('handles ties and returns finite results', () => {
    const a = [1, 2];
    const b = [2, 3];
    const res = mannWhitneyUTest(a, b);
    expect(res.method).toBe('exact');
    expect(isFinite(res.U)).toBe(true);
    expect(isFinite(res.p)).toBe(true);
    expect(isFinite(res.effect)).toBe(true);
  });
});

describe('quantile', () => {
  it('computes median for odd-length array', () => {
    expect(quantile([1, 3, 2], 0.5)).toBe(2);
  });

  it('interpolates for even-length array', () => {
    expect(quantile([0, 10], 0.5)).toBe(5);
  });

  it('returns NaN for empty array', () => {
    expect(quantile([], 0.5)).toBeNaN();
  });
});

describe('normalQuantile', () => {
  it('inverts normalCdf at common probabilities', () => {
    const probs = [0.025, 0.5, 0.975];
    probs.forEach((p) => {
      const z = normalQuantile(p);
      expect(normalCdf(z)).toBeCloseTo(p, 4);
    });
  });

  it('matches known z-scores', () => {
    expect(normalQuantile(0.841344746)).toBeCloseTo(1, 4);
    expect(normalQuantile(0.158655254)).toBeCloseTo(-1, 4);
  });
});

describe('computeApneaEventStats', () => {
  it('computes duration and night statistics', () => {
    const details = [
      buildApneaDetail(),
      buildApneaDetail({
        event: 'Obstructive',
        durationSec: APNEA_DURATION_HIGH_SEC,
        dateTime: '2021-01-01T00:02:00Z',
      }),
      {
        Event: 'FLG',
        'Data/Duration': '1.0',
        DateTime: '2021-01-01T00:01:00Z',
      },
    ];
    const stats = computeApneaEventStats(details);
    expect(stats.totalEvents).toBe(2);
    expect(stats.durations).toEqual([
      APNEA_DURATION_THRESHOLD_SEC,
      APNEA_DURATION_HIGH_SEC,
    ]);
    const durations = stats.durations;
    expect(stats.medianDur).toBe(quantile(durations, QUARTILE_MEDIAN));
    const q1 = quantile(durations, QUARTILE_LOWER);
    const q3 = quantile(durations, QUARTILE_UPPER);
    expect(stats.iqrDur).toBeCloseTo(q3 - q1);
    expect(stats.p95Dur).toBeCloseTo(quantile(durations, PERCENTILE_95TH));
    expect(stats.nightDates).toEqual(['2021-01-01']);
    expect(stats.eventsPerNight).toEqual([2]);
  });
});

describe('summarizeUsage', () => {
  it('summarizes usage hours and outliers', () => {
    const data = [
      buildSummaryRow({ totalTime: '1:00:00' }),
      buildSummaryRow({ totalTime: '3:00:00' }),
    ];
    const usage = summarizeUsage(data);
    expect(usage.totalNights).toBe(2);
    expect(usage.validNights).toBe(2);
    expect(usage.invalidNights).toBe(0);
    expect(usage.avgHours).toBe(2);
    const expectedShort = data.filter((row) => {
      const hours = parseDuration(row['Total Time']) / SECONDS_PER_HOUR;
      return hours < USAGE_COMPLIANCE_THRESHOLD_HOURS;
    }).length;
    const expectedLong = data.filter((row) => {
      const hours = parseDuration(row['Total Time']) / SECONDS_PER_HOUR;
      return hours >= USAGE_STRICT_THRESHOLD_HOURS;
    }).length;
    expect(usage.nightsShort).toBe(expectedShort);
    expect(usage.nightsLong).toBe(expectedLong);
    expect(usage.medianHours).toBe(2);
    expect(usage.iqrHours).toBe(1);
  });

  it('ignores invalid total time values when computing averages', () => {
    const data = [
      buildSummaryRow({ totalTime: '01:30:00' }),
      buildSummaryRow({ totalTime: 'bad' }),
      buildSummaryRow({ totalTime: null }),
    ];
    const usage = summarizeUsage(data);
    expect(usage.totalNights).toBe(3);
    expect(usage.validNights).toBe(1);
    expect(usage.invalidNights).toBe(2);
    expect(usage.avgHours).toBe(1.5);
    const expectedShort = data.filter((row) => {
      if (!row['Total Time']) return false;
      const hours = parseDuration(row['Total Time']) / SECONDS_PER_HOUR;
      return Number.isFinite(hours) && hours < USAGE_COMPLIANCE_THRESHOLD_HOURS;
    }).length;
    const expectedLong = data.filter((row) => {
      if (!row['Total Time']) return false;
      const hours = parseDuration(row['Total Time']) / SECONDS_PER_HOUR;
      return Number.isFinite(hours) && hours >= USAGE_STRICT_THRESHOLD_HOURS;
    }).length;
    expect(usage.nightsShort).toBe(expectedShort);
    expect(usage.nightsLong).toBe(expectedLong);
  });

  it('handles empty input', () => {
    const usage = summarizeUsage([]);
    expect(usage.totalNights).toBe(0);
    expect(usage.validNights).toBe(0);
    expect(usage.invalidNights).toBe(0);
    expect(Number.isNaN(usage.avgHours)).toBe(true);
    expect(Number.isNaN(usage.minHours)).toBe(true);
    expect(Number.isNaN(usage.maxHours)).toBe(true);
  });
});

describe('computeAHITrends', () => {
  it('calculates AHI statistics and trends', () => {
    const data = [
      buildSummaryRow({ date: '2021-01-01', ahi: 1 }),
      buildSummaryRow({ date: '2021-01-02', ahi: AHI_SEVERITY_LIMITS.normal }),
      buildSummaryRow({ date: '2021-01-03', ahi: 10 }),
    ];
    const ahi = computeAHITrends(data);
    expect(ahi.avgAHI).toBeCloseTo((1 + 5 + 10) / 3);
    expect(ahi.medianAHI).toBe(5);
    const expectedOverNormal = data.filter(
      (row) => Number(row.AHI) > AHI_SEVERITY_LIMITS.normal,
    ).length;
    expect(ahi.nightsAHIover5).toBe(expectedOverNormal);
    expect(ahi.first30AvgAHI).toBeCloseTo(ahi.avgAHI);
    expect(ahi.last30AvgAHI).toBeCloseTo(ahi.avgAHI);
  });

  it('handles empty input', () => {
    const ahi = computeAHITrends([]);
    expect(Number.isNaN(ahi.avgAHI)).toBe(true);
    expect(Number.isNaN(ahi.minAHI)).toBe(true);
    expect(ahi.nightsAHIover5).toBe(0);
  });
});

describe('computeEPAPTrends', () => {
  it('computes EPAP percentiles, correlation with AHI, and group means', () => {
    const data = [
      buildSummaryRow({ date: '2021-01-01', medianEPAP: 5, ahi: 1 }),
      buildSummaryRow({ date: '2021-01-02', medianEPAP: 9, ahi: 3 }),
    ];
    const epap = computeEPAPTrends(data);
    expect(epap.medianEPAP).toBe(7);
    expect(epap.iqrEPAP).toBe(2);
    // correlation of points (5,1) and (9,3) is 1
    expect(epap.corrEPAPAHI).toBeCloseTo(1);
    const expectedLow = data.filter(
      (row) => Number(row['Median EPAP']) < EPAP_SPLIT_THRESHOLD,
    );
    const expectedHigh = data.filter(
      (row) => Number(row['Median EPAP']) >= EPAP_SPLIT_THRESHOLD,
    );
    expect(epap.countLow).toBe(expectedLow.length);
    expect(epap.countHigh).toBe(expectedHigh.length);
    expect(epap.avgAHILow).toBe(1);
    expect(epap.avgAHIHigh).toBe(3);
  });

  it('handles empty input', () => {
    const epap = computeEPAPTrends([]);
    expect(Number.isNaN(epap.minEPAP)).toBe(true);
    expect(Number.isNaN(epap.maxEPAP)).toBe(true);
    expect(Number.isNaN(epap.corrEPAPAHI)).toBe(true);
    expect(epap.countLow).toBe(0);
    expect(Number.isNaN(epap.avgAHILow)).toBe(true);
    expect(Number.isNaN(epap.avgAHIHigh)).toBe(true);
  });
});

describe('computeUsageRolling (date-aware)', () => {
  it('uses calendar-day windows rather than fixed counts and returns CIs', () => {
    const dates = [
      new Date('2021-01-01'),
      new Date('2021-01-02'),
      new Date('2021-01-05'), // gap of 2 days
    ];
    const hours = [2, 4, 6];
    const windowDays = 3;
    const avgKey = `avg${windowDays}`;
    const avgLowKey = `${avgKey}_ci_low`;
    const avgHighKey = `${avgKey}_ci_high`;
    const medianKey = `median${windowDays}`;
    const r = computeUsageRolling(dates, hours, [windowDays]);
    // At index 1 (2021-01-02), window covers 2020-12-31..2021-01-02 => indices 0..1
    expect(r[avgKey][1]).toBeCloseTo((2 + 4) / 2);
    // At index 2 (2021-01-05), window covers 2021-01-03..2021-01-05 => only index 2
    expect(r[avgKey][2]).toBeCloseTo(6);
    // CIs are present and same length
    expect(r[avgLowKey]).toHaveLength(3);
    expect(r[avgHighKey]).toHaveLength(3);
    // CI bounds are NaN for single-observation windows (n=1, variance undefined)
    expect(Number.isNaN(r[avgLowKey][2])).toBe(true);
    expect(Number.isNaN(r[avgHighKey][2])).toBe(true);
    // Median arrays present (median is valid even for n=1)
    expect(r[medianKey]).toHaveLength(3);
    expect(Number.isFinite(r[medianKey][2])).toBe(true);
  });
});
