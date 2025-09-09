# Visualizations and Interpretation

The analyzer contains numerous charts that translate raw CSV data into intuitive pictures.  Each visualization aims to answer a specific question about therapy quality.  This chapter explains what each chart shows, how it is calculated, and how to interpret patterns.

## Overview Dashboard
The overview combines key performance indicators (KPIs) with miniature sparklines to provide a quick status check.

| KPI | Definition | Calculation |
| --- | ---------- | ----------- |
| **Avg Usage (hrs)** | Mean nightly usage | \( \text{AvgUsage} = \frac{1}{n} \sum_{i=1}^n T_i \) where \(T_i\) is hours used on night \(i\) |
| **Median AHI** | Middle value of nightly AHI | Median of nightly AHI series |
| **Median EPAP** | Median expiratory pressure | Median of nightly `Median EPAP` column |
| **Cluster Count** | Nights containing apnea clusters | Count of nights with ≥1 cluster |

Hover a KPI to reveal a tooltip describing thresholds and interpretation.  Sparklines show the last 30 nights so abrupt changes are easy to spot.

## Usage Patterns
This view answers **“How consistently am I using therapy?”**

### Time Series
The line chart plots nightly usage hours with 7‑night and 30‑night rolling averages.  Change‑point markers highlight significant breaks.  For rolling averages we use:

\[
\text{RollingAvg}_{k}(t) = \frac{1}{k} \sum_{i=t-k+1}^{t} T_i
\]

where \(k\) is 7 or 30 and \(T_i\) is nightly usage.

### Distribution Views
- **Histogram** – Shows the frequency of usage hours; useful for spotting bimodal patterns.
- **Boxplot & Violin** – Display median, quartiles, and kernel density estimate.
- **Calendar Heatmap** – Each cell represents a night; darker colors indicate longer usage.  This makes gaps or weekend patterns obvious.

Interpret flat or declining rolling curves as adherence issues.  A cluster of red cells in the heatmap might indicate travel or equipment problems.

## AHI Trends
This view asks **“How severe is my apnea over time?”**

- **AHI Line Chart** – Nightly AHI with 7‑/30‑night averages and change‑points.  Optional stacked bars separate obstructive and central components.
- **Distribution Plots** – Histogram, violin, and QQ plots reveal whether AHI follows a normal distribution.  Long right tails may reflect occasional bad nights.
- **Severity Bands** – Counts how many nights fall into ranges like `0‑5`, `5‑15`, `15‑30`, `>30` AHI.  The table of “bad nights” lists dates that exceeded a chosen threshold.

Aim to keep most nights below 5.  Repeated spikes or a high proportion of moderate/severe nights warrant investigation of leaks, pressure settings, or sleep hygiene.

## Pressure & Correlation (EPAP)
This section explores the relationship between pressure and apnea burden.

### EPAP Trend
The EPAP trend line compares the first and last 30 nights.  The difference indicates whether pressure requirements are rising or stabilizing over time.

### Scatter and LOESS
A scatter plot of nightly `Median EPAP` versus `AHI` reveals correlations.  A LOESS regression line fits a smooth curve, while running quantile bands show the 50th and 90th percentile of AHI at each pressure level.  The LOESS smoother uses a span of `0.5` by default.

### Correlation Matrix
Pearson and Spearman correlation coefficients are calculated between usage, AHI, EPAP, and leak metrics.  Cells are color‑coded from −1 (blue) to +1 (red).  Hovering a cell displays the coefficient and `p`‑value.

### Titration Helper
Splits the dataset into low/high EPAP bins (default threshold is the median).  For each bin it computes mean AHI and a Mann–Whitney U test:

\[
U = n_1 n_2 + \frac{n_1(n_1+1)}{2} - R_1
\]

where \(R_1\) is the sum of ranks for group 1.  The test’s `p`‑value and rank‑biserial effect size quantify whether higher pressures reduce AHI.

## Range Comparisons (A vs B)
Use this view to evaluate an intervention by comparing two date ranges.  After selecting the ranges, the app computes deltas for usage and AHI:

\[
\Delta \text{Usage} = \bar{T}_B - \bar{T}_A \quad\quad \Delta \text{AHI} = \bar{A}_B - \bar{A}_A
\]

The table reports `p`‑values from the Mann–Whitney U test and the rank‑biserial effect size.  A waterfall chart visualizes the magnitude of changes.

## Apnea Event Characteristics
When a details file is loaded, the analyzer can inspect individual events.

- **Duration Distribution** – Histograms and Kaplan–Meier survival curves show how long events last.  Longer events may indicate inadequate pressure support.
- **Per‑Night Counts** – Bar charts reveal nights with unusually high counts of a specific event type.

## Clustered Apnea Events
Clusters group apnea events that occur in quick succession.  The clustering algorithm uses a gap threshold (default 90 s) and optionally bridges flow‑limitation sequences.

Tables list each cluster’s start time, duration, event count, and a severity score derived from event density.  Clicking a row opens a timeline visualization that expands the cluster minute by minute.

## Potential False Negatives
High flow‑limitation segments without corresponding apnea labels may represent missed events.  Scatter plots map maximum FLG against duration, and tables provide timestamps and confidence levels.  Review suspicious intervals in OSCAR or other software before drawing conclusions.

## Raw Data Explorer
A virtualized table renders the raw Summary and Details CSV contents.  Features include column toggles, multi‑column sorting, text search, date filtering, and CSV re‑export.  Use this view to verify that parsing occurred correctly or to manually inspect unusual nights.

## Persistence, Export, and Reporting
- **Session Persistence** – Stores uploaded files and settings in `IndexedDB` when enabled.
- **JSON Export/Import** – Saves or restores a session snapshot.
- **Aggregates CSV** – Exports computed nightly metrics for external analysis.
- **PDF Report** – Generates a print‑friendly summary with key charts and tables suitable for clinicians.

## Interpretation Tips
Visualizations are tools for discussion, not diagnosis.  Always correlate trends with changes in equipment, sleep habits, and clinical guidance.  Apparent improvements or deteriorations should be verified with professional evaluation.
