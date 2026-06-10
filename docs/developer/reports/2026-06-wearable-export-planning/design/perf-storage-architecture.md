# Performance & Storage Architecture — Google Health (Fitbit) Export Ingestion

**Status:** Design proposal (feeds an ADR). **Rev 2** — revised against measured adversarial review.
**Author role:** performance-optimizer.
**Date:** 2026-06-10 (rev 2 same day).

---

## Revision log (adversarial review)

This revision (rev 2) corrects the rev-1 design against two measured red-team reviews
(`../review/perf-redteam.md`, `../review/empirical-redteam.md`) run against the **real** 10 GB /
32,738-file export. Every change below is grounded in a measurement, not a re-estimate. Constants
and store names are reconciled with **ADR-0004** (authoritative: `wearable_meta`, `appDb.js`,
`nightDate`, per-metric `lastIngestedDate`).

| #   | Finding (sev)                                                           | What changed in rev 2                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | webkitdirectory fallback (was BLOCKER; resolved by maintainer decision) | **v1 is Chromium-only.** File System Access API is the _only_ ingest path. Removed the claim that `<input webkitdirectory>` "fully ingests" 10 GB. Non-Chromium browsers get a clear unsupported empty-state (§1.2). `webkitdirectory` is retained **only** as a possible _future small-import_ path with the eager-FileList OOM caveat stated explicitly — not a v1 path (§1.6).                                                                              |
| 2   | Memory overhead overstated ~8× (MAJOR)                                  | Corrected the per-file transient from "40–80 MB / 10–40×" to the **measured ~5.5 MB (1.34×), worst-case ~11 MB (2.78×)** for the largest real file (4.08–4.28 MB, ~45 k records). Heap headroom under 256 MB is ~25×; budget tightened to a **≤ 100 MB steady-state** target. **Removed the streaming-JSON-parser contingency entirely** — it was built on the wrong constant; per-file `JSON.parse` is correct and faster (§0.2, §1.4).                       |
| 3   | Ingest wall-clock unrealistic (MAJOR)                                   | "~5–8 min" was a native-Node warm-cache _floor_ (parse = 69% of CPU, single-core-bound). Restated as a **realistic in-browser 6–20 min** range over ~18,200 in-scope files (~80% tiny: HRV/HR-zones/SpO2/Temp), with **per-file overhead — not byte-throughput — dominating** the long tail. Single-worker-vs-pool is now explicitly **gated on the G1 browser profile**, not locked prematurely (§0.6, §1.5, §2.6).                                           |
| 4   | IDB batching unspecified, no batch primitive (MAJOR)                    | Specified a concrete **batched-write primitive** (`putBatch`: N puts per `readwrite` transaction, resolve on `transaction.oncomplete`, tuned `MAX_PUTS_PER_TX`). ~16,000 unbatched puts ≈ 16–80 s; batched ≈ a few seconds. Now a **hard requirement** with a code template (§2.3a). Quota math unchanged.                                                                                                                                                     |
| 5   | Eviction aspirational + contradicts HR-last (MAJOR)                     | Resolved the ordering-vs-eviction contradiction. New rule: **per-night-complete grouping within each metric phase** — intraday for a metric is built, flushed, and evicted at that metric's night boundary; nothing is held across phases. HR being ingested last no longer pins all nights' intraday. Concrete `MAX_RESIDENT_INTRADAY_NIGHTS` value, eviction trigger, and a hard "primitives/typed-arrays only, never references into `parsed`" rule (§2.3). |
| 6   | Incremental re-import via mtime is unsound (MAJOR)                      | Every export file shares the extraction-date mtime, and a fresh Takeout rewrites **all** mtimes → mtime forces full re-ingest every time. **Dropped mtime from the skip predicate.** New incremental algorithm uses a per-metric **`lastIngestedDate` high-water mark** + `{ relativePath, size }` identity (§2.5).                                                                                                                                            |
| 7   | keyPath field-name drift (MINOR)                                        | Unified on **`nightDate`** throughout (was `date` / `['date','metric']`), matching ADR-0004 (§3.2, §3.3).                                                                                                                                                                                                                                                                                                                                                      |
| 8   | Profiling gates not binding (MAJOR)                                     | Consolidated the load-bearing gates into a **"must pass before locking the worker model"** list with concrete thresholds (§5.0). Dropped the webkitdirectory benchmark gate (decision made).                                                                                                                                                                                                                                                                   |
| —   | HR file-size bound (MINOR, empirical)                                   | Restated "≤ 4 MB" as **"≤ ~4.3 MB observed (15 files >4 MB, none >10 MB)"**; allowlist must not match the out-of-scope 38 MB `daily_heart_rate_zones.csv` (§1.3, §2.2).                                                                                                                                                                                                                                                                                        |

> **Out of scope for this doc (flagged to other specialists):** the empirical review also found two
> _correctness_ BLOCKER/MAJOR issues — the `UserSleeps start_utc_offset` placeholder (88% `+00:00`,
> primary offset source inverted) and chunk-file `logId` duplicates double-counting ~127 nights.
> Those belong to **ADR-0006 / `data-scientist`**, not the perf/storage layer; noted in §7 so they
> aren't lost, but this revision does not attempt to fix them.

**Scope:** How the OSCAR Export Analyzer (local-first Vite + React SPA, GitHub Pages) reads, streams,
aggregates, persists, and queries a ~10 GB / 32,738-file Google Health export so that wearable data
can be correlated with CPAP nights at **nightly** granularity without ever holding raw data fully
resident in memory or IndexedDB.

**Grounding:** all numbers cite `../data-catalog.md` (§§1–5). Key facts driving every decision:

- Total export **~10 GB, 32,738 files**, 2014–2026.
- **Heart rate is 89 % of the problem:** `Global Export Data/heart_rate-*.json` = **3,541 files,
  ~6.1 GB, ~67 M samples** (catalog §1.1, §3.1). Per-file size ≈ 6.1 GB / 3,541 ≈ **1.7 MB
  average** (measured median 1.13 MB), with 2025+ Pixel-Watch days at ~45 k samples/day pushing the
  largest files to **~4.3 MB observed** (15 files >4 MB, none >10 MB — §1.3).
- After aggregation the entire correlation store is **MBs, not GBs** (~4,300 nights ×
  a few dozen metrics + optional minute-in-night arrays — catalog §3.2, §3 design implication).
- The app correlates at **per-night** granularity (catalog §5), so raw high-frequency series are
  aggregated on ingest and discarded.

This document is the performance/storage counterpart to the catalog's "what" — it specifies the
"how" for: (1) file access & streaming, (2) the ingestion worker pipeline, (3) the IndexedDB
schema, (4) drill-down, and (5) budgets & risks.

---

## 0. Executive recommendations (TL;DR for the ADR)

1. **File access — Chromium-only File System Access API (v1).** `showDirectoryPicker()` → a
   `FileSystemDirectoryHandle` is the **only** ingest path for v1. It is the only API that gives a
   **lazy, re-readable handle** for a 10 GB / 32 k-file tree without eagerly materializing it.
   Handle persistence across sessions is **opt-in only** (ADR-0005). **Non-Chromium browsers
   (Firefox/Safari) are unsupported** — they get a clear empty-state ("Wearable import requires a
   Chromium browser"), not a degraded path. `<input webkitdirectory>` is **not a v1 path** (it
   eagerly materializes all 32,738 `File` objects on the main thread → multi-second freeze / OOM
   risk _before_ the worker starts); it is retained only as a possible _future small-import_
   affordance with that caveat (§1.6).
