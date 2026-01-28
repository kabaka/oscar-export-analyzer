## Fitbit OAuth E2E Cross-Browser Patterns

### Modal Dismissal (WebKit)

- WebKit (Safari) sometimes fails to dismiss modals due to animation timing or focus issues.
- Use `force: browserName === 'webkit'` on `.click()` for modal buttons.
- Add `await page.waitForTimeout(150)` after click (WebKit only).
- Assert modal is hidden with `toBeHidden({ timeout: 5000 })`.
- For WebKit, double-check with `waitForSelector(..., { state: 'detached' })`.

Example:

```js
if (browserName === 'webkit') {
  await page.waitForTimeout(150);
  await page.waitForSelector('[role="alertdialog"]', {
    state: 'detached',
    timeout: 5000,
  });
}
```

### Async Navigation & OAuth Redirects

- Use `waitForRequest` for both `/oauth2/authorize` and `/oauth2/token`.
- Use `waitForURL(/oauth-callback|p=oauth-callback/, { timeout: 15000 })` to ensure navigation completes.
- Use `waitForFunction` to assert hash navigation after OAuth completes.

### Console Error Capture

- Capture both `console.error` and `pageerror` events to assert no "Invalid OAuth state" errors.

### Route Interception

- Intercept Fitbit endpoints and simulate 404 for `/oauth-callback` to match GitHub Pages behavior.
- Use HTML meta refresh for WebKit to simulate redirect.

### Coordination

