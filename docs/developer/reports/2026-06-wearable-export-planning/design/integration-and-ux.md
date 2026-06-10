# Wearable Export Integration & UX Architecture

**Status:** Design proposal (feeds an ADR) — **revised after adversarial architecture review**
**Author:** frontend-developer (subagent)
**Date:** 2026-06-10
**Scope:** Replace the Fitbit OAuth/API integration with local-directory ingestion of a Google
Health (Fitbit) Takeout export, aggregated to nightly rollups and correlated with CPAP.

> Companion docs: `../data-catalog.md` (export structure & scope). A sibling **performance** design
> covers streaming/worker/IndexedDB internals; this doc owns the **UX, component, hook, and feature
> architecture** and references the perf design at the seams (schema, worker protocol, chunking).

---

## Revision log (adversarial review)

This doc was rewritten to address `review/architecture-redteam.md` (F1–F11), verified against the
actual codebase. Each fix is code-grounded (file + line). **Maintainer decisions** that constrain the
revision: **Chromium-only for v1** (File System Access API only; **no `webkitdirectory` fallback** —
non-Chromium browsers get a clear "open in Chrome/Edge" empty-state); **full scope retained**
(NightDetailView/hypnogram intraday drill-down, incremental re-import, and opt-in "remember folder"
handle persistence are all **kept** — F9's scope-cut recommendation is **overridden**).

| #                  | Finding                                                                                                                             | Resolution in this revision                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F1** (BLOCKER)   | `fitbitModels.js` wrongly marked delete; it is the data model the kept pipeline runs on.                                            | **`fitbitModels.js` → `wearableModels.js`, KEEP** (rename only). `createNightlyRecord`/`validateNightlyRecord`/`checkDataSufficiency` are the nightly-record contract `fitbitAnalysis.js:11` + 4 stat-util tests depend on. Rename map + §0.4 corrected. `normalizeFitbitData` (API-shape adapter) is the only export trimmed.                                                                                                                                         |
| **F2** (BLOCKER)   | ADR-0006 vs this doc contradict on imputation; `fitbitSync.js` is "rename only" but carries the fake `predict()=mean+noise` path.   | Reconciled to **ADR-0006**: `wearableSync.js` is **rename PLUS deletion** of `imputeMissingValues`/`regressionImputation`/`buildLinearRegression`/`knnImputation`/`meanImputation` (`fitbitSync.js:258–521`). `fitbitAnalysis.js` loses the `imputeMissingValues` import (`:12`), the `imputationMethod` option (`:38`), and the imputation step (`:83–91`); switches to **pairwise deletion**. The `imputeMissingValues` test block is deleted. §0.4/§2.4/§6 updated. |
| **F3** (MAJOR)     | `constants/fitbit.js` is the shared-constants backbone, not an OAuth file.                                                          | Rename → `constants/wearableConstants.js`, **KEEP** physiological/alignment/threshold/chart constants (lines 228–325), **trim ONLY** the OAuth block (lines 1–226). Exact line/export split specified in §2.4a.                                                                                                                                                                                                                                                        |
| **F4** (MAJOR)     | Step 2 (drop fitbit stores at v3) precedes Step 5 (delete OAuth readers); intermediate state reads dropped stores.                  | Store-drop and OAuth-UI/auth deletion **merged into one atomic step** (new Step 4). Sequence re-numbered so the app builds + tests pass at every landed commit (§6).                                                                                                                                                                                                                                                                                                   |
| **F5** (MAJOR)     | Rename map incomplete.                                                                                                              | Added every missed edge from a fresh grep: `fitbitAuth.js:14`, `constants/fitbit.test.js`, `test-utils/fitbitBuilders.js`, `App.jsx:49` legal anchor, `styles.css` `.fitbit-*` selectors, `tests/e2e/fitbit-oauth-complete-flow.spec.js`, the two hard-coded Plotly export filenames, plus docs/skill surface (§2.4 + §2.4b).                                                                                                                                          |
| **F6** (MAJOR)     | `fitbitCorrelation.performance.test.js` targets a worker that does not exist.                                                       | Marked **delete** (not "re-point"). `src/workers/` holds only `analytics.worker.js` + `csv.worker.js`; `fitbit-correlation.worker.js` was never shipped. A real perf test for the new `wearableIngest.worker.js` is written from scratch (§6).                                                                                                                                                                                                                         |
| **F7** (MAJOR)     | Input-contract impedance mismatch: pipeline consumes the Web-API daily shape + noon hack; export is nightly keyed by `dateOfSleep`. | Worker now emits **`WearableNight` rollups directly**; `transformFitbitDataForPipeline` + the `T12:00:00` hack are **dropped**. New worker→hook→analysis seam defined in §3.1a.                                                                                                                                                                                                                                                                                        |
| **F8/F10** (MINOR) | Migration test misses fresh-install path; `nightlyLagCorrelation` framed as new.                                                    | Migration test now covers `oldVersion===0` **and** v2→v3 (§4.3). `nightlyLagCorrelation` labelled a thin wrapper over the existing `crossCorrelation` (`fitbitCorrelation.js:171`); `benjaminiHochberg` is the only net-new algorithm (§3.1a note).                                                                                                                                                                                                                    |
| **F11** (MAJOR)    | PHI probe scripts in `docs/work/`.                                                                                                  | Out of scope for this UX doc (flagged to `security-auditor`); §6 reiterates `docs/work/` must be empty before merge.                                                                                                                                                                                                                                                                                                                                                   |

---

## 0. Verified baseline (what's actually in the code)

I read the codebase rather than trusting the recon. Key facts that shape this design:

1. **`src/utils/db.js` delegates to `openFitbitDb()`.** Session persistence (`putLastSession` /
   `getLastSession` / `clearLastSession`, used by `useSessionManager` and `useAppState`) opens the
   DB **through `fitbitDb.js`**. So `fitbitDb.js` is _already_ the de-facto app DB initializer, not
   a Fitbit-only module. Renaming/generalizing it is mandatory, and `db.js` must keep working
   throughout the migration or CPAP session persistence breaks. This is the single highest-risk
   coupling in the rework.
2. **One physical IndexedDB, `oscar_app` v2**, with stores: `sessions` (CPAP), `fitbit_tokens`,
   `fitbit_data`, `sync_metadata`. All created in `fitbitDb.js#openFitbitDb`'s `onupgradeneeded`.
3. **`useFitbitConnection.js` contains a bug/dead path**: an `autoCheck` effect calls
   `window.indexedDB.open('fitbit_tokens')` — a _separate, never-created_ database — and treats the
   open-request as if it were resolved synchronously (`db.result` immediately). This whole file is
   being deleted, so no fix needed, but it confirms the OAuth layer is fragile and worth removing
   wholesale.
4. **Pure, data-agnostic utilities worth keeping** (verified — no OAuth/API imports). **[F1/F2
   corrections applied]:**
   - `utils/fitbitCorrelation.js` — `spearmanCorrelation`, `crossCorrelation` (`:171`),
     `grangerCausalityTest`, `computeOscarFitbitCorrelations`. Pure stats; keep.
   - **`utils/fitbitModels.js` — KEEP (F1).** Exports `createNightlyRecord` /
     `validateNightlyRecord` / `checkDataSufficiency` — the **unified nightly-record data model the
     whole kept pipeline runs on**. `fitbitAnalysis.js:11` imports `createNightlyRecord` and builds
     every unified record with it (`fitbitAnalysis.js:62–77`); `fitbitSync.test.js:9`,
     `fitbitCorrelation.test.js`, `fitbitAnalysis.test.js`, `fitbitModels.test.js` +
     `fitbitModels.comprehensive.test.js` all import it. It imports only physiological constants
     from `constants/fitbit.js` (HR/SpO2/HRV/sleep/resp ranges) — **no OAuth coupling**. The recon's
     "OAuth token models → delete" was factually wrong. Only `normalizeFitbitData` (the
     raw-Fitbit-API → record adapter, `:313`) is dropped as an API artifact.
   - **`utils/fitbitSync.js` — KEEP the alignment engine, DELETE the imputation block (F2).**
     Keep `calculateSleepDate`, `alignOscarFitbitNights`, `validateAlignment`, `formatDateKey`
     (+ private helpers `findBestOverlap`/`searchSyncWindow`/`countMatchTypes`) — the night-alignment
     engine that maps almost 1:1 onto catalog §3b. **Delete** `imputeMissingValues` (`:265`),
     `regressionImputation` (`:300`), `buildLinearRegression` (`:453`, whose `predict()` returns
     `meanY + (Math.random()-0.5)*0.1*meanY` — fabricated values ADR-0006 flags as a
     correctness/credibility hazard), and the `knnImputation`/`meanImputation` helpers (`:469`,
     `:475`). Their `describe('imputeMissingValues')` test block is deleted. This module becomes a
     true **alignment-only** util → `wearableSync.js`.
   - `utils/fitbitAnalysis.js` — `analyzeOscarFitbitIntegration`, `analyzeTherapyEffectiveness`,
     `generateTreatmentRecommendations`. **F2 call-site change:** drop the `imputeMissingValues`
     import (`:12`), the `imputationMethod = 'regression'` option (`:38`), and the entire
     missing-data step (`:83–91`, the `if (qualityAssessment.missingDataRate > 0.1) { … }` block).
     The pipeline switches to **pairwise / complete-case deletion**: `computeOscarFitbitCorrelations`
     already operates on whatever finite metric pairs survive, so removing the imputation reassignment
     leaves `analysisRecords = unifiedRecords.filter(r => !r.dataQuality.excluded)` feeding straight
     into the correlation step — no fabricated values enter the stats. The data-quality assessment is
     retained (it still informs the dashboard quality badge).
   - `hooks/useFitbitAnalysis.js` → `useWearableAnalysis.js` — see §3.1a. **F7 correction:** the old
     `transformFitbitDataForPipeline` adapter and its `T12:00:00` noon hack are **dropped**, not
     "barely changed." The worker emits `WearableNight` rollups keyed by `dateOfSleep`; the analysis
     pipeline reads them directly.
5. **Pure presentational visualization components** (verified — only React + Plotly + constants):
   `correlation/DualAxisSyncChart.jsx`, `correlation/CorrelationMatrix.jsx`,
   `correlation/BivariateScatterPlot.jsx`, and `fitbit/SyncStatusPanel.jsx` (only `react` +
   `prop-types`). All keepable; only props/labels change.
6. **OAuth/API/token machinery is cleanly separable** (imports OAuth context/clients):
   `FitbitConnectionCard.jsx`, `FitbitStatusIndicator.jsx`, `OAuthCallbackHandler.jsx`,
   `context/FitbitOAuthContext.jsx`, `hooks/useFitbitOAuth.jsx`, `hooks/useFitbitConnection.js`,
   `utils/fitbitOAuth.js`, `utils/fitbitAuth.js`, `utils/fitbitApi.js`,
   `utils/fitbitHeartRateParser.js`, `constants/fitbitErrors.js`, plus `App.jsx`'s entire
   OAuth-callback branch (lines ~119–225, ~575–588) and the `FitbitOAuthProvider` in
   `AppProviders.jsx`.
   - **NOT in this list (recon error, F1/F3):** `utils/fitbitModels.js` and `constants/fitbit.js`.
     `fitbitModels.js` is the kept nightly-record model (F1); `constants/fitbit.js` is a **split**
     file — OAuth half deletes, physiological/alignment/threshold/chart half is the shared-constants
     backbone of every kept module (F3, see §2.4a). `fitbitAuth.js` additionally imports
     `clearFitbitData` from `fitbitDb.js` (`fitbitAuth.js:14`, used at `:438`); that dependency
     vanishes when the OAuth layer is deleted and `clearFitbitData` is dropped during the
     `fitbitDb.js → appDb.js` generalization (§4).
7. **App wiring**: `App.jsx` renders `<FitbitCorrelationSection />` gated on `summaryHasRows`, lists
   it in `tocSections` as `{ id: 'fitbit-correlation', label: 'Fitbit Analysis' }`, and the section
   pulls `filteredSummary` + `dateFilter` from context. The section is mounted purely from CPAP
   data presence — there is no separate "wearable data present" gate today.

**Naming decision:** rename the user-facing feature to **"Wearable"** (not "Fitbit") since the
source is now a Google Health export and may later include other exports. Feature dir →
`features/wearable-correlation/`. Keep "wearable" generic in component/hook names.

---

## 1. File-access UX flow

### 1.1 Capability gate (must come first)

The whole flow depends on the **File System Access API** (`showDirectoryPicker`,
`FileSystemDirectoryHandle`, `.requestPermission`). This is **Chromium-only** (Chrome, Edge, Brave,
Opera; **not** Firefox or Safari as of 2026). The UI must branch on capability up front:

```js
const supportsDirPicker =
  typeof window !== 'undefined' &&
  typeof window.showDirectoryPicker === 'function';
```

- **Supported** → full directory-picker flow (below).
- **Unsupported** → an **empty-state card** that (a) explains the wearable feature requires a
  Chromium browser for folder access, (b) offers the documented fallback, and (c) never dead-ends.
  See §1.6.

### 1.2 Stages (state machine)

The import card is a small state machine. States and the dominant UI for each:

| State              | Trigger                    | UI                                                                             |
| ------------------ | -------------------------- | ------------------------------------------------------------------------------ |
| `unsupported`      | no `showDirectoryPicker`   | Chromium-required empty-state (§1.6) — **no `webkitdirectory` fallback in v1** |
| `idle`             | supported, no prior import | "Select Google Health export folder" CTA + 1-line privacy note                 |
| `picking`          | user clicked CTA           | browser-native picker open (transient)                                         |
| `scanning`         | handle obtained            | fast **detection scan** (filenames/counts only, no parse) + spinner            |
| `detected`         | scan done                  | **detection summary** (§1.3) + Consent/Cancel                                  |
| `ingesting`        | user consented             | **progress + cancel UI** (§1.4)                                                |
| `partial`          | cancelled mid-run          | "Imported N of M nights — keep partial or discard?"                            |
| `ready`            | ingest complete            | success summary + "Re-scan for new data" + the dashboard mounts                |
| `error`            | unrecoverable              | inline error + Retry/Reset (sanitized message, no PHI)                         |
| `needs-permission` | revisit, handle stale      | "Reconnect folder access" re-grant CTA (§1.5)                                  |

This is intentionally close to the **CSV import progress pattern** already in `App.jsx` (the
`progress` block + `aria-live="polite"`), so the visual language is consistent.

### 1.3 Detection scan (cheap, pre-consent)

Before any heavy parsing, do a **directory walk that only reads entry names + sizes** (via
`dir.entries()` recursion / `getFileHandle` + `file.size`, no `.text()`). From filenames alone we
can derive everything the catalog's §1 inventory is keyed on:

- **Date range** — min/max from `<metric>-YYYY-MM-DD` / `... - YYYY-MM-DD.csv` filename stems
  (tolerant of the `- 2020-11-(15).csv` parenthesized-day and underscore variants per §4.9).
- **Metrics found** — map directory names → catalog metric set (Sleep, SpO2, HRV, Snore,
  Readiness, Stress, HR, Respiratory, Temperature…). Show which §5 MUST-HAVE metrics are present
  vs absent.
- **File / size counts** — total files, total bytes, and a callout for the **two giant trees**
  (`Global Export Data`, `Physical Activity_GoogleData`) so the user understands the ~10 GB scale.
- **Scope preview** — "We will ingest sleep, SpO2, HRV, snore, readiness, stress, resting+sleeping
  HR (aggregated). We will **not** read your profile, GPS, social, or commerce data" (privacy
  reassurance grounded in §5 DEFER list).

