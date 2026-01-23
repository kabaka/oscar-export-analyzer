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

The parser streams only the necessary rows and converts timestamps inside the worker. A counter displays how many rows have been processed and when parsing is complete.

**File Size Limits**:

- Files **under 100 MB** load without warnings.
- Files **100 MB to 150 MB** trigger a warning about parsing time (~5 seconds) and memory usage (~1 GB), but upload is allowed. Keep other browser tabs lightweight during processing.
- Files **over 150 MB** are blocked. If you have exports larger than 150 MB, split them into smaller date ranges using OSCAR's export options.
- **Best practice**: Keep files under 120 MB for optimal performance.

All data processing happens locally in your browser—no data leaves your device.

## 3. Navigating the Interface

The application is organized into several views accessible from the sidebar:

- **Overview** – High‑level KPIs for usage and AHI.
- **Usage Patterns** – Time‑series, histograms, and calendar heatmaps.
- **AHI Trends** – Detailed look at nightly AHI including distribution plots.
- **Pressure & Correlation** – Relationship between EPAP and AHI with scatter plots and LOESS fits.
- **Range Comparison** – Compare two arbitrary date ranges.
- **Event Analysis** – Includes apnea duration distributions, cluster detection, and potential false negatives.
- **Raw Data** – Tabular view of the CSV contents with filtering and export.

Use the theme toggle in the header to switch between light, dark, or system themes. A global date range filter beside the title narrows which nights are included in every view.

### Mobile and Tablet Support

OSCAR Export Analyzer is fully responsive and works on phones, tablets, and desktop computers:

- **Mobile (phones)** – On smaller screens, the sidebar navigation becomes a hamburger menu (☰) in the top-left corner. Tap it to open the navigation drawer and select your view. Charts automatically resize to fit your screen, with optimized font sizes and touch-friendly controls.
- **Tablet** – The layout adapts to provide more space for charts while maintaining easy navigation. All interactive elements are sized for touch input (44×44 pixel minimum targets).
- **Desktop** – The full sidebar remains visible, and charts display at maximum size with all features accessible.

All functionality is available across devices—the interface simply adapts to your screen size. Date filters, theme toggles, and chart interactions work the same way regardless of device.

## 4. Saving and Restoring Sessions

Sessions persist automatically to `IndexedDB` so you can close and reopen the browser without reloading data. Importing a new Summary CSV replaces the previous session. Use the splash screen's **Load previous session** button or drop a session JSON file there to restore an earlier analysis. The exported JSON includes all loaded rows but excludes any personal notes you may have added.

## 5. Data Storage and Privacy

OSCAR Export Analyzer is designed with privacy as a core principle. **All your health data stays on your device** and never leaves your browser. Understanding when and where data is stored helps you maintain control over your sensitive health information.

### When Data Is Saved

The application saves your data in three situations:

1. **Automatically on CSV upload** – When you load Summary or Details CSV files, they are immediately saved to your browser's local storage for convenience.
2. **Every 500ms during parameter changes** – As you adjust analysis settings (date ranges, cluster thresholds, etc.), the app automatically saves your current state to preserve your work.
3. **Manually via "Save Session"** – Use the header menu's **Save Session** option to export your current analysis as a JSON file to your computer's filesystem.

### Where It's Stored

Your health data is stored **only on your local device**:

- **Browser IndexedDB** – The primary storage location is your browser's IndexedDB database, which is specific to this browser on this device. This is how the app remembers your data between visits.
- **Session export files** – When you use "Save Session", a JSON file is saved to whichever folder you choose (typically Downloads). These files remain under your control.
- **No cloud storage** – The application does not use any cloud services, remote servers, or external databases.
- **No network transmission** – Your data is never sent over the network. The app works fully offline and makes no API calls.

### How Long It Persists

Data remains in your browser until you explicitly delete it:

- **Persists across browser sessions** – Simply closing the browser tab or window does **not** delete your data. It will still be there when you return.
- **Specific to browser and device** – Data stored in Chrome on your laptop is separate from Chrome on your phone or Firefox on your laptop. It does not sync between devices or browsers.
- **Until manually cleared** – Data remains indefinitely until you use the "Clear Session" button or clear your browser storage.
- **Incognito/private browsing doesn't persist** – If you use private browsing mode, your data is automatically deleted when you close the private window. This is a good option for temporary analysis.

### How to Delete Your Data

You have complete control over deleting your health data:

1. **Use "Clear Session" (recommended)** – Click the menu button (☰) in the header, then select **Clear Session**. This immediately removes all data from IndexedDB and returns you to the import screen.

2. **Clear browser storage manually** – You can also delete data through your browser settings:
   - **Chrome/Edge**: Settings → Privacy and security → Site settings → View permissions and data stored across sites → Search for the app URL → Clear data
   - **Firefox**: Settings → Privacy & Security → Cookies and Site Data → Manage Data → Search for the app URL → Remove Selected
   - **Safari**: Settings → Privacy → Manage Website Data → Search for the app URL → Remove

3. **Use incognito/private browsing** – For temporary analysis, open the app in an incognito or private browsing window. Your data will be automatically deleted when you close that window.

4. **Clear all browser data** – Using your browser's "Clear browsing data" or "Clear history" feature will also remove OSCAR analyzer data if you select "Cached images and files" or "Site data".

> **Important**: Closing the browser tab or window does **not** delete your data. You must explicitly use one of the methods above.

### Privacy Guarantees

OSCAR Export Analyzer is built with a local-first architecture that prioritizes your privacy:

- ✅ **All processing happens locally** – Statistical analysis, clustering algorithms, and chart rendering all execute in your browser's JavaScript engine.
- ✅ **Data never leaves your device** – There are no API calls, no telemetry, no analytics services, and no data transmission of any kind.
- ✅ **No tracking or analytics** – The application does not use Google Analytics, error reporting services, or any third-party tracking scripts.
- ✅ **Safe to use offline** – The app works perfectly in airplane mode or without an internet connection, confirming that no network access is required.
- ✅ **Open source transparency** – The entire codebase is publicly available on GitHub, allowing security audits and verification of these privacy claims.

Your CPAP therapy data is sensitive health information. The local-first design ensures that you maintain complete control and ownership of your data at all times.

## 6. Example Workflow

1. Load a year of summary and details data.
2. Visit **Usage Patterns** to verify that at least 70% of nights exceed four hours of usage. Investigate dips with the calendar heatmap.
3. Open **AHI Trends** and note any nights above 5 AHI. Use the table of "bad nights" to jot down potential causes in a journal.
4. Go to **Pressure & Correlation** and check whether higher EPAP correlates with lower AHI. If the LOESS trend slopes downward, discuss with your clinician whether pressure adjustments are warranted.
5. Use **Range Comparison** to contrast the month before and after a mask change. Look at `ΔUsage` and `ΔAHI` along with the `p`‑value to gauge the effect.

## 7. Keyboard Shortcuts

- `?` – Open the help modal.
- `t` – Toggle theme.

## 8. Troubleshooting

See [06-troubleshooting.md](06-troubleshooting.md) for an extensive list of issues and remedies. Common early hurdles include malformed CSV headers, missing columns, or browser extensions that block local file reads.

## 9. Next Steps

Once you are comfortable loading data and navigating the interface, explore the remaining chapters of the user guide to learn how to interpret specific visualizations and statistical outputs.

---

## See Also

- [Visualizations and Interpretation](02-visualizations.md) — Detailed explanations of all charts and what they reveal about therapy quality
- [Data Dictionary](03-data-dictionary.md) — Complete reference of CSV columns and metric definitions
- [Troubleshooting](06-troubleshooting.md) — Solutions for common import and parsing issues
- [Printing and Exporting](09-printing-and-exporting.md) — Save reports and export data for further analysis
- [Disclaimers](08-disclaimers.md) — Important information about data privacy and medical use

---
