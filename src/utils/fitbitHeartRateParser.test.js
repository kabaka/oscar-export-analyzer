import { describe, it, expect } from 'vitest';
import {
  parseHeartRateResponse,
  parseHeartRateIntradayResponse,
  parseSyncResults,
  computeHeartRateSummary,
  parseSpo2Response,
} from './fitbitHeartRateParser';

describe('parseHeartRateResponse', () => {
  it('parses a valid activities-heart response', () => {
    const raw = {
      'activities-heart': [
        {
          dateTime: '2026-01-08',
          value: {
            restingHeartRate: 68,
            heartRateZones: [
              {
                name: 'Out of Range',
                minutes: 1439,
                caloriesOut: 1200,
                min: 30,
                max: 100,
              },
              {
                name: 'Fat Burn',
                minutes: 0,
                caloriesOut: 0,
                min: 100,
                max: 140,
              },
            ],
          },
        },
        {
          dateTime: '2026-01-09',
          value: {
            restingHeartRate: 70,
            heartRateZones: [
              {
                name: 'Out of Range',
                minutes: 1420,
                caloriesOut: 1180,
                min: 30,
                max: 100,
              },
            ],
          },
        },
      ],
    };

    const result = parseHeartRateResponse(raw);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      date: '2026-01-08',
      restingHeartRate: 68,
      heartRateZones: [
        {
          name: 'Out of Range',
          minutes: 1439,
          caloriesOut: 1200,
          min: 30,
          max: 100,
        },
        {
          name: 'Fat Burn',
          minutes: 0,
          caloriesOut: 0,
          min: 100,
          max: 140,
        },
      ],
    });
    expect(result[1].date).toBe('2026-01-09');
    expect(result[1].restingHeartRate).toBe(70);
  });

  it('returns results sorted by date ascending', () => {
    const raw = {
      'activities-heart': [
        { dateTime: '2026-01-10', value: { restingHeartRate: 72 } },
        { dateTime: '2026-01-08', value: { restingHeartRate: 68 } },
        { dateTime: '2026-01-09', value: { restingHeartRate: 70 } },
      ],
    };

    const result = parseHeartRateResponse(raw);

    expect(result.map((r) => r.date)).toEqual([
      '2026-01-08',
      '2026-01-09',
      '2026-01-10',
    ]);
  });

  it('handles entries without restingHeartRate', () => {
    const raw = {
      'activities-heart': [
        {
          dateTime: '2026-01-08',
          value: {
            heartRateZones: [
              { name: 'Out of Range', minutes: 1439, min: 30, max: 100 },
            ],
          },
        },
      ],
    };

    const result = parseHeartRateResponse(raw);

    expect(result).toHaveLength(1);
    expect(result[0].restingHeartRate).toBeNull();
    expect(result[0].heartRateZones).toHaveLength(1);
  });

  it('returns empty array for null input', () => {
    expect(parseHeartRateResponse(null)).toEqual([]);
  });

  it('returns empty array for missing activities-heart key', () => {
    expect(parseHeartRateResponse({ someOtherKey: [] })).toEqual([]);
  });

  it('returns empty array for empty activities-heart array', () => {
    expect(parseHeartRateResponse({ 'activities-heart': [] })).toEqual([]);
  });

  it('filters out entries with null/missing value', () => {
    const raw = {
      'activities-heart': [
        { dateTime: '2026-01-08', value: { restingHeartRate: 68 } },
        { dateTime: '2026-01-09', value: null },
        null,
        { dateTime: '2026-01-10' }, // missing value
      ],
    };

    const result = parseHeartRateResponse(raw);

    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2026-01-08');
  });

  it('handles missing heartRateZones gracefully', () => {
    const raw = {
      'activities-heart': [
        { dateTime: '2026-01-08', value: { restingHeartRate: 68 } },
      ],
    };

    const result = parseHeartRateResponse(raw);

    expect(result[0].heartRateZones).toEqual([]);
  });
});

