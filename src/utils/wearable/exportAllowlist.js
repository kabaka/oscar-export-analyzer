/**
 * Read-allowlist / denylist classifier for a Google Health (Fitbit) export tree
 * (privacy-security design rev2, §2; perf-storage §2.2).
 *
 * The strongest privacy control here is **never opening a denied or
 * out-of-scope file**. Classification is enforced **at enumeration time**: as the
 * worker walks the directory, each entry's *relative path* is classified and
 * non-`allowed` entries are skipped — never read, never parsed, never logged.
 *
 * Matching rules (the load-bearing precision constraints):
 *   - **Exact dir/prefix anchoring, NEVER loose substring globs.** A naive
 *     `*heart_rate*` glob would wrongly match the 38 MB out-of-scope
 *     `Global Export Data/daily_heart_rate_zones.csv` (pseudo-JSON cells that
 *     throw on `JSON.parse`). Every allowlist pattern below is anchored with `^`
 *     and `$` so that file classifies as `ignored` (asserted in tests).
 *   - **Denylist is checked BEFORE the allowlist** and pruned at directory
 *     descent (see {@link isDeniedDir}) so PII/GPS/social/menstrual/medical dirs
 *     are never even enumerated.
 *   - **Menstrual health is opt-in**: denied unless `menstrualOptIn` is true.
 *
 * Each allowlisted file maps to a `{ metric, source, parser }` descriptor so the
 * worker knows which per-source parser to run and which phase the file belongs
 * to. `parser` is a stable string key (resolved to a function in `parsers.js`),
 * keeping this module pure and free of parser imports.
 *
 * Pure module — no DOM / worker / IndexedDB. Unit-tested with adversarial paths.
 *
 * @module utils/wearable/exportAllowlist
 */

/**
 * Ingest phases (perf-storage §2.2). Phase A (sleep windows/offsets/rollups) is
 * fully resident; Phase B high-frequency metrics are processed one metric at a
 * time, evicting intraday per night.
 * @enum {string}
 */
export const INGEST_PHASE = {
  /** Phase A — sleep sessions, score, offsets, daily rollups (resident). */
  WINDOWS: 'A-windows',
  /** Phase B — per-metric high-frequency series (date-ordered, evicted). */
  HIGH_FREQ: 'B-highfreq',
};

/**
 * Canonical metric keys. One canonical source per metric (catalog §2); the
 * GoogleData / Physical Activity duplicate trees are never enumerated.
 * @enum {string}
 */
export const METRIC = {
  SLEEP: 'sleep',
  SLEEP_SCORE: 'sleepScore',
  USER_SLEEPS: 'userSleeps', // TZ-offset hint only
  SPO2_MINUTE: 'spo2',
  SPO2_DAILY: 'spo2Daily',
  HR: 'hr',
  RESTING_HR: 'restingHr',
  HR_ZONES: 'hrZones',
  HRV_DETAILS: 'hrvDetails',
  HRV_SUMMARY: 'hrvSummary',
  RESP_RATE_DAILY: 'respRateDaily',
  RESP_RATE_STAGE: 'respRateStage',
  READINESS: 'readiness',
  STRESS: 'stress',
  SNORE: 'snore',
  AZM: 'azm',
  STEPS: 'steps',
  ACTIVE_MINUTES: 'activeMinutes',
  TEMPERATURE: 'temperature',
};

/**
 * DENYLIST — directory prefixes that must NEVER be read or descended (privacy
 * §2.2). Anchored at the export root. Checked before the allowlist. Menstrual
 * health is handled separately (opt-in), not here.
 * @type {RegExp[]}
 */
const DENY_DIR_PREFIXES = [
  /^Your Profile\//,
  /^Account\//,
  /^Security\//,
  /^Notifications\//,
  /^Social\//,
  /^Fitbit Friends\//,
  /^Blocked Users\//,
  /^Commerce\//,
  /^Discover\//,
  /^Surveys\//,
  /^Premium\//,
  /^Guided Programs\//,
  /^Stress Journal\//,
];

/**
 * DENYLIST — filename/path patterns that must never be read even if they sit
 * under an otherwise-allowed parent dir (GPS tracks, demographics, free-text,
 * the pseudo-JSON zones file). Anchored.
 * @type {RegExp[]}
 */
const DENY_FILE_PATTERNS = [
  // GPS / location (only location data in the export — categorically denied)
  /\/gps_location_/,
  /\/live_pace_/,
  // Demographics / profile / identity entities (may live under allowed parents)
  /\/UserDemographicData/,
  /\/UserProfileData/,
  /\/UserLocationCountry/,
  // Free-text / highly sensitive
  /\/MedicalRecords/,
  /\/UserJournalEntries/,
  /\/UserFoodFrequencyEntries/,
  /\/UserConversations/,
  // Out-of-scope, parse-hostile 38 MB pseudo-JSON file (catalog §4.4).
  // Explicit deny in addition to the exact-anchored allowlist (defense in depth).
  /(^|\/)daily_heart_rate_zones\.csv$/,
];

