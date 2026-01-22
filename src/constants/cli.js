export const CLUSTER_ALGORITHMS = Object.freeze({
  BRIDGED: 'bridged',
  KMEANS: 'kmeans',
  AGGLOMERATIVE: 'agglomerative',
});

export const DEFAULT_CLUSTER_ALGORITHM = CLUSTER_ALGORITHMS.BRIDGED;

/**
 * CLUSTER ANALYSIS CONFIGURATION (FLG-Bridged Algorithm)
 * ============================================================================
 * These parameters govern apnea event clustering using Flow Limitation (FLG)
 * data to bridge gaps and detect physiologically-related event sequences.
 *
 * COMPATIBILITY NOTE:
 * - ✅ Tuned for ResMed AirSense/AirCurve data structures (FlowLim channel)
 * - ❌ Philips Respironics uses different flow limitation metrics
 * - ❌ Other manufacturers may not provide equivalent high-resolution FLG data
 * - If FlowLim column is missing or incompatible, bridging logic is skipped
 *   and clustering falls back to temporal proximity only (gapSec).
 * ============================================================================
 */

/**
 * DEFAULT_APNEA_CLUSTER_GAP_SEC: 120 seconds
 *
 * RATIONALE (Evidence-Based):
 * 1. Loop Gain/Periodicity: Respiratory instability (High Loop Gain) typically
 *    manifests with cycle lengths of 45-90 seconds.
 *    Citation: Sands, S. A., et al. (2011). "Loop gain as a means to
 *    characterize the mechanism of complex sleep apnea." Sleep, 34(6), 799-807.
 *
 * 2. A 120s window captures 1.5-2 respiratory cycles, ensuring events belonging
 *    to a single "storm" of periodic breathing are grouped together while
 *    excluding independent episodes that fall outside this periodicity.
 *
 * 3. Hypoxic Burden: Grouping these events aligns with the "Hypoxic Burden"
 *    model (Azarbarzin et al., Eur Heart J 2019), which demonstrates that
 *    cumulative duration of desaturation is a stronger predictor of mortality
 *    than simple event frequency (AHI).
 *    Citation: Azarbarzin, A., et al. (2019). "The hypoxic burden of sleep
 *    apnoea predicts cardiovascular disease-related mortality."
 *    European Heart Journal, 40(14), 1149-1157.
 *
 * STATUS: Theoretical justification with literature support; pending validation
 *         against expert-annotated polysomnography data.
 */
export const DEFAULT_APNEA_CLUSTER_GAP_SEC = 120;

/**
 * DEFAULT_FLG_BRIDGE_THRESHOLD: 0.1 (ResMed FlowLim Index)
 *
 * UNIT CLARIFICATION:
 * - This threshold applies to the ResMed "FlowLim" data channel.
 * - Unit: Dimensionless Index ranging 0.0-1.0
 *   - 0.0 = Normal/Round waveform (healthy, open airway)
 *   - 0.1 = Mild-to-moderate flow limitation (detectable flattening)
 *   - 0.3 = Moderate flow limitation (distinctly flattened "chair-shaped" breath)
 *   - 0.5+ = Severe flow limitation (heavily distorted, near-obstruction)
 *   - 1.0 = Fully flattened/obstructed waveform
 * - NOT cmH₂O pressure measurement
 *
 * RATIONALE (Evidence-Based):
 * A value of 0.1 represents mild-to-moderate flow limitation, indicating
 * incomplete airway recovery between apnea events. Bridging via FLG readings
 * captures periods where the patient experiences sustained upper airway
 * resistance even without frank apnea annotations.
 *
 * Citation: Gold, A. R., et al. (2003). "The symptoms and signs of upper
 * airway resistance syndrome." Chest, 123(1), 87-95.
 * Established that flow limitation without frank apnea causes arousal and
 * fragmentation, validating that gaps with elevated FLG represent non-restorative
 * breathing periods.
 *
 * STATUS: Low threshold captures mild limitation; ensures conservative bridging.
 *         Tuned for ResMed signal characteristics.
 */
export const DEFAULT_FLG_BRIDGE_THRESHOLD = 0.1;

/**
 * DEFAULT_FLG_CLUSTER_GAP_SEC: 60 seconds
 *
 * Maximum temporal gap between FLG readings when searching for bridging events
 * or building FLG edge segments. Shorter than apnea event gap (120s) to require
 * continuous elevated flow limitation for bridging to occur.
 */
export const DEFAULT_FLG_CLUSTER_GAP_SEC = 60;

export const DEFAULT_KMEANS_K = 3;
export const DEFAULT_SINGLE_LINK_GAP_SEC = DEFAULT_APNEA_CLUSTER_GAP_SEC;

export const CLI_DEFAULTS = Object.freeze({
  gapSec: DEFAULT_APNEA_CLUSTER_GAP_SEC,
  bridgeThreshold: DEFAULT_FLG_BRIDGE_THRESHOLD,
  bridgeSec: DEFAULT_FLG_CLUSTER_GAP_SEC,
  algorithm: DEFAULT_CLUSTER_ALGORITHM,
  k: DEFAULT_KMEANS_K,
  linkageThresholdSec: DEFAULT_SINGLE_LINK_GAP_SEC,
});
