import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  useFitbitAnalysis,
  transformHeartRateForPipeline,
  transformFitbitDataForPipeline,
  prepareOscarData,
  shapeForDashboard,
  buildScatterData,
  buildCorrelationMatrix,
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

describe('buildCorrelationMatrix', () => {
  it('converts pair-format correlations to NxN matrix format', () => {
    const input = {
      correlations: {
        ahi_restingHR: { correlation: 0.45, pValue: 0.01, n: 8 },
        ahi_usage: { correlation: -0.32, pValue: 0.04, n: 8 },
        restingHR_usage: { correlation: 0.15, pValue: 0.25, n: 8 },
      },
      sampleSize: 8,
      metrics: { ahi: [1, 2], restingHR: [3, 4], usage: [5, 6] },
    };

    const result = buildCorrelationMatrix(input);

    expect(result.metrics).toEqual(['AHI', 'Resting HR', 'Usage (hrs)']);
    expect(result.sampleSize).toBe(8);
    expect(result.correlations).toHaveLength(3);
    expect(result.pValues).toHaveLength(3);

    // Diagonal should be 1.0 for correlations, 0.0 for pValues
    for (let i = 0; i < 3; i++) {
      expect(result.correlations[i][i]).toBe(1.0);
      expect(result.pValues[i][i]).toBe(0.0);
    }

    // Off-diagonal: ahi (0) / restingHR (1) → 0.45
    expect(result.correlations[0][1]).toBe(0.45);
    expect(result.correlations[1][0]).toBe(0.45);
    expect(result.pValues[0][1]).toBe(0.01);
    expect(result.pValues[1][0]).toBe(0.01);

    // ahi (0) / usage (2) → -0.32
    expect(result.correlations[0][2]).toBe(-0.32);
    expect(result.correlations[2][0]).toBe(-0.32);

    // restingHR (1) / usage (2) → 0.15
    expect(result.correlations[1][2]).toBe(0.15);
    expect(result.correlations[2][1]).toBe(0.15);
  });

  it('returns null for null or undefined input', () => {
    expect(buildCorrelationMatrix(null)).toBeNull();
    expect(buildCorrelationMatrix(undefined)).toBeNull();
  });

  it('returns null when correlations object is empty', () => {
    expect(buildCorrelationMatrix({ correlations: {} })).toBeNull();
  });

  it('returns null when correlations key is missing', () => {
    expect(buildCorrelationMatrix({ sampleSize: 5 })).toBeNull();
  });

  it('handles NaN correlation values by using null', () => {
    const input = {
      correlations: {
        ahi_hrv: { correlation: NaN, pValue: NaN, n: 0 },
        ahi_restingHR: { correlation: 0.5, pValue: 0.02, n: 8 },
      },
      sampleSize: 8,
      metrics: {},
    };

    const result = buildCorrelationMatrix(input);

    expect(result.metrics).toHaveLength(3); // ahi, hrv, restingHR
    expect(result.correlations).toHaveLength(3);

    // Find the ahi/hrv indices
    const ahiIdx = result.metrics.indexOf('AHI');
    const hrvIdx = result.metrics.indexOf('HRV');
    expect(ahiIdx).toBeGreaterThanOrEqual(0);
    expect(hrvIdx).toBeGreaterThanOrEqual(0);

    // NaN pair → null in matrix
    expect(result.correlations[ahiIdx][hrvIdx]).toBeNull();
    expect(result.pValues[ahiIdx][hrvIdx]).toBeNull();

    // Diagonal still correct
    expect(result.correlations[ahiIdx][ahiIdx]).toBe(1.0);
  });

  it('produces symmetric matrix', () => {
    const input = {
      correlations: {
        ahi_restingHR: { correlation: 0.6, pValue: 0.001, n: 10 },
      },
      sampleSize: 10,
      metrics: {},
    };

    const result = buildCorrelationMatrix(input);
    const n = result.metrics.length;

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        expect(result.correlations[i][j]).toBe(result.correlations[j][i]);
        expect(result.pValues[i][j]).toBe(result.pValues[j][i]);
      }
    }
  });

  it('handles unknown metric keys gracefully via fallback split', () => {
    const input = {
      correlations: {
        customA_customB: { correlation: 0.3, pValue: 0.05, n: 5 },
      },
      sampleSize: 5,
      metrics: {},
    };

    const result = buildCorrelationMatrix(input);

    // Falls back to first underscore split
    expect(result.metrics).toContain('customA');
    expect(result.metrics).toContain('customB');
    expect(result.correlations[0][1]).toBe(0.3);
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

    // correlationData is in matrix format (not raw pair format)
    expect(Array.isArray(result.correlationData.metrics)).toBe(true);
    expect(Array.isArray(result.correlationData.correlations)).toBe(true);
    expect(Array.isArray(result.correlationData.pValues)).toBe(true);
    // metrics.slice() should now work (it's an array)
    expect(() => result.correlationData.metrics.slice()).not.toThrow();

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

// --- End-to-end pipeline integration test (uses REAL analyzeOscarFitbitIntegration) ---

describe('end-to-end pipeline with sparse real-world data', () => {
  // 7 nights of OSCAR data (field names matching normalizeOscarRecord)
  const oscarData = [
    {
      Date: '2025-06-02',
      AHI: '3.2',
      'Median EPAP': '8.0',
      'Total Time': '7.5',
      'Leak Rate Median': '12',
    },
    {
      Date: '2025-06-03',
      AHI: '5.1',
      'Median EPAP': '8.0',
      'Total Time': '6.75',
      'Leak Rate Median': '18',
    },
    {
      Date: '2025-06-04',
      AHI: '2.8',
      'Median EPAP': '8.2',
      'Total Time': '8.0',
      'Leak Rate Median': '10',
    },
    {
      Date: '2025-06-05',
      AHI: '7.3',
      'Median EPAP': '7.8',
      'Total Time': '5.5',
      'Leak Rate Median': '25',
    },
    {
      Date: '2025-06-06',
      AHI: '4.5',
      'Median EPAP': '8.0',
      'Total Time': '7.0',
      'Leak Rate Median': '15',
    },
    {
      Date: '2025-06-07',
      AHI: '1.9',
      'Median EPAP': '8.4',
      'Total Time': '7.25',
      'Leak Rate Median': '8',
    },
    {
      Date: '2025-06-08',
      AHI: '6.0',
      'Median EPAP': '8.0',
      'Total Time': '6.5',
      'Leak Rate Median': '20',
    },
  ];

  // 7 days of Fitbit HR (full coverage, realistic resting HR + heartRateZones)
  const fitbitHeartRate = [
    {
      date: '2025-06-02',
      restingHeartRate: 61,
      heartRateZones: [
        {
          name: 'Out of Range',
          min: 30,
          max: 100,
          minutes: 1320,
          caloriesOut: 1200,
        },
        { name: 'Fat Burn', min: 100, max: 140, minutes: 30, caloriesOut: 200 },
        { name: 'Cardio', min: 140, max: 170, minutes: 8, caloriesOut: 80 },
        { name: 'Peak', min: 170, max: 220, minutes: 0, caloriesOut: 0 },
      ],
    },
    {
      date: '2025-06-03',
      restingHeartRate: 63,
      heartRateZones: [
        {
          name: 'Out of Range',
          min: 30,
          max: 100,
          minutes: 1310,
          caloriesOut: 1180,
        },
        { name: 'Fat Burn', min: 100, max: 140, minutes: 35, caloriesOut: 220 },
        { name: 'Cardio', min: 140, max: 170, minutes: 12, caloriesOut: 100 },
        { name: 'Peak', min: 170, max: 220, minutes: 0, caloriesOut: 0 },
      ],
    },
    {
      date: '2025-06-04',
      restingHeartRate: 60,
      heartRateZones: [
        {
          name: 'Out of Range',
          min: 30,
          max: 100,
          minutes: 1350,
          caloriesOut: 1220,
        },
        { name: 'Fat Burn', min: 100, max: 140, minutes: 25, caloriesOut: 180 },
        { name: 'Cardio', min: 140, max: 170, minutes: 5, caloriesOut: 50 },
        { name: 'Peak', min: 170, max: 220, minutes: 0, caloriesOut: 0 },
      ],
    },
    {
      date: '2025-06-05',
      restingHeartRate: 66,
      heartRateZones: [
        {
          name: 'Out of Range',
          min: 30,
          max: 100,
          minutes: 1280,
          caloriesOut: 1150,
        },
        { name: 'Fat Burn', min: 100, max: 140, minutes: 40, caloriesOut: 260 },
        { name: 'Cardio', min: 140, max: 170, minutes: 15, caloriesOut: 120 },
        { name: 'Peak', min: 170, max: 220, minutes: 2, caloriesOut: 15 },
      ],
    },
    {
      date: '2025-06-06',
      restingHeartRate: 62,
      heartRateZones: [
        {
          name: 'Out of Range',
          min: 30,
          max: 100,
          minutes: 1330,
          caloriesOut: 1190,
        },
        { name: 'Fat Burn', min: 100, max: 140, minutes: 28, caloriesOut: 195 },
        { name: 'Cardio', min: 140, max: 170, minutes: 10, caloriesOut: 85 },
        { name: 'Peak', min: 170, max: 220, minutes: 0, caloriesOut: 0 },
      ],
    },
    {
      date: '2025-06-07',
      restingHeartRate: 58,
      heartRateZones: [
        {
          name: 'Out of Range',
          min: 30,
          max: 100,
          minutes: 1360,
          caloriesOut: 1230,
        },
        { name: 'Fat Burn', min: 100, max: 140, minutes: 22, caloriesOut: 170 },
        { name: 'Cardio', min: 140, max: 170, minutes: 3, caloriesOut: 30 },
        { name: 'Peak', min: 170, max: 220, minutes: 0, caloriesOut: 0 },
      ],
    },
    {
      date: '2025-06-08',
      restingHeartRate: 64,
      heartRateZones: [
        {
          name: 'Out of Range',
          min: 30,
          max: 100,
          minutes: 1300,
          caloriesOut: 1170,
        },
        { name: 'Fat Burn', min: 100, max: 140, minutes: 33, caloriesOut: 210 },
        { name: 'Cardio', min: 140, max: 170, minutes: 11, caloriesOut: 90 },
        { name: 'Peak', min: 170, max: 220, minutes: 1, caloriesOut: 8 },
      ],
    },
  ];

  // Sparse SpO2 — only 2 of 7 days (insufficient for correlation, n < 3)
  // This is the scenario that was previously crashing with .toFixed() on null
  const fitbitSpo2 = [
    { date: '2025-06-02', avg: 96.5, min: 94.7, max: 97.4 },
    { date: '2025-06-08', avg: 96.0, min: 89.1, max: 100.0 },
  ];

  let pipelineResult;
  let dashboardResult;

  beforeAll(async () => {
    // Bypass the vi.mock at the top of this file to get the REAL implementation
    const { analyzeOscarFitbitIntegration: realAnalyze } =
      await vi.importActual('../utils/fitbitAnalysis.js');

    // Step 1-2: Transform raw data into pipeline format
    const preparedOscar = prepareOscarData(oscarData);
    const preparedFitbit = transformFitbitDataForPipeline(
      fitbitHeartRate,
      fitbitSpo2,
    );

    // Step 3: Run the full analysis pipeline (alignment + quality + correlation)
    pipelineResult = realAnalyze(preparedOscar, preparedFitbit, {
      minNightsRequired: 3,
      enableAdvancedAnalysis: false, // skip advanced (needs 14+ nights)
    });

    // Step 4: Shape for dashboard consumption
    dashboardResult = shapeForDashboard(pipelineResult, fitbitHeartRate);
  });

  it('pipeline completes successfully without throwing', () => {
    expect(pipelineResult).toBeDefined();
    expect(pipelineResult.success).toBe(true);
    expect(pipelineResult.error).toBeUndefined();
  });

  it('shapeForDashboard returns all required dashboard properties', () => {
    expect(dashboardResult).toHaveProperty('correlationData');
    expect(dashboardResult).toHaveProperty('nightlyData');
    expect(dashboardResult).toHaveProperty('scatterData');
    expect(dashboardResult).toHaveProperty('summary');
    expect(dashboardResult).toHaveProperty('heartRateData');
    expect(dashboardResult.heartRateData).toEqual(fitbitHeartRate);
  });

  it('correlationData has NxN matrix format with correct types', () => {
    const { correlationData } = dashboardResult;
    expect(correlationData).not.toBeNull();

    const { metrics, correlations, pValues } = correlationData;

    // metrics is a string[]
    expect(Array.isArray(metrics)).toBe(true);
    metrics.forEach((m) => expect(typeof m).toBe('string'));

    // Expect at least ahi, restingHR, and several others from the pipeline
    const n = metrics.length;
    expect(n).toBeGreaterThanOrEqual(3);

    // correlations and pValues are number[][] (with nulls for insufficient data)
    expect(correlations).toHaveLength(n);
    expect(pValues).toHaveLength(n);
    correlations.forEach((row) => expect(row).toHaveLength(n));
    pValues.forEach((row) => expect(row).toHaveLength(n));

    // Every cell is either a number or null
    correlations.forEach((row) => {
      row.forEach((val) => {
        expect(val === null || typeof val === 'number').toBe(true);
      });
    });
    pValues.forEach((row) => {
      row.forEach((val) => {
        expect(val === null || typeof val === 'number').toBe(true);
      });
    });
  });

  it('matrix diagonal is 1.0 for correlations and 0.0 for pValues', () => {
    const { correlations, pValues, metrics } = dashboardResult.correlationData;

    for (let i = 0; i < metrics.length; i++) {
      expect(correlations[i][i]).toBe(1.0);
      expect(pValues[i][i]).toBe(0.0);
    }
  });

  it('matrix is symmetric', () => {
    const { correlations, pValues, metrics } = dashboardResult.correlationData;
    const n = metrics.length;

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        expect(correlations[i][j]).toBe(correlations[j][i]);
        expect(pValues[i][j]).toBe(pValues[j][i]);
      }
    }
  });

  it('contains valid correlations where data is sufficient (AHI ↔ Resting HR)', () => {
    const { correlations, pValues, metrics } = dashboardResult.correlationData;

    const ahiIdx = metrics.indexOf('AHI');
    const restingHRIdx = metrics.indexOf('Resting HR');
    expect(ahiIdx).toBeGreaterThanOrEqual(0);
    expect(restingHRIdx).toBeGreaterThanOrEqual(0);

    // AHI ↔ Resting HR: all 7 nights have both values → valid correlation
    const r = correlations[ahiIdx][restingHRIdx];
    const p = pValues[ahiIdx][restingHRIdx];
    expect(r).not.toBeNull();
    expect(typeof r).toBe('number');
    expect(Number.isFinite(r)).toBe(true);
    expect(r).toBeGreaterThanOrEqual(-1);
    expect(r).toBeLessThanOrEqual(1);

    expect(p).not.toBeNull();
    expect(typeof p).toBe('number');
    expect(Number.isFinite(p)).toBe(true);
  });

  it('contains null correlations where data is insufficient (SpO2 with only 2 data points)', () => {
    const { correlations, pValues, metrics } = dashboardResult.correlationData;

    const ahiIdx = metrics.indexOf('AHI');
    const minSpO2Idx = metrics.indexOf('Min SpO2');

    // SpO2 only available for 2 of 7 nights → n < 3 → null in matrix
    if (minSpO2Idx >= 0) {
      expect(correlations[ahiIdx][minSpO2Idx]).toBeNull();
      expect(pValues[ahiIdx][minSpO2Idx]).toBeNull();
    }

    // HRV has no data at all → null
    const hrvIdx = metrics.indexOf('HRV');
    if (hrvIdx >= 0) {
      expect(correlations[ahiIdx][hrvIdx]).toBeNull();
      expect(pValues[ahiIdx][hrvIdx]).toBeNull();
    }
  });

  it('nightlyData is array with correct shape per entry', () => {
    const { nightlyData } = dashboardResult;

    expect(Array.isArray(nightlyData)).toBe(true);
    expect(nightlyData.length).toBeGreaterThanOrEqual(3);

    nightlyData.forEach((night) => {
      expect(night).toHaveProperty('date');
      expect(typeof night.date).toBe('string');
      expect(night.date).toMatch(/^\d{4}-\d{2}-\d{2}/);

      expect(night).toHaveProperty('avgHeartRate');
      expect(night).toHaveProperty('ahi');
      expect(night).toHaveProperty('oscar');
      expect(night).toHaveProperty('fitbit');
    });
  });

  it('no .toFixed() crash — simulates dashboard rendering of correlation values', () => {
    const { correlations, pValues } = dashboardResult.correlationData;

    // This is what the CorrelationMatrix component does:
    // iterate cells and call .toFixed() on non-null values
    expect(() => {
      correlations.forEach((row) => {
        row.forEach((val) => {
          if (val !== null) {
            val.toFixed(2);
          }
        });
      });
      pValues.forEach((row) => {
        row.forEach((val) => {
          if (val !== null) {
            val.toFixed(4);
          }
        });
      });
    }).not.toThrow();
  });

  it('summary has expected fields and reasonable values', () => {
    const { summary } = dashboardResult;

    expect(summary).toHaveProperty('totalNights');
    expect(typeof summary.totalNights).toBe('number');
    expect(summary.totalNights).toBeGreaterThanOrEqual(3);

    expect(summary).toHaveProperty('strongCorrelations');
    expect(typeof summary.strongCorrelations).toBe('number');
    expect(summary.strongCorrelations).toBeGreaterThanOrEqual(0);

    expect(summary).toHaveProperty('matchRate');
    expect(summary).toHaveProperty('dataQuality');
  });
});
