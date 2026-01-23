## Adding Features

Enhancements come in many sizes—from a new chart to a single extra column in a table. This chapter offers a friendly
workflow that keeps contributions consistent and maintainable.

### 1. Sketch the Idea

Before writing code, open an issue describing the problem you want to solve or the insight you want to surface. Include
mockups or rough sketches if you have them. Discussion up front often reveals alternative approaches or existing
features you can piggyback on.

### 2. Create a Component

Most new features start as components under `src/components`. Use `PascalCase` filenames and export a single default
function. Co‑locate CSS modules and tests with the component so everything travels together.

```bash
src/
  components/
    MyFancyChart.jsx
    MyFancyChart.test.jsx
    MyFancyChart.module.css (optional)
```

When the feature involves heavy computation, consider moving the logic into a web worker under `src/workers` and using
`useSessionManager` or a custom hook to communicate with it.

### 3. Wire Up State

If your component needs access to uploaded data, theme, or user parameters, tap into `DataContext` via the provided
hooks:

```jsx
import { useData, useParameters } from '../context/DataContext';
```

Avoid creating new global stores unless absolutely necessary. For one‑off configuration values, import or extend
`src/constants.js` so the values remain shared across modules and tests.

### 4. Surfacing the Feature

Expose the new component by adding a button or link in `App.jsx`'s header navigation bar and rendering it based on the
active view. Keep the wording concise so links fit comfortably across the top. If the feature requires route parameters
or deep linking, consider adding a URL hash and reading it from `window.location.hash`.

### 5. Testing

Write tests before polishing the UI. Tests live next to the component and typically follow this pattern:

```jsx
import { render, screen } from '@testing-library/react';
import MyFancyChart from './MyFancyChart';

it('renders a histogram', () => {
  render(<MyFancyChart data={[1, 2, 3]} />);
  expect(screen.getByRole('img', { name: /histogram/i })).toBeInTheDocument();
});
```

Aim for user‑facing assertions rather than implementation details. If a bug fix inspired the feature, add a regression
test to catch similar issues in the future.

### 6. Documentation (screenshots refreshing soon)

Update the appropriate user and developer docs so others know the feature exists. Screenshots and GIFs are
temporarily unavailable; leave a short note instead and plan to refresh visuals once the regenerated assets are ready.

### 7. Final Checklist

Before committing, run the usual quality gates:

```bash
npm run lint
npm test -- --run
npm run build
```

Commit using the [Conventional Commit](https://www.conventionalcommits.org/) style, for example:

```bash
git commit -m "feat: add fancy histogram view"
```

Now open a pull request and celebrate—one more piece of the analyzer is better because of you!

### 8. Accessibility Matters

Every chart and button should be reachable by keyboard and convey information to screen readers. Use semantic HTML
where possible and double‑check color contrast against the current theme. Testing Library's `axe` integration can help
spot issues during development.

### 9. Performance and Footprint

Large datasets are the norm for OSCAR exports. Be mindful of CPU and memory usage when processing arrays. Prefer
streaming and generator patterns over loading all rows into memory. If a visualization depends on heavy calculations,
consider throttling updates or moving work into a web worker.

### 10. Review Tips

When your pull request is ready, request a review from another contributor. A good review comment points out what is
working well and asks clarifying questions about anything confusing. Feel free to mark sections of your PR as "ready for
feedback" and others as "still in progress." Clear communication keeps reviews friendly and efficient.
