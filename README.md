# OSCAR Sleep Data Analysis Web App

This is a React-based web application for evaluating OSCAR sleep data exports. It requires Node.js 20.19 or newer.

Design refresh: the UI now uses a clean, card-based layout and polished typography with consistent spacing. It supports both light and dark modes with a theme toggle (Light / Dark / System) that persists your preference.

### State Management

Parsed CSV rows and the active theme are shared across the app via a `DataContext`. Components read these values with `useData` or `useTheme` hooks, avoiding long prop chains.

## Usage

For a full walkthrough and interpretation tips, see the Usage & Interpretation Guide:

- docs/USAGE_GUIDE.md

1. Install dependencies and start the development server:

   ```bash
   npm install
   npm run dev
   ```

2. Open your browser to the URL shown in the terminal (usually `http://localhost:5173`).

3. Use the file inputs to select your OSCAR **Summary** and **Details** CSV files from the `data/` directory. See the Data Dictionary in docs/USAGE_GUIDE.md for expected columns and auto-detection rules.
   If a CSV fails to parse, an error message will appear below the file inputs.
4. Use the theme toggle in the header to switch between Light, Dark, or System (follows OS).

5. The app will parse and display (determinate progress bars show parsing progress for each file):
   - Usage patterns over time (average usage, nights ≥ 4 h, etc.)
   - Expanded usage analytics: 7/30-night moving averages, adherence breakpoints, compliance KPIs (≥4h/≥6h), and a weekly calendar heatmap

- AHI trends (time-series, histogram, boxplot, violin/QQ plots, averages, min/max, threshold line at AHI > 5)
- Pressure & leak: EPAP trends and distribution, EPAP vs AHI scatter and 2D density, correlation matrix (EPAP, AHI, usage, optional leak), and EPAP titration helper with Mann–Whitney test
- Clustered apnea events: parameter panel allows tuning gap seconds, FLG bridge threshold, FLG gap, minimum event count, and min/max total duration; clusters recompute live. Table is sortable (duration, count, severity) and supports CSV export. Click a row to view an event-level Gantt timeline for the selected cluster and overlay leak/pressure traces for context.
- Timeline overlay and table of potential false negatives (clusters of high flow-limit events with no obstructive/central events; shows start time, duration, and confidence score)
- Apnea event characteristics and anomaly reporting (event duration percentiles, extreme and outlier events, per-night event frequency and outlier nights, KM survival)

### Navigation

- In-page links in the sticky Table of Contents smoothly scroll with an automatic offset so headers aren’t hidden beneath the sticky app header.
- The "Overview" section becomes available as soon as a Summary CSV is loaded (no Details file required).
- The Table of Contents highlights the active section as you scroll, using IntersectionObserver; clicking a link also activates it immediately.
- Use the header "Guide" button to open the full in-app Usage & Interpretation Guide. It auto-deep-links to the currently active section.
- Inline “Guide” links appear next to section headers (e.g., Usage Patterns, AHI Trends, Clusters) to jump straight to the relevant guide section.

### Raw Data Explorer

The Raw Data Explorer (see "Raw Data" in-page link) provides an efficient, virtualized table view over both Summary and Details CSVs.

- Column toggles: choose which columns to display.
- Search and sort: quick text filter across visible columns and sortable headers.
- Date range filter: constrain rows by date; optionally apply to charts to cross-filter visualizations.
- Pivot-like summary: group by any column to see counts and averages of numeric fields.
- Export: download selected or all visible rows as CSV.

## Theming

- Toggle theme via the control in the header. Choices: `Light`, `Dark`, or `System`.
- `System` mode follows your OS preference and is the default. Switching to `Light` or `Dark` sets the `data-theme` attribute on `<html>` and persists to `localStorage`.
- All colors are derived from CSS variables in `styles.css` to keep charts and UI consistent between themes.

## Development

The app is built with Vite, React, and PapaParse. Environment variables for local configuration can be stored in a `.env` file at the project root, which is ignored by Git.

### Error Handling

Wrap chart-heavy sections in an `ErrorBoundary` to show a fallback UI if rendering fails:

```jsx
import ErrorBoundary from './components/ErrorBoundary';

<ErrorBoundary fallback="Could not render chart">
  <UsagePatternsCharts data={data} />
</ErrorBoundary>;
```

### Performance

`ApneaClusterAnalysis`, `EpapTrendsCharts`, and `UsagePatternsCharts` are wrapped in `React.memo` to skip unnecessary re-renders. When passing callbacks (e.g., `onParamChange`), wrap them with `useCallback` so their references remain stable.

Workers

- Parsing: PapaParse runs in a web worker (`worker: true`).
- Analytics: A lightweight module worker (`src/workers/analytics.worker.js`) computes apnea clusters and false negatives off the main thread. App code falls back to main-thread computation when Worker is unavailable (e.g., tests/jsdom).

Cross-filtering & Range Comparisons

- Cross-filtering: Brushing/zooming in Usage and AHI time-series updates the global date range, filtering all views.
- Range comparisons: Define A and B date ranges to compare mean usage and AHI, with Mann–Whitney U p-values and rank-biserial effects.

Persistence & Sessions (opt-in)

- Opt-in local persistence: Enable “Remember data locally” to save parsed Summary/Details, parameters, and ranges in IndexedDB; saving is debounced to avoid churn during frequent uploads and dev hot reloads.
- Explicit controls: Save now, Load saved, Clear saved. Export/import full JSON sessions for sharing or backup.
- Save now is enabled only after turning on “Remember data locally”. “Load saved” is always available and restores the last saved session if present.
- The False Negatives view is implemented in a dedicated `FalseNegativesAnalysis` component, and session persistence is managed by a reusable `useSessionManager` hook.

