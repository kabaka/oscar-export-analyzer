---
name: oscar-statistical-validation
description: Statistical testing and validation patterns for CPAP/sleep therapy data analysis. Use when implementing or validating statistical features, clustering algorithms, or correlation analysis.
---

# OSCAR Statistical Validation

OSCAR Export Analyzer performs statistical analysis on medical sleep therapy data. This skill documents patterns for test selection, validation, edge case handling, and numerical stability.

## Statistical Test Selection

### Mann-Whitney U Test (Non-Parametric)

**When to use:** Comparing two independent groups when data may not be normally distributed.

**Example:** Comparing AHI before and after EPAP adjustment.

```javascript
import { mannWhitneyUTest } from '../utils/stats';

function compareAhiAcrossEpapChange(beforeSessions, afterSessions) {
  const beforeAhi = beforeSessions.map((s) => s.ahi).filter((v) => !isNaN(v));
  const afterAhi = afterSessions.map((s) => s.ahi).filter((v) => !isNaN(v));

  // Check minimum sample size
  if (beforeAhi.length < 2 || afterAhi.length < 2) {
    return { valid: false, reason: 'Insufficient samples for comparison' };
  }

  // Perform test (no normality assumption required)
  const result = mannWhitneyUTest(beforeAhi, afterAhi);

  return {
    valid: true,
    pValue: result.pValue,
    statistic: result.statistic,
    interpretation:
      result.pValue < 0.05 ? 'Significant difference' : 'No significant difference',
    effectSize: calculateEffectSize(beforeAhi, afterAhi),
  };
}
```

**Why Mann-Whitney over t-test:**

- CPAP data often non-normal (skewed, outliers)
- More robust to violations of assumptions
- Still powerful for detecting differences

### Kolmogorov-Smirnov Test

**When to use:** Testing if data matches a theoretical distribution or comparing two distributions.

```javascript
import { ksTest } from '../utils/stats';

function testNormality(ahiValues) {
  // Test if AHI follows normal distribution
  const result = ksTest(ahiValues, 'normal');

  return {
    isNormal: result.pValue > 0.05,
    pValue: result.pValue,
    statistic: result.dStat,
  };
}
```

### Pearson Correlation

**When to use:** Measuring linear relationship between two continuous variables.

**Example:** Correlation between EPAP and AHI.

```javascript
function correlateEpapAndAhi(sessions) {
  const pairs = sessions
    .filter((s) => !isNaN(s.epap) && !isNaN(s.ahi))
    .map((s) => [s.epap, s.ahi]);

  if (pairs.length < 3) {
    return { valid: false, reason: 'Need at least 3 pairs' };
  }

  const r = pearsonCorrelation(pairs);
  const rSquared = r * r;

  return {
    valid: true,
    correlation: r,
    rSquared: rSquared,
    interpretation: interpretCorrelation(r),
    strength: Math.abs(r) > 0.7 ? 'strong' : Math.abs(r) > 0.4 ? 'moderate' : 'weak',
  };
}

function interpretCorrelation(r) {
  if (Math.abs(r) < 0.1) return 'negligible';
  if (Math.abs(r) < 0.4) return 'weak';
  if (Math.abs(r) < 0.7) return 'moderate';
  return 'strong';
}
```

## Assumption Validation

### Sample Size Requirements

```javascript
function validateSampleSize(data, testType) {
  const n = data.length;

  const requirements = {
    'mann-whitney': 2, // Minimum per group
    't-test': 30, // Recommended for t-test
    correlation: 3, // Minimum for meaningful correlation
    'change-point': 10, // Minimum for detecting change
  };

  const minRequired = requirements[testType] || 2;

  if (n < minRequired) {
    return {
      valid: false,
      message: `Need at least ${minRequired} samples for ${testType}, have ${n}`,
    };
  }

  return { valid: true };
}
```

### Outlier Detection

