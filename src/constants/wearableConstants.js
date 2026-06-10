/**
 * Wearable correlation constants — physiological validation ranges, temporal
 * alignment, statistical thresholds, chart layout, and the Phase-2 ingestion
 * engine knobs.
 *
 * The Fitbit OAuth/API era constants (endpoints, scopes, rate limits, sync
 * config, connection status, error codes) were removed with the OAuth
 * integration; only data-model / correlation / chart constants remain.
 *
 * @module constants/wearableConstants
 */

/**
 * Physiological validation constants for wearable data.
 *
 * Based on established clinical ranges for healthy adults and sleep apnea
 * patients. Used for data quality validation and outlier detection in the
 * wearable↔CPAP correlation analysis.
 */

/** Heart Rate Validation (BPM) */
export const HR_RESTING_MIN = 40; // Bradycardia threshold
export const HR_RESTING_MAX = 100; // Tachycardia threshold
export const HR_SLEEP_MIN = 35; // Minimum during sleep
export const HR_SLEEP_MAX = 80; // Maximum normal sleep HR
export const HR_ABSOLUTE_MAX = 220; // Physiological maximum
export const HR_SLEEP_DISORDER_MAX = 120; // Upper bound for sleep disorders

/** SpO2 (Oxygen Saturation) Validation (%) */
export const SPO2_NORMAL_MIN = 95; // Normal lower bound
export const SPO2_NORMAL_MAX = 100; // Perfect saturation
export const SPO2_MILD_HYPOXEMIA = 90; // Mild hypoxemia threshold
export const SPO2_SEVERE_HYPOXEMIA = 85; // Severe hypoxemia threshold
export const SPO2_CRITICAL_MIN = 70; // Critical threshold (flag as suspicious)

/** HRV (Heart Rate Variability) Validation (ms) */
export const HRV_YOUNG_ADULT_MIN = 30; // Young adults (20-35)
export const HRV_YOUNG_ADULT_MAX = 50;
export const HRV_MIDDLE_AGE_MIN = 20; // Middle age (35-55)
export const HRV_MIDDLE_AGE_MAX = 40;
export const HRV_OLDER_ADULT_MIN = 15; // Older adults (55+)
export const HRV_OLDER_ADULT_MAX = 30;
export const HRV_SLEEP_APNEA_TYPICAL = 20; // Often below this in OSA patients
export const HRV_ABSOLUTE_MIN = 5; // Below this suggests measurement error
export const HRV_ABSOLUTE_MAX = 100; // Above this suggests measurement error

/** Sleep Architecture Validation (%) */
export const SLEEP_LIGHT_MIN = 35; // Light sleep percentage
export const SLEEP_LIGHT_MAX = 65;
export const SLEEP_DEEP_MIN = 10; // Deep sleep percentage
export const SLEEP_DEEP_MAX = 30;
export const SLEEP_REM_MIN = 15; // REM sleep percentage
export const SLEEP_REM_MAX = 30;
export const SLEEP_WAKE_MAX = 10; // Wake percentage (good efficiency)
export const SLEEP_EFFICIENCY_MIN = 85; // Sleep efficiency percentage

/** Respiratory Rate Validation (breaths/min) */
export const RESP_RATE_MIN = 8; // Bradypnea threshold
export const RESP_RATE_MAX = 25; // Tachypnea threshold
export const RESP_RATE_SLEEP_MIN = 6; // Minimum during sleep
export const RESP_RATE_SLEEP_MAX = 20; // Maximum during sleep

/** Sleep Duration Validation (hours) */
export const SLEEP_DURATION_MIN = 3; // Minimum for valid analysis
export const SLEEP_DURATION_MAX = 12; // Maximum reasonable duration
export const SLEEP_ONSET_MAX_MIN = 60; // Maximum sleep onset latency (minutes)

/** Temporal Alignment Constants */
export const MIN_OVERLAP_HOURS = 4; // Minimum OSCAR-wearable overlap for valid night

