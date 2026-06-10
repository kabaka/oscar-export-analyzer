# ADR-0004: Ingest-and-Aggregate Wearable Data to IndexedDB (vs Dynamic On-Demand Directory Loading)

**Date**: June 10, 2026
**Status**: Proposed

---

## Context

ADR-0003 decides to replace the Fitbit OAuth/API integration with ingestion of a local
Google Health (Fitbit) export. This raises a first-order data-model question the project
maintainer explicitly raised: **once we can read the export folder, do we (a) aggregate
it once into a compact persisted store, or (b) re-read the directory dynamically on
demand whenever a view needs data?**

The relevant facts from [`data-catalog.md`] and [`perf-storage-architecture.md`]:

- The export is **~10 GB / 32,738 files**. **Heart rate alone is ~89% of the volume**:
  `Global Export Data/heart_rate-*.json` = 3,541 files, ~6.1 GB, **~67 M samples** at
  ~2–5 s cadence (up to ~42 k samples/day on a 2025 Pixel Watch).
- The app correlates at **per-night** granularity. After aggregation, the entire
  correlation store is **megabytes, not gigabytes** (~4,300 nights × a few dozen metrics
  - optional per-minute-within-night arrays) — a ~600× reduction from 10 GB on disk.
- The data has many **quality traps** (catalog §4): two datetime formats plus Z/no-Z,
  epoch-1970 placeholders, Unix-epoch-seconds, a **SpO2 = 50.0 sentinel** floor
  (~15% of minute rows are invalid), pseudo-JSON with unquoted enum tokens in CSV cells,
  array-in-cell fields, string-typed numeric values, and 12 years of schema drift.
- Nearly every metric is **duplicated** across the `Global Export Data` and
  `Physical Activity_GoogleData` trees; ingesting both double-counts.
- The current IndexedDB is `oscar_app` **v2** (`fitbitDb.js`) with stores `sessions`
  (CPAP), `fitbit_tokens`, `fitbit_data`, `sync_metadata`. Critically, **`src/utils/db.js`
  (CPAP session persistence) opens the DB through `fitbitDb.js`** — so that module is
  already the de-facto app DB initializer, and CPAP persistence must keep working
  throughout any migration (integration/UX design §0).

This ADR fixes the data-flow and persistence model. The file-access/privacy decisions are
in ADR-0005; the alignment/correlation methodology is in ADR-0006.

---

## Decision

**Stream the raw export files through a Web Worker, aggregate to compact nightly rollups
(plus optional per-minute-within-night drill-down arrays), and persist only those derived
products in IndexedDB. The raw ~10 GB is never fully resident in memory and is never
persisted.** Dynamic on-demand re-reading of the directory for routine views is rejected.

### 1. Aggregate-on-ingest, in a single Web Worker

- A new `src/workers/wearableIngest.worker.js` enumerates in-scope files (ADR-0005
  allowlist), reads them **one file at a time**, parses (`JSON.parse` for JSON, PapaParse
  for CSV), normalizes datetimes/units/sentinels, and folds rows into per-night
  accumulators. It follows the existing `{ workerId, type, ... }` protocol and
  `sanitizeErrorMessage` conventions of `csv.worker.js`.
- **No streaming JSON parser, no contingency.** The largest real HR file is ~4.3 MB
  observed (15 files >4 MB, none >10 MB) and parses to a **measured ~5.5 MB transient graph
  (~1.34× the file; worst case ~11 MB / 2.78×)** — _not_ the 40–80 MB / 10–40× claimed in
  the prior draft. Each file is parsed, folded, and discarded before the next, so steady-state
  worker heap targets **≤ 100 MB** (≈ 25× headroom under the 256 MB hard ceiling). A streaming
  JSON parser (oboe/clarinet/`@streamparser/json`) is 10–40× slower than native `JSON.parse`,
  adds bundle weight, and could only matter for a file too large to fit in heap — which cannot
  occur here. The **streaming-parser contingency is removed entirely** (it rested on the wrong
  overhead constant) — perf design rev2 §1.4. "Streaming" in this architecture means streaming
  the _sequence_ of files, not within a file.
