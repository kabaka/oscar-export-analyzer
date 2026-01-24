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

**Example: Simple feature component with DataContext**

```jsx
import React from 'react';
import { useData } from '../context/DataContext';
import { ThemedPlot } from './ui';

/**
 * Displays a histogram of nightly AHI values.
 */
export default function AHIHistogram() {
  const { filteredSummary } = useData();

  // Extract AHI values, filtering out nulls
  const ahiValues =
    filteredSummary?.filter((row) => row.AHI != null).map((row) => row.AHI) ||
    [];

  if (ahiValues.length === 0) {
    return <p>No AHI data available for selected date range.</p>;
  }

  return (
    <ThemedPlot
      data={[
        {
          x: ahiValues,
          type: 'histogram',
          nbinsx: 20,
          name: 'AHI Distribution',
        },
      ]}
      layout={{
        title: 'AHI Distribution',
        xaxis: { title: 'AHI (events/hour)' },
        yaxis: { title: 'Number of Nights' },
        height: 400,
      }}
      style={{ width: '100%' }}
    />
  );
}
```

**See Also**: [src/context/DataContext.jsx](../../src/context/DataContext.jsx), [src/components/ui/ThemedPlot.jsx](../../src/components/ui/ThemedPlot.jsx)

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

**Example: Registering a new dashboard section in App.jsx**

```jsx
// In AppShell function, add to tocSections array:
const tocSections = useMemo(
  () => [
    { id: 'overview', label: 'Overview', visible: summaryAvailable },
    { id: 'analytics', label: 'Analytics', visible: summaryAvailable },
    // Add your new section here:
    { id: 'my-feature', label: 'My Feature', visible: summaryAvailable },
    // ... other sections
  ],
  [summaryAvailable],
);

// Then render the section in the main content area:
return (
  <AppLayout
    headerContent={/* ... */}
    tocSections={tocSections}
    activeSectionId={activeSectionId}
    onNavigate={setActiveSectionId}
  >
    {/* Existing sections */}
    <OverviewSection />
    <AnalyticsSection />

    {/* Your new section */}
    <section id="my-feature" className="section">
      <h2>My Feature</h2>
      <AHIHistogram />
    </section>

    {/* More sections... */}
  </AppLayout>
);
```

**See Also**: [src/App.jsx](../../src/App.jsx), [src/app/AppLayout.jsx](../../src/app/AppLayout.jsx)

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

### 11. PWA Considerations

When adding new features to OSCAR Export Analyzer, keep Progressive Web App compatibility in mind:

**Service Worker Caching**:

- Static assets (JS, CSS, images) are automatically cached by the service worker
- If you add new asset types (fonts, icons), ensure they're included in `vite.config.js` → `VitePWA.workbox.globPatterns`
- Never cache user data (CSV files, sessions)—service worker caches only public app assets

**Offline Functionality**:

- Features should work offline after initial app load
- Avoid external API calls (app is designed to run entirely client-side)
- If you add external resources (CDN fonts, third-party scripts), ensure graceful fallbacks for offline mode
- Test offline: `npm run build && npm run preview`, then DevTools → Network → Offline

**Update Flow**:

- Service worker updates happen on app launch (not during active sessions)
- Large bundle changes trigger update notifications—user chooses when to reload
- Avoid breaking changes to IndexedDB schema (migrations are complex)
- Document any storage schema changes in PR description

**Privacy Model**:

- All data processing must remain client-side (no server calls)
- New export features should use encryption (see `src/utils/encryption.js`)
- Never cache PHI (Protected Health Information) in service worker
- Document privacy implications in user guide if feature handles sensitive data

**Bundle Size**:

- Keep bundle impact minimal (PWA target: ≤5% increase)
- Use code splitting for large features (`React.lazy()`)
- Check bundle size: `npm run build` generates `stats.html`
- Lighthouse Performance audit should remain ≥90%

**Testing**:

- Test PWA features in production build: `npm run build && npm run preview`
- Verify service worker registration: DevTools → Application → Service Workers
- Check manifest: DevTools → Application → Manifest
- Run Lighthouse PWA audit (should be 100%)

**See Also**: [PWA Architecture](architecture.md#progressive-web-app-pwa-architecture), [ADR-0002: PWA Implementation](architecture/adr/0002-progressive-web-app-implementation.md)

---

## See Also

- [Architecture](architecture.md) — Understand the system before making changes
- [Testing Patterns](testing-patterns.md) — Comprehensive testing guide with examples
- [Accessibility](accessibility.md) — Ensure new features are accessible to all users
- [Development Setup](setup.md) — Get your environment configured
- [Dependencies](dependencies.md) — Learn about available libraries and when to add new ones
- [CLI Tool](cli-tool.md) — Extend command-line analysis capabilities

---
