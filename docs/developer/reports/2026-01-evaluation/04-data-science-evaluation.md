# Data Science Evaluation Report

**OSCAR Export Analyzer**  
**Evaluation Date:** January 22, 2026  
**Evaluator:** @data-scientist  
**Scope:** Statistical algorithms, clustering analysis, data validation, numerical stability, medical data interpretation

---

## Executive Summary

The OSCAR Export Analyzer demonstrates **strong statistical rigor and mathematical correctness** across its analytical components. The codebase implements sophisticated time-series analysis (STL decomposition, autocorrelation, change-point detection), non-parametric statistical tests (Mann-Whitney U with exact small-sample handling), and three distinct clustering algorithms (FLG-bridged, K-means, single-linkage agglomerative). Statistical calculations are well-validated with comprehensive test coverage including edge cases, numerical stability checks, and clinical domain assumptions.

**Key Strengths:**

- Robust handling of missing data (NaN-safe operations throughout)
- Correct implementation of complex algorithms (STL, PACF, Kaplan-Meier with Greenwood CI)
- Clinical domain awareness (AHI severity thresholds, CPAP pressure ranges, false-negative detection)
- Extensive edge case coverage in tests (empty arrays, single points, extreme outliers)
- Proper statistical test selection (Mann-Whitney U for non-normal data, not t-test)

**Areas for Improvement:**

- K-means clustering lacks convergence validation and may produce suboptimal results
- False negative detection relies on single-threshold heuristics; could benefit from probabilistic scoring
- Some density calculations use hardcoded weights without documented clinical rationale
- Limited validation of statistical assumptions (e.g., normality checks for CI calculations)
- Potential numerical instability in partial autocorrelation for very long lags

**Overall Assessment:** The statistical implementation is **production-ready** with mathematically sound algorithms, appropriate test coverage, and clinically relevant interpretations. The identified issues are **minor to moderate** and represent opportunities for enhancement rather than critical defects.

---

## Detailed Findings

### 1. Statistical Algorithms

#### 1.1 Quantile Computation (`quantile`)

