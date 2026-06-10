/**
 * Frozen, pre-registered correlation pair list (§4.1) + pinned group-contrast
 * thresholds (§4.4).
 *
 * This list is a VERSIONED CONSTANT, owned by data-scientist and frozen BEFORE
 * looking at the user's data (`PAIR_REGISTRY_VERSION`). Per-family
 * Benjamini-Hochberg (§4.4) is only defensible because the PRIMARY family is
 * fixed in advance. Reviewers should block edits to the primary list that lack
 * a documented rationale.
 *
 * ── PRE-REGISTERED — DO NOT EDIT TO CHASE SIGNIFICANCE. ──
 *
 * Single-subject caveat: with one user, "pre-registration" is weak; all findings
 * are hypothesis-generating, not confirmatory.
 *
 * Each pair carries an `expectedSign`, a `bandTag` ('lit' = literature-grounded
 * between-patient OSA physiology, 'heur' = heuristic/clinical-judgment), and a
 * `family` ('primary' = pre-registered core; 'exploratory'). Pairs with a
 * two-sided/uncertain sign (`twoSided: true`) are EXCLUDED from the gross
 * wrong-sign tripwire (§4.7).
 *
 * `x` keys index the AlignedNight `oscar` block; `y` keys are dotted paths into
 * the WearableNight (resolved by the engine's accessor).
 *
 * @module utils/wearable/pairRegistry
 */

import { PAIR_REGISTRY_VERSION } from '../../constants/wearableConstants.js';

export { PAIR_REGISTRY_VERSION };

/**
 * The frozen pair registry.
 * @type {ReadonlyArray<{id:number, x:string, y:string, expectedSign:('+'|'-'|'±'),
 *   band:[number,number], bandTag:('lit'|'heur'), family:('primary'|'exploratory'),
 *   twoSided?:boolean, rationale:string}>}
 */
export const PAIR_REGISTRY = Object.freeze([
  {
    id: 1,
    x: 'ahi',
    y: 'spo2.minPct',
    expectedSign: '-',
    band: [0.2, 0.5],
    bandTag: 'lit',
    family: 'primary',
    rationale: 'More apneas → deeper desaturations.',
  },
  {
    id: 2,
    x: 'ahi',
    y: 'spo2.pctTimeBelow90',
    expectedSign: '+',
    band: [0.2, 0.5],
    bandTag: 'lit',
    family: 'primary',
    rationale: 'Apnea burden ↔ hypoxic burden.',
  },
  {
    id: 3,
    x: 'ahi',
    y: 'hrv.rmssdMs',
    expectedSign: '-',
    band: [0.2, 0.5],
    bandTag: 'lit',
    family: 'primary',
    rationale: 'Apnea ↑ sympathetic tone, ↓ RMSSD.',
  },
  {
    id: 4,
    x: 'ahi',
    y: 'hr.sleepingAvgBpm',
    expectedSign: '+',
    band: [0.2, 0.5],
    bandTag: 'lit',
    family: 'primary',
    rationale: 'Apnea arousals raise sleeping HR.',
  },
  {
    id: 5,
    x: 'ahi',
    y: 'rr.nightlyBrpm',
    expectedSign: '±',
    band: [0.0, 0.3],
    bandTag: 'heur',
    family: 'exploratory',
    twoSided: true,
    rationale:
      'On treated nights RR is dominated by fitness/illness/anxiety; sign ~0 or negative. Excluded from wrong-sign tripwire.',
  },
  {
    id: 6,
    x: 'ahi',
    y: 'snore.snoreMinutes',
    expectedSign: '+',
    band: [0.2, 0.5],
    bandTag: 'lit',
    family: 'primary',
    rationale: 'Residual obstruction ↔ snoring.',
  },
  {
    id: 7,
    x: 'ahi',
    y: 'sleep.efficiencyPct',
    expectedSign: '-',
    band: [0.2, 0.4],
    bandTag: 'lit',
    family: 'primary',
    rationale: 'Apneas fragment sleep.',
  },
  {
    id: 8,
    x: 'medianEpap',
    y: 'spo2.minPct',
    expectedSign: '±',
    band: [0.0, 0.4],
    bandTag: 'heur',
    family: 'exploratory',
    twoSided: true,
    rationale:
      'EPAP titrated to severity — confounded by indication; negative ρ plausibly real. Excluded from wrong-sign tripwire.',
  },
  {
    id: 9,
    x: 'usageHours',
    y: 'readiness.score',
    expectedSign: '+',
    band: [0.1, 0.4],
    bandTag: 'heur',
    family: 'primary',
    rationale: 'Adherence ↔ next-day readiness.',
  },
  {
    id: 10,
    x: 'usageHours',
    y: 'hrv.rmssdMs',
    expectedSign: '+',
    band: [0.0, 0.3],
    bandTag: 'heur',
    family: 'exploratory',
    rationale:
      'Within-subject usage↔next-morning HRV is weak/lag-confounded; expect ~0.',
  },
  {
    id: 11,
    x: 'leakPercent',
    y: 'sleep.efficiencyPct',
    expectedSign: '-',
    band: [0.1, 0.3],
    bandTag: 'heur',
    family: 'exploratory',
    rationale: 'Leaks disrupt sleep (if leak col present).',
  },
  {
    id: 12,
    x: 'ahi',
    y: 'stress.score',
    expectedSign: '+',
    band: [0.0, 0.3],
    bandTag: 'heur',
    family: 'exploratory',
    rationale:
      'Fitbit stress is partly derived from sleep/HRV → circularity risk; not a clean external correlate.',
  },
]);

/**
 * Pinned Mann-Whitney group-contrast definitions (§4.4). Thresholds are
 * data-scientist-owned constants, NOT user-facing sliders, to avoid a
 * garden-of-forking-paths knob. Each test counts toward the BH family.
 * `groupA`/`groupB` are predicates over the AlignedNight; `metric` is the dotted
 * wearable path being contrasted.
 *
 * @type {ReadonlyArray<{name:string, metric:string, family:string}>}
 */
export const GROUP_CONTRASTS = Object.freeze([
  {
    name: 'HRV: high-AHI(≥15) vs low-AHI(<5)',
    metric: 'hrv.rmssdMs',
    split: 'ahi',
    family: 'primary',
  },
  {
    name: 'Readiness: adherent(≥4h) vs non-adherent',
    metric: 'readiness.score',
    split: 'adherence',
    family: 'primary',
  },
]);