Detection is read-name-only, so it stays sub-second even on 32k files (no content reads). The
detection result object is the contract handed to the consent step and then to the worker.

### 1.4 Consent + progress + cancel

**Consent**: an explicit dialog/card stating what will be read, that it's parsed **locally in the
browser and never uploaded**, approximate time/memory ("aggregating ~67M heart-rate samples may
take a few minutes"), an **opt-in "Remember this folder" checkbox** (default off — gates the §1.5
persisted-handle/incremental flow), and a primary **"Ingest"** button. This is the wearable analog of
the existing `StorageConsentDialog`; reuse its visual pattern and the `oscar-privacy-boundaries`
skill's language. Persisting the directory handle only happens when the box is ticked.

**Progress** (the hard part — thousands of files / GBs). Because the perf design streams + chunks in
a worker, the UI consumes a **two-level progress model** the worker emits:

- **Phase progress** — coarse: `discovering → parsing-sleep → parsing-spo2 → parsing-hr(aggregate)
→ rolling-up → persisting`. HR is its own phase because it dominates (6.1 GB).
- **Within-phase progress** — `filesDone / filesTotal` and `bytesDone / bytesTotal` for the active
  metric, plus a live count of **nights ingested**.

UI: a labelled `<progress>` bar (mirroring `App.jsx`'s import-progress block) with
`aria-live="polite"` text like `Aggregating heart rate — 12,431 / 67,000,000 samples (8 of 3,541
files)`, a secondary line for the current phase, and the running **nights count** (the metric users
actually care about). Throttle DOM updates to ~4–10 Hz regardless of worker message rate to avoid
re-render storms (the perf agent throttles on the worker side; the hook also coalesces — see §3).

**Cancel**: a prominent **Cancel** button wired to an `AbortController`/`worker.terminate()` exactly
like `useCsvFiles.cancelTask` (terminate worker, reset task ref, set loading false). On cancel we
transition to `partial` and let the user keep already-persisted nights (ingestion persists rollups
incrementally per the perf design) or discard them. Never lose the CPAP session on a wearable
cancel — they are separate stores.

### 1.5 Re-visits, persisted handle, re-permission, incremental re-import

**Full scope — kept (maintainer decision overrides F9's defer recommendation).** This is opt-in
(see consent in §1.4): the handle is only persisted if the user ticks "Remember this folder."

`FileSystemDirectoryHandle` is **structured-cloneable and IndexedDB-persistable**. When the user opts
in, store the handle in the `wearable_meta` store (key `dirHandle`) alongside ingest metadata (last
import timestamp, source file/byte counts, schema/app version, and the high-water mark used for
incremental re-import). If the user does not opt in, the handle is never persisted and §1.5 degrades
to a fresh pick each visit.

On app load, if a stored handle exists:

1. Call `handle.queryPermission({ mode: 'read' })`.
   - `granted` → silent; show "Folder connected" with last-import info.
   - `prompt` → show **"Reconnect folder access"** CTA → `handle.requestPermission({ mode: 'read'
})` on click (must be user-gesture-initiated).
   - `denied`/handle invalid (folder moved) → fall back to `idle` "Select folder" with an
     explanatory note.
2. After permission, offer **"Check for new data"** → re-run the detection scan and **diff against
   stored metadata**: if the export's max date advanced (user re-downloaded Takeout with newer
   nights), ingest only the **new date range** (`incremental` ingest mode).

**Incremental mechanism (corrected per the sibling perf revision):** the high-water mark is a
per-metric **`lastIngestedDate`** (the max `dateOfSleep` already rolled up), **not** a file-`mtime`
heuristic. The original mtime approach is replaced because (a) `webkitdirectory`/zip extraction does
not preserve reliable mtimes and (b) a re-downloaded Takeout rewrites every file's mtime, defeating
the diff. The perf design owns the storage internals of this high-water mark; this doc only consumes
it: incremental ingest reuses the same worker with `{ mode: 'incremental', sinceDate: lastIngestedDate }`
and the worker skips any night `<= lastIngestedDate`. Already-stored nights are **upserted**
(idempotent on the `nightDate` key), so re-running over the full folder is always safe.

### 1.6 Empty-state for unsupported browsers (Chromium-only, v1)

**Maintainer decision: v1 is Chromium-only with NO `webkitdirectory` fallback.** The File System
Access API is the only practical way to read a 10 GB / 32k-file tree, and the persisted-handle +
incremental-reimport story (full scope, kept) only exists on FSA-capable browsers. Rather than ship a
second, materially worse import path that we can't carry forward, non-Chromium browsers get a clear,
non-blocking empty-state:

- **`unsupported` state UI** (rendered when `supportsDirPicker === false`): a static empty-state card,
  not an interactive picker. Copy: _"Wearable correlation needs a Chromium-based browser (Chrome,
  Edge, Brave, or Opera) to read your export folder. Your data still never leaves your device — this
  feature reads files locally and uploads nothing. Open OSCAR Analyzer in Chrome or Edge to use it."_
  Include a short "Why?" disclosure linking to docs (folder access uses the File System Access API,
  unavailable in Firefox/Safari as of 2026).
