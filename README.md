# OSCAR Sleep Data Analysis Web App

This is a React-based web application for evaluating OSCAR sleep data exports.

Design refresh: the UI now uses a clean, card-based layout and polished typography with consistent spacing. It supports both light and dark modes with a theme toggle (Light / Dark / System) that persists your preference.

## Usage

1. Install dependencies and start the development server:

   ```bash
   npm install
   npm run dev
   ```

2. Open your browser to the URL shown in the terminal (usually `http://localhost:5173`).

3. Use the file inputs to select your OSCAR **Summary** and **Details** CSV files from the `data/` directory.
4. Use the theme toggle in the header to switch between Light, Dark, or System (follows OS).

4. The app will parse and display (determinate progress bars show parsing progress for each file):
   - Usage patterns over time (average usage, nights ≥ 4 h, etc.)
   - Expanded usage analytics: 7/30-night moving averages, adherence breakpoints, compliance KPIs (≥4h/≥6h), and a weekly calendar heatmap
   - AHI trends (time-series, histogram, boxplot, average, min, max, threshold line at AHI > 5)
   - Pressure & leak: EPAP trends and distribution, EPAP vs AHI scatter and 2D density, correlation matrix (EPAP, AHI, usage, optional leak), and EPAP titration helper with Mann–Whitney test
   - Clustered apnea events: parameter panel allows tuning gap seconds, FLG bridge threshold, FLG gap, minimum event count, and min/max total duration; clusters recompute live. Table is sortable (duration, count, severity) and supports CSV export. Click a row to view an event-level Gantt timeline for the selected cluster.
 - Timeline overlay and table of potential false negatives (clusters of high flow-limit events with no obstructive/central events; shows start time, duration, and confidence score)
  - Apnea event characteristics and anomaly reporting (event duration percentiles, extreme and outlier events, per-night event frequency and outlier nights)

### Navigation

- In-page links in the sticky Table of Contents smoothly scroll with an automatic offset so headers aren’t hidden beneath the sticky app header.
- The "Overview" section becomes available as soon as a Summary CSV is loaded (no Details file required).
- The Table of Contents highlights the active section as you scroll, using IntersectionObserver; clicking a link also activates it immediately.

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

The app is built with Vite, React, and PapaParse.

For contribution and workflow details, see [AGENTS.md](AGENTS.md).

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
