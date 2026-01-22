# Testing Work Plan — OSCAR Export Analyzer

## Prioritized Implementation for @testing-expert

**Prepared**: January 22, 2026  
**Current Status**: 159 tests passing ✅ | 1 skipped (useAnalyticsProcessing.test.js)  
**Evaluation Source**: [03-testing-evaluation.md](./2026-01-evaluation/03-testing-evaluation.md)

---

## Executive Summary

The test suite is in **excellent shape fundamentally** (159 passing tests, strong infrastructure). However, **5 distinct work areas remain** that impact code quality, accessibility, and maintainability. This plan prioritizes them by impact and addresses the gaps systematically.

**Key Facts**:

- ✅ All infrastructure issues fixed (localStorage mock, MutationObserver, etc.)
- ✅ All 12 hooks now tested (evaluation was outdated)
- ❌ 5 remaining gaps identified below
- ⏱️ Total estimated effort: 3-4 sprints

---

## Work Item #1: DateRangeControls Component Tests

**Status**: 🔴 BLOCKING  
**Priority**: HIGH  
**Effort**: 4-6 hours  
**Risk if Not Addressed**: MEDIUM

### What Needs Testing

The [DateRangeControls.jsx](../../../src/components/DateRangeControls.jsx) component is **used across 5+ features** (AHI Trends, EPAP Trends, Raw Explorer, etc.) but has **no dedicated test file**.

**Component responsibilities**:

- Quick range dropdown (all, 7, 14, 30 days)
- Custom start/end date inputs
- Date parsing and validation
- Reset functionality
- `onQuickRangeChange` and `onCustomRangeChange` callbacks

### Acceptance Criteria

Create `src/components/DateRangeControls.test.jsx` with tests covering:

1. **Quick range selection**:
   - Clicking "7 days" applies filter and calls `onQuickRangeChange('7')`
   - Clicking "all" clears date filters
   - Selected option stays highlighted

2. **Custom date inputs**:
   - User can type start and end dates
   - Invalid dates show error message
   - Start date before end date validation enforced
   - Callback triggered only on valid input

3. **Reset button**:
   - "Reset" clears all filters
   - Calls `onCustomRangeChange` with null values
   - Quick range reverts to default

4. **Edge cases**:
   - Leap year dates (Feb 29, 2024)
   - Date across month/year boundaries
   - Timezone handling (dates should be consistent)
   - Very large date ranges (multi-year)

5. **Accessibility** (optional but recommended):
   - Dropdown is keyboard accessible (Tab navigation)
   - Labels properly associated with inputs
   - Error messages announced to screen readers

### Suggested Test Structure

```javascript
describe('DateRangeControls', () => {
  describe('Quick range selection', () => {
    it('applies 7-day filter when selected', async () => {});
    it('clears dates when "all" is selected', async () => {});
  });

  describe('Custom date inputs', () => {
    it('allows typing start and end dates', async () => {});
    it('validates start date is before end date', async () => {});
    it('shows error for invalid date format', async () => {});
  });

  describe('Reset functionality', () => {
    it('clears all filters when reset button clicked', async () => {});
  });

  describe('Edge cases', () => {
    it('handles leap year dates correctly', async () => {});
    it('handles date range across year boundaries', async () => {});
  });
});
```

### Why This Matters

- **Risk**: Date filtering is core to user workflows. Bugs here cascade to multiple features.
- **Coverage gap**: 5+ components depend on DateRangeControls but can't verify correct behavior independently.
- **Regression protection**: Without tests, refactoring this component is risky.
- **Accessibility**: Users with visual impairments rely on proper ARIA labels here.

---

## Work Item #2: Accessibility Test Suite

**Status**: 🔴 BLOCKING  
**Priority**: HIGH  
**Effort**: 8-10 hours  
**Risk if Not Addressed**: MEDIUM-HIGH

### What Needs Testing

OSCAR is used by **older adults with vision impairments and motor difficulties**. Currently:

- ✅ ~20 tests use `getByRole()` (good semantic queries)
- ❌ Only 2 tests verify ARIA attributes (VizHelp.test.jsx)
- ❌ **Zero** keyboard navigation tests
- ❌ **Zero** focus management tests
- ❌ **Zero** screen reader announcement tests

### Acceptance Criteria

Create `src/tests/accessibility/` directory with test suites:

#### 1. **Keyboard Navigation** (`keyboard-navigation.test.jsx`)

Tests for:

- Tab order through forms (DateRangeControls, DataImportModal)
- Escape key closes modals
- Arrow keys work in menus/tabs
- Focus visible indicators present

**Example test**:

```javascript
it('closes modal when user presses Escape', async () => {
  const onClose = vi.fn();
  render(<DataImportModal isOpen onClose={onClose} />);

  await userEvent.keyboard('{Escape}');
  expect(onClose).toHaveBeenCalled();
});
```

#### 2. **ARIA Attributes** (`aria-attributes.test.jsx`)

Tests for:

- Icon buttons have `aria-label`
- Dropdowns have `aria-expanded`
- Error messages linked to inputs with `aria-describedby`
- Form regions labeled with `aria-label` or `<legend>`

**Example test**:

```javascript
it('announces error message to screen readers', async () => {
  render(<DateRangeControls startDate="invalid" />);
  const input = screen.getByLabelText(/start date/i);
  const error = screen.getByText(/invalid date format/i);

  expect(input).toHaveAttribute('aria-describedby', error.id);
});
```

#### 3. **Focus Management** (`focus-management.test.jsx`)

Tests for:

- Modal focus trap (Tab cycles within modal)
- Focus returns to trigger after modal closes
- Focus automatically moves to first field in form

**Example test**:

```javascript
it('traps focus within modal', async () => {
  render(<DataImportModal isOpen />);
  const modal = screen.getByRole('dialog');
  const buttons = within(modal).getAllByRole('button');

  buttons[buttons.length - 1].focus();
  await userEvent.tab();

  expect(document.activeElement).toBe(
    modal.querySelector('[role="dialog"] :first-child'),
  );
});
```

### Suggested Test Files

1. `tests/accessibility/keyboard-navigation.test.jsx` — 6-8 tests
2. `tests/accessibility/aria-attributes.test.jsx` — 8-10 tests
3. `tests/accessibility/focus-management.test.jsx` — 4-6 tests

**Total**: ~18-24 new tests

### Why This Matters

- **Legal**: WCAG 2.1 AA compliance (many healthcare apps required by law)
- **User inclusion**: Older adults with vision/motor disabilities depend on accessibility
- **Medical context**: CPAP users skew older (median age 55+)
- **Regression protection**: Ensure refactoring doesn't break accessibility

---

## Work Item #3: Utility Module Tests (db.js, colors.js, chartTheme.js)

**Status**: 🟡 MEDIUM  
**Priority**: MEDIUM  
**Effort**: 6-8 hours  
**Risk if Not Addressed**: LOW-MEDIUM

### What Needs Testing

Three utility modules currently untested:

#### 1. **db.js** (IndexedDB persistence)

- `putLastSession()` — stores session data
- `getLastSession()` — retrieves saved session
- `deleteLastSession()` — clears saved data

**Why it matters**: Persistence is critical. Without tests, IndexedDB changes are risky.

**Tests needed**:

```javascript
describe('db.js — IndexedDB persistence', () => {
  it('persists and retrieves session data', async () => {
    const session = { summaryData: [...], detailsData: [...] };
    await putLastSession(session);
    const retrieved = await getLastSession();
    expect(retrieved).toEqual(session);
  });

  it('returns null when no session saved', async () => {
    await deleteLastSession();
    const result = await getLastSession();
    expect(result).toBeNull();
  });

  it('overwrites previous session on second save', async () => {
    const session1 = { id: 1 };
    const session2 = { id: 2 };

    await putLastSession(session1);
    await putLastSession(session2);

    const retrieved = await getLastSession();
    expect(retrieved.id).toBe(2);
  });
});
```