- **No `<input type="file" webkitdirectory>` control is rendered.** This removes the dead second
  pipeline branch the worker would otherwise have to support (the `fileList` arm of the §5 protocol is
  cut — see §5).
- The card is **additive and non-blocking**: CPAP analysis remains fully usable: this mirrors how
  today's `FitbitCorrelationSection` never blocks CPAP. The empty-state simply replaces the import CTA
  for that one section.

(If a future version adds a `webkitdirectory` one-shot path, it would be a separate, explicitly-scoped
increment with its own consent/limitations copy — out of v1.)

---

## 2. Component & feature architecture

### 2.1 Target feature module

```
src/features/wearable-correlation/
  Section.jsx                  // orchestrator (replaces fitbit-correlation/Section.jsx)
  Section.test.jsx
  index.js                     // barrel
```

`Section.jsx` becomes thin: it composes the import card, the ingest status panel, and the dashboard,
and wires the new hooks (§3). It keeps the "gated on CPAP summary present, additive" mounting model
but adds a second axis: render the **import card** whenever the feature is supported, and render the
**dashboard** only once wearable nightly data exists.

### 2.2 Component inventory under `src/components/wearable/`

Move the kept Fitbit components here and add the new ones:

```
src/components/wearable/
  WearableImportCard.jsx       // NEW — replaces FitbitConnectionCard (OAuth → folder picker)
  WearableImportCard.test.jsx
  IngestStatusPanel.jsx        // adapted from fitbit/SyncStatusPanel.jsx
  IngestStatusPanel.test.jsx
  WearableDashboard.jsx        // adapted from fitbit/FitbitDashboard.jsx
  WearableDashboard.test.jsx
  NightDetailView.jsx          // NEW — single-night drill-down (hypnogram + overlays)
  NightDetailView.test.jsx
  correlation/
    DualAxisSyncChart.jsx      // KEEP (data-agnostic) — moved
    CorrelationMatrix.jsx      // KEEP — moved
    BivariateScatterPlot.jsx   // KEEP — moved
    index.js
  index.js
```

### 2.3 Keep / replace / add (with rationale)

**KEEP (make data-agnostic, move):**

- `correlation/DualAxisSyncChart.jsx` — already takes a generic `{ timestamps, heartRate, spO2,
sleepStages, ahiEvents, sleepStart, sleepEnd }` night object. **No OAuth coupling.** It's the core
  of the new single-night drill-down; its Fitbit-named import (`constants/fitbit` →
  `DUAL_AXIS_CHART_HEIGHT`, `CORRELATION_CHART_MARGINS`) re-points to `constants/wearableConstants.js`
  (the KEEP half of the F3 split), and its hard-coded Plotly export filename
  `'oscar-fitbit-correlation'` (`:341`) → `'oscar-wearable-correlation'`.
- `correlation/CorrelationMatrix.jsx`, `correlation/BivariateScatterPlot.jsx` — pure Plotly + props.
  `CorrelationMatrix.jsx:311` Plotly export filename `'oscar-fitbit-correlation-matrix'` →
  `'oscar-wearable-correlation-matrix'`.
- `SyncStatusPanel.jsx` → `IngestStatusPanel.jsx` — pure presentational (only `react`/`prop-types`).
  Repurpose its `dataMetrics`/`recentActivity`/`lastSync` props to show _ingest_ status (nights
  imported per metric, last import date, source date range) instead of _sync_ status.
