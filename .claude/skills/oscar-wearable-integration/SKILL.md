---
name: oscar-wearable-integration
description: Local Google Health (formerly Fitbit) export ingestion and CPAP↔wearable correlation patterns — directory pick via the File System Access API, the streaming ingest worker with two-phase nightly aggregation, the WearableNight model, and the n_eff/BH-FDR correlation engine. Use when working on wearable import, aggregation, alignment, or correlation features. There is NO OAuth, API, or token storage — that integration was removed (ADR-0003).
---

# OSCAR Wearable Integration

OSCAR Export Analyzer ingests a **local Google Health (formerly Fitbit) export directory**, aggregates it to nightly rollups in IndexedDB, aligns those nights with CPAP sessions, and renders correlations plus a single-night drill-down. **No network request is ever made for health data.**

> **History:** Earlier versions integrated with the Fitbit Web API over OAuth 2.0 + PKCE (tokens, a sync layer, passphrase-encrypted token storage, `*.fitbit.com` access). That entire integration was **removed** (ADR-0003). Do not reintroduce OAuth, API clients, tokens, PKCE, or passphrase token encryption. The local-first guarantee is now CSP-enforced (`connect-src 'self'`).

Authoritative references: `docs/developer/wearable-integration.md`, `docs/user/11-wearable-integration.md`, and ADR-0003–0006 under `docs/developer/architecture/adr/`.

## Architecture at a Glance

```
showDirectoryPicker({ mode: 'read' })
        │  FileSystemDirectoryHandle  (structured-cloneable → worker)
        ▼
useWearableImport ──postMessage──▶ wearableIngest.worker.js
                                        │  ingestEngine.runIngest()
                                        │    enumerate (exportAllowlist)
                                        │    parse one file at a time (parsers)
                                        │    key + aggregate to nightly (nightKeying, aggregators)
                                        │    putBatch() → IndexedDB (appDb, v4)
                                        ◀──progress── { phase, filesDone, filesTotal, nights }
                                        ◀──complete── { stats }
        ▼
useWearableData (reads wearable_nights / wearable_intraday)
        ▼
useWearableCorrelation → alignment.js + correlationEngine.js (CPAP↔wearable overlap)
        ▼
WearableDashboard / correlation views / NightDetailView (Plotly)
```

| Concern                 | Module                                                                |
| ----------------------- | --------------------------------------------------------------------- |
| Directory pick + opt-in | `components/wearable/WearableImportCard.jsx`                          |
| Ingest orchestration    | `hooks/useWearableImport.js`, `workers/wearableIngest.worker.js`      |
| Enumeration scope       | `utils/wearable/exportAllowlist.js`                                   |
| Parsing                 | `utils/wearable/parsers.js`                                           |
| Nightly aggregation     | `utils/wearable/aggregators.js`, `nightKeying.js`, `wearableNight.js` |
| Time reconciliation     | `utils/wearable/datetime.js`, `offsetInference.js`                    |
| Persistence             | `utils/appDb.js` (IndexedDB v4)                                       |
| Alignment               | `utils/wearable/alignment.js`                                         |
| Correlation             | `utils/wearable/correlationEngine.js`, `pairRegistry.js`              |
| Read-side hooks         | `hooks/useWearableData.js`, `useWearableCorrelation.js`               |

## Directory Pick + Allowlist Enforcement

### File access — Chromium-only via File System Access API

Ingestion is driven entirely by the **File System Access API**; there is **no `<input webkitdirectory>` fallback** (it eagerly materializes every `File` on the main thread for a multi-GB export — an OOM/freeze risk; see ADR-0003/0005).

```javascript
// Capability-detect, then pick read-only.
if (!('showDirectoryPicker' in window)) {
  // Non-Chromium → render the unsupported empty-state; CPAP analysis is unaffected.
  return;
}
const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
```

The `FileSystemDirectoryHandle` is structured-cloneable, so it is posted directly to the worker; **all enumeration and reads happen off the main thread**. Read-only mode means the app never writes to the export.

### Exact-anchored allowlist (`exportAllowlist.js`)

Enumeration is constrained by an **exact-anchored allowlist** (plus an explicit denylist). Patterns are anchored with `^`, not loose substring globs, so out-of-scope files (e.g. GPS subdirectories) are **pruned rather than parsed**. This is both a performance and a privacy control — only recognized physiological files are ever read.

```javascript
// Conceptual: only files matching an anchored allowlist entry and not on the
// denylist are read. Everything else is skipped before any parse.
if (isAllowed(relativePath) && !isDenied(relativePath)) {
  filesToParse.push(handle);
}
```

## Ingestion Worker + Two-Phase Aggregation

`wearableIngest.worker.js` uses the same `{ workerId, ... }` envelope as `csv.worker.js`. All heavy logic lives in `utils/wearable/ingestEngine.js` (a plain, unit-testable module) so it runs without a real Worker in tests.

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

**Two-phase aggregation:** the engine parses **one file at a time** (parsers) and **flushes nightly rollups to IndexedDB** as it goes, rather than holding the whole multi-GB export in memory. Phase 1 keys raw samples to a "night" (`nightKeying.js`) and rolls them up to per-night records (`aggregators.js`); Phase 2 finalizes each `WearableNight` and `putBatch()`-es nights + intraday in one transaction. Steady-state heap stays bounded (ADR-0004).

**No PHI in any message:** error strings are sanitized to generic text; progress carries only counts plus a metric-phase label.

**Incremental re-import:** the worker accepts `sinceDate` / `knownFiles`, so re-importing an updated export ingests only new nights/files. The last-ingested marker and known-file set live in `wearable_meta`.

## The WearableNight Model

