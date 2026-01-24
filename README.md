# OSCAR Export Analyzer

[![CI](https://github.com/kabaka/oscar-export-analyzer/actions/workflows/ci.yml/badge.svg)](https://github.com/kabaka/oscar-export-analyzer/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

OSCAR Export Analyzer is a web‑based toolkit for exploring CSV exports produced by the [OSCAR](https://www.sleepfiles.com/OSCAR/) sleep‑therapy companion. It was built for curious patients, clinicians, and researchers who want to inspect nightly therapy performance in greater depth than OSCAR’s own interface. The application parses both nightly summary exports and detailed event logs, renders a large collection of interactive charts, and surfaces statistics that help guide conversations with a healthcare professional.

## Table of Contents

- [Project Goals](#project-goals)
- [Architecture Overview](#architecture-overview)
- [Progressive Web App](#progressive-web-app)
- [Installation](#installation)
- [Development](#development)
- [Usage Walkthrough](#usage-walkthrough)
- [Feature Tour](#feature-tour)
- [Data Privacy](#data-privacy)
- [Troubleshooting](#troubleshooting)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

## Project Goals

The project aims to make longitudinal therapy data easy to understand. Key design goals include:

- **Transparency** – All calculations are documented and open‑source so power users can audit methodology.
- **Portability** – Runs entirely in the browser; no data leaves your machine unless you explicitly export it.
- **Education** – Tooltips, footnotes, and linked guides explain terms such as _AHI_, _EPAP_, and _Mann–Whitney U_ in plain language.
- **Experimentation** – Users can compare two ranges of nights to evaluate changes in equipment or settings.

## Architecture Overview

The analyzer is implemented as a [Vite](https://vitejs.dev/) + [React](https://react.dev/) single‑page application with comprehensive responsive design for mobile, tablet, and desktop devices. Parsing of large CSV files occurs in a Web Worker so the interface remains responsive. State is stored with lightweight custom hooks and may optionally persist to the browser's `IndexedDB`. Tests are written with [Vitest](https://vitest.dev/) and [Testing Library](https://testing-library.com/).

```
┌────────────┐   CSV Upload   ┌──────────────┐   Derived Series   ┌─────────────┐
│   Browser  │ ─────────────▶ │  Web Worker  │ ─────────────────▶ │  React UI   │
└────────────┘                └──────────────┘                    └─────────────┘
```

## Progressive Web App

OSCAR Export Analyzer is a **Progressive Web App (PWA)** that you can install on your device for offline access and a native app-like experience.

### Install the App

**Desktop (Chrome/Edge)**:

1. Open the app in your browser
2. Click the header menu (☰) in the top-right
3. Select **"Install App"**

**Mobile (iOS)**:

1. Open in Safari (must be Safari, not Chrome)
2. Tap the Share button → **"Add to Home Screen"**

**Mobile (Android)**:

1. Open in Chrome
2. Tap the **"Add to Home Screen"** banner

### PWA Features

✅ **Offline Access** — Work anywhere, even without internet  
✅ **Native App Experience** — Full-screen interface without browser chrome  
✅ **Faster Loading** — App resources cached for instant startup  
✅ **Cross-Device Transfer** — Export encrypted sessions to continue analysis on another device  
✅ **Auto-Updates** — Receive updates with your permission (non-disruptive)

### Privacy Guarantee

Installing the app **does not change** our privacy model:

- Your CPAP data stays 100% local—never uploaded to servers
- No automatic browser sync or cloud storage
- You control all data transfers via encrypted export/import
- Works fully offline after initial install

For detailed installation instructions, offline usage, and cross-device workflows, see the [Progressive Web App Guide](docs/user/10-progressive-web-app.md).

## Installation

1. Install [Node.js 20](https://nodejs.org/) and npm.
2. Clone this repository and install dependencies:
   ```bash
   git clone https://github.com/kabaka/oscar-export-analyzer.git
   cd oscar-export-analyzer
   npm install
   npm run prepare
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open the URL printed in the terminal (usually <http://localhost:5173>) in a modern browser.

To deploy the app under a custom path, set the `BASE_URL` environment variable before building:

```bash
BASE_URL=/custom/ npm run build
```

If `BASE_URL` is unset, the build defaults to `/oscar-export-analyzer/`.

## Development

Common workflows for contributors:

- `npm run lint` – Check code style with the shared ESLint configuration.
- `npm test -- --run` – Execute the Vitest suite once without watch mode.
- `npm run lint:magic` – Generate `reports/magic-numbers.json` by running the focused `no-magic-numbers` audit script.

## Usage Walkthrough

1. Export `Summary.csv` and optionally `Details.csv` from OSCAR.
2. On first load a full‑screen dialog appears; drag both files into it or use the picker to choose them.
3. The app auto‑detects which is which and loads them in order, unlocking cluster detection and false‑negative analysis.
4. Navigate via the sidebar to explore dashboards: **Overview**, **Usage Patterns**, **AHI Trends**, and more.
5. Use the date range filter in the header to limit which nights are included across all views.
6. Hover any chart element for a tooltip. Click legend items to toggle series visibility. Use the zoom controls to focus on ranges of interest.
7. Sessions persist automatically to your browser's storage. Drop a saved session JSON on the splash screen or click **Load previous session** there to restore it. Use the header menu's **Export JSON** to save a portable snapshot.

## Feature Tour

Screenshots are temporarily unavailable and will be refreshed after the corrected SVG exports are regenerated.

### Usage Patterns Dashboard

**Usage Patterns** – Time‑series, histograms, STL trend/seasonal/residual panes, calendar heatmaps, and autocorrelation/partial autocorrelation bars reveal how consistently therapy is being used. A 7‑night and 30‑night rolling average quantify medium‑ and long‑term trends while the decomposition highlights weekday habits and outlier nights.

### AHI Trends Analysis

**AHI Trends** – Breaks AHI into nightly values with optional obstructive/central stacking. Histogram and QQ plots test whether AHI is normally distributed, while weekly STL decomposition and paired autocorrelation plots separate the smooth trend from recurring seasonal swings and noisy residuals.

### Pressure & Correlation Analysis

**Pressure & Correlation** – Investigates how exhalation pressure (EPAP) relates to AHI. Scatter plots, LOESS curves, and correlation matrices support hypothesis generation.

---

### Additional Features

- **Overview Dashboard** – At‑a‑glance KPIs for adherence and AHI with small trend sparklines.
- **Range Comparison** – Select two date ranges to compute deltas, `p`‑values, and effect sizes for usage and AHI.
- **Event Exploration** – Duration distributions, survival curves, and interactive tables for apnea clusters and potential false negatives. Toggle between FLG-bridged, k-means, or single-link clustering algorithms (with tunable parameters) to experiment with different grouping assumptions.
- **Raw Data Explorer** – Spreadsheet‑like views with sorting and filtering for the original CSV fields.

Each view includes contextual help links that open the corresponding page in the user guide located in the `docs/user` directory.

## Data Privacy

All processing occurs locally in your browser. The application never transmits your CSV files, computed statistics, or exported reports over the network. You may clear your browser storage or use a private/incognito window for one‑time analyses.

## Troubleshooting

If the application fails to load or a chart appears blank, consult [docs/user/06-troubleshooting.md](docs/user/06-troubleshooting.md) for detailed remedies. Common fixes include clearing cached sessions, ensuring CSV files use UTF‑8 encoding, and verifying that the browser has sufficient memory for large data sets.

## Documentation

Comprehensive documentation lives in the [`docs`](./docs) folder. Start with the [**Documentation Hub**](docs/README.md) for a complete index and quick-start navigation.

### Quick Links

- **[Documentation Hub](docs/README.md)** — Central index with guides organized by role and task
- **[User Guide](docs/user/01-getting-started.md)** — Getting started, visualizations, statistics, troubleshooting
- **[Developer Guide](docs/developer/README.md)** — Architecture, setup, adding features, CLI tool
- **[Printing & Exporting](docs/user/09-printing-and-exporting.md)** — Generate PDFs, export sessions, save CSV aggregates
- **[CLI Tool](docs/developer/cli-tool.md)** — Command-line analysis for batch processing and scripting

**Rendering:** Markdown guides are rendered with [react-markdown](https://github.com/remarkjs/react-markdown), [KaTeX](https://katex.org/) for math using GitHub-compatible `$`/`$$` delimiters, and [remark-gfm](https://github.com/remarkjs/remark-gfm) for tables, then sanitized with [DOMPurify](https://github.com/cure53/DOMPurify) to guard against malicious input.

## Contributing

Pull requests are welcome! Please open an issue to discuss major changes. Run the following checks before committing:

```bash
npm run lint
npm test -- --run
npm run build
```

Production builds are deployed to GitHub Pages. Pushes to `main` update the live site, while approved pull requests trigger temporary preview deployments via `.github/workflows/pages.yml`. After approving a PR, authorize the `pr-preview` environment to publish the preview.

See the [Developer Guide](docs/developer/README.md) for testing patterns and architectural notes.

## License

Distributed under the [MIT License](LICENSE). Please consult the license before distributing modified versions.
