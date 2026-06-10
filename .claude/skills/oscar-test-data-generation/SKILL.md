---
name: oscar-test-data-generation
description: Generate realistic synthetic CPAP/sleep therapy test data using the project's builders. Use when creating tests, examples, or validation scenarios that require OSCAR CSV data. Never use real patient data.
---

# OSCAR Test Data Generation

This skill provides patterns for generating realistic synthetic CPAP/sleep therapy test data for the OSCAR Export Analyzer project. All test data should be synthetic—never use real patient information.

## Core Builders

The project provides builder functions in `src/test-utils/builders.js` for generating test data:

### Session Builder

```javascript
import { buildSession } from '../test-utils/builders';

// Build a single CPAP session with custom values
const session = buildSession({
  date: '2024-01-15',
  ahi: 8.5,
  epap: 9.0,
  usage: 7.2,
  leak: 12.5,
});

// Build multiple sessions
const sessions = Array.from({ length: 30 }, (_, i) =>
  buildSession({
    date: new Date(2024, 0, i + 1).toISOString().split('T')[0],
    ahi: 5 + Math.random() * 10,
    epap: 8 + Math.random() * 2,
    usage: 6 + Math.random() * 3,
  }),
);
```

### Wearable Night Builder

The Fitbit API builders were removed with the OAuth integration (ADR-0003). Wearable
data is now nightly rollups built directly from the `WearableNight` model. Construct
synthetic nights with `createWearableNight` (and the helpers in `wearableNight.js`);
for ingestion tests, build small synthetic export file trees that exercise the
allowlist, schema drift, and the SpO2 `50.0` sentinel. See the
`oscar-wearable-integration` skill for the model and pipeline.

```javascript
import { createWearableNight } from '../utils/wearable/wearableNight';

// A synthetic nightly rollup record
const night = createWearableNight({
  date: '2024-01-15',
  spo2: { meanPct: 94.2, spo2ValidMinutes: 380, spo2SentinelMinutesRemoved: 0 },
  // ...hr / hrv / sleep groups as needed
});
```

## Common Test Scenarios

### High AHI Cases

```javascript
// Severe sleep apnea scenario
const highAhiSession = buildSession({
  date: '2024-01-15',
  ahi: 42.3, // Severe: > 30
  centralApneas: 15,
  obstructiveApneas: 25,
  hypopneas: 10,
  epap: 10.5,
  usage: 6.8,
  leak: 18.2,
});
```

### Zero Usage / Missing Data

```javascript
// Night with no therapy
const noUsageSession = buildSession({
  date: '2024-01-16',
  usage: 0,
  ahi: null, // No AHI when not used
  epap: null,
});
```

### Edge Case Values

```javascript
// Boundary values for validation testing
const edgeCases = [
  buildSession({ ahi: 0, epap: 4.0 }), // Minimum values
  buildSession({ ahi: 150, epap: 25 }), // Maximum values
  buildSession({ ahi: -1 }), // Invalid: negative
  buildSession({ date: 'invalid-date' }), // Invalid date format
];
```

### Time-Series Patterns

```javascript
// Therapy adjustment period (ramping up pressure)
const titrationPeriod = Array.from({ length: 14 }, (_, i) =>
  buildSession({
    date: new Date(2024, 0, i + 1).toISOString().split('T')[0],
    epap: 7 + i * 0.3, // Gradual increase
    ahi: 15 - i * 0.8, // Improving AHI
    usage: 7 + Math.random() * 0.5,
  }),
);

// Weekly pattern (worse on weekends)
const weeklyPattern = Array.from({ length: 30 }, (_, i) => {
  const dayOfWeek = i % 7;
  const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;

  return buildSession({
    date: new Date(2024, 0, i + 1).toISOString().split('T')[0],
    ahi: isWeekend ? 12 + Math.random() * 5 : 6 + Math.random() * 3,
    usage: isWeekend ? 5 + Math.random() * 2 : 7 + Math.random() * 1,
  });
});
```

### Correlation Scenarios (CPAP + wearable)

```javascript
// A CPAP session paired with its wearable nightly rollup, for alignment/correlation tests.
const correlatedNight = {
  cpap: buildSession({
    date: '2024-01-15',
    ahi: 25.3,
    usage: 7.2,
    epap: 9.0,
  }),
  wearable: createWearableNight({
    date: '2024-01-15',
    spo2: {
      meanPct: 92.1,
      spo2ValidMinutes: 360,
      spo2SentinelMinutesRemoved: 0,
    },
    hr: { meanBpm: 58 },
    sleep: { deepMinutes: 40, remMinutes: 30, lightMinutes: 60 },
  }),
};
```

## CSV Export Generation

```javascript
// Generate CSV string for upload testing
function generateCsvFromSessions(sessions) {
  const headers = ['Date', 'AHI', 'EPAP', 'Usage (hours)', 'Leak Rate'];
  const rows = sessions.map((s) =>
    [s.date, s.ahi, s.epap, s.usage, s.leak].join(','),
  );

  return [headers.join(','), ...rows].join('\n');
}

const csvContent = generateCsvFromSessions(sessions);
```

## Security Reminders

**NEVER use real patient data in test files:**

- ❌ Don't copy real OSCAR CSV exports
- ❌ Don't use actual AHI values from real patients
- ❌ Don't include real timestamps or identifiable patterns
- ✅ Use synthetic data with builder functions
- ✅ Document test scenarios by description ("high AHI case"), not values
- ✅ Generate random but realistic values

## Test Constants

```javascript
// Medical reference values (from testConstants.js)
export const MEDICAL_THRESHOLDS = {
  AHI_NORMAL: 5,
  AHI_MILD: 15,
  AHI_MODERATE: 30,
  EPAP_MIN: 4.0,
  EPAP_MAX: 25.0,
  USAGE_COMPLIANT: 4.0, // Hours per night
};
```

## Resources

- **Builder API**: `src/test-utils/builders.js`
- **Wearable night model**: `src/utils/wearable/wearableNight.js` (`createWearableNight`)
- **Test constants**: `src/test-utils/testConstants.js`
- **Mock hooks**: `src/test-utils/mockHooks.js`
- **Fixtures**: `src/test-utils/fixtures/`
