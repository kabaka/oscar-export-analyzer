/**
 * Per-source parser tests (catalog §1/§4). Synthetic strings only — no real PHI.
 * Each parser must be robust to the §4 gotchas and never throw.
 */
import { describe, it, expect } from 'vitest';
import {
  parseSleepJson,
  parseSleepScoreCsv,
  parseUserSleepsCsv,
  parseRestingHrJson,
  parseHrZonesJson,
  parseReadinessCsv,
  parseStressCsv,
  parseHrvSummaryCsv,
  parseRespRateDailyCsv,
  parseRespRateStageCsv,
  parseAzmCsv,
  parseDailyActivityJson,
  parseTemperatureCsv,
  parseSpo2DailyCsv,
  parseMinuteSpo2Csv,
  parseHrvDetailsCsv,
  parseSnoreCsv,
  parseHeartRateJson,
  PARSERS,
} from './parsers.js';

describe('robustness — never throw on malformed input', () => {
  const everyParser = Object.values(PARSERS);
  it.each([
    ['empty string', ''],
    ['header-only csv', 'a,b,c\n'],
    ['not json', '{not valid json'],
    ['null', null],
    ['number', 42],
  ])('handles %s without throwing', (_label, input) => {
    for (const fn of everyParser) {
      expect(() => fn(input)).not.toThrow();
    }
  });
});

describe('parseSleepJson', () => {
  it('parses main-sleep sessions, keeps ISO strings, records provenance', () => {
    const text = JSON.stringify([
      {
        logId: 100,
        dateOfSleep: '2024-02-22',
        startTime: '2024-02-22T23:00:00.000',
        endTime: '2024-02-23T07:00:00.000',
        type: 'stages',
        mainSleep: true,
        minutesAsleep: 420,
        efficiency: 92,
        levels: { summary: { deep: { minutes: 60 } } },
      },
      { logId: null }, // malformed → skipped
    ]);
    const { sessions, malformedRows, skipped } = parseSleepJson(text, {
      relPath: 'Global Export Data/sleep-2024-02-22.json',
    });
    expect(skipped).toBe(false);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].startTime).toBe('2024-02-22T23:00:00.000');
    expect(sessions[0].file).toContain('sleep-2024-02-22.json');
    expect(malformedRows).toBe(1);
  });
});

describe('parseSleepScoreCsv (logId join)', () => {
  it('keys score fields by sleep_log_entry_id == logId', () => {
    const text =
      'sleep_log_entry_id,overall_score,resting_heart_rate\n100,88,58\n';
    const { byLogId } = parseSleepScoreCsv(text);
    expect(byLogId.get(100).score).toBe(88);
    expect(byLogId.get(100).restingHeartRate).toBe(58);
  });
});

describe('parseUserSleepsCsv (UTC offset hints, +00:00 placeholder)', () => {
  it('derives the local date and keeps the offset minutes', () => {
    const text = 'sleep_start,start_utc_offset\n2024-02-23T06:00:00Z,-08:00\n';
    const { hintsByDate } = parseUserSleepsCsv(text);
    // 06:00Z - 8h = 22:00 local on the 22nd.
    expect(hintsByDate.get('2024-02-22')).toBe(-480);
  });
  it('keeps a +00:00 placeholder offset as 0 (resolver demotes it)', () => {
    const text = 'sleep_start,start_utc_offset\n2024-02-22T23:00:00Z,+00:00\n';
    const { hintsByDate } = parseUserSleepsCsv(text);
    expect(hintsByDate.get('2024-02-22')).toBe(0);
  });
});

describe('parseRestingHrJson (nested MM/DD/YY value.date)', () => {
  it('maps each day to its RHR bpm', () => {
    const text = JSON.stringify([
      {
        dateTime: '02/22/24 00:00:00',
        value: { date: '02/22/24', value: 57.5 },
      },
    ]);
    const { byDate } = parseRestingHrJson(text);
    expect(byDate.get('2024-02-22')).toBe(57.5);
  });
});

describe('parseHrZonesJson (single record, valuesInZones)', () => {
  it('maps the file date to zone minutes', () => {
    const text = JSON.stringify([
      {
        dateTime: '02/22/24 00:00:00',
        value: {
          valuesInZones: {
            BELOW_DEFAULT_ZONE_1: 1200,
            IN_DEFAULT_ZONE_1: 30,
            IN_DEFAULT_ZONE_2: 10,
            IN_DEFAULT_ZONE_3: 2,
          },
        },
      },
    ]);
    const { byDate } = parseHrZonesJson(text);
    expect(byDate.get('2024-02-22')).toEqual({
      below: 1200,
      z1: 30,
      z2: 10,
      z3: 2,
    });
  });
});

describe('parseReadinessCsv / parseStressCsv', () => {
  it('parses readiness rows', () => {
    const text =
      'date,readiness_score_value,readiness_state,hrv_subcomponent\n2024-02-22,72,MED,80\n';
    const { byDate } = parseReadinessCsv(text);
    expect(byDate.get('2024-02-22')).toMatchObject({ score: 72, state: 'MED' });
  });
  it('skips CALCULATION_FAILED stress rows', () => {
    const text =
      'DATE,STRESS_SCORE,STATUS,CALCULATION_FAILED\n2024-02-22,40,OK,false\n2024-02-23,0,FAIL,true\n';
    const { byDate } = parseStressCsv(text);
    expect(byDate.get('2024-02-22').score).toBe(40);
    expect(byDate.has('2024-02-23')).toBe(false);
  });
});

