# OSCAR Export Analyzer — User Guide

This guide shows how to load OSCAR CSV exports and interpret the resulting charts and tables. It assumes you have already collected nightly therapy data with a PAP device and imported it into OSCAR.

## 1. Preparing Your Data

Before using the analyzer, export the necessary files from OSCAR:

1. Open OSCAR and navigate to the patient profile of interest.
2. From the **Data** menu choose **Export Data...**
3. Select **Summary** and **Details** CSV exports. The summary file contains one row per night; the details file lists individual apnea events and flow‑limitation intervals.
4. Save the files to a convenient location. Avoid renaming or modifying them so the analyzer can detect columns automatically.

### Summary CSV Columns

The summary export typically includes:

- `Date` – formatted as `YYYY-MM-DD`.
- `Total Time` – therapy usage in hours or `HH:MM:SS`.
- `AHI` – apnea–hypopnea index for the night.
- `Median EPAP` – median expiratory pressure in cmH₂O.
- Optional leak statistics such as `Leak Rate Median` or `% Time above Leak Redline`.

### Details CSV Columns

The details export provides higher fidelity information:

- `Event` – `ClearAirway`, `Obstructive`, `Mixed`, or `FLG` (flow limitation).
- `DateTime` – start timestamp of the event.
- `Data` or `Duration` – event duration in seconds or flow‑limitation magnitude.

## 2. Loading Files into the Analyzer

1. Open <http://localhost:5173> after starting the development server or the deployed site if using a prebuilt bundle.
2. A full‑screen import dialog appears on first load. Drag both CSVs into it or click to choose them from disk.
3. The app inspects the headers to classify files as summary or details and loads them in the proper order. A background worker filters events and streams batches with progress updates so even huge files remain responsive. A small status line in the page header shows the current step along with a compact progress bar.
4. Once loaded, the sidebar links become active and charts render automatically.

### Handling Large Files

The parser streams only the necessary rows and converts timestamps inside the worker. A counter displays how many rows have been processed and when parsing is complete. If memory becomes an issue, consider trimming your export to a smaller date range.

## 3. Navigating the Interface

The application is organized into several views accessible from the sidebar:

- **Overview** – High‑level KPIs for usage and AHI.
- **Usage Patterns** – Time‑series, histograms, and calendar heatmaps.
- **AHI Trends** – Detailed look at nightly AHI including distribution plots.
- **Pressure & Correlation** – Relationship between EPAP and AHI with scatter plots and LOESS fits.
- **Range Comparison** – Compare two arbitrary date ranges.
- **Event Analysis** – Includes apnea duration distributions, cluster detection, and potential false negatives.
- **Raw Data** – Tabular view of the CSV contents with filtering and export.

Use the theme toggle in the header to switch between light, dark, or system themes. A global date range filter beside the title narrows which nights are included in every view. The interface responds to window resizing and touch input for tablets.

## 4. Saving and Restoring Sessions

Sessions persist automatically to `IndexedDB` so you can close and reopen the browser without reloading data. Importing a new Summary CSV replaces the previous session. Use the splash screen's **Load previous session** button or drop a session JSON file there to restore an earlier analysis. The exported JSON includes all loaded rows but excludes any personal notes you may have added.

## 5. Example Workflow

1. Load a year of summary and details data.
2. Visit **Usage Patterns** to verify that at least 70% of nights exceed four hours of usage. Investigate dips with the calendar heatmap.
3. Open **AHI Trends** and note any nights above 5 AHI. Use the table of "bad nights" to jot down potential causes in a journal.
4. Go to **Pressure & Correlation** and check whether higher EPAP correlates with lower AHI. If the LOESS trend slopes downward, discuss with your clinician whether pressure adjustments are warranted.
5. Use **Range Comparison** to contrast the month before and after a mask change. Look at `ΔUsage` and `ΔAHI` along with the `p`‑value to gauge the effect.

## 6. Keyboard Shortcuts

- `?` – Open the help modal.
- `t` – Toggle theme.

## 7. Troubleshooting

See [06-troubleshooting.md](06-troubleshooting.md) for an extensive list of issues and remedies. Common early hurdles include malformed CSV headers, missing columns, or browser extensions that block local file reads.

## 8. Next Steps

Once you are comfortable loading data and navigating the interface, explore the remaining chapters of the user guide to learn how to interpret specific visualizations and statistical outputs.