- **Worker count is gated on profiling, not locked.** The bottleneck is CPU (parse is ~69% of
  ingest CPU, single-core-bound) plus single-writer IndexedDB. With ~25× heap headroom a small
  2–4-worker HR pool is a live option **if gate G1 shows parse (not per-file FSA I/O)
  dominates**; if per-file FSA overhead dominates, a single worker is correct (a pool would not
  help). Either way, **all IndexedDB writes go through one writer** that owns the resume cursor
  (perf design rev2 §2.6, §5.0).
- **Batched, incremental flush:** rollups flush every `FLUSH_INTERVAL_NIGHTS` (~30 nights) for
  durability; writes use the batched `putBatch` primitive (§3a). Heap stays bounded regardless
  of total export size.
- **Canonical source per metric.** Read exactly one canonical source per metric (catalog
  §2); never union raw rows across the Global vs GoogleData trees (avoids double-counting).
- **Two-phase ingest order (resolves the prior HR-last vs eviction contradiction).** The
  prior draft both ingested HR last _and_ required per-night intraday eviction — contradictory,
  because HR-last would pin every night's intraday. The corrected order is:
  - **Phase A — windows first, fully resident.** Ingest `UserSleeps_*` (offset hints),
    `sleep-*.json`, `sleep_score.csv`, and daily rollups to build the night-window index
    (`Map<nightDate, {window, offset}>`) and the ~4 MB rollup map. Both stay resident the
    whole ingest (they are small). The per-night UTC offset is resolved here, **before** any
    high-frequency series is windowed (the resolver is owned by ADR-0006).
  - **Phase B — high-frequency series, one metric at a time, per-night date-ordered with
    eviction.** Process each metric in its own phase (`SpO2 → HRV → snore → HR last`), grouped
    by night in date order. As soon as a night's intraday for the current metric is complete,
    stage it for batched flush and **evict** it (`MAX_RESIDENT_INTRADAY_NIGHTS = 64` cap). A
    night's intraday is never held across metric phases, so HR being last is fine — every
    prior metric's intraday is already persisted and dropped. Resident memory is bounded by
    window index + rollups + ≤ 64 nights of one metric's intraday + one parse graph + the
    flush buffer, **independent of total export size** (perf design rev2 §2.2–§2.3).

### 1a. Batched IndexedDB writes (`putBatch`, N puts per transaction) — hard requirement

The existing `fitbitDb.js` does **one `put` per transaction everywhere** — the slow anti-pattern
this design must avoid. Unbatched, ~16,000 puts (~4,300 nights + ~12,000 intraday blobs) at
1–5 ms commit overhead each ≈ **16–80 s**. There is no batch helper to reuse, so a `putBatch(db,
items)` primitive is a **hard requirement** (new, in `appDb.js`): issue all `put`s in one
`readwrite` transaction spanning both wearable stores and **resolve on `transaction.oncomplete`
(the commit), never per-request**. Typed arrays are stored via structured clone (no
`JSON.stringify`). `MAX_PUTS_PER_TX` (~110, tuned by gate G4) caps one transaction; batched into
~145 transactions, total write time drops to a few seconds (perf design rev2 §2.3a). Because each
flush is one committed transaction, a `terminate()` mid-ingest leaves IndexedDB at the last
committed batch — no partial-night corruption.

### 2. The `WearableNight` rollup model

One self-contained record per wearable main-sleep night (~4,300 total, ~1 KB each), keyed
by `nightDate` (`YYYY-MM-DD`, = the `dateOfSleep` morning label). It holds nightly aggregates for all v1 metrics: sleep
architecture (stage minutes, efficiency, WASO, score), SpO2 (mean/min/p5/%-below-90/88,
post-sentinel), sleeping + resting HR, HRV, respiratory rate, readiness, stress, snore,
prior-day activity, skin-temp deviation, the resolved UTC-offset `window`, and a
`coverage` block distinguishing "absent" from "insufficient." The full field-level model,
aggregation formulas, and coverage gates are defined in ADR-0006 §1–2. The rollup is
**self-contained** so a correlation view does one keyed range read with no joins.