describe('parseSyncResults', () => {
  it('parses batch sync results with heart rate data', () => {
    const batchResults = {
      heartRate: {
        'activities-heart': [
          { dateTime: '2026-01-08', value: { restingHeartRate: 68 } },
          { dateTime: '2026-01-09', value: { restingHeartRate: 70 } },
        ],
      },
    };

    const result = parseSyncResults(batchResults);

    expect(result.heartRateData).toHaveLength(2);
    expect(result.heartRateData[0].restingHeartRate).toBe(68);
  });

  it('returns empty heartRateData when heart rate has an error', () => {
    const batchResults = {
      heartRate: { error: 'Scope not granted' },
    };

    const result = parseSyncResults(batchResults);

    expect(result.heartRateData).toEqual([]);
  });

  it('returns empty heartRateData when no heartRate in results', () => {
    const batchResults = {
      spo2: { someData: true },
    };

    const result = parseSyncResults(batchResults);

    expect(result.heartRateData).toEqual([]);
  });

  it('returns empty data for null input', () => {
    expect(parseSyncResults(null)).toEqual({
      heartRateData: [],
      heartRateIntraday: [],
      spo2Data: [],
      sleepData: [],
    });
  });

  it('parses batch sync results with SpO2 data', () => {
    const batchResults = {
      heartRate: {
        'activities-heart': [
          { dateTime: '2026-01-08', value: { restingHeartRate: 68 } },
        ],
      },
      spo2: [
        { dateTime: '2026-01-08', value: { avg: 96.5, min: 93, max: 99 } },
        { dateTime: '2026-01-09', value: { avg: 97.0, min: 94, max: 100 } },
      ],
    };

    const result = parseSyncResults(batchResults);

    expect(result.heartRateData).toHaveLength(1);
    expect(result.spo2Data).toHaveLength(2);
    expect(result.spo2Data[0]).toEqual({
      date: '2026-01-08',
      avg: 96.5,
      min: 93,
      max: 99,
    });
  });

  it('parses batch sync results with sleep data', () => {
    const batchResults = {
      heartRate: {
        'activities-heart': [
          { dateTime: '2026-01-08', value: { restingHeartRate: 68 } },
        ],
      },
      sleep: {
        sleep: [
          {
            dateOfSleep: '2026-01-08',
            duration: 28800000,
            efficiency: 92,
            minutesAsleep: 420,
            minutesAwake: 30,
            minutesToFallAsleep: 12,
            levels: {
              summary: {
                deep: { count: 4, minutes: 90 },
                light: { count: 20, minutes: 210 },
                rem: { count: 6, minutes: 100 },
                wake: { count: 25, minutes: 30 },
              },
            },
          },
        ],
      },
    };

    const result = parseSyncResults(batchResults);

    expect(result.heartRateData).toHaveLength(1);
    expect(result.sleepData).toHaveLength(1);
    expect(result.sleepData[0]).toEqual({
      date: '2026-01-08',
      duration: 28800000,
      durationMinutes: 480,
      efficiency: 92,
      minutesAsleep: 420,
      minutesAwake: 30,
      minutesToFallAsleep: 12,
      deep: 90,
      light: 210,
      rem: 100,
      wake: 30,
    });
  });

  it('skips SpO2/sleep data with errors', () => {
    const batchResults = {
      heartRate: {
        'activities-heart': [
          { dateTime: '2026-01-08', value: { restingHeartRate: 68 } },
        ],
      },
      spo2: { error: 'Scope not granted' },
      sleep: { error: 'Scope not granted' },
    };

    const result = parseSyncResults(batchResults);

    expect(result.heartRateData).toHaveLength(1);
    expect(result.spo2Data).toEqual([]);
    expect(result.sleepData).toEqual([]);
  });

  it('selects longest sleep record when multiple records exist for same date', () => {
    const batchResults = {
      sleep: {
        sleep: [
          {
            dateOfSleep: '2026-01-08',
            duration: 3600000,
            efficiency: 80,
            minutesAsleep: 50,
            minutesAwake: 10,
            minutesToFallAsleep: 5,
            levels: { summary: {} },
          },
          {
            dateOfSleep: '2026-01-08',
            duration: 28800000,
            efficiency: 92,
            minutesAsleep: 420,
            minutesAwake: 30,
            minutesToFallAsleep: 12,
            levels: {
              summary: {
                deep: { minutes: 90 },
                light: { minutes: 210 },
                rem: { minutes: 100 },
                wake: { minutes: 30 },
              },
            },
          },
        ],
      },
    };

    const result = parseSyncResults(batchResults);

    expect(result.sleepData).toHaveLength(1);
    expect(result.sleepData[0].minutesAsleep).toBe(420);
    expect(result.sleepData[0].efficiency).toBe(92);
  });
});