- `FitbitDashboard.jsx` → `WearableDashboard.jsx` — keep its layout/accordion/scatter-selection
  logic (the 2026-02-09 redesign). Remove the connection-card slot and the `getTokens()` IndexedDB
  check (`passphraseMissing` logic); the dashboard no longer owns connection state.

**REPLACE:**

- `FitbitConnectionCard.jsx` → `WearableImportCard.jsx`. OAuth connect/disconnect/passphrase →
  directory pick / consent / progress / re-permission. Entirely new internals.
- `FitbitStatusIndicator.jsx` → folded into `WearableImportCard` (a small inline status chip:
  connected/disconnected/scanning/ingesting). No standalone component needed.

**ADD:**

- `WearableImportCard.jsx` — drives the §1 state machine via `useWearableImport`.
- `NightDetailView.jsx` — single-night drill-down. Composes `DualAxisSyncChart` (HR/SpO2 overlay)
  with a **hypnogram** (sleep-stage timeline from `sleep-*.json` `levels.data`) and CPAP event
  markers (AHI/apnea events for that night). This is the headline new capability the export unlocks
  (per-minute SpO2, per-30s snore, 5-min HRV within the night window — §3b). Today's dashboard only
  has an accordion of nightly KPIs; this is a richer view.
- `constants/wearableConstants.js` — the KEEP half of the F3 split (physiological/alignment/threshold/
  chart consts) **plus** new wearable-ingestion consts: ingest phase labels, metric→directory map,
  supported-metric registry. (The OAuth half of `constants/fitbit.js` is deleted — see §2.4a.)

**DELETE (UI):** `OAuthCallbackHandler.jsx`, and all `FitbitOAuth*`/`ErrorScenarios` test suites
under `components/fitbit/` (§6).

### 2.4 Old → new file/rename map

| Old path                                                                                                                        | New path                                                   | Action                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `features/fitbit-correlation/Section.jsx`                                                                                       | `features/wearable-correlation/Section.jsx`                | **rewrite** (new hooks/components)                                                                                                                                                                                                                             |
| `features/fitbit-correlation/Section.test.jsx`                                                                                  | `features/wearable-correlation/Section.test.jsx`           | **rewrite**                                                                                                                                                                                                                                                    |
| `components/fitbit/FitbitDashboard.jsx`                                                                                         | `components/wearable/WearableDashboard.jsx`                | **adapt** (drop connection slot)                                                                                                                                                                                                                               |
| `components/fitbit/SyncStatusPanel.jsx`                                                                                         | `components/wearable/IngestStatusPanel.jsx`                | **adapt** (sync→ingest props)                                                                                                                                                                                                                                  |
| `components/fitbit/correlation/DualAxisSyncChart.jsx`                                                                           | `components/wearable/correlation/DualAxisSyncChart.jsx`    | **keep** (move + retarget consts)                                                                                                                                                                                                                              |
| `components/fitbit/correlation/CorrelationMatrix.jsx`                                                                           | `components/wearable/correlation/CorrelationMatrix.jsx`    | **keep** (move)                                                                                                                                                                                                                                                |
| `components/fitbit/correlation/BivariateScatterPlot.jsx`                                                                        | `components/wearable/correlation/BivariateScatterPlot.jsx` | **keep** (move)                                                                                                                                                                                                                                                |
| `components/fitbit/correlation/index.js`                                                                                        | `components/wearable/correlation/index.js`                 | **keep** (move)                                                                                                                                                                                                                                                |
| `components/fitbit/index.js`                                                                                                    | `components/wearable/index.js`                             | **rewrite** (barrel)                                                                                                                                                                                                                                           |
| `components/FitbitConnectionCard.jsx`                                                                                           | `components/wearable/WearableImportCard.jsx`               | **replace**                                                                                                                                                                                                                                                    |
| `components/FitbitStatusIndicator.jsx`                                                                                          | (folded into WearableImportCard)                           | **delete**                                                                                                                                                                                                                                                     |
| `components/OAuthCallbackHandler.jsx`                                                                                           | —                                                          | **delete**                                                                                                                                                                                                                                                     |
| `context/FitbitOAuthContext.jsx`                                                                                                | —                                                          | **delete**                                                                                                                                                                                                                                                     |
| `hooks/useFitbitOAuth.jsx`                                                                                                      | —                                                          | **delete**                                                                                                                                                                                                                                                     |
| `hooks/useFitbitConnection.js`                                                                                                  | `hooks/useWearableImport.js`                               | **replace** (new responsibilities)                                                                                                                                                                                                                             |
| `hooks/useFitbitAnalysis.js`                                                                                                    | `hooks/useWearableAnalysis.js`                             | **adapt** (rename, same pipeline)                                                                                                                                                                                                                              |
| `utils/fitbitOAuth.js`, `fitbitAuth.js`, `fitbitApi.js`                                                                         | —                                                          | **delete** (`fitbitAuth.js:14` imports `clearFitbitData` — that dep dies with the store, see §4)                                                                                                                                                               |
| `utils/fitbitHeartRateParser.js`                                                                                                | (superseded by ingestion worker parser)                    | **delete**                                                                                                                                                                                                                                                     |
| `utils/fitbitModels.js`                                                                                                         | `utils/wearableModels.js`                                  | **KEEP (rename only) — F1.** `createNightlyRecord`/`validateNightlyRecord`/`checkDataSufficiency` are the kept nightly-record model. Trim only `normalizeFitbitData` (API adapter).                                                                            |
| `utils/fitbitCorrelation.js`                                                                                                    | `utils/wearableCorrelation.js`                             | **keep** (rename only; add `nightlyLagCorrelation` wrapper + `benjaminiHochberg` per ADR-0006)                                                                                                                                                                 |
| `utils/fitbitSync.js`                                                                                                           | `utils/wearableSync.js`                                    | **KEEP alignment, DELETE imputation — F2.** Keep `calculateSleepDate`/`alignOscarFitbitNights`/`validateAlignment`/`formatDateKey`; delete `imputeMissingValues`/`regressionImputation`/`buildLinearRegression`/`knnImputation`/`meanImputation` (`:258–521`). |
| `utils/fitbitAnalysis.js`                                                                                                       | `utils/wearableAnalysis.js`                                | **adapt (rename + F2 edit):** drop `imputeMissingValues` import (`:12`), `imputationMethod` option (`:38`), imputation step (`:83–91`); use pairwise deletion.                                                                                                 |
| `constants/fitbit.js`                                                                                                           | `constants/wearableConstants.js`                           | **SPLIT — F3.** KEEP physiological/alignment/threshold/chart consts (`:228–325`); delete OAuth block (`:1–226`). Exact split in §2.4a.                                                                                                                         |
| `constants/fitbit.test.js`                                                                                                      | `constants/wearableConstants.test.js`                      | **split — F5.** Keep the physiological/threshold/chart-const assertions; delete OAuth-config/scope/endpoint assertions.                                                                                                                                        |
| `constants/fitbitErrors.js`                                                                                                     | —                                                          | **delete** (OAuth error codes)                                                                                                                                                                                                                                 |
| `utils/fitbitDb.js`                                                                                                             | `utils/appDb.js`                                           | **generalize + version bump** (see §4); drop `clearFitbitData`/`storeTokens`/`getTokens`/`storeFitbitData`/`getFitbitData`/sync-metadata helpers with the OAuth stores                                                                                         |
| `utils/db.js`                                                                                                                   | `utils/db.js`                                              | **keep** (re-point `import { openFitbitDb }` → `openAppDb` from `appDb.js`; public API unchanged)                                                                                                                                                              |
| `test-utils/fitbitBuilders.js`                                                                                                  | (delete or replace with synthetic-export builders)         | **delete — F5.** Imports `constants/fitbit.js` (`:18`) and `fitbitModels.js`; the OAuth/sync builders are obsolete. If any builder is reused for `wearableModels` tests, port it to a `wearableBuilders.js`.                                                   |
| `App.jsx` `LEGAL_DOC_ANCHORS` `'fitbit-integration'` (`:49`)                                                                    | `'wearable-integration'`                                   | **rename — F5** (kept conditional removed; resolved now — matches the renamed docs section, §2.4b).                                                                                                                                                            |
| `styles.css` `.fitbit-*` selectors (`:1552–1666`, incl. `.fitbit-correlation-analysis`/`.fitbit-correlation-list` `:1629–1653`) | `.wearable-*`                                              | **rename — F5.** Sweep all `.fitbit-dashboard-container`/`.fitbit-*-section`/`.fitbit-correlation-*` to `.wearable-*` and update the component `className`s in the same commit.                                                                                |
| `components/fitbit/correlation/CorrelationMatrix.jsx:311` Plotly `filename: 'oscar-fitbit-correlation-matrix'`                  | `'oscar-wearable-correlation-matrix'`                      | **rename — F5** (user-facing export filename).                                                                                                                                                                                                                 |
| `components/fitbit/correlation/DualAxisSyncChart.jsx:341` Plotly `filename: 'oscar-fitbit-correlation'`                         | `'oscar-wearable-correlation'`                             | **rename — F5** (user-facing export filename).                                                                                                                                                                                                                 |
| `tests/e2e/fitbit-oauth-complete-flow.spec.js`                                                                                  | —                                                          | **delete — F5.** The OAuth E2E flow is obsolete; also sweep any `#fitbit-correlation` selectors in other E2E specs → `#wearable-correlation`.                                                                                                                  |
| `src/workers/fitbitCorrelation.performance.test.js`                                                                             | —                                                          | **delete — F6.** Targets `src/workers/fitbit-correlation.worker.js`, which **does not exist** (`src/workers/` holds only `analytics.worker.js` + `csv.worker.js`). Do not "re-point" — there was no worker.                                                    |
| (new)                                                                                                                           | `hooks/useWearableData.js`                                 | **add**                                                                                                                                                                                                                                                        |
| (new)                                                                                                                           | `workers/wearableIngest.worker.js`                         | **add** (see §5) + a from-scratch perf test (F6)                                                                                                                                                                                                               |
| (new)                                                                                                                           | `components/wearable/NightDetailView.jsx`                  | **add**                                                                                                                                                                                                                                                        |

