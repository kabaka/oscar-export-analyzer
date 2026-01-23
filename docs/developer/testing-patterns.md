# Testing Patterns Guide

## Introduction

OSCAR Export Analyzer uses [Vitest](https://vitest.dev/) and [Testing Library](https://testing-library.com/) for testing. Our testing philosophy centers on **testing components and logic the way users interact with them**, rather than testing implementation details. This means:

- Using semantic queries (`getByRole`, `getByLabelText`) instead of test IDs when possible
- Testing user interactions (clicks, typing) rather than internal state
- Avoiding mocks unless necessary (especially for Context providers)
- Writing tests that remain valid even when implementation changes

Tests are colocated with source files (e.g., [DateRangeControls.test.jsx](../../src/components/DateRangeControls.test.jsx) next to [DateRangeControls.jsx](../../src/components/DateRangeControls.jsx)) to keep them discoverable and maintainable.

## Setup and Configuration

### Vitest Configuration

Vitest is configured in [vite.config.js](../../vite.config.js):

```javascript
test: {
  globals: true,              // Automatically import describe, it, expect
  environment: 'jsdom',       // Browser-like DOM environment
  setupFiles: './src/setupTests.js',
  include: ['src/**/*.test.{js,jsx,ts,tsx}', 'styles.*.test.js'],
  testTimeout: 20000,        // 20 seconds for async operations
}
```

### Setup File

[setupTests.js](../../src/setupTests.js) runs before all tests and provides:

- **Testing Library matchers** (`toBeInTheDocument`, `toHaveTextContent`, etc.)
- **localStorage mock** with full Storage API implementation
- **MutationObserver polyfill** for jsdom compatibility
- **Web Worker mocks** (customized per test suite)

Key setup pattern:

```javascript
import '@testing-library/jest-dom';
import { vi, beforeAll } from 'vitest';

const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

beforeAll(() => {
  globalThis.localStorage = localStorageMock;
});
```

### Running Tests

```bash
npm test              # Watch mode (reruns on file changes)
npm test -- --run     # Single run (CI mode)
npm run test:coverage # Generate coverage report
```

## Testing Components with Context

Many components depend on `DataContext` for session data and filtering. The key principle: **use real providers with test data rather than mocking Context**.

### Pattern

```javascript
import { render, screen } from '@testing-library/react';
import { DataProvider } from '@/context/DataContext';
import YourComponent from './YourComponent';

test('component displays session count', () => {
  render(
    <DataProvider>
      <YourComponent />
    </DataProvider>,
  );

  expect(screen.getByText(/sessions/i)).toBeInTheDocument();
});
```

### Real Example: Testing Context Updates

From [DataContext.test.jsx](../../src/context/DataContext.test.jsx):

```javascript
function Setter() {
  const { setSummaryData } = useData();
  return (
    <button onClick={() => setSummaryData([{ Date: '2025-06-01', AHI: 5 }])}>
      load
    </button>
  );
}

function Display() {
  const { summaryData } = useData();
  return <div>{summaryData ? summaryData.length : 0}</div>;
}

it('shares summary data updates across components', async () => {
  const user = userEvent.setup();
  render(
    <DataProvider>
      <Setter />
      <Display />
    </DataProvider>,
  );

  expect(screen.getByText('0')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /load/i }));
  await screen.findByText('1');
});
```

### Common Pitfalls

- ❌ **Don't mock Context unnecessarily** — mocking loses integration testing benefits
- ❌ **Don't test Context provider internals** — test components that consume the Context
- ✅ **Do provide realistic test data** via props to `DataProvider`
- ✅ **Do test cross-component interactions** to catch integration issues

### When to Use

Use this pattern when testing any component that calls `useData()` or `useFilteredSessions()`. For integration tests spanning multiple components, wrap the entire tree in providers using [AppProviders.jsx](../../src/app/AppProviders.jsx).

## Testing Custom Hooks

Testing hooks directly requires special handling since hooks can only be called inside React components.

### Pattern: Integration Testing via Components

Instead of testing hooks in isolation, test them through components that use them. This approach tests the hook's actual usage context.

From [App.worker.integration.test.jsx](../../src/App.worker.integration.test.jsx):

```javascript
it('parses CSVs via worker and displays summary analysis', async () => {
  render(
    <AppProviders>
      <AppShell />
    </AppProviders>,
  );

  const summary = new File(
    ['Date,Total Time\n2025-06-01,08:00:00'],
    'summary.csv',
  );
  const input = screen.getByLabelText(/CSV or session files/i);
  await userEvent.upload(input, [summary]);

  // Hook processes data; verify results appear in UI
  await waitFor(
    () => {
      expect(screen.getByText(/Valid nights analyzed/i)).toBeInTheDocument();
    },
    { timeout: 8000 },
  );
});
```

### Why Not Unit Test Hooks?

See [useAnalyticsProcessing.test.js](../../src/hooks/useAnalyticsProcessing.test.js):

```javascript
// NOTE: These tests are skipped due to a Vite/Vitest incompatibility issue.
// The hook creates Workers using `new Worker(new URL(..., import.meta.url))`,
// which causes Vite to attempt bundling the worker module during tests.
// This triggers an infinite loop or unbounded memory accumulation.
//
// The analytics logic is tested through:
// 1. Integration tests in App.worker.integration.test.jsx
// 2. Direct utility tests in utils/clustering.test.js
// 3. Manual testing in development
```

### Common Pitfalls

- ❌ **Don't isolate hooks from their component context** — loses realistic usage patterns
- ❌ **Don't mock Web Workers in hook tests** — test via integration instead
- ✅ **Do test hook logic via consuming components**
- ✅ **Do extract pure utility functions** for direct unit testing

### When to Use

Use integration testing for hooks that:

- Create Web Workers (`new Worker(new URL(..., import.meta.url))`)
- Depend heavily on React Context
- Manage complex async state

Extract and unit test pure logic separately (see [constants/time.test.js](../../src/constants/time.test.js)).

## Testing Web Workers

Web Workers run on separate threads and require mocking in tests. The pattern: **mock `global.Worker` before each test** and simulate worker messages.

### Pattern

From [App.csv-upload.test.jsx](../../src/App.csv-upload.test.jsx):

```javascript
describe('CSV uploads', () => {
  const OriginalWorker = global.Worker;

  beforeEach(() => {
    class MockWorker {
      constructor() {
        this.workerId = null;
      }
      postMessage({ file, workerId } = {}) {
        this.workerId = workerId;

        // Simulate async processing
        Promise.resolve().then(() => {
          const rows = [{ Date: '2025-06-01', 'Total Time': '08:00:00' }];

          // Send progress update
          this.onmessage?.({
            data: { workerId, type: 'rows', rows, cursor: file.size },
          });

          // Send completion
          this.onmessage?.({
            data: { workerId, type: 'complete' },
          });
        });
      }
      terminate() {}
    }
    global.Worker = MockWorker;
  });

  afterEach(() => {
    global.Worker = OriginalWorker; // Restore original
  });

  it('processes CSV via worker', async () => {
    render(
      <AppProviders>
        <AppShell />
      </AppProviders>,
    );

    const file = new File(['Date,AHI\n2025-06-01,5'], 'summary.csv');
    const input = screen.getByLabelText(/CSV or session files/i);
    await userEvent.upload(input, [file]);

    await waitFor(() => {
      expect(screen.getByText(/Valid nights/i)).toBeInTheDocument();
    });
  });
});
```

### Testing Worker Errors

From [App.worker.integration.test.jsx](../../src/App.worker.integration.test.jsx):

```javascript
it('renders an error message when CSV parsing fails', async () => {
  class ErrorWorker {
    postMessage({ workerId } = {}) {
      Promise.resolve().then(() => {
        this.onmessage?.({
          data: { workerId, type: 'error', error: 'Malformed CSV' },
        });
      });
    }
    terminate() {}
  }
  global.Worker = ErrorWorker;

  render(
    <AppProviders>
      <AppShell />
    </AppProviders>,
  );

  const file = new File(['bad'], 'bad.csv');
  await userEvent.upload(screen.getByLabelText(/CSV/i), [file]);

  await waitFor(() => {
    expect(screen.getByRole('alert')).toHaveTextContent('Malformed CSV');
  });
});
```

### Common Pitfalls

- ❌ **Don't forget `Promise.resolve()`** — synchronous callbacks break async test infrastructure
- ❌ **Don't forget to restore `OriginalWorker`** in `afterEach` — prevents test pollution
- ❌ **Don't test worker internals** — test the UI outcomes of worker processing
- ✅ **Do simulate realistic message sequences** (progress → rows → complete)
- ✅ **Do test error paths** (timeouts, malformed data, worker failures)

### When to Use

Use worker mocking for:

- CSV parsing tests ([App.csv-upload.test.jsx](../../src/App.csv-upload.test.jsx))
- Analytics processing ([App.worker.integration.test.jsx](../../src/App.worker.integration.test.jsx))
- Progress indicator tests ([App.import-progress.test.jsx](../../src/App.import-progress.test.jsx))

## Async Testing Patterns

Testing async operations requires waiting for DOM updates. Testing Library provides two key utilities: `waitFor` and `findBy*` queries.

### Pattern: `waitFor` for Assertions

Use `waitFor` when you need to wait for a condition to become true:

```javascript
import { waitFor } from '@testing-library/react';

it('displays summary after processing', async () => {
  // ... trigger async action ...

  await waitFor(
    () => {
      expect(screen.getByText(/Valid nights analyzed/i)).toBeInTheDocument();
    },
    { timeout: 8000 },
  );
});
```

### Pattern: `findBy*` for Queries

`findBy*` queries are shorthand for `waitFor` + `getBy*`:

```javascript
// These are equivalent:
const element = await screen.findByText(/Valid nights/i);

const element = await waitFor(() => screen.getByText(/Valid nights/i));
```

### Real Example: Multi-Step Async Flow

From [App.print.test.jsx](../../src/App.print.test.jsx):

```javascript
it('invokes window.print after data loads', async () => {
  window.print = vi.fn();

  render(
    <AppProviders>
      <AppShell />
    </AppProviders>,
  );

  // Step 1: Wait for file input to appear
  const input = await screen.findByLabelText(/CSV or session files/i);

  // Step 2: Upload files
  await userEvent.upload(input, [summaryFile, detailsFile]);

  // Step 3: Wait for processing to complete
  await waitFor(
    () => {
      expect(screen.getByRole('button', { name: /menu/i })).toBeInTheDocument();
    },
    { timeout: 8000 },
  );

  // Step 4: Open menu and click print
  const menuBtn = screen.getByRole('button', { name: /menu/i });
  await userEvent.click(menuBtn);

  const printItem = await screen.findByRole('menuitem', {
    name: /print page/i,
  });
  await userEvent.click(printItem);

  // Step 5: Verify print was called
  expect(window.print).toHaveBeenCalled();
});
```

### Common Pitfalls

- ❌ **Don't use arbitrary `setTimeout`** — use `waitFor` with specific assertions
- ❌ **Don't set timeout too short** — CI environments may be slower (default 20s is safe)
- ❌ **Don't forget `await`** — missing `await` causes flaky tests
- ✅ **Do chain async operations** sequentially with `await`
- ✅ **Do use descriptive timeout messages** in `waitFor` options

### When to Use

Use async patterns for:

- Web Worker processing (CSV parsing, analytics)
- User interactions triggering async state updates
- Modal/dialog open/close animations
- Network requests (if added in future)

## Synthetic Test Data

OSCAR Export Analyzer provides **builders** in [test-utils/builders.js](../../src/test-utils/builders.js) for creating realistic test data without using real patient information.

### Pattern: Using Builders

```javascript
import {
  buildSummaryRow,
  buildTrendWindowSequence,
} from '@/test-utils/builders';

const testData = [
  buildSummaryRow({ date: '2021-01-01', ahi: 5.2, medianEPAP: 8.5 }),
  buildSummaryRow({ date: '2021-01-02', ahi: 4.8, medianEPAP: 8.3 }),
];
```

### Available Builders

#### `buildSummaryRow`

Creates a daily summary row (from OSCAR's Summary CSV):

```javascript
buildSummaryRow(
  ({
    date = '2021-01-01',
    ahi, // AHI score (events/hour)
    medianEPAP, // Median EPAP pressure (cmH2O)
    totalTime, // Usage duration (HH:MM:SS format)
  } = {}),
);
```

#### `buildApneaDetail`

Creates an apnea event (from OSCAR's Details CSV):

```javascript
buildApneaDetail(
  ({
    event = 'ClearAirway', // Event type
    durationSec = 10, // Event duration in seconds
    dateTime = '2021-01-01T00:00:00Z',
  } = {}),
);
```

#### `buildTrendWindowSequence`

Creates a multi-night sequence (useful for time series tests):

```javascript
buildTrendWindowSequence({
  startDate = new Date('2021-01-01'),
  nights = 30,                      // Number of nights
  valueAccessor: (i, formatted) => ({ AHI: 5 + i * 0.1 })
})
```

### Real Example: Chart Component Test

From [AhiTrendsCharts.test.jsx](../../src/components/AhiTrendsCharts.test.jsx):

```javascript
import { buildSummaryRow } from '../test-utils/builders';

const data = [
  buildSummaryRow({ date: '2021-01-01', ahi: 1 }),
  buildSummaryRow({ date: '2021-01-02', ahi: 5 }),
  buildSummaryRow({ date: '2021-01-03', ahi: 10 }),
];

it('renders plotly charts with help tooltips', () => {
  render(<AhiTrendsCharts data={data} />);

  expect(screen.getAllByTestId('plotly-chart').length).toBeGreaterThan(0);
  expect(screen.getByText(/Trend\/Seasonal\/Residual/i)).toBeInTheDocument();
});
```

### Common Pitfalls

- ❌ **NEVER use real patient data** in tests — even "anonymized" samples
- ❌ **Don't hardcode CSV strings** — use builders for maintainability
- ❌ **Don't create unrealistic edge cases** without documenting why
- ✅ **Do vary test data** (different AHI ranges, missing days, outliers)
- ✅ **Do document medical context** when testing severity thresholds

### When to Use

Use builders for:

- Component rendering tests
- Chart visualization tests
- Statistical calculation tests (coordinate with `@data-scientist` for validation)
- Edge case testing (zero values, extremes, missing data)

## Accessibility Testing

Testing accessibility ensures keyboard navigation, screen reader compatibility, and WCAG compliance. Focus on **semantic HTML and ARIA attributes**.

### Pattern: Semantic Queries

From [aria-attributes.test.jsx](../../src/tests/accessibility/aria-attributes.test.jsx):

```javascript
describe('DateRangeControls ARIA labels', () => {
  it('has aria-label on quick range selector', () => {
    render(<DateRangeControls {...props} />);

    const select = screen.getByRole('combobox', { name: /quick range/i });
    expect(select).toHaveAttribute('aria-label', 'Quick range');
  });

  it('has aria-label on start date input', () => {
    render(<DateRangeControls {...props} />);

    const input = screen.getByLabelText('Start date');
    expect(input).toHaveAttribute('aria-label', 'Start date');
  });
});
```

### Testing Keyboard Navigation

From [HeaderMenu.test.jsx](../../src/components/HeaderMenu.test.jsx):

```javascript
it('triggers menu actions via keyboard', async () => {
  const user = userEvent.setup();
  render(<HeaderMenu {...props} />);

  // Open menu with keyboard
  const menuBtn = screen.getByRole('button', { name: /menu/i });
  await user.click(menuBtn);

  // Navigate and activate menu item
  const loadItem = screen.getByRole('menuitem', { name: /load data/i });
  await user.click(loadItem);

  expect(props.onOpenImport).toHaveBeenCalled();
});
```

### Testing Dialogs and Modals

```javascript
it('opens dialog with proper ARIA role', async () => {
  render(<Component />);

  // Verify dialog has correct role
  const dialog = await screen.findByRole('dialog', { name: /Import Data/i });
  expect(dialog).toBeInTheDocument();

  // Verify close button
  const closeBtn = screen.getByRole('button', { name: /close/i });
  await userEvent.click(closeBtn);

  expect(dialog).not.toBeInTheDocument();
});
```

### Common Pitfalls

- ❌ **Don't use `getByTestId` when semantic queries work** — misses accessibility issues
- ❌ **Don't test CSS styling details** — focus on semantic HTML structure
- ❌ **Don't assume mouse-only interactions** — test keyboard navigation
- ✅ **Do use `getByRole` as first choice** — mirrors screen reader behavior
- ✅ **Do verify ARIA labels** on inputs without visible labels
- ✅ **Do test focus management** (modals, dropdowns)

### Accessibility Query Priority

1. `getByRole` (best: matches ARIA roles)
2. `getByLabelText` (good: matches form labels)
3. `getByText` (acceptable: matches visible text)
4. `getByTestId` (last resort: implementation detail)

### When to Use

Test accessibility for:

- Form controls (inputs, selects, buttons)
- Interactive components (menus, modals, tabs)
- Custom widgets (date pickers, charts with tooltips)
- Navigation elements (links, TOC)

## Snapshot Testing

Snapshot testing captures component output and detects unintended changes. Use sparingly — snapshots are brittle and hard to review.

### Pattern

From [KPICard.test.jsx](../../src/components/ui/KPICard.test.jsx):

```javascript
it('renders title, value, and children', () => {
  const { asFragment } = render(
    <KPICard title="Test KPI" value="42">
      <span>Child Content</span>
    </KPICard>,
  );

  // Specific assertions (preferred)
  expect(screen.getByText('Test KPI')).toBeInTheDocument();
  expect(screen.getByText('42')).toBeInTheDocument();

  // Snapshot (supplemental)
  expect(asFragment()).toMatchSnapshot();
});
```

### When to Use Snapshots

✅ **Good use cases:**

- Small, stable UI components (cards, badges, buttons)
- Complex nested structures (confirming all props render)
- Regression testing after refactors

❌ **Bad use cases:**

- Large component trees (snapshots too big to review)
- Components with dynamic data (dates, random values)
- Testing implementation details (CSS classes, inline styles)

### Common Pitfalls

- ❌ **Don't rely solely on snapshots** — add specific assertions first
- ❌ **Don't snapshot entire pages** — too brittle, breaks on any change
- ❌ **Don't blindly accept snapshot updates** — review diffs carefully
- ✅ **Do update snapshots intentionally** after verified changes
- ✅ **Do keep snapshots small** (prefer `asFragment()` on specific nodes)
- ✅ **Do combine snapshots with semantic assertions**

### Updating Snapshots

```bash
npm test -- --run -u  # Update all snapshots
npm test -- --run -u src/components/KPICard.test.jsx  # Update specific file
```

Review snapshot diffs in Git before committing.

## Coverage Guidelines

Code coverage measures which lines are executed during tests. While 100% coverage is a useful goal, **coverage metrics don't guarantee test quality**.

### What Coverage Means

- **Line coverage**: Percentage of lines executed
- **Branch coverage**: Percentage of `if`/`else` branches taken
- **Function coverage**: Percentage of functions called
- **Statement coverage**: Percentage of statements executed

### Generating Coverage Reports

```bash
npm run test:coverage

# Open HTML report:
open coverage/index.html  # macOS
xdg-open coverage/index.html  # Linux
```

### What to Focus On

**High-value testing:**

- ✅ Critical paths (CSV parsing, data filtering, statistical calculations)
- ✅ Error handling (invalid inputs, missing data, edge cases)
- ✅ User interactions (button clicks, form submissions, navigation)
- ✅ Business logic (AHI severity classification, date range filtering)

**Low-value testing:**

- ❌ Simple getters/setters
- ❌ Render-only components (if they have no logic)
- ❌ Constants and type definitions
- ❌ Third-party library wrappers (unless adding logic)

### Real Example: Testing Constants

From [constants/time.test.js](../../src/constants/time.test.js):

```javascript
describe('time constants', () => {
  it('compose correctly across seconds and milliseconds', () => {
    expect(SECONDS_PER_HOUR).toBe(SECONDS_PER_MINUTE * MINUTES_PER_HOUR);
    expect(SECONDS_PER_DAY).toBe(SECONDS_PER_HOUR * HOURS_PER_DAY);
    expect(MILLISECONDS_PER_DAY).toBe(MILLISECONDS_PER_HOUR * HOURS_PER_DAY);
  });
});
```

This validates that derived constants are computed correctly — critical for time-based calculations.

### Coverage Gaps Are OK

Not every line needs a test. Valid reasons for gaps:

- **Defensive programming**: Error handlers for "impossible" states
- **Development-only code**: Debug logging, console warnings
- **External dependencies**: Plotly chart internals, worker setup

### Common Pitfalls

- ❌ **Don't chase 100% coverage blindly** — focus on meaningful tests
- ❌ **Don't test implementation details** just to boost coverage
- ❌ **Don't skip edge cases** because "happy path" has coverage
- ✅ **Do test error paths** (often missed in coverage)
- ✅ **Do prioritize integration tests** over excessive unit tests
- ✅ **Do document intentional gaps** (e.g., skipped worker tests)

### When to Use Coverage Reports

- **Before commits**: Verify new code has tests
- **During refactors**: Ensure tests still cover critical paths
- **Investigating bugs**: Check if failed code paths are tested
- **Planning test strategy**: Identify untested modules

---

## Quick Reference: Common Test Patterns

### Component with Props

```javascript
it('renders with props', () => {
  render(<Component title="Test" count={42} />);
  expect(screen.getByText('Test')).toBeInTheDocument();
});
```

### User Interaction

```javascript
it('handles click events', async () => {
  const user = userEvent.setup();
  render(<Component onSave={mockFn} />);

  await user.click(screen.getByRole('button', { name: /save/i }));
  expect(mockFn).toHaveBeenCalled();
});
```

### Async Data Loading

```javascript
it('loads data asynchronously', async () => {
  render(<Component />);

  await waitFor(() => {
    expect(screen.getByText(/loaded/i)).toBeInTheDocument();
  });
});
```

### Error Boundaries

```javascript
it('catches errors', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});

  render(
    <ErrorBoundary fallback="Error occurred">
      <BrokenComponent />
    </ErrorBoundary>,
  );

  expect(screen.getByText('Error occurred')).toBeInTheDocument();
  console.error.mockRestore();
});
```

### Mocking Web Workers

```javascript
beforeEach(() => {
  class MockWorker {
    postMessage({ workerId }) {
      Promise.resolve().then(() => {
        this.onmessage?.({ data: { workerId, type: 'complete' } });
      });
    }
    terminate() {}
  }
  global.Worker = MockWorker;
});
```

---

## Further Reading

- [Testing Library Docs](https://testing-library.com/docs/react-testing-library/intro)
- [Vitest API Reference](https://vitest.dev/api/)
- [ARIA Roles and Attributes](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles)
- [Common Testing Mistakes](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Testing Accessibility](https://www.w3.org/WAI/test-evaluate/)

For project-specific guidance, see:

- [Adding Features](adding-features.md) — Testing requirements for new features
- [Architecture](architecture.md) — Understanding component interactions
- [Development Setup](setup.md) — Running tests locally

---

**Happy testing! Remember: tests should make you confident in changes, not afraid to refactor.**