describe('parseHeartRateIntradayResponse', () => {
  it('returns empty data for null input', () => {
    const result = parseHeartRateIntradayResponse(null);
    expect(result.date).toBeNull();
    expect(result.intradayData).toEqual([]);
    expect(result.intradayStats).toBeNull();
  });

  it('returns empty data for undefined input', () => {
    const result = parseHeartRateIntradayResponse(undefined);
    expect(result.date).toBeNull();
    expect(result.intradayData).toEqual([]);
    expect(result.intradayStats).toBeNull();
  });

  it('parses intraday response with summary and per-minute data', () => {
    const raw = {
      'activities-heart': [
        {
          dateTime: '2026-01-08',
          value: {
            restingHeartRate: 68,
            heartRateZones: [
              {
                name: 'Out of Range',
                minutes: 1400,
                caloriesOut: 1200,
                min: 30,
                max: 100,
              },
            ],
          },
        },
      ],
      'activities-heart-intraday': {
        dataset: [
          { time: '00:00:00', value: 64 },
          { time: '00:01:00', value: 62 },
          { time: '00:02:00', value: 66 },
        ],
        datasetInterval: 1,
        datasetType: 'minute',
      },
    };
    const result = parseHeartRateIntradayResponse(raw);
    expect(result.date).toBe('2026-01-08');
    expect(result.restingHeartRate).toBe(68);
    expect(result.intradayData).toHaveLength(3);
    expect(result.intradayData[0]).toEqual({ time: '00:00:00', bpm: 64 });
    expect(result.intradayStats.minBpm).toBe(62);
    expect(result.intradayStats.maxBpm).toBe(66);
    expect(result.intradayStats.avgBpm).toBe(64);
    expect(result.intradayStats.dataPoints).toBe(3);
  });

  it('handles missing intraday dataset', () => {
    const raw = {
      'activities-heart': [
        {
          dateTime: '2026-01-08',
          value: { restingHeartRate: 68 },
        },
      ],
    };
    const result = parseHeartRateIntradayResponse(raw);
    expect(result.date).toBe('2026-01-08');
    expect(result.restingHeartRate).toBe(68);
    expect(result.intradayData).toEqual([]);
    expect(result.intradayStats).toBeNull();
  });

  it('computes correct intradayStats for varied BPM values', () => {
    const raw = {
      'activities-heart': [
        {
          dateTime: '2026-01-08',
          value: { restingHeartRate: 65 },
        },
      ],
      'activities-heart-intraday': {
        dataset: [
          { time: '00:00:00', value: 50 },
          { time: '00:01:00', value: 100 },
          { time: '00:02:00', value: 75 },
        ],
      },
    };
    const result = parseHeartRateIntradayResponse(raw);
    expect(result.intradayStats.minBpm).toBe(50);
    expect(result.intradayStats.maxBpm).toBe(100);
    expect(result.intradayStats.avgBpm).toBe(75);
    expect(result.intradayStats.dataPoints).toBe(3);
  });
});

