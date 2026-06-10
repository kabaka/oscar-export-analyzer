import { useMemo } from 'react';
import { alignWearableToOscar } from '../utils/wearable/alignment.js';
import { runCorrelationEngine } from '../utils/wearable/correlationEngine.js';

/**
 * Runs the Phase-2 wearable↔CPAP correlation engine over the persisted nightly
 * rollups and the OSCAR summary rows (integration §3.1a, F7).
 *
 * The persisted `wearable_nights` rollups (from `useWearableData`) already carry
 * `nightKey` + the unified metric blocks (`sleep`, `spo2`, `hr`, `hrv`, ...), so
 * they feed `alignWearableToOscar` directly — there is no API-shape adapter and
 * no `T12:00:00` noon hack. The OSCAR rows are the raw `filteredSummary` CSV
 * rows; `alignWearableToOscar` parses them via `parseOscarSummaryRow`.
 *
 * Pure `useMemo` — recomputes only when either input array changes.
 *
 * @param {object} args
 * @param {object[]} args.oscarRows - `filteredSummary` rows (with `Date`/`AHI`/…).
 * @param {object[]} args.nights - Wearable nightly rollups.
 * @returns {{ aligned: object[], correlation: object|null, hasResult: boolean }}
 */
export function useWearableCorrelation({ oscarRows, nights } = {}) {
  return useMemo(() => {
    const hasOscar = Array.isArray(oscarRows) && oscarRows.length > 0;
    const hasNights = Array.isArray(nights) && nights.length > 0;
    if (!hasOscar || !hasNights) {
      return { aligned: [], correlation: null, hasResult: false };
    }
    try {
      const { aligned } = alignWearableToOscar(oscarRows, nights);
      const correlation = runCorrelationEngine(aligned);
      return { aligned, correlation, hasResult: true };
    } catch {
      // Alignment/engine failure should never break the CPAP view.
      return { aligned: [], correlation: null, hasResult: false };
    }
  }, [oscarRows, nights]);
}

export default useWearableCorrelation;