#### 2. **colors.js** (Color utilities)

- Color palette definitions
- Color contrast utilities
- Color transformation functions

**Why it matters**: Visual correctness, accessibility (contrast ratios).

**Tests needed**:

```javascript
describe('colors.js', () => {
  it('provides accessible color contrast ratios', () => {
    // Verify WCAG AA compliance (4.5:1 for text)
  });

  it('handles color transformations (hex, rgb, hsl)', () => {
    // Test conversions
  });
});
```

#### 3. **chartTheme.js** (Theme application)

- Light/dark mode themes
- Plotly theme configuration
- Font styling

**Why it matters**: Chart accuracy, theme consistency.

**Tests needed**:

```javascript
describe('chartTheme.js', () => {
  it('returns theme colors for current mode', () => {
    const lightTheme = getChartTheme('light');
    const darkTheme = getChartTheme('dark');

    expect(lightTheme.backgroundColor).toBe('#ffffff');
    expect(darkTheme.backgroundColor).toBe('#1a1a1a');
  });

  it('applies theme to Plotly configuration', () => {
    const config = applyThemeToPlotly(lightTheme);
    expect(config.font.color).toBeDefined();
  });
});
```

### Acceptance Criteria

Create test files:

- `src/utils/db.test.js` — 5-8 tests
- `src/utils/colors.test.js` — 4-6 tests
- `src/utils/chartTheme.test.js` — 4-6 tests

**Total**: ~13-20 new tests

### Why This Matters

- **Data integrity**: Persistence without tests risks data loss
- **Visual correctness**: Theme/color bugs affect all visualizations
- **Accessibility**: Color contrast must meet WCAG standards

---

## Work Item #4: React act() Warnings

**Status**: 🟡 MEDIUM  
**Priority**: MEDIUM  
**Effort**: 2-3 hours  
**Risk if Not Addressed**: LOW

### What Needs Fixing

DataImportModal.test.jsx produces warnings:

```
An update to DataImportModal inside a test was not wrapped in act(...)
```

**Problem**: State updates outside React's act() indicate timing issues that could cause flaky tests.

### Acceptance Criteria

1. Identify which tests in `DataImportModal.test.jsx` trigger warnings
2. Wrap async operations in `waitFor()` or `act()`
3. Verify no warnings on test run: `npm test -- --run 2>&1 | grep "act()"`

**Example fix**:

```javascript
// Before (may warn):
await userEvent.click(submitBtn);
expect(modal).not.toBeInTheDocument();

// After (wrapped):
await waitFor(() => {
  expect(modal).not.toBeInTheDocument();
});
```

### Why This Matters

- **Flakiness**: Unwrapped updates can cause intermittent test failures
- **Reliability**: Clean test output makes problems easier to spot
- **Best practices**: act() warnings indicate test quality issues

---

## Work Item #5: Slow Test Investigation (DocsModal)

**Status**: 🟡 MEDIUM  
**Priority**: MEDIUM  
**Effort**: 2-4 hours  
**Risk if Not Addressed**: LOW

### What Needs Investigation

DocsModal.test.jsx takes **2.7 seconds for 7 tests** (380ms/test average). One test takes **2.69s individually**.

**Problem**: Likely timing issue or heavy DOM rendering slowing feedback loop.

### Acceptance Criteria

1. Identify which test is slow: `npm test -- --reporter=verbose DocsModal 2>&1`
2. Profile test execution (use console timing)
3. Implement fix (mocking, reducing async waits, etc.)
4. Verify test time reduced to <300ms

**Likely solutions**:

- Mock markdown parser if present
- Replace arbitrary `setTimeout()` with `waitFor()`
- Mock heavy components (if any)
- Split slow test into smaller assertions

### Why This Matters

