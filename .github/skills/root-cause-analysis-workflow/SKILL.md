---
name: root-cause-analysis-workflow
description: Systematic debugging and root cause analysis methodology. Use when investigating bugs, reproducing issues, or documenting diagnostic findings.
---

# Root Cause Analysis Workflow

This skill documents a systematic approach to debugging and root cause analysis, particularly for complex issues in the OSCAR Export Analyzer.

## Core Principles

1. **Form multiple hypotheses** before testing—don't commit to first guess
2. **Test one variable at a time** to isolate causes
3. **Distinguish symptoms from root causes**—treat causes, not symptoms
4. **Document the investigation process**, not just conclusions
5. **Verify fixes don't introduce regressions**

## Investigation Workflow

### Phase 1: Gather Evidence

**Goal:** Understand the problem comprehensively before forming hypotheses.

```markdown
## Evidence Checklist

- [ ] What is the observed behavior? (Screenshot, error message, unexpected output)
- [ ] What was the expected behavior?
- [ ] When did this start? (New feature? Specific commit? Always present?)
- [ ] Can it be reproduced? (Consistently? Sometimes? Once?)
- [ ] What environment? (Browser, OS, data size, user settings)
- [ ] Are there error messages? (Console, network, worker errors)
- [ ] What data triggers it? (Specific CSV? Date range? Edge case?)
```

**Tools:**

```javascript
// Browser DevTools
// - Console: Check for errors, warnings, logs
// - Network: Check API calls, worker messages
// - React DevTools: Check component state, props, renders
// - Performance: Check for slow operations
// - Sources: Set breakpoints in workers

// Check recent changes
git log --oneline -20
git diff HEAD~5 -- src/components/ChartComponent.jsx
```

### Phase 2: Form Hypotheses

**Goal:** Generate 3-5 possible explanations for the observed behavior.

```markdown
## Hypothesis Template

### Hypothesis A: [Name]

**Theory:** [What might be causing the issue]
**Evidence supporting:** [Observations that support this theory]
**Evidence against:** [Observations that contradict this theory]
**Testable prediction:** [What should happen if this is the cause]

### Hypothesis B: [Name]

...
```

**Example:**

```markdown
## Bug: Chart displays blank after CSV upload

### Hypothesis A: CSV Parsing Fails

**Theory:** CSV parser throws error, data never reaches chart
**Supporting:** No error message displayed, chart blank
**Against:** Console shows no parsing errors
**Prediction:** If true, `parsedData` should be empty/undefined

### Hypothesis B: Date Filtering Removes All Data

**Theory:** Date filter excludes all rows due to incorrect date parsing
**Supporting:** Date display shows "Invalid Date" in some rows
**Against:** Some dates parse correctly in test environment
**Prediction:** If true, unfiltered data should show in chart

### Hypothesis C: Web Worker Communication Broken

**Theory:** Worker parses successfully but message doesn't reach main thread
**Supporting:** Worker logs show successful parse (if checked)
**Against:** Other worker messages (progress) seem to work
**Prediction:** If true, adding worker.onmessage log should show no data messages
```

### Phase 3: Design Tests

**Goal:** Create experiments that definitively rule in/out each hypothesis.

```markdown
## Test Plan

### Test 1: Check Worker Message Receipt

**Hypothesis tested:** C (Worker communication)
**Method:** Add console.log in worker.onmessage handler
**Expected if hypothesis true:** No "data" messages received
**Expected if hypothesis false:** Messages received but not processed

### Test 2: Bypass Date Filter

**Hypothesis tested:** B (Date filtering)
**Method:** Temporarily disable date filter, render all data
**Expected if hypothesis true:** Chart shows data
**Expected if hypothesis false:** Chart still blank

### Test 3: Validate Parse Output

**Hypothesis tested:** A (CSV parsing)
**Method:** Log parsedData immediately after parsing
**Expected if hypothesis true:** parsedData empty or malformed
**Expected if hypothesis false:** parsedData contains valid objects
```

### Phase 4: Execute Tests

**Goal:** Run tests systematically, recording results.

```javascript
// Test execution example

// Test 1: Check worker messages
worker.onmessage = (event) => {
  console.log('[TEST] Worker message received:', event.data.type);
  if (event.data.type === 'success') {
    console.log('[TEST] Data length:', event.data.data?.length);
    console.log('[TEST] First row:', event.data.data?.[0]);
  }
  // ... existing handler
};

// Test 2: Bypass filter
function renderChart(data) {
  // const filtered = filterByDateRange(data, startDate, endDate);
  const filtered = data; // [TEST] Bypass filter
  return <Plot data={filtered} />;
}

// Test 3: Validate parse output
const parsed = parseCSV(csvText);
console.log('[TEST] Parsed rows:', parsed.length);
console.log('[TEST] First row:', parsed[0]);
console.log(
  '[TEST] Has required columns:',
  hasColumns(parsed, ['Date', 'AHI']),
);
```

**Record results:**

```markdown
## Test Results

### Test 1: Worker Message Receipt

**Outcome:** ✅ Messages received, data.length = 30
**Conclusion:** Worker communication working correctly
**Hypothesis C:** REJECTED

### Test 2: Bypass Date Filter

**Outcome:** ✅ Chart displays all 30 data points
**Conclusion:** Date filtering is removing all data
**Hypothesis B:** SUPPORTED

### Test 3: Validate Parse Output

**Outcome:** ✅ Parsed data looks correct (30 rows, valid dates)
**Conclusion:** Parsing works correctly
**Hypothesis A:** REJECTED
```

