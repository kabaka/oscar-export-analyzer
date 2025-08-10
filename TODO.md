# TODO: Next Steps for OSCAR Sleep Data Analysis Web App

This document proposes a significant, non-breaking revamp that keeps all current value while expanding analytics depth, interactivity, and data-science ergonomics. Nothing is removed; features are reorganized, enriched, and made more discoverable.

---

## 1. Vision & Goals
- Rich insights: elevate from charts to explainable, actionable summaries and narratives.
- Statistical rigor: quantiles, confidence intervals, change-points, and correlation tests.
- Data-science UX: responsive, filterable, exportable views with reproducible state.
- Performance: smooth on large CSVs via workers, streaming, and virtualization.
- Accessibility: keyboard-first, high-contrast, and screen-reader friendly.

## 2. High-Level User Flows
1. Upload CSVs (Summary + Details) with schema validation and helpful errors.
2. Parse/compute in Web Workers with determinate progress and cancellation.
3. Dashboard Overview with KPI cards, sparklines, and narrative insights.
4. Deep-dive tabs: Usage, AHI, Pressure/Leak, Event Clusters, False Negatives, Raw Explorer.
5. Export: PDF report, CSV slices, and JSON “session” for reproducibility.

## 3. Architecture & Data Pipeline

### 3.1 Web Workers and Streaming
- Move heavy calculations to dedicated workers (parser + analytics) using Comlink.
- Stream parse with PapaParse; push partial aggregates to UI for immediate feedback.
- Support cancellation/retry; show stepwise progress (parse → compute → render).

### 3.2 State and Persistence
- Lift global state to Context or Zustand; keep App.jsx lean and declarative.
- Persist parsed blobs and computed metrics in IndexedDB (opt-in, with “Clear data”).
- URL hash/state export for sharable, reproducible views without uploading data.

### 3.3 Module Organization (target)
```
src/
├── components/
│   ├── Dashboard/
│   │   ├── Overview.jsx
│   │   ├── KPICard.jsx
│   │   └── MetricGrid.jsx
│   ├── charts/
│   │   ├── UsageChart.jsx
│   │   ├── AhiChart.jsx
│   │   ├── EpapChart.jsx
│   │   ├── LeakChart.jsx
│   │   └── ScatterMatrix.jsx
│   ├── tables/
│   │   ├── RawDataTable.jsx
│   │   ├── ClusterTable.jsx
│   │   └── FalseNegTable.jsx
│   └── layout/
│       ├── NavBar.jsx
│       └── TabPanel.jsx
├── context/
│   └── DataContext.jsx
├── hooks/
│   ├── useWorker.js
│   └── useUrlState.js
├── utils/
│   ├── stats.js       # quantiles, CIs, change-points
│   ├── clustering.js  # clusterApneaEvents, detectFalseNegatives (configurable)
│   ├── parsing.js     # schema validate + normalize
│   └── export.js      # PDF/CSV/JSON exports
├── workers/
│   ├── parser.worker.js
│   └── analytics.worker.js
└── routes/ (optional with React Router)
```

## 4. Feature Roadmap & Visualizations

### 4.1 Usage Patterns (expand, keep existing)
- 7/30-night moving averages with adherence streaks and breakpoints (change-point detection via simple CUSUM/PELT).
- Day-of-week and weekly heatmap of usage hours; calendar heatmap (GitHub-style).
- Compliance KPIs: percent nights ≥ 4h and ≥ 6h; rolling compliance window.
- Distribution: histogram + box/violin; annotate median/mean and IQR whiskers (already partly present).

### 4.2 AHI Trends (expand, keep existing)
- Decompose AHI into OAI/CAI/MAI if columns exist; stacked band chart over time. [Implemented]
- Change-points using 7d vs 30d crossovers; markers on time-series. [Implemented]
- Bad-night tagging and explanations (e.g., long clusters, high CA%) [Pending: requires integration across views]
- Percent nights by severity bands (≤5, 5–15, 15–30, >30) table. [Implemented]
- QQ-plot vs normal and violin distribution. [Implemented]

### 4.3 Pressure & Leak (rename from Pressure Settings; keep EPAP views)
- Add leak metrics (if present in Summary): nightly median leak and histogram. [Implemented]
- Time-above-leak threshold (if a suitable column exists) [Implemented] – auto-detect columns matching leak percentage/time-above
- Correlation matrix: EPAP, AHI, usage, leak (Pearson) [Implemented]
- EPAP titration helper: stratify AHI by EPAP bins; Mann–Whitney U test (effect size). [Implemented]
- 2D density/hexbin: EPAP vs AHI. [Implemented]

