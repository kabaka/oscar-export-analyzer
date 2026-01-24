/* eslint-disable no-magic-numbers -- central constant registry */
import { DAYS_PER_WEEK, MILLISECONDS_PER_SECOND } from './constants/time.js';

export * from './constants/time.js';
export * from './constants/layout.js';
export * from './constants/cli.js';
export * from './constants/charts.js';
export * from './constants/ui.js';
export * from './constants/testData.js';

/**
 * Global configuration constants for the OSCAR Export Analyzer.
 * Each value is documented with units to aid maintenance.
 */

/** Utility multiplier for converting proportions to percentages. */
export const PERCENT_SCALE = 100;

/**
 * Additional time window checked before and after an apnea cluster to ensure
 * no annotated events occur nearby. Measured in milliseconds.
 */
export const EVENT_WINDOW_MS = 5 * MILLISECONDS_PER_SECOND;

/**
 * Number of evenly spaced sample points used when generating LOESS trend
 * lines in charts. Unitless count.
 */
export const LOESS_SAMPLE_STEPS = 60;

/** Numerical tolerances & statistical defaults */
export const NUMERIC_TOLERANCE = 1e-12;
export const QUARTILE_LOWER = 0.25;
export const QUARTILE_MEDIAN = 0.5;
export const QUARTILE_UPPER = 0.75;
export const PERCENTILE_95TH = 0.95;
export const IQR_OUTLIER_MULTIPLIER = 1.5;
export const FREEDMAN_DIACONIS_FACTOR = 2;
export const FREEDMAN_DIACONIS_EXPONENT = -1 / 3;
export const NORMAL_CONFIDENCE_Z = 1.96;

/** Rolling window defaults (days) */
export const ROLLING_WINDOW_SHORT_DAYS = DAYS_PER_WEEK;
export const ROLLING_WINDOW_LONG_DAYS = 30;
export const DEFAULT_ROLLING_WINDOWS = Object.freeze([
  ROLLING_WINDOW_SHORT_DAYS,
  ROLLING_WINDOW_LONG_DAYS,
]);

/** Lag limits for correlation diagnostics */
export const DEFAULT_MAX_LAG = 30;
export const MAX_LAG_INPUT = 120;
export const MIN_LAG_INPUT = 1;

/** STL decomposition defaults */
export const STL_SEASON_LENGTH = 7;

/** Usage/adherence thresholds (hours) */
export const USAGE_COMPLIANCE_THRESHOLD_HOURS = 4;
export const USAGE_STRICT_THRESHOLD_HOURS = 6;

/** AASM Diagnostic threshold for apnea events (seconds)
 * Reference: AASM Task Force (2012) - The AASM Manual for the Scoring of Sleep and Associated Events, Version 2.0
 * Per AASM guidelines, an apnea event is scored when airflow cessation persists for at least 10 seconds.
 * This threshold applies to diagnostic/clinical scoring.
 */
export const APNEA_DIAGNOSTIC_THRESHOLD_SEC = 10;

/** Clustering/analysis threshold for apnea event grouping (seconds)
 * This is NOT a diagnostic threshold. Used internally for clustering and analytical purposes.
 * Set to 30s to focus on longer, potentially more clinically significant events.
 * Reference: AASM Task Force (2012) - The AASM Manual for the Scoring of Sleep and Associated Events, Version 2.0
 */
export const APNEA_DURATION_THRESHOLD_SEC = 30;
export const APNEA_DURATION_HIGH_SEC = 60; // High-severity apnea event duration threshold for analysis

/** Minimum number of events required for a valid apnea cluster */
export const APNEA_CLUSTER_MIN_EVENTS = 3;

/** Cluster severity heuristics */
export const CLUSTER_DURATION_ALERT_SEC = 120;
export const CLUSTER_COUNT_ALERT = 5;

/** AHI severity bounds */
export const AHI_SEVERITY_LIMITS = Object.freeze({
  normal: 5,
  mild: 15,
  moderate: 30,
});

/** Central apnea fraction considered high (unitless proportion) */
export const HIGH_CENTRAL_APNEA_FRACTION = 0.6;

/** Change-point & breakpoint heuristics */
export const BREAKPOINT_MIN_DELTA = 0.75;
export const CHANGEPOINT_PENALTY = 10;
export const AHI_BREAKPOINT_MIN_DELTA = 0.5;
export const AHI_CHANGEPOINT_PENALTY = 6;
export const USAGE_CHANGEPOINT_PENALTY = 8;

/** Histogram defaults */
export const HISTOGRAM_FALLBACK_BINS = 12;

/** False-negative preset heuristics */
export const FALSE_NEG_STRICT_MIN_CONFIDENCE = 0.98;
export const FALSE_NEG_STRICT_MIN_DURATION_SEC = 120;
export const FALSE_NEG_STRICT_FALLBACK_FL_THRESHOLD = 0.9;
export const FALSE_NEG_BALANCED_MIN_DURATION_SEC = 60;
export const FALSE_NEG_LENIENT_MIN_CONFIDENCE = 0.85;
export const FALSE_NEG_LENIENT_MIN_DURATION_SEC = 45;
export const FALSE_NEG_LENIENT_BASE_FL_THRESHOLD = 0.5;
export const FALSE_NEG_LENIENT_BRIDGE_SCALE = 0.8;

/** EPAP comparison split (cmH₂O) */
export const EPAP_SPLIT_THRESHOLD = 7;

/**
 * EPAP (Expiratory Positive Airway Pressure) validation range (cmH₂O).
 * Reference: Typical therapeutic CPAP/BiPAP pressure ranges per manufacturer specifications
 * (ResMed AirSense 10: 4-20 cmH₂O, Philips DreamStation BiPAP: 4-25 cmH₂O).
 *
 * Values outside this range may indicate device error or data corruption.
 *
 * Clinical context:
 * - EPAP_MIN (4 cmH₂O): Minimum pressure for effective airway splinting
 * - EPAP_MAX (25 cmH₂O): Upper limit of typical therapeutic settings
 *
 * Note: EPAP_SPLIT_THRESHOLD (7 cmH₂O) is used for comparative analysis grouping,
 * not validation. These constants serve different purposes.
 */
export const EPAP_MIN = 4;
export const EPAP_MAX = 25;

/** Trend comparison window (nights) */
export const TREND_WINDOW_DAYS = 30;
