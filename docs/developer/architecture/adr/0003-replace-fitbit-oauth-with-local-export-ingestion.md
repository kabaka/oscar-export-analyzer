# ADR-0003: Replace Fitbit OAuth/API Integration with Local Google Health Export Ingestion

**Date**: June 10, 2026
**Status**: Proposed

---

## Context

OSCAR Export Analyzer correlates CPAP sleep-therapy data with wearable data. The
existing wearable integration uses the **Fitbit OAuth2 + Web API** flow: the user
authenticates with Fitbit, the app stores access/refresh tokens in IndexedDB, and a
sync layer pulls per-day metrics over the network. This integration has proven
**fragile and partly broken**:

- **OAuth fragility.** The redirect/callback flow (`fitbitOAuth.js`, `fitbitAuth.js`,
  `OAuthCallbackHandler.jsx`, `FitbitOAuthContext.jsx`) carries PKCE/state generation,
  redirect-URI validation, token refresh, and expiry handling — a large, brittle, and
  security-sensitive surface. `useFitbitConnection.js` even opens a non-existent
  `fitbit_tokens` database and treats the async open as synchronous (a latent bug).
- **Broken security measures.** A passphrase-based at-rest encryption path with an
  **insecure passphrase backup** was flagged and removed (commit `e65e3c0`), and
  `fitbitDb.js` carried an inconsistent `encryptionEnabled` dual-write path
  (lines ~170–177) — encryption was applied inconsistently and fragilely.
- **Broken data ingestion.** The Fitbit data pipeline had multiple integration bugs
  (see recent commits `49bf2e1`, `871b9f0`, `0c446e8`); the API path delivered limited,
  rate-limited, low-resolution data compared to what users actually possess.

Separately, the user can obtain a **complete local Google Health (formerly Fitbit)
Takeout export** — in the reconnoitred case ~10 GB across 32,738 files spanning
2014–2026 (see [`data-catalog.md`]). This export contains far richer, higher-resolution
data than the Web API ever exposed (full sleep-stage timelines, per-minute SpO2,
per-30-second snore, ~67 M raw heart-rate samples), and it requires **no network, no
credentials, and no third-party servers** — a perfect fit for the project's local-first
privacy model (ADR-0002).

The four design docs under `docs/developer/reports/2026-06-wearable-export-planning/design/` (perf/storage,
data-model/correlation, privacy/security, integration/UX) collectively propose
**replacing the OAuth/API integration with local directory ingestion of the export.**
This ADR records that overarching strategic decision; three companion ADRs (0004, 0005, 0006) record the storage model, file-access/privacy boundary, and correlation
methodology respectively.

---

## Decision

**Retire the Fitbit OAuth/API integration entirely and replace it with directory-based
ingestion of a local Google Health (Fitbit) export**, parsed and aggregated entirely
in-browser.

Concretely:

1. **Directory ingestion as the data source.** The user selects their local
   `Google Health/` export folder; a Web Worker enumerates and reads only in-scope files
   (allowlist — see ADR-0005), aggregates them to nightly rollups (ADR-0004), and
   correlates them with CPAP nights (ADR-0006). No network request is ever made for
   health data.

