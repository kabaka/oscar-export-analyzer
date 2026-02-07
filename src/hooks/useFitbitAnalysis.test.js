import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  useFitbitAnalysis,
  transformHeartRateForPipeline,
  transformFitbitDataForPipeline,
  prepareOscarData,
  shapeForDashboard,
  buildScatterData,
} from './useFitbitAnalysis';

// Mock the heavy analysis pipeline to keep tests fast and isolated
vi.mock('../utils/fitbitAnalysis.js', () => ({
  analyzeOscarFitbitIntegration: vi.fn(),
}));

import { analyzeOscarFitbitIntegration } from '../utils/fitbitAnalysis.js';

// --- Helper builders ---

function buildOscarRows(count = 10, startDate = '2026-01-01') {
  const rows = [];
  for (let i = 0; i < count; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().slice(0, 10);
    rows.push({
      Date: dateStr,
      AHI: String(5 + Math.random() * 20),
      'Central AHI': '1.2',
      'Obstructive AHI': '3.5',
      'Hypopnea AHI': '2.0',
      'Median EPAP': '10.5',
      'Median IPAP': '14.0',
      'Mean Pressure': '12.0',
      'Max Pressure': '16.0',
      'Total Time': '7.5',
      'Leak Rate Median': '4.2',
    });
  }
  return rows;
}

function buildHeartRateData(count = 10, startDate = '2026-01-01') {
  const data = [];
  for (let i = 0; i < count; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    data.push({
      date: date.toISOString().slice(0, 10),
      restingHeartRate: 60 + Math.round(Math.random() * 15),
      heartRateZones: [
        {
          name: 'Out of Range',
          minutes: 1400,
          caloriesOut: 1100,
          min: 30,
          max: 100,
        },
        { name: 'Fat Burn', minutes: 30, caloriesOut: 200, min: 100, max: 140 },
      ],
    });
  }
  return data;
}

function buildSuccessfulAnalysisResult() {
  return {
    success: true,
    analysisDate: new Date().toISOString(),
    dataOverview: {
      totalNights: 10,
      analysisNights: 8,
      matchRate: 0.8,
      dataQuality: { qualityScore: 0.9 },
      excludedNights: 2,
    },
    correlations: {
      correlations: {
        ahi_restingHR: {
          correlation: 0.45,
          pValue: 0.01,
          n: 8,
          effectSize: 'medium',
          interpretation: 'Moderate positive correlation',
          clinical: 'AHI-Resting HR',
          expected: 'positive',
        },
        usage_restingHR: {
          correlation: -0.32,
          pValue: 0.04,
          n: 8,
          effectSize: 'medium',
          interpretation: 'Weak negative correlation',
          clinical: 'Usage-Resting HR',
          expected: 'negative',
        },
        ahi_hrv: {
          correlation: NaN,
          pValue: NaN,
          n: 0,
          effectSize: 'negligible',
          interpretation: 'No significant relationship',
          clinical: 'AHI-HRV',
          expected: 'negative',
        },
      },
      sampleSize: 8,
      metrics: {
        ahi: [5, 8, 12, 6, 15, 9, 7, 11],
        restingHR: [62, 65, 70, 63, 72, 66, 64, 68],
        usage: [7.5, 6.8, 8.0, 7.2, 6.5, 7.8, 7.0, 7.5],
      },
    },
    advancedAnalysis: null,
    clinicalInsights: [{ type: 'correlation', message: 'Test insight' }],
    alignedRecords: Array.from({ length: 8 }, (_, i) => ({
      date: new Date(`2026-01-0${i + 1}`),
      oscar: { ahi: 5 + i, usage: { totalMinutes: 450 }, pressures: {} },
      fitbit: {
        heartRate: { restingBpm: 62 + i },
        oxygenSaturation: {},
        sleepStages: {},
      },
    })),
    alignmentStatistics: { matchRate: 0.8 },
  };
}

// --- Unit tests for pure functions ---

describe('transformHeartRateForPipeline', () => {
  it('transforms heart rate data to pipeline format', () => {
    const hrData = [
      { date: '2026-01-08', restingHeartRate: 68, heartRateZones: [] },
      { date: '2026-01-09', restingHeartRate: 65, heartRateZones: [] },
    ];

    const result = transformHeartRateForPipeline(hrData);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      date: '2026-01-08T12:00:00',
      fitbit: { heartRate: { restingBpm: 68 } },
    });
    expect(result[1]).toEqual({
      date: '2026-01-09T12:00:00',
      fitbit: { heartRate: { restingBpm: 65 } },
    });
  });

  it('filters out entries with null restingHeartRate', () => {
    const hrData = [
      { date: '2026-01-08', restingHeartRate: 68, heartRateZones: [] },
      { date: '2026-01-09', restingHeartRate: null, heartRateZones: [] },
    ];

    const result = transformHeartRateForPipeline(hrData);
    expect(result).toHaveLength(1);
    expect(result[0].fitbit.heartRate.restingBpm).toBe(68);
  });

  it('returns empty array for invalid input', () => {
    expect(transformHeartRateForPipeline(null)).toEqual([]);
    expect(transformHeartRateForPipeline(undefined)).toEqual([]);
    expect(transformHeartRateForPipeline('invalid')).toEqual([]);
  });
});