### 3. IndexedDB schema: bump `oscar_app` v2 → v3, new wearable stores

Generalize `utils/fitbitDb.js` → `utils/appDb.js` (export `openAppDb()`; re-point
`utils/db.js` at it; CPAP session API `putLastSession`/`getLastSession`/`clearLastSession`
stays byte-for-byte identical so `useSessionManager`/`useAppState` are untouched). Bump
`DB_VERSION = 3` and in one `onupgradeneeded` (branching on `oldVersion < 3`):

- **Preserve** `sessions` (CPAP) — never touched; the existing `contains('sessions')`
  guard stays.
- **Drop** the Fitbit OAuth-era stores `fitbit_tokens`, `fitbit_data`, `sync_metadata`
  (guarded by `contains(...)`). **No data migration** from `fitbit_data` — old encrypted
  API blobs are not re-derivable into the nightly schema and are abandoned; the user
  re-ingests from the export. Call this out as a one-time wearable-data reset in the
  CHANGELOG (CPAP unaffected).
- **Add** three stores:
  - **`wearable_nights`** — keyPath `nightDate` (`YYYY-MM-DD`). One rollup per night;
    range queries are native via `IDBKeyRange.bound(start, end)` on the key. ~4 MB total.
  - **`wearable_intraday`** — compound keyPath `[nightDate, metric]`; one metric's
    downsampled array per night, stored as a **typed array (`Int16Array`/`Float32Array`
    ArrayBuffer)** for compactness (~1 KB/night/metric vs ~15 KB as JSON objects). HR
    downsampled to 1-min, SpO2 1-min, HRV 5-min, snore 30-s. **Lazy-loaded** only when a
    night's detail view opens; never read by the correlation list.
  - **`wearable_meta`** — keyPath `key`. Holds ingest metadata: `lastImport`, the per-metric
    `lastIngestedDate` high-water mark, a `files` map of `{ relativePath, size }` identities
    (**no `lastModified`** — see §4a), schema/app version, source file/byte counts, resume
    cursor, and (opt-in only — ADR-0005) the persisted `dirHandle`. Drives re-visit/incremental
    logic.

  > Naming note: the field name is unified on **`nightDate`** across all stores, ADRs, and
  > rev2 designs (the prior `date` / `['date','metric']` drift is gone). The metadata store
  > is `wearable_meta` and the module is `appDb.js` (the perf design rev2 now adopts these
  > same names).

- **Persisted-footprint budget:** ≤ 50 MB (≈ 15 MB expected with full drill-down,
  ≈ 4–5 MB rollups-only). Well below browser quotas.

### 4. Drill-down: persist intraday at ingest (default), not dynamic re-read

When a user opens one night's detail (hypnogram + per-minute SpO2/HR/HRV/snore overlays),
serve it from the pre-persisted `wearable_intraday` typed arrays — one `[nightDate, metric]`
read, ~5–20 ms, and it survives reload with no retained handle (the only consistently
available drill-down source, since handle persistence is opt-in and v1 is Chromium-only).
Re-reading and re-aggregating that night's source files on demand is **slower and variable**
(200 ms–2 s, an HR night may span two files), only works with a retained FSA handle, and
breaks after permission revoke. The retained handle is kept only as a _secondary, opt-in_
path for raw-resolution ("Load full resolution") drill-down (perf design §4; handle
persistence governed by ADR-0005). A "rollups-only" mode (≤ 5 MB, no intraday) is offered
for storage-constrained users.

### 4a. Incremental re-import: `lastIngestedDate` high-water mark, NOT mtime