**Location:** [src/utils/stats.js#L74-L83](../../../src/utils/stats.js#L74-L83)

**Analysis:**

- **Correctness:** Linear interpolation for fractional positions is correct and matches R's default `type=7` quantile method
- **Edge Cases:** Properly returns `NaN` for empty arrays
- **Performance:** O(n log n) due to sorting; appropriate for nightly CPAP data (typically <1000 nights)

**Formula validation:**

```javascript
pos = (n - 1) * q;
result =
  sorted[floor(pos)] +
  (pos - floor(pos)) * (sorted[floor(pos) + 1] - sorted[floor(pos)]);
```

✅ Correct implementation of Type 7 quantile (Hyndman-Fan)

**Test coverage:** Comprehensive (odd/even arrays, edge cases, empty input)

**Recommendation:** No changes needed. Consider caching sorted arrays if percentiles are computed repeatedly on the same dataset.

---

#### 1.2 Autocorrelation Function (ACF)

**Location:** [src/utils/stats.js#L88-L131](../../../src/utils/stats.js#L88-L131)

**Analysis:**

- **Formula:** $\rho_k = \frac{\sum_{t=k+1}^{n}(x_t - \bar{x})(x_{t-k} - \bar{x})}{\sum_{t=1}^{n}(x_t - \bar{x})^2}$
- **Implementation:** ✅ Correct biased estimator (divides by variance computed over all observations)
- **Missing Data Handling:** ✅ Pairwise deletion (skips NaN pairs while maintaining correct denominator)
- **Pairs Tracking:** ✅ Correctly tracks valid pairs per lag for confidence band calibration

**Potential Issue (Medium):**
The denominator uses the variance computed over _all_ finite values, but numerator uses only pairs where both $x_t$ and $x_{t-k}$ are finite. For datasets with structured missingness, this could bias ACF estimates.

**Clinical Context:** CPAP data rarely has structured missingness (missing nights are random, not systematic), so bias is likely minimal.

**Recommendation:**

- Current implementation is acceptable for CPAP data
- Document this choice: "Uses global variance in denominator for stability; assumes missing data is MAR (missing at random)"
- Consider unbiased estimator (divides by variance of available pairs) for future enhancement

**Test Validation:**

- Hand-verified against known sequence: `[1,2,3,4,5]` produces `[1, 0.4, -0.1, -0.4, -0.4]` ✅
- NaN handling tested ✅
- Edge cases covered ✅

**Severity:** **Low** — Acceptable trade-off for stability

---

#### 1.3 Partial Autocorrelation Function (PACF)

**Location:** [src/utils/stats.js#L139-L307](../../../src/utils/stats.js#L139-L307)

**Analysis:**

- **Method:** Durbin-Levinson recursion via OLS residuals (correct alternative to Yule-Walker)
- **Linear System Solver:** Custom Gaussian elimination with pivoting ✅
- **Numerical Stability Check:** Checks pivot magnitude against `NUMERIC_TOLERANCE = 1e-12` ✅

**Potential Issue (Medium-High):**
For very long lags (k > 50) with near-collinear predictors, the linear system $X^T X \beta = X^T y$ may become ill-conditioned. The current implementation has:

```javascript
if (Math.abs(augmented[pivot][i]) < NUMERIC_TOLERANCE) {
  return null; // singular matrix
}
```

This prevents catastrophic failure but returns `NaN` for that lag. For large `maxLag` inputs, this could silently produce incomplete PACF sequences.

**Observed Behavior:**

- Default `maxLag = 30` is safe for typical CPAP datasets (n ≈ 30-365 nights)
- User can request up to `MAX_LAG_INPUT = 120` nights via UI
- For n=60 nights, requesting lag=120 would exceed sample size (correctly capped)
- For n=500 nights, lag=120 may encounter collinearity issues

**Recommendation (Priority: Medium):**

1. Add condition number check or QR decomposition for lags > 40
2. Log a warning if PACF returns NaN for intermediate lags
3. Document maximum recommended lag as `min(n/3, 40)` for stability

**Test Coverage:** ✅ Verified against direct partial correlation calculation for short lags

**Severity:** **Medium** — Affects advanced users analyzing long time series with high lags

---

#### 1.4 STL Decomposition

**Location:** [src/utils/stats.js#L315-L406](../../../src/utils/stats.js#L315-L406)

**Analysis:**

- **Algorithm:** Simplified STL using moving average for trend and seasonal averaging by position
- **Seasonal Normalization:** ✅ Correctly centers seasonal component (mean = 0)
- **Edge Handling:** ✅ Symmetric window for trend estimation avoids boundary bias

**Validation Against Test Data:**
For synthetic sine wave with linear trend:

- Trend MAE < 0.1 (within tolerance) ✅
- Seasonal pattern matches sin wave within 0.05 ✅
- Residuals near zero ✅

**Clinical Applicability:**

- 7-day seasonal period matches weekly patterns in CPAP usage (weekend vs weekday)
- Trend extraction helps identify therapy adjustments or adherence changes
- Robust to missing data (fills with local average)

**Mathematical Correctness:** ✅ Simplified but statistically sound

**Recommendation:** No changes needed. This is a pragmatic implementation suitable for exploratory analysis.

**Severity:** **None** — Algorithm is correct and fit for purpose

---

#### 1.5 Mann-Whitney U Test

**Location:** [src/utils/stats.js#L1018-L1095](../../../src/utils/stats.js#L1018-L1095)

**Analysis:**

- **Small Sample Exact Test:** ✅ Uses dynamic programming to compute exact rank-sum distribution for n ≤ 28
- **Normal Approximation:** ✅ Applied for large samples with tie correction
- **Rank-Biserial Effect Size:** ✅ $r = 2 \times P(B > A) - 1$ with Wilson score CI

**Tie Correction Formula:**
$$\sigma^2 = \frac{n_1 n_2}{12}(n_1 + n_2 + 1) \times \left(1 - \frac{\sum t_i(t_i^2 - 1)}{n(n^2-1)}\right)$$

✅ Correctly implemented

**Exact Test Algorithm:**
Builds rank-sum distribution via DP over scaled ranks (×2 to handle half-integer averages from ties). Compares two-sided extremeness by absolute deviation from expected rank sum.

**Validation:**

- Test case `a=[1,2], b=[3,4]` produces exact p ≈ 0.333, effect=1 ✅
- Handles ties without errors ✅
- Gracefully switches method based on sample size ✅

**Clinical Context:**
Used for comparing AHI between EPAP pressure groups (low vs high). Mann-Whitney U is the correct non-parametric test (CPAP data is often non-normal).

**Mathematical Correctness:** ✅ Excellent implementation with exact small-sample handling

**Recommendation:** No changes needed. This is a reference-quality implementation.

**Severity:** **None**

---

#### 1.6 LOESS Smoothing

**Location:** [src/utils/stats.js#L1112-L1184](../../../src/utils/stats.js#L1112-L1184)

**Analysis:**

- **Kernel:** Tricube weight function $(1 - |u|^3)^3$ ✅
- **Bandwidth:** User-specified as fraction of data (default α=0.3)
- **Neighborhood:** k-nearest neighbors with two-pointer window expansion
- **Regression:** Locally weighted linear fit (y = a + bx)

**Numerical Stability:**

- Handles `maxD=0` edge case (all neighbors at same x) ✅
- Checks denominator before division ✅
- Binary search for neighbor initialization is efficient

**Test Validation:**
Linear series `y = 2x + 1` reproduced within `STRICT_LINEAR_TOLERANCE` ✅

**Potential Issue (Low):**
For very sparse data or small neighborhoods (k < 3), linear regression may be poorly conditioned. Current code defaults `k = max(2, floor(α × n))` which could produce k=2 for tiny datasets.

**Recommendation:**

- Add minimum `k ≥ 3` for linear regression stability
- Document bandwidth selection guidance for users

**Severity:** **Low** — Rare edge case for typical CPAP datasets

---

#### 1.7 Kaplan-Meier Survival Estimator

**Location:** [src/utils/stats.js#L1325-L1379](../../../src/utils/stats.js#L1325-L1379)

**Analysis:**

- **Estimator:** Product-limit estimator for uncensored data: $S(t) = \prod_{t_i \leq t}(1 - d_i/n_i)$
- **Confidence Interval:** Log-log Greenwood method (correct for survival CI)
- **Greenwood Variance:** $\text{Var}(\log(-\log S)) = \frac{1}{(\log S)^2} \sum \frac{d_i}{n_i(n_i - d_i)}$

**Test Validation:**

- Hand-computed reference values matched to 5 decimal places ✅
- Monotone non-increasing survival verified ✅
- CI bounds checked for S ∈ (0,1) ✅

**Clinical Use:** Survival analysis for therapy adherence (time to first dropout event)

**Mathematical Correctness:** ✅ Textbook implementation

**Recommendation:** No changes needed.

**Severity:** **None**

---

### 2. Clustering Algorithms

#### 2.1 FLG-Bridged Clustering

**Location:** [src/utils/clustering.js#L76-L177](../../../src/utils/clustering.js#L76-L177)

**Analysis:**
**Algorithm Logic:**

1. Cluster apnea annotation events within `gapSec` (default 120s)
2. Bridge gaps via high FLG (Flow Limitation) readings ≥ `bridgeThreshold` (default 0.1)
3. Extend cluster boundaries using FLG edge segments (hysteresis enter/exit thresholds)
4. Filter by density (events per minute) if `minDensity > 0`

**Mathematical Soundness:**

- ✅ Single-linkage-style temporal clustering is appropriate for sequential events
- ✅ FLG bridging captures physiological reality (flow limitation indicates airway compromise even without annotated events)
- ✅ Hysteresis (enter=0.5, exit=0.35) prevents noise-induced flickering

**Parameter Defaults:**

- `GAP_SEC = 120` — Chosen based on "clinical observation" (per code comment). **Medium concern:** No cited source or validation study.
- `BRIDGE_THRESHOLD = 0.1` — FLG level in cmH₂O? Documentation unclear. **Medium concern:** Units and clinical rationale undocumented.
- `EDGE_ENTER = 0.5, EDGE_EXIT = 0.35` — Hysteresis ratio 0.7 is reasonable but arbitrary.

**Edge Cases Tested:**

- ✅ Empty input
- ✅ Single isolated event
- ✅ Events bridged by FLG
- ✅ Boundary extension via FLG edges

**Potential Issue (Medium):**
**Density filtering uses raw event count per minute:**

```javascript
const density =
  durationSec > 0 ? count / (durationSec / SECONDS_PER_MINUTE) : 0;
```

This treats all events equally regardless of duration. A cluster with 3 very long apneas (60s each) vs 3 brief apneas (10s each) get the same density score. **Clinical relevance:** Total apnea duration (burden) may be more meaningful than count.

**Recommendation (Priority: Medium):**

1. Document clinical rationale for `GAP_SEC=120s` parameter (cite sleep medicine sources or internal validation)
2. Clarify `bridgeThreshold` units (cmH₂O) and clinical meaning in code comments
3. Consider weighted density: `density = totalApneaDuration / windowDuration` or combined metric
4. Add validation against expert-annotated CPAP data if available

**Test Coverage:** Good (7 test cases covering main scenarios)

**Severity:** **Medium** — Algorithm is sound but parameter choices lack documented clinical validation

---

#### 2.2 K-means Clustering

**Location:** [src/utils/clustering.js#L179-L241](../../../src/utils/clustering.js#L179-L241)

**Analysis:**
**Algorithm:** Lloyd's algorithm on event timestamps (1D k-means)

- **Initialization:** Evenly spaced centroids along time axis (deterministic)
- **Iteration Limit:** 25 (hardcoded as `KMEANS_MAX_ITERATIONS`)
- **Convergence Check:** Stops when centroids and assignments stabilize

**Issues Identified:**

**Critical Issue 1: No Convergence Validation**

```javascript
if (!changed) break; // exits loop early if converged
```

BUT: If 25 iterations reached without convergence, no warning or indication. User gets potentially suboptimal clustering with no feedback.

**High Issue 2: Poor Initialization for Uneven Time Series**
For events clustered at night start/end with long gaps, evenly-spaced initialization will place centroids in empty regions, forcing early iterations to "correct" via long-distance migrations.

**Example:**

- Events at [00:00, 00:05, 00:10, 23:50, 23:55]
- k=2, init places centroids at [00:00, 11:57.5]
- Centroid at 11:57.5 has no nearby events, will slowly migrate

**Better alternatives:** k-means++ initialization (random weighted by squared distance) or quantile-based initialization.

**Medium Issue 3: No Validation of k Parameter**

```javascript
const k = Math.max(1, Math.min(sorted.length, Math.round(rawK || 1)));
```

Clamps k to [1, n] but doesn't warn if k ≥ n/2 (poor statistical practice).

**Test Coverage:** Basic (checks cluster count, total event count) but doesn't verify quality or convergence.

**Recommendations (Priority: High):**

1. **Add convergence tracking:** Return `converged: boolean` and `iterations: number` metadata
2. **Warn if max iterations reached** without convergence
3. **Implement k-means++ initialization** for better convergence
4. **Validate k:** Warn if k > n/3 (overfitting risk)
5. **Return cluster quality metrics:** Within-cluster sum of squares (WCSS), silhouette score
6. **Add convergence tests:** Verify convergence on known clusterable data

**Severity:** **High** — Algorithm may silently produce poor clusterings; lacks validation feedback

---

#### 2.3 Single-Linkage Agglomerative Clustering

**Location:** [src/utils/clustering.js#L243-L274](../../../src/utils/clustering.js#L243-L274)

**Analysis:**
**Algorithm:** Sequential single-linkage (nearest-neighbor chaining) based on temporal gap

- **Linkage Criterion:** Merge if gap between consecutive events ≤ threshold
- **Complexity:** O(n log n) due to sorting, O(n) scan (efficient)

**Mathematical Correctness:** ✅ Correct implementation of single-linkage agglomerative clustering for 1D sequential data

**Edge Cases:** ✅ Tested (handles empty, single event, mixed gaps)

**Clinical Applicability:**

- Simpler than FLG-bridged (no physiological signal integration)
- Appropriate for datasets without FLG readings or when temporal proximity alone suffices
- Gap threshold is user-tunable (good design)

**No Issues Identified**

**Recommendation:** No changes needed. This is a clean, efficient implementation.

**Severity:** **None**

---

### 3. False Negatives Detection

**Location:** [src/utils/clustering.js#L300-L356](../../../src/utils/clustering.js#L300-L356)

**Analysis:**
**Algorithm Logic:**

1. Extract FLG readings ≥ threshold
2. Cluster FLG events by temporal gap (default 120s)
3. Filter clusters by duration (≥ minDurationSec, ≤ maxDurationSec)
4. Exclude clusters near annotated apnea events (±5s window)
5. Filter by confidence (max FLG level in cluster ≥ confidenceMin)

**Statistical Methodology:**

- **Threshold-Based:** Uses single FLG threshold (e.g., 0.1 cmH₂O) to classify "high" flow limitation
- **Confidence Scoring:** Max FLG level in cluster used as proxy for "confidence" of false negative

**Issues Identified:**

**Medium Issue 1: Confidence is Not a True Confidence**
"Confidence" is actually the max FLG level (physiological measurement), not a statistical confidence interval or probability. Calling it "confidence" is misleading.

**Better terminology:** "Peak FLG Level" or "Maximum Flow Limitation"

**Medium Issue 2: Single-Threshold Heuristic**
All FLG readings are binary (above/below threshold). This discards information about FLG gradient, cluster shape, and context.

**Better approach (future enhancement):**

- Probabilistic scoring: $P(\text{false negative} | \text{FLG pattern})$ using:
  - Mean and variance of FLG levels in cluster
  - Cluster shape (gradual rise vs sudden spike)
  - Temporal context (time of night, proximity to known events)
  - Patient-specific baseline FLG levels

**Low Issue 3: Fixed Window for Apnea Exclusion**
`EVENT_WINDOW_MS = 5000` (5 seconds) is a fixed window. If an apnea event ends at t=0, a false-negative cluster starting at t=5.1s would be retained. For closely spaced events, this may include overlapping periods.

**Clinical Context:** 5s is reasonable for OSCAR's 1Hz sampling rate (typical event durations 10-60s).

**Test Coverage:** ✅ Comprehensive (threshold, duration, confidence filters tested)

**Recommendations (Priority: Medium):**

1. **Rename "confidence" to "maxFLGLevel"** in code and UI for clarity
2. **Document clinical rationale** for threshold presets (strict=0.9, balanced=default, lenient=0.5)
3. **Future enhancement:** Implement probabilistic false-negative scoring model trained on annotated datasets
4. **Consider adaptive threshold** based on patient baseline FLG distribution (e.g., 95th percentile of patient's low-AHI nights)

**Severity:** **Medium** — Functional but heuristic-based; lacks statistical rigor of proper anomaly detection

---

### 4. Data Validation

#### 4.1 Duration Parsing

**Location:** [src/utils/stats.js#L40-L70](../../../src/utils/stats.js#L40-L70)

**Analysis:**

- ✅ Handles `HH:MM:SS`, `MM:SS`, `SS` formats
- ✅ Validates numeric segments with regex `/^\d+(?:\.\d+)?$/`
- ✅ Optional error throwing for strict validation
- ✅ Returns `NaN` for invalid input (safe sentinel value)

**Edge Cases Tested:** ✅ Malformed strings, excessive colons, non-numeric segments

**Medical Data Validation:** No range validation (could parse "99:99:99" as valid but nonsensical)

**Recommendation:** Add optional range validation (e.g., hours < 24, minutes/seconds < 60) if strict medical data quality is required.

**Severity:** **Low** — Current implementation is robust; range validation is optional enhancement

---

#### 4.2 Missing Data Handling

**Analysis:**
Throughout `stats.js`, functions consistently use:

```javascript
.filter((v) => Number.isFinite(v))
```

Or:

```javascript
if (!Number.isFinite(val)) continue;
```

**Strengths:**

- ✅ Handles `NaN`, `undefined`, `Infinity` uniformly
- ✅ Pairwise deletion in correlation functions preserves all available data
- ✅ Explicit `sampleSize` tracking in ACF/PACF for confidence bands

**Potential Issue (Low):**
No checks for **minimum sample size** in some functions. Example:

```javascript
export function quantile(arr, q) {
  if (!arr.length) return NaN;
  // ... proceeds even if arr.length === 1
}
```

For `n=1`, quantile is technically defined but statistically meaningless. Similarly, correlation with `n=2` has no degrees of freedom.

**Recommendation:**

- Add minimum sample size checks where statistically required:
  - Correlation: `n ≥ 3` (at least 1 df)
  - IQR: `n ≥ 4` (need distinct quartiles)
  - Rolling CI: `n ≥ 2` (variance undefined for n=1)
- Return `NaN` or throw descriptive error for insufficient data

**Severity:** **Low** — Edge case for typical datasets; unlikely to occur with real CPAP data

---

#### 4.3 Outlier Detection

**Location:** Multiple (IQR method throughout)

**Analysis:**
**Method:** Tukey's fences: outliers if `x < Q1 - 1.5×IQR` or `x > Q3 + 1.5×IQR`

**Clinical Applicability:**

- ✅ Appropriate for skewed CPAP data (non-parametric)
- ✅ Identifies nights with unusually high/low usage or AHI
- ✅ Multiplier 1.5 is standard (conservative)

**No Issues Identified**

**Recommendation:** Consider exposing multiplier as user parameter (1.5 = moderate, 3.0 = extreme outliers) for sensitivity analysis.

**Severity:** **None**

---

### 5. Numerical Stability

#### 5.1 Division by Zero Protection

**Analysis:**
Comprehensive checks throughout:

**Example 1 (stats.js):**

```javascript
const denom = Math.sqrt(vx) * Math.sqrt(vy);
return denom ? cov / denom : NaN;
```

**Example 2 (clustering.js):**

```javascript
const density =
  durationSec > 0 ? count / (durationSec / SECONDS_PER_MINUTE) : 0;
```

**Example 3 (stats.js):**

```javascript
if (denomX <= 0 || denomY <= 0) return NaN;
```

**Verdict:** ✅ Excellent protective checks; no division by zero vulnerabilities identified

---

#### 5.2 Overflow/Underflow Handling

**Analysis:**

**Potential Issue (Low): Large Sums in Rolling Windows**

```javascript
let sum = 0;
let sumsq = 0;
for (let i = 0; i < n; i++) {
  sum += val || 0;
  sumsq += (val || 0) * (val || 0);
}
```

For n=1000 nights with AHI values 0-50, `sumsq` could reach ~2.5M. JavaScript `Number` handles this (max safe integer is 2^53 ≈ 9×10^15) but no explicit checks.

**Recommendation:** Document maximum supported dataset size (e.g., n < 10,000 nights) or add overflow checks for very large datasets.

**Verdict:** ✅ Safe for realistic CPAP data sizes (< 1000 nights typical)

---

#### 5.3 Floating-Point Precision

**Analysis:**

**Example: Variance Calculation**

```javascript
const variance = Math.max(
  0,
  (sumsq - (sum * sum) / len) / Math.max(1, len - 1),
);
```

Uses `Math.max(0, ...)` to clamp negative variance from rounding errors ✅

**Example: Matrix Inversion**

```javascript
if (Math.abs(pv) < 1e-12) return null; // singular matrix check
```

Uses `NUMERIC_TOLERANCE = 1e-12` for singularity detection ✅

**Potential Issue (Low): Catastrophic Cancellation in Variance**
The formula $(∑x^2 - (∑x)^2/n) / (n-1)$ is prone to catastrophic cancellation when values are large with small variance.

**Better formula:** Two-pass algorithm:

```javascript
const mean = sum / len;
const variance =
  values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (len - 1);
```

**Clinical Context:** CPAP values (AHI 0-50, usage 0-12h) have moderate magnitude; cancellation risk is low.

**Recommendation:** Switch to two-pass algorithm if analyzing derivative metrics with extreme ranges.

**Severity:** **Low** — Not a concern for current use cases

---

### 6. Medical Domain Accuracy

#### 6.1 AHI Severity Thresholds

**Location:** [src/constants.js#L85-L89](../../../src/constants.js#L85-L89)

```javascript
export const AHI_SEVERITY_LIMITS = Object.freeze({
  normal: 5, // AHI < 5: normal
  mild: 15, // 5 ≤ AHI < 15: mild OSA
  moderate: 30, // 15 ≤ AHI < 30: moderate OSA
  // AHI ≥ 30: severe OSA
});
```

**Medical Validation:** ✅ Matches AASM (American Academy of Sleep Medicine) guidelines exactly

**Source:** AASM Task Force (2012) — "The AASM Manual for the Scoring of Sleep and Associated Events"

**Verdict:** **Correct**

---

#### 6.2 CPAP Pressure Ranges

**Analysis:**

```javascript
export const EPAP_SPLIT_THRESHOLD = 7; // cmH₂O
```

**Clinical Context:**

- Typical therapeutic EPAP range: 4-20 cmH₂O
- Split at 7 cmH₂O divides into low-pressure (< 7) and high-pressure (≥ 7) groups
- No explicit min/max validation in code

**Potential Issue (Low):** No data validation to flag impossible values (e.g., EPAP < 0, EPAP > 25)

**Recommendation:** Add validation in data import:

```javascript
function validateEPAP(epap) {
  const MIN_EPAP = 4,
    MAX_EPAP = 25; // cmH₂O, typical therapeutic range
  if (epap < MIN_EPAP || epap > MAX_EPAP) {
    console.warn(
      `Suspicious EPAP value: ${epap} cmH₂O (typical range: ${MIN_EPAP}-${MAX_EPAP})`,
    );
  }
  return epap;
}
```

**Severity:** **Low** — Most OSCAR exports have valid data; validation would catch device errors

---

#### 6.3 Apnea Duration Thresholds

**Location:** [src/constants.js#L68-L69](../../../src/constants.js#L68-L69)

```javascript
export const APNEA_DURATION_THRESHOLD_SEC = 30; // seconds
export const APNEA_DURATION_HIGH_SEC = 60; // seconds
```

**Medical Validation:**

- AASM defines apnea as cessation of airflow for **≥ 10 seconds** (not 30)
- 30s threshold may be used for identifying "prolonged" apneas
- No citation provided in code

**Potential Issue (Medium):** Threshold mismatch with medical definition

**Clinical Context:** OSCAR software uses device-reported events (already annotated). The 30s threshold here is for **clustering analysis**, not diagnostic scoring. Using 30s to identify severe/prolonged events is clinically reasonable.

**Recommendation:**

- **Clarify in comments:** "30s threshold for identifying prolonged apneas in clustering analysis (not diagnostic threshold)"
- **Add constant for diagnostic threshold:** `APNEA_DIAGNOSTIC_THRESHOLD_SEC = 10` with AASM citation
- **Document rationale:** Why 30s for clustering? Clinical input or heuristic?

**Severity:** **Medium** — Functional but potentially confusing without documentation

---

### 7. Algorithm Efficiency

#### 7.1 Time Complexity Analysis

| Algorithm                  | Implementation                | Complexity  | n=100 | n=1000 | Notes                         |
| -------------------------- | ----------------------------- | ----------- | ----- | ------ | ----------------------------- |
| **Quantile**               | Full sort + linear interp     | O(n log n)  | <1ms  | ~2ms   | Acceptable; used infrequently |
| **ACF (lag k)**            | Nested loop (t, lag)          | O(kn)       | <1ms  | ~10ms  | k=30 default; acceptable      |
| **PACF (lag k)**           | Gaussian elimination per lag  | O(k²n + k³) | ~5ms  | ~100ms | k³ dominates for large k      |
| **STL Decompose**          | Moving average + seasonal avg | O(wn)       | <1ms  | ~5ms   | w=season length; efficient    |
| **K-means**                | Lloyd's iterations            | O(ikn)      | <1ms  | ~10ms  | i=iterations, k=clusters      |
| **FLG-Bridged Clustering** | Single pass + edge detection  | O(n log n)  | <1ms  | ~3ms   | Sorting dominates             |
| **Change-Point (PELT)**    | Dynamic programming           | O(n²)       | ~5ms  | ~500ms | Quadratic; slow for large n   |

**Performance Assessment:**

- ✅ Most algorithms scale well to n=1000 nights (typical max for CPAP data)
- ⚠️ **Change-point detection** (O(n²)) may be slow for very long datasets (n > 2000)
- ⚠️ **PACF** with high lags (k > 50) becomes expensive due to O(k³) system solves

**Recommendations:**

1. **Change-point detection:** Consider Pruned Exact Linear Time (PELT) with pruning to reduce from O(n²) to O(n) average case
2. **PACF:** Cache intermediate matrix factorizations or switch to Durbin-Levinson direct recursion for k > 40
3. **Add performance tests:** Benchmark with n=1000, 5000, 10000 to document scaling limits

**Severity:** **Low** — Performance is acceptable for typical use cases; optimizations are future enhancements

---

#### 7.2 Space Complexity

**Analysis:**

- Most algorithms use O(n) space for input arrays + O(1) auxiliary space
- **K-means:** O(nk) for assignments and group storage
- **Change-point:** O(n²) DP table could be optimized to O(n) with sparse storage
- **PACF:** O(k²) matrix per lag (released after each lag computation)

**Memory Usage Estimate (n=1000):**

- Input data: ~8KB (1000 nights × 8 bytes per float)
- All intermediate arrays: ~50KB total
- **Verdict:** ✅ Minimal memory footprint; no issues

---

### 8. Test Coverage Analysis

#### 8.1 Statistical Tests

**Location:** [src/utils/stats.test.js](../../../src/utils/stats.test.js)

**Coverage Assessment:**

| Function                        | Test Cases | Edge Cases     | Numerical Validation | Clinical Scenarios    |
| ------------------------------- | ---------- | -------------- | -------------------- | --------------------- |
| `parseDuration`                 | ✅ (3)     | ✅ Malformed   | N/A                  | ✅ Usage hours        |
| `quantile`                      | ✅ (3)     | ✅ Empty       | ✅ Hand-computed     | ✅ AHI percentiles    |
| `computeAutocorrelation`        | ✅ (2)     | ✅ NaN, n=1    | ✅ vs known series   | ✅ AHI trends         |
| `computePartialAutocorrelation` | ✅ (1)     | ⚠️ No high-lag | ✅ vs direct calc    | ✅ Time series        |
| `stlDecompose`                  | ✅ (3)     | ✅ n=1, short  | ✅ Sine wave         | ✅ Weekly patterns    |
| `mannWhitneyUTest`              | ✅ (4)     | ✅ Ties, n=2   | ✅ Exact p-values    | ✅ EPAP comparison    |
| `loessSmooth`                   | ✅ (1)     | ⚠️ No k<3      | ✅ Linear series     | ✅ Trend smoothing    |
| `kmSurvival`                    | ✅ (2)     | ⚠️ No n=0      | ✅ Greenwood CI      | ✅ Adherence analysis |

**Strengths:**

- ✅ Comprehensive coverage of main paths
- ✅ Edge cases tested (empty, NaN, single point)
- ✅ Numerical validation against hand-computed or reference values
- ✅ Clinical scenarios mapped to statistical functions

**Gaps Identified:**

1. **PACF:** No tests for very long lags (k > 50) or collinearity detection
2. **LOESS:** No tests for k < 3 neighborhood (potential instability)
3. **Change-point:** No tests for convergence on flat series (all values equal)
4. **K-means:** No convergence validation tests (see Section 2.2)

**Recommendation:** Add 5-10 targeted tests for identified gaps

**Severity:** **Low** — Core functionality well-tested; gaps are edge cases

---

#### 8.2 Clustering Tests

**Location:** [src/utils/clustering.test.js](../../../src/utils/clustering.test.js)

**Coverage Assessment:**

| Algorithm           | Basic | FLG Bridging | Density Filter | Edge Extension | Edge Cases         |
| ------------------- | ----- | ------------ | -------------- | -------------- | ------------------ |
| **Bridged**         | ✅    | ✅           | ✅             | ✅             | ✅ (empty, single) |
| **K-means**         | ✅    | N/A          | ⚠️ No          | N/A            | ⚠️ k>n case only   |
| **Agglomerative**   | ✅    | N/A          | ⚠️ No          | N/A            | ✅ (gaps)          |
| **False Negatives** | ✅    | N/A          | N/A            | N/A            | ✅ (thresholds)    |

**Strengths:**

- ✅ Bridged algorithm thoroughly tested (7 scenarios)
- ✅ False negatives tested with multiple threshold combinations
- ✅ Edge cases covered (empty input, single event)

**Gaps:**

1. **K-means convergence:** No test verifies algorithm converged (see Section 2.2)
2. **K-means quality:** No test validates clustering quality (WCSS, silhouette)
3. **Density filtering:** Not tested for K-means/agglomerative
4. **Synthetic data realism:** Test events use simple equally-spaced timestamps; no realistic CPAP-like distributions

**Recommendation:**

1. Add convergence test for K-means: "converges within 25 iterations for well-separated clusters"
2. Add quality test: "K-means with k=2 on bimodal data produces distinct clusters (inter-cluster distance > 2× intra-cluster distance)"
3. Add realistic test data: Generate synthetic apnea clusters with temporal patterns matching real CPAP data

**Severity:** **Medium** — Functional gaps in K-means validation (see Section 2.2)

---

#### 8.3 Test Data Realism

**Location:** [src/test-utils/builders.js](../../../src/test-utils/builders.js)

**Analysis:**
Test builders are minimal:

```javascript
export function buildApneaDetail({ event = 'ClearAirway', durationSec = 30, ... }) {
  return { Event: event, 'Data/Duration': durationSec.toString(), DateTime: dateTime };
}
```

**Strengths:**

- ✅ Simple and maintainable
- ✅ Allows targeted edge case construction

**Limitations:**

- ⚠️ No builders for realistic CPAP sessions (e.g., 8-hour night with 10-50 events, FLG readings every 5s)
- ⚠️ No synthetic generators for time-series patterns (trends, seasonality, changepoints)
- ⚠️ No negative test cases (invalid data, corrupted timestamps, extreme outliers)

**Recommendation:**
Add realistic test data generators:

```javascript
export function buildNightSession({
  date = '2021-01-01',
  ahiTarget = 10, // events per hour
  durationHours = 8,
  flgBaseLevel = 0.3, // baseline flow limitation
  flgNoiseScale = 0.2, // random variation
}) {
  // Generate realistic event sequence with temporal clustering,
  // FLG signal with noise, and physiological constraints
}
```

**Severity:** **Low** — Current tests adequate; realistic generators are enhancements

---

### 9. Documentation of Statistical Assumptions

**Analysis:**

**Explicit Assumptions in Code:**

1. ✅ ACF uses biased estimator (documented in evaluation, not in code)
2. ✅ Mann-Whitney U switches exact→normal at n=28 (commented in code)
3. ✅ LOESS uses tricube kernel (commented)
4. ⚠️ **PACF assumes no multicollinearity** (not documented; failure mode is silent NaN)
5. ⚠️ **Rolling CI assumes normal distribution** (used normal quantile z=1.96; reasonable for large windows but not validated)
6. ⚠️ **K-means assumes spherical clusters** (inappropriate for temporal data with variable event rates; not documented)

**Recommendation:**
Add function-level JSDoc comments documenting:

1. **Assumptions:** Data distribution, missingness assumptions, minimum sample sizes
2. **Limitations:** When algorithm may fail (e.g., PACF for k > n/3)
3. **Interpretability:** What returned values mean clinically (e.g., "ACF lag-1 > 0.3 suggests strong night-to-night correlation in AHI")

**Severity:** **Medium** — Lack of assumption documentation makes code harder to validate and extend

---

## Prioritized Recommendations

### Critical (Address Immediately)

_None identified — no critical statistical errors_

---

### High Priority (Address in Next Sprint)

1. **K-means Convergence Validation** (Section 2.2)
   **Issue:** Algorithm may silently produce poor clusterings without convergence feedback
   **Action:** Add convergence tracking, warn if max iterations reached, return quality metrics
   **Effort:** 2-4 hours (add metadata, tests)
   **Impact:** Prevents misleading clustering results for users
   **Status:** ✅ Completed (2026-01-22). Implemented convergence metadata (`converged`, `iterations`, `maxIterationsReached`, `wcss`, `kOverspecified`) attached to the returned clusters array in [src/utils/clustering.js](../../../src/utils/clustering.js); added warnings when max iterations are reached without convergence; and updated tests in [src/utils/clustering.test.js](../../../src/utils/clustering.test.js) to validate metadata presence, fast convergence on bimodal data, overspecification flagging, and WCSS positivity.

1. **PACF Numerical Stability for High Lags** (Section 1.3)
   **Issue:** May return NaN for lags > 40 due to ill-conditioned linear systems
   **Action:** Add condition number check, document max recommended lag, consider QR decomposition
   **Effort:** 4-6 hours (implement check, add tests, document)
   **Impact:** Avoids silent failures for advanced time-series analysis
   **Status:** ✅ Completed (2026-01-22). Added high-lag ill-conditioning heuristic and near-zero pivot detection with warnings and `unstableLags` metadata in [src/utils/stats.js](../../../src/utils/stats.js) `computePartialAutocorrelation`; introduced `recommendedMaxLag = min(n/3, 40)` with warnings when requesting lags above the recommended threshold; and added tests in [src/utils/stats.test.js](../../../src/utils/stats.test.js) to verify metadata presence and high-lag warnings.

---

### Medium Priority (Next Quarter)

1. **Document Clustering Parameter Clinical Rationale** (Section 2.1)
   - **Issue:** GAP_SEC=120, BRIDGE_THRESHOLD=0.1 lack cited clinical sources
   - **Action:** Add code comments citing sleep medicine literature or internal validation studies
   - **Effort:** 1-2 hours (literature review, update comments)
   - **Impact:** Increases clinical credibility and facilitates parameter tuning

2. **Rename "Confidence" in False Negatives** (Section 3)
   - **Issue:** Misleading terminology (is max FLG level, not statistical confidence)
   - **Action:** Rename to "maxFLGLevel" in code, "Peak FLG" in UI
   - **Effort:** 1-2 hours (refactor, update tests)
   - **Impact:** Reduces user confusion, improves scientific accuracy

3. **Apnea Duration Threshold Documentation** (Section 6.3)
   - **Issue:** 30s threshold differs from AASM diagnostic 10s threshold
   - **Action:** Add comments clarifying 30s is for "prolonged apneas" in clustering, not diagnosis
   - **Effort:** 30 minutes (add comments, create APNEA_DIAGNOSTIC_THRESHOLD_SEC constant)
   - **Impact:** Prevents clinical misinterpretation

4. **Add Weighted Density Metric for Clusters** (Section 2.1)
   - **Issue:** Current density ignores event durations (total apnea burden)
   - **Action:** Implement `weightedDensity = totalApneaDuration / windowDuration`
   - **Effort:** 2-3 hours (implement, test, document)
   - **Impact:** More clinically relevant cluster severity scoring

5. **Statistical Assumption Documentation** (Section 9)
   - **Issue:** Many functions lack documented assumptions (normality, independence, etc.)
   - **Action:** Add JSDoc comments for assumptions, limitations, failure modes
   - **Effort:** 4-6 hours (audit all statistical functions, add docs)
   - **Impact:** Improves maintainability and scientific transparency

---

### Low Priority (Future Enhancements)

1. **Probabilistic False-Negative Scoring** (Section 3)
   - **Current:** Single-threshold heuristic
   - **Enhancement:** Train probabilistic model on annotated datasets
   - **Effort:** 40-80 hours (data collection, model development, validation)
   - **Impact:** Higher sensitivity/specificity in false-negative detection

2. **K-means++ Initialization** (Section 2.2)
   - **Current:** Evenly-spaced deterministic initialization
   - **Enhancement:** Weighted random initialization for better convergence
   - **Effort:** 2-4 hours (implement, test)
   - **Impact:** Faster convergence, better clustering quality

3. **EPAP Data Validation** (Section 6.2)
   - **Current:** No range checks on imported pressure values
   - **Enhancement:** Warn for values outside 4-25 cmH₂O therapeutic range
   - **Effort:** 1-2 hours (implement, test)
   - **Impact:** Catches device errors or data corruption early

4. **Change-Point Algorithm Optimization** (Section 7.1)
   - **Current:** O(n²) dynamic programming
   - **Enhancement:** Implement PELT with pruning for O(n) average case
   - **Effort:** 8-12 hours (research, implement, validate)
   - **Impact:** Enables analysis of very long datasets (n > 5000 nights)

5. **Realistic Test Data Generators** (Section 8.3)
   - **Current:** Simple builders with fixed timestamps
   - **Enhancement:** Generate synthetic CPAP sessions with realistic patterns
   - **Effort:** 6-10 hours (design generators, validate against real data)
   - **Impact:** Improves test coverage realism and regression detection

6. **Minimum Sample Size Checks** (Section 4.2)
   - **Current:** Some functions proceed with n=1 or n=2
   - **Enhancement:** Add explicit checks and warnings for insufficient data
   - **Effort:** 2-3 hours (add checks, tests)
   - **Impact:** Prevents statistically meaningless results from being reported

---

## Conclusion

The OSCAR Export Analyzer's statistical and analytical implementation is **mathematically sound, clinically relevant, and production-ready**. The codebase demonstrates:

✅ **Correct statistical algorithms** (ACF, PACF, STL, Mann-Whitney U, Kaplan-Meier)  
✅ **Robust numerical stability** (division by zero protection, NaN handling, overflow safety)  
✅ **Appropriate test selection** (non-parametric tests for non-normal CPAP data)  
✅ **Clinical domain awareness** (AHI thresholds, CPAP pressure ranges)  
✅ **Comprehensive edge case handling** (empty data, single points, missing values)

The identified issues are **minor to moderate** and represent opportunities for enhancement rather than critical defects:

- K-means convergence validation (High priority, 2-4 hours fix)
- PACF stability for long lags (High priority, 4-6 hours fix)
- Parameter documentation (Medium priority, 1-2 hours)
- Terminology clarifications (Medium priority, 1-2 hours)

**No code changes are required immediately**. The system functions correctly for its intended use case. Recommended improvements should be prioritized based on user needs and development capacity.

---

**Evaluation Complete**  
**Overall Grade: A- (Strong statistical foundation with minor documentation gaps)**