/** Statistical Significance Levels */
export const SIGNIFICANCE_LEVELS = {
  P_001: 0.001, // Highly significant
  P_01: 0.01, // Very significant
  P_05: 0.05, // Significant
  P_10: 0.1, // Marginally significant
};

/** Correlation Analysis Thresholds */
export const CORRELATION_THRESHOLDS = {
  WEAK: 0.3, // Weak correlation
  MODERATE: 0.5, // Moderate correlation
  STRONG: 0.7, // Strong correlation
  VERY_STRONG: 0.9, // Very strong correlation
};

/** Chart Layout Constants */
export const SCATTER_PLOT_HEIGHT = 400;
export const DUAL_AXIS_CHART_HEIGHT = 500; // Height for dual-axis sync charts
export const CORRELATION_MATRIX_HEIGHT = 450; // Height for correlation matrix heatmaps

export const CORRELATION_CHART_MARGINS = {
  DEFAULT: { top: 20, right: 40, bottom: 60, left: 60 },
  DUAL_AXIS: { top: 20, right: 80, bottom: 60, left: 60 },
  COMPACT: { top: 15, right: 30, bottom: 45, left: 45 },
};

/** Data Validation Limits */
export const DATA_LIMITS = {
  MIN_NIGHTS_FOR_ANALYSIS: 7, // Minimum nights of data needed
  MAX_MISSING_DATA_RATIO: 0.3, // Maximum 30% missing data allowed
  MIN_CORRELATION_SAMPLE_SIZE: 10, // Minimum sample size for correlation
};

/* ===========================================================================
 * Wearable-export ingestion engine (Phase 2) — data-model & correlation spec
 * See docs/developer/reports/2026-06-wearable-export-planning/design/data-model-and-correlation.md.
 * Every constant below is documented for tuning and feeds the ADR.
 * =========================================================================== */

/**
 * Per-metric minimum-coverage gates (§2.8). A metric present but below its gate
 * is reported as `null` PLUS an entry in `coverage.insufficient[]` (the
 * "insufficient" vs "absent" contract, §2.9).
 */
export const WEARABLE_COVERAGE = {
  /** SpO2: ≥2h valid gives stable percentiles; below that min/pctBelow are noisy. */
  MIN_SPO2_VALID_MIN: 120,
  /** Sleeping HR: ~5 min at older 1/s-ish cadence; permissive for classic-era nights. */
  MIN_HR_SAMPLES: 300,
  /** HRV: <50% window coverage → unreliable nightly RMSSD. */
  MIN_HRV_COVERAGE: 0.5,
  /** Snore: shorter windows over-/under-state snore%. */
  MIN_SNORE_EPOCHS: 120,
  /** Sleep night validity: matches existing SLEEP_DURATION_MIN (3h). */
  MIN_ASLEEP_MIN: 180,
};

/** The SpO2 sentinel value (catalog §4.3). Minutes equal to this are dropped. */
export const SPO2_SENTINEL_VALUE = 50.0;
/** SpO2 desaturation thresholds for %-time-below computations (§1.2). */
export const SPO2_DESAT_THRESHOLD_90 = 90;
export const SPO2_DESAT_THRESHOLD_88 = 88;
/** Any non-sentinel value at/below this in [1,70) is a data-quality red flag (§2.1). */
export const SPO2_SUBSEVENTY_FLOOR = 70;

/** Robust percentile constants (avoid magic numbers in aggregators). */
export const PCT_MEDIAN = 0.5;
export const PCT_P5 = 0.05;
export const PCT_P10 = 0.1;

/**
 * UTC-offset inference (§3.2.4). Window-fit inference is the PRIMARY resolver;
 * UserSleeps start_utc_offset is an untrusted hint only.
 */
