# OSCAR Export Analyzer

[![CI](https://github.com/kabaka/oscar-export-analyzer/actions/workflows/ci.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

OSCAR Export Analyzer is a web‑based toolkit for exploring CSV exports produced by the [OSCAR](https://www.sleepfiles.com/OSCAR/) sleep‑therapy companion. It was built for curious patients, clinicians, and researchers who want to inspect nightly therapy performance in greater depth than OSCAR’s own interface. The application parses both nightly summary exports and detailed event logs, renders a large collection of interactive charts, and surfaces statistics that help guide conversations with a healthcare professional.

## Table of Contents

- [Project Goals](#project-goals)
- [Architecture Overview](#architecture-overview)
- [Installation](#installation)
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

The analyzer is implemented as a [Vite](https://vitejs.dev/) + [React](https://react.dev/) single‑page application. Parsing of large CSV files occurs in a Web Worker so the interface remains responsive. State is stored with lightweight custom hooks and may optionally persist to the browser’s `IndexedDB`. Tests are written with [Vitest](https://vitest.dev/) and [Testing Library](https://testing-library.com/).

```
┌────────────┐   CSV Upload   ┌──────────────┐   Derived Series   ┌─────────────┐
│   Browser  │ ─────────────▶ │  Web Worker  │ ─────────────────▶ │  React UI   │
└────────────┘                └──────────────┘                    └─────────────┘
```

## Installation

1. Install [Node.js 20](https://nodejs.org/) and npm.
2. Clone this repository and install dependencies:
   ```bash
   git clone https://github.com/OWNER/REPO.git
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

## Usage Walkthrough

1. Export `Summary.csv` and optionally `Details.csv` from OSCAR.
2. In the analyzer, use the **Summary CSV** picker to load the nightly summary file.
3. Optionally load the **Details CSV** to unlock cluster detection and false‑negative analysis.
4. Navigate via the sidebar to explore dashboards: **Overview**, **Usage Patterns**, **AHI Trends**, and more.
5. Hover any chart element for a tooltip. Click legend items to toggle series visibility. Use the zoom controls to focus on ranges of interest.
6. Enable **Remember data locally** if you want sessions to persist after closing the tab. Uploading a new Summary CSV replaces any previous session, and data is only saved after a file has been loaded so a refresh with no files won't wipe prior data. Use **Export JSON** to save a portable session snapshot.

## Feature Tour

- **Overview Dashboard** – At‑a‑glance KPIs for adherence and AHI with small trend sparklines.
- **Usage Patterns** – Time‑series, histograms, and calendar heatmaps reveal how consistently therapy is being used. A 7‑night and 30‑night rolling average quantify medium‑ and long‑term trends.
- **AHI Trends** – Breaks AHI into nightly values with optional obstructive/central stacking. Histogram and QQ plots test whether AHI is normally distributed.
- **Pressure & Correlation** – Investigates how exhalation pressure (EPAP) relates to AHI. Scatter plots, LOESS curves, and correlation matrices support hypothesis generation.
- **Range Comparison** – Select two date ranges to compute deltas, `p`‑values, and effect sizes for usage and AHI.
- **Event Exploration** – Duration distributions, survival curves, and interactive tables for apnea clusters and potential false negatives.
- **Raw Data Explorer** – Spreadsheet‑like views with sorting and filtering for the original CSV fields.

Each view includes contextual help links that open the corresponding page in the user guide located in the `docs/user` directory.

## Data Privacy

All processing occurs locally in your browser. The application never transmits your CSV files, computed statistics, or exported reports over the network. Disabling **Remember data locally** clears stored information. You may also click **Clear saved**, clear your browser cache, or use a private/incognito window for one‑time analyses.

## Troubleshooting

If the application fails to load or a chart appears blank, consult [docs/user/06-troubleshooting.md](docs/user/06-troubleshooting.md) for detailed remedies. Common fixes include clearing cached sessions, ensuring CSV files use UTF‑8 encoding, and verifying that the browser has sufficient memory for large data sets.

## Documentation

Extensive documentation lives in the [`docs`](./docs) folder.

- **User Guide** – Eight chapters cover setup, visualization interpretation, statistical concepts, and more.
- **Developer Guide** – Explains project structure, coding conventions, and how to run tests.
- **Rendering** – Markdown guides are rendered with [react-markdown](https://github.com/remarkjs/react-markdown), [KaTeX](https://katex.org/) for math using GitHub-compatible `$`/`$$` delimiters, and [remark-gfm](https://github.com/remarkjs/remark-gfm) for tables, then sanitized with [DOMPurify](https://github.com/cure53/DOMPurify) to guard against malicious input.

## Contributing

Pull requests are welcome! Please open an issue to discuss major changes. Run the following checks before committing:

```bash
npm run lint
npm test -- --run
npm run build
```

Dependabot monitors npm packages and GitHub Actions workflows, opening pull requests to keep dependencies up to date.

Production builds are deployed to GitHub Pages. Pushes to `main` update the live site, while approved pull requests trigger temporary preview deployments via `.github/workflows/pages.yml`. After approving a PR, authorize the `pr-preview` environment to publish the preview.

See the [Developer Guide](docs/developer/README.md) for testing patterns and architectural notes.

## License

Distributed under the [MIT License](LICENSE). Please consult the license before distributing modified versions.