> **Rename discipline:** the kept utils (`wearableModels`/`wearableCorrelation`/`wearableSync`/
> `wearableAnalysis`) carry the alignment + correlation + nightly-record logic that is the most
> valuable carry-over. Do the renames as dedicated `git mv -M` commits (preserves history, keeps the
> diff reviewable) and update importers in the same commit. The earlier "leave filenames as-is for v1"
> alternative is **dropped** — F5 showed the half-renamed state is the actual risk, so rename fully
> and atomically.

**§2.4b Docs / skill surface (F5).** Out of code scope but part of the Fitbit→Wearable consistency
claim — enumerate and hand to `documentation-specialist`: `README.md`, `docs/README.md`,
`docs/user/11-fitbit-integration.md` (→ `11-wearable-integration.md`, matching the renamed legal
anchor), `docs/developer/fitbit-integration.md`, `docs/user/glossary.md`, the
`oscar-fitbit-integration` skill, and agent definitions that mention Fitbit OAuth. The legal anchor
rename and the docs-file rename must land together so `LEGAL_DOC_ANCHORS` keeps matching.

### 2.4a `constants/fitbit.js` split (F3)

The recon framed this as "trim OAuth bits, keep chart consts." It is actually a **325-line file that
is mostly the shared-constants backbone of the kept layer.** Consumers of the kept half (grep
`from .*constants/fitbit`): `fitbitSync.js` (alignment offsets), `fitbitModels.js` (validation
ranges), and the three kept charts (`DualAxisSyncChart`/`CorrelationMatrix`/`BivariateScatterPlot`,
chart dims/margins). The split is explicit:

**DELETE with the OAuth layer (`constants/fitbit.js:1–226`):**

- `FITBIT_OAUTH_STORAGE_KEYS` (`:14`), `getMetaEnv`/`resolveClientId`/`DEFAULT_CLIENT_ID` helpers,
  `FITBIT_CONFIG` (`:62`), `FITBIT_SCOPES`/`MVP_SCOPES`/`DISABLED_DATA_TYPES`/`DATA_TYPE_SCOPES`
  (`:102–132`), `FITBIT_API` (`:138`), `RATE_LIMITS` (`:180`), `SYNC_CONFIG` (`:192`),
  `CONNECTION_STATUS` (`:202`), `FITBIT_ERRORS` (`:213`).

**KEEP → `constants/wearableConstants.js` (`constants/fitbit.js:228–325`):**

- Physiological validation ranges (consumed by `wearableModels.js`): `HR_*` (`:236–241`), `SPO2_*`
  (`:244–248`), `HRV_*` (`:251–259`), `SLEEP_*` (`:262–269`), `RESP_RATE_*` (`:272–275`),
  `SLEEP_DURATION_*`/`SLEEP_ONSET_MAX_MIN` (`:278–280`), `FITBIT_CONFIDENCE_*` (`:283–285` — rename to
  `WEARABLE_CONFIDENCE_*`).
- Temporal alignment (consumed by `wearableSync.js`): `SLEEP_DATE_OFFSET_HOURS`,
  `MAX_SYNC_DELAY_HOURS`, `MIN_OVERLAP_HOURS` (`:288–290`).
- Statistical/correlation: `SIGNIFICANCE_LEVELS` (`:293`), `CORRELATION_THRESHOLDS` (`:301`),
  `DATA_LIMITS` (`:320`).
- Chart layout (consumed by the kept charts): `SCATTER_PLOT_HEIGHT`/`DUAL_AXIS_CHART_HEIGHT`/
  `CORRELATION_MATRIX_HEIGHT` (`:309–311`), `CORRELATION_CHART_MARGINS` (`:313`).

`MAX_SYNC_DELAY_HOURS` and `SYNC_CONFIG` are unrelated despite the similar name: the former is an
alignment tolerance (keep), the latter is API request batching (delete). The `FITBIT_CONFIDENCE_*`
string constants are referenced by `fitbitModels.js` defaults (`:80`, `:106`, `:331`, `:357`); rename
the import there when the model file moves. `constants/fitbit.test.js` is split the same way (§2.4
row).

---

## 3. State & hooks

### 3.1 New hooks (replace OAuth hooks)

**`hooks/useWearableImport.js`** (replaces `useFitbitConnection.js`)
Owns the §1 state machine and ingestion orchestration. Responsibilities:

- Feature/capability detection (`supportsDirPicker`).
- Directory selection (`showDirectoryPicker`) and persisted-handle restore + permission
  (`query/requestPermission`).
- Detection scan (name-only walk) → `detection` result.
- Ingest orchestration via the worker (post `{ dirHandle | fileList, mode, sinceDate }`), consuming
  phase/within-phase progress messages, coalescing them to throttled state.
- Cancel (`AbortController` + `worker.terminate()`), mirroring `useCsvFiles.cancelTask`.
- Persist ingest metadata to `wearable_meta`.

Returned shape (drives `WearableImportCard` + `IngestStatusPanel`):

```js
{
  supported, state,              // 'idle' | 'scanning' | 'detected' | 'ingesting' | ...
  detection,                     // { dateRange, metrics, fileCount, byteCount } | null
  progress,                      // { phase, filesDone, filesTotal, bytesDone, bytesTotal, nights }
  lastImport,                    // { at, dateRange, nights } | null
  error,                         // sanitized
  pickDirectory, reconnect, checkForNewData,
  startIngest, cancelIngest, clearWearableData,
}
```

**`hooks/useWearableData.js`** (NEW)
Loads **nightly rollups from IndexedDB by date range** for the dashboard/correlation. It does _not_
touch raw files. Reads `wearable_nights` (and optional per-night minute arrays from
`wearable_intraday` lazily, only for the selected night in `NightDetailView`).

```js
useWearableData({ start, end }) -> { nights, loading, error, getNightDetail(date) }
```

`getNightDetail(date)` lazily fetches the heavy minute-in-night arrays (SpO2/HR/snore/HRV) for the
drill-down so we never hold all minute data in memory at once.