export const OFFSET_INFERENCE = {
  /** ±14h covers all real IANA offsets incl. DST extremes. */
  SEARCH_MIN: -840,
  SEARCH_MAX: 840,
  /** Fitbit offsets are whole 15-min multiples; matches empirical rounding. */
  SEARCH_STEP: 15,
  /** Below this a single night's UTC series is too sparse to localize. */
  MIN_INFER_SAMPLES: 30,
  /** Require ≥50% of the night's UTC samples inside the window to trust inference. */
  MIN_INFER_FRAC: 0.5,
  /** Cap carry-forward span to avoid riding through an uncovered DST/travel boundary. */
  MAX_CARRY_NIGHTS: 2,
  /** Hint discarded if it differs from inference by ≥ this many minutes. */
  DISAGREEMENT_MIN: 15,
  /** UserSleeps placeholder offset — always treated as missing. */
  PLACEHOLDER_OFFSET_MIN: 0,
  /** Neighborhood (hours) around a nightKey to gather candidate UTC samples. */
  SAMPLE_NEIGHBORHOOD_HOURS: 18,
  /** Last-resort configured default offset (US-Pacific standard), §6 open decision. */
  DEFAULT_OFFSET_MIN: -480,
};

/** Provenance values for window.utcOffsetMinutes (§1.0, §3.2). */
export const WINDOW_SOURCE = {
  INFERRED: 'inferred',
  USERSLEEPS_HINT: 'userSleeps-hint',
  CARRY_FORWARD: 'carry-forward',
  DEFAULT_FALLBACK: 'default-fallback',
};

/** Alignment / duration-mismatch thresholds (§3.3–3.4). */
export const ALIGNMENT = {
  /** ±1-day reconciliation: a shifted match needs this much overlap (existing MIN_OVERLAP_HOURS). */
  MIN_OVERLAP_HOURS: MIN_OVERLAP_HOURS,
  /** Flag (not exclude) when |usageHours − asleepMin/60| exceeds this. */
  DURATION_MISMATCH_FLAG_HOURS: 2,
};

/** Correlation engine knobs (§4). */
export const CORRELATION_ENGINE = {
  /** Heavy-tie detection: switch to permutation p when any value's multiplicity exceeds this fraction of n. */
  HEAVY_TIE_FRACTION: 0.2,
  /** Permutation replicate count for tie-aware p. */
  PERMUTATION_B: 2000,
  /** Lag-1 autocorrelation above this triggers the serial-correlation warning. */
  SERIAL_WARN_R1: 0.3,
  /** Moving-block bootstrap block length (~1 week respects weekly structure). */
  BLOCK_LEN: 7,
  /** Max lag for the DESCRIPTIVE lag profile (lag-0 is the sole inferential point). */
  MAX_LAG_NIGHTS: 7,
  /** BH q for the frozen primary family. */
  Q_PRIMARY: 0.05,
  /** BH q for the exploratory family (clearly labeled "exploratory only"). */
  Q_EXPLORATORY: 0.1,
  /** Gross wrong-sign tripwire fires only when |ρ| ≥ this and pAdj < 0.05 (§4.7). */
  GROSS_WRONG_SIGN_RHO: 0.5,
  /** Coverage-selection / offset-provenance share above which attenuation-risk is raised (§4.7). */
  ATTENUATION_SHARE: 0.3,
  NON_INFERRED_SHARE: 0.2,
  /** Relaxed-gate sensitivity: |Δρ| beyond this is flagged coverage-sensitive (§4.6a). */
  SENSITIVITY_DELTA: 0.1,
  /** Relaxed SpO2 gate used for the sensitivity recompute. */
  RELAXED_SPO2_VALID_MIN: 60,
  /** Pinned group-contrast thresholds (data-scientist-owned, NOT user sliders, §4.4). */
  HIGH_AHI: 15,
  LOW_AHI: 5,
  ADHERENT_HOURS: 4,
};

/** Effect-size bands (Cohen-style, for interpretation only — never a sig gate, §4.7). */
export const EFFECT_BANDS = {
  SMALL: 0.1,
  MEDIUM: 0.3,
  LARGE: 0.5,
};

/** Frozen pre-registered pair-list version, emitted in engine output (§4.1, §4.9). */
export const PAIR_REGISTRY_VERSION = 'v1';