### 4.4 Event Clusters (keep and enrich)
- Parameter panel: gap sec, FLG thresholds, min counts; live recompute in worker.
- Severity score per cluster: total duration, density, and FLG edge strength; sortable table.
- Interactive Gantt: brush to zoom, cross-highlight with details table; export cluster intervals to CSV.
- Overlay leak/pressure traces (if available) around cluster window for context.

### 4.5 Potential False Negatives (keep and enrich)
- Threshold tuning UI with presets; display ROC-style guidance based on retrospective labels (if user marks reviewed).
- Review workflow: mark as reviewed/hidden; persist in IndexedDB; export reviewed set.
- Explainability: show top drivers (duration, peak FLG) and nearby annotated events.

### 4.6 Raw Data Explorer (add, do not replace)
- Virtualized, column-configurable table for Summary and Details with filters, sort, and search.
- Pivot-like aggregations (group by date, event type) and quick stats footer.
- Cross-filtering: selecting ranges updates charts; reset/undo controls.
- Export selected rows/slices to CSV.

### 4.7 Reporting & Export
- One-click PDF: Overview KPIs, key charts, and narrative insights with timestamps and parameters.
- CSV exports: summary metrics, cluster intervals, false-negative candidates.
- JSON session: data fingerprints + visualization state for reproducibility/sharing (without data upload).

### 4.8 Reproducibility & Notebooks (optional, scientist-friendly)
- Export tidy CSV/Parquet; provide Python/R snippets to replicate core charts.
- Document data dictionary and column mapping.

## 5. Asynchronous Feedback & UX
- Determinate progress per step; clear error toasts with actionable fixes (missing columns, bad dates).
- Disable dependent tabs until ready; skeleton loaders; retry buttons.
- Keyboard shortcuts for navigation; persistent parameter panel; responsive grid layout.

## 6. Performance & Scalability
- Workers for parse/analytics; debounce UI updates; chunked aggregation.
- Virtualize big tables; lazy-render heavy charts; memoize derived series.
- Cache parsed/computed artifacts; estimate memory usage and allow user to clear data.

## 7. Libraries & Tooling
- Charts: keep Plotly for interactivity; consider lightweight alt (Recharts) for small charts.
- Tables: TanStack Table (react-table) + react-window for virtualization; AG Grid if needed.
- Workers: Comlink; structured clones for typed payloads.
- State: Zustand or Context + reducer; React Router for tabs.

## 8. Documentation Improvements (README)
- Features overview with screenshots/GIFs; architecture diagram (workers, state, views).
- Data requirements: expected CSV columns, sample files, and known OSCAR quirks.
- Privacy: client-side only, no uploads; how to clear local data.
- Troubleshooting: parsing errors, timezone/date formats, large files guidance.
- Interpretation guide: how to read each chart and what to look for.
- CLI section for `analysis.js` with examples; link to advanced usage.

## 9. Non-Breaking Principle
- Keep all existing charts and flows; reorganize into tabs and add layers/controls.
- New features behind sensible defaults; parameters surfaced but pre-populated with current values.

## 10. Milestones & Timeline
| Week | Deliverable |
| ---- | ----------- |
| 1    | Worker scaffolding + global state + error toasts |
| 2    | Overview KPIs + narrative + screenshots/docs updates |
| 3    | Usage revamp (heatmaps, change-points) |
| 4    | AHI revamp (stratification, distributions) |
| 5    | EPAP/Leak correlations + tests |
| 6    | Clusters panel w/ parameters + Gantt upgrades |
| 7    | False negatives review workflow |
| 8    | Raw Data Explorer + exports |
| 9    | PDF/CSV/JSON exports + polish + a11y |

## 11. Testing & Quality Assurance
- Unit: stats edge-cases (quantiles, CIs), clustering boundaries, false-negative filters.
- Hooks/State: worker messaging, loading/cancel paths, persistence.
- Integration: upload → parse → compute → render flow; parameter changes recompute.
- Visual sanity: smoke-test charts render with sample datasets; tolerate empty/missing columns.
- Accessibility: `@axe-core/react` checks on main views; keyboard focus order and labels.
- Performance: synthetic large CSVs to assert render time budgets; memory ceiling warnings.

## 12. Future Directions
- Baseline comparison (pre/post therapy); regimen comparisons across periods.
- Positional/stage integration if available; symptom correlation (ESS input).
- Lightweight anomaly detection (seasonal STL + z-score) and nudges.
- Optional cloud sync/export integration without storing raw data.

## 13. Open Questions / Assumptions
- Which OSCAR columns are consistently present across devices/versions?
- Typical CSV sizes in the wild; target performance budgets?
- Desired export formats for team sharing (PDF length, CSV columns)?