**`hooks/useWearableAnalysis.js`** (adapted from `useFitbitAnalysis.js`) — **rewritten per F7.**
Pipeline becomes `prepareOscarData` → `analyzeOscarFitbitIntegration` → `shapeForDashboard`. The old
`transformFitbitDataForPipeline` step and its `T12:00:00` noon hack are **deleted** — the worker emits
`WearableNight` rollups already in the pipeline's record shape (see §3.1a). The hook's input is now
`nights` (from `useWearableData`) instead of `syncedData` from the API. Still a pure `useMemo` hook.
This is **not** a "barely changes" adaptation: the adapter layer is removed, and the analysis reads
the canonical night key (`dateOfSleep`) directly.

### 3.1a Worker → hook → analysis contract (F7)

**The rollup _is_ the contract; the night key _is_ the date.** The recon's "the worker emits exactly
what the pipeline expects, so the hook barely changes" was wrong: today's `transformFitbitDataForPipeline`
(`useFitbitAnalysis.js:28–129`) consumes the **Web-API daily shape** (`{ date, restingHeartRate,
heartRateZones }`) and manufactures `date + "T12:00:00"` so `formatDateKey` lands on the right
calendar day — an artifact of API daily summaries. The Takeout export is **nightly, keyed by
`dateOfSleep`** (catalog §5), with richer per-night structure. Bending nightly data back through the
deprecated API shape is a lossy round-trip and an architecture smell. We drop it.

**Defined seam:**

- **Worker emits `WearableNight` rollups** (one record per night), already in the unified-record
  shape consumed by `alignOscarFitbitNights` + `createNightlyRecord`:
  ```js
  // WearableNight (worker → main, via the `nights` message in §5)
  {
    date: '2026-01-08',                  // === dateOfSleep, the canonical night key (no noon hack)
    fitbit: {                            // keep the existing record key name for the kept model
      heartRate:        { restingBpm, avgSleepBpm, minSleepBpm, maxSleepBpm,
                          hrv: { rmssd, lfHf, confidence } },
      oxygenSaturation: { avgPercent, minPercent, maxPercent, variabilityCoeff, odiEstimate,
                          measurementMinutes },
      sleepStages:      { totalSleepMinutes, sleepEfficiency, deepSleepMinutes, remSleepMinutes,
                          lightSleepMinutes, awakeMinutes, onsetLatencyMin },
      breathing:        { avgRatePerMin, variabilityCoeff, confidence },
    },
  }
  ```
  This is exactly the `fitbit` sub-object `createNightlyRecord` already reads (`fitbitModels.js:70–108`)
  and `alignOscarFitbitNights` already keys on `record.date` via `formatDateKey` — so **no adapter and
  no noon hack are needed**: a `YYYY-MM-DD` string flows through `formatDateKey`'s string fast-path
  (`fitbitSync.js:396–399`) unchanged.
- **`useWearableData`** loads these rows from `wearable_nights` by date range and hands the array to…
- **`useWearableAnalysis`**, which calls `analyzeOscarFitbitIntegration(preparedOscar, nights, …)`
  directly. `prepareOscarData` is retained (it still sets `sessionStartTime` so OSCAR's night key is
  computed by `calculateSleepDate`).
- **Intraday** minute arrays are **not** part of `WearableNight`; they live in `wearable_intraday`
  and are fetched lazily by `getNightDetail(date)` for `NightDetailView` only (§3.1, §4.2).

**Correlation naming (F10):** in the renamed `wearableCorrelation.js`, `nightlyLagCorrelation`
(ADR-0006) is a **thin wrapper** over the existing `crossCorrelation` (`fitbitCorrelation.js:171`) —
it date-densifies the nightly series, then delegates. It must not be a parallel re-implementation.
`benjaminiHochberg` (FDR) is the **only net-new algorithm** added to that module.

### 3.2 Slotting into `useAppState` / contexts

- **No new OAuth provider.** Remove `FitbitOAuthProvider` from `AppProviders.jsx` entirely.
- **Keep wearable state local to the feature**, not in the global `useAppState`. `useAppState` is
  already large (390 lines, 5+ hooks); CPAP analysis must not depend on wearable state. The wearable
  hooks are consumed inside `features/wearable-correlation/Section.jsx` and its children, reading
  CPAP context only for `filteredSummary` + `dateFilter` (via the existing `useData` / `useDateFilter`
  granular hooks). This preserves the current separation where the Fitbit section is a leaf consumer.
- **Optional light context** (`WearableContext`) _only_ if `NightDetailView` and the dashboard both
  need the same `useWearableData` instance without prop drilling — provide it at the `Section` level,
  not app-globally, so it stays scoped and doesn't re-render the CPAP tree.

### 3.3 Interaction with `useDateFilter`

The existing `FitbitCorrelationSection` already derives an OSCAR date range from `dateFilter` (or
`filteredSummary` min/max) to bound the Fitbit sync. We **reuse that exact logic** to bound
`useWearableData({ start, end })` — the dashboard shows only nights inside the active CPAP date
filter, keeping wearable and CPAP views in lockstep. The user's global date-range control thus
filters both. No change to `useDateFilter`/`useDateRangeFilter` is required.

---

## 4. IndexedDB versioning & migration (`oscar_app` v2 → v3)

### 4.1 Generalize the DB module first

Rename `utils/fitbitDb.js` → `utils/appDb.js`, export a generic `openAppDb()` (keep
`openFitbitDb` as a deprecated re-export for one release to avoid a big-bang churn, or update all
call sites in the same commit — recommend the latter since there are few: `db.js`,
`useFitbitConnection.js` [deleted], `FitbitDashboard.jsx`/`FitbitConnectionCard.jsx` [deleted]).
Point `utils/db.js` (session persistence) at `openAppDb()`. **`db.js`'s public API
(`putLastSession`/`getLastSession`/`clearLastSession`) stays identical** so `useSessionManager` /
`useAppState` are untouched and CPAP persistence keeps working across the migration.

### 4.2 v3 schema changes (`onupgradeneeded` from `oldVersion < 3`)

**Drop** (Fitbit OAuth/API era stores):

- `fitbit_tokens`, `fitbit_data`, `sync_metadata` → `db.deleteObjectStore(...)` guarded by
  `db.objectStoreNames.contains(...)`.

**Add** (wearable export era — coordinate exact keyPaths/indexes with the perf agent):

- `wearable_nights` — keyPath `nightDate` (`YYYY-MM-DD`). One record per night: nightly rollups for
  all §5 MUST-HAVE metrics (sleep summary/stages totals, SpO2 mean/min/%<90, HR min/avg/max +
  resting, HRV rmssd/nremhr/entropy, respiratory rate, readiness, stress, snore mins/dBA, activity
  totals, skin-temp deviation). Megabytes total (~4,300 nights), safe to load by range.
- `wearable_intraday` — keyPath `[nightDate, metric]` (or `nightDate` with metric-keyed sub-arrays).
  Holds the **optional minute-in-night arrays** (downsampled SpO2/HR per-minute, 5-min HRV, 30-s
  snore) for drill-down. Loaded lazily per selected night only.
- `wearable_meta` — keyPath `key`. Holds `dirHandle`, `lastImport`, per-metric `lastIngestedDate`,
  schema/app version, source byte/file counts. Drives §1.5 re-visit logic.

**Preserve / create `sessions` (CPAP) — F8 hardening.** The existing `contains(SESSIONS_STORE)` guard
(`fitbitDb.js:40`) means a **fresh install** (`oldVersion === 0`, no prior DB) must still _create_
`sessions` in the same v3 `onupgradeneeded`. Write the upgrade so the `sessions`-create runs
unconditionally-guarded (create if absent) on **every** `oldVersion`, while the fitbit-store _drops_
run only `if (oldVersion >= 1 && oldVersion < 3)` guarded by `contains(...)`. Concretely the upgrade
must be idempotent across `oldVersion` ∈ {0, 1, 2}: create `sessions` (if absent) + create the three
wearable stores (if absent); drop the three fitbit stores (if present). A clean `oldVersion===0`
install creates `sessions` + wearable stores and never references a fitbit store.

### 4.3 Migration safety

- The upgrade runs in one `onupgradeneeded` transaction; `sessions` data is preserved because we
  only `deleteObjectStore` the fitbit stores and `createObjectStore` the wearable ones.