2. **Parse one file at a time with plain `JSON.parse`; no streaming JSON parser, no contingency.**
   The largest real HR file (4.08–4.28 MB, ~45 k records) parses to a **measured ~5.5 MB transient
   graph (1.34×), worst-case ~11 MB (2.78×)** — _not_ 40–80 MB. Parsed, folded, and discarded
   sequentially, steady-state worker heap targets **≤ 100 MB** (≈ 25× headroom under the old 256 MB
   ceiling). The streaming-JSON-parser contingency from rev 1 is **removed**: it rested on the wrong
   overhead constant, native `JSON.parse` is faster (token-by-token JS is 10–40× slower), and no
   in-scope file is remotely large enough to need it (§1.4).
3. **Ingestion = one dedicated `wearableIngest.worker.js`**, sequential file-by-file, **batched
   incremental flush to IndexedDB**, following the existing `{ workerId, type, ... }` protocol
   (`src/workers/csv.worker.js`). **Single-worker vs. a small HR pool is an open decision gated on
   the G1 browser profile (§5.0)** — not locked here. Measured CPU breakdown is **parse 69% /
   read 29% / fold 2%, single-core-bound**, and there is ~25× heap headroom, so a 2–4 worker HR pool
   is a live option if G1 shows the long-file phase dominates. Whatever the worker count, IndexedDB
   writes go through **one writer** (§2.3a).
4. **IndexedDB: bump `oscar_app` v2 → v3** (per ADR-0004 §3). Add `wearable_nights` (keyPath
   `nightDate`), `wearable_intraday` (keyPath `[nightDate, metric]`, lazy typed arrays), and
   `wearable_meta` (per-metric `lastIngestedDate` high-water mark + `{relativePath,size}` identity
   for incremental re-import; opt-in dir handle). Estimated persisted footprint after aggregation:
   **~15 MB** with minute drill-down (≤ 25 MB worst case), **~4–5 MB** rollups-only (§3.6).
5. **Drill-down — persist intraday at ingest (option a), capped.** Storage cost is small (§3.6) and
   serving a night detail from one `[nightDate, metric]` typed-array read is fast and reload-stable.
   The retained handle is a _secondary, opt-in_ path for raw-resolution detail only (ADR-0005).
6. **Budgets:** ingest is **per-file-overhead-bound for the tiny-file long tail**, not byte-bound;
   realistic **in-browser wall-clock 6–20 min** (unverified until G1 — §5.1), with native-Node floor
   ~3–4 min. Steady-state worker heap **≤ 100 MB** (256 MB hard ceiling); IndexedDB footprint
   **≤ 50 MB**; flush transaction **< 250 ms**; time-to-first-correlation-view after ingest
   **< 500 ms** for a 90-night range.

---

## 1. File access & streaming reads

### 1.1 The only viable browser option at this scale: File System Access API

**Maintainer decision (rev 2): v1 is Chromium-only.** The File System Access API (FSA) is the sole
ingest path. The table below is why `<input webkitdirectory>` is _not_ an acceptable v1 fallback for
a 10 GB / 32,738-file selection — its eager materialization is a load-bearing failure, not a minor
degradation.

