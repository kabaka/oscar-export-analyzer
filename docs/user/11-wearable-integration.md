# Wearable Integration

OSCAR Export Analyzer can correlate your CPAP therapy with physiological data from a wearable, using a **local Google Health (formerly Fitbit) export** that you download yourself. There is no account login, no OAuth, and no network connection to any wearable service — you point the app at your export folder and everything is processed in your browser.

This guide covers what you need, how to import an export, what metrics are available, and how to interpret the correlations responsibly.

## Table of Contents

- [Overview](#overview)
- [Requirements](#requirements)
- [Privacy & Local-Only Processing](#privacy--local-only-processing)
- [Importing Your Export](#importing-your-export)
- [What Gets Analyzed](#what-gets-analyzed)
- [Single-Night Drill-Down](#single-night-drill-down)
- [Correlation Analysis](#correlation-analysis)
- [Interpreting Results (Important Caveats)](#interpreting-results-important-caveats)
- [Troubleshooting](#troubleshooting)
- [Medical Disclaimer](#medical-disclaimer)

## Overview

### What It Does

The wearable integration adds a **Wearable Correlation** section that analyzes relationships between your CPAP therapy nights and the physiological data recorded by your wearable:

- **CPAP therapy metrics** — AHI, usage hours, leak rate, EPAP/pressure, and other nightly values OSCAR exports.
- **Wearable nightly metrics** — SpO₂, heart rate, heart-rate variability (HRV), and sleep (stage timeline and durations), plus daily metrics such as readiness, stress, and snore where your export includes them.

Instead of pulling a few rate-limited days from a web API, the app reads your **complete local export**, which carries far higher-resolution data — full sleep-stage timelines, per-minute SpO₂, per-30-second snore, and large heart-rate histories.

### How It Differs From the Old Fitbit Integration

Earlier versions connected to the Fitbit Web API over OAuth. That integration has been **removed entirely**. There are no tokens, no login redirect, and no passphrase prompts for wearable data. The new flow is a one-time (or periodic) **local folder import**. This is simpler, private by construction, and gives you much richer data.

## Requirements

1. **A Chromium-based browser** — The import uses the browser's File System Access API (`showDirectoryPicker`), which today is available only in Chromium browsers (Chrome, Edge, Brave, and similar). On Firefox or Safari the wearable section shows a clear "requires a Chromium-based browser" message. **Your CPAP analysis works on every browser regardless** — only the wearable import is Chromium-only.
2. **A Google Health (Fitbit) export** — Request your data export (Google Takeout for Fitbit/Google Health). You will receive a folder, often several gigabytes, containing your historical data.
3. **CPAP data loaded first** — Import your OSCAR CSV files as usual so there are CPAP nights to correlate against.
4. **Overlapping nights** — Correlations only use nights where both CPAP and wearable data exist. A handful of overlapping nights produces weak, noisy results; more overlap gives more reliable patterns.

## Privacy & Local-Only Processing

The wearable integration keeps OSCAR Export Analyzer's local-first model — in fact it strengthens it:

- **No network access for health data.** The export is read directly from disk in your browser. The app makes **no** request to any wearable service. With the old OAuth endpoints gone, this guarantee is now enforced by the app's Content Security Policy.
- **Read-only folder access.** The app opens your export folder in read-only mode and reads only the files it recognizes. It never writes to, moves, or deletes anything in your export.
- **Aggregated locally.** Files are streamed and aggregated into nightly summaries plus intraday detail stored in your browser's IndexedDB — the same local storage used for CPAP sessions.
- **You control persistence.** Wearable data lives only in your browser until you clear it. A **"Forget folder"** action removes the stored wearable data and any remembered folder permission.

### Optional "Remember Folder"

After a successful import you can opt in to remember the export folder. This is a convenience for periodic re-imports so you do not have to re-select the folder each time. It is **off until you choose it**, scoped to read-only access, and revocable at any time via "Forget folder."

## Importing Your Export

1. **Load your CPAP data** — Import your OSCAR CSV files first.
2. **Open the Wearable Correlation section** — On a Chromium browser you will see an import card. (On other browsers you will see the unsupported message instead.)
3. **Pick your export folder** — Click **Select export folder** and choose the top-level Google Health (Fitbit) export directory. Your browser asks you to grant read access; approve it.
4. **Wait for ingestion** — A Web Worker reads the in-scope files one at a time and aggregates them into nightly rollups. A progress indicator shows status. Large exports can take a few minutes; your CPAP charts stay responsive while this runs in the background.
5. **Explore correlations** — Once ingestion finishes, the correlation matrix and per-night views populate for nights that overlap your CPAP data.

### Re-Importing (Incremental)

When you download a fresh export later, import it again. The app ingests **only the new nights** rather than reprocessing the entire tree, so subsequent imports are much faster. If you opted in to remember the folder, you can re-import without re-selecting it.

## What Gets Analyzed

Depending on what your export contains, the following wearable metrics may be available per night:

- **SpO₂** (blood oxygen saturation) — including high-resolution intraday values.
- **Heart rate** — overnight heart-rate series and summary statistics.
- **HRV** (heart-rate variability) — derived from the export's HRV data.
- **Sleep** — stage timeline (the hypnogram) and stage durations.
- **Daily wellness metrics** — readiness, stress, snore, and similar daily values where present in the export.

Metrics that are missing from your particular export are simply omitted; the app degrades gracefully rather than blocking.

## Single-Night Drill-Down

Selecting a night opens a detailed view that aligns wearable and CPAP data on one timeline:

- **Hypnogram** — the sleep-stage timeline for that night.
- **Overlays** — SpO₂, heart rate, and CPAP therapy events plotted against the same time axis, so you can see how desaturations or heart-rate changes line up with apnea events and the sleep stages they occurred in.

This is useful for spotting whether specific therapy events coincide with physiological changes on a single night, without over-generalizing from one night.

## Correlation Analysis

The **Wearable Correlation** section computes correlations between CPAP therapy metrics and wearable metrics across your overlapping nights, presented as a correlation matrix with per-pair detail:

- **Correlation coefficient** — strength and direction of the relationship.
- **Significance** — p-values, **corrected for multiple comparisons** (see caveats below).
- **Effect size** — magnitude of the relationship, independent of sample size.

Selecting a cell shows the scatter detail for that metric pair.

## Interpreting Results (Important Caveats)

Wearable correlations are **exploratory**. Read them with these limitations in mind:

- **Single subject.** All analysis is within your own nights over time. These are within-person correlations, not population findings. They cannot establish what is true for anyone else, and they are sensitive to your particular routines and confounders (alcohol, illness, medication, stress, travel, exercise).
- **Multiple-comparison correction (FDR).** The app tests many metric pairs at once. Without correction, some pairs would appear "significant" purely by chance. Results apply a **false discovery rate (FDR)** correction so the reported significance accounts for the number of tests. Even so, a flagged correlation is a hypothesis to explore, not a proven effect.
- **Correlation is not causation.** A relationship between two metrics does not mean one causes the other; both are often driven by shared factors.
- **Sample size matters.** Few overlapping nights give unstable estimates. More overlap yields more trustworthy patterns. Be especially skeptical of strong correlations computed from only a handful of nights.
- **Consumer-grade sensors.** Wearable SpO₂ and HRV come from optical sensors, not medical-grade equipment. They are good for trends, not absolute clinical values, and may miss brief events.

Use these views to generate questions for your healthcare provider — not to make therapy decisions on your own.

## Troubleshooting

**"Wearable import requires a Chromium-based browser"**

- You are on Firefox or Safari, which do not yet support the directory-picker API the import needs. Use Chrome, Edge, or another Chromium browser for the import. Your CPAP analysis is unaffected on your current browser.

**The folder picker did not appear, or import did nothing**

- Make sure you selected the top-level export folder, not a single file inside it.
- Confirm you granted read permission when the browser prompted.
- Very large exports take time to enumerate; give the progress indicator a moment.

**"No overlapping nights" or an empty correlation matrix**

- Correlations need nights where both CPAP and wearable data exist. Confirm your CPAP date range overlaps the period your wearable was recording, and that your wearable was actually worn on those nights.

**Some metrics are missing**

- Not every export contains every metric (for example, older devices may lack SpO₂ or HRV). The app shows whatever your export includes and omits the rest.

**Import is slow**

- Initial ingestion of a multi-gigabyte export reads many files and can take several minutes. Subsequent re-imports are incremental and much faster. The app processes files in a background worker, so the rest of the interface stays usable.

**I want to remove the wearable data**

- Use **Forget folder** to clear all imported wearable data and any remembered folder permission. CPAP sessions are not affected.

## Medical Disclaimer

This integration is for educational and research purposes. Correlation analysis supplements but does not replace clinical sleep studies, healthcare-provider consultation, device titration protocols, or professional interpretation of therapy effectiveness. Always consult your healthcare provider before adjusting CPAP settings or drawing medical conclusions from physiological data.

---

**Next Steps:**

- [Statistical Concepts Guide](04-statistical-concepts.md) — Understanding correlation analysis
- [Troubleshooting Guide](06-troubleshooting.md) — General app support
- [Privacy & Terms](12-privacy-and-terms.md) — Data protection details
- [Disclaimers](08-disclaimers.md) — Medical and intended-use limitations
