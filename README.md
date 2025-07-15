# OSCAR Sleep Data Analysis Web App

This is a rudimentary React-based web application for evaluating OSCAR sleep data exports.

## Usage

1. Install dependencies and start the development server:

   ```bash
   npm install
   npm run dev
   ```

2. Open your browser to the URL shown in the terminal (usually `http://localhost:5173`).

3. Use the file inputs to select your OSCAR **Summary** and **Details** CSV files from the `data/` directory.

4. The app will parse and display (determinate progress bars show parsing progress for each file):
   - Usage patterns over time (average usage, nights ≥ 4 h, etc.)
   - AHI trends (time-series, histogram, boxplot, average, min, max, threshold line at AHI > 5)
   - Pressure settings trends (median EPAP changes and EPAP vs AHI)
   - Clustered apnea events: click a row in the scrollable cluster table below to view an event-level Gantt timeline for the selected cluster; table shows each cluster’s start, duration, and count
  - Timeline overlay and table of potential false negatives (clusters of high flow-limit events with no obstructive/central events; shows start time, duration, and confidence score)
  - Apnea event characteristics and anomaly reporting (event duration percentiles, extreme and outlier events, per-night event frequency and outlier nights)

## Development

The app is built with Vite, React, and PapaParse.

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

See `analysis.js` for usage details.

Future iterations may include additional visualizations, improved styling, and automated build tooling.
