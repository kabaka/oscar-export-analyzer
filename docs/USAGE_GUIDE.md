# OSCAR Sleep Data Analysis — Usage & Interpretation Guide

This guide explains how to use the app, what each view shows, and how to interpret metrics and visualizations derived from OSCAR exports.

- Intended audience: patients, sleep enthusiasts, and engineers analyzing CPAP therapy data.
- Scope: nightly Summary CSV and event-level Details CSV from OSCAR. Columns are auto-detected as described below.

## Getting Started

- Files to load:
  - Summary CSV (required for most charts): expects columns similar to `Date`, `Total Time`, `AHI`, `Median EPAP`, optional leak metrics (e.g., `Leak Median`, `Leak % > thr`).
  - Details CSV (optional; enables event/cluster/false-negative views): expects `Event`, `DateTime`, `Data/Duration`.
- Load files using the “Summary CSV” and “Details CSV” pickers. Progress bars show parse progress; large CSVs are chunk-parsed in a worker.
- Theme: toggle Light / Dark / System from the header.
- Session: optionally “Remember data locally” to persist files, parameters, and ranges; use Save/Load/Clear or Export/Import JSON for sharing.

## Overview Dashboard

- Avg Usage (hrs): mean nightly usage from `Total Time` (HH:MM:SS → hours). Sparkline shows trend.
- Median AHI: typical per-night AHI. Sparkline shows variability.
- Median EPAP: typical nightly median EPAP (cmH₂O).
- # Clusters / # False Negatives: counts from event analysis (Details CSV required).

Interpretation: Use this as a quick status page. Pair the KPIs with the specific sections below for depth and diagnostics.

## Usage Patterns

- Time Series with Rolling Averages:
  - Nightly usage hours; 7- and 30-night rolling averages with confidence bands; change-points and crossover breakpoints marked.
  - KPI row shows: % nights ≥4h/≥6h, current 30-night ≥4h compliance, and longest adherence streaks (≥4h, ≥6h).
- Distribution Charts:
  - Histogram (median/mean markers) and Boxplot (IQR and outliers) of nightly usage.
- Calendar Heatmap:
  - GitHub-style weekly calendar of usage hours by weekday.

How to read:
- Flat or declining 7/30-night curves suggest adherence issues; sustained lifts indicate improvement.
- Frequent outliers in the boxplot/histogram point to inconsistent schedules or device issues.
- Calendar heat patterns (e.g., weekend dips) may indicate routine factors.

## AHI Trends

- Time Series:
  - Nightly AHI with 7/30-night averages; AHI=5 threshold line; optional stacked OAI/CAI/MAI if fields detected.
  - “Bad Nights” table (top 10) tags high-AHI nights, high central fraction nights, or nights coinciding with long/dense clusters.
- Distribution & Normality:
  - Histogram and Violin plot summarize central and tail behaviors.
  - QQ Plot shows deviation from normal; heavy tails or skew indicate sporadic spikes rather than stable control.
- Severity Bands Summary:
  - Counts in ≤5, 5–15, 15–30, >30 bins.

How to read:
- Aim for most nights ≤5. Spikes warrant correlation checks against usage, pressure, leak, or cluster events.
- A shift in change-points or a long high-tail in the violin may indicate evolving clinical or equipment factors.

## Pressure & Correlation (EPAP)

- EPAP Over Time:
  - Nightly median EPAP with markers for first vs last 30 nights to inspect titration or auto-adjust trends.
- Distribution:
  - EPAP boxplot shows typical range and outliers.
- EPAP × AHI Scatter:
  - Points are nights; dashed line is linear fit with Pearson r.
  - LOESS curve (purple) and running quantile bands (p50/p90) summarize central and high-end burden across EPAP.
- Correlation Matrices:
  - Pearson r among EPAP, AHI, Usage (hours), and Leak columns if present. Partial correlation removes linear effects of Usage/Leak.
- 2D Density (Histogram2D):
  - Shows common EPAP–AHI combinations.
- EPAP Titration Helper:
  - Splits nights into EPAP <7 vs ≥7, reporting mean AHI per bin and Mann–Whitney U results (p-value and rank-biserial effect size).

How to read:
- Negative r and declining LOESS imply higher EPAP associates with lower AHI; positive r the opposite. Use partial correlations to check whether Usage/Leak confound the relationship.
- High p-value in the MW test means no strong evidence of different AHI between bins; effect size near 0 indicates negligible difference.

## Range Comparisons (A vs B)

- Define date ranges A and B. The table reports mean Usage and AHI for each, deltas (B−A), Mann–Whitney p-values, and effect sizes.

How to read:
- Combine with change-point dates to assess before/after settings or interventions. Small samples produce wide uncertainty—consider nA/nB.

## Apnea Event Characteristics (Details CSV)

- Event Durations:
  - Histogram and boxplot of individual apnea event durations; table reports median, IQR, 95th, max, counts >30s and >60s, and outliers.