describe('transformFitbitDataForPipeline', () => {
  it('merges HR, SpO2, and sleep data for matching dates', () => {
    const hrData = [
      { date: '2026-01-08', restingHeartRate: 68, heartRateZones: [] },
    ];
    const spo2Data = [{ date: '2026-01-08', avg: 96.5, min: 93, max: 99 }];
    const sleepData = [
      {
        date: '2026-01-08',
        minutesAsleep: 420,
        efficiency: 92,
        deep: 90,
        rem: 100,
        light: 210,
        wake: 30,
        minutesToFallAsleep: 12,
      },
    ];

    const result = transformFitbitDataForPipeline(hrData, spo2Data, sleepData);

    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2026-01-08T12:00:00');
    expect(result[0].fitbit.heartRate.restingBpm).toBe(68);
    expect(result[0].fitbit.oxygenSaturation).toEqual({
      avgPercent: 96.5,
      minPercent: 93,
      maxPercent: 99,
    });
    expect(result[0].fitbit.sleepStages).toEqual({
      totalSleepMinutes: 420,
      sleepEfficiency: 92,
      deepSleepMinutes: 90,
      remSleepMinutes: 100,
      lightSleepMinutes: 210,
      awakeMinutes: 30,
      onsetLatencyMin: 12,
    });
  });

  it('works with HR data only (backward compatible)', () => {
    const hrData = [
      { date: '2026-01-08', restingHeartRate: 68, heartRateZones: [] },
    ];

    const result = transformFitbitDataForPipeline(hrData);

    expect(result).toHaveLength(1);
    expect(result[0].fitbit.heartRate.restingBpm).toBe(68);
    expect(result[0].fitbit.oxygenSaturation).toBeUndefined();
    expect(result[0].fitbit.sleepStages).toBeUndefined();
  });

  it('requires HR data to produce a record', () => {
    const spo2Data = [{ date: '2026-01-08', avg: 96.5, min: 93, max: 99 }];

    const result = transformFitbitDataForPipeline([], spo2Data);

    expect(result).toHaveLength(0);
  });

  it('handles dates with only partial data coverage', () => {
    const hrData = [
      { date: '2026-01-08', restingHeartRate: 68, heartRateZones: [] },
      { date: '2026-01-09', restingHeartRate: 65, heartRateZones: [] },
    ];
    const spo2Data = [
      { date: '2026-01-08', avg: 96.5, min: 93, max: 99 },
      // No SpO2 for 2026-01-09
    ];

    const result = transformFitbitDataForPipeline(hrData, spo2Data);

    expect(result).toHaveLength(2);
    expect(result[0].fitbit.oxygenSaturation).toBeDefined();
    expect(result[1].fitbit.oxygenSaturation).toBeUndefined();
  });
});

describe('prepareOscarData', () => {
  it('adds sessionStartTime at 10 PM local time', () => {
    const rows = [
      { Date: '2026-01-08', AHI: '12.5', 'Total Time': '7.5' },
      { Date: '2026-01-09', AHI: '8.0', 'Total Time': '6.5' },
    ];

    const result = prepareOscarData(rows);

    expect(result).toHaveLength(2);
    expect(result[0].sessionStartTime).toBe('2026-01-08T22:00:00');
    expect(result[0].Date).toBe('2026-01-08');
    expect(result[0].AHI).toBe('12.5');
    expect(result[1].sessionStartTime).toBe('2026-01-09T22:00:00');
  });

  it('preserves all original fields', () => {
    const rows = [
      {
        Date: '2026-01-08',
        AHI: '12.5',
        'Leak Rate Median': '4.0',
        custom: 'value',
      },
    ];
    const result = prepareOscarData(rows);

    expect(result[0].AHI).toBe('12.5');
    expect(result[0]['Leak Rate Median']).toBe('4.0');
    expect(result[0].custom).toBe('value');
  });

  it('returns empty array for invalid input', () => {
    expect(prepareOscarData(null)).toEqual([]);
    expect(prepareOscarData(undefined)).toEqual([]);
  });
});