describe('parseHrvSummaryCsv / parseRespRateDailyCsv / parseRespRateStageCsv', () => {
  it('keys nightly HRV by the timestamp date', () => {
    const text =
      'timestamp,rmssd,nremhr,entropy\n2024-02-22T03:00:00,42,55,2.1\n';
    const { byDate } = parseHrvSummaryCsv(text);
    expect(byDate.get('2024-02-22')).toMatchObject({
      rmssdMs: 42,
      nremhrBpm: 55,
    });
  });
  it('parses daily respiratory rate (breaths/min)', () => {
    const text = 'timestamp,daily_respiratory_rate\n2024-02-22T03:00:00,15.2\n';
    const { byDate } = parseRespRateDailyCsv(text);
    expect(byDate.get('2024-02-22')).toBeCloseTo(15.2);
  });
  it('parses per-stage respiratory rate', () => {
    const text =
      'timestamp,deep_sleep_breathing_rate,rem_sleep_breathing_rate,signal_to_noise\n2024-02-22T03:00:00,14,16,9\n';
    const { byDate } = parseRespRateStageCsv(text);
    expect(byDate.get('2024-02-22')).toMatchObject({
      deepBrpm: 14,
      remBrpm: 16,
    });
  });
});

describe('parseAzmCsv (sum per local date)', () => {
  it('sums total_minutes across rows of the same date', () => {
    const text =
      'date_time,heart_zone_id,total_minutes\n2024-02-22T10:00:00,FAT_BURN,3\n2024-02-22T10:05:00,CARDIO,2\n';
    const { byDate } = parseAzmCsv(text);
    expect(byDate.get('2024-02-22')).toBe(5);
  });
});

describe('parseDailyActivityJson (string-number value §4.7)', () => {
  it('casts string values and sums steps per day', () => {
    const text = JSON.stringify([
      { dateTime: '02/22/24 08:00:00', value: '100' },
      { dateTime: '02/22/24 08:01:00', value: '50' },
      { dateTime: '02/22/24 08:02:00', value: '' }, // empty → skipped
    ]);
    const { byDate, malformedRows } = parseDailyActivityJson(text, {
      kind: 'steps',
    });
    expect(byDate.get('2024-02-22').steps).toBe(150);
    expect(malformedRows).toBe(1);
  });
});

describe('parseTemperatureCsv / parseSpo2DailyCsv', () => {
  it('keeps °C deviation un-converted', () => {
    const text = 'sleep_start,nightly_temperature\n2024-02-22T23:00:00,-0.3\n';
    const { byDate } = parseTemperatureCsv(text);
    expect(byDate.get('2024-02-22').skinDeviationC).toBeCloseTo(-0.3);
  });
  it('parses daily SpO2 aggregate (ISO+Z)', () => {
    const text =
      'timestamp,average_value,lower_bound,upper_bound\n2024-02-22T12:00:00Z,95,92,98\n';
    const { byDate } = parseSpo2DailyCsv(text);
    expect(byDate.get('2024-02-22')).toMatchObject({ avg: 95, lower: 92 });
  });
});

describe('parseMinuteSpo2Csv (UTC+Z, 50.0 sentinel RETAINED)', () => {
  it('parses samples and does NOT drop the 50.0 sentinel', () => {
    const text =
      'timestamp,value\n2024-02-22T07:00:00Z,95\n2024-02-22T07:01:00Z,50.0\n2024-02-22T07:02:00Z,93\n';
    const { samples } = parseMinuteSpo2Csv(text);
    expect(samples).toHaveLength(3);
    expect(samples.some((s) => s.value === 50.0)).toBe(true);
  });
});

describe('parseHrvDetailsCsv / parseSnoreCsv (ISO no Z)', () => {
  it('parses 5-min HRV windows with coverage', () => {
    const text =
      'timestamp,rmssd,coverage,low_frequency,high_frequency\n2024-02-22T03:00:00,40,0.9,100,200\n';
    const { windows } = parseHrvDetailsCsv(text);
    expect(windows[0]).toMatchObject({ rmssd: 40, coverage: 0.9 });
  });
  it('parses 30-s snore epochs', () => {
    const text =
      'timestamp,mean_dba,max_dba,snore_label\n2024-02-22T03:00:00,35,48,1\n';
    const { epochs } = parseSnoreCsv(text);
    expect(epochs[0]).toMatchObject({
      mean_dba: 35,
      max_dba: 48,
      snore_label: 1,
    });
  });
});

describe('parseHeartRateJson (MM/DD/YY naive local + confidence)', () => {
  it('parses per-sample bpm and confidence', () => {
    const text = JSON.stringify([
      { dateTime: '02/22/24 03:00:00', value: { bpm: 58, confidence: 2 } },
      { dateTime: 'bad', value: { bpm: 60 } }, // malformed → skipped
    ]);
    const { samples, malformedRows } = parseHeartRateJson(text);
    expect(samples).toHaveLength(1);
    expect(samples[0]).toMatchObject({ bpm: 58, confidence: 2 });
    expect(malformedRows).toBe(1);
  });
});
