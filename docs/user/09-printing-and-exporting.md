# Printing and Exporting

OSCAR Export Analyzer provides several ways to save and share your analysis results. You can print reports for offline review, export sessions for backup, or generate CSV files for spreadsheet analysis. All export operations maintain your privacy—no data leaves your device unless you explicitly save or share files.

## Table of Contents

- [Printing Reports](#printing-reports)
- [Exporting Session Data](#exporting-session-data)
- [Exporting CSV Aggregates](#exporting-csv-aggregates)
- [Print vs. Export: Which to Use?](#print-vs-export-which-to-use)
- [Troubleshooting](#troubleshooting)

## Printing Reports

The analyzer includes a print-optimized view that formats charts and statistics for paper or PDF export.

### How to Print

1. Open the **header menu** (☰ icon in the top-left corner)
2. Click **Print Page**
3. Review the **print warning dialog**:
   - Large datasets may take 1–2 minutes to render
   - Charts will be included in the output
   - Interactive elements (buttons, menus) will be hidden
4. Click **Continue** to open your browser's print dialog

**Keyboard shortcut**: Press `Ctrl+P` (Windows/Linux) or `Cmd+P` (macOS) when data is loaded. The print warning dialog will appear before the browser print dialog opens.

### What's Included

The printed report contains:

- **Summary statistics** — AHI, usage hours, therapy pressure ranges
- **All visible charts** — Usage patterns, AHI trends, EPAP trends, correlation matrices
- **Cluster analysis** — Detected apnea event clusters (if Details CSV loaded)
- **False negative detection** — Likely unreported events (if Details CSV loaded)
- **Range comparisons** — Statistical tests comparing two date ranges (if configured)

**What's excluded:**

- Navigation sidebar and table of contents
- Header menu and controls
- Interactive buttons and inputs
- Date range picker
- Theme toggle
- Any data that hasn't been loaded yet

### Saving as PDF

Most browsers support "Save as PDF" in the print dialog:

**Chrome/Edge:**

1. Open print dialog (`Ctrl+P` / `Cmd+P`)
2. Set **Destination** to "Save as PDF"
3. Configure page settings (see below)
4. Click **Save**

**Firefox:**

1. Open print dialog
2. Select "Microsoft Print to PDF" or "Save to PDF" (macOS)
3. Adjust settings
4. Click **Save** or **Print**

**Safari:**

1. Open print dialog (`Cmd+P`)
2. Click **PDF** dropdown in lower-left corner
3. Choose "Save as PDF"
4. Click **Save**

### Print Settings

For best results, configure these settings in your browser's print dialog:

| Setting                 | Recommended Value     | Why                                     |
| ----------------------- | --------------------- | --------------------------------------- |
| **Layout**              | Portrait or Landscape | Landscape works better for wide charts  |
| **Margins**             | Default or Minimum    | Fits more content per page              |
| **Scale**               | 100% or "Fit to page" | Prevents chart clipping                 |
| **Background graphics** | Enabled               | Includes chart colors and shading       |
| **Headers/Footers**     | Optional              | Browser adds page numbers automatically |

**Page breaks**: The analyzer uses automatic page breaks. If a chart or section splits awkwardly, try adjusting the scale or switching to landscape orientation.

### Print Styling

The app applies special print-only CSS that:

- Hides interactive controls (buttons, inputs, navigation)
- Forces dark text on light backgrounds for readability
- Adjusts Plotly legend colors for print contrast
- Maintains chart aspect ratios
- Preserves table formatting

If you see rendering issues, check that "Background graphics" is enabled in your browser's print settings—this ensures chart colors appear correctly.

## Exporting Session Data

Session export saves your entire analysis state as a JSON file. This includes parsed CSV data, date filters, and analysis parameters—everything needed to restore your session later or share with colleagues.

### How to Export a Session

1. Open the **header menu** (☰ icon)
2. Click **Export Session (JSON)**
3. A file named `oscar_session_PHI.json` downloads automatically
4. Store this file securely—it contains health data

### What's in a Session File

The JSON file includes:

- **Parsed CSV rows** — All summary and details data
- **Date ranges** — Selected start/end dates and filter settings
- **Analysis parameters** — Cluster detection settings, range comparison dates
- **Metadata** — Export date, version, file checksums

**Not included:**

- Personal notes or annotations (intentionally excluded for privacy)
- Theme preferences (system-dependent)
- Browser-specific settings

### Importing a Session

To restore a saved session:

1. Open the **header menu**
2. Click **Load Data**
3. In the import dialog, drag the `oscar_session_PHI.json` file or click to select it
4. The analyzer detects it as a session file and restores all data

**Alternative**: Use the **Load previous session** button on the splash screen if you've enabled "Remember data locally."

### Session File Security

⚠️ **Session files contain Protected Health Information (PHI)**. The filename includes `_PHI` as a reminder.

**Best practices:**

- Store session files in encrypted locations (encrypted disk, password-protected archive)
- Avoid emailing session files—use secure file transfer if sharing with healthcare providers
- Delete session files when no longer needed
- Never upload session files to public cloud storage without encryption

**Sharing sessions**: If you need to share a session with a clinician or researcher, confirm they have secure storage before sending. Consider using password-protected ZIP files or secure file-sharing services.

## Exporting CSV Aggregates

The analyzer can export summary statistics as CSV files for use in spreadsheet applications or statistical tools.

### How to Export Aggregates

1. Open the **header menu** (☰ icon)
2. Click **Export Aggregates (CSV)**
3. A file named `oscar_aggregates.csv` downloads
4. Open in Excel, Google Sheets, or any spreadsheet application

### What's in the Aggregates CSV

The exported file contains one row per night with computed statistics:

- **Date** — Night of therapy (YYYY-MM-DD format)
- **Usage Hours** — Total therapy time
- **AHI** — Apnea-hypopnea index
- **Median EPAP** — Median expiratory pressure
- **Leak Rate** — Median leak rate (if available)
- **Pressure Settings** — Min/max pressure ranges
- **Cluster Count** — Number of detected apnea clusters (if Details loaded)
- **False Negative Score** — Likelihood of unreported events (if Details loaded)

The exact columns depend on what data was present in your original OSCAR export.

### Using Aggregates in Spreadsheets

**Common use cases:**

- **Trend analysis** — Calculate moving averages, identify outliers
- **Statistical testing** — Import into R, Python, or SPSS for deeper analysis
- **Correlation studies** — Cross-reference with sleep diary, medication changes
- **Sharing with clinicians** — Provide summarized data without raw event logs

**Example workflows:**

```excel
# Excel: Calculate 7-day rolling average AHI
=AVERAGE(C2:C8)  # Assuming AHI is in column C

# Google Sheets: Find nights with high leak rates
=FILTER(A:E, D:D > 24)  # Assuming leak rate is column D
```

**Privacy note**: Aggregates still contain health data. Apply the same security practices as session files.

## Print vs. Export: Which to Use?

| Need                                 | Recommended Option              |
| ------------------------------------ | ------------------------------- |
| Share visual report with doctor      | **Print to PDF**                |
| Backup your analysis for later       | **Export Session (JSON)**       |
| Analyze data in Excel/R/Python       | **Export Aggregates (CSV)**     |
| Archive long-term therapy results    | **Both Session + Aggregates**   |
| Email quick summary to clinician     | **Print to PDF** (smaller file) |
| Restore analysis on another computer | **Export Session (JSON)**       |
| Generate monthly therapy report      | **Print to PDF**                |
| Feed data into research tools        | **Export Aggregates (CSV)**     |

**Combining approaches**: For comprehensive backups, export both session JSON (for full state) and aggregates CSV (for easy spreadsheet access). Print PDFs when you need human-readable reports.

## Troubleshooting

### Print dialog shows blank pages

**Cause**: Charts may still be rendering when print dialog opens.

**Solution**:

1. Close print dialog
2. Wait for all charts to finish loading (spinner disappears)
3. Try printing again
4. If problem persists, try reducing the date range to fewer sessions

### Charts are cut off in PDF

**Cause**: Page break occurs in the middle of a large chart.

**Solution**:

- Switch to **landscape orientation** in print settings
- Reduce **scale** to fit more content per page (try 90% or 80%)
- Use **"Fit to page"** option if available
- Some cutting is expected for very tall charts—consider splitting date ranges

### PDF is too large (>50 MB)

**Cause**: Printing hundreds of charts generates large files.

**Solution**:

- Reduce date range to 3–6 months instead of multi-year
- Disable sections you don't need before printing (use date filter to limit data)
- Use **lower resolution** print setting if available in browser
- Export aggregates CSV instead for long-term data

### Session export fails or produces corrupt file

**Cause**: Browser storage quota exceeded or data corruption.

**Solution**:

1. Check browser console for error messages (`F12` → Console tab)
2. Clear site data and reload CSVs
3. Try exporting aggregates instead
4. If problem persists, report an issue on GitHub with browser version

### Exported session won't import

**Cause**: File was edited, corrupted during transfer, or came from incompatible version.

**Solution**:

- Verify file extension is `.json` (not `.txt` or `.json.txt`)
- Check file size—it should be >1 KB for real data
- Try opening file in text editor to verify it's valid JSON
- If file is from very old analyzer version, re-upload original CSVs

### Print shows no data despite loaded session

**Cause**: Session hasn't fully loaded or date filter excludes all data.

**Solution**:

- Check date range in header—expand if too restrictive
- Verify charts are visible in the main interface before printing
- Reload page and try again
- Check browser console for errors

### Plotly legends are unreadable in printed PDF

**Cause**: Dark theme colors don't print well.

**Solution**: The analyzer automatically forces dark text in print mode. If legends are still hard to read:

- Enable "Background graphics" in print settings
- Try switching to **light theme** before printing (theme toggle in header)
- Some printers struggle with light gray text—adjust printer settings to increase contrast

## Privacy and Security Reminders

All export operations process data locally in your browser:

- ✅ Printing renders pages client-side—no network requests
- ✅ Session JSON builds in memory and downloads directly
- ✅ Aggregates CSV generates locally without external services
- ❌ No data is sent to servers or cloud services
- ❌ No telemetry or analytics on export operations

**However**, once you save a PDF or JSON file:

- Files contain Protected Health Information (PHI)
- Store files securely (encrypted disk, password protection)
- Delete files when no longer needed
- Use secure channels when sharing with healthcare providers

See [Disclaimers](08-disclaimers.md) for more on data privacy and medical use limitations.

## See Also

- [Getting Started — Loading Files](01-getting-started.md#2-loading-files-into-the-analyzer)
- [FAQ — Can I export results for my doctor?](05-faq.md#can-i-export-results-for-my-doctor)
- [Troubleshooting — Print and Export Issues](06-troubleshooting.md)
- [Data Privacy](08-disclaimers.md#data-privacy)