const MENSTRUAL_PREFIX = 'Menstrual Health/';

/**
 * ALLOWLIST — the only files the worker may open. Each entry is an
 * **exact-anchored** RegExp plus its `{ metric, source, parser, phase }`
 * descriptor. Order does not matter (patterns are mutually exclusive in
 * practice); the first match wins.
 *
 * `source` is a short canonical-source label for provenance/receipts; `parser`
 * is the parser key resolved in `parsers.js`.
 * @type {Array<{ re: RegExp, metric: string, source: string, parser: string, phase: string }>}
 */
const ALLOWLIST = [
  // --- Phase A: sleep windows, score, TZ offsets, daily rollups ---
  {
    re: /^Global Export Data\/sleep-\d{4}-\d{2}-\d{2}\.json$/,
    metric: METRIC.SLEEP,
    source: 'global/sleep',
    parser: 'sleepJson',
    phase: INGEST_PHASE.WINDOWS,
  },
  {
    re: /^Sleep Score\/sleep_score\.csv$/,
    metric: METRIC.SLEEP_SCORE,
    source: 'sleepScore',
    parser: 'sleepScoreCsv',
    phase: INGEST_PHASE.WINDOWS,
  },
  {
    re: /^Health Fitness Data_GoogleData\/UserSleeps_[^/]+\.csv$/,
    metric: METRIC.USER_SLEEPS,
    source: 'userSleeps',
    parser: 'userSleepsCsv',
    phase: INGEST_PHASE.WINDOWS,
  },
  {
    re: /^Global Export Data\/resting_heart_rate-\d{4}-\d{2}-\d{2}\.json$/,
    metric: METRIC.RESTING_HR,
    source: 'global/restingHr',
    parser: 'restingHrJson',
    phase: INGEST_PHASE.WINDOWS,
  },
  {
    re: /^Global Export Data\/time_in_heart_rate_zones-\d{4}-\d{2}-\d{2}\.json$/,
    metric: METRIC.HR_ZONES,
    source: 'global/hrZones',
    parser: 'hrZonesJson',
    phase: INGEST_PHASE.WINDOWS,
  },
  {
    re: /^Daily Readiness\/Daily Readiness Score - [^/]+\.csv$/,
    metric: METRIC.READINESS,
    source: 'readiness',
    parser: 'readinessCsv',
    phase: INGEST_PHASE.WINDOWS,
  },
  {
    re: /^Stress Score\/Stress Score\.csv$/,
    metric: METRIC.STRESS,
    source: 'stress',
    parser: 'stressCsv',
    phase: INGEST_PHASE.WINDOWS,
  },
  {
    re: /^Heart Rate Variability\/Daily Heart Rate Variability Summary - [^/]+\.csv$/,
    metric: METRIC.HRV_SUMMARY,
    source: 'hrvSummary',
    parser: 'hrvSummaryCsv',
    phase: INGEST_PHASE.WINDOWS,
  },
  {
    re: /^Heart Rate Variability\/Daily Respiratory Rate Summary - [^/]+\.csv$/,
    metric: METRIC.RESP_RATE_DAILY,
    source: 'respRateDaily',
    parser: 'respRateDailyCsv',
    phase: INGEST_PHASE.WINDOWS,
  },
  {
    re: /^Heart Rate Variability\/Respiratory Rate Summary - [^/]+\.csv$/,
    metric: METRIC.RESP_RATE_STAGE,
    source: 'respRateStage',
    parser: 'respRateStageCsv',
    phase: INGEST_PHASE.WINDOWS,
  },
  {
    re: /^Active Zone Minutes \(AZM\)\/Active Zone Minutes - [^/]+\.csv$/,
    metric: METRIC.AZM,
    source: 'azm',
    parser: 'azmCsv',
    phase: INGEST_PHASE.WINDOWS,
  },
  {
    re: /^Global Export Data\/steps-\d{4}-\d{2}-\d{2}\.json$/,
    metric: METRIC.STEPS,
    source: 'global/steps',
    parser: 'dailyActivityJson',
    phase: INGEST_PHASE.WINDOWS,
  },
  {
    re: /^Global Export Data\/(?:very|moderately|lightly)_active_minutes-\d{4}-\d{2}-\d{2}\.json$/,
    metric: METRIC.ACTIVE_MINUTES,
    source: 'global/activeMinutes',
    parser: 'dailyActivityJson',
    phase: INGEST_PHASE.WINDOWS,
  },
  {
    re: /^Temperature\/Computed Temperature - [^/]+\.csv$/,
    metric: METRIC.TEMPERATURE,
    source: 'temperature',
    parser: 'temperatureCsv',
    phase: INGEST_PHASE.WINDOWS,
  },
  {
    re: /^Oxygen Saturation \(SpO2\)\/Daily SpO2 - [^/]+\.csv$/,
    metric: METRIC.SPO2_DAILY,
    source: 'spo2Daily',
    parser: 'spo2DailyCsv',
    phase: INGEST_PHASE.WINDOWS,
  },

  // --- Phase B: high-frequency series (per-metric, evicted per night) ---
  {
    re: /^Oxygen Saturation \(SpO2\)\/Minute SpO2 - [^/]+\.csv$/,
    metric: METRIC.SPO2_MINUTE,
    source: 'spo2Minute',
    parser: 'minuteSpo2Csv',
    phase: INGEST_PHASE.HIGH_FREQ,
  },
  {
    re: /^Heart Rate Variability\/Heart Rate Variability Details - [^/]+\.csv$/,
    metric: METRIC.HRV_DETAILS,
    source: 'hrvDetails',
    parser: 'hrvDetailsCsv',
    phase: INGEST_PHASE.HIGH_FREQ,
  },
  {
    re: /^Snore and Noise Detect\/Snore Details - [^/]+\.csv$/,
    metric: METRIC.SNORE,
    source: 'snore',
    parser: 'snoreCsv',
    phase: INGEST_PHASE.HIGH_FREQ,
  },
  {
    re: /^Global Export Data\/heart_rate-\d{4}-\d{2}-\d{2}\.json$/,
    metric: METRIC.HR,
    source: 'global/heartRate',
    parser: 'heartRateJson',
    phase: INGEST_PHASE.HIGH_FREQ,
  },
];

