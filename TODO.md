# TODO: Next Steps for OSCAR Sleep Data Analysis Web App

This document outlines the vision, architecture, feature roadmap, and implementation plan
for evolving the existing OSCAR Sleep Data Analysis prototype into a rich, SPA-driven analytics
dashboard tailored for data scientists.

---

## 1. Vision & Goals
- Deliver a comprehensive, curated analytics dashboard that surfaces key sleep metrics at a glance.
- Provide raw- and filtered-data exploration for custom, ad-hoc analysis.
- Precompute actionable insights while retaining access to underlying data for deep dives.
- Offer progress feedback during long uploads or heavy computations to maintain user engagement.

## 2. High-Level User Flows
1. **Upload Data**: User selects OSCAR Summary + Details CSVs.
2. **Parsing & Preprocessing**: Stream-parse in background (Web Worker) with progress indicators.
3. **Dashboard Overview**: KPI cards and high-level charts (usage, AHI, EPAP).
4. **Deep Dive Tabs**:
   - Usage Patterns
   - AHI Trends
   - EPAP Analysis
   - Event Clusters
   - Potential False Negatives
   - Raw Data Explorer
5. **Report Export**: One-click export to PDF/CSV of curated summary and raw slices.

## 3. Architecture & Data Pipeline

### 3.1 Web Worker–Based Processing
- Offload CSV parsing and analytics computations (statistical summaries, clustering)
  to dedicated Web Worker(s).
- Communicate progress and partial results via `postMessage` events.

### 3.2 State Management
- Global app state (parsed data, metrics, clusters) managed via React Context or Zustand.
- Cache parsed CSV blobs and derived results in IndexedDB (optional) for faster reloads.

### 3.3 Module Structure
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
│   │   └── ScatterEpapAhi.jsx
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
│   └── useWorker.js
├── utils/
│   ├── stats.js       # quantiles, IQR, trend calculations
│   ├── clustering.js  # clusterApneaEvents, detectFalseNegatives
│   └── parsing.js     # Papaparse wrapper
├── workers/
│   ├── parser.worker.js
│   └── analytics.worker.js
├── App.jsx
└── main.jsx
```

## 4. Feature Roadmap & Visualizations


### 4.4 EPAP Analysis
- Boxplot of nightly median EPAP.
- Time-series of EPAP with first/last 30-night markers.
- Scatter plot EPAP vs AHI with regression line and correlation coefficient.

### 4.5 Event Clustering
- Timeline view (Gantt) of clustered apnea events.
- Table of clusters: start, duration, count.
- Drill-down to event-level timeline around each cluster.

### 4.6 False-Negatives Detection
- Timeline overlay of high flow-limit clusters lacking apnea annotations.
- Table of FLG clusters with start, duration, confidence score.

### 4.7 Raw Data Explorer
- Virtualized table with filtering, sorting, column hiding for Summary and Details rows.
- Search and export selected ranges to CSV.

## 5. Asynchronous Feedback & UX
- Show determinate progress bars for parsing and analytics steps.
- Use notifications/snackbars for completion or error messages.
- Disable downstream tabs/components until prerequisite data or processing ready.

## 6. Performance & Scalability
- Leverage Web Workers to avoid main-thread blocking.
- Debounce UI updates for large datasets.
- Virtualize large tables (e.g., react-window).

## 7. Libraries & Tooling
- **Charts**: Recharts or Chart.js (lightweight) / Plotly.js for interactive zoom.
- **Tables**: react-table or AG Grid for flexible filtering.
- **Workers**: Comlink for ergonomic worker communication.
- **State**: Zustand or Context + useReducer for simpler state.
- **Routing**: React Router for tabbed navigation.

## 8. Milestones & Timeline
| Week | Deliverable |
| ---- | ----------- |
| 1    | Web Worker scaffolding + global state context |
| 2    | Dashboard overview & KPI cards |
| 3    | Usage & AHI chart components |
| 4    | EPAP visualizations & scatterplot |
| 5    | Event clustering timeline + table |
| 6    | False negatives view & raw-data explorer |
| 7    | Report export (PDF/CSV) + polish UX |

## 9. Future Directions
- Baseline comparison vs pre-therapy exports.
- Positional and sleep-stage integration.
- Symptom-score correlation (ESS) input module.
- Predictive alerts using simple ML anomaly detection.
- Remote sync / cloud persistence of parsed sessions.
