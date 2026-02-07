---
name: react-component-testing
description: Testing patterns for React components using Vitest and Testing Library. Use when writing or debugging component tests, including user interactions, accessibility, and async behavior.
---

# React Component Testing

This skill documents patterns for testing React components in OSCAR Export Analyzer using Vitest and React Testing Library.

## Core Philosophy

**Test user behavior, not implementation details.**

- Query elements by accessible roles and text (what users see)
- Simulate user interactions (clicks, typing, keyboard navigation)
- Assert on rendered output and accessibility
- Avoid testing internal state or implementation

## Basic Test Structure (Arrange-Act-Assert)

```javascript
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import UsagePatternsCharts from './UsagePatternsCharts';

describe('UsagePatternsCharts', () => {
  it('renders chart title', () => {
    // Arrange: Set up test data
    const mockData = [
      { date: '2024-01-01', usage: 7.5 },
      { date: '2024-01-02', usage: 8.2 },
    ];

    // Act: Render component
    render(<UsagePatternsCharts data={mockData} />);

    // Assert: Verify expected output
    expect(screen.getByText(/usage patterns/i)).toBeInTheDocument();
  });
});
```

## Query Patterns

### Accessible Queries (Preferred)

```javascript
// By role (most accessible)
const button = screen.getByRole('button', { name: /submit/i });
const heading = screen.getByRole('heading', { name: /usage patterns/i });
const textbox = screen.getByRole('textbox', { name: /start date/i });

// By label text (for form inputs)
const input = screen.getByLabelText(/start date/i);

// By text content (for static content)
const message = screen.getByText(/no data available/i);
```

### Less Preferred (Use Sparingly)

```javascript
// By test ID (when no accessible query works)
const element = screen.getByTestId('chart-container');

// By CSS selector (avoid if possible)
const element = container.querySelector('.chart-wrapper');
```

### Query Variants

```javascript
// getBy - Throws if not found (use for elements that must exist)
const button = screen.getByRole('button');

// queryBy - Returns null if not found (use for conditional rendering)
const error = screen.queryByText(/error/i);
expect(error).not.toBeInTheDocument();

// findBy - Async, waits for element (use for async rendering)
const data = await screen.findByText(/loaded/i);
```

## User Interaction Testing

### Click Events

```javascript
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

it('calls onChange when button clicked', async () => {
  const handleChange = vi.fn();
  render(<DateRangeControls onChange={handleChange} />);

  // Option 1: fireEvent (synchronous)
  const button = screen.getByRole('button', { name: /apply/i });
  fireEvent.click(button);

  // Option 2: userEvent (more realistic, async)
  const user = userEvent.setup();
  await user.click(button);

  expect(handleChange).toHaveBeenCalled();
});
```

### Form Input

```javascript
it('updates input value when user types', async () => {
  const user = userEvent.setup();
  render(<DateRangeControls />);

  const input = screen.getByLabelText(/start date/i);

  await user.type(input, '2024-01-15');

  expect(input).toHaveValue('2024-01-15');
});
```

### Keyboard Navigation

```javascript
it('navigates with keyboard', async () => {
  const user = userEvent.setup();
  render(<DateRangeControls />);

  // Tab to first input
  await user.tab();
  expect(screen.getByLabelText(/start date/i)).toHaveFocus();

  // Tab to next input
  await user.tab();
  expect(screen.getByLabelText(/end date/i)).toHaveFocus();

  // Shift+Tab to go back
  await user.tab({ shift: true });
  expect(screen.getByLabelText(/start date/i)).toHaveFocus();
});
```

### Select Dropdown

```javascript
it('selects option from dropdown', async () => {
  const user = userEvent.setup();
  render(<ChartTypeSelector />);

  const select = screen.getByRole('combobox', { name: /chart type/i });

  await user.selectOptions(select, 'line');

  expect(screen.getByRole('option', { name: /line chart/i }).selected).toBe(true);
});
```

## Async Testing

### Waiting for Elements