2. **File access via the File System Access API — Chromium-only for v1 (maintainer
   decision).** `showDirectoryPicker({ mode: 'read' })` is the **sole** ingest path; there
   is **no `<input webkitdirectory>` fallback in v1**. Capability detection
   (`'showDirectoryPicker' in window`) gates the feature: non-Chromium browsers
   (Firefox/Safari) get a clear unsupported empty-state ("Wearable import requires a
   Chromium-based browser; your CPAP analysis is unaffected"), never a degraded path. The
   `webkitdirectory` route was dropped because for a 10 GB / 32,738-file selection it
   **eagerly materializes all 32,738 `File` objects on the main thread before any JS runs**
   — a credible multi-second freeze / OOM at selection time, i.e. a load-bearing failure,
   not a graceful degradation (perf design rev2 §1.1, §1.6). `webkitdirectory` is retained
   only as a possible _future small, bounded import_ affordance, with that eager-FileList
   OOM caveat documented. The privacy and handle-persistence details are decided in ADR-0005.

3. **Delete the OAuth attack surface; keep the data-model and shared-constants backbone.**
   Remove all auth/API/token code and its IndexedDB stores: `fitbitAuth.js`, `fitbitApi.js`,
   `fitbitOAuth.js`, `useFitbitOAuth.jsx`, `useFitbitConnection.js`, `OAuthCallbackHandler.jsx`,
   `FitbitOAuthContext.jsx`, `FitbitConnectionCard.jsx`, `FitbitStatusIndicator.jsx`,
   `fitbitHeartRateParser.js`, `constants/fitbitErrors.js`, the OAuth-callback branch in
   `App.jsx`, and `FitbitOAuthProvider` in `AppProviders.jsx`. Remove `https://api.fitbit.com`
   from the CSP and any `*.fitbit.com` reference from shipped code. **Correct the prior
   keep/delete framing** (it mis-classified two core modules — integration/UX rev2 F1/F3,
   ADR-0006 §0):
   - **`fitbitModels.js` → `wearableModels.js` (KEEP, rename only).** This is **not** "token
     models" — it is the nightly-record data-model backbone (`createNightlyRecord`,
     `validateNightlyRecord`, `checkDataSufficiency`) the entire kept pipeline and its tests
     depend on, importing only physiological constants and no OAuth code. Only
     `normalizeFitbitData` (the raw-API → record adapter) is trimmed.
   - **`constants/fitbit.js` → `constants/wearableConstants.js` (KEEP, split).** Keep the
     shared physiological / alignment / threshold / chart constants (the backbone of every
     kept module); **delete only the OAuth scopes/endpoints block**.
   - **`fitbitSync.js` → `wearableSync.js` (rename PLUS deletion).** Keep the alignment engine
     (`alignOscarFitbitNights`, `validateAlignment`, etc.); **delete the imputation/regression
     block** (`imputeMissingValues`, `regressionImputation`, `buildLinearRegression` whose
     `predict()` returns `mean + random noise`, `knnImputation`, `meanImputation`) — the fake
     stats retired in ADR-0006.
   - Drop the `fitbit_tokens` / `fitbit_data` / `sync_metadata` IndexedDB stores (ADR-0004).
     **Sequencing — green at every step:** the store-drop (v3 migration) and the OAuth-UI/auth
     deletion are landed as **one atomic step**, so no intermediate commit reads a store that a
     prior commit dropped (integration/UX rev2 F4); the app builds and tests pass at every
     landed commit.

4. **Rename the feature from "Fitbit" to "Wearable."** The source is now a Google Health
   export and may later include other exports. Feature dir →
   `features/wearable-correlation/`; components → `components/wearable/`; kept stat utils
   renamed (`fitbitCorrelation.js` → `wearableCorrelation.js`, etc.) in a single
   history-preserving rename commit. The data-agnostic correlation/alignment math and the
   pure Plotly chart components are **carried over**, not rewritten.

5. **Keep the change additive and non-blocking.** As today, the wearable section never
   blocks CPAP analysis; on unsupported (non-Chromium) browsers it shows a clear
   unsupported empty-state, never a dead-end.

This is a hard-to-reverse decision: it removes an external integration, changes the
persistence schema, and abandons the prior wearable data path. It is recorded here so
the rationale survives for future maintainers and AI agents.

---

## Consequences

### Positive

- **Richer data.** The export carries full sleep-stage timelines, per-minute SpO2,
  per-30-s snore, per-5-min HRV, and ~67 M raw HR samples — far beyond the rate-limited
  Web API. New capabilities (single-night hypnogram + SpO2/HR/event overlays) become
  possible.
- **Eliminates the entire OAuth attack surface.** No access/refresh tokens at rest, no
  token-refresh lifecycle, no PKCE/state, no redirect/callback handling, and the insecure
  passphrase backup is gone (detailed in ADR-0005 §security wins). This is the single
  biggest security win of the rework.
- **Provable local-first.** With no external endpoints remaining, the local-first
  guarantee becomes **CSP-enforced** (`connect-src 'self'`), not merely aspirational
  (ADR-0005).