| Capability                                          | File System Access API (v1 path)                                           | `<input webkitdirectory>` (rejected for v1)                                                                                                             |
| --------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pick a whole directory                              | `showDirectoryPicker()`                                                    | `<input type="file" webkitdirectory>`                                                                                                                   |
| Returns                                             | live `FileSystemDirectoryHandle` (**lazy** tree)                           | flat `FileList` — **all 32,738 `File` objects materialized synchronously on the main thread up front**, each with `webkitRelativePath`                  |
| Cost at selection time                              | one user gesture; tree walked lazily on demand                             | **synchronous main-thread freeze / OOM risk** for a 10 GB / 32 k-file tree _before any JS runs_ — the most likely hard failure (perf-redteam Finding 7) |
| Lazy enumeration (don't materialize 32 k entries)   | ✅ async iterate `handle.values()` per subdir                              | ❌ eager; no lazy mode                                                                                                                                  |
| **Re-read a file later** (drill-down / incremental) | ✅ handle re-opens files on demand                                         | ❌ `File` snapshots die on reload; no re-read without re-picking 10 GB                                                                                  |
| **Persist across sessions**                         | ✅ store the handle in IndexedDB (opt-in — ADR-0005)                       | ❌ nothing persists                                                                                                                                     |
| Browser support (2026)                              | Chromium (Chrome/Edge/Brave/Opera) ✅; **Safari & Firefox: not supported** | ✅ all evergreen browsers — but irrelevant given the eager-materialization failure                                                                      |
| GitHub Pages (HTTPS)                                | ✅ works (secure context; Pages is HTTPS)                                  | ✅ works                                                                                                                                                |

Confirm `showDirectoryPicker` Baseline status at implementation time via the docs MCP
(`resolve-library-id` / `query-docs` for "File System Access API"); it remains **Chromium-only** as
of this writing.

### 1.2 v1 ingest path and the non-Chromium empty-state

- **The path (Chromium):** `showDirectoryPicker({ mode: 'read' })` behind an explicit user gesture.
  All enumeration and reading happen **lazily inside the worker** via the handle — we never
  materialize the tree. Handle _persistence_ across sessions is **opt-in only** (ADR-0005, key
  `dirHandle` in `wearable_meta`); the default is a fresh pick per session. When persisted and a
  later visit finds permission not `'granted'`, prompt `handle.requestPermission({ mode: 'read' })`
  behind a "Reconnect export folder" button.
- **Non-Chromium browsers (Firefox/Safari):** **unsupported empty-state.** Capability detection is
  `if (!('showDirectoryPicker' in window)) → render the unsupported card` ("Wearable export import
  requires a Chromium-based browser (Chrome, Edge, Brave, Opera). Your CPAP analysis features are
  unaffected."). There is **no** `webkitdirectory` ingest fallback in v1 — see §1.6 for why and for
  the only future role `webkitdirectory` might play. `ux-designer` owns the empty-state copy/layout.
- **Hook shape:** a single `useWearableDirectory` hook exposes `pickDirectory()`, `isSupported`,
  and the worker-side `enumerate()` / `readFile(relativePath)` interface, mirroring how
  `useCsvFiles` abstracts file input today (`src/hooks/useCsvFiles.js`, `extractFirstFile`). Because
  there is only one ingest path, the hook does not need to abstract over two backends.

> **Worker note:** `FileSystemDirectoryHandle` is **structured-cloneable and transferable to a
> Worker**. We pass the _directory handle_ (one cheap clone) into `wearableIngest.worker.js` and do
> all enumeration + reading inside the worker, keeping the main thread free. This matches the
> existing pattern where `csv.worker.js` receives the work item directly
> (`worker.postMessage({ workerId, … })`). We do **not** clone any large `File[]` across the
> boundary (that was a `webkitdirectory`-only cost, now moot).

### 1.3 Streaming individual large files

For each file the worker calls `await (await handle.getFile()).text()`. `Blob.text()` reads the whole
file into a string; for our HR files that is a single bounded string (HR per-file: median **1.13 MB**,
max **~4.3 MB observed** — 15 files exceed 4 MB, none exceed 10 MB, per empirical-redteam), immediately
handed to `JSON.parse`. We do **not** need `file.stream()` chunking for any v1 file: no in-scope file
is large, and even the worst case parses to a few MB of transient graph (§1.4).

> **Allowlist precision (empirical-redteam):** the single largest file in the entire export is the
> **38 MB out-of-scope `daily_heart_rate_zones.csv`** (pseudo-JSON cells that throw on `JSON.parse`).
> A loose `*heart_rate*` glob would match it and both blow a parse budget and crash. The enumeration
> allowlist (§2.2) must match the canonical sources by exact prefix/dir, never a loose glob.

`file.stream()` / `ReadableStream` is **not** used — there is no large-file case in v1 and no
streaming contingency (rev 2 removed it; §1.4). The Google CSV trees
(`Physical Activity_GoogleData`, etc.) are explicitly **de-duplicated / ignored** per catalog §2/§5,
so the 2.2 GB CSV HR mirror is never read.

### 1.4 Memory math: measured per-file transient (rev 2 — corrected ~8×)

Per HR file (`heart_rate-*.json`): array of
`{ "dateTime": "MM/DD/YY HH:MM:SS", "value": { "bpm": <int>, "confidence": <0..3> } }`
(catalog §1.1). Worst case ~45 k records (2025 Pixel-Watch day; the largest real file is 4.08 MB /
44,879 records).

Rev 1 claimed "~40–80 MB transient / 10–40× overhead." That was **wrong, overstated ~8×.** The
adversarial reviewer parsed the _actual largest_ HR file and measured the retained graph with parse
scratch collected (perf-redteam Finding 1):

| Quantity                                                      | Measured                     |
| ------------------------------------------------------------- | ---------------------------- |
| Raw file text                                                 | 4.08 MB                      |
| **Retained parsed graph** (`heapUsed` delta)                  | **5.48 MB → 1.34× the file** |
| **Pessimal worst case** (unique unshared strings + float bpm) | **11.35 MB → 2.78×**         |

Why so compact: this array-of-uniform-small-objects is the _best_ case for modern V8 — one hidden
class shared across all 45 k identically-shaped records, `bpm`/`confidence` as SMIs (no boxing),
short `dateTime` strings, pointer compression, in-object properties.

- **Lifecycle:** parse → fold primitives into accumulators → `parsed = null` → next file. Only
  **one** file's graph is live at a time. Peak heap ≈ one file's graph (~5–11 MB) + ~4 MB resident
  rollups + ≤ `MAX_RESIDENT_INTRADAY_NIGHTS` intraday + write buffer. Yield a microtask
  (`await Promise.resolve()`) between files so V8 GC can reclaim the prior graph.
- **Budget impact:** steady-state heap targets **≤ 100 MB**, with the 256 MB ceiling now ~25×
  headroom rather than ~3×. That headroom is _real budget_ the design can spend on **parallelism**
  (an HR worker pool — §2.6) or larger flush batches, not a phantom constraint. The tightened
  ≤ 100 MB target also exposes the _real_ heap risk — accumulator retention (§2.3) — instead of
  hiding it behind a too-loose ceiling.

**Verdict: plain `JSON.parse` per file, sequential, is correct, sufficient, and faster.** The
streaming-JSON-parser contingency from rev 1 is **removed entirely** (not merely re-thresholded):

- it was derived from the wrong overhead constant (the bogus 64 MB-graph trigger would need a
  ~24–48 MB _file_, none of which exist; max file is ~4.3 MB → ~6–12 MB graph);
- a streaming parser (oboe.js / clarinet / `@streamparser/json`) runs **10–40× slower** than native
  `JSON.parse` (token-by-token JS vs C++) and adds bundle weight against the ≤ 500 KB JS budget;
- it could only ever matter if a single file couldn't fit in heap — which cannot happen here.

The "streaming" in this architecture is at **file granularity** (stream the _sequence_ of files),
never within a file.

### 1.5 Sequential cost — realistic range (rev 2 — corrected from a Node floor)

Rev 1 claimed "~5–8 min." That figure was a **native-Node, warm-cache, single-thread floor**, not a
browser number, and it reasoned about byte-throughput while the real cost for ~80% of in-scope files
is **per-file overhead**, not bytes.

**What was measured (Node, warm cache — a floor, not the browser):**

| Probe                                     | Result                                                                                                      |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 300 densest HR files (1.05 GB) sequential | 98 MB/s effective; split **read 29% / parse 69% / fold 2%**                                                 |
| Largest HR file parse+fold                | 32–42 ms; 98–125 MB/s native                                                                                |
| Disk read (cold-ish, 500 files / 1.19 GB) | ~890 MB/s → **I/O is not the bottleneck**                                                                   |
| Tiny HRV CSV (5,885 files, avg 1,705 B)   | 174 µs/file warm — pure per-file fixed cost                                                                 |
| In-scope file count                       | **~18,200 files** (3,541 HR + 3,541 HR-zones + 1,911 SpO2 + 5,885 HRV + 1,884 Temp + 519 snore + ~900 misc) |

**Why the long tail dominates, and why byte-throughput framing is misleading:** ~80% of in-scope
_files_ are tiny (HRV / HR-zones / SpO2 / Temp), so wall-clock is governed by **fixed per-file
overhead × 18,200**, not 6.5 GB ÷ throughput. In Node that overhead is ~174 µs/file (~3.2 s total);
in the browser, FSA `getFile()` → `Blob` → `text()` per file is commonly **3–10× higher**, so a
plausible **13–28 s of pure per-file overhead before any parse**, dominated by the ~14,700 tiny
non-HR files. Parse itself (69% of CPU on the dense HR slice) is **single-core-bound**.

**Realistic in-browser range (pending the G1 gate, §5.0):**

- **Native-Node floor:** ~3–4 min (HR ≈ 2 min by file count + rest).
- **In-browser single worker:** **6–20 min**, depending on FSA per-file cost and device; worse on a
  mid-range Windows laptop (slower disk, ~2× slower single core) or with a backgrounded tab
  (throttled to ~1 callback/s). The rev-1 "~5 min" target is optimistic for the median user.

**This is unverified in-browser** and is the headline number gated on G1 (§5.0). Do not publish a
wall-clock without a device caveat until G1 runs. The single-worker-vs-pool decision rests on the
_same_ missing browser profile (§2.6) — we do not lock single-worker here.

### 1.6 `<input webkitdirectory>` is not a v1 path (future small-import only)

`webkitdirectory` is **explicitly excluded from v1**. For a full 10 GB / 32,738-file selection it
does not give a lazy handle: on `change` the browser **synchronously materializes a `FileList` of
all 32,738 `File` objects on the main thread, before your JS gets control** — a credible
multi-second freeze or tab OOM at selection time, on exactly the Firefox/Safari browsers a fallback
would target (perf-redteam Finding 7). There is no evidence it survives at this scale, and the
failure happens _before_ the worker is even created, so none of the off-thread reasoning applies.

**Possible future role (not v1):** if we later add a **small, bounded import** (e.g. a single
metric subfolder, or a months-scoped slice well under ~1 GB / a few thousand files),
`webkitdirectory` could provide a non-Chromium path for _that narrow case only_. Even then it
carries the **eager-FileList OOM caveat**: the import would need a hard file-count/byte cap enforced
_before_ the picker, a documented unsupported threshold, and the `FileList` must be iterated on the
main thread one `File` at a time (never structured-cloned as a `File[]` into the worker). This is a
deferred idea, not a committed path.

---

## 2. Ingestion pipeline architecture

### 2.1 Component overview

```
Main thread (React)                         Worker: wearableIngest.worker.js
─────────────────                            ───────────────────────────────
useWearableDirectory / useWearableIngest     1. enumerate() in-scope files (catalog §5 allowlist),
  ├─ pickDirectory() (FSA, Chromium only)        lazily via handle.values(); build a work plan
  ├─ postMessage({type:'start', dirHandle,        grouped BY METRIC PHASE, then BY NIGHT
  │               meta})                       2. for each metric phase, for each night (in date
  ├─ onmessage:                                    order), for each file of that night (sequential):
  │    'progress'  → update progress bar           a. read file (await handle.getFile()).text()
  │    'flush'     → (optional ack)                b. parse (JSON.parse | Papa.parse)
  │    'complete'  → mark import done              c. normalize datetime (per-source format map)
  │    'error'     → surface sanitized msg         d. fold rows → night rollup + night intraday (RAM)
  └─ cancel() → worker.terminate()                 e. apply validity filters (SpO2 50.0, etc.)
                                              3. at each night boundary within a phase: stage the
                                                 night's intraday for batched flush; once the flush
                                                 buffer reaches MAX_PUTS_PER_TX or the phase ends,
                                                 putBatch() one tx, then EVICT flushed intraday
                                              4. update wearable_meta high-water marks + ranges
                                              5. postMessage({type:'complete', stats})
```

This mirrors the existing single-purpose worker style (`csv.worker.js`, `analytics.worker.js`) and
the hook coordinator style (`useCsvFiles.js`, `useAnalyticsWorker.js`): a `useWearableIngest` hook
owns worker lifecycle, `workerId` tagging, cancellation via `terminate()`, and abort-signal cleanup
exactly as `useCsvFiles.handleFile` does.

### 2.2 File enumeration & the work plan

In-scope files only (catalog §5 MUST-HAVE; never the `_GoogleData` duplicate trees — catalog §2,
§4 gotcha #10). The worker walks the directory and selects by prefix/dir:

- `Global Export Data/heart_rate-*.json`, `resting_heart_rate-*.json`,
  `time_in_heart_rate_zones-*.json`, `sleep-*.json`, daily-rollup JSONs
  (`steps/active_minutes/sedentary_minutes`).
- `Oxygen Saturation (SpO2)/Minute SpO2 - *.csv` + `Daily SpO2 - *.csv`.
- `Heart Rate Variability/{Details, Daily … Summary, Respiratory Rate Summary}`.
- `Snore and Noise Detect/Snore Details - *.csv`.
- `Daily Readiness/*`, `Stress Score/Stress Score.csv`, `Sleep Score/sleep_score.csv`,
  `Health Fitness Data_GoogleData/UserSleeps_*` (TZ offsets only — catalog §3b),
  `Temperature/Computed Temperature` + `body_temperature_*`, `Active Zone Minutes (AZM)/*`.

**Explicitly skipped:** PII dirs (`Your Profile`, demographics), GPS/`live_pace`, glucose (empty),
the entire `Physical Activity_GoogleData` raw-duplicate tree, social/account/commerce (catalog §5
DEFER/IGNORE). Skipping the 2.2 GB CSV HR mirror and 3.3 GB GoogleData tree is itself a major perf
win — we read ~6.5 GB in-scope of the 10 GB.

**Processing order — two-phase, then per-night within each metric phase (rev 2).** The order must
satisfy two constraints that rev 1 left in conflict: (i) sleep windows/offsets must be resolved
**before** any high-frequency series is bucketed (catalog §4 gotcha #2 — the biggest correctness
risk), and (ii) intraday memory must stay bounded even though HR is the last and biggest phase.

**Phase A — windows first (cheap, fully resident).** Ingest `UserSleeps_*` (offset hints) →
`sleep-*.json` → `sleep_score.csv` → daily-rollup metrics. This populates the **night-window index**
`Map<nightDate, {window, offset, …}>` and the ~4 MB rollup `Map`, both of which stay resident for
the whole ingest (they are small — §2.3). No large intraday is produced here.

**Phase B — high-frequency series, one metric at a time, evicting per night.** For each
high-frequency metric **in its own phase** (`SpO2 → HRV → snore → HR last`), process that metric's
files **grouped by night, in date order**. Because the night windows from Phase A are already
resident, each night's samples are bucketed immediately into (a) the resident rollup fields and
(b) a _per-night intraday typed array_ for that one metric. As soon as a night's intraday for the
current metric is complete, it is staged for the next batched flush and **evicted** (§2.3).

This **resolves the rev-1 contradiction** ("HR ingested last" vs "evict a night's intraday
per-file"): we never hold a night's intraday across metric phases. Within a phase, a night's
intraday for _that metric_ is built, flushed, and dropped at the night boundary; HR being last is
fine because by then every prior metric's intraday is already persisted and gone. Resident memory is
therefore bounded by **window index + rollups + at most `MAX_RESIDENT_INTRADAY_NIGHTS` nights of a
single metric's intraday + one file's parse graph + the flush buffer** — independent of total export
size and independent of which metric is being processed.

### 2.3 Accumulators, eviction, and the resident-memory bound (rev 2)

Two accumulators, with different lifetimes:

- **Rollup accumulator + window index — resident for the whole ingest.** A
  `Map<nightDate, NightRollup>` plus the Phase-A `Map<nightDate, window>`. Each `NightRollup` is a
  small fixed-shape object (a few dozen numeric fields + small zone arrays); 4,300 nights × ~1 KB ≈
  **~4 MB** — trivially resident in full. We still flush rollups in batches for durability/resume.
- **Intraday accumulator — bounded, evicted per night within a metric phase.** This is the
  memory-sensitive part and where rev 1 was hand-wavy. Concrete rules:
  - **`MAX_RESIDENT_INTRADAY_NIGHTS = 64`** (constant in `src/constants/ui.js`). At most 64 nights of
    _one metric's_ downsampled typed arrays are live at once. A night of 1-min HR is ~600 `Int16`
    samples ≈ 1.2 KB, so 64 nights ≈ **~80 KB** per metric — negligible, but the bound makes the
    invariant explicit and tunable by G3 (§5.0).
  - **Eviction trigger:** as soon as a night's intraday for the current metric is complete (the
    night-boundary in the date-ordered, per-metric Phase-B walk — §2.2), it is appended to the flush
    buffer. When the buffer reaches `MAX_PUTS_PER_TX` (or the metric phase ends), `putBatch()` writes
    it in one transaction (§2.3a) and the staged arrays are **dropped** (`delete`d from the buffer;
    no reference retained). This is the actual eviction mechanism — there was none in rev 1.
  - **Hard anti-leak rule:** accumulators store **only primitives and freshly-allocated typed
    arrays — never a reference into the `parsed` object graph.** Folding copies out numbers (e.g.
    `rollup.hr.max = Math.max(rollup.hr.max, rec.value.bpm)`); it must never do
    `rollup.window = parsed[0].value`, which would pin the whole ~5–11 MB parse graph per night and
    is the real OOM path (perf-redteam Finding 5). G3 asserts a flat heap to catch a violation.
- **Resident-memory invariant (the bound):**
  `heap ≈ one file's parse graph (~5–11 MB) + ~4 MB rollups + window index + ≤ 64 nights of one
metric's intraday (~tens of KB) + flush buffer (≤ MAX_PUTS_PER_TX records)` — **independent of
  total export size and of which metric is processing.** Steady-state target ≤ 100 MB (§5.1).

### 2.3a Batched IndexedDB write primitive (rev 2 — hard requirement)

The existing code (`fitbitDb.js`) does **one `put` per transaction everywhere** — the exact slow
anti-pattern this design must avoid. There is **no** batch helper to "follow," so we specify one as a
hard requirement, not prose. Unbatched, ~16,000 puts (≈4,300 nights + ≈12,000 intraday blobs) at
1–5 ms commit-overhead each ≈ **16–80 s**. Batched into ~145 transactions of ~110 puts each,
overhead amortizes to a few seconds (perf-redteam Finding 3).

**Primitive: `putBatch(db, items)`** — issue all `put`s without awaiting each, resolve on
`transaction.oncomplete` (the commit), never per-request:

```js
// src/utils/appDb.js — NEW. One readwrite tx spanning both wearable stores.
// items: Array<{ store: 'wearable_nights' | 'wearable_intraday', value: object }>
export function putBatch(db, items) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(
      ['wearable_nights', 'wearable_intraday'],
      'readwrite',
    );
    tx.oncomplete = () => resolve(items.length); // resolve on COMMIT, not per-put
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('putBatch aborted'));
    // Cache store handles once; fire all puts synchronously, do NOT await onsuccess per put.
    const stores = {
      wearable_nights: tx.objectStore('wearable_nights'),
      wearable_intraday: tx.objectStore('wearable_intraday'),
    };
    for (const { store, value } of items) stores[store].put(value);
    // Typed-array (ArrayBuffer) values are stored via structured clone — no JSON.stringify.
  });
}
```

- **`MAX_PUTS_PER_TX`** (new constant, `src/constants/ui.js`; start ~110, **tuned by G4 §5.0**) caps
  one transaction; `FLUSH_INTERVAL_NIGHTS` (~30) governs how often Phase-A rollups flush for
  durability. A flush assembles up to `MAX_PUTS_PER_TX` staged records (nights + intraday) and calls
  `putBatch` once.
- **One writer.** Even if G1 justifies an HR worker pool (§2.6), all `putBatch` calls go through the
  single ingest worker that owns the cursor — parse fans out, writes do not.
- **Transactional durability:** because each flush is one committed transaction, a `terminate()`
  mid-ingest leaves IndexedDB at the last committed batch — no partial-night corruption.

### 2.4 Progress reporting protocol

Follow the existing `{ workerId, type, ... }` convention (`csv.worker.js`):

```js
// worker → main
{ workerId, type: 'progress', phase: 'heart_rate',
  filesDone: 1820, filesTotal: 3541, bytesDone, bytesTotal,
  nightsCommitted: 1290 }
{ workerId, type: 'flush', nightsCommitted: 1320 }       // optional durability ack
{ workerId, type: 'warning', code: 'spo2_sentinel_skipped', count }  // throttled
{ workerId, type: 'complete', stats: { nights, dateRange, perMetricCounts } }
{ workerId, type: 'error', error: '<sanitized>' }        // reuse sanitizeErrorMessage pattern
```

Progress is **two-dimensional**: overall `bytesDone/bytesTotal` (smooth bar) + per-phase
`filesDone/filesTotal` (so the UI can say "Heart rate 1,820 / 3,541 files"). Warnings (SpO2 50.0
floor drops, classic-sleep degraded nights, unparseable rows) are **throttled/counted**, not emitted
per-row — the codebase already throttles quantile warnings (recent commit `49bf2e1`), follow that.

Throttle progress messages to ~10/s (e.g. post on file boundary but coalesce) to avoid flooding the
main thread; `postMessage` of a tiny progress object is cheap but 32 k of them would jank React.

### 2.5 Cancellation & resume

- **Cancel:** `useWearableIngest` calls `worker.terminate()` (same as `useCsvFiles.cancelTask`).
  Because flushes are transactional (§2.3a), IndexedDB is left at the last committed batch — no
  corruption.
- **Resume:** `wearable_meta` stores `{ cursor: { phase, metric, lastCommittedNight } }`. On restart
  the worker resumes at the current metric phase and skips nights already committed. Combined with
  the (opt-in) persisted dir handle, a cancelled long ingest resumes rather than restarting.

#### Incremental re-import — `lastIngestedDate` high-water mark, NOT mtime (rev 2)

Rev 1 (and ADR-0004's "manifest mtimes/sizes" wording) keyed the skip predicate on
`lastModified`. **The empirical review proved that unsound:** every export file shares a single
**extraction-date mtime** (e.g. all `2026-06-09`), regardless of content age, because Takeout +
unzip stamp the extraction time. A user's realistic workflow — re-download a fresh Takeout every
few months and re-point the app — produces an export where **all** files have new mtimes, so an
mtime predicate would force a **full re-ingest every time**; the "only the new tail" benefit never
materializes (empirical-redteam Finding 6).

**New skip predicate (mtime dropped entirely):**

1. **Authority = per-metric `lastIngestedDate` high-water mark** stored in `wearable_meta` (already
   in ADR-0004's schema). For each metric, it records the most recent `nightDate` whose rollup is
   committed. On re-import, a file whose date range is **entirely ≤ that metric's
   `lastIngestedDate`** is a candidate to skip.
2. **Identity guard = `{ relativePath, size }`** (no mtime). A candidate file is skipped **only if**
   a `wearable_meta.files` entry with the same `relativePath` records the same `size` — byte size of
   already-ingested historical months is stable across re-exports, so unchanged old files match and
   are skipped; a changed/extended file (different size) or a new path falls through to re-ingest.
3. **Otherwise re-read.** New nights (date > high-water mark), changed-size files, and new paths are
   ingested; their nights overwrite by `nightDate` keyPath (idempotent — last-writer-wins, which
   also tolerates the chunk-file `logId` duplication once dedup lands in ADR-0006).

This makes the common "fresh Takeout every few months" re-import cheap (only the new tail of nights
is processed) **without** trusting mtime at all. ADR-0004's "mtimes/sizes" wording should be
corrected to "size + path + per-metric `lastIngestedDate`" (flagged in §7).

### 2.6 One worker vs a pool — **open, gated on G1** (rev 2)

Rev 1 locked "one ingest worker for v1." Rev 2 does **not** lock this — the decision depends on the
G1 browser profile that does not yet exist, and the two facts that drove "single worker" have both
shifted:

- **Parse is 69% of wall time and single-core-bound** (measured). A single worker leaves N−1 cores
  idle during the dominant phase.
- **Heap headroom is ~25×, not ~3×** (Finding 1 corrected). The memory argument against parallelism
  is largely gone; several files' parse graphs fit easily.
- HR files **partition cleanly by night** (no cross-file dependency), so a pool is straightforward.

So the realistic options are:

1. **Single worker** — simplest; the cursor/eviction logic in §2.2–§2.3 assumes it. May be adequate
   if G1 shows per-file FSA overhead (not parse) dominates — in which case more parse workers don't
   help, because the bottleneck is serialized `getFile()`/`text()`.
2. **Small HR pool (2–4 workers)** — parse fans out across cores; each worker emits _partial
   per-night HR rollups + per-night intraday typed arrays_ via `postMessage` to the **single writer**
   worker, which merges and `putBatch`es (§2.3a). Could cut the parse-dominated HR phase ~2–4×. Adds
   merge + back-pressure complexity but **writes stay single-writer**, so the cursor/eviction model
   is preserved.

**Decision rule (binding):** measure G1 first (§5.0). If parse dominates and cores are idle → pool;
if per-file FSA I/O dominates → single worker (a pool won't help). **Do not assert a wall-clock or
lock the worker count before G1.** Whatever the choice, IndexedDB writes go through one writer.

---

## 3. IndexedDB schema design

### 3.1 Migration: `oscar_app` v2 → v3

Current DB (`src/utils/fitbitDb.js`): `oscar_app` **v2** with stores `sessions`, `fitbit_tokens`,
`fitbit_data`, `sync_metadata`. Per **ADR-0004 §3**, generalize `fitbitDb.js` → **`appDb.js`**
(`openAppDb()`; re-point `utils/db.js`; the CPAP session API stays byte-for-byte identical).

Bump `DB_VERSION = 3` and, in one `onupgradeneeded` branching on `event.oldVersion < 3`:
**preserve** `sessions` (CPAP — never touched), **drop** the OAuth-era stores
`fitbit_tokens`/`fitbit_data`/`sync_metadata` (no migration — old encrypted API blobs aren't
re-derivable into the nightly schema; the user re-ingests; call out the one-time wearable reset in
the CHANGELOG, CPAP unaffected), and **add** the three wearable stores below.
`security-auditor` confirms the retired `fitbit_tokens` store is actually cleared on migration (no
stale encrypted tokens left behind). This matches ADR-0004 exactly (rev 1 had said "left in place";
rev 2 aligns with the ADR's destructive-drop decision).

### 3.2 Store A — `wearable_nights` (per-night rollups)

```js
db.createObjectStore('wearable_nights', { keyPath: 'nightDate' }); // 'YYYY-MM-DD'
// keyPath IS the night date → range queries are native via IDBKeyRange.bound(start, end)
// no separate index needed for the primary correlation query
```

Record shape (one per night, ~4,300 total):

```jsonc
{
  "nightDate": "2024-02-22",     // dateOfSleep, the join key to a CPAP night (catalog §3b)
  "logId": 44632289206,          // sleep-*.json logId (joins sleep_score), nullable
  "schemaVersion": 3,
  "window": { "startMs": 0, "endMs": 0, "utcOffsetMin": -480 }, // resolved offset (catalog §3b/§4)
  "sleep": { "type": "stages", "efficiency": 93, "minutesAsleep": 529,
             "stageMinutes": { "deep": 56, "light": 0, "rem": 0, "wake": 89 },
             "score": 0, "waso": 0 },
  "hr":   { "min": 0, "avg": 0, "max": 0, "sleepingMean": 0, "resting": 0,
            "zonesMin": { "below": 0, "z1": 0, "z2": 0, "z3": 0 } },
  "spo2": { "mean": 0, "min": 0, "pctBelow90": 0, "validMinutes": 0 }, // post-50.0 filter (§4 #3)
  "hrv":  { "rmssd": 0, "nremhr": 0, "entropy": 0 },
  "resp": { "overall": 0, "deep": 0, "light": 0, "rem": 0 },          // breaths/min (§4 #8)
  "snore": { "snoreMinutes": 0, "meanDba": 0, "maxDba": 0 },
  "temp": { "skinDeviation": 0 },
  "readiness": { "score": 0, "state": "MED", "subcomponents": {...} },
  "stress": { "score": 0, "components": {...} },
  "activity": { "steps": 0, "azm": 0, "activeMinutes": 0 },
  "flags": { "classicSleep": false, "nap": false, "partial": false },
  "intradayMetrics": ["hr", "spo2", "hrv", "snore"]  // which drill-down arrays exist for this night
}
```

- **Query pattern (correlation views):** "load N nights by date range" =
  `store.getAll(IDBKeyRange.bound(startDate, endDate))` on the keyPath — O(log n) seek + sequential
  scan, returns ≤ a few hundred ~1 KB records in **single-digit ms**. This is the hot path for the
  CPAP×wearable correlation charts; it must be fast and it is, because the key _is_ the date.
- One self-contained record per night means the correlation view does **one** store read, no joins.

### 3.3 Store B — `wearable_intraday` (lazy drill-down arrays)

```js
const s = db.createObjectStore('wearable_intraday', {
  keyPath: ['nightDate', 'metric'],
});
// compound key [nightDate, metric] → fetch exactly one metric's array for one night on demand
```

Record shape:

```jsonc
{
  "nightDate": "2024-02-22",
  "metric": "hr",            // 'hr' | 'spo2' | 'hrv' | 'snore' | 'sleepStages'
  "cadenceSec": 60,          // downsample cadence: HR→60s, SpO2→60s, HRV→300s, snore→30s
  "t0Ms": 0,                 // window start; samples are offset-from-t0 to shrink payload
  "values": Int16Array | Float32Array  // TYPED ARRAY (stored as ArrayBuffer) — compact + fast
}
```

- **Typed arrays, not arrays of objects.** A night of 1-minute HR ≈ 480–600 samples; as
  `Int16Array` that's ~1.2 KB vs ~15 KB as JSON objects. IndexedDB stores `ArrayBuffer`/typed
  arrays natively via structured clone — no JSON.stringify. This is the single biggest storage and
  parse-on-read win for drill-down.
- HR raw is ~2–5 s cadence; **downsample to 1-minute-within-night on ingest** (catalog §3.2) →
  ~600 samples/night instead of ~30 k. SpO2 stays per-minute (already), HRV per-5-min, snore
  per-30-s (catalog §3.2).
- **Lazy:** only fetched when a user opens a night's detail view (§4). Never loaded by the
  correlation list.

### 3.4 Store C — `wearable_meta` (ingest metadata + opt-in dir handle)

Per ADR-0004 §3 this store is named **`wearable_meta`** (rev 1 called it
`wearable_import_manifest`; same role, ADR name adopted).

```js
const m = db.createObjectStore('wearable_meta', { keyPath: 'key' });
```

Records (key/value style, like the old `sync_metadata` store):

| key                | value                                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `dirHandle`        | the persisted `FileSystemDirectoryHandle` — **opt-in only** (ADR-0005); absent by default                                            |
| `files`            | `Map`/array of `{ relativePath, size, metric, status }` → incremental skip (**no `lastModified` — mtime is unsound, §2.5**) + resume |
| `lastIngestedDate` | **per-metric high-water mark** (`{ [metric]: 'YYYY-MM-DD' }`) → the authority for incremental skip (§2.5)                            |
| `cursor`           | `{ phase, metric, lastCommittedNight }` → resume after cancel (§2.5)                                                                 |
| `ranges`           | `{ overallStart, overallEnd, perMetricRanges }` → UI summary, gap detection                                                          |
| `schemaVersions`   | per-source schema version seen (catalog §4 #9 drift: classic vs stages, SpO2 README mismatch)                                        |
| `stats`            | counts (nights, samples aggregated, sentinel drops) for the import summary card                                                      |

`security-auditor` note: the (opt-in) `dirHandle` is a privacy-relevant artifact — gate it behind
explicit opt-in + reconnect UI and offer a "Forget folder" action that deletes the handle
(analogous to existing `clearFitbitData`). Persistence governed by ADR-0005.

### 3.5 Without a persisted handle (default, and every re-visit until opt-in)

Because handle persistence is opt-in (ADR-0005) and v1 is Chromium-only (§1.2), the _default_
re-visit has no `dirHandle`: drill-down is served from `wearable_intraday` (persist-at-ingest, which
is the primary path anyway — §4), and incremental re-import simply asks the user to re-pick the
folder, after which the `lastIngestedDate` + `{relativePath,size}` predicate (§2.5) still skips
unchanged nights. Everything else is identical whether or not the handle was persisted.

### 3.6 Persisted-size estimate

| Store                                         | Per-night | Nights                 | Total                              |
| --------------------------------------------- | --------- | ---------------------- | ---------------------------------- |
| `wearable_nights` (rollups)                   | ~1 KB     | ~4,300                 | **~4 MB**                          |
| `wearable_intraday` HR (Int16, 600/night)     | ~1.2 KB   | ~3,500 (HR-era nights) | ~4.2 MB                            |
| `wearable_intraday` SpO2 (Int16, ~500/night)  | ~1 KB     | ~1,900 (SpO2-era)      | ~1.9 MB                            |
| `wearable_intraday` HRV (Float32, ~100/night) | ~0.4 KB   | ~1,900                 | ~0.8 MB                            |
| `wearable_intraday` snore (Int16, ~900/night) | ~1.8 KB   | ~500                   | ~0.9 MB                            |
| `wearable_intraday` sleepStages (segments)    | ~0.5 KB   | ~4,300                 | ~2.2 MB                            |
| `wearable_meta`                               | —         | —                      | < 1 MB                             |
| **Total (with full drill-down)**              |           |                        | **~15 MB** (≤ 25 MB with overhead) |
| **Rollups-only (no intraday)**                |           |                        | **~4–5 MB**                        |

This validates catalog §3's "MBs not GBs" claim: we compress **10 GB on disk → ~15 MB persisted**,
a ~600× reduction, by aggregating and discarding raw samples. Well within the **≤ 50 MB** budget and
far below browser IndexedDB quotas (typically hundreds of MB to GBs).

---

## 4. Drill-down strategy

**Question:** when the user opens one night's detail (hypnogram, per-minute SpO2/HR/HRV/snore), do
we (a) persist intraday arrays at ingest, or (b) keep the dir handle and re-read+re-aggregate that
night's source files on demand?

|                    | (a) Persist intraday at ingest                                      | (b) Re-read source on demand                                                                                                 |
| ------------------ | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Storage cost       | ~10–15 MB extra (§3.6) — cheap                                      | ~0                                                                                                                           |
| Open-night latency | **fast**: one `[nightDate, metric]` IDB read, typed array, ~5–20 ms | **slow + variable**: re-scan that night's HR file(s) (~1.7 MB+), re-parse, re-window — 200 ms–2 s; HR night may span 2 files |
| Availability       | **always works** (survives reload; no handle needed)                | only with an opt-in-persisted FSA handle still permission-granted; breaks after permission revoke or if folder moved/deleted |
| Privacy surface    | data already in IDB (same as rollups)                               | requires a live filesystem handle retained indefinitely (opt-in — ADR-0005)                                                  |
| Complexity         | aggregate-and-store once                                            | per-night re-derivation path + permission re-prompt UX on the critical path                                                  |

**Recommendation: (a) persist intraday at ingest, as the default and primary path.** The storage
cost is small (§3.6), latency is consistently low, and it survives reload with no handle. Because
handle persistence is opt-in (ADR-0005), path (b) isn't even available by default — making (a) the
only consistently-available drill-down source. Putting an FSA re-permission prompt on the critical
path of "open this night" is poor UX and unreliable.

**Hybrid nuance:** keep the dir handle (FSA) as a _secondary, opt-in_ path for **raw-resolution**
drill-down (the full 2–5 s HR trace, or a metric we deliberately did **not** pre-aggregate to save
space). UI: night detail loads instantly from persisted 1-min arrays; an optional "Load full
resolution" affordance re-reads the source file via the handle when available. This gives fast
common-case + lossless deep-dive without bloating IDB with 30 k-sample raw HR per night.

To bound storage, make intraday persistence **configurable**: default-on for SpO2/HR/HRV/snore/
stages; allow a "rollups-only" mode (≤ 5 MB) for storage-constrained users, who then rely on path
(b) for any drill-down (requires the opt-in persisted handle).

---

## 5. Performance budgets & risks

### 5.0 Binding profiling gates — **must pass before locking the worker model** (rev 2)

Rev 1 listed profiling as _follow-up during implementation_. That is backwards for the load-bearing
claims: the wall-clock, the single-worker-vs-pool choice, the heap bound, and the flush batching are
all **unverified in a browser** and must be measured **before** the design is locked. The
webkitdirectory benchmark gate from the rev-1 review is **dropped** (Chromium-only decision made).

| Gate                                                                                                                                  | Blocks                                          | Pass criterion                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **G1 — Browser FSA loop bench** (real 3,541 HR files + a 2,000-file tiny-CSV sample, on the dev machine **and** one mid-range laptop) | wall-clock (§1.5), single-worker-vs-pool (§2.6) | Publishes real **ms/file split** (open vs decode vs parse vs fold) + total wall on a mid-range device; identifies whether parse or per-file FSA I/O dominates            |
| **G3 — Worker heap over a full synthetic 10 GB-shaped run** (periodic `measureUserAgentSpecificMemory()`)                             | heap bound (§1.4, §2.3)                         | **Heap flat < 100 MB across all ~4,300 nights**, no rising floor (a climbing sawtooth = accumulator leak / `parsed`-reference pin); tunes `MAX_RESIDENT_INTRADAY_NIGHTS` |
| **G4 — IDB batch-put bench**                                                                                                          | batching (§2.3a)                                | A `MAX_PUTS_PER_TX`-sized `putBatch` tx commits **< 250 ms**; total IDB write **< 30 s**; beats the per-put baseline; tunes `MAX_PUTS_PER_TX`                            |
| **G5 — Main-thread long-tasks observer during a real ingest**                                                                         | UI responsiveness (§5.1)                        | No main-thread task **> 50 ms**; progress-message coalescing verified at ~10/s                                                                                           |

(Gate numbering follows the perf-redteam review; G2 was the webkitdirectory gate, now dropped.)

### 5.1 Concrete budgets

| Budget                                       | Target                                                                    | Rationale                                                                                                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full in-scope ingest wall-clock              | **in-browser 6–20 min, unverified until G1** (native-Node floor ~3–4 min) | Per-file-overhead-bound over ~18,200 files (~80% tiny), not byte-bound; device-dependent (§1.5). Publish only after G1, with a device caveat.             |
| Per-file overhead (tiny files)               | measured + bounded by G1                                                  | ~174 µs/file in Node; FSA `getFile()/text()` commonly 3–10× higher → the dominant cost for the ~14,700 tiny non-HR files (§1.5)                           |
| Worker heap (steady-state)                   | **≤ 100 MB** (256 MB hard ceiling)                                        | one file graph (~5–11 MB measured) + ~4 MB rollups + window index + ≤ `MAX_RESIDENT_INTRADAY_NIGHTS` intraday + flush buffer (§1.4, §2.3); verified by G3 |
| Main-thread blocking during ingest           | **< 50 ms** any task                                                      | all parse/aggregate in worker; main thread only renders throttled progress; verified by G5                                                                |
| IndexedDB persisted footprint                | **≤ 50 MB** (≈ 15 MB expected)                                            | §3.6                                                                                                                                                      |
| Flush transaction time                       | **< 250 ms** per `putBatch`                                               | `MAX_PUTS_PER_TX`-sized batch (§2.3a); keeps IDB writes off the perceptible path; verified by G4                                                          |
| Total IndexedDB write time                   | **< 30 s**                                                                | ~16,000 puts batched into ~145 transactions (§2.3a); verified by G4                                                                                       |
| Time-to-first-correlation-view (post-ingest) | **< 500 ms** for 90-night range                                           | single keyed range `getAll` on `wearable_nights`                                                                                                          |
| Open-night drill-down                        | **< 100 ms**                                                              | one `[nightDate, metric]` typed-array read (§4 path a)                                                                                                    |
| Bundle impact (new code)                     | **+ < 20 KB gz**, total JS ≤ 500 KB                                       | no streaming-parser dep; reuse PapaParse + native JSON                                                                                                    |

### 5.2 Top risks & mitigations

1. **Accumulator leak (the _real_ heap risk, not per-file transients).** A `Map` that only grows, or
   a fold that stores a reference into the `parsed` graph, pins MBs per night × 4,300. _Mitigation:_
   §2.3 — `MAX_RESIDENT_INTRADAY_NIGHTS` cap + per-night-per-phase eviction; hard "primitives /
   typed-arrays only, never references into `parsed`" rule. **Verified by G3** (flat heap < 100 MB).
2. **GC pauses between files.** _Mitigation:_ null out `parsed` and yield a microtask between files
   so V8 reclaims the prior graph (~5–11 MB measured, not 80 MB) before the next; copy out
   primitives only (ties to risk 1).
3. **Slow per-`put` IndexedDB writes** (the existing codebase anti-pattern — ~16,000 puts ≈ 16–80 s
   unbatched). _Mitigation:_ the `putBatch` primitive (§2.3a) — one `readwrite` tx of
   `MAX_PUTS_PER_TX` puts, resolve on `transaction.oncomplete`; typed arrays avoid JSON
   serialization; single writer. **Verified by G4.**
4. **Timezone offset misalignment (catalog §4 #2 — the biggest correctness risk).** Not a _perf_
   risk but it corrupts every nightly aggregate. _Mitigation:_ resolve per-night offset in Phase A
   before windowing any high-frequency series (§2.2). **`data-scientist` owns the algorithm — and
   the empirical review shows `UserSleeps start_utc_offset` is a `+00:00` placeholder for 88% of
   nights, so it must NOT be the primary source (ADR-0006, §7).**
5. **SpO2 50.0 sentinel fabricating desaturations (catalog §4 #3).** _Mitigation:_ drop
   `value == 50.0` (sentinel-only) before computing nightly SpO2 stats; do NOT add a `>=70` range
   cut (it would delete genuine severe desaturations — the headline AHI↔SpO2 signal — see ADR-0006
   §3); count drops in a throttled warning. `data-scientist` confirms.
6. **FSA permission revoked / handle stale on a return visit** (only when the user opted into handle
   persistence). _Mitigation:_ graceful `queryPermission`→`requestPermission` behind a "Reconnect
   folder" button; never block app load; drill-down still works from persisted intraday (path a).
7. **Non-Chromium browsers (no FSA).** _Mitigation (rev 2):_ **v1 is Chromium-only** — render the
   unsupported empty-state (§1.2); CPAP features unaffected. No `webkitdirectory` ingest in v1
   (eager-FileList OOM risk, §1.6).
8. **Re-import double-counting across Global vs GoogleData trees (catalog §4 #10).** _Mitigation:_
   enumeration allowlist (§2.2) reads exactly one canonical source per metric; GoogleData tree never
   enumerated except `UserSleeps_*` (offsets only). _Note:_ a separate `logId` chunk-boundary
   double-count (~127 nights) is an ADR-0006/`data-scientist` concern (§7); the `nightDate`-keyed
   idempotent overwrite (§2.5) tolerates it once dedup lands.
9. **Browser tab backgrounded mid-ingest throttles the worker** (to ~1 callback/s). _Mitigation:_
   resumable `wearable_meta.cursor` means a throttled/closed tab just resumes; surface "keep this
   tab focused for fastest import." Factored into the 6–20 min range (§1.5).
10. **Quota exceeded on constrained devices.** _Mitigation:_ footprint is ~15 MB (well under quota);
    offer rollups-only mode; call `navigator.storage.estimate()` pre-ingest and warn if tight;
    consider `navigator.storage.persist()` to avoid eviction.

### 5.3 Follow-up profiling during implementation (non-blocking — the _binding_ ones are §5.0)

The four gates in **§5.0 (G1, G3, G4, G5) are binding before the worker model is locked.** The
items below are additional, non-blocking checks to run during implementation:

- **Drill-down read latency** (`[nightDate, metric]` typed array) against the < 100 ms budget;
  confirm typed-array round-trip beats object arrays.
- **Bundle-size check** after adding the hook/worker — confirm no streaming-parser dep crept in and
  total JS stays ≤ 500 KB gz.
- **FSA enumeration wall-time** (`handle.values()` over ~18,200 in-scope entries) — fold into the G1
  bench; expected to be a few seconds at most.

---

## 6. Files & symbols to reuse / follow

- **`src/workers/csv.worker.js`** — `{ workerId, type, ... }` message protocol,
  `sanitizeErrorMessage`, PapaParse chunked parsing (`chunkSize: CSV_CHUNK_SIZE_BYTES`),
  DateTime→ms serialization caveat (structured clone can't carry Date/Luxon). The new
  `wearableIngest.worker.js` follows this exact shape; CSV sub-parses (SpO2/HRV/snore) reuse
  PapaParse with the same chunking.
- **`src/hooks/useCsvFiles.js`** — worker lifecycle, `createWorkerId`, `cancelTask`/`terminate`,
  abort-signal cleanup, `extractFirstFile` capability abstraction. The new
  `useWearableDirectory`/`useWearableIngest` hooks mirror this; with v1 Chromium-only there is a
  _single_ FSA ingest path (no FSA-vs-input branching).
- **`src/hooks/useAnalyticsWorker.js`** — single-action worker coordinator pattern, result
  memoization (mirror for correlation-view reads).
- **`src/utils/fitbitDb.js` → `src/utils/appDb.js`** (ADR-0004 §3) — `openAppDb()`, additive
  `onupgradeneeded` guards, key/value `sync_metadata` style (template for `wearable_meta`),
  `clearFitbitData` (template for "Forget folder"/clear-wearable). Bump `DB_VERSION` to 3 here; add
  the new **`putBatch`** primitive (§2.3a) here.
- **`src/utils/db.js`** — thin session wrapper; re-point at `openAppDb`; CPAP session API stays
  byte-for-byte identical (ADR-0004 §3).
- **`src/constants/ui.js`** — `CSV_CHUNK_SIZE_BYTES`; add `FLUSH_INTERVAL_NIGHTS` (~30),
  `MAX_PUTS_PER_TX` (~110, tuned by G4), `MAX_RESIDENT_INTRADAY_NIGHTS` (64, tuned by G3),
  `INGEST_PROGRESS_THROTTLE_MS` (~100) here.
- **Skill `oscar-web-worker-patterns`** — `new URL('../workers/x.worker.js', import.meta.url)` +
  `{ type: 'module' }` Vite worker creation; message-type discrimination; cleanup on unmount.
- **Recent commit `49bf2e1`** — precedent for **throttling** warnings (apply to SpO2-sentinel /
  parse-warning emission).

---

## 7. Open questions / hand-offs for the ADR & other specialists

- **`data-scientist` / ADR-0006 (correctness — out of scope for this perf doc, but load-bearing):**
  - **BLOCKER — per-night UTC offset.** The empirical review showed `UserSleeps_*.start_utc_offset`
    is a `+00:00` placeholder for **88%** of nights and wrong by >1 h for **96%** of evaluated
    nights. The offset resolver must make **windowing-based inference primary** and treat
    `UserSleeps +00:00` (and any >1 h disagreement) as an untrusted hint — _not_ the preferred
    source. Phase A (§2.2) consumes whatever offset the ADR-0006 resolver produces; this doc does
    not pick the algorithm.
  - **MAJOR — `logId` chunk-boundary dedup.** ~136 logIds appear in two adjacent sleep chunk files;
    without `logId` dedup at read time, ~127 nights double-count stage minutes via the split-sleep
    merge path. Specify de-dup-by-`logId` (first-writer-wins) before folding; the `nightDate`-keyed
    idempotent overwrite (§2.5) helps but does not replace dedup.
  - Plus the usual: sleeping-HR definition, SpO2 < 90% threshold, classic-vs-stages handling.
- **`adr-specialist` / ADR-0004:** correct the "incremental re-import is cheap — manifest
  mtimes/sizes" wording — **mtime is unsound** (every file shares the extraction-date mtime); the
  skip predicate is **size + path + per-metric `lastIngestedDate`** (§2.5). Otherwise this rev is
  consistent with ADR-0004 (Chromium-only FSA, persist-intraday, v3 schema, `putBatch`, no streaming
  parser; worker count G1-gated rather than locked single-worker).
- **`security-auditor`:** opt-in FSA dir handle privacy review (ADR-0005); confirm legacy
  `fitbit_tokens` cleared on the v3 migration; ensure no PII dirs (`Your Profile`, demographics) are
  ever enumerated.
- **`frontend-developer`:** implement `useWearableDirectory`/`useWearableIngest`,
  `wearableIngest.worker.js`, the Chromium-only directory picker + non-Chromium unsupported
  empty-state, the `putBatch` primitive and v3 migration in `appDb.js` (from `fitbitDb.js`), and the
  G1/G3/G4/G5 benchmark harness (§5.0) before locking the worker model.
- **`ux-designer`:** import progress UX (two-dimensional progress, non-Chromium unsupported card,
  opt-in reconnect-folder flow, rollups-only toggle, "Load full resolution" drill-down affordance).