### Phase 5: Identify Root Cause

**Goal:** Determine the definitive cause based on test results.

````markdown
## Root Cause

**Confirmed cause:** Date filter incorrectly excludes all data

**Detailed explanation:**
Date filter compares Date objects, but parsed dates are ISO strings.
String comparison fails, all rows excluded.

**Evidence:**

- Test 2 showed chart works when filter bypassed
- Console inspection: `typeof startDate === 'object'`, `typeof row.date === 'string'`
- Date comparison: `'2024-01-15' >= new Date('2024-01-01')` evaluates incorrectly

**Fix:**
Convert row dates to Date objects before comparison:

```javascript
// Before (bug)
filtered = data.filter((row) => row.date >= startDate && row.date <= endDate);

// After (fixed)
filtered = data.filter((row) => {
  const rowDate = new Date(row.date);
  return rowDate >= startDate && rowDate <= endDate;
});
```
````

````

### Phase 6: Implement and Verify Fix

**Goal:** Apply fix and ensure issue resolved without regressions.

```markdown
## Fix Verification

1. [x] Applied fix to dateFilter.js
2. [x] Issue no longer reproduces with original test case
3. [x] Tested edge cases:
   - Empty date range
   - Single day selection
   - Full date range (all data)
   - Dates outside data range
4. [x] No regressions in existing tests (`npm test -- --run`)
5. [x] Added regression test for this specific bug
````

**Regression test:**

```javascript
describe('Date filter bug fix', () => {
  it('correctly filters string dates against Date objects', () => {
    const data = [
      { date: '2024-01-15', value: 10 },
      { date: '2024-01-20', value: 20 },
      { date: '2024-01-25', value: 30 },
    ];

    const filtered = filterByDateRange(
      data,
      new Date('2024-01-18'),
      new Date('2024-01-22'),
    );

    // Should include only middle row
    expect(filtered).toHaveLength(1);
    expect(filtered[0].date).toBe('2024-01-20');
  });
});
```

## Minimal Reproduction

**Goal:** Create smallest possible code that demonstrates the bug.

```javascript
// Minimal repro: Date filter bug
const data = [{ date: '2024-01-15' }];
const startDate = new Date('2024-01-01');

// Bug: String comparison with Date object
const filtered = data.filter((row) => row.date >= startDate);
console.log(filtered.length); // Expected: 1, Actual: 0

// Fix: Convert to Date before comparison
const filtered = data.filter((row) => new Date(row.date) >= startDate);
console.log(filtered.length); // Now: 1 ✅
```

## RCA Report Template

````markdown
# RCA: [Short Title]

**Date:** [YYYY-MM-DD]
**Investigator:** [@agent-name]
**Severity:** [Low/Medium/High]

## Summary

One-sentence description of the issue and root cause.

## Timeline

- **[Time]** — Issue first observed
- **[Time]** — Initial investigation began
- **[Time]** — Root cause identified
- **[Time]** — Fix implemented and verified

## Symptoms

- What users observed
- Error messages (if any)
- Affected functionality

## Investigation Process

### Hypotheses Considered

1. Hypothesis A: [description]
2. Hypothesis B: [description]
3. Hypothesis C: [description]

### Tests Performed

- Test 1: [description] → Result: [outcome]
- Test 2: [description] → Result: [outcome]

## Root Cause

**Cause:** [Detailed explanation]

**Why this happened:** [Context, how it was introduced]

**Code location:** [File path and line number]

## Fix

**Changes made:** [Description of fix]

**Code diff:**

```diff
- // Before
+ // After
```
````

**Verification:**

- [x] Original issue resolved
- [x] Edge cases tested
- [x] No regressions
- [x] Tests added

## Prevention

**How to prevent similar issues in the future:**

- Add type checking for date comparisons
- Enforce Date object type in filter function signature
- Add tests for string vs Date comparison edge cases

## Lessons Learned

- Type coercion in comparisons can fail silently
- Always test edge cases (string dates vs Date objects)
- Console inspection is critical for type debugging

```

```

## Common Debugging Patterns

### Web Worker Issues

```javascript
// Check if worker messages are sent/received
worker.postMessage({ type: 'test' });
worker.onmessage = (e) => console.log('[WORKER MSG]', e.data);

// Check worker errors
worker.onerror = (e) => console.error('[WORKER ERROR]', e);

// Inspect worker in DevTools → Sources → Workers
```

### React State Issues

```javascript
// Log renders to detect excessive updates
useEffect(() => {
  console.log('[RENDER] Component rendered with props:', props);
});

// Check React DevTools for component tree and state
```

### Async Timing Issues

```javascript
// Add delays to check race conditions
await new Promise((resolve) => setTimeout(resolve, 100));

// Check if issue still occurs with delay
```

### Chart Rendering Issues

```javascript
// Verify data format before passing to Plotly
console.log('Chart data:', {
  x: data.map((d) => d.date),
  y: data.map((d) => d.value),
  dataType: typeof data[0]?.date,
});
```

## When to Escalate

Stop investigating and escalate if:

- **Security concern:** Potential data leak, XSS, privacy violation
- **Architecture issue:** Requires design change, not bug fix
- **Dependency bug:** Issue in external library (Plotly, PapaParse)
- **Outside expertise:** Statistical algorithm, medical domain knowledge

## Resources

- **Debugger guide**: `docs/developer/debugging/`
- **Architecture docs**: `docs/developer/architecture.md`
- **Test patterns**: react-component-testing skill
- **Worker patterns**: oscar-web-worker-patterns skill
