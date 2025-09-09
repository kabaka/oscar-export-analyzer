## Overview Dashboard

Quick status page showing key performance indicators:

- **Avg Usage (hrs)** and **Median AHI** with sparklines.
- **Median EPAP** and counts of clusters or false negatives when event data is provided.

## Usage Patterns

- Time series of nightly usage with 7‑ and 30‑night rolling averages and change‑point markers.
- KPIs report percent of nights at ≥4 h and ≥6 h, current 30‑night compliance, and longest adherence streaks.
- Histogram, boxplot, and calendar heatmap reveal distribution and weekly patterns.

Interpret flat or declining curves as adherence issues; outliers or heatmap patterns may reveal routine or equipment problems.

## AHI Trends

- Nightly AHI time series with rolling averages and optional stacked obstructive/central components.
- Histogram, violin, and QQ plots summarize distribution and normality.
- Severity bands count nights in common AHI ranges and list the "bad" nights.

Aim to keep most nights below five. Spikes or high tails may correlate with pressure, leak, or cluster events.

## Pressure & Correlation (EPAP)

- Median EPAP trend with first vs. last 30‑night markers.
- Boxplot, EPAP×AHI scatter with LOESS curve and running quantile bands, correlation matrices, and 2‑D density.
- Titration helper splits nights into low/high EPAP bins and reports Mann–Whitney U results.

Negative correlation or declining LOESS suggests higher EPAP reduces AHI; check partial correlations to control for usage or leak.

## Range Comparisons (A vs B)

Compare mean Usage and AHI between two date ranges. Deltas, p‑values, and rank‑biserial effect sizes highlight shifts around interventions.

## Apnea Event Characteristics

Distributions of individual event durations, Kaplan–Meier survival curves, and per‑night event counts flag unusually long events or outlier nights.

## Clustered Apnea Events

Clusters group apnea events by proximity and optional flow‑limitation bridging. Tables list start time, duration, count, and a severity score with links to event‑level timelines.

## Potential False Negatives

High flow‑limitation intervals without labeled apnea events. Scatter plots and tables report start time, duration, and confidence based on maximum FLG.

## Raw Data Explorer

Virtualized tables for Summary and Details CSVs with column toggles, search, sort, date filters, and CSV export.

## Persistence, Export, and Reporting

Enable local sessions to auto‑save data. Export JSON snapshots, aggregates CSV, or a print‑friendly PDF report.
