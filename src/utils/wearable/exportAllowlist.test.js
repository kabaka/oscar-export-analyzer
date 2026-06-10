/**
 * Allowlist/denylist classifier tests (privacy-security §2; perf §2.2).
 *
 * The load-bearing assertions: the 38 MB out-of-scope `daily_heart_rate_zones.csv`
 * and PII/GPS/social dirs classify as IGNORED/DENIED, never ALLOWED; denied dirs
 * are pruned (not descended); allowlist matching is exact-anchored, not a loose
 * substring glob. Synthetic paths only — no real export data.
 */
import { describe, it, expect } from 'vitest';
import {
  classify,
  describeFile,
  isDeniedDir,
  CLASSIFICATION,
  METRIC,
  INGEST_PHASE,
} from './exportAllowlist.js';

describe('classify — allowlist (exact-anchored)', () => {
  const allowed = [
    ['Global Export Data/heart_rate-2024-02-22.json', METRIC.HR],
    [
      'Global Export Data/resting_heart_rate-2024-01-01.json',
      METRIC.RESTING_HR,
    ],
    [
      'Global Export Data/time_in_heart_rate_zones-2024-02-22.json',
      METRIC.HR_ZONES,
    ],
    ['Global Export Data/sleep-2024-02-22.json', METRIC.SLEEP],
    ['Global Export Data/steps-2024-02-22.json', METRIC.STEPS],
    [
      'Global Export Data/very_active_minutes-2024-02-22.json',
      METRIC.ACTIVE_MINUTES,
    ],
    [
      'Oxygen Saturation (SpO2)/Minute SpO2 - 2024-02-22.csv',
      METRIC.SPO2_MINUTE,
    ],
    [
      'Oxygen Saturation (SpO2)/Daily SpO2 - 2024-01-01-2024-04-10.csv',
      METRIC.SPO2_DAILY,
    ],
    [
      'Heart Rate Variability/Heart Rate Variability Details - 2024-02-22.csv',
      METRIC.HRV_DETAILS,
    ],
    [
      'Heart Rate Variability/Daily Heart Rate Variability Summary - 2020-11-(15).csv',
      METRIC.HRV_SUMMARY,
    ],
    [
      'Heart Rate Variability/Daily Respiratory Rate Summary - 2024-02-22.csv',
      METRIC.RESP_RATE_DAILY,
    ],
    ['Snore and Noise Detect/Snore Details - 2024-02-22.csv', METRIC.SNORE],
    [
      'Daily Readiness/Daily Readiness Score - 2024-02-01.csv',
      METRIC.READINESS,
    ],
    ['Stress Score/Stress Score.csv', METRIC.STRESS],
    ['Sleep Score/sleep_score.csv', METRIC.SLEEP_SCORE],
    ['Health Fitness Data_GoogleData/UserSleeps_0.csv', METRIC.USER_SLEEPS],
    [
      'Active Zone Minutes (AZM)/Active Zone Minutes - 2024-02-01.csv',
      METRIC.AZM,
    ],
    ['Temperature/Computed Temperature - 2024-02-22.csv', METRIC.TEMPERATURE],
  ];

  it.each(allowed)('allows %s', (path, metric) => {
    expect(classify(path)).toBe(CLASSIFICATION.ALLOWED);
    expect(describeFile(path)?.metric).toBe(metric);
  });
});

describe('classify — the daily_heart_rate_zones.csv must-not-match case', () => {
  it('classifies the 38 MB out-of-scope zones file as NOT allowed', () => {
    const path = 'Global Export Data/daily_heart_rate_zones.csv';
    // Explicitly denied (defense in depth) and never allowed.
    expect(classify(path)).not.toBe(CLASSIFICATION.ALLOWED);
    expect(describeFile(path)).toBeNull();
  });

  it('also rejects it under the GoogleData tree', () => {
    const path = 'Physical Activity_GoogleData/daily_heart_rate_zones.csv';
    expect(classify(path)).toBe(CLASSIFICATION.DENIED);
  });
});

describe('classify — denylist (PII / GPS / social / account)', () => {
  const denied = [
    'Your Profile/profile.csv',
    'Account/login_history.csv',
    'Security/two_factor.csv',
    'Social/friends.csv',
    'Fitbit Friends/list.csv',
    'Commerce/orders.csv',
    'Physical Activity_GoogleData/gps_location_2024-02-22.csv',
    'Physical Activity_GoogleData/live_pace_2024-02-22.csv',
    'Health Fitness Data_GoogleData/UserDemographicData.csv',
    'Health Fitness Data_GoogleData/UserProfileData.csv',
    'Health Fitness Data_GoogleData/MedicalRecords.csv',
    'Health Fitness Data_GoogleData/UserJournalEntries.csv',
  ];
  it.each(denied)('denies %s', (path) => {
    expect(classify(path)).toBe(CLASSIFICATION.DENIED);
    expect(describeFile(path)).toBeNull();
  });
});