For contribution and workflow details, see [AGENTS.md](AGENTS.md).

### Data Dictionary (expected columns)

- Summary CSV (night-level):
  - `Date`: ISO or locale date per night.
  - `Total Time`: string duration `HH:MM:SS` (used for usage hours).
  - `AHI`: numeric apnea–hypopnea index.
  - `Median EPAP`: numeric cmH₂O.
  - Optional leak columns: e.g., `Leak Median`, `Leak % > thr` (auto-detected by name).
- Details CSV (event-level):
  - `Event`: one of `ClearAirway`, `Obstructive`, `Mixed`, `FLG` (flow limitation), etc.
  - `DateTime`: timestamp for event start.
  - `Data/Duration`: numeric; for apneas = duration (s), for FLG = level.

If your exports use different column names, adjust in code or add a mapping layer.

### Local development

After installing dependencies with `npm install`, run the development server:

```bash
npm run dev
```

The app will reload automatically on code changes.

### Building for production

To build the app for production deployment:

```bash
npm run build
```

Built files will be output to the `dist/` directory.

### Running analysis script

An optional CLI tool is provided for detailed event analysis:

```bash
node analysis.js <detailsCsv> [YYYY-MM-DD] [groupGapSec]
```

### Testing

This project uses [Vitest](https://vitest.dev/) for unit and integration testing. Tests are colocated with source files using the `.test.*` suffix.

**Run tests once:**

```bash
npm run test
```

**Run tests in watch mode:**

```bash
npm run test:watch
```

**Generate a coverage report:**

```bash
npm run test:coverage
```

Vite builds are also run in the pre-commit hook and CI to enforce clean builds without warnings; please resolve any Vite warnings before committing your code.
Tests are automatically run before each commit via a Git hook configured with [Husky](https://typicode.github.io/husky/). After installing dependencies, run `npm run prepare` to set up Git hooks.

Continuous integration is configured to run tests on GitHub Actions for each push and pull request (see `.github/workflows/ci.yml`).

### Linting and Formatting

Run ESLint to check code style and Prettier to format:

```bash
npm run lint
npm run format
```

The linter enforces strict rules such as React hook dependency completeness,
no unused variables or empty blocks, and rejection of irregular whitespace.
The pre-commit hook runs `npm run lint` along with tests and the build, and CI also runs lint before building and testing.

See `analysis.js` for usage details.

Future iterations may include additional visualizations, improved styling, and automated build tooling.

## Visualization Standards

- Titles and labels: All charts include clear titles and axis labels; legends are enabled where multiple traces or encodings need explanation.
- In-chart help: Each visualization includes a small “i” help icon at the top-right of the chart area. Hover or focus to see a concise description of what is shown and how to interpret it.
- Theming: Charts share the dark/light theme via `src/utils/chartTheme.js` and follow the app’s theme toggle.

## Methods Notes

- Date-aware rolling windows: Rolling metrics (e.g., 7- and 30-night averages) are computed using calendar-day windows, not fixed counts. For each date, the window includes all nights within the last N days (inclusive), which makes results robust to gaps in the record.
- Confidence intervals: We draw uncertainty ribbons around rolling means using a normal approximation (mean ± 1.96·SE with unbiased variance inside the window). For rolling medians, we compute an order-statistic–based, distribution-free CI via a binomial approximation. These are efficient client-side methods; in future workerized passes we may offer bootstrap CIs.

- Mann–Whitney U test: For small samples, we compute an exact two-sided p-value by enumerating the rank-sum distribution (with average ranks for ties). For larger samples, we use a tie-corrected normal approximation. We report the rank-biserial effect size and an approximate 95% CI derived from a Wilson interval on the common language effect (CL), transformed via effect = 2·CL − 1.

- Change-point detection: We apply least-squares segmentation (PELT-style dynamic programming) with a configurable penalty to locate structural breaks in AHI and usage series. Detected change-points are marked as solid purple lines; crossover-based breakpoints remain as dotted guides.

- LOESS and running quantiles: The EPAP×AHI scatter includes a LOESS smoother (tricube-weighted local linear fit) and running quantile curves (median p50, high-tail p90) computed over k-nearest neighbors along EPAP. These summarize central tendency and high-end burden across pressures.

- Partial correlations: When Usage and/or Leak variables are available, a partial correlation heatmap shows pairwise relationships after linearly controlling for those confounders (via OLS residuals). This helps isolate EPAP–AHI association net of usage/leak effects.

- Survival analysis: Apnea event duration survival is shown via the Kaplan–Meier estimator (all events uncensored). Confidence bands use a log–log Greenwood approximation; interpret as approximate 95% pointwise intervals.

- Clustering refinements: Clusters can optionally enforce a minimum density (events per minute). FLG-based boundary extension uses dual thresholds (enter/exit) with hysteresis so brief dips don’t break edges. Parameters are exposed in the Clusters panel.

- False-negative presets: A presets control (Strict / Balanced / Lenient) tunes FLG threshold, min duration, and confidence requirement for identifying potential false-negative intervals.

## Reporting & Export

- Aggregates CSV: Export a CSV of high-level metrics (usage, AHI, EPAP) via the Aggregates button in the controls.
- Print Report: Open a print-friendly summary page (Usage, AHI, EPAP KPIs, counts of clusters/false-negatives). Use your browser’s “Save as PDF” to archive.

## Accessibility & Performance

- Keyboard focus: Inputs and buttons show clear focus; charts are accompanied by help text and labeled controls.
- Color/contrast: Theming ensures readable contrast in light and dark; primary buttons are theme-tinted rather than overly saturated.
- Performance: Parsing and analytics run in workers when available; long tables are virtualized; avoid loading very large files in one go if memory is constrained.