- **No third-party dependency or rate limits.** No Fitbit app registration, no API quota,
  no service outages, no breaking API changes.
- **Smaller, simpler codebase.** Auth/sync/API-client modules and their tests are
  deletable, reducing maintenance and audit scope.

### Negative

- **Chromium-only for v1.** The File System Access API is the sole ingest path, so the
  wearable feature is **unavailable on Firefox/Safari** (clear unsupported empty-state; CPAP
  analysis unaffected). This is a deliberate loss of cross-browser parity, accepted because
  the only cross-browser alternative (`webkitdirectory`) fails outright at this scale
  (eager-FileList OOM, §Decision 2). FSA's Chromium-only status is confirmed as the basis
  for the v1 product decision (re-verify Baseline at implementation time only to inform the
  empty-state copy, not the decision).
- **User friction to obtain the export.** The user must download a multi-GB Takeout and
  point the app at it, vs a one-time OAuth click. Re-exports are manual and periodic.
- **One-time data reset.** Any data from the old Fitbit sync is abandoned (not migrated);
  the user re-ingests from the export. CPAP sessions are unaffected (ADR-0004).
- **New, substantial ingestion pipeline.** A streaming Web Worker, a directory
  allowlist/denylist, a v3 schema, and an aggregation engine are net-new code to build,
  test, and maintain (ADR-0004/0005/0006).
- **Large-input robustness burden.** Reading ~6.5 GB of in-scope, heterogeneous,
  drift-prone, partly-malformed files (ADR-0004 data-quality gotchas) requires careful
  file-sequenced parsing and defensive handling to avoid OOM/jank.

### Mitigations

- Capability-detect up front and present a clear "use a Chromium browser" unsupported
  empty-state; never block CPAP analysis (ADR-0005).
- Parse one file at a time in a Web Worker and aggregate to nightly rollups so memory stays
  bounded (ADR-0004; measured ~5.5 MB transient per HR file, steady-state heap ≤ 100 MB).
- Make the migration a clean, guarded v2→v3 upgrade that preserves CPAP `sessions` and
  drops only Fitbit stores (ADR-0004); call out the one-time reset in the CHANGELOG.
- Carry over the proven alignment/correlation math and pure chart components rather than
  rewriting (integration/UX design §0, §2.3).

---

## Alternatives Considered

### Alternative A: Keep and fix the OAuth/API integration

- **Pros:** One-click connect; works in all browsers; no large local file handling; no
  schema migration.
- **Cons:** Keeps the entire OAuth attack surface (tokens, refresh, PKCE/state,
  redirect/callback) and the fragile encryption/passphrase path; remains subject to API
  rate limits, low resolution, and breaking third-party changes; requires a registered
  Fitbit app and live network; the existing pipeline is already buggy and the API can
  never deliver the export's resolution.
- **Why not chosen:** Fixing OAuth retains every structural weakness that motivated the
  rework while capping the achievable data richness. The export path removes the attack
  surface _and_ unlocks far richer data.

### Alternative B: Manual single-file upload (one CSV/JSON at a time)

- **Pros:** Trivial to implement; works in all browsers; no directory permission model;
  no persisted handle.
- **Cons:** Unusable at this scale — the export is 32,738 files; asking the user to select
  files individually (or even the right subset) is infeasible and error-prone. Loses the
  ability to discover scope, de-duplicate canonical sources, and reconcile timezones across
  files.
- **Why not chosen:** The whole point is to ingest a large multi-file tree; per-file upload
  does not scale to 32k files. (A `webkitdirectory` whole-folder selection is **also rejected
  for v1**: at this scale it eagerly materializes all 32,738 `File` objects on the main thread
  at selection time — an OOM/freeze risk, not a graceful fallback (perf design rev2 §1.6). It
  survives only as a possible future _small, bounded_ import path with that caveat.)

### Alternative C: Server-side ingestion / cloud processing

