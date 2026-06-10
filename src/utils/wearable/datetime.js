/**
 * Multi-format datetime parser for the Google Health (Fitbit) export
 * (catalog §4 gotcha #1). Different sources stamp time in incompatible formats;
 * this module exposes a small per-source format map and the primitive parsers,
 * returning **epoch milliseconds** (numbers) so values cross the worker→main
 * structured-clone boundary cleanly (csv.worker.js convention).
 *
 * Two reference frames the rest of the pipeline depends on:
 *   - **Naive-local** (no offset): `MM/DD/YY HH:MM:SS` and ISO-without-`Z`.
 *     Parsed as *wall-clock* time (fields read literally, treated as if UTC) so
 *     downstream window math in `offsetInference` is offset-free.
 *   - **UTC** (`...Z`): real instants; parsed as true UTC ms.
 *
 * Epoch-1970 placeholder timestamps (catalog §4.5) are rejected via a sane
 * lower-bound year so junk row-keys never become real dates. Every parser
 * returns `NaN` on bad input — **never throws** — so a malformed row is skipped
 * and counted, never aborting a file.
 *
 * Pure module — no DOM / worker / IndexedDB.
 *
 * @module utils/wearable/datetime
 */

/** Earliest plausible real timestamp (year ≥ this). Rejects 1970 placeholders. */
const MIN_VALID_YEAR = 2000;
const MS_PER_SECOND = 1000;

/** @private reject epoch-1970-ish / pre-2000 instants. */
function rejectIfTooOld(ms) {
  if (!Number.isFinite(ms)) return NaN;
  // new Date(ms).getUTCFullYear() without constructing twice.
  const year = new Date(ms).getUTCFullYear();
  return year >= MIN_VALID_YEAR ? ms : NaN;
}

/**
 * Parse `MM/DD/YY HH:MM:SS` (Global Export Data JSON intraday / zones / RHR).
 * Two-digit year → 2000-pivoted. Treated as **naive-local wall-clock** (no TZ),
 * returned as wall-clock ms (fields as-if-UTC).
 *
 * @param {string} s - e.g. `'01/01/24 08:00:06'`.
 * @returns {number} Wall-clock epoch ms, or `NaN`.
 */
export function parseMmDdYy(s) {
  if (typeof s !== 'string') return NaN;
  const m = s.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{2}(?:\d{2})?)[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/,
  );
  if (!m) return NaN;
  let [, mo, d, y, h, mi, sec] = m;
  let year = Number(y);
  if (y.length === 2) year += 2000; // 2000-pivot (export spans 2014–2026)
  const ms = Date.UTC(
    year,
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(sec ?? 0),
  );
  return rejectIfTooOld(ms);
}

/**
 * Parse `MM/DD/YY` (date only, e.g. nested RHR `value.date`). Midnight wall-clock.
 *
 * @param {string} s - e.g. `'01/01/24'`.
 * @returns {number} Wall-clock epoch ms at 00:00, or `NaN`.
 */
export function parseMmDdYyDate(s) {
  if (typeof s !== 'string') return NaN;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}(?:\d{2})?)$/);
  if (!m) return NaN;
  let [, mo, d, y] = m;
  let year = Number(y);
  if (y.length === 2) year += 2000;
  return rejectIfTooOld(Date.UTC(year, Number(mo) - 1, Number(d)));
}

/**
 * Parse an ISO-8601 timestamp WITHOUT a `Z`/offset (sleep-*.json, HRV/Snore/AZM
 * CSVs) as **naive-local wall-clock** ms (fields read literally). If the string
 * carries a `Z` or offset it is stripped first — callers that want true UTC use
 * {@link parseIsoUtc} instead.
 *
 * @param {string} s - e.g. `'2024-02-22T07:41:30.000'`.
 * @returns {number} Wall-clock epoch ms, or `NaN`.
 */
export function parseIsoNaive(s) {
  if (typeof s !== 'string') return NaN;
  const stripped = s.replace(/(Z|[+-]\d{2}:?\d{2})$/, '');
  const m = stripped.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d+))?/,
  );
  if (!m) return NaN;
  const [, y, mo, d, h, mi, sec, frac] = m;
  const ms = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(sec ?? 0),
    frac ? Number(frac.slice(0, 3).padEnd(3, '0')) : 0,
  );
  return rejectIfTooOld(ms);
}

/**
 * Parse an ISO-8601 timestamp WITH `Z` or an explicit offset (SpO2 minute CSVs,
 * all GoogleData CSVs, HR notifications) as a **true UTC instant**.
 *
 * @param {string} s - e.g. `'2024-02-22T07:41:30Z'` or `'...-08:00'`.
 * @returns {number} True UTC epoch ms, or `NaN`.
 */
export function parseIsoUtc(s) {
  if (typeof s !== 'string') return NaN;
  // Require a Z or explicit offset to be a true instant; else NaN.
  if (!/(Z|[+-]\d{2}:?\d{2})$/.test(s.trim())) return NaN;
  const t = Date.parse(s);
  return rejectIfTooOld(t);
}

/**
 * Parse Unix epoch **seconds** (Mindfulness EDA). Multiplies to ms.
 *
 * @param {string|number} s - e.g. `1601501667`.
 * @returns {number} Epoch ms, or `NaN`.
 */
export function parseEpochSeconds(s) {
  const n = Number(s);
  if (!Number.isFinite(n)) return NaN;
  return rejectIfTooOld(n * MS_PER_SECOND);
}

/**
 * Per-source datetime parser keys (catalog §4 format map). The worker selects a
 * parser by the file's source descriptor; this map keeps the format knowledge in
 * one auditable place.
 * @type {Record<string, (s: string) => number>}
 */
export const DATETIME_PARSERS = {
  mmddyy: parseMmDdYy,
  mmddyyDate: parseMmDdYyDate,
  isoNaive: parseIsoNaive,
  isoUtc: parseIsoUtc,
  epochSeconds: parseEpochSeconds,
};

/**
 * Extract a `YYYY-MM-DD` calendar-date key from wall-clock ms (UTC fields).
 *
 * @param {number} wallMs - Wall-clock epoch ms (from a naive parser).
 * @returns {string|null} `'YYYY-MM-DD'`, or `null` if not finite.
 */
export function dateKeyFromWallMs(wallMs) {
  if (!Number.isFinite(wallMs)) return null;
  const d = new Date(wallMs);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`;
}

/**
 * Parse a `±HH:MM` / `±HHMM` UTC-offset string (UserSleeps `start_utc_offset`)
 * into MINUTES east of UTC. `'+00:00'` parses to `0` (the placeholder the offset
 * resolver treats as missing).
 *
 * @param {string} s - e.g. `'-07:00'`, `'+00:00'`.
 * @returns {number} Minutes east of UTC, or `NaN`.
 */
export function parseUtcOffsetMinutes(s) {
  if (typeof s !== 'string') return NaN;
  const m = s.trim().match(/^([+-])(\d{2}):?(\d{2})$/);
  if (!m) return NaN;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3]));
}