```javascript
import { render, screen, waitFor } from '@testing-library/react';

it('loads data asynchronously', async () => {
  render(<DataLoader />);

  // Shows loading state initially
  expect(screen.getByText(/loading/i)).toBeInTheDocument();

  // Wait for data to appear
  const data = await screen.findByText(/data loaded/i);
  expect(data).toBeInTheDocument();

  // Loading indicator should be gone
  expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
});
```

### Waiting for Assertions

```javascript
it('updates after async operation', async () => {
  const { rerender } = render(<Component />);

  fireEvent.click(screen.getByRole('button', { name: /fetch/i }));

  // Wait for state to update
  await waitFor(() => {
    expect(screen.getByText(/success/i)).toBeInTheDocument();
  });
});
```

### Timeout Configuration

```javascript
it('handles slow operations', async () => {
  render(<SlowComponent />);

  // Increase timeout for slow operations
  const result = await screen.findByText(/result/i, {}, { timeout: 5000 });

  expect(result).toBeInTheDocument();
});
```

## Mock Patterns

### Mock Functions

```javascript
import { vi } from 'vitest';

it('calls callback with correct arguments', () => {
  const handleSubmit = vi.fn();

  render(<Form onSubmit={handleSubmit} />);

  fireEvent.click(screen.getByRole('button', { name: /submit/i }));

  expect(handleSubmit).toHaveBeenCalledTimes(1);
  expect(handleSubmit).toHaveBeenCalledWith({
    startDate: '2024-01-01',
    endDate: '2024-01-31',
  });
});
```

### Mock Hooks

```javascript
import { vi } from 'vitest';
import * as hooks from '../hooks/useData';

it('uses mocked hook data', () => {
  const mockData = [{ date: '2024-01-01', ahi: 5.2 }];

  vi.spyOn(hooks, 'useData').mockReturnValue({
    data: mockData,
    isLoading: false,
    error: null,
  });

  render(<ChartComponent />);

  expect(screen.getByText(/5.2/i)).toBeInTheDocument();
});
```

### Mock Context

```javascript
import { render } from '@testing-library/react';
import { DataContext } from '../context/DataContext';

function renderWithContext(component, contextValue) {
  return render(
    <DataContext.Provider value={contextValue}>{component}</DataContext.Provider>
  );
}

it('uses context data', () => {
  const mockContextValue = {
    sessions: [{ date: '2024-01-01', ahi: 5.2 }],
    filters: { startDate: null, endDate: null },
  };

  renderWithContext(<ChartComponent />, mockContextValue);

  expect(screen.getByText(/5.2/i)).toBeInTheDocument();
});
```

## Accessibility Testing

### ARIA Attributes

```javascript
it('has accessible labels', () => {
  render(<ChartComponent title="Usage Patterns" />);

  const chart = screen.getByRole('img', { name: /usage patterns/i });
  expect(chart).toHaveAttribute('aria-label', 'Chart: Usage Patterns');
});
```

### Keyboard Accessibility

```javascript
it('is keyboard navigable', async () => {
  const user = userEvent.setup();
  render(<NavigableChart />);

  // Tab through interactive elements
  await user.tab();
  expect(screen.getByRole('button', { name: /zoom in/i })).toHaveFocus();

  await user.tab();
  expect(screen.getByRole('button', { name: /zoom out/i })).toHaveFocus();

  // Activate with Enter or Space
  await user.keyboard('{Enter}');
  expect(screen.getByText(/zoomed in/i)).toBeInTheDocument();
});
```

### Focus Management

```javascript
it('manages focus correctly', async () => {
  const user = userEvent.setup();
  render(<Modal />);

  // Open modal
  await user.click(screen.getByRole('button', { name: /open/i }));

  // Focus should move to modal
  const modalTitle = screen.getByRole('heading', { name: /modal title/i });
  await waitFor(() => {
    expect(modalTitle).toHaveFocus();
  });

  // Close modal
  await user.keyboard('{Escape}');

  // Focus should return to trigger button
  expect(screen.getByRole('button', { name: /open/i })).toHaveFocus();
});
```

