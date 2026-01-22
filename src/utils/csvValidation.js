/**
 * CSV Header Validation Utilities
 *
 * Validates that OSCAR CSV exports contain required columns before processing.
 * Uses strict case-sensitive exact matching as per @data-scientist specification.
 */

/**
 * Validates summary CSV headers against required columns.
 * Summary files must contain: Date, AHI, Median EPAP, Total Time
 *
 * @param {string[]} headers - Array of header column names from CSV
 * @returns {{ valid: boolean, error?: string, found?: string[] }} Validation result
 */
export function validateSummaryHeaders(headers) {
  const required = ['Date', 'AHI', 'Median EPAP', 'Total Time'];
  const missing = required.filter((col) => !headers.includes(col));

  if (missing.length > 0) {
    return {
      valid: false,
      error: `Missing required columns: ${missing.join(', ')}`,
      found: headers,
    };
  }

  return { valid: true };
}

/**
 * Validates details CSV headers against required columns.
 * Details files must contain: Event, DateTime, Data/Duration
 *
 * @param {string[]} headers - Array of header column names from CSV
 * @returns {{ valid: boolean, error?: string, found?: string[] }} Validation result
 */
export function validateDetailsHeaders(headers) {
  const required = ['Event', 'DateTime', 'Data/Duration'];
  const missing = required.filter((col) => !headers.includes(col));

  if (missing.length > 0) {
    return {
      valid: false,
      error: `Missing required columns: ${missing.join(', ')}`,
      found: headers,
    };
  }

  return { valid: true };
}
