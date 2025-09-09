/**
 * Global configuration constants for the OSCAR Export Analyzer.
 * Each value is documented with units to aid maintenance.
 */

/**
 * Additional time window checked before and after an apnea cluster to ensure
 * no annotated events occur nearby. Measured in milliseconds.
 */
export const EVENT_WINDOW_MS = 5000;

/**
 * Number of evenly spaced sample points used when generating LOESS trend
 * lines in charts. Unitless count.
 */
export const LOESS_SAMPLE_STEPS = 60;
