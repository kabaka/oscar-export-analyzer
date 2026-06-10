/**
 * Per-source parsers for the Google Health (Fitbit) export (privacy §5.1,
 * catalog §1/§4). Each parser takes the **raw file text** of one allowlisted
 * file and returns a normalized, structured-clone-safe object. Every parser:
 *
 *   - **never throws** on a malformed file — returns a `skipped` shape or skips
 *     the offending row and counts it (`malformedRows`), so one bad file/cell
 *     never aborts the ingest (privacy §5.1);
 *   - emits **epoch-ms numbers** for timestamps (worker→main clone convention);
 *   - applies the §4 gotchas: skip epoch-1970 (via the datetime parsers),
 *     string-number `value` casts, empty/header-only detection, array-in-cell
 *     tolerance, per-source unit handling (breaths/min, °C);
 *   - keeps the SpO2 50.0 sentinel IN the rows (the aggregator owns the
 *     sentinel-only drop) — the parser does not silently delete data points.
 *
 * CSV parsing uses PapaParse (already a dependency) in synchronous string mode;
 * JSON uses native `JSON.parse` inside a try/catch (perf §1.4 — no streaming
 * parser). These functions are pure and unit-tested with synthetic strings.
 *
 * @module utils/wearable/parsers
 */

import Papa from 'papaparse';
import {
  parseMmDdYy,
  parseMmDdYyDate,
  parseIsoNaive,
  parseIsoUtc,
  parseUtcOffsetMinutes,
} from './datetime.js';

/** Coerce a possibly-string numeric field to a finite number or `null`. @private */
function num(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Parse CSV text to row objects (header mode). Never throws. @private */
function parseCsvRows(text) {
  if (typeof text !== 'string' || text.trim() === '') {
    return { rows: [], fields: [], empty: true };
  }
  try {
    const res = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false, // we cast explicitly with NaN guards
    });
    return {
      rows: Array.isArray(res.data) ? res.data : [],
      fields: res.meta?.fields ?? [],
      empty: !res.data || res.data.length === 0,
    };
  } catch {
    return { rows: [], fields: [], empty: true, parseError: true };
  }
}

