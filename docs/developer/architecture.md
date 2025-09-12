## Architecture

At heart the analyzer is a single‑page application powered by [React](https://react.dev/) and bundled with
[Vite](https://vitejs.dev/). The architecture favors plain functions and composable building blocks over heavy
framework abstractions. This section peels back the layers so you can orient yourself before diving into the source.

### High‑Level Flow

1. **Entry Point** – `main.jsx` bootstraps the React app and mounts `<App />` inside a root DOM node. Vite handles module
   loading and hot replacement during development.
2. **File Upload** – The top portion of `App.jsx` exposes two file inputs for summary and details CSV exports. When a
   file is chosen, a dedicated parser worker filters events, converts timestamps, and streams batches via `postMessage`
   so the main thread receives only necessary data.
3. **Context Store** – Parsed rows and application settings live in `DataContext`. Components consume these values via
   hooks like `useData`, `useParameters`, and `useTheme`. Using context keeps props shallow and makes it easy to expose
   new pieces of state without threading them through every component.
4. **Visualization Components** – Each analysis view lives under `src/components`. Most render a `ThemedPlot`, a thin
   wrapper around `react-plotly.js` that applies our light or dark palette and enforces responsive sizing.
5. **Workers for Heavy Lifting** – Beyond CSV parsing, dedicated workers perform computationally expensive tasks such as
   k‑means clustering of apnea events and detection of likely false negatives. Offloading work keeps the UI snappy even
   with multi‑year datasets.

### Component Structure

`App.jsx` functions as a simple router using conditional rendering rather than a formal routing library. Sidebar links
set an "active view" state, and the corresponding component renders in the main pane. This approach keeps the bundle
small and avoids the cognitive overhead of a router for what is essentially a tabbed interface.

Components are largely presentational. They accept data and configuration via props and delegate calculations to helper
modules in `src/utils`. For example, `AhiTrendsCharts` calls `stats.js` functions to compute rolling averages while the
component itself focuses on layout and axis labels.

An `ErrorBoundary` from `react-error-boundary` wraps most charts. Should a render error occur—perhaps due to malformed
data or a Plotly regression—the boundary displays a friendly message rather than crashing the entire app. The error is
also logged to the console for debugging.

### State and Persistence

`DataContext` combines several concerns:

- Parsed CSV rows
- User‑selected date ranges
- Theme (light, dark, or system)
- Session persistence flags

The `useSessionManager` hook serializes this state to `IndexedDB` using the browser's `idb` wrapper when "Remember data
locally" is enabled. Sessions can be saved, loaded, or cleared via controls in the header. Exporting a session produces
JSON that can be imported on another machine; sensitive personal notes are intentionally excluded.

### Styling and Themes

The project uses a single `guide.css` file for global styles plus small component‑scoped CSS modules where necessary.
Color choices aim for WCAG AA contrast, and the `ThemeToggle` component flips between palettes. Plotly charts adopt the
current theme automatically through the shared `chartTheme.js` utility and the `ThemedPlot` wrapper.

### Testing Philosophy

Tests mirror how a user interacts with the UI. Components are exercised through Testing Library by querying rendered
output rather than internal implementation details. Worker logic and utilities receive focused unit tests in
`src/utils/*.test.js`. When adding a new feature, start by writing a failing test that describes the desired behavior.

### Build and Deployment

Vite compiles the app into static assets under `dist/`. The configuration enables code splitting so each view loads only
what it needs. During deployment, serve the `dist/` directory from any static host or CDN. The build includes sourcemaps
for easier debugging; omit them in production if bundle size is a concern.

Understanding this architecture should make it easier to navigate the codebase. The [dependencies](dependencies.md)
chapter dives into the specific libraries that support these patterns.

### Future Directions

The architecture intentionally leaves room to grow. Potential areas for exploration include:

- **Modular Routing** – If the number of views expands significantly, adopting a lightweight router such as `tiny-router`
  could keep `App.jsx` manageable.
- **Plugin System** – Power users may eventually want to drop in custom analyses. A plugin API that exposes data hooks
  and chart helpers could make the project a platform for experimentation.
- **Server‑side Rendering** – Although the app currently ships as a static bundle, rendering initial views on the server
  could improve startup time for massive datasets. Vite's SSR mode would make this transition relatively painless.

These ideas are not on the roadmap yet, but documenting them now invites future contributors to experiment.