/**
 * Classification result.
 * @enum {string}
 */
export const CLASSIFICATION = {
  ALLOWED: 'allowed',
  DENIED: 'denied',
  IGNORED: 'ignored',
};

/**
 * Whether a directory (given its relative path WITH a trailing slash) is on the
 * denylist and must be pruned WITHOUT descending. Used by the enumerator so
 * denied subtrees are never even listed.
 *
 * @param {string} relDirPath - Directory relative path, e.g. `'Your Profile/'`.
 * @param {object} [opts]
 * @param {boolean} [opts.menstrualOptIn=false] - When false, Menstrual Health is pruned.
 * @returns {boolean} `true` if the directory must not be descended.
 */
export function isDeniedDir(relDirPath, { menstrualOptIn = false } = {}) {
  if (typeof relDirPath !== 'string' || relDirPath.length === 0) return false;
  const withSlash = relDirPath.endsWith('/') ? relDirPath : relDirPath + '/';
  if (!menstrualOptIn && withSlash.startsWith(MENSTRUAL_PREFIX)) return true;
  if (DENY_DIR_PREFIXES.some((re) => re.test(withSlash))) return true;
  // A denied file pattern anchored to a dir (e.g. a GoogleData GPS subdir).
  return DENY_FILE_PATTERNS.some((re) => re.test(withSlash));
}

/**
 * Classify a file's relative path. Denylist wins over allowlist; default-deny.
 *
 * @param {string} relPath - File relative path from the export root (POSIX `/`).
 * @param {object} [opts]
 * @param {boolean} [opts.menstrualOptIn=false] - Gate for Menstrual Health files.
 * @returns {'allowed'|'denied'|'ignored'} The classification.
 */
export function classify(relPath, { menstrualOptIn = false } = {}) {
  if (typeof relPath !== 'string' || relPath.length === 0) {
    return CLASSIFICATION.IGNORED;
  }
  // Normalize any backslashes / leading slash defensively (no path traversal).
  const rel = relPath.replace(/\\/g, '/').replace(/^\/+/, '');

  // Menstrual health: opt-in gate.
  if (rel.startsWith(MENSTRUAL_PREFIX)) {
    return menstrualOptIn ? maybeAllow(rel) : CLASSIFICATION.DENIED;
  }
  // Denylist (dirs + file patterns) — hard stop, checked first.
  if (DENY_DIR_PREFIXES.some((re) => re.test(rel))) {
    return CLASSIFICATION.DENIED;
  }
  if (DENY_FILE_PATTERNS.some((re) => re.test(rel))) {
    return CLASSIFICATION.DENIED;
  }
  return maybeAllow(rel);
}

/** @private allowlist lookup → 'allowed' | 'ignored'. */
function maybeAllow(rel) {
  return ALLOWLIST.some((entry) => entry.re.test(rel))
    ? CLASSIFICATION.ALLOWED
    : CLASSIFICATION.IGNORED;
}

/**
 * Return the `{ metric, source, parser, phase }` descriptor for an allowlisted
 * path, or `null` if the path is not allowlisted.
 *
 * @param {string} relPath - File relative path.
 * @param {object} [opts]
 * @param {boolean} [opts.menstrualOptIn=false]
 * @returns {{ metric: string, source: string, parser: string, phase: string }|null}
 */
export function describeFile(relPath, { menstrualOptIn = false } = {}) {
  if (typeof relPath !== 'string' || relPath.length === 0) return null;
  const rel = relPath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (classify(rel, { menstrualOptIn }) !== CLASSIFICATION.ALLOWED) return null;
  const entry = ALLOWLIST.find((e) => e.re.test(rel));
  if (!entry) return null;
  return {
    metric: entry.metric,
    source: entry.source,
    parser: entry.parser,
    phase: entry.phase,
  };
}