/** Safe `JSON.parse`; returns `null` on any failure (never throws). @private */
function safeJsonParse(text) {
  if (typeof text !== 'string' || text.trim() === '') return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/* ===========================================================================
 * Phase A — sleep windows, score, offsets, daily rollups
 * =========================================================================== */

/**
 * Parse `sleep-*.json` (catalog §3b) into raw session objects ready for
 * `dedupSleepSessions`/`foldNightsByKey`. Naive-local ISO timestamps are kept as
 * STRINGS (the night-keying fold expects `startTime`/`endTime` strings); only
 * `mainSleep` sessions are emitted (naps excluded later by the dedup step too).
 *
 * @param {string} text - Raw file text.
 * @param {object} [ctx]
 * @param {string} [ctx.relPath] - For `sourceFiles` provenance.
 * @returns {{ sessions: object[], malformedRows: number, skipped: boolean }}
 */
export function parseSleepJson(text, { relPath = null } = {}) {
  const parsed = safeJsonParse(text);
  if (!Array.isArray(parsed)) {
    return { sessions: [], malformedRows: 0, skipped: true };
  }
  const sessions = [];
  let malformedRows = 0;
  for (const s of parsed) {
    if (!s || typeof s !== 'object') {
      malformedRows += 1;
      continue;
    }
    if (s.logId == null || !s.dateOfSleep || !s.startTime || !s.endTime) {
      malformedRows += 1;
      continue;
    }
    sessions.push({
      logId: s.logId,
      dateOfSleep: String(s.dateOfSleep).slice(0, 10),
      startTime: String(s.startTime),
      endTime: String(s.endTime),
      type: s.type === 'classic' ? 'classic' : 'stages',
      mainSleep: s.mainSleep === true,
      timeInBed: num(s.timeInBed),
      minutesAsleep: num(s.minutesAsleep),
      minutesAwake: num(s.minutesAwake),
      minutesToFallAsleep: num(s.minutesToFallAsleep),
      minutesAfterWakeup: num(s.minutesAfterWakeup),
      efficiency: num(s.efficiency),
      levels: s.levels ?? null,
      file: relPath,
    });
  }
  return { sessions, malformedRows, skipped: false };
}

/**
 * Parse `sleep_score.csv` (catalog §1.8) → a `logId`-keyed map of score fields.
 * `sleep_log_entry_id` === `logId` (the sleep-json join key).
 *
 * @param {string} text - Raw file text.
 * @returns {{ byLogId: Map<number, object>, malformedRows: number, skipped: boolean }}
 */
export function parseSleepScoreCsv(text) {
  const { rows, empty } = parseCsvRows(text);
  const byLogId = new Map();
  let malformedRows = 0;
  for (const r of rows) {
    const logId = num(r.sleep_log_entry_id);
    if (logId == null) {
      malformedRows += 1;
      continue;
    }
    byLogId.set(logId, {
      score: num(r.overall_score),
      compositionScore: num(r.composition_score),
      revitalizationScore: num(r.revitalization_score),
      durationScore: num(r.duration_score),
      deepSleepMinutes: num(r.deep_sleep_in_minutes),
      restingHeartRate: num(r.resting_heart_rate),
      restlessness: num(r.restlessness),
    });
  }
  return { byLogId, malformedRows, skipped: empty };
}

/**
 * Parse `UserSleeps_*.csv` (catalog §1.11) → per-date UTC-offset hints (minutes).
 * The offset is an UNTRUSTED hint (`+00:00` placeholder for 88% of rows); the
 * resolver demotes it. We key by the naive-local sleep_start calendar date.
 *
 * @param {string} text - Raw file text.
 * @returns {{ hintsByDate: Map<string, number>, malformedRows: number, skipped: boolean }}
 */
export function parseUserSleepsCsv(text) {
  const { rows, empty } = parseCsvRows(text);
  const hintsByDate = new Map();
  let malformedRows = 0;
  for (const r of rows) {
    const offsetMin = parseUtcOffsetMinutes(r.start_utc_offset);
    const startUtc = r.sleep_start;
    if (!Number.isFinite(offsetMin) || !startUtc) {
      malformedRows += 1;
      continue;
    }
    // sleep_start is UTC; the local date = UTC + offset.
    const utcMs = parseIsoUtc(startUtc);
    if (!Number.isFinite(utcMs)) {
      malformedRows += 1;
      continue;
    }
    const key = dateKeyOf(utcMs + offsetMin * 60000);
    if (!hintsByDate.has(key)) hintsByDate.set(key, offsetMin);
  }
  return { hintsByDate, malformedRows, skipped: empty };
}

/**
 * Parse `resting_heart_rate-*.json` (catalog §1.1) → per-date RHR bpm.
 * Shape: `{ dateTime, value: { date: 'MM/DD/YY', value: <bpm>, error } }`.
 *
 * @param {string} text - Raw file text.
 * @returns {{ byDate: Map<string, number>, malformedRows: number, skipped: boolean }}
 */
export function parseRestingHrJson(text) {
  const parsed = safeJsonParse(text);
  if (!Array.isArray(parsed))
    return { byDate: new Map(), malformedRows: 0, skipped: true };
  const byDate = new Map();
  let malformedRows = 0;
  for (const rec of parsed) {
    const v = rec?.value;
    const bpm = num(v?.value);
    const dateMs = parseMmDdYyDate(v?.date);
    if (bpm == null || !Number.isFinite(dateMs)) {
      malformedRows += 1;
      continue;
    }
    byDate.set(dateKeyOf(dateMs), bpm);
  }
  return { byDate, malformedRows, skipped: false };
}

/**
 * Parse `time_in_heart_rate_zones-*.json` (catalog §1.1, 1 record/file) → daily
 * zone minutes for the file's date (derived from the record `dateTime`).
 *
 * @param {string} text - Raw file text.
 * @returns {{ byDate: Map<string, object>, malformedRows: number, skipped: boolean }}
 */
export function parseHrZonesJson(text) {
  const parsed = safeJsonParse(text);
  const arr = Array.isArray(parsed) ? parsed : parsed ? [parsed] : null;
  if (!arr) return { byDate: new Map(), malformedRows: 0, skipped: true };
  const byDate = new Map();
  let malformedRows = 0;
  for (const rec of arr) {
    const ms = parseMmDdYy(rec?.dateTime);
    const z = rec?.value?.valuesInZones;
    if (!Number.isFinite(ms) || !z) {
      malformedRows += 1;
      continue;
    }
    byDate.set(dateKeyOf(ms), {
      below: num(z.BELOW_DEFAULT_ZONE_1),
      z1: num(z.IN_DEFAULT_ZONE_1),
      z2: num(z.IN_DEFAULT_ZONE_2),
      z3: num(z.IN_DEFAULT_ZONE_3),
    });
  }
  return { byDate, malformedRows, skipped: false };
}

/**
 * Parse `Daily Readiness Score - *.csv` (catalog §1.7) → per-date readiness rows.
 *
 * @param {string} text - Raw file text.
 * @returns {{ byDate: Map<string, object>, malformedRows: number, skipped: boolean }}
 */
export function parseReadinessCsv(text) {
  const { rows, empty } = parseCsvRows(text);
  const byDate = new Map();
  let malformedRows = 0;
  for (const r of rows) {
    const date = r.date ? String(r.date).slice(0, 10) : null;
    if (!date) {
      malformedRows += 1;
      continue;
    }
    byDate.set(date, {
      score: num(r.readiness_score_value),
      state: r.readiness_state ?? null,
      activitySub: num(r.activity_subcomponent),
      sleepSub: num(r.sleep_subcomponent),
      hrvSub: num(r.hrv_subcomponent),
    });
  }
  return { byDate, malformedRows, skipped: empty };
}

/**
 * Parse `Stress Score.csv` (catalog §1.9) → per-date stress rows. Skips
 * `CALCULATION_FAILED` rows.
 *
 * @param {string} text - Raw file text.
 * @returns {{ byDate: Map<string, object>, malformedRows: number, skipped: boolean }}
 */
export function parseStressCsv(text) {
  const { rows, empty } = parseCsvRows(text);
  const byDate = new Map();
  let malformedRows = 0;
  for (const r of rows) {
    const date = r.DATE ? String(r.DATE).slice(0, 10) : null;
    if (!date) {
      malformedRows += 1;
      continue;
    }
    const failed = String(r.CALCULATION_FAILED).toLowerCase() === 'true';
    if (failed) continue; // valid skip, not malformed
    byDate.set(date, {
      score: num(r.STRESS_SCORE),
      sleepPoints: num(r.SLEEP_POINTS),
      responsivenessPoints: num(r.RESPONSIVENESS_POINTS),
      exertionPoints: num(r.EXERTION_POINTS),
      status: r.STATUS ?? null,
      refDate: date,
    });
  }
  return { byDate, malformedRows, skipped: empty };
}

/**
 * Parse `Daily Heart Rate Variability Summary - *.csv` (catalog §1.4) → per-date
 * nightly HRV. `timestamp` is ISO-no-Z; we key by its calendar date.
 *
 * @param {string} text - Raw file text.
 * @returns {{ byDate: Map<string, object>, malformedRows: number, skipped: boolean }}
 */
export function parseHrvSummaryCsv(text) {
  const { rows, empty } = parseCsvRows(text);
  const byDate = new Map();
  let malformedRows = 0;
  for (const r of rows) {
    const ms = parseIsoNaive(r.timestamp);
    if (!Number.isFinite(ms)) {
      malformedRows += 1;
      continue;
    }
    const key = dateKeyOf(ms);
    byDate.set(key, {
      rmssdMs: num(r.rmssd),
      nremhrBpm: num(r.nremhr),
      entropy: num(r.entropy),
    });
  }
  return { byDate, malformedRows, skipped: empty };
}

/**
 * Parse `Daily Respiratory Rate Summary - *.csv` (catalog §1.4) → per-date
 * nightly respiratory rate (breaths/min — do NOT confuse with the GoogleData
 * milli-breaths/min variant, which is out of scope).
 *
 * @param {string} text - Raw file text.
 * @returns {{ byDate: Map<string, number>, malformedRows: number, skipped: boolean }}
 */
export function parseRespRateDailyCsv(text) {
  const { rows, empty } = parseCsvRows(text);
  const byDate = new Map();
  let malformedRows = 0;
  for (const r of rows) {
    const ms = parseIsoNaive(r.timestamp);
    const brpm = num(r.daily_respiratory_rate);
    if (!Number.isFinite(ms) || brpm == null) {
      malformedRows += 1;
      continue;
    }
    byDate.set(dateKeyOf(ms), brpm);
  }
  return { byDate, malformedRows, skipped: empty };
}

/**
 * Parse `Respiratory Rate Summary - *.csv` (catalog §1.4) → per-date per-stage
 * breathing rates + signal-to-noise (breaths/min).
 *
 * @param {string} text - Raw file text.
 * @returns {{ byDate: Map<string, object>, malformedRows: number, skipped: boolean }}
 */
export function parseRespRateStageCsv(text) {
  const { rows, empty } = parseCsvRows(text);
  const byDate = new Map();
  let malformedRows = 0;
  for (const r of rows) {
    const ms = parseIsoNaive(r.timestamp);
    if (!Number.isFinite(ms)) {
      malformedRows += 1;
      continue;
    }
    byDate.set(dateKeyOf(ms), {
      deepBrpm: num(r.deep_sleep_breathing_rate ?? r.deep_breathing_rate),
      lightBrpm: num(r.light_sleep_breathing_rate ?? r.light_breathing_rate),
      remBrpm: num(r.rem_sleep_breathing_rate ?? r.rem_breathing_rate),
      fullBrpm: num(r.full_sleep_breathing_rate ?? r.full_breathing_rate),
      signalToNoise: num(r.signal_to_noise),
    });
  }
  return { byDate, malformedRows, skipped: empty };
}

/**
 * Parse `Active Zone Minutes - *.csv` (catalog §1.6) → per-date total AZM.
 * Rows are per-minute earned-AZM events; we sum `total_minutes` per local date.
 *
 * @param {string} text - Raw file text.
 * @returns {{ byDate: Map<string, number>, malformedRows: number, skipped: boolean }}
 */
export function parseAzmCsv(text) {
  const { rows, empty } = parseCsvRows(text);
  const byDate = new Map();
  let malformedRows = 0;
  for (const r of rows) {
    const ms = parseIsoNaive(r.date_time ?? r.timestamp);
    const mins = num(r.total_minutes);
    if (!Number.isFinite(ms) || mins == null) {
      malformedRows += 1;
      continue;
    }
    const key = dateKeyOf(ms);
    byDate.set(key, (byDate.get(key) ?? 0) + mins);
  }
  return { byDate, malformedRows, skipped: empty };
}

/**
 * Parse a Global daily-activity JSON (`steps-*.json`, `*_active_minutes-*.json`)
 * (catalog §1.1) → per-date totals. `value` is a **string** per §4.7. For
 * per-minute `steps`, we sum; for daily `*_active_minutes`, we sum the day's
 * records too (idempotent for 1-record days).
 *
 * @param {string} text - Raw file text.
 * @param {object} [ctx]
 * @param {'steps'|'activeMinutes'} [ctx.kind='steps'] - Which total to accumulate.
 * @returns {{ byDate: Map<string, object>, malformedRows: number, skipped: boolean }}
 */
export function parseDailyActivityJson(text, { kind = 'steps' } = {}) {
  const parsed = safeJsonParse(text);
  if (!Array.isArray(parsed))
    return { byDate: new Map(), malformedRows: 0, skipped: true };
  const byDate = new Map();
  let malformedRows = 0;
  for (const rec of parsed) {
    const ms = parseMmDdYy(rec?.dateTime);
    const v = num(rec?.value); // string-number cast (§4.7)
    if (!Number.isFinite(ms) || v == null) {
      malformedRows += 1;
      continue;
    }
    const key = dateKeyOf(ms);
    const cur = byDate.get(key) ?? { steps: 0, activeMinutes: 0 };
    if (kind === 'activeMinutes') cur.activeMinutes += v;
    else cur.steps += v;
    byDate.set(key, cur);
  }
  return { byDate, malformedRows, skipped: false };
}

/**
 * Parse `Computed Temperature - *.csv` (catalog §1.5) → per-date nightly skin
 * temp deviation (°C relative — never auto-converted). Keyed by `sleep_start`
 * calendar date.
 *
 * @param {string} text - Raw file text.
 * @returns {{ byDate: Map<string, object>, malformedRows: number, skipped: boolean }}
 */
export function parseTemperatureCsv(text) {
  const { rows, empty } = parseCsvRows(text);
  const byDate = new Map();
  let malformedRows = 0;
  for (const r of rows) {
    const ms = parseIsoNaive(r.sleep_start ?? r.timestamp);
    const dev = num(r.nightly_temperature ?? r.baseline_relative_sample_sum);
    if (!Number.isFinite(ms)) {
      malformedRows += 1;
      continue;
    }
    byDate.set(dateKeyOf(ms), { skinDeviationC: dev });
  }
  return { byDate, malformedRows, skipped: empty };
}

/**
 * Parse `Daily SpO2 - *.csv` (catalog §1.3) → per-date daily SpO2 aggregate
 * (fallback/summary; the Minute SpO2 source is canonical for nightly stats).
 *
 * @param {string} text - Raw file text.
 * @returns {{ byDate: Map<string, object>, malformedRows: number, skipped: boolean }}
 */
export function parseSpo2DailyCsv(text) {
  const { rows, empty } = parseCsvRows(text);
  const byDate = new Map();
  let malformedRows = 0;
  for (const r of rows) {
    const ms = parseIsoUtc(r.timestamp);
    if (!Number.isFinite(ms)) {
      malformedRows += 1;
      continue;
    }
    byDate.set(dateKeyOf(ms), {
      avg: num(r.average_value),
      lower: num(r.lower_bound),
      upper: num(r.upper_bound),
    });
  }
  return { byDate, malformedRows, skipped: empty };
}

/* ===========================================================================
 * Phase B — high-frequency series (UTC-stamped or naive-local samples)
 * =========================================================================== */

/**
 * Parse `Minute SpO2 - *.csv` (catalog §1.3) → per-minute SpO2 samples with
 * **true UTC ms** timestamps. The 50.0 sentinel is RETAINED here (the
 * aggregator drops it). README claims extra columns; only `timestamp,value`
 * are relied on (§4.9).
 *
 * @param {string} text - Raw file text.
 * @returns {{ samples: Array<{ utcMs: number, value: number }>, malformedRows: number, skipped: boolean }}
 */
export function parseMinuteSpo2Csv(text) {
  const { rows, empty } = parseCsvRows(text);
  const samples = [];
  let malformedRows = 0;
  for (const r of rows) {
    const utcMs = parseIsoUtc(r.timestamp);
    const value = num(r.value);
    if (!Number.isFinite(utcMs) || value == null) {
      malformedRows += 1;
      continue;
    }
    samples.push({ utcMs, value });
  }
  return { samples, malformedRows, skipped: empty };
}

/**
 * Parse `Heart Rate Variability Details - *.csv` (catalog §1.4) → per-5-min HRV
 * windows. Timestamps are **ISO-no-Z naive-local**.
 *
 * @param {string} text - Raw file text.
 * @returns {{ windows: Array<{ localMs: number, rmssd: number|null, coverage: number|null,
 *   lowFrequency: number|null, highFrequency: number|null }>, malformedRows: number, skipped: boolean }}
 */
export function parseHrvDetailsCsv(text) {
  const { rows, empty } = parseCsvRows(text);
  const windows = [];
  let malformedRows = 0;
  for (const r of rows) {
    const localMs = parseIsoNaive(r.timestamp);
    if (!Number.isFinite(localMs)) {
      malformedRows += 1;
      continue;
    }
    windows.push({
      localMs,
      rmssd: num(r.rmssd),
      coverage: num(r.coverage),
      lowFrequency: num(r.low_frequency),
      highFrequency: num(r.high_frequency),
    });
  }
  return { windows, malformedRows, skipped: empty };
}

/**
 * Parse `Snore Details - *.csv` (catalog §1.10) → per-30-second snore epochs.
 * Timestamps are **ISO-no-Z naive-local**.
 *
 * @param {string} text - Raw file text.
 * @returns {{ epochs: Array<{ localMs: number, mean_dba: number|null, max_dba: number|null,
 *   snore_label: number|null }>, malformedRows: number, skipped: boolean }}
 */
export function parseSnoreCsv(text) {
  const { rows, empty } = parseCsvRows(text);
  const epochs = [];
  let malformedRows = 0;
  for (const r of rows) {
    const localMs = parseIsoNaive(r.timestamp);
    if (!Number.isFinite(localMs)) {
      malformedRows += 1;
      continue;
    }
    epochs.push({
      localMs,
      mean_dba: num(r.mean_dba),
      max_dba: num(r.max_dba),
      snore_label: num(r.snore_label),
    });
  }
  return { epochs, malformedRows, skipped: empty };
}

/**
 * Parse `heart_rate-*.json` (catalog §1.1) → per-sample HR with **naive-local**
 * (`MM/DD/YY`) timestamps and confidence. The single biggest file class; native
 * `JSON.parse`, fold-and-discard.
 *
 * @param {string} text - Raw file text.
 * @returns {{ samples: Array<{ localMs: number, bpm: number, confidence: number|null }>,
 *   malformedRows: number, skipped: boolean }}
 */
export function parseHeartRateJson(text) {
  const parsed = safeJsonParse(text);
  if (!Array.isArray(parsed))
    return { samples: [], malformedRows: 0, skipped: true };
  const samples = [];
  let malformedRows = 0;
  for (const rec of parsed) {
    const localMs = parseMmDdYy(rec?.dateTime);
    const bpm = num(rec?.value?.bpm);
    if (!Number.isFinite(localMs) || bpm == null) {
      malformedRows += 1;
      continue;
    }
    samples.push({
      localMs,
      bpm,
      confidence: num(rec?.value?.confidence),
    });
  }
  return { samples, malformedRows, skipped: false };
}

/** `YYYY-MM-DD` from wall-clock ms (UTC fields). @private */
function dateKeyOf(ms) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`;
}

/**
 * Parser registry keyed by the `parser` field from `exportAllowlist.describeFile`.
 * Lets the worker dispatch without a switch. Each value has the signature
 * `(text: string, ctx?: object) => object` and never throws.
 * @type {Record<string, (text: string, ctx?: object) => object>}
 */
export const PARSERS = {
  sleepJson: parseSleepJson,
  sleepScoreCsv: parseSleepScoreCsv,
  userSleepsCsv: parseUserSleepsCsv,
  restingHrJson: parseRestingHrJson,
  hrZonesJson: parseHrZonesJson,
  readinessCsv: parseReadinessCsv,
  stressCsv: parseStressCsv,
  hrvSummaryCsv: parseHrvSummaryCsv,
  respRateDailyCsv: parseRespRateDailyCsv,
  respRateStageCsv: parseRespRateStageCsv,
  azmCsv: parseAzmCsv,
  dailyActivityJson: parseDailyActivityJson,
  temperatureCsv: parseTemperatureCsv,
  spo2DailyCsv: parseSpo2DailyCsv,
  minuteSpo2Csv: parseMinuteSpo2Csv,
  hrvDetailsCsv: parseHrvDetailsCsv,
  snoreCsv: parseSnoreCsv,
  heartRateJson: parseHeartRateJson,
};
