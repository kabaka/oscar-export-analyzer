# Troubleshooting Guide

This chapter lists common issues and step‑by‑step solutions. Always ensure you are running the latest version of the analyzer before reporting a bug.

## File Loading Problems

### "File type not supported" message

- Confirm the file extension is `.csv`.
- Ensure the export came directly from OSCAR without being opened in Excel or another editor that might alter formatting.
- Check that the first row contains a header row with fields like `Date` or `Event`.

### Progress bar freezes midway

- Files over 100 MB show a warning about parsing time and memory usage. Keep the tab active and avoid intensive tasks in other tabs during processing.
- Files over 150 MB are blocked—split your export into smaller date ranges in OSCAR.
- Inspect the browser console for parse errors. Rows with malformed timestamps or non‑numeric values are skipped but counted.

### Charts show no data

- Verify that the Summary CSV was successfully parsed (look for console messages indicating row counts).
- Ensure `Date` values use `YYYY-MM-DD`. Other formats may be interpreted as invalid dates.
- For details‑dependent charts (clusters, false negatives), confirm the Details CSV was loaded and contains `Event` and `DateTime` columns.

## Performance and Display

### Sluggish interface when zooming

- Disable other intensive applications to free system resources.
- Try a Chromium‑based browser, which offers faster canvas rendering than some alternatives.
- Reduce the number of nights loaded by filtering the CSV before import.

### Charts do not render or appear blank

- Clear stored data from your browser and reload the page.
  - Disable browser extensions that inject content scripts, as they can interfere with canvas rendering.
- Verify that WebGL is enabled in your browser; some visualizations fall back to CPU rendering otherwise.

### Wrong time zone displayed

- OSCAR exports use the local time of the machine that created them. If your computer’s time zone changed, times may appear shifted. Re‑export the data from OSCAR using the correct time zone to fix historical records.

## Session Persistence

### Saved sessions disappear after closing the browser

- Some privacy settings clear `IndexedDB` on exit. Check your browser’s cookie and site‑data retention policies.
- In private/incognito mode, use the menu's **Export JSON** to manually save a session between visits.

### Unable to import a previously exported JSON

- Ensure the file was exported from the same or a newer version of the analyzer. Older snapshots may use outdated field names.
- Verify that the file was not modified. JSON must be valid and UTF‑8 encoded.

## Miscellaneous

### Fitbit OAuth: Passphrase or Session Issues

#### Problem

After connecting Fitbit, you are unexpectedly prompted to re-enter your encryption passphrase, or connection fails with a session error.

#### Why this happens

- The app restores your passphrase automatically after OAuth using sessionStorage or a secure localStorage backup.
- If session/local storage is cleared (by privacy settings, incognito mode, or extensions), you must re-enter your passphrase to complete the connection.

#### Solutions

- Ensure your browser allows `sessionStorage` and `localStorage` (not cleared by privacy settings or extensions).
- Do not clear browser session data during the OAuth process.
- Try reconnecting with privacy settings relaxed or in a different browser.
- If you use incognito/private mode, you may need to re-enter your passphrase every time.
- If the problem persists, check the [Fitbit Integration Guide](11-fitbit-integration.md#troubleshooting) for more details and security rationale.

### Printed report misses charts

- The browser’s print dialog may omit background graphics. Enable “Print backgrounds” or “Background graphics” in print settings.
- Use landscape orientation for wide charts such as correlation matrices.

### Analysis.js fails with "Cannot find module"

- Run `npm install` to ensure dependencies are available.
- Execute the script with Node 20: `node analysis.js path/to/Details.csv [YYYY-MM-DD] [--algorithm=<bridged|kmeans|agglomerative>]`.

## If these steps do not resolve your problem, consult the project’s issue tracker and include console logs, browser version, and a description of the steps leading to the error.

## See Also

- [Getting Started](01-getting-started.md) — Review proper CSV export and file upload procedures
- [FAQ](05-faq.md) — Quick answers to common questions
- [Data Dictionary](03-data-dictionary.md) — Verify expected CSV column names and formats
- [Printing and Exporting](09-printing-and-exporting.md) — Troubleshooting print and export issues

---