describe('parseSpo2Response — intraday /all format', () => {
  it('parses SpO2 intraday /all format with minutes array', () => {
    const raw = [
      {
        dateTime: '2026-01-08',
        minutes: [
          { minute: '2026-01-08T01:30:00.000', value: 96.5 },
          { minute: '2026-01-08T01:35:00.000', value: 97.0 },
          { minute: '2026-01-08T01:40:00.000', value: 95.0 },
        ],
      },
    ];
    const result = parseSpo2Response(raw);
    expect(result).toHaveLength(1);
    expect(result[0].avg).toBeCloseTo(96.2, 0);
    expect(result[0].min).toBe(95);
    expect(result[0].max).toBe(97);
    expect(result[0].intradayData).toHaveLength(3);
  });

  it('computes avg/min/max from minutes data', () => {
    const raw = [
      {
        dateTime: '2026-01-09',
        minutes: [
          { minute: '2026-01-09T02:00:00.000', value: 92.0 },
          { minute: '2026-01-09T02:05:00.000', value: 98.0 },
        ],
      },
    ];
    const result = parseSpo2Response(raw);
    expect(result[0].avg).toBe(95);
    expect(result[0].min).toBe(92);
    expect(result[0].max).toBe(98);
  });

  it('still handles old value.avg/min/max format', () => {
    const raw = [
      {
        dateTime: '2026-01-08',
        value: { avg: 96.5, min: 93, max: 99 },
      },
    ];
    const result = parseSpo2Response(raw);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      date: '2026-01-08',
      avg: 96.5,
      min: 93,
      max: 99,
    });
  });
});

describe('computeHeartRateSummary', () => {
  it('computes correct summary for valid data', () => {
    const data = [
      { date: '2026-01-08', restingHeartRate: 68, heartRateZones: [] },
      { date: '2026-01-09', restingHeartRate: 72, heartRateZones: [] },
      { date: '2026-01-10', restingHeartRate: 66, heartRateZones: [] },
    ];

    const summary = computeHeartRateSummary(data);

    expect(summary.totalDays).toBe(3);
    expect(summary.daysWithRestingHR).toBe(3);
    expect(summary.avgRestingHR).toBeCloseTo(68.7, 1);
    expect(summary.minRestingHR).toBe(66);
    expect(summary.maxRestingHR).toBe(72);
    expect(summary.dateRange).toEqual({
      start: '2026-01-08',
      end: '2026-01-10',
    });
  });

  it('handles days with null restingHeartRate', () => {
    const data = [
      { date: '2026-01-08', restingHeartRate: 68, heartRateZones: [] },
      { date: '2026-01-09', restingHeartRate: null, heartRateZones: [] },
      { date: '2026-01-10', restingHeartRate: 72, heartRateZones: [] },
    ];

    const summary = computeHeartRateSummary(data);

    expect(summary.totalDays).toBe(3);
    expect(summary.daysWithRestingHR).toBe(2);
    expect(summary.avgRestingHR).toBe(70);
    expect(summary.minRestingHR).toBe(68);
    expect(summary.maxRestingHR).toBe(72);
  });

  it('returns null stats for empty array', () => {
    const summary = computeHeartRateSummary([]);

    expect(summary.totalDays).toBe(0);
    expect(summary.daysWithRestingHR).toBe(0);
    expect(summary.avgRestingHR).toBeNull();
    expect(summary.minRestingHR).toBeNull();
    expect(summary.maxRestingHR).toBeNull();
    expect(summary.dateRange).toBeNull();
  });

  it('returns null stats for null input', () => {
    const summary = computeHeartRateSummary(null);

    expect(summary.totalDays).toBe(0);
    expect(summary.avgRestingHR).toBeNull();
  });

  it('handles single day of data', () => {
    const data = [
      { date: '2026-01-08', restingHeartRate: 68, heartRateZones: [] },
    ];

    const summary = computeHeartRateSummary(data);

    expect(summary.totalDays).toBe(1);
    expect(summary.avgRestingHR).toBe(68);
    expect(summary.minRestingHR).toBe(68);
    expect(summary.maxRestingHR).toBe(68);
    expect(summary.dateRange).toEqual({
      start: '2026-01-08',
      end: '2026-01-08',
    });
  });
});