## 14. Implementation Plan (Iteration 1)

This is a concrete, stepwise plan we will iterate on until all tasks are complete. Each task includes acceptance criteria and test/doc updates. We will check items off as they’re delivered.

Wave 1 — Foundations and Core Analytics

- [x] Date-aware rolling windows and CI ribbons
  - Deliver: Update `computeUsageRolling` to use actual day gaps; add bootstrap CIs for rolling averages/medians; render ribbons in Usage/AHI charts.
  - Tests: Irregular dates windowing; CI array lengths; rendering smoke.
  - Docs: Methods note on rolling windows and bootstrap.

- [x] Exact Mann–Whitney U with tie handling + effect size CI
  - Deliver: Exact U for small n (fallback to normal for large n), tie correction; rank-biserial effect with CI.
  - Integrate: Update EPAP titration readout in `EpapTrendsCharts` with effect CI.
  - Tests: Known small-sample cases; ties; approximation parity for larger n.
  - Docs: Methods section for MW U assumptions and interpretation.

- [x] Change-point detection (CUSUM/PELT) for usage and AHI
  - Deliver: `detectChangePoints(series, dates, penalty)` with strength; replace/augment crossover markers.
  - Tests: Synthetic step-change datasets; precision/recall against seeded changes.
  - Docs: Brief on algorithm choice and penalty tuning.

Wave 2 — Relationships and Visual Depth

- [x] EPAP–AHI LOESS smoother and quantile curves (p50/p90)
  - Deliver: Lightweight LOESS; overlay median/p90 curves on scatter; legend entries and toggles.
  - Tests: Monotonic data produces monotone fit; bounds match quantiles.
  - Docs: Explain smoothing and quantile overlays.

- [x] Partial correlation matrix (control for usage/leak)
  - Deliver: Compute partial r for EPAP vs AHI controlling for usage and/or leak; show side-by-side with Pearson.
  - Tests: Simulated confounding scenario where partial r shrinks toward 0.
  - Docs: Interpretation caveats (correlation ≠ causation).

- [x] Survival curve for apnea event durations
  - Deliver: Kaplan–Meier style survival of event durations with CI; plot alongside histogram.
  - Tests: Synthetic durations; boundary conditions.
  - Docs: How to read survival curves.

Wave 3 — Clustering & False Negatives

- [ ] Density-aware clustering and FLG hysteresis
  - Deliver: Add min events/min density and dual-threshold FLG (enter/exit) for boundary extension; parameterize in UI.
  - Tests: Boundary extensions only on sustained edges; noise tolerance.
  - Docs: Explain parameters and defaults.

- [ ] False-negatives tuning and presets
  - Deliver: Add continuity checks and proximity penalty; presets (strict/balanced/lenient) with estimated FP/FN guidance.
  - Tests: Scenarios with nearby true events; long sparse FLG runs.
  - Docs: Explain confidence and tradeoffs.

Wave 4 — Architecture & UX

- [ ] Workerize parsing and analytics (Comlink)
  - Deliver: Parser + analytics workers; streamed aggregates; error handling; cancellation.
  - Tests: Integration for upload → parse → compute; cancel/retry paths.
  - Docs: Architecture diagram and troubleshooting.

- [ ] Cross-filtering and range comparisons
  - Deliver: Brushing on time-series filters all views; A vs B date range deltas with significance/effect.
  - Tests: Filter propagation to tables/charts; correctness of A/B stats.
  - Docs: How to set ranges and interpret deltas.

- [ ] Persistence + session export/import
  - Deliver: IndexedDB persistence for parsed data/metrics; JSON session export/import; Clear Data control.
  - Tests: Round-trip integrity and versioning guard.
  - Docs: Privacy and storage notes.

Wave 5 — Reporting, Docs, and QA

- [ ] Reporting exports (CSV aggregates, PDF report)
  - Deliver: CSV exports for aggregates and clusters; PDF with KPIs/charts/parameters.
  - Tests: Snapshot tests for report assembly; CSV schema tests.
  - Docs: Export options and examples.

- [ ] Documentation: Methods appendix, data dictionary, timezone policy
  - Deliver: README/Docs pages updated with formulas, column mapping, and timezone behavior.
  - Tests: N/A.

- [ ] Accessibility and performance checks
  - Deliver: Axe checks on key pages; document results; basic render-time budgets; guardrails if exceeded.
  - Tests: Axe in CI (allowlist violations if needed).

Guardrails for all tasks

- Update tests and docs with each change; prefer user-facing assertions.
- Keep changes focused; avoid unrelated fixes; maintain clean Vite builds with zero warnings.
- Use Conventional Commits; include screenshots/GIFs for notable UI changes in PRs.
