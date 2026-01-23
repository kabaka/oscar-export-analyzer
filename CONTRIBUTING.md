# Contributing to OSCAR Export Analyzer

Welcome! We're thrilled you're interested in contributing to OSCAR Export Analyzer. This guide walks you through our development workflow, code review expectations, and best practices. Whether you're fixing a typo or designing new visualizations, we want your contributions to feel joyful and approachable.

## Table of Contents

- [Welcome & Code of Conduct](#welcome--code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [Code Style & Conventions](#code-style--conventions)
- [Testing Guidelines](#testing-guidelines)
- [Documentation Requirements](#documentation-requirements)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Review Process](#review-process)
- [Security & Privacy](#security--privacy)
- [Getting Help](#getting-help)
- [License](#license)

---

## Welcome & Code of Conduct

We are committed to fostering an inclusive, welcoming community. All contributors are expected to:

- **Be respectful** – Treat fellow contributors and users with courtesy and empathy.
- **Be transparent** – Discuss problems openly and assume good intentions.
- **Be responsible** – Remember that OSCAR analyzer handles sensitive health data. Protecting user privacy is a shared responsibility.
- **Be collaborative** – Ask questions, offer feedback generously, and celebrate each other's contributions.

If you experience or witness conduct that violates these values, please reach out to the maintainers privately.

### Health Data Responsibility

OSCAR analyzer processes sleep therapy data that belongs to real patients and clinicians. Never commit or share real patient data, CSV exports, or any Protected Health Information (PHI)—even if anonymized or "sample" data. Always use synthetic test data from `src/test-utils/builders.js`. See [Security & Privacy](#security--privacy) for details.

---

## Getting Started

### Prerequisites

1. **Node.js 20** – Required for development and testing. Use [nvm](https://github.com/nvm-sh/nvm) to manage multiple versions if needed.
2. **npm** – Installed with Node.js. We use `npm` (not yarn or pnpm) to maintain dependency consistency.
3. **Git** – For cloning and contributing. A GitHub account is needed to submit pull requests.

### Quick Start

```bash
# Clone the repository
git clone https://github.com/kabaka/oscar-export-analyzer.git
cd oscar-export-analyzer

# Install dependencies (also sets up Husky hooks)
npm install

# Start the development server
npm run dev
```

The app will be available at `http://localhost:5173`. For detailed setup instructions, see [Development Setup](docs/developer/setup.md).

---

## Development Workflow

### Branch Strategy

Create feature branches with descriptive names:

- **Features**: `feature/descriptive-feature-name`
- **Bug fixes**: `fix/what-was-broken`
- **Chores**: `chore/maintenance-task`
- **Documentation**: `docs/what-was-updated`

Example:

```bash
git checkout -b feature/add-ahi-distribution-chart
```

### Local Development

Start the dev server for hot-module reloading:

```bash
npm run dev
```

The server automatically restarts when you change configuration files. For day-to-day development:

```bash
# Watch mode for tests (re-runs on file changes)
npm test

# Run linter
npm run lint

# Format code with Prettier
npm run format
```

---

## Making Changes

### Project Structure

Code lives in `src/`:

- **`src/components/`** – React components (one per file, PascalCase naming)
- **`src/hooks/`** – Custom React hooks
- **`src/utils/`** – Utility functions
- **`src/features/`** – Feature-specific logic
- **`src/constants/`** – Centralized numeric and configuration constants
- **`src/workers/`** – Web Workers for heavy computation
- **Tests colocated**: `ComponentName.test.jsx` lives next to `ComponentName.jsx`

### Creating New Features

Follow the checklist in [Adding Features](docs/developer/adding-features.md):

1. **Sketch first** – Open an issue before coding to discuss your idea.
2. **Create a component** – Use `PascalCase` for filenames. Example: `MyFancyChart.jsx`.
3. **Wire up state** – Use `DataContext` hooks to access uploaded data and user parameters.
4. **Test early** – Write tests in `MyFancyChart.test.jsx` before polishing the UI.
5. **Document** – Add JSDoc comments and update user guides if applicable.
6. **Run quality gates** – See [Testing Guidelines](#testing-guidelines).

### Constants & Magic Numbers

Any numeric literal other than `-1`, `0`, or `1` must be defined as a named constant:

- **`src/constants.js`** – Global application constants
- **`src/constants/charts.js`** – Chart-specific sizing
- Domain-specific modules – For feature-specific constants

```javascript
// ❌ Don't do this:
const threshold = 45.2;

// ✅ Do this instead:
import { AHI_OUTLIER_THRESHOLD } from '../constants.js';
const threshold = AHI_OUTLIER_THRESHOLD;
```

After refactoring or adding new numeric values, run:

```bash
npm run lint:magic
```

See [Magic Numbers Playbook](docs/magic-numbers-playbook.md) for guidance.

---

## Pull Request Process

### Before Opening a PR

Run pre-commit checks locally:

```bash
npm run lint        # ESLint
npm test -- --run   # Vitest (single run)
npm run build       # Vite build (ensure no warnings)
```

All three must pass before committing.

### PR Title & Description

Use [Conventional Commits](https://www.conventionalcommits.org/) format for PR titles:

- `feat: add AHI distribution chart`
- `fix: resolve date filter regression`
- `docs: update setup instructions`
- `chore: update dependencies`
- `test: add regression test for clustering`

**PR description should include:**

```markdown
## What does this change do?

Brief explanation of the feature or fix.

## Why is it needed?

Context: link to issue, explain the motivation.

## How was this tested?

- [ ] Unit tests added/updated
- [ ] Tested locally: npm run dev
- [ ] Verified with synthetic test data

## Related issues

Fixes #42, relates to #15

## Screenshots (if UI change)

Include GIF or screenshot showing the new behavior.
```

### Pre-Merge Checklist

Before merging, verify:

- ✅ **GitHub Actions CI passes** – All workflows complete successfully
- ✅ **Tests pass** – `npm test -- --run` returns 0 exit code
- ✅ **Linting clean** – `npm run lint` has no errors
- ✅ **Build succeeds** – `npm run build` completes with no warnings
- ✅ **Documentation updated** – Docs, JSDoc, and code comments reflect changes
- ✅ **Reviewed** – At least one approval from a project maintainer

---

## Code Style & Conventions

### General Style

- **Indentation**: 2 spaces (no tabs)
- **Semicolons**: Optional but be consistent throughout a file
- **Quotes**: Single quotes in JavaScript, double quotes in Markdown

### Naming Conventions

| Item                | Convention                  | Example                              |
| ------------------- | --------------------------- | ------------------------------------ |
| Components          | PascalCase                  | `UsagePatternsCharts.jsx`            |
| Functions/variables | camelCase                   | `calculateAhiTrend()`, `sessionData` |
| Constants           | UPPER_SNAKE_CASE            | `AHI_OUTLIER_THRESHOLD`              |
| CSS classes         | kebab-case                  | `.data-table-header`                 |
| Test files          | `*.test.jsx` or `*.test.js` | `MyComponent.test.jsx`               |

### Formatting

Apply Prettier before committing:

```bash
npm run format
```

ESLint will catch style issues:

```bash
npm run lint
```

### Responsive Design Guidelines

When working on UI components, ensure responsive behavior:

- **Test all breakpoints** – Use browser DevTools responsive mode to test mobile (<768px), tablet (768-1024px), and desktop (≥1024px)
- **Touch targets** – All interactive elements must be ≥44×44px (WCAG AAA requirement)
- **Use utilities** – Apply `useMediaQuery` hook for conditional rendering and `chartConfig` for responsive Plotly charts
- **Mobile-first CSS** – Write base styles for mobile, then use `@media (min-width: ...)` for larger screens
- **Test on devices** – When possible, verify behavior on real phones and tablets, not just DevTools

See [docs/developer/architecture.md#responsive-design](docs/developer/architecture.md#responsive-design) for detailed patterns.

Fix automatically:

```bash
npm run lint -- --fix
```

---

## Testing Guidelines

### Testing Framework

- **Vitest** – Unit and integration tests
- **@testing-library/react** – React component testing
- **jsdom** – Browser environment simulation

### Test Naming & Location

Place tests next to the code they test:

```text
src/
  components/
    UsagePatternsCharts.jsx
    UsagePatternsCharts.test.jsx      ← Test file
    UsagePatternsCharts.module.css    ← Optional styles
```

### Writing Tests

Prefer **user-facing assertions** over implementation details:

```javascript
// ✅ Good: tests the user experience
it('displays chart when data is provided', () => {
  render(<MyChart data={testData} />);
  expect(screen.getByRole('img', { name: /usage chart/i })).toBeInTheDocument();
});

// ❌ Avoid: tests implementation details
it('calls setChartData on mount', () => {
  const spy = jest.spyOn(MyChart.prototype, 'setState');
  render(<MyChart />);
  expect(spy).toHaveBeenCalled();
});
```

### Test Coverage

New features and bug fixes must include tests. Run coverage analysis:

```bash
npm run test:coverage
```

We aim for >80% coverage on new code. Use synthetic test data from `src/test-utils/builders.js`:

```javascript
import { buildSession } from '../test-utils/builders.js';

it('calculates AHI correctly', () => {
  const session = buildSession({ ahi: 42.5 });
  expect(calculateAhiTrend([session])).toEqual(42.5);
});
```

### Debugging Tests

Run tests in watch mode during development:

```bash
npm test
```

Run a single test file:

```bash
npm test ComponentName.test.jsx
```

**Don't abandon failing tests—debug until they pass.**

---

## Documentation Requirements

### JSDoc for Functions & Hooks

Document every exported function and hook with JSDoc:

```javascript
/**
 * Calculates the Average Hourly Index (AHI) for a session.
 *
 * @param {object[]} events - Array of apnea event objects
 * @param {number} sessionDurationMinutes - Length of the session in minutes
 * @returns {number} The calculated AHI value
 * @throws {Error} If sessionDurationMinutes is zero or negative
 *
 * @example
 * const ahi = calculateAhi(events, 420); // 420 minutes = 7 hours
 */
export function calculateAhi(events, sessionDurationMinutes) {
  // implementation
}
```

### Component JSDoc

Document React components with their props:

```javascript
/**
 * Renders an interactive chart of AHI trends over time.
 *
 * @component
 * @param {object} props
 * @param {number[]} props.ahiValues - Array of AHI readings
 * @param {string} props.theme - 'light' or 'dark'
 * @param {Function} props.onRangeSelect - Callback when user selects a date range
 * @returns {JSX.Element} The rendered chart
 *
 * @example
 * <AhiTrendsCharts
 *   ahiValues={[42.1, 38.3, 45.2]}
 *   theme="dark"
 *   onRangeSelect={(start, end) => console.log(start, end)}
 * />
 */
export default function AhiTrendsCharts({ ahiValues, theme, onRangeSelect }) {
  // implementation
}
```

### Inline Comments for Complex Logic

Add comments for non-obvious algorithms or statistical calculations:

```javascript
// Mann-Whitney U test to compare two distributions
// Null hypothesis: distributions are equal
// Returns p-value; reject null if p < 0.05
const pValue = mannWhitneyU(baseline, treatment);
```

### Updating Documentation

When adding or modifying features:

1. Update relevant user guides in `docs/user/`
2. Add JSDoc to all functions, hooks, and components
3. Update architecture docs if the design changes
4. Include code examples in JSDoc comments
5. Verify links in documentation are current

---

## Commit Message Guidelines

Use [Conventional Commits](https://www.conventionalcommits.org/) to make history clear and enable automated changelog generation.

### Format

```text
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat** – New feature
- **fix** – Bug fix
- **docs** – Documentation changes
- **test** – Test additions or updates
- **chore** – Dependency updates, build changes, tooling
- **refactor** – Code refactoring without feature changes
- **perf** – Performance improvements

### Examples

```bash
# Feature
git commit -m "feat(charts): add AHI distribution histogram"

# Bug fix with issue reference
git commit -m "fix(filters): resolve date filter regression (fixes #42)"

# Documentation
git commit -m "docs: update setup instructions for Node 20"

# Test addition
git commit -m "test(apnea-clustering): add regression test for edge case"

# Multi-line commit
git commit -m "feat(analytics): add median AHI calculation

- Implement Mann-Whitney U statistical test
- Add visualization overlay option
- Update user guide with methodology

Relates to #87"
```

---

## Review Process

### What Reviewers Look For

- ✅ **Correctness** – Does the code work? Are there edge cases?
- ✅ **Testing** – Are tests thorough? Do they pass?
- ✅ **Documentation** – Is the code clear? Are JSDoc comments present?
- ✅ **Style** – Does it follow conventions? Does linting pass?
- ✅ **Performance** – Are large datasets handled efficiently?
- ✅ **Accessibility** – Is the feature keyboard-accessible? Does it work with screen readers?
- ✅ **Privacy** – No real patient data committed?

### Responding to Feedback

- **Be gracious** – Reviewers want to help, not criticize
- **Ask questions** – If feedback isn't clear, ask for clarification
- **Make changes promptly** – Address suggestions in new commits
- **Request re-review** – When feedback is addressed, request another review

---

## Security & Privacy

### Health Data is Sensitive

OSCAR analyzer processes sleep therapy data belonging to real patients. Protecting privacy is non-negotiable:

- ✅ All processing happens in the browser—data never leaves the user's machine
- ✅ Use only synthetic test data from `src/test-utils/builders.js`
- ❌ Never commit real CSV exports, even if "anonymized"
- ❌ Never hardcode actual AHI values, pressure settings, or patient dates

### Best Practices

- All data processing happens in the browser—data never leaves the user's machine
- Never introduce features that send data to external services without explicit user consent
- Review existing code for privacy best practices before implementing similar features
- When in doubt, open an issue to discuss privacy concerns openly

---

## Getting Help

### Documentation

- **[Developer Guide](docs/developer/)** – Setup, architecture, adding features
- **[User Guides](docs/user/)** – Feature explanations and statistical concepts
- **[Architecture Docs](docs/developer/architecture.md)** – System design deep-dive
- **[Magic Numbers Playbook](docs/magic-numbers-playbook.md)** – Guidance on extracting constants

### Community

- **Issues** – Search for similar problems; add context if you find one
- **Discussions** – For broader questions about OSCAR data or feature ideas
- **Code comments** – Leave TODOs or questions in the code; future contributors will see them

### When Stuck

1. Search existing issues and pull requests
2. Read the relevant documentation section
3. Open a new discussion or issue with your question
4. Reach out to maintainers if needed

---

## License

By contributing to OSCAR Export Analyzer, you agree that your contributions will be licensed under the MIT License (see [LICENSE](LICENSE)). This means your code can be freely used, modified, and distributed by anyone, including commercial projects.

---

**Thank you for contributing to OSCAR Export Analyzer!** We're excited to work with you.

Happy hacking! 🚀