```javascript
function detectOutliers(values) {
  // IQR method
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = percentile(sorted, 25);
  const q3 = percentile(sorted, 75);
  const iqr = q3 - q1;

  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  const outliers = values.filter((v) => v < lowerBound || v > upperBound);
  const cleaned = values.filter((v) => v >= lowerBound && v <= upperBound);

  return {
    outliers: outliers,
    cleaned: cleaned,
    lowerBound: lowerBound,
    upperBound: upperBound,
  };
}
```

## Edge Case Handling

### Empty Data

```javascript
function calculateStatistics(values) {
  if (!values || values.length === 0) {
    return {
      valid: false,
      mean: null,
      median: null,
      stdDev: null,
    };
  }

  // Single value
  if (values.length === 1) {
    return {
      valid: true,
      mean: values[0],
      median: values[0],
      stdDev: 0, // No variance with 1 point
    };
  }

  // Normal case
  return {
    valid: true,
    mean: mean(values),
    median: median(values),
    stdDev: stdDev(values),
  };
}
```

### Missing Values

```javascript
function handleMissingData(sessions) {
  // Filter out invalid values
  const validSessions = sessions.filter(
    (s) =>
      s.ahi !== null &&
      s.ahi !== undefined &&
      !isNaN(s.ahi) &&
      s.ahi >= 0 && // Physiologically valid
      s.ahi < 200 // Upper sanity bound
  );

  if (validSessions.length < sessions.length) {
    console.warn(
      `Filtered out ${sessions.length - validSessions.length} invalid AHI values`
    );
  }

  return validSessions;
}
```

### Extreme Values

```javascript
function validateMedicalBounds(session) {
  const errors = [];

  // AHI bounds
  if (session.ahi < 0) errors.push('AHI cannot be negative');
  if (session.ahi > 200) errors.push('AHI suspiciously high (> 200)');

  // EPAP bounds (cmH₂O)
  if (session.epap < 4.0) errors.push('EPAP below device minimum (4 cmH₂O)');
  if (session.epap > 25.0) errors.push('EPAP above device maximum (25 cmH₂O)');

  // Usage bounds (hours)
  if (session.usage < 0) errors.push('Usage cannot be negative');
  if (session.usage > 24) errors.push('Usage cannot exceed 24 hours');

  return { valid: errors.length === 0, errors };
}
```

## Numerical Stability

### Mean Calculation (Numerically Stable)

```javascript
// ❌ Unstable for large values
function unstableMean(values) {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// ✅ Stable: Welford's online algorithm
function stableMean(values) {
  let mean = 0;
  let count = 0;

  for (const value of values) {
    count++;
    const delta = value - mean;
    mean += delta / count;
  }

  return mean;
}
```

### Standard Deviation (Numerically Stable)

```javascript
// ✅ Welford's algorithm for variance
function stableVariance(values) {
  let mean = 0;
  let m2 = 0; // Sum of squares of differences
  let count = 0;

  for (const value of values) {
    count++;
    const delta = value - mean;
    mean += delta / count;
    const delta2 = value - mean;
    m2 += delta * delta2;
  }

  return count > 1 ? m2 / (count - 1) : 0;
}

function stableStdDev(values) {
  return Math.sqrt(stableVariance(values));
}
```

### Division by Zero Protection

```javascript
function safeRatio(numerator, denominator, defaultValue = null) {
  if (denominator === 0 || !isFinite(denominator)) {
    return defaultValue;
  }

  const result = numerator / denominator;

  return isFinite(result) ? result : defaultValue;
}

// Example usage
const ahiPerHour = safeRatio(totalApneas, usageHours, 0);
```

## Algorithm Validation Tests

### Clustering Algorithm Tests

