# Wearable Integration — Developer Guide

This guide covers the technical implementation of OSCAR's wearable integration: local Google Health (formerly Fitbit) export ingestion, the nightly aggregation pipeline, IndexedDB storage, the alignment/correlation engine, the privacy boundary, and testing strategies.

> **History:** Earlier versions integrated with the Fitbit Web API over OAuth 2.0 + PKCE. That integration — tokens, the sync layer, and all `*.fitbit.com` network access — has been **removed entirely**. The OAuth attack surface is gone and the local-first guarantee is now CSP-enforced (`connect-src 'self'`). The rationale lives in the ADRs linked below. This guide documents the current local-export design only.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Data Flow](#data-flow)
- [Module Map](#module-map)
- [Export Ingestion](#export-ingestion)
- [IndexedDB Storage (v4)](#indexeddb-storage-v4)
- [Alignment & Correlation](#alignment--correlation)
- [Privacy & Security Boundary](#privacy--security-boundary)
- [Browser Support](#browser-support)
- [Testing Patterns](#testing-patterns)
- [Architecture Decisions (ADRs)](#architecture-decisions-adrs)

## Architecture Overview

The wearable feature ingests a **local Google Health (Fitbit) export directory**, aggregates it to nightly rollups plus intraday detail in IndexedDB, aligns those nights with CPAP sessions, and renders correlations and a single-night drill-down. No network request is ever made for health data.

### Component & Module Structure

```
src/
├── features/wearable-correlation/
│   ├── Section.jsx                 # Feature entry: gates on browser support, wires hooks → UI
│   ├── index.js                    # Public API barrel
│   └── correlation/                # Correlation views (matrix, scatter detail)
├── components/wearable/
│   ├── WearableImportCard.jsx      # Directory picker + "remember folder" opt-in
│   ├── IngestStatusPanel.jsx       # Streaming ingest progress
│   ├── WearableDashboard.jsx       # Overview + correlation surface
│   └── NightDetailView.jsx         # Single-night hypnogram + SpO2/HR/event overlays
├── hooks/
│   ├── useWearableImport.js        # Drives the ingest worker; scan → ingest → progress
│   ├── useWearableData.js          # Reads nightly rollups / intraday from IndexedDB
│   └── useWearableCorrelation.js   # Runs alignment + correlation over overlapping nights
├── workers/
│   └── wearableIngest.worker.js    # Off-main-thread enumerate + parse + aggregate + persist
└── utils/
    ├── appDb.js                    # IndexedDB v4 schema + accessors (CPAP sessions + wearable stores)
    └── wearable/
        ├── ingestEngine.js         # Orchestrates enumeration, parsing, aggregation (plain, testable)
        ├── exportAllowlist.js      # Exact-anchored allowlist/denylist of in-scope export files
        ├── parsers.js              # Per-file-type parsers (HR, SpO2, sleep, HRV, daily metrics)
        ├── aggregators.js          # Rolls parsed samples up to nightly records
        ├── wearableNight.js        # WearableNight record model + validation
        ├── nightKeying.js          # Assigns samples to a "night" key
        ├── datetime.js / offsetInference.js  # Timezone/offset reconciliation across files
        ├── alignment.js            # Aligns wearable nights with CPAP sessions
        ├── correlationEngine.js    # Correlation + FDR-corrected significance
        └── pairRegistry.js         # Registry of CPAP↔wearable metric pairs to test
```

The data-agnostic correlation/alignment math and the pure Plotly chart components were carried over from the prior integration, not rewritten. The ingestion pipeline (worker, allowlist, parsers, aggregators, v4 schema) is net-new.

## Data Flow

```
showDirectoryPicker({ mode: 'read' })
        │  FileSystemDirectoryHandle  (structured-cloneable → worker)
        ▼
useWearableImport ──postMessage──▶ wearableIngest.worker.js
                                        │  ingestEngine.runIngest()
                                        │    enumerate (exportAllowlist)
                                        │    parse one file at a time (parsers)
                                        │    key + aggregate to nightly (nightKeying, aggregators)
                                        │    putBatch() → IndexedDB (appDb)
                                        ◀──progress── { phase, filesDone, filesTotal, nights }
                                        ◀──complete── { stats }
        ▼
useWearableData (reads wearable_nights / wearable_intraday)
        ▼
useWearableCorrelation  →  alignment.js + correlationEngine.js (over CPAP↔wearable overlap)
        ▼
WearableDashboard / correlation views / NightDetailView (Plotly)
```

The worker keeps memory bounded by parsing one file at a time and flushing nightly rollups to IndexedDB, rather than holding the whole multi-GB export in memory (see ADR-0004).

## Module Map

| Concern                 | Module                                                                |
| ----------------------- | --------------------------------------------------------------------- |
| Directory pick + opt-in | `components/wearable/WearableImportCard.jsx`                          |
| Ingest orchestration    | `hooks/useWearableImport.js`, `workers/wearableIngest.worker.js`      |
| Enumeration scope       | `utils/wearable/exportAllowlist.js`                                   |
| Parsing                 | `utils/wearable/parsers.js`                                           |
| Nightly aggregation     | `utils/wearable/aggregators.js`, `nightKeying.js`, `wearableNight.js` |
| Time reconciliation     | `utils/wearable/datetime.js`, `offsetInference.js`                    |
| Persistence             | `utils/appDb.js`                                                      |
| Alignment               | `utils/wearable/alignment.js`                                         |
| Correlation             | `utils/wearable/correlationEngine.js`, `pairRegistry.js`              |
| Read-side hooks         | `hooks/useWearableData.js`, `useWearableCorrelation.js`               |

## Export Ingestion

### File Access — Chromium-only

Ingestion is driven entirely by the **File System Access API**:

```javascript
const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
```

This is the **sole** ingest path; there is no `<input webkitdirectory>` fallback. Capability is detected with `'showDirectoryPicker' in window`; non-Chromium browsers render a clear unsupported empty-state and never get a degraded path. `webkitdirectory` was rejected because for a large multi-file export it eagerly materializes every `File` object on the main thread at selection time — an OOM/freeze risk, not a graceful fallback (see ADR-0003 and ADR-0005).

The `FileSystemDirectoryHandle` is structured-cloneable, so it is posted directly to the worker; all enumeration and reads happen off the main thread.

### Worker Protocol

`wearableIngest.worker.js` uses the same `{ workerId, ... }` envelope as `csv.worker.js`. All heavy logic lives in `utils/wearable/ingestEngine.js` (a plain module) so it is unit-testable without a real Worker.

```
Main → worker:
  { workerId, action: 'scan',   payload: { dirHandle, menstrualOptIn? } }
  { workerId, action: 'ingest', payload: { dirHandle, sinceDate?, knownFiles? } }
  { workerId, action: 'cancel' }

Worker → main:
  { workerId, type: 'scan-result', detection }
  { workerId, type: 'progress', phase, filesDone, filesTotal, nights }
  { workerId, type: 'complete', stats }
  { workerId, type: 'error', error }   // sanitized — never leaks PHI/paths
```

**No PHI in any message:** error strings are sanitized to generic text and progress carries only counts plus a metric-phase label (privacy design §5.3).

### Scope Allowlist

`exportAllowlist.js` defines an **exact-anchored** allowlist (and explicit denylist) of in-scope files. Patterns are anchored with `^` rather than loose substring globs, so unexpected or out-of-scope files (e.g. GPS subdirectories) are pruned rather than parsed. This is both a performance and a privacy control — only recognized physiological files are ever read.

### Incremental Re-Import

The worker accepts `sinceDate` / `knownFiles`, so a re-import of an updated export ingests only new nights/files rather than reprocessing the whole tree. The last-ingested marker and known-file set are persisted in `wearable_meta`.

## IndexedDB Storage (v4)

The wearable feature shares the `oscar_app` database with CPAP sessions. `appDb.js` owns the schema.

- **`DB_VERSION = 4`.** The v3 → v4 upgrade **drops** the legacy OAuth-era stores (`fitbit_tokens`, `fitbit_data`, `sync_metadata`) and ensures the three wearable stores exist. CPAP `sessions` are preserved across the upgrade. This is a one-time wearable reset — old Fitbit-sync data is abandoned, not migrated.
- **Stores:**
  - `wearable_nights` — nightly rollup records (the `WearableNight` model).
  - `wearable_intraday` — per-night intraday series (HR, SpO2, etc.), keyed by night + metric.
  - `wearable_meta` — ingest metadata: `lastIngestedDate`, known-files set, source counts, and the optional persisted directory handle.

### Key Accessors (`utils/appDb.js`)

| Function                                                       | Purpose                                                                                         |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `openAppDb()`                                                  | Open/upgrade the DB to v4 (drops legacy stores, creates wearable).                              |
| `putBatch(db, items)`                                          | Batched write across `wearable_nights` / `wearable_intraday` in one transaction.                |
| `getWearableNightsInRange(db, startDate, endDate)`             | Read nightly rollups for a date range.                                                          |
| `getWearableIntraday(db, nightDate, metric)`                   | Read one night's intraday series for a metric.                                                  |
| `getWearableMeta(db, key)` / `setWearableMeta(db, key, value)` | Read/write ingest metadata + dir handle.                                                        |
| `clearWearableData(db)`                                        | Clear all wearable data (nights, intraday, meta incl. dir handle) — the "Forget folder" action. |

## Alignment & Correlation

1. **Alignment** (`alignment.js`) matches each wearable night to the overlapping CPAP session. Because OSCAR exports lack precise clock times, alignment anchors at the wearable window start; see the module comments for the offset model.
2. **Pair registry** (`pairRegistry.js`) enumerates the CPAP↔wearable metric pairs to test (e.g. AHI↔SpO2, usage↔HRV).
3. **Correlation** (`correlationEngine.js`) computes correlations across overlapping nights and applies a **false-discovery-rate (FDR) correction** because many pairs are tested at once. Effect sizes accompany the corrected significance.

These are **single-subject, within-person** statistics. The methodology, its caveats, and why FDR is required are recorded in ADR-0006.

## Privacy & Security Boundary

- **No network for health data.** With OAuth/API removed, there are no wearable endpoints; the CSP (`connect-src 'self'`) enforces this.
- **Read-only directory access.** `showDirectoryPicker({ mode: 'read' })` — the app never writes to the export.
- **Exact-anchored allowlist.** Only recognized physiological files are read; everything else is pruned.
- **Sanitized worker messages.** No file paths or PHI cross the worker boundary in progress/error messages.
- **Opt-in handle persistence.** The directory handle is persisted only if the user opts in, and is cleared by `clearWearableData()` ("Forget folder").

The full privacy analysis (directory-handle persistence, denylist, error sanitization) is in ADR-0005.

## Browser Support

| Capability                  | Chromium (Chrome/Edge) | Firefox | Safari |
| --------------------------- | ---------------------- | ------- | ------ |
| Wearable export import      | ✅                     | ❌      | ❌     |
| CPAP analysis (rest of app) | ✅                     | ✅      | ✅     |

Non-Chromium browsers get a clear unsupported empty-state for the wearable section; CPAP analysis is unaffected.

## Testing Patterns

- **Pure modules, no real Worker.** All ingestion logic lives in `utils/wearable/*` plain modules with colocated `*.test.js`. Test `ingestEngine`, `parsers`, `aggregators`, `alignment`, and `correlationEngine` directly; you do not need a real Worker.
- **Synthetic export fixtures only.** Never use a real export — it is PHI. Build small synthetic file trees that exercise the allowlist, schema drift, and night-keying edge cases.
- **Schema migration.** Test that `openAppDb()` upgrades v3 → v4 by dropping legacy stores while preserving `sessions`.
- **Browser-support gating.** Cover the unsupported empty-state by stubbing `showDirectoryPicker` absence.
- **Correlation correctness.** Verify FDR correction and effect-size outputs against known inputs; cover the few-overlapping-nights and missing-metric cases.

See [Testing Patterns](testing-patterns.md) for the general Vitest/Testing Library conventions and synthetic CPAP data builders.

## Architecture Decisions (ADRs)

The strategic and methodological decisions behind this feature are recorded as ADRs, with detailed planning artifacts archived under `docs/developer/reports/2026-06-wearable-export-planning/`:

- [ADR-0003 — Replace Fitbit OAuth/API with Local Export Ingestion](architecture/adr/0003-replace-fitbit-oauth-with-local-export-ingestion.md)
- [ADR-0004 — Ingest and Aggregate Wearable Data to IndexedDB](architecture/adr/0004-ingest-and-aggregate-wearable-data-to-indexeddb.md)
- [ADR-0005 — Wearable Export File Access & Privacy Boundary](architecture/adr/0005-wearable-export-file-access-and-privacy-boundary.md)
- [ADR-0006 — Wearable↔CPAP Alignment & Correlation Methodology](architecture/adr/0006-wearable-cpap-alignment-and-correlation-methodology.md)

---

**Next Steps:**

- [Architecture](architecture.md) — System-wide data flow and Web Worker patterns
- [Testing Patterns](testing-patterns.md) — General testing guidelines
- [Wearable Integration (User Guide)](../user/11-wearable-integration.md) — End-user import and interpretation
