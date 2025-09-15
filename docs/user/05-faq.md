# Frequently Asked Questions

This section answers common questions about the OSCAR Export Analyzer. If you encounter an issue not covered here, please open an issue on the project repository.

## General

### Can I analyze nights without a Details CSV?

Yes. Most views only require the Summary CSV. Event‑level analyses such as cluster detection and false negatives become available when a Details file is loaded.

### Why does a CSV fail to parse?

Ensure the file is exported from OSCAR and uses UTF‑8 encoding. Files edited in spreadsheet software may introduce stray headers or change the delimiter. If parsing stalls, open the browser console for error messages and verify that column names match those in the [data dictionary](03-data-dictionary.md).

### How is data stored?

Sessions are saved automatically to IndexedDB. Uploading a new Summary CSV overwrites any prior session and resets Details until a matching file is provided. The app only writes to storage after data has been loaded, so refreshing before uploading files won't wipe the stored session. Use the splash screen's **Load previous session** button or drop a session JSON file to restore that session.

### Can I export results for my doctor?

Use the **Print Page** control to generate a PDF or the aggregates CSV for sharing. The print view hides navigation and buttons but preserves charts and summary tables.

### Is my data uploaded anywhere?

No. All processing happens within your browser. The only network requests performed are for application assets such as JavaScript bundles.

## Visualization

### How are rolling averages computed?

Rolling windows include calendar days even when no data exists, preventing inflated averages after gaps. See [Statistical Concepts](04-statistical-concepts.md) for formulas.

### What do the colors in the calendar heatmap mean?

The heatmap uses a gradient from light (low usage) to dark (high usage). You can hover any cell to see the exact hours used on that date.

### Why are some charts empty?

Certain visualizations require specific columns. For example, the correlation matrix appears only if leak data is present. Verify that your Summary CSV contains the necessary fields.

## Troubleshooting

### The page freezes when I load a large CSV.

Parsing occurs in a Web Worker and should remain responsive, but extremely large exports may still strain memory. Try limiting the export to a smaller date range or using a browser with more available RAM.

### The session does not save between visits.

Some privacy modes or browser settings (e.g., “Clear cookies on exit”) prevent IndexedDB persistence.

### I accidentally imported the wrong file. How do I reset?

Clear your browser storage or use a private/incognito window for a fresh start.

### Can I run the analyzer offline?

Yes. Once the application is loaded, it functions without an internet connection. You can even package it as a static site and open `index.html` directly in a browser.

## Advanced

### How can I customize clustering thresholds?

Open the “Clustered Apnea Events” panel and expand the settings section. Parameters include gap seconds, flow‑limitation bridge threshold and gap, edge enter and exit limits, minimum event count and total apnea seconds, maximum cluster duration, and minimum density. Settings persist with the session.

### Can I script analyses instead of using the UI?

The repository includes `analysis.js`, a Node script that mirrors the app's clustering logic. Run `node analysis.js <Details.csv> [YYYY-MM-DD] [gapSec] [flgBridgeThreshold] [flgClusterGapSec]` to analyze a night from the command line.

### Does the analyzer support non‑OSCAR CSVs?

Not directly. However, you can transform other data sources into the expected format described in the [data dictionary](03-data-dictionary.md). Future versions may include import adapters.