describe('buildScatterData', () => {
  it('builds paired scatter points from metrics', () => {
    const metrics = {
      ahi: [5, 8, 12, 6],
      restingHR: [62, 65, 70, 63],
    };

    const result = buildScatterData(metrics);

    expect(result).toHaveProperty('ahi_restingHR');
    expect(result.ahi_restingHR.points).toHaveLength(4);
    expect(result.ahi_restingHR.points[0]).toEqual({ x: 5, y: 62, index: 0 });
    expect(result.ahi_restingHR.xMetric).toBe('ahi');
    expect(result.ahi_restingHR.yMetric).toBe('restingHR');
  });

  it('filters out NaN values from scatter points', () => {
    const metrics = {
      ahi: [5, NaN, 12],
      restingHR: [62, 65, NaN],
    };

    const result = buildScatterData(metrics);
    expect(result.ahi_restingHR.points).toHaveLength(1);
    expect(result.ahi_restingHR.points[0]).toEqual({ x: 5, y: 62, index: 0 });
  });

  it('returns empty object for null metrics', () => {
    expect(buildScatterData(null)).toEqual({});
    expect(buildScatterData(undefined)).toEqual({});
  });
});

describe('shapeForDashboard', () => {
  it('returns only heartRateData when analysis is null', () => {
    const hrData = [
      { date: '2026-01-08', restingHeartRate: 68, heartRateZones: [] },
    ];
    const result = shapeForDashboard(null, hrData);

    expect(result.heartRateData).toEqual(hrData);
    expect(result.correlationData).toBeUndefined();
    expect(result.nightlyData).toBeUndefined();
  });

  it('returns only heartRateData when analysis failed', () => {
    const failedResult = { success: false, error: 'Insufficient data' };
    const hrData = [
      { date: '2026-01-08', restingHeartRate: 68, heartRateZones: [] },
    ];
    const result = shapeForDashboard(failedResult, hrData);

    expect(result.heartRateData).toEqual(hrData);
    expect(result.correlationData).toBeUndefined();
  });

  it('shapes successful analysis results for dashboard', () => {
    const analysisResult = buildSuccessfulAnalysisResult();
    const hrData = buildHeartRateData(3);

    const result = shapeForDashboard(analysisResult, hrData);

    // Has all required dashboard properties
    expect(result.correlationData).toBeDefined();
    expect(result.nightlyData).toBeDefined();
    expect(result.scatterData).toBeDefined();
    expect(result.summary).toBeDefined();
    expect(result.heartRateData).toEqual(hrData);

    // Summary is shaped correctly
    expect(result.summary.totalNights).toBe(8);
    // ahi_restingHR has |r|=0.45 and p=0.01 → strong; usage_restingHR has |r|=0.32 and p=0.04 → strong
    expect(result.summary.strongCorrelations).toBe(2);

    // Nightly data is transformed
    expect(result.nightlyData).toHaveLength(8);
    expect(result.nightlyData[0]).toHaveProperty('date');
    expect(result.nightlyData[0]).toHaveProperty('avgHeartRate');
    expect(result.nightlyData[0]).toHaveProperty('ahi');
  });

  it('returns empty heartRateData array when no raw data provided', () => {
    const result = shapeForDashboard(null, undefined);
    expect(result.heartRateData).toEqual([]);
  });
});

// --- Hook integration tests ---

