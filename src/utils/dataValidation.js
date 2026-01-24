import { EPAP_MIN, EPAP_MAX } from '../constants.js';

/**
 * Validates EPAP value against therapeutic range and logs warnings for suspicious values.
 *
 * **Medical Context:**
 * EPAP (Expiratory Positive Airway Pressure) is the minimum pressure delivered during
 * exhalation by BiPAP/VPAP devices. Therapeutic range: 4-25 cmH₂O.
 *
 * Values outside this range suggest:
 * - Device sensor error or calibration issue
 * - CSV data corruption during export
 * - Manual entry error if data was transcribed
 *
 * **Statistical Impact:**
 * Out-of-range values may affect:
 * - Mann-Whitney U tests comparing EPAP groups
 * - Pearson correlation between EPAP and AHI
 * - Outlier detection using IQR method
 *
 * **Non-blocking Validation:**
 * This function logs warnings but returns the original value unchanged.
 * Statistical analyses still use flagged values unless manually excluded.
 *
 * @param {number} epap - EPAP value in cmH₂O from 'Median EPAP' column
 * @param {Object} [context={}] - Optional context for detailed warning messages
 * @param {string} [context.date] - Date of the reading (ISO 8601 format preferred)
 * @param {number} [context.row] - Row number in CSV file (1-indexed)
 * @returns {number} - Original EPAP value (unchanged, for chaining operations)
 *
 * @example
 * // Basic validation
 * const epap = validateEPAP(8.5); // No warning, returns 8.5
 *
 * @example
 * // With context for detailed warnings
 * const suspiciousEpap = validateEPAP(3.2, { date: '2024-01-15', row: 47 });
 * // Logs: "Suspicious EPAP value: 3.2 cmH₂O (typical range: 4-25) [Date: 2024-01-15, Row: 47]"
 *
 * @example
 * // Handles non-finite values gracefully
 * validateEPAP(NaN); // No warning, returns NaN (filtered elsewhere)
 */
export function validateEPAP(epap, context = {}) {
  // Skip validation for non-finite values (NaN, Infinity)
  // These are typically filtered out in statistical functions
  if (!Number.isFinite(epap)) {
    return epap;
  }

  // Check against therapeutic range
  if (epap < EPAP_MIN || epap > EPAP_MAX) {
    // Build context string for warning message
    const contextParts = [];
    if (context.date) {
      contextParts.push(`Date: ${context.date}`);
    }
    if (context.row) {
      contextParts.push(`Row: ${context.row}`);
    }
    const contextStr =
      contextParts.length > 0 ? ` [${contextParts.join(', ')}]` : '';

    console.warn(
      `Suspicious EPAP value: ${epap.toFixed(1)} cmH₂O (typical range: ${EPAP_MIN}-${EPAP_MAX})${contextStr}`,
    );
  }

  return epap;
}