- Survival (KM):
  - Kaplan–Meier survival P(T > t) for event durations with approximate 95% CI.
- Events per Night:
  - Time series and distribution; outlier nights flagged by robust IQR rules.

How to read:
- A heavy long-duration tail or frequent >60s events merits attention. Rising events-per-night with stable usage could indicate pressure or mask issues.

## Clustered Apnea Events (Details CSV)

Algorithm summary:
- Clusters are formed from apnea annotations (ClearAirway/Obstructive/Mixed) using a proximity gap and optional “bridging” via Flow Limitation Grade (FLG). Boundaries expand to include sustained high-FLG “edges” using enter/exit thresholds with hysteresis. A density filter (events/min) is optional.

Parameters (tune in the Clusters panel):
- Gap sec: max gap between apnea events to remain in one cluster.
- FLG bridge ≥: FLG level to bridge apnea gaps.
- FLG gap sec: max gap to group FLG readings into a bridge.
- Edge enter ≥ / Edge exit ≥: thresholds for boundary extension segments; exit uses hysteresis to avoid flicker.
- Min event count / Min total apnea sec / Max cluster sec: validity constraints and window cap.
- Min density (evt/min): optional filter for cluster compactness.

Outputs:
- Sortable cluster table shows Start, Duration, Count, and a heuristic Severity score (combining total event time, density, and edge extension).
- Selecting a row reveals an event-level timeline (Gantt-style) to inspect intra-cluster durations.
- Export clusters as CSV for offline review.

Interpretation:
- Larger counts and durations, or high severity, indicate tighter, more burdensome clusters. Use alongside “Bad Nights” in AHI Trends.

## Potential False Negatives (Details CSV)

Definition:
- Intervals of high FLG without labeled apnea events—plausible missed events by the detection pipeline.

Controls:
- Presets (Strict/Balanced/Lenient) tune FLG threshold, minimum duration, and confidence requirement. Confidence is the maximum FLG level observed in the interval.

Outputs:
- Scatter over time with marker size proportional to duration and color encoding confidence; table lists start, duration, and confidence.

Interpretation & caveats:
- Use as an investigative aid only; high confidence does not imply clinical diagnosis. Check whether leak or arousals may explain FLG patterns.

## Raw Data Explorer

- Tabs: Summary and Details (whichever were loaded).
- Column toggles, text search across visible columns, sortable headers.
- Date range filter with “Apply to charts” to cross-filter all sections.
- Pivot-like summaries: group by any column to count rows and compute averages for numeric columns.
- Export: download selected or all visible rows as CSV for ad-hoc analysis.

## Persistence, Export, and Reporting

- Local sessions: enable “Remember data locally” to auto-save to IndexedDB; use explicit Save/Load/Clear controls.
- Export JSON: snapshot of data, params, and ranges; Import to restore.
- Aggregates CSV: high-level metrics (usage, AHI, EPAP) suitable for spreadsheets.
- Print Report: opens a print-friendly page; use your browser’s “Save as PDF” to archive or share.

## Data Dictionary (auto-detected columns)

- Summary CSV (night-level):
  - Date: ISO or locale date per night (used for ordering and windows).
  - Total Time: `HH:MM:SS` converted to hours (usage).
  - AHI: numeric apnea–hypopnea index.
  - Median EPAP: numeric cmH₂O.
  - Optional Leak: keys containing both “Leak” and “Median” or “%/time above” are included in correlation views.
- Details CSV (event-level):
  - Event: `ClearAirway`, `Obstructive`, `Mixed`, `FLG` (flow limitation) used for clustering/detection.
  - DateTime: event start timestamp.
  - Data/Duration: apnea duration (s) for events; FLG level for flow limitation.

If your exports differ, you may need to adjust parsing keys in `src/utils/stats.js` and `src/utils/clustering.js`.

## Methods Notes & Constraints

- Rolling windows use calendar-day inclusion; nights are not assumed contiguous.
- Confidence intervals for rolling means use a normal approximation; medians use order-statistic bounds.
- Mann–Whitney U is exact for smaller samples, tie-corrected normal otherwise. Reported rank-biserial effect ≈ practical difference.
- Change-points via least-squares segmentation; use deltas around lines to hypothesize causes.
- LOESS/quantile curves summarize patterns but are not causal. Always consider usage/leak correlations.
- Survival analysis treats events as uncensored.
- Clustering parameters materially affect cluster counts; document your settings when exporting.

## Practical Tips

- Use the A/B Range Comparisons after a setting change (e.g., EPAP increase, mask change) to quantify shifts.
- Cross-check “Bad Nights” with cluster severity and leak trends.
- If Usage fluctuates wildly, stabilize sleep schedule to enable clearer inference on pressure effects.
- Keep raw exports; you can re-import a JSON session to reproduce exact views.

## Disclaimers

- This tool is not a medical device. Visualizations are exploratory and for educational purposes. Consult a clinician before changing therapy.