`wearableNight.js` defines the nightly-record model and its constructors/validation (`createWearableNight`, `createWindow`, `createCoverageBlock`, `parseOscarSummaryRow`, `createAlignedNight`). Each night carries a resolved window, per-metric coverage, and per-group rollups (SpO2, HR, HRV, RR, snore, sleep).

### Offset inference

OSCAR exports lack precise clock times, and wearable files may disagree on timezone. `datetime.js` / `offsetInference.js` reconcile a single resolved `utcOffsetMinutes` per night from naive-local timestamps plus any offset hints. The night records the offset, its provenance (`windowSource`), and the disagreement magnitude (`offsetDisagreementMin = |inferred − hint|`) for downstream diagnostics.

### SpO2 sentinel filter

Some exports encode missing SpO2 as a **`50.0` sentinel** rather than a gap. The aggregator drops these before computing SpO2 statistics and records how many were removed (`spo2SentinelMinutesRemoved`) alongside valid minutes (`spo2ValidMinutes`). Never let the sentinel leak into means/quantiles — it would fabricate a floor of low-SpO2 readings. (The sentinel invariant is empirically confirmed for this export — ADR-0006.)

## IndexedDB v4

The wearable feature shares the `oscar_app` database with CPAP sessions; `appDb.js` owns the schema (`DB_VERSION = 4`).

- The v3 → v4 upgrade **drops the legacy OAuth-era stores** (`fitbit_tokens`, `fitbit_data`, `sync_metadata`) and ensures the three wearable stores exist. CPAP `sessions` are **preserved**. This is a one-time wearable reset — old sync data is abandoned, not migrated.
- **Stores:** `wearable_nights` (nightly rollups), `wearable_intraday` (per-night series keyed by night + metric), `wearable_meta` (ingest metadata + optional persisted directory handle).

| Function                                     | Purpose                                                     |
| -------------------------------------------- | ----------------------------------------------------------- |
| `openAppDb()`                                | Open/upgrade to v4 (drops legacy stores, creates wearable). |
| `putBatch(db, items)`                        | Batched nights/intraday write in one transaction.           |
| `getWearableNightsInRange(db, start, end)`   | Read nightly rollups for a date range.                      |
| `getWearableIntraday(db, nightDate, metric)` | Read one night's intraday series for a metric.              |
| `getWearableMeta` / `setWearableMeta`        | Read/write ingest metadata + dir handle.                    |
| `clearWearableData(db)`                      | Clear all wearable data + dir handle ("Forget folder").     |

The directory handle is persisted **only if the user opts in**, and is cleared by `clearWearableData()`.

## Correlation Engine (n_eff + BH-FDR)

`correlationEngine.js` computes **single-subject, within-person** CPAP↔wearable correlations over overlapping nights. The `pairRegistry.js` enumerates the metric pairs to test (e.g. AHI↔SpO2, usage↔HRV); `alignment.js` matches each wearable night to its overlapping CPAP session.

Key correctness properties (do not regress these):

- **Effective-N correction for serial correlation.** Nightly series are autocorrelated, so the engine computes `n_eff` from lag-1 autocorrelations (`effectiveN`) and recomputes p at `df = n_eff − 2` — not the raw n. See `nightlyLagCorrelation`, `runPair`.
- **Benjamini-Hochberg FDR over the full family.** Many pairs are tested at once, so `benjaminiHochberg` applies a step-up FDR correction over the **full session family** (pair lag-0 tests + group-contrast tests), operating on the `n_eff`-adjusted p, and fills per-result `survivesFDR` / q-values (`runCorrelationEngine`). Primary family at q=0.05, exploratory at q=0.10.
- **Tie-aware / permutation p** for heavy-tie inputs (`hasHeavyTies`, `permutationSpearmanP`), plus canary/MNAR diagnostics for robustness.

Effect sizes accompany the corrected significance. The methodology and its caveats are recorded in ADR-0006 — consult the `data-scientist` before changing the statistics.

## Privacy & Security Boundary

- **No network for health data.** With OAuth/API removed there are no wearable endpoints; the CSP (`connect-src 'self'`) enforces it.
- **Read-only directory access** (`mode: 'read'`); the app never writes to the export.
- **Exact-anchored allowlist** — only recognized physiological files are read.
- **Sanitized worker messages** — no file paths or PHI cross the worker boundary.
- **Opt-in handle persistence**, cleared by "Forget folder".

## Testing Patterns

- **Pure modules, no real Worker.** Test `ingestEngine`, `parsers`, `aggregators`, `nightKeying`, `offsetInference`, `alignment`, and `correlationEngine` directly via their colocated `*.test.js`.
- **Synthetic export fixtures only.** Never use a real export — it is PHI. Build small synthetic file trees that exercise the allowlist, schema drift, the SpO2 `50.0` sentinel, and night-keying/offset edge cases.
- **Schema migration.** Verify `openAppDb()` upgrades v3 → v4 by dropping legacy stores while preserving `sessions`.
- **Browser-support gating.** Cover the unsupported empty-state by stubbing `showDirectoryPicker` absence.
- **Correlation correctness.** Verify `n_eff` adjustment, BH-FDR survival/q-values, and effect-size outputs against known inputs; cover few-overlapping-nights and missing-metric cases.

## Resources

- **Developer guide**: `docs/developer/wearable-integration.md`
- **User guide**: `docs/user/11-wearable-integration.md`
- **ADRs**: `docs/developer/architecture/adr/0003`–`0006`
- **Privacy model**: `oscar-privacy-boundaries` skill
- **Worker patterns**: `oscar-web-worker-patterns` skill
- **Statistical validation**: `oscar-statistical-validation` skill