The prior draft keyed the skip predicate on file `lastModified`. **The empirical review proved
that unsound:** every export file shares one **extraction-date mtime** (Takeout + unzip stamp
the extraction time), and a fresh Takeout rewrites **all** mtimes — so an mtime predicate forces
a **full re-ingest every time** and the "only the new tail" benefit never materializes
(empirical-redteam Finding 6; perf design rev2 §2.5). The corrected predicate **drops mtime
entirely**:

1. **Authority = per-metric `lastIngestedDate` high-water mark** in `wearable_meta` — the most
   recent committed `nightDate` per metric. A file whose date range is entirely ≤ that metric's
   high-water mark is a candidate to skip.
2. **Identity guard = `{ relativePath, size }`** (no mtime). A candidate is skipped only if a
   `wearable_meta.files` entry with the same `relativePath` records the same byte `size`
   (historical months are byte-stable across re-exports); a changed size or a new path falls
   through to re-ingest.
3. **Otherwise re-read.** New nights, changed-size files, and new paths re-ingest; nights
   overwrite by `nightDate` keyPath (idempotent — last-writer-wins, which also tolerates the
   chunk-file `logId` duplication once ADR-0006's dedup lands).

This keeps the common "fresh Takeout every few months" re-import cheap **without trusting mtime
at all**.

---

## Consequences

### Positive

- **MBs, not GBs.** 10 GB on disk compresses to ~15 MB persisted (~600×), making the data
  trivially queryable: a 90-night correlation view is a single keyed range read in
  single-digit ms.
- **Bounded memory.** Sequential single-file parse (measured ~5.5 MB transient per HR file)
  - per-night-per-phase eviction + batched flush keeps worker heap to a **≤ 100 MB
    steady-state target** (256 MB hard ceiling, ~25× headroom) regardless of export size; the
    main thread stays at 60 fps throughout the ingest.
- **Fast drill-down with no retained handle.** Typed-array `[nightDate, metric]` intraday
  reads are fast and survive reload; no re-permission prompt on the critical path of opening
  a night (the only consistently available drill-down source — see §4).
- **Self-contained nightly records.** One read per correlation view, no joins; the night
  key (`nightDate`) _is_ the date, so OSCAR↔wearable alignment is a direct key lookup.
- **Incremental re-import is cheap and sound.** A per-metric `lastIngestedDate` high-water
  mark + `{relativePath,size}` identity (NOT mtime — §4a) means a fresh Takeout only
  reprocesses the new tail of nights.
- **Native `JSON.parse` + PapaParse only.** No streaming-parser dependency; bundle stays
  within the ≤ 500 KB JS budget.

### Negative

- **Re-aggregation cost on schema/formula changes.** Because raw data is discarded, any
  change to an aggregation formula or a new metric requires the user to **re-ingest** from
  the export (a realistic in-browser ~6–20 min operation, gated on profiling — see §Negative
  on wall-clock below). Dynamic re-read (rejected) would have re-derived for free.
- **Lossy by design.** Raw 2–5 s HR is downsampled to 1-min for drill-down; full-resolution
  detail is unavailable unless the user retains the FSA handle and uses the secondary
  "Load full resolution" path.
- **Migration is destructive to old Fitbit data.** v3 drops `fitbit_data`/`fitbit_tokens`
  with no migration; users lose any prior sync data (CPAP preserved).
- **Aggregation correctness is load-bearing.** All downstream analysis trusts the rollups;
  a bug in windowing or the SpO2 sentinel filter silently corrupts every night (mitigated
  by ADR-0006's coverage gates, plausibility checks, and tests).
- **Ingest wall-clock is device-dependent and unverified in-browser.** Realistic in-browser
  ingest is **6–20 min** (native-Node floor ~3–4 min), dominated by per-file overhead over
  ~18,200 in-scope files (~80% tiny), not byte throughput. This must not be published as a
  fixed number until gate **G1** measures it on a mid-range device, with a device caveat
  (perf design rev2 §1.5).
- **Worker/heap tuning required, behind binding gates.** `FLUSH_INTERVAL_NIGHTS`,
  `MAX_PUTS_PER_TX`, and `MAX_RESIDENT_INTRADAY_NIGHTS` (=64) must be profiled against a
  synthetic 10 GB-shaped fixture; the worker model (single vs HR pool) is **not locked**
  until G1 runs.

### Mitigations

- Version rollups with a `schemaVersion` field so a future formula change can detect stale
  nights and re-aggregate selectively (perf design §3.2).
- Keep the optional FSA handle as the lossless raw-resolution escape hatch (ADR-0005).
- Guard the v3 upgrade so `sessions` is preserved; add a focused migration test covering
  **both the fresh-install (`oldVersion === 0`) path and the v2→v3 path** (open a fake v2 DB
  with a `sessions` + `fitbit_tokens` record, run upgrade, assert `sessions` survives, fitbit
  stores gone, wearable stores created) and handle the `blocked`/other-tab case with a
  "close other tabs" message (integration/UX §4.3).
- **Pass the consolidated pre-implementation profiling gates before locking the worker
  model** (perf design rev2 §5.0): **G1** (browser FSA loop bench → wall-clock + ms/file
  split + single-worker-vs-pool decision), **G3** (worker heap flat < 100 MB across a full
  synthetic 10 GB-shaped run — catches accumulator leaks / `parsed`-reference pins), **G4**
  (`putBatch` tx commits < 250 ms; total IDB write < 30 s), **G5** (no main-thread task
  > 50 ms; progress coalesced ~10/s).

---

## Alternatives Considered

### Alternative A: Dynamic on-demand directory loading (re-read raw files per view)

- **Pros:** No persisted derived store; no schema migration for new metrics (re-derive on
  demand); always reflects the current export with zero staleness.
- **Cons:** Catastrophic for performance — every view would re-walk and re-parse subsets of
  ~6.5 GB; opening a 90-night correlation would re-scan thousands of files; only works with
  a retained FSA handle (breaks on Firefox/Safari and after permission revoke); puts the
  10 GB cost on every interaction instead of once.
- **Why not chosen:** The app's hot path is "load N nights by date range," which must be
  single-digit ms. Re-reading raw files makes that seconds-to-minutes and browser-fragile.
  Aggregate-once is ~600× smaller and turns the hot path into one keyed read.

### Alternative B: Persist the raw export (or raw HR) in IndexedDB

- **Pros:** Lossless; full-resolution drill-down without retaining a filesystem handle;
  re-aggregation without re-reading the folder.
- **Cons:** ~10 GB (6.1 GB HR alone) in IndexedDB blows the storage budget and likely the
  browser quota; writing 67 M rows is slow and risks eviction; provides no analytical
  benefit at nightly granularity.
- **Why not chosen:** Storing raw data defeats the entire point — the correlation is
  nightly, so raw samples are pure cost. We persist the ~15 MB of derived products instead.

### Alternative C: Persist raw but in a compressed blob (e.g. gzip per file)

- **Pros:** Smaller than raw; lossless; re-aggregatable offline.
- **Cons:** Still hundreds of MB to low-GB; decompression cost on every drill-down;
  added complexity; no nightly-query benefit (must decompress + parse to query).
- **Why not chosen:** Marginal over Alternative B; still far larger and slower than nightly
  rollups + typed-array intraday, with no correlation-time advantage.

---

## Settled by the Empirical / Perf Review

- **Per-file size bound — confirmed.** Largest in-scope file is ~4.3 MB observed (15 files
  > 4 MB, none >10 MB); the 38 MB `daily_heart_rate_zones.csv` is **out of scope** and must
  > not be matched by the allowlist (ADR-0005). No streaming-parser contingency exists.
- **Per-file transient — measured ~5.5 MB (1.34×), worst case ~11 MB (2.78×)**, not the
  prior 40–80 MB estimate. Steady-state heap target ≤ 100 MB (256 MB hard ceiling).
- **mtime is unsound for incremental skip** — confirmed (all files share the extraction-date
  mtime); the predicate is `lastIngestedDate` + `{relativePath,size}` (§4a).

## Assumptions to Verify (profiling gates — perf design rev2 §5.0)

- **G1 — in-browser ingest throughput / wall-clock** on a mid-range device, and whether parse
  or per-file FSA I/O dominates (decides single-worker vs HR pool). Wall-clock is unpublished
  until G1.
- **G3 — flat worker heap < 100 MB** across a full synthetic 10 GB-shaped run; tunes
  `MAX_RESIDENT_INTRADAY_NIGHTS`.
- **G4 — `putBatch` batch-write** (tx < 250 ms, total < 30 s); tunes `MAX_PUTS_PER_TX`.
- **G5 — main-thread long-tasks** (none > 50 ms; progress coalesced ~10/s).
- **Typed-array round-trip in IndexedDB** is faster than object arrays — verify during
  drill-down latency profiling (< 100 ms budget).
- **`security-auditor`** confirms the retired `fitbit_tokens` store is actually cleared on
  the v3 migration (no stale encrypted tokens left behind).

---

## References

- [ADR-0003: Replace Fitbit OAuth/API with Local Export Ingestion](0003-replace-fitbit-oauth-with-local-export-ingestion.md)
- [ADR-0005: File Access, Directory-Handle Persistence & Privacy Boundary](0005-wearable-export-file-access-and-privacy-boundary.md)
- [ADR-0006: Wearable↔CPAP Alignment & Correlation Methodology](0006-wearable-cpap-alignment-and-correlation-methodology.md)
- Design: [`design/perf-storage-architecture.md`](../../reports/2026-06-wearable-export-planning/design/perf-storage-architecture.md) (§1–5),
  [`data-catalog.md`](../../reports/2026-06-wearable-export-planning/data-catalog.md) (§2–5),
  [`design/integration-and-ux.md`](../../reports/2026-06-wearable-export-planning/design/integration-and-ux.md) (§0, §4),
  all archived under `docs/developer/reports/2026-06-wearable-export-planning/`.
- The performance/empirical red-team review notes that drove this revision were
  ephemeral working documents and were not retained; their conclusions are folded
  into the archived design docs above and into this ADR's Decision and Consequences.
- Code to reuse/modify: `src/workers/csv.worker.js`, `src/hooks/useCsvFiles.js`,
  `src/utils/fitbitDb.js` (→ `appDb.js`; add `putBatch`), `src/utils/db.js`,
  `src/constants/ui.js` (`FLUSH_INTERVAL_NIGHTS`, `MAX_PUTS_PER_TX`,
  `MAX_RESIDENT_INTRADAY_NIGHTS`).
- Skill: `oscar-web-worker-patterns`.

---

## Approval

**Decision Maker**: Project maintainer
**Recommended Reviewers**: @performance-optimizer, @frontend-developer, @security-auditor, @readiness-reviewer
**Status**: Proposed — awaiting review and acceptance.

---

## Changelog

| Date       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Author          |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| 2026-06-10 | Initial ADR drafted                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | @adr-specialist |
| 2026-06-10 | Revised after **adversarial review 2026-06-10** (perf + empirical red-teams): (a) incremental re-import now `lastIngestedDate` high-water mark + `{relativePath,size}` — **mtime dropped as unsound**; (b) memory overhead corrected to measured **~1.34×** (was 40–80 MB / 10–40×), steady-state ≤ 100 MB target, streaming-parser contingency removed; (c) added the **batched `putBatch`** hard requirement; (d) two-phase ingest order (windows resident, then per-metric per-night with `MAX_RESIDENT_INTRADAY_NIGHTS` eviction) resolving the HR-last/eviction contradiction; (e) realistic ingest **6–20 min** (gated on G1); (f) unified field name **`nightDate`**; (g) referenced binding profiling gates G1/G3/G4/G5. | @adr-specialist |