- **No data migration from `fitbit_data` → `wearable_nights`** — the old encrypted API blobs are not
  re-derivable into the new nightly schema and are being abandoned. Just drop them. The user
  re-ingests from their export folder (which is the canonical source now). Call this out in the
  CHANGELOG as a one-time reset of wearable data (CPAP sessions unaffected).
- Wrap `openAppDb` to handle the `VersionError`/blocked event (another tab holds v2 open) — show a
  "Close other tabs to finish updating" message rather than failing silently.
- **Migration tests — two paths required (F8):**
  1. **v2 → v3:** open a fake v2 DB with a `sessions` record + a `fitbit_tokens` record, run the v3
     upgrade, assert the `sessions` **record survives**, the three fitbit stores are gone, and the
     three wearable stores exist.
  2. **fresh install (`oldVersion === 0`):** open v3 with no prior DB, assert `sessions` + the three
     wearable stores are all created and **no** fitbit store exists. (This is the path the original
     plan missed — a careless `oldVersion < 3` branch that only handled drops could skip `sessions`
     creation on a clean install.)
     Together these confirm the upgrade is idempotent across `oldVersion` ∈ {0, 1, 2}.

---

## 5. Worker wiring & conventions

New `src/workers/wearableIngest.worker.js`, instantiated **exactly** like `csv.worker.js`:

```js
const worker = new Worker(
  new URL('../workers/wearableIngest.worker.js', import.meta.url),
  { type: 'module' },
);
```

**Message protocol** (follow the two existing styles): use the `{ workerId, type, ... }` envelope
that `csv.worker.js`/`useCsvFiles` use (workerId guards against stale messages when a worker is
re-created), combined with the `analytics.worker.js` `{ ok, error }` failure convention:

- **Main → worker**: `{ workerId, action: 'ingest', payload: { dirHandle, mode, sinceDate, scope } }`
  and `{ workerId, action: 'scan', payload: { dirHandle } }`. **F9/Chromium-only:** the payload
  carries a `FileSystemDirectoryHandle` only — the `fileList` arm is **cut** (no `webkitdirectory`
  fallback in v1), so the worker does not branch on input type.
- **Worker → main**:
  - `{ workerId, type: 'scan-result', detection }`
  - `{ workerId, type: 'progress', phase, filesDone, filesTotal, bytesDone, bytesTotal, nights }`
  - `{ workerId, type: 'nights', records }` (streamed `WearableNight` rollups per §3.1a, persisted as
    they arrive)
  - `{ workerId, type: 'complete' }`
  - `{ workerId, type: 'error', error }` (sanitized via the same `sanitizeErrorMessage` pattern —
    never leak file paths / PHI; reuse/extract that helper).

**Conventions to preserve (from `csv.worker.js`):**