## Error State Testing

```javascript
it('displays error message on failure', async () => {
  // Mock fetch to return error
  global.fetch = vi.fn(() =>
    Promise.reject(new Error('Failed to load data'))
  );

  render(<DataLoader />);

  // Wait for error message
  const error = await screen.findByText(/failed to load/i);
  expect(error).toBeInTheDocument();

  // Should show retry button
  expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
});
```

## Edge Case Testing

```javascript
describe('DateRangeControls edge cases', () => {
  it('handles empty data gracefully', () => {
    render(<DateRangeControls data={[]} />);
    expect(screen.getByText(/no data available/i)).toBeInTheDocument();
  });

  it('handles single data point', () => {
    const singlePoint = [{ date: '2024-01-01', value: 10 }];
    render(<DateRangeControls data={singlePoint} />);
    expect(screen.getByText(/2024-01-01/i)).toBeInTheDocument();
  });

  it('validates date range (end before start)', async () => {
    const user = userEvent.setup();
    render(<DateRangeControls />);

    await user.type(screen.getByLabelText(/start date/i), '2024-12-31');
    await user.type(screen.getByLabelText(/end date/i), '2024-01-01');

    expect(
      screen.getByText(/end date must be after start date/i)
    ).toBeInTheDocument();
  });
});
```

## Test Organization

### Grouping Related Tests

```javascript
describe('UsagePatternsCharts', () => {
  describe('rendering', () => {
    it('renders chart with data', () => {
      // ...
    });

    it('renders empty state without data', () => {
      // ...
    });
  });

  describe('interactions', () => {
    it('zooms chart on button click', () => {
      // ...
    });

    it('toggles legend on click', () => {
      // ...
    });
  });

  describe('accessibility', () => {
    it('has correct ARIA labels', () => {
      // ...
    });

    it('supports keyboard navigation', () => {
      // ...
    });
  });
});
```

### Setup and Teardown

```javascript
import { render, screen, cleanup } from '@testing-library/react';
import { beforeEach, afterEach, describe, it } from 'vitest';

describe('ChartComponent', () => {
  let mockData;

  beforeEach(() => {
    // Setup runs before each test
    mockData = [
      { date: '2024-01-01', value: 10 },
      { date: '2024-01-02', value: 20 },
    ];
  });

  afterEach(() => {
    // Cleanup runs after each test
    cleanup();
    vi.clearAllMocks();
  });

  it('renders with mock data', () => {
    render(<ChartComponent data={mockData} />);
    // ...
  });
});
```

## Snapshot Testing (Use Sparingly)

```javascript
it('matches snapshot', () => {
  const { container } = render(<Component />);
  expect(container.firstChild).toMatchSnapshot();
});

// Update snapshots: npm test -- -u
```

**Note:** Prefer explicit assertions over snapshots. Snapshots are brittle and don't explain what's being tested.

## Common Pitfalls

**❌ Testing implementation details:**

```javascript
// Bad: Testing internal state
expect(wrapper.state('isOpen')).toBe(true);

// Good: Testing rendered output
expect(screen.getByText(/modal content/i)).toBeInTheDocument();
```

**❌ Not cleaning up:**

```javascript
// Bad: May cause test pollution
it('test 1', () => {
  render(<Component />);
  // No cleanup
});
```

**✅ Use cleanup (automatic with Testing Library):**

```javascript
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
```

**❌ Overly specific queries:**

```javascript
// Bad: Brittle
container.querySelector('.chart-wrapper > div.plot > svg');

// Good: User-facing
screen.getByRole('img', { name: /chart/i });
```

## Resources

- **Testing Library docs**: https://testing-library.com/docs/react-testing-library/intro/
- **Vitest docs**: https://vitest.dev/
- **Common queries**: https://testing-library.com/docs/queries/about
- **User event docs**: https://testing-library.com/docs/user-event/intro
- **Project examples**: Check `*.test.jsx` files throughout `src/`