describe('useFitbitAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns no analysis when OSCAR data is missing', () => {
    const hrData = { heartRateData: buildHeartRateData(5) };

    const { result } = renderHook(() =>
      useFitbitAnalysis({ oscarData: null, fitbitSyncedData: hrData }),
    );

    expect(result.current.hasAnalysis).toBe(false);
    expect(result.current.analysisError).toBeNull();
    expect(result.current.analysisData.heartRateData).toHaveLength(5);
    expect(result.current.analysisData.correlationData).toBeUndefined();
    expect(analyzeOscarFitbitIntegration).not.toHaveBeenCalled();
  });

  it('returns no analysis when Fitbit data is missing', () => {
    const oscarRows = buildOscarRows(5);

    const { result } = renderHook(() =>
      useFitbitAnalysis({ oscarData: oscarRows, fitbitSyncedData: null }),
    );

    expect(result.current.hasAnalysis).toBe(false);
    expect(result.current.analysisError).toBeNull();
    expect(result.current.analysisData.heartRateData).toEqual([]);
    expect(analyzeOscarFitbitIntegration).not.toHaveBeenCalled();
  });

  it('returns no analysis when both sources are empty arrays', () => {
    const { result } = renderHook(() =>
      useFitbitAnalysis({
        oscarData: [],
        fitbitSyncedData: { heartRateData: [] },
      }),
    );

    expect(result.current.hasAnalysis).toBe(false);
    expect(analyzeOscarFitbitIntegration).not.toHaveBeenCalled();
  });

  it('runs analysis when both OSCAR and Fitbit data are available', () => {
    const mockResult = buildSuccessfulAnalysisResult();
    analyzeOscarFitbitIntegration.mockReturnValue(mockResult);

    const oscarRows = buildOscarRows(10);
    const fitbitData = { heartRateData: buildHeartRateData(10) };

    const { result } = renderHook(() =>
      useFitbitAnalysis({ oscarData: oscarRows, fitbitSyncedData: fitbitData }),
    );

    expect(analyzeOscarFitbitIntegration).toHaveBeenCalledTimes(1);
    expect(result.current.hasAnalysis).toBe(true);
    expect(result.current.analysisError).toBeNull();

    // Verify dashboard shape
    expect(result.current.analysisData.correlationData).toBeDefined();
    expect(result.current.analysisData.nightlyData).toBeDefined();
    expect(result.current.analysisData.scatterData).toBeDefined();
    expect(result.current.analysisData.summary).toBeDefined();
    expect(result.current.analysisData.heartRateData).toHaveLength(10);
  });

  it('passes prepared data to analysis pipeline', () => {
    analyzeOscarFitbitIntegration.mockReturnValue({
      success: false,
      error: 'test',
    });

    const oscarRows = [
      { Date: '2026-01-08', AHI: '12.5', 'Total Time': '7.5' },
    ];
    const fitbitData = {
      heartRateData: [
        { date: '2026-01-08', restingHeartRate: 68, heartRateZones: [] },
      ],
    };

    renderHook(() =>
      useFitbitAnalysis({ oscarData: oscarRows, fitbitSyncedData: fitbitData }),
    );

    const [passedOscar, passedFitbit, passedOptions] =
      analyzeOscarFitbitIntegration.mock.calls[0];

    // OSCAR rows should have sessionStartTime added
    expect(passedOscar[0].sessionStartTime).toBe('2026-01-08T22:00:00');
    expect(passedOscar[0].Date).toBe('2026-01-08');
    expect(passedOscar[0].AHI).toBe('12.5');

    // Fitbit data should be in pipeline format
    expect(passedFitbit[0].date).toBe('2026-01-08T12:00:00');
    expect(passedFitbit[0].fitbit.heartRate.restingBpm).toBe(68);

    // Options should specify lower minNightsRequired
    expect(passedOptions.minNightsRequired).toBe(3);
  });

  it('handles analysis pipeline failure gracefully', () => {
    analyzeOscarFitbitIntegration.mockReturnValue({
      success: false,
      error: 'Insufficient aligned nights (2 < 3)',
    });

    const oscarRows = buildOscarRows(3);
    const fitbitData = { heartRateData: buildHeartRateData(3) };

    const { result } = renderHook(() =>
      useFitbitAnalysis({ oscarData: oscarRows, fitbitSyncedData: fitbitData }),
    );

    expect(result.current.hasAnalysis).toBe(false);
    expect(result.current.analysisError).toBe(
      'Insufficient aligned nights (2 < 3)',
    );
    // Should still have basic HR data for HeartRateDataSection fallback
    expect(result.current.analysisData.heartRateData).toHaveLength(3);
  });

  it('handles pipeline exception gracefully', () => {
    analyzeOscarFitbitIntegration.mockImplementation(() => {
      throw new Error('Unexpected pipeline error');
    });

    const oscarRows = buildOscarRows(3);
    const fitbitData = { heartRateData: buildHeartRateData(3) };

    const { result } = renderHook(() =>
      useFitbitAnalysis({ oscarData: oscarRows, fitbitSyncedData: fitbitData }),
    );

    expect(result.current.hasAnalysis).toBe(false);
    expect(result.current.analysisError).toBe('Unexpected pipeline error');
    expect(result.current.analysisData.heartRateData).toHaveLength(3);
  });

  it('does not re-run when data references are stable', () => {
    const mockResult = buildSuccessfulAnalysisResult();
    analyzeOscarFitbitIntegration.mockReturnValue(mockResult);

    const oscarRows = buildOscarRows(5);
    const fitbitData = { heartRateData: buildHeartRateData(5) };

    const { rerender } = renderHook(
      ({ oscar, fitbit }) =>
        useFitbitAnalysis({ oscarData: oscar, fitbitSyncedData: fitbit }),
      { initialProps: { oscar: oscarRows, fitbit: fitbitData } },
    );

    // Re-render with same references
    rerender({ oscar: oscarRows, fitbit: fitbitData });

    // useMemo should prevent re-computation
    expect(analyzeOscarFitbitIntegration).toHaveBeenCalledTimes(1);
  });
});