- **ms-timestamp serialization** — convert all `dateTime`/`startTime`/`endTime` to epoch **ms
  numbers** before `postMessage` (structured clone can't carry Date/Luxon). The catalog's multi-
  format datetime parser (§4) runs **inside the worker**; only normalized ms cross the boundary.
- **Chunked progress** — emit progress per file/chunk, not per record; the hook throttles further.
- **Per-source datetime + sentinel filters in the worker** — the SpO2 50.0 floor (§4.3), unit
  normalization (§4.8), string→number casts (§4.7), empty-file skips (§4.11) all happen worker-side
  so the main thread only ever sees clean nightly rollups. (Detailed algorithm = perf agent's
  domain; this doc just fixes the boundary.)
- **Worker can read the `FileSystemDirectoryHandle` directly** — handles are transferable to
  workers, so the heavy directory walk + file reads happen entirely off the main thread. (No
  `File[]`/`webkitdirectory` branch — v1 is Chromium/FSA-only, §1.6.)

**Main-thread fallback**: if `Worker` construction throws (rare; some locked-down environments) or
in jsdom tests, fall back to an in-thread `ingest()` module sharing the same parse functions — same
pattern the project already implies for CSV. Keep the parse/aggregate logic in a plain module the
worker imports, so it's unit-testable without a Worker.

---

## 6. Removal / sequencing plan

Goal: app stays **buildable + green tests** at every step. Work on a feature branch
(`feat/wearable-export-ingestion`). A short-lived flag `VITE_WEARABLE_EXPORT` (or a const) can gate
the new section while the old one is still present, but since the two never need to coexist for
users, the cleaner path is the ordered sequence below (each step is independently committable and
testable).

> **F4 — sequencing corrected.** The original plan dropped the fitbit IDB stores at v3 (old Step 2)
> **before** deleting the OAuth UI/auth that reads them via `getTokens()`/`clearFitbitData` (old Step
> 5). That leaves an intermediate landed commit where live code (`FitbitConnectionCard.jsx`,
> `FitbitDashboard.jsx`, `useFitbitConnection.js`, `fitbitAuth.js:438`) calls `getTokens()` against a
> dropped store — a runtime throw, and "green at every step" is false. The store-drop and the
> OAuth-UI/auth deletion are now **one atomic merge unit (Step 4)**, with the kept-util renames moved
> ahead of it. Each step below is independently committable, builds, and passes lint + tests.

**Step 0 — DB generalization (no behavior change, stays v2).**
Rename `fitbitDb.js` → `appDb.js`, add `openAppDb`, re-point `db.js`'s import. **Keep schema at v2 and
keep the OAuth store helpers for now** so the still-live OAuth UI keeps working. Run lint + tests;
confirm CPAP session persistence still works. (Low risk, unblocks everything.)

**Step 1 — Add the ingestion engine (parallel, no UI yet).**
Add `wearableIngest.worker.js` + its plain `ingest`/`scan` module + datetime/sentinel parsers
(perf agent leads internals). Emit `WearableNight` rollups per §3.1a. Unit-test the parser/aggregator
with **synthetic** export fixtures (use `oscar-test-data-generation` patterns; never real Takeout).
**Write the worker perf test from scratch (F6)** — do not resurrect the phantom
`fitbitCorrelation.performance.test.js`. No app wiring yet → app unaffected, still v2.

**Step 2 — Kept-util renames + F1/F2/F3 edits (no schema change, no UI swap).**

- `git mv -M` the kept utils: `fitbitModels.js`→`wearableModels.js` (F1), `fitbitSync.js`→
  `wearableSync.js`, `fitbitAnalysis.js`→`wearableAnalysis.js`, `fitbitCorrelation.js`→
  `wearableCorrelation.js`; split `constants/fitbit.js`→`constants/wearableConstants.js` (F3, §2.4a)
  with `constants/fitbitErrors.js` deleted.
- Apply the **F2 imputation excision**: delete `imputeMissingValues`/`regressionImputation`/
  `buildLinearRegression`/`knn`/`mean` from `wearableSync.js`; drop the import + `imputationMethod`
  option + imputation step from `wearableAnalysis.js`; delete the `imputeMissingValues` test block.
- Add `nightlyLagCorrelation` (wrapper over `crossCorrelation`) + `benjaminiHochberg` to
  `wearableCorrelation.js` (F10).
- Update the four kept stat-util test files' imports + the split `wearableConstants.test.js`. All
  importers in the same commit. App still renders the **old** OAuth section (it imports the kept utils
  only transitively via the analysis pipeline, which still works post-rename). Lint + tests green.

**Step 3 — New hooks + new feature module + components (old section still mounted).**
Add `useWearableImport`, `useWearableData`, adapt `useWearableAnalysis` (F7: no
`transformFitbitDataForPipeline`). Create `features/wearable-correlation/` and `components/wearable/*`;
`git mv` the three kept charts + `SyncStatusPanel`→`IngestStatusPanel` + `FitbitDashboard`→
`WearableDashboard` (re-point chart const imports to `wearableConstants.js`, fix the two Plotly export
filenames). Build `WearableImportCard` + `NightDetailView`. Write their tests (Testing Library; cover
the §1 state machine: unsupported empty-state, detection summary, progress, cancel, re-permission).
**`App.jsx` still renders the OLD `FitbitCorrelationSection`** — the new module exists but is not yet
wired, so nothing references dropped stores. v2 schema unchanged. Lint + tests green.

**Step 4 — ATOMIC merge unit (F4): v3 schema drop + OAuth-layer deletion + App swap, one PR.**
This single step removes the fitbit stores **and** every reader of them together, so there is no
intermediate state. Within the one PR:

- **Schema:** in `appDb.js`, bump to v3; drop `fitbit_tokens`/`fitbit_data`/`sync_metadata` and add
  `wearable_nights`/`wearable_intraday`/`wearable_meta` in `onupgradeneeded` (§4.2, F8-hardened); drop
  the now-dead OAuth store helpers (`storeTokens`/`getTokens`/`storeFitbitData`/`getFitbitData`/
  `clearFitbitData`/sync-metadata) and add the wearable store accessors. Add both migration tests
  (§4.3).
- `App.jsx`: replace `import FitbitCorrelationSection` with the new wearable section; rename the TOC
  entry to `{ id: 'wearable-correlation', label: 'Wearable Analysis' }` (and the `window.location.hash`
  / `setActiveSectionId('fitbit-correlation')` uses at `:222–223`); **remove** the entire
  OAuth-callback branch (`isOAuthCallback`, `showOauthHandler`, `handleOAuth*`, the early-return
  `OAuthCallbackHandler` render) and the `OAuthCallbackHandler` import; rename `'fitbit-integration'`
  → `'wearable-integration'` in `LEGAL_DOC_ANCHORS` (`:49`), landing with the docs-file rename (§2.4b).
- `AppProviders.jsx`: remove `FitbitOAuthProvider` import + wrapper.
- **Delete (OAuth layer only — NOT the kept utils/constants, F1/F3):**
  `context/FitbitOAuthContext.jsx`, `hooks/useFitbitOAuth.jsx`, `hooks/useFitbitConnection.js`,
  `components/OAuthCallbackHandler.jsx`, `components/FitbitConnectionCard.jsx`,
  `components/FitbitStatusIndicator.jsx`, `utils/fitbitOAuth.js`, `utils/fitbitAuth.js`,
  `utils/fitbitApi.js`, `utils/fitbitHeartRateParser.js`, `constants/fitbitErrors.js`, and the
  now-empty `components/fitbit/` directory (its kept charts + `SyncStatusPanel` + `FitbitDashboard`
  already moved out in Step 3). **`utils/fitbitModels.js` and `constants/fitbit.js` are NOT deleted** —
  they were renamed/split in Step 2 (the recon's delete listing was the F1/F3 error).
- **CSS sweep (F5):** rename the `.fitbit-*` selectors in `styles.css` (`:1552–1666`, including
  `.fitbit-correlation-analysis`/`.fitbit-correlation-list` at `:1629–1653`) to `.wearable-*` and
  update the moved components' `className`s in the same commit, so no dead/misnamed selectors remain.
- **Delete tests** (the OAuth/phantom suites): `FitbitConnectionCard*.test.jsx`,
  `FitbitStatusIndicator*.test.jsx`, `OAuthCallbackHandler.test.jsx`, `useFitbitOAuth.test.js`,
  `useFitbitConnection.integration.test.js`, `fitbitOAuth.test.js`, `fitbitAuth.test.js`,
  `fitbitHeartRateParser.test.js`, the `components/fitbit/FitbitOAuth.*`,
  `FitbitDashboard.oauth-flow.test.jsx`, `ErrorScenarios.comprehensive.test.jsx` suites, and
  **`workers/fitbitCorrelation.performance.test.js` — DELETE outright (F6, targets a worker that never
  existed; do NOT re-point).** Note `fitbitModels.test.js`/`fitbitModels.comprehensive.test.js` are
  **kept and renamed** (`wearableModels.test.js`, F1) in Step 2, not deleted — they validate the kept
  nightly-record model.
- **Delete the obsolete E2E spec (F5):** `tests/e2e/fitbit-oauth-complete-flow.spec.js`; sweep any
  `#fitbit-correlation` selectors in remaining E2E specs → `#wearable-correlation`.
- **Delete test-utils (F5):** `test-utils/fitbitMocks.js`, `test-utils/oauthTestHelpers.js`,
  `test-utils/fitbitBuilders.js` + `test-utils/fitbitBuilders.security.test.js` (the OAuth/sync
  builders are obsolete; if a builder is reused for `wearableModels` tests, port it to
  `wearableBuilders.js` in Step 2).
- **Update App test suites** that reference fitbit: `App.oauth-callback.test.jsx` (delete),
  `App.toc-active.test.jsx` / `App.active-section.test.jsx` / `App.edge-states.test.jsx` /
  `App.hash-anchors.test.jsx` / `App.legal-docs.test.jsx` / `App.pwa-handlers.test.jsx` (update TOC
  id `fitbit-correlation` → `wearable-correlation`, legal anchor `fitbit-integration` →
  `wearable-integration`, remove OAuth-callback assertions).

**Tests needing rewrite (summary):** OAuth/connection tests (delete); the phantom-worker perf test
(delete, F6); the **kept stat-util + model tests rename + keep** (`wearableModels.test.js` +
`.comprehensive`, `wearableSync.test.js` minus the deleted `imputeMissingValues` block,
`wearableCorrelation.test.js`, `wearableAnalysis.test.js` — they validate the still-used
nightly-record/alignment/correlation math); the split `wearableConstants.test.js`; the kept chart
tests (move); and new suites for `useWearableImport`, `useWearableData`, `WearableImportCard`,
`NightDetailView`, `IngestStatusPanel`, the ingestion worker parser, the **from-scratch worker perf
test (F6)**, and the **two v3 migration tests (v2→v3 and fresh-install, F8)**.

**CHANGELOG** (date-section per `oscar-changelog-maintenance`):

- **Removed** — Fitbit OAuth/API integration (cloud sync, token storage).
- **Added** — Wearable correlation via local Google Health (Fitbit) export folder; single-night
  drill-down (hypnogram + SpO2/HR/event overlays); incremental re-import.
- **Changed** — IndexedDB schema v2→v3 (wearable nightly stores; one-time reset of any prior Fitbit
  sync data; **CPAP sessions preserved**). Browser support note: folder import needs a Chromium
  browser.

**ADR**: this is a hard-to-reverse, high-impact change (removes an auth integration, changes the
persistence schema, introduces a directory-ingestion pipeline). Recommend an ADR covering: (1) local
export ingestion vs OAuth API, (2) File System Access API, **Chromium-only for v1 with no
`webkitdirectory` fallback** (empty-state for other browsers), (3) nightly-rollup-only persistence
(drop raw HR), (4) the v2→v3 migration that abandons old Fitbit data, and (5) **removal of the fake
regression/mean imputation** in favor of pairwise deletion (reconciles with ADR-0006, F2). The ADR
must agree with ADR-0006 on imputation and with ADR-0004 on the `WearableNight` contract.

---

## 7. Open questions / coordination seams

- **Schema field list for `wearable_nights`** — owned jointly with the perf agent; this doc fixes the
  store names/keyPaths and the worker→hook contract, perf owns the exact aggregation fields and
  intraday encoding.
- **Night-key reconciliation with OSCAR** — `wearableSync.calculateSleepDate` + `dateOfSleep`
  (catalog §3b.1) must agree with how OSCAR labels a night (morning date); keep the existing ±1-day
  reconciliation in `alignOscarFitbitNights`. Flag for `data-scientist` validation.
- **v1 scope — RESOLVED (maintainer): full scope kept (F9 override).** `NightDetailView` + hypnogram,
  `wearable_intraday` drill-down, persisted-handle "remember folder," and incremental re-import all
  ship in v1. The review's recommendation to defer these to v2–v4 is **not** adopted. The only scope
  cut is the `webkitdirectory` fallback (above).
- **Hypnogram component** — `NightDetailView` needs a stage-timeline render; check whether an
  existing OSCAR chart can be reused before building new (coordinate with `ux-designer` +
  `medical-data-visualization` skill for stage colors/accessibility).
- **`webkitdirectory` fallback scope** — **RESOLVED (maintainer): no fallback in v1.** Non-Chromium
  browsers get the §1.6 empty-state; the worker `fileList` arm is cut (§5). A fallback, if ever added,
  is a separate scoped increment. (No longer an open question.)
