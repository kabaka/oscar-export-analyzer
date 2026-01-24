/* eslint-disable no-magic-numbers -- canonical test data constants for statistical test scenarios */

/**
 * Shared test constants for statistical test data.
 * Used across multiple test files to ensure consistent test scenarios
 * and reduce magic number warnings in test suites.
 */

/** Test data arrays for series operations (e.g., autocorrelation tests) */
export const TEST_SERIES_SMALL = Object.freeze([2, 3, 4, 5, 6]);
export const TEST_SERIES_MEDIUM = Object.freeze([2, 3, 4, 5, 6, 7]);
export const TEST_SERIES_WITH_NEGATIVES = Object.freeze([2, 3, 4, 5, 6]);

/** Time-based test constants (milliseconds and event durations) */
export const TEST_EVENT_DURATION_MS = 1000;
export const TEST_DURATION_SHORT_MS = 500;
export const TEST_DURATION_MEDIUM_MS = 60000; // 1 minute
export const TEST_DURATION_LONG_MS = 600000; // 10 minutes
export const TEST_SAMPLING_INTERVAL_MS = 10;
export const TEST_WINDOW_SIZE_SEC = 60;
export const TEST_WINDOW_SIZE_EXTENDED_SEC = 90;
export const TEST_WINDOW_SIZE_LONG_SEC = 120;

/** AHI and severity test values (events/hour) */
export const TEST_AHI_NORMAL = 5;
export const TEST_AHI_MILD = 15;
export const TEST_AHI_MODERATE = 30;
export const TEST_AHI_SEVERE_LOW = 55000;
export const TEST_AHI_SEVERE_MID = 70000;
export const TEST_AHI_SEVERE_HIGH = 80000;
export const TEST_AHI_EXTREME = 100000;

/** EPAP settings and pressure test values (cmH₂O) */
export const TEST_EPAP_LOW = 4;
export const TEST_EPAP_MEDIUM = 8;
export const TEST_EPAP_HIGH = 12;
export const TEST_EPAP_VERY_HIGH = 14;
export const TEST_EPAP_EXTREME = 20;

/** Out-of-range EPAP values for validation testing */
export const TEST_EPAP_BELOW_MIN = 3; // Below therapeutic minimum (4 cmH₂O)
export const TEST_EPAP_ABOVE_MAX = 30; // Above therapeutic maximum (25 cmH₂O)
export const TEST_EPAP_NEGATIVE = -2; // Device error scenario
export const TEST_EPAP_UNREALISTIC = 100; // Data corruption scenario

/** Usage duration test values (hours) */
export const TEST_USAGE_HOURS_LOW = 3;
export const TEST_USAGE_HOURS_MEDIUM = 5;
export const TEST_USAGE_HOURS_HIGH = 8;
export const TEST_USAGE_HOURS_EXTENDED = 10;

/** Leak rate test values (liters/minute) */
export const TEST_LEAK_LOW = 20;
export const TEST_LEAK_MEDIUM = 40;
export const TEST_LEAK_HIGH = 80;

/** Count-based test values for clustering and aggregation */
export const TEST_SAMPLE_COUNT_TINY = 2;
export const TEST_SAMPLE_COUNT_SMALL = 3;
export const TEST_SAMPLE_COUNT_MEDIUM = 4;
export const TEST_SAMPLE_COUNT_MEDIUM_LARGE = 5;
export const TEST_SAMPLE_COUNT_LARGE = 6;
export const TEST_CLUSTER_SIZE_SMALL = 10;
export const TEST_CLUSTER_SIZE_MEDIUM = 40;
export const TEST_CLUSTER_SIZE_LARGE = 60;

/** Quantile/percentile test levels */
export const TEST_QUANTILE_FIRST = 0.25;
export const TEST_QUANTILE_MEDIAN = 0.5;
export const TEST_QUANTILE_THIRD = 0.75;

/** Year reference for date-based tests */
export const TEST_REFERENCE_YEAR = 2021;

/** Commonly used date intervals for test scenarios */
export const TEST_DATE_INTERVAL_1_DAY_MS = 86400000;
export const TEST_DATE_INTERVAL_7_DAYS_MS = 604800000;
export const TEST_DATE_INTERVAL_30_DAYS_MS = 2592000000;
