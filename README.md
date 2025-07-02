# OSCAR Sleep Data Analysis Web App

This is a rudimentary React-based web application for evaluating OSCAR sleep data exports.

## Usage

1. Open `index.html` in your web browser (using `file://` or host via a local HTTP server).
2. Use the file inputs to select your OSCAR **Summary** and **Details** CSV files from the `data/` directory.
3. The app will parse and display (determinate progress bars show parsing progress for each file):
   - Usage patterns over time (average usage, nights ≥ 4 h, etc.)
   - AHI trends (average, min, max, nights with AHI > 5)
   - Pressure settings trends (median EPAP changes and EPAP vs AHI)
   - Clustered apnea events (clusters of obstructive/central events separated only by a few seconds; shows start time, duration, and count; only clusters with more than one event are listed)
   - Potential false negatives (clusters of high flow-limit events with no obstructive/central events; shows start time, duration, and confidence score)

## Development

- The app uses React (via CDN), Babel (for JSX), and PapaParse for CSV parsing.
- To extend or modify the code, edit `app.js` and `styles.css` as needed.

Future iterations may include additional visualizations, improved styling, and automated build tooling.