- **Pros:** Browser-independent; no File System Access API limits; could pre-aggregate.
- **Cons:** Fundamentally violates the local-first privacy model (ADR-0002) — PHI would
  leave the device; requires backend infrastructure (contradicts static GitHub Pages
  hosting); hosting cost and HIPAA-adjacent compliance burden.
- **Why not chosen:** Incompatible with the project's non-negotiable local-first,
  no-server architecture.

---

## Settled by the Maintainer / Empirical Review

- **Chromium-only v1 (FSA-only) is a product decision, not an open assumption.** The File
  System Access API is the sole ingest path; non-Chromium browsers get an unsupported
  empty-state. `showDirectoryPicker` remains Chromium-only as of this writing; re-verify
  Baseline at implementation time only to keep the empty-state copy accurate.

## Assumptions to Verify

- **Real export structure generalizes.** The catalog reflects one real export; directory
  names, schema drift, and the SpO2 50.0 sentinel are assumed representative. Detection
  must degrade gracefully when an export deviates (ADR-0005 §1.3). (The SpO2 50.0 sentinel
  invariant has since been empirically confirmed for this export — ADR-0006.)

---

## References

**Design docs (detail; archived under `docs/developer/reports/2026-06-wearable-export-planning/`):**

- [`data-catalog.md`](../../reports/2026-06-wearable-export-planning/data-catalog.md)
- [`design/perf-storage-architecture.md`](../../reports/2026-06-wearable-export-planning/design/perf-storage-architecture.md)
- [`design/data-model-and-correlation.md`](../../reports/2026-06-wearable-export-planning/design/data-model-and-correlation.md)
- [`design/privacy-security.md`](../../reports/2026-06-wearable-export-planning/design/privacy-security.md)
- [`design/integration-and-ux.md`](../../reports/2026-06-wearable-export-planning/design/integration-and-ux.md)

**Related ADRs:**

- [ADR-0002: Progressive Web App Implementation](0002-progressive-web-app-implementation.md) — local-first / no-cloud-sync posture this rework reinforces.
- [ADR-0004: Ingest-and-Aggregate Wearable Data to IndexedDB](0004-ingest-and-aggregate-wearable-data-to-indexeddb.md)
- [ADR-0005: Wearable Export File Access, Directory-Handle Persistence & Privacy Boundary](0005-wearable-export-file-access-and-privacy-boundary.md)
- [ADR-0006: Wearable↔CPAP Alignment & Correlation Methodology](0006-wearable-cpap-alignment-and-correlation-methodology.md)

**Code (to be removed):** `src/utils/fitbitOAuth.js`, `fitbitAuth.js`, `fitbitApi.js`,
`src/hooks/useFitbitOAuth.jsx`, `useFitbitConnection.js`,
`src/components/OAuthCallbackHandler.jsx`, `src/context/FitbitOAuthContext.jsx`,
`constants/fitbitErrors.js`, `index.html` (CSP), `src/App.jsx` (OAuth-callback branch).
**Code (renamed/kept):** `fitbitModels.js` → `wearableModels.js` (KEEP), `constants/fitbit.js`
→ `wearableConstants.js` (KEEP shared constants, delete OAuth block), `fitbitSync.js` →
`wearableSync.js` (rename + delete imputation/regression block — ADR-0006).

---

## Approval

**Decision Maker**: Project maintainer
**Recommended Reviewers**: @security-auditor, @frontend-developer, @data-scientist, @readiness-reviewer
**Status**: Proposed — awaiting review and acceptance.

---

## Changelog

| Date       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Author          |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| 2026-06-10 | Initial ADR drafted                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | @adr-specialist |
| 2026-06-10 | Revised after **adversarial review 2026-06-10**: (1) **Chromium-only v1** — dropped the `webkitdirectory` fallback commitment (eager-FileList OOM at 32k files); non-Chromium → unsupported empty-state. (2) Corrected keep/delete framing: `fitbitModels.js`→`wearableModels.js` KEEP, `constants/fitbit.js`→`wearableConstants.js` KEEP (split), `fitbitSync.js`→`wearableSync.js` rename + delete imputation block. (3) Added green-at-every-step sequencing (store-drop + OAuth deletion atomic). | @adr-specialist |