- These patterns are now permanent documentation (see [fitbit-integration.md](fitbit-integration.md#e2e-playwright-cross-browser-patterns)).

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

## Playwright E2E: Modal Dismissal Patterns (WebKit Workaround)

### Background

When running Playwright E2E tests, dismissing modals (such as storage consent dialogs) can be unreliable in WebKit due to animation timing and focus quirks. WebKit sometimes fails to register modal dismissal if the click occurs before the animation completes, or if the modal is not fully attached/detached in the DOM.

### Pattern: Robust Modal Dismissal (WebKit)

**Workaround:**

- Use `click({ force: browserName === 'webkit' })` to ensure the click is registered even if the modal is partially obscured or animating.
- After clicking, add a short `waitForTimeout(150)` (or similar) to allow the modal's exit animation to finish before asserting it is hidden.
- Use both `toBeHidden({ timeout: 5000 })` and, for WebKit, `waitForSelector('[role="alertdialog"]', { state: 'detached', timeout: 5000 })` to confirm the modal is fully removed from the DOM.

**Example:**

```js
async function dismissStorageConsent(page, browserName) {
  const consentDialog = page.getByRole('alertdialog', {
    name: /save data to this browser/i,
  });
  if (await consentDialog.isVisible().catch(() => false)) {
    const askLater = page.getByRole('button', { name: /ask me later/i });
    if (await askLater.isVisible().catch(() => false)) {
      await askLater.click({ force: browserName === 'webkit' });
    } else {
      await page
        .getByRole('button', { name: /don't save/i })
        .click({ force: browserName === 'webkit' });
    }
    // WebKit workaround: wait for animation/frame before asserting hidden
    if (browserName === 'webkit') {
      await page.waitForTimeout(150); // allow modal animation to finish
    }
    await expect(consentDialog).toBeHidden({ timeout: 5000 });
    // Extra: on WebKit, double-check with waitForSelector
    if (browserName === 'webkit') {
      await page.waitForSelector('[role="alertdialog"]', {
        state: 'detached',
        timeout: 5000,
      });
    }
  }
}
```

**Best Practices:**

- Always use `force: browserName === 'webkit'` for modal dismissal clicks in WebKit.
- Wait for both hidden and detached states before proceeding with assertions.
- Add a short timeout after click to allow for animation completion.
- Avoid relying solely on visibility; check DOM detachment for full reliability.
- Apply this pattern to any modal/dialog dismissal in Playwright E2E tests targeting WebKit.

**See Also:**

- [tests/e2e/fitbit-oauth-complete-flow.spec.js](../../tests/e2e/fitbit-oauth-complete-flow.spec.js) — Example usage in OAuth E2E flow

---

## Accessibility Testing

Testing accessibility ensures keyboard navigation, screen reader compatibility, and WCAG 2.1 AA compliance. OSCAR Export Analyzer prioritizes **semantic HTML, proper ARIA attributes, and comprehensive keyboard navigation tests**.

### Accessibility Testing Strategy

Accessibility testing covers three key areas:

1. **Semantic HTML & ARIA Attributes**: Elements have correct roles, labels, and ARIA attributes
2. **Keyboard Navigation**: All functionality works via Tab, Enter, Space, Escape, and Arrow keys
3. **Focus Management**: Focus order is logical; modals trap focus; focus is restored after dialogs close

**Target Compliance**: WCAG 2.1 Level AA

---

### Accessibility Pattern 1: Semantic Queries and ARIA Attributes

Use `getByRole` as the first choice—it mirrors how screen readers perceive the interface.

From [DateRangeControls.test.jsx](../../src/components/DateRangeControls.test.jsx):

```javascript
describe('DateRangeControls - ARIA Attributes', () => {
  it('has aria-label on quick range selector', () => {
    render(<DateRangeControls {...props} />);

    const select = screen.getByRole('combobox', { name: /quick range/i });
    expect(select).toHaveAttribute('aria-label', 'Quick range');
  });

  it('has aria-label on date inputs', () => {
    render(<DateRangeControls {...props} />);

    expect(screen.getByLabelText('Start date')).toBeInTheDocument();
    expect(screen.getByLabelText('End date')).toBeInTheDocument();
  });

  it('reset button has accessible name when visible', () => {
    render(<DateRangeControls initialStart="2025-01-01" {...props} />);

    const resetBtn = screen.getByRole('button', { name: /reset/i });
    expect(resetBtn).toBeInTheDocument();
  });
});
```

### Accessibility Pattern 2: Keyboard Navigation — Tab Order

Test that keyboard users can navigate controls in logical order without mouse.

From [DateRangeControls.test.jsx](../../src/components/DateRangeControls.test.jsx):

```javascript
describe('DateRangeControls - Keyboard Navigation', () => {
  it('maintains correct tab order: select → start date → end date → reset', async () => {
    const user = userEvent.setup();
    render(
      <DateRangeControls
        initialStart="2025-01-01"
        initialEnd="2025-01-15"
        {...props}
      />,
    );

    const select = screen.getByRole('combobox', { name: /quick range/i });
    const startInput = screen.getByLabelText('Start date');
    const endInput = screen.getByLabelText('End date');
    const resetBtn = screen.getByRole('button', { name: /reset/i });

    // Tab through in order
    select.focus();
    expect(select).toHaveFocus();

    await user.tab();
    expect(startInput).toHaveFocus();

    await user.tab();
    expect(endInput).toHaveFocus();

    await user.tab();
    expect(resetBtn).toHaveFocus();
  });

  it('reverse tabs through controls with Shift+Tab', async () => {
    const user = userEvent.setup();
    render(<DateRangeControls initialStart="2025-01-01" {...props} />);

    const resetBtn = screen.getByRole('button', { name: /reset/i });
    resetBtn.focus();

    await user.tab({ shift: true }); // Shift+Tab
    expect(screen.getByLabelText('End date')).toHaveFocus();

    await user.tab({ shift: true });
    expect(screen.getByLabelText('Start date')).toHaveFocus();
  });
});
```

### Accessibility Pattern 3: Keyboard Navigation — Arrow Keys in Menus

Test dropdown and menu navigation with arrow keys.

From [HeaderMenu.test.jsx](../../src/components/HeaderMenu.test.jsx):

```javascript
describe('HeaderMenu - Arrow Key Navigation', () => {
  it('opens menu and navigates items with arrow keys', async () => {
    const user = userEvent.setup();
    render(<HeaderMenu hasAnyData={true} {...props} />);

    const menuBtn = screen.getByRole('button', { name: /menu/i });
    await user.click(menuBtn);

    const items = screen.getAllByRole('menuitem');
    const firstItem = items[0];

    // Focus first item and navigate down
    firstItem.focus();
    expect(firstItem).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    if (items.length > 1) {
      expect(items[1]).toHaveFocus();
    }

    await user.keyboard('{ArrowUp}');
    expect(firstItem).toHaveFocus();
  });

  it('activates menu item with Enter key', async () => {
    const user = userEvent.setup();
    const onOpenImport = vi.fn();
    render(
      <HeaderMenu hasAnyData={false} onOpenImport={onOpenImport} {...props} />,
    );

    const menuBtn = screen.getByRole('button', { name: /menu/i });
    await user.click(menuBtn);

    const loadItem = screen.getByRole('menuitem', { name: /load data/i });
    loadItem.focus();

    await user.keyboard('{Enter}');

    expect(onOpenImport).toHaveBeenCalled();
    expect(menuBtn).toHaveAttribute('aria-expanded', 'false');
  });
});
```

### Accessibility Pattern 4: Focus Management — Modals and Dialogs

Test focus trapping (Tab cycles within modal) and focus restoration (focus returns after closing).

From [DataImportModal.test.jsx](../../src/components/ui/DataImportModal.test.jsx):

```javascript
describe('DataImportModal - Focus Management', () => {
  it('has proper dialog role and ARIA attributes', () => {
    render(<DataImportModal isOpen={true} {...props} />);

    const modal = screen.getByRole('dialog');
    expect(modal).toHaveAttribute('aria-label', /import/i);
    expect(modal).toHaveAttribute('aria-modal', 'true');
  });

  it('close button is focusable and activates on Enter', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<DataImportModal isOpen={true} onClose={onClose} {...props} />);

    const closeBtn = screen.getByRole('button', { name: /close/i });
    closeBtn.focus();

    expect(closeBtn).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(onClose).toHaveBeenCalled();
  });

  it('provides accessible label for file input', () => {
    render(<DataImportModal isOpen={true} {...props} />);

    // File input should have a label or aria-label
    const fileInput = screen.getByLabelText(/files?/i);
    expect(fileInput).toHaveAttribute('accept', expect.stringContaining('csv'));
  });
});
```

### Pattern 5: Disabled Items and States

Test that disabled controls are properly marked and skipped during tab navigation.

From [HeaderMenu.test.jsx](../../src/components/HeaderMenu.test.jsx):

```javascript
describe('HeaderMenu - Disabled Items', () => {
  it('skips disabled menu items when tabbing', async () => {
    const user = userEvent.setup();
    render(
      <HeaderMenu hasAnyData={false} summaryAvailable={false} {...props} />,
    );

    const menuBtn = screen.getByRole('button', { name: /menu/i });
    await user.click(menuBtn);

    const items = screen.getAllByRole('menuitem');
    const enabledItems = items.filter((item) => !item.disabled);

    if (enabledItems.length > 0) {
      enabledItems[0].focus();
      await user.tab();

      // Should tab to next enabled item, not a disabled one
      expect(document.activeElement).toHaveAttribute('role', 'menuitem');
    }
  });

  it('marks disabled items appropriately for screen readers', () => {
    render(
      <HeaderMenu hasAnyData={false} summaryAvailable={false} {...props} />,
    );

    const menuBtn = screen.getByRole('button', { name: /menu/i });
    userEvent.click(menuBtn);

    const disabledItems = screen
      .getAllByRole('menuitem')
      .filter((item) => item.disabled);
    disabledItems.forEach((item) => {
      expect(item).toHaveAttribute('disabled');
    });
  });
});
```

### Pattern 6: Escape Key to Close Dialogs

Test that pressing Escape closes modals and returns focus appropriately.

```javascript
describe('Modal - Escape Key', () => {
  it('closes dialog when Escape is pressed', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<DataImportModal isOpen={true} onClose={onClose} {...props} />);

    const modal = screen.getByRole('dialog');
    modal.focus();

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalled();
  });
});
```

### Accessibility Pattern 5: Disabled Items and States

Test that disabled controls are properly marked and skipped during tab navigation.

From [HeaderMenu.test.jsx](../../src/components/HeaderMenu.test.jsx):

```javascript
describe('HeaderMenu - Disabled Items', () => {
  it('skips disabled menu items when tabbing', async () => {
    const user = userEvent.setup();
    render(
      <HeaderMenu hasAnyData={false} summaryAvailable={false} {...props} />,
    );

    const menuBtn = screen.getByRole('button', { name: /menu/i });
    await user.click(menuBtn);

    const items = screen.getAllByRole('menuitem');
    const enabledItems = items.filter((item) => !item.disabled);

    if (enabledItems.length > 0) {
      enabledItems[0].focus();
      await user.tab();

      // Should tab to next enabled item, not a disabled one
      expect(document.activeElement).toHaveAttribute('role', 'menuitem');
    }
  });

  it('marks disabled items appropriately for screen readers', () => {
    render(
      <HeaderMenu hasAnyData={false} summaryAvailable={false} {...props} />,
    );

    const menuBtn = screen.getByRole('button', { name: /menu/i });
    userEvent.click(menuBtn);

    const disabledItems = screen
      .getAllByRole('menuitem')
      .filter((item) => item.disabled);
    disabledItems.forEach((item) => {
      expect(item).toHaveAttribute('disabled');
    });
  });
});
```

### Accessibility Pattern 6: Escape Key to Close Dialogs

Test that pressing Escape closes modals and returns focus appropriately.

```javascript
describe('Modal - Escape Key', () => {
  it('closes dialog when Escape is pressed', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<DataImportModal isOpen={true} onClose={onClose} {...props} />);

    const modal = screen.getByRole('dialog');
    modal.focus();

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalled();
  });
});
```

### Accessibility Test Coverage in OSCAR Analyzer

The project currently has **67 accessibility tests** across 3 critical components:

| Component             | Tests  | Coverage                                                               |
| --------------------- | ------ | ---------------------------------------------------------------------- |
| **HeaderMenu**        | 17     | Keyboard navigation, ARIA attributes, focus management, disabled items |
| **DateRangeControls** | 26     | Tab order, dropdown navigation, ARIA labels, reset button, arrow keys  |
| **DataImportModal**   | 24     | Dialog role, focus management, file input accessibility, close button  |
| **Total**             | **67** | **WCAG 2.1 AA compliance for critical interactions**                   |

All tests pass and prevent accessibility regressions.

### Accessibility Query Priority

1. `getByRole` (best: matches ARIA roles and screen reader behavior)
2. `getByLabelText` (good: matches form labels)
3. `getByText` (acceptable: matches visible text)
4. `getByTestId` (last resort: implementation detail; misses accessibility issues)

### Accessibility Testing Pitfalls

- ❌ **Don't use `getByTestId` when semantic queries work** — misses accessibility issues
- ❌ **Don't test CSS styling details** — focus on semantic HTML structure
- ❌ **Don't assume mouse-only interactions** — test keyboard navigation
- ❌ **Don't forget to test disabled states** — disabled items should be skipped in tab order
- ✅ **Do use `getByRole` as first choice** — mirrors screen reader behavior
- ✅ **Do verify ARIA labels** on inputs without visible labels
- ✅ **Do test focus management** (modals, dropdowns, focus trapping)
- ✅ **Do test disabled items** in tab order
- ✅ **Do test Escape key** in modals and dialogs

### When to Add Accessibility Tests

Add accessibility tests for:

- **Form controls** (inputs, selects, buttons, checkboxes, radio groups)
- **Interactive components** (menus, modals, tabs, dropdowns)
- **Custom widgets** (date pickers, charts with tooltips, sliders)
- **Navigation elements** (links, breadcrumbs, TOC)
- **Disabled states** (ensure proper ARIA and tab order handling)
- **Focus-dependent behavior** (auto-focus, focus restoration, focus trapping)

## Snapshot Testing

Snapshot testing captures component output and detects unintended changes. Use sparingly — snapshots are brittle and hard to review.

### Snapshot Testing Pattern

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

### Snapshot Testing Pitfalls

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

### Coverage Pitfalls

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

## Testing Fitbit Integration

### OAuth Flow Testing

The Fitbit OAuth flow requires special handling for secure authentication:

```javascript
// src/features/fitbit/__tests__/FitbitAuth.test.jsx
describe('Fitbit OAuth Flow', () => {
  const mockSessionStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  };

  beforeEach(() => {
    Object.defineProperty(window, 'sessionStorage', {
      value: mockSessionStorage,
    });

    // Mock crypto.getRandomValues for PKCE
    Object.defineProperty(global, 'crypto', {
      value: {
        getRandomValues: vi.fn(() => new Uint8Array(32).fill(1)),
        subtle: {
          digest: vi.fn(() => Promise.resolve(new ArrayBuffer(32))),
        },
      },
    });
  });

  it('initiates OAuth with PKCE parameters', async () => {
    const mockInitiateAuth = vi.fn();

    render(
      <FitbitConnectionCard
        connectionStatus="disconnected"
        onConnect={mockInitiateAuth}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /connect to fitbit/i }));

    expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
      'fitbit_pkce_verifier',
      expect.any(String),
    );

    expect(mockInitiateAuth).toHaveBeenCalledWith({
      codeChallenge: expect.any(String),
      codeChallengeMethod: 'S256',
      scopes: ['heartrate', 'sleep', 'oxygen_saturation'],
    });
  });

  it('handles authorization callback securely', async () => {
    mockSessionStorage.getItem.mockReturnValue('mock-verifier');

    const mockHandleCallback = vi.fn();

    render(
      <FitbitOAuthCallback
        authCode="mock-auth-code"
        onSuccess={mockHandleCallback}
      />,
    );

    await waitFor(() => {
      expect(mockHandleCallback).toHaveBeenCalled();
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith(
        'fitbit_pkce_verifier',
      );
    });
  });
});
```

### API Integration Testing

Test Fitbit API worker patterns without making actual network requests:

```javascript
// src/features/fitbit/workers/__tests__/fitbitApi.worker.test.js
describe('Fitbit API Worker', () => {
  it('handles rate limiting gracefully', async () => {
    // Mock fetch responses
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: 'success' }),
      })
      .mockRejectedValueOnce({ status: 429 }) // Rate limited
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: 'retry-success' }),
      });

    const worker = await import('../fitbitApi.worker.js');
    const results = await worker.fetchWithRateLimit([
      '/heartrate/2026-01-01',
      '/heartrate/2026-01-02',
      '/heartrate/2026-01-03',
    ]);

    expect(results).toHaveLength(3);
    expect(results[1]).toBeNull(); // Rate limited request
    expect(results[0].data).toBe('success');
  });

  it('automatically refreshes expired tokens', async () => {
    const mockRefreshToken = vi.fn().mockResolvedValue({
      access_token: 'new-token',
      expires_in: 3600,
    });

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ status: 401 }) // Token expired
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: 'success-with-new-token' }),
      });

    const worker = await import('../fitbitApi.worker.js');
    worker.refreshToken = mockRefreshToken;

    const result = await worker.authenticatedRequest('/test-endpoint');

    expect(mockRefreshToken).toHaveBeenCalled();
    expect(result.data).toBe('success-with-new-token');
  });
});
```

## Testing Fitbit OAuth Flow (E2E)

The Fitbit OAuth integration requires comprehensive end-to-end testing to validate the complete authorization flow, including state persistence, CSRF protection, PKCE verification, and token encryption.

### Critical Test: localStorage State Persistence

The most important test validates that OAuth state persists across redirects. This addresses the critical bug where `sessionStorage` was cleared during cross-domain navigation.

From [src/components/fitbit/FitbitOAuth.e2e.test.jsx](../../src/components/fitbit/FitbitOAuth.e2e.test.jsx):

```javascript
describe('Fitbit OAuth E2E Flow', () => {
  it('persists OAuth state in localStorage across simulated redirect', async () => {
    // ===== CRITICAL TEST =====
    // This validates the sessionStorage → localStorage fix
    // The bug: state was in sessionStorage, cleared on redirect
    // The fix: state is in localStorage, survives redirect

    const TestComponent = () => {
      const { initiateAuth, handleCallback, status } = useFitbitOAuth();
      return (
        <div>
          <button onClick={initiateAuth}>Connect</button>
          <span data-testid="status">{status}</span>
        </div>
      );
    };

    render(
      <FitbitOAuthProvider>
        <TestComponent />
      </FitbitOAuthProvider>,
    );

    // User clicks "Connect to Fitbit"
    fireEvent.click(screen.getByRole('button', { name: /connect/i }));

    // Verify state stored in localStorage
    const storedState = localStorage.getItem('fitbit_oauth_state');
    const storedVerifier = localStorage.getItem('fitbit_pkce_verifier');
    expect(storedState).toBeTruthy();
    expect(storedVerifier).toBeTruthy();

    // Simulate redirect to Fitbit (clears sessionStorage, preserves localStorage)
    // In real browser, cross-domain redirect clears sessionStorage but not localStorage

    // Simulate return from Fitbit with authorization code
    const returnUrl = new URL(window.location.href);
    returnUrl.searchParams.set('code', 'mock-auth-code');
    returnUrl.searchParams.set('state', storedState);
    window.history.pushState({}, '', returnUrl);

    // OAuth callback handler should retrieve state from localStorage
    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent(/connected/i);
    });

    // State should be cleaned up after successful validation
    expect(localStorage.getItem('fitbit_oauth_state')).toBeNull();
    expect(localStorage.getItem('fitbit_pkce_verifier')).toBeNull();
  });
});
```

### OAuth Test Utilities

Use [src/test-utils/oauthTestHelpers.js](../../src/test-utils/oauthTestHelpers.js) for consistent test setup:

```javascript
import {
  setupOAuthMockEnvironment,
  simulateOAuthCallback,
  mockTokenExchange,
  clearOAuthState,
} from '../../test-utils/oauthTestHelpers.js';

beforeEach(() => {
  // Setup mock environment (crypto, fetch, storage)
  mockEnv = setupOAuthMockEnvironment();

  // Mock fetch for token exchange
  global.fetch = mockTokenExchange({ success: true });
});

afterEach(() => {
  // Clean up after tests
  clearOAuthState();
  mockEnv.clearStorage();
});
```

### Testing CSRF Protection

```javascript
it('rejects callback with invalid state (CSRF protection)', async () => {
  const { initiateAuth, handleCallback } = renderOAuthFlow();

  // Initiate auth (stores valid state)
  await initiateAuth();
  const validState = localStorage.getItem('fitbit_oauth_state');

  // Attacker tries to inject different state
  const attackUrl = new URL(window.location.href);
  attackUrl.searchParams.set('code', 'malicious-code');
  attackUrl.searchParams.set(
    'state',
    'invalid-state-different-from-' + validState,
  );

  window.history.pushState({}, '', attackUrl);

  // Should reject callback
  await waitFor(() => {
    expect(screen.getByRole('alert')).toHaveTextContent(/invalid.*state|csrf/i);
  });

  // State should be cleared for security
  expect(localStorage.getItem('fitbit_oauth_state')).toBeNull();
  expect(localStorage.getItem('fitbit_pkce_verifier')).toBeNull();
});
```

### Testing PKCE Flow

```javascript
it('validates PKCE code verifier/challenge flow', async () => {
  // Mock crypto for deterministic PKCE values
  const mockCrypto = mockCryptoSubtle({ deterministic: true });
  Object.defineProperty(global, 'crypto', {
    value: mockCrypto,
    writable: true,
    configurable: true,
  });

  const { initiateAuth } = renderOAuthFlow();
  await initiateAuth();

  const storedVerifier = localStorage.getItem('fitbit_pkce_verifier');
  expect(storedVerifier).toHaveLength(128); // PKCE spec requirement

  // Verify verifier is Base64URL format
  expect(storedVerifier).toMatch(/^[A-Za-z0-9_-]+$/);

  // Verify challenge was derived from verifier
  const authUrl = mockEnv.getLastRedirectUrl();
  const challenge = new URL(authUrl).searchParams.get('code_challenge');
  expect(challenge).toBeTruthy();
  expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/); // Base64URL format
});
```

### Testing Token Encryption

```javascript
it('encrypts tokens before storage', async () => {
  const mockTokenResponse = {
    access_token: 'sensitive-access-token',
    refresh_token: 'sensitive-refresh-token',
    expires_in: 3600,
    user_id: 'ABC123',
  };

  global.fetch = mockTokenExchange({
    success: true,
    response: mockTokenResponse,
  });

  // Complete OAuth flow with passphrase
  await simulateCompleteOAuthFlow({ passphrase: 'test-passphrase' });

  // Check IndexedDB storage
  const db = await openDB('OscarFitbitData');
  const storedTokens = await db.get('fitbitTokens', 'current');

  // Tokens should be encrypted, not plaintext
  expect(storedTokens.encrypted).toBeTruthy();
  expect(storedTokens.salt).toBeTruthy();
  expect(storedTokens.iv).toBeTruthy();

  // Verify no plaintext token leakage
  const storedJson = JSON.stringify(storedTokens);
  expect(storedJson).not.toContain('sensitive-access-token');
  expect(storedJson).not.toContain('sensitive-refresh-token');
});
```

### Testing Error Scenarios

```javascript
describe('OAuth Error Handling', () => {
  it('handles user denial gracefully', async () => {
    // Simulate user clicking "Deny" on Fitbit authorization page
    const errorUrl = new URL(window.location.href);
    errorUrl.searchParams.set('error', 'access_denied');
    errorUrl.searchParams.set('error_description', 'User denied access');
    window.history.pushState({}, '', errorUrl);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        /access denied|user denied/i,
      );
    });

    // Should clean up state even on error
    expect(localStorage.getItem('fitbit_oauth_state')).toBeNull();
  });

  it('handles network failures during token exchange', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    await simulateOAuthCallback({
      code: 'valid-code',
      state: 'valid-state',
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/network.*error/i);
    });
  });

  it('handles expired authorization codes', async () => {
    global.fetch = mockTokenExchange({
      success: false,
      status: 400,
      error: 'invalid_grant',
      error_description: 'Authorization code expired',
    });

    await simulateOAuthCallback({
      code: 'expired-code',
      state: 'valid-state',
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/expired|invalid/i);
    });
  });
});
```

### Key Testing Patterns

**✅ DO:**

- Test localStorage persistence (critical for OAuth to work)
- Mock `crypto.subtle` for deterministic PKCE values
- Use `fake-indexeddb` for token storage tests
- Test CSRF protection with invalid state
- Verify token encryption before storage
- Test all error scenarios (denial, network, expired codes)
- Clean up OAuth state after each test

**❌ DON'T:**

- Use sessionStorage for OAuth state (breaks on redirect)
- Test with real Fitbit API credentials
- Skip error scenario tests
- Mock OAuth components without testing integration
- Leave OAuth state in storage after tests
- Assume crypto.getRandomValues produces consistent values

### Running OAuth Tests

```bash
# Run all Fitbit OAuth tests
npm test -- src/components/fitbit/FitbitOAuth.e2e.test.jsx

# Run with coverage
npm run test:coverage -- src/components/fitbit/

# Watch mode for development
npm test -- --watch FitbitOAuth
```

### Debugging OAuth Tests

Common issues and solutions:

**"OAuth state is null"**: Ensure `localStorage` mock is properly set up in `beforeEach`

**"crypto.subtle is not a function"**: Mock crypto with `mockCryptoSubtle()` helper

**"IndexedDB not found"**: Import `fake-indexeddb/auto` at top of test file

**"fetch is not defined"**: Mock `global.fetch` before initiating OAuth

**See Also**:

- [src/components/fitbit/FitbitOAuth.e2e.test.jsx](../../src/components/fitbit/FitbitOAuth.e2e.test.jsx) — Complete E2E test suite (14 comprehensive tests)
- [src/test-utils/oauthTestHelpers.js](../../src/test-utils/oauthTestHelpers.js) — OAuth testing utilities and mocks
- [src/utils/fitbitAuth.js](../../src/utils/fitbitAuth.js) — OAuth implementation with localStorage persistence

## Testing Fitbit Data Analytics

### Correlation Engine Testing

Test statistical calculations with synthetic data:

```javascript
// src/features/fitbit/services/__tests__/correlationEngine.test.js
import {
  buildCpapSession,
  buildFitbitData,
} from '../../../test-utils/builders.js';

describe('Correlation Analytics', () => {
  it('calculates Pearson correlation correctly', () => {
    const engine = new CorrelationEngine();

    // Perfect positive correlation
    const x = [1, 2, 3, 4, 5];
    const y = [2, 4, 6, 8, 10];

    const r = engine.pearsonCorrelation(x, y);
    expect(r).toBeCloseTo(1.0, 5);
  });

  it('identifies significant AHI-HRV correlations', () => {
    const sessions = [
      // High AHI, low HRV (poor therapy)
      buildCpapSession({ ahi: 15.2, fitbitHrv: 18.5 }),
      buildCpapSession({ ahi: 12.8, fitbitHrv: 21.2 }),
      buildCpapSession({ ahi: 18.1, fitbitHrv: 16.9 }),

      // Low AHI, high HRV (good therapy)
      buildCpapSession({ ahi: 3.2, fitbitHrv: 34.7 }),
      buildCpapSession({ ahi: 2.1, fitbitHrv: 38.2 }),
      buildCpapSession({ ahi: 4.5, fitbitHrv: 31.5 }),
    ];

    const engine = new CorrelationEngine();
    const results = engine.calculateCorrelations(sessions);

    // Should find strong negative correlation
    expect(results.ahi_hrv_correlation).toBeLessThan(-0.7);
    expect(results.ahi_hrv_pvalue).toBeLessThan(0.05);
    expect(results.effect_size).toEqual('large');
  });

  it('handles missing data gracefully', () => {
    const sessions = [
      buildCpapSession({ ahi: 5.2, fitbitHrv: 24.1 }),
      buildCpapSession({ ahi: 8.7, fitbitHrv: null }), // Missing Fitbit
      buildCpapSession({ ahi: null, fitbitHrv: 31.5 }), // Missing CPAP
      buildCpapSession({ ahi: 3.1, fitbitHrv: 28.9 }),
    ];

    const engine = new CorrelationEngine();
    const results = engine.calculateCorrelations(sessions);

    // Should use only complete pairs (2 sessions)
    expect(results.sample_size).toBe(2);
    expect(results.warnings).toContain('missing_data');
  });
});
```

### Encryption Testing

Verify that Fitbit data encryption follows the same patterns as CPAP data:

```javascript
// src/features/fitbit/services/__tests__/encryption.test.js
describe('Fitbit Data Encryption', () => {
  it('encrypts and decrypts Fitbit data consistently', async () => {
    const originalData = {
      heartRate: [
        { time: '2026-01-24T22:30:00Z', value: 65 },
        { time: '2026-01-24T22:31:00Z', value: 63 },
      ],
      sleep: { stages: { deep: 85, light: 230, rem: 95 } },
      spO2: { average: 96.2, minimum: 93.1 },
    };

    const passphrase = 'test-passphrase-123';

    const security = new FitbitDataSecurity();
    const encrypted = await security.encryptFitbitData(
      originalData,
      passphrase,
    );

    expect(encrypted).toHaveProperty('encrypted');
    expect(encrypted).toHaveProperty('salt');
    expect(encrypted).toHaveProperty('iv');
    expect(encrypted.encrypted).not.toContain('65'); // No plaintext leakage

    const decrypted = await security.decryptFitbitData(encrypted, passphrase);
    expect(decrypted).toEqual(originalData);
  });

  it('fails with wrong passphrase', async () => {
    const data = { heartRate: [{ time: '2026-01-24T22:30:00Z', value: 65 }] };

    const security = new FitbitDataSecurity();
    const encrypted = await security.encryptFitbitData(
      data,
      'correct-passphrase',
    );

    await expect(
      security.decryptFitbitData(encrypted, 'wrong-passphrase'),
    ).rejects.toThrow();
  });
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