describe('classify — out-of-scope duplicates ignored, not read', () => {
  const ignored = [
    'Physical Activity_GoogleData/heart_rate_2024-02-22.csv', // 2.2 GB duplicate tree
    'Global Export Data/estimated_oxygen_variation-2024-02-22.csv', // IR/Red ratio, not SpO2
    'Physical Activity_GoogleData/oxygen_saturation_2024-02-22.csv',
    'Biometrics/Glucose 2406.csv',
    'Global Export Data/calories-2024-02-22.json',
    'random_top_level_file.txt',
  ];
  it.each(ignored)('ignores %s', (path) => {
    expect(classify(path)).toBe(CLASSIFICATION.IGNORED);
  });
});

describe('isDeniedDir — pruned without descent', () => {
  it.each([
    'Your Profile/',
    'Account/',
    'Social/',
    'Commerce/',
    'Stress Journal/',
  ])('prunes %s', (dir) => {
    expect(isDeniedDir(dir)).toBe(true);
  });

  it('prunes Menstrual Health by default (opt-in gated)', () => {
    expect(isDeniedDir('Menstrual Health/')).toBe(true);
    expect(isDeniedDir('Menstrual Health/', { menstrualOptIn: true })).toBe(
      false,
    );
  });

  it('does not prune an allowed dir', () => {
    expect(isDeniedDir('Global Export Data/')).toBe(false);
    expect(isDeniedDir('Oxygen Saturation (SpO2)/')).toBe(false);
  });
});

describe('classify — menstrual opt-in gate', () => {
  it('denies menstrual files by default', () => {
    expect(classify('Menstrual Health/menstrual_health_cycles.csv')).toBe(
      CLASSIFICATION.DENIED,
    );
  });
});

describe('classify — adversarial inputs', () => {
  it('handles empty / non-string input', () => {
    expect(classify('')).toBe(CLASSIFICATION.IGNORED);
    expect(classify(null)).toBe(CLASSIFICATION.IGNORED);
    expect(classify(undefined)).toBe(CLASSIFICATION.IGNORED);
  });

  it('normalizes a leading slash without allowing traversal', () => {
    expect(classify('/Your Profile/profile.csv')).toBe(CLASSIFICATION.DENIED);
  });
});

describe('describeFile — phase + parser routing', () => {
  it('routes sleep to Phase A with the sleepJson parser', () => {
    const d = describeFile('Global Export Data/sleep-2024-02-22.json');
    expect(d.phase).toBe(INGEST_PHASE.WINDOWS);
    expect(d.parser).toBe('sleepJson');
  });
  it('routes HR to Phase B with the heartRateJson parser', () => {
    const d = describeFile('Global Export Data/heart_rate-2024-02-22.json');
    expect(d.phase).toBe(INGEST_PHASE.HIGH_FREQ);
    expect(d.parser).toBe('heartRateJson');
  });
});

describe('classify — adversarial hardening (ADR-0005 §3: traversal, case, nesting)', () => {
  // Path-traversal attempts must never escape into a denied/ignored allow.
  it.each([
    '../Your Profile/profile.csv',
    'Global Export Data/../Your Profile/profile.csv',
    'Oxygen Saturation (SpO2)/../../Account/login_history.csv',
  ])('never ALLOWS a traversal path: %s', (path) => {
    // The classifier does not collapse `..`; such a path must not match the
    // exact-anchored allowlist, so it can never be opened.
    expect(classify(path)).not.toBe(CLASSIFICATION.ALLOWED);
    expect(describeFile(path)).toBeNull();
  });

  it('backslash-normalized traversal still classifies the denied dir as DENIED', () => {
    // Windows-style separators are normalized to POSIX before matching.
    expect(classify('Your Profile\\profile.csv')).toBe(CLASSIFICATION.DENIED);
  });

  // A denied file pattern nested UNDER an allowed parent dir must still be denied
  // (denylist is checked before the allowlist).
  it.each([
    'Health Fitness Data_GoogleData/UserDemographicData.csv',
    'Global Export Data/gps_location_2024-02-22.csv',
    'Oxygen Saturation (SpO2)/daily_heart_rate_zones.csv',
  ])('denies a denied file under an allowed parent: %s', (path) => {
    expect(classify(path)).toBe(CLASSIFICATION.DENIED);
    expect(describeFile(path)).toBeNull();
  });

  // Case variants of a denied dir must NOT slip through as allowed/ignored. The
  // lists are case-sensitive by design (anchored to the observed export casing);
  // a renamed-casing dir must at worst UNDER-read (ignored), never ALLOW PII.
  it.each([
    'your profile/profile.csv',
    'ACCOUNT/login_history.csv',
    'Global Export Data/GPS_LOCATION_2024-02-22.csv',
  ])('never ALLOWS a case-variant of a denied path: %s', (path) => {
    expect(classify(path)).not.toBe(CLASSIFICATION.ALLOWED);
    expect(describeFile(path)).toBeNull();
  });

  // isDeniedDir must prune a denied subtree nested under an allowed-looking root.
  it('prunes a GoogleData GPS subdir without descending', () => {
    expect(isDeniedDir('Physical Activity_GoogleData/gps_location_x/')).toBe(
      true,
    );
  });

  // The single largest, parse-hostile file must be denied even under any parent.
  it.each([
    'daily_heart_rate_zones.csv',
    'Some Other Dir/daily_heart_rate_zones.csv',
  ])('denies the 38 MB pseudo-JSON zones file anywhere: %s', (path) => {
    expect(classify(path)).toBe(CLASSIFICATION.DENIED);
  });
});