```javascript
describe('Apnea Clustering Algorithm', () => {
  it('clusters events within gap threshold', () => {
    const events = [
      { date: new Date('2024-01-01T22:00:00'), durationSec: 30 },
      { date: new Date('2024-01-01T22:01:00'), durationSec: 25 }, // 60s gap
      { date: new Date('2024-01-01T22:05:00'), durationSec: 20 }, // 240s gap
    ];

    const clusters = clusterApneaEvents(events, [], 120); // 120s threshold

    expect(clusters).toHaveLength(2); // Two clusters
    expect(clusters[0].count).toBe(2); // First two events
    expect(clusters[1].count).toBe(1); // Last event alone
  });

  it('handles empty event list', () => {
    const clusters = clusterApneaEvents([], [], 120);
    expect(clusters).toHaveLength(0);
  });

  it('handles single event', () => {
    const events = [{ date: new Date('2024-01-01T22:00:00'), durationSec: 30 }];
    const clusters = clusterApneaEvents(events, [], 120);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].count).toBe(1);
  });

  it('validates numerical stability with close timestamps', () => {
    // Events 1ms apart
    const events = Array.from({ length: 100 }, (_, i) => ({
      date: new Date('2024-01-01T22:00:00.000Z').getTime() + i,
      durationSec: 15,
    }));

    const clusters = clusterApneaEvents(events, [], 120);

    // Should form single cluster
    expect(clusters).toHaveLength(1);
    expect(clusters[0].count).toBe(100);
  });
});
```

### Statistical Test Validation

```javascript
describe('Mann-Whitney U Test', () => {
  it('detects significant difference', () => {
    const group1 = [1, 2, 3, 4, 5]; // Low AHI
    const group2 = [20, 21, 22, 23, 24]; // High AHI

    const result = mannWhitneyUTest(group1, group2);

    expect(result.pValue).toBeLessThan(0.05);
  });

  it('handles identical distributions', () => {
    const group1 = [5, 5, 5, 5, 5];
    const group2 = [5, 5, 5, 5, 5];

    const result = mannWhitneyUTest(group1, group2);

    expect(result.pValue).toBeGreaterThan(0.05);
  });

  it('requires minimum sample size', () => {
    const group1 = [5];
    const group2 = [10];

    expect(() => mannWhitneyUTest(group1, group2)).toThrow(/sample size/i);
  });
});
```

## Medical Parameter Validation

### AHI Severity Classification

```javascript
function classifyAhiSeverity(ahi) {
  if (ahi < 0) return { valid: false, error: 'AHI cannot be negative' };
  if (ahi < 5) return { valid: true, severity: 'normal', description: 'No sleep apnea' };
  if (ahi < 15) return { valid: true, severity: 'mild', description: 'Mild sleep apnea' };
  if (ahi < 30)
    return { valid: true, severity: 'moderate', description: 'Moderate sleep apnea' };
  if (ahi <= 200)
    return { valid: true, severity: 'severe', description: 'Severe sleep apnea' };

  return { valid: false, error: 'AHI suspiciously high (> 200)' };
}
```

### EPAP Therapeutic Range

```javascript
function validateEpapTherapeutic(epap) {
  const THERAPEUTIC_MIN = 4.0; // cmH₂O
  const THERAPEUTIC_MAX = 20.0; // Most patients
  const DEVICE_MAX = 25.0; // Device maximum

  if (epap < THERAPEUTIC_MIN) {
    return { valid: false, warning: 'Below minimum therapeutic pressure' };
  }
  if (epap > DEVICE_MAX) {
    return { valid: false, warning: 'Exceeds device maximum' };
  }
  if (epap > THERAPEUTIC_MAX) {
    return { valid: true, warning: 'Unusually high pressure (> 20 cmH₂O)' };
  }

  return { valid: true };
}
```

## Confidence Intervals

```javascript
function calculateConfidenceInterval(values, confidenceLevel = 0.95) {
  const n = values.length;
  if (n < 2) return null;

  const mean = stableMean(values);
  const stdDev = stableStdDev(values);
  const stdError = stdDev / Math.sqrt(n);

  // Z-score for 95% CI
  const zScore = 1.96;

  return {
    mean: mean,
    lower: mean - zScore * stdError,
    upper: mean + zScore * stdError,
    stdError: stdError,
  };
}
```

## Resources

- **Statistics utilities**: `src/utils/stats.js`
- **Clustering algorithm**: `src/utils/clustering.js`
- **Test data builders**: oscar-test-data-generation skill
- **Medical thresholds**: `src/constants/thresholds.js`