- **Developer experience**: Slow tests discourage running locally
- **CI efficiency**: 2.7s × N test runs = significant pipeline time
- **Root cause**: May indicate real timing issues in component code

---

## Implementation Schedule

### Phase 1 (Week 1-2): Foundation

1. **DateRangeControls tests** — 4-6 hours
   - High impact, blocks multiple features
   - Foundation for accessibility work

### Phase 2 (Week 3-4): Accessibility

2. **Accessibility test suite** — 8-10 hours
   - High priority for medical app
   - Improves WCAG compliance

### Phase 3 (Week 4-5): Utilities

3. **db.js, colors.js, chartTheme.js tests** — 6-8 hours
   - Medium priority, solid benefits
   - More straightforward than Phase 2

### Phase 4 (Week 5): Polish

4. **React act() warnings** — 2-3 hours
5. **DocsModal slow test** — 2-4 hours

**Total Effort**: 22-31 hours (~1-1.5 sprints)

---

## Risk Assessment

| Work Item               | Risk if Skipped                                  | Severity    | Impact                            |
| ----------------------- | ------------------------------------------------ | ----------- | --------------------------------- |
| DateRangeControls tests | Feature bugs not caught, date filter regressions | MEDIUM      | Users; multiple features affected |
| Accessibility tests     | WCAG violations, excluded users                  | MEDIUM-HIGH | Legal; user experience            |
| Utility tests           | Data loss, visual bugs, persistence issues       | LOW-MEDIUM  | Data integrity; correctness       |
| act() warnings          | Flaky tests, hard-to-debug issues                | LOW         | Developer experience; reliability |
| DocsModal slow test     | Slow feedback loop, CI delays                    | LOW         | Developer experience              |

---

## Quality Gate Checklist

After implementation, verify:

- ✅ All new tests pass locally: `npm test -- --run`
- ✅ No new warnings in test output
- ✅ Coverage metrics maintained or improved
- ✅ Tests run in <15s total
- ✅ Code review by another team member
- ✅ Documentation updated (AGENTS.md, if needed)
- ✅ Cleanup: `docs/work/` and `temp/` directories empty before commit

---

## Success Criteria

| Metric               | Current         | Target       |
| -------------------- | --------------- | ------------ |
| Test pass rate       | 159/160 (99.4%) | 100%         |
| Component coverage   | 11/14 (79%)     | 14/14 (100%) |
| Accessibility tests  | 0               | 18-24        |
| Utility module tests | 0               | 13-20        |
| Total test count     | 160             | ~200         |

---

## Delegation Recommendations

### For @testing-expert:

- Lead all test implementation
- Design test strategy for accessibility (WCAG alignment)
- Code review all new tests

### Coordination with @documentation-specialist:

- Update [docs/developer/testing-guide.md](../../../docs/developer/) if it exists
- Document accessibility testing patterns for future reference
- Include db.js mocking patterns in developer docs

### Coordination with @debugger-rca-analyst:

- If DocsModal investigation reveals component bugs, file separate issues
- Create `docs/work/debugging/` notes during RCA (delete before commit)

---

## Related Issues & References

- Evaluation: [03-testing-evaluation.md](./2026-01-evaluation/03-testing-evaluation.md)
- Test guide: [docs/developer/setup.md](../../../docs/developer/setup.md)
- Current test state: `npm test -- --run` (159 passing)
- Architecture: [docs/developer/architecture.md](../../../docs/developer/architecture.md)

---

## Next Steps

1. ✅ Confirm this plan with @testing-expert
2. 📋 File GitHub issues for each work item (with labels: `testing`, `priority:high` etc.)
3. 🎯 Begin Phase 1 (DateRangeControls) immediately
4. 📊 Track progress in project board
5. ✍️ Document any patterns that become reusable (for future components)

---

**Plan Owner**: @orchestrator-manager  
**Implementation Owner**: @testing-expert  
**Status**: Ready for Implementation  
**Last Updated**: January 22, 2026
