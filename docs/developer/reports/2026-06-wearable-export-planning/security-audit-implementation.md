# Security & Privacy Audit — Wearable Export Ingestion (Implementation Review)

**Branch:** `feat/wearable-export-ingestion`
**Date:** 2026-06-10
**Auditor:** security-auditor (subagent)
**Authoritative refs:** ADR-0005 (`docs/developer/architecture/adr/0005-wearable-export-file-access-and-privacy-boundary.md`), `docs/developer/reports/2026-06-wearable-export-planning/design/privacy-security.md`, skill `oscar-privacy-boundaries`.

**Constraint honored:** No real PHI was read or copied. All inspection used source + synthetic test paths only.

---

## Overall verdict

**PASS with fixes applied.** The new wearable ingestion path is local-first, data-minimizing by construction, and PHI-safe in logs. The required CSP change is applied and CI-guarded. One must-fix (a worker dev-log echoing `err.message`) was corrected; one test-coverage gap was closed with an adversarial test. One **unrelated, pre-existing** test failure exists outside this audit's scope (see end).

Green status after edits:

- `npm run lint` — **0 errors** (warnings are pre-existing `no-magic-numbers`, non-blocking; `eslint .` exits 0).
- `npm test -- --run` (full Vitest) — **1197 passed, 4 skipped, 1 failed**. The single failure (`WearableDashboard.test.jsx` → `getByTitle(/Spearman/)` matches multiple elements) is a **pre-existing test-authoring bug unrelated to this audit**; it has no import dependency on any file changed here. See "Out of scope" below.
- `npm run build` — **green (exit 0)**; the new egress guard runs first (`build = npm run check:egress && vite build`) and passes; built `dist/index.html` carries `connect-src 'self'` with zero Fitbit references.

---

## Item-by-item findings

### 1. CSP — `connect-src 'self'` — **FIX-APPLIED**

`index.html` previously shipped `connect-src 'self' https://api.fitbit.com` plus a multi-line exception comment justifying the Fitbit OAuth/API endpoint. With OAuth removed (ADR-0003/0005), this was a stale, over-broad external connect target.

**Applied** (only the CSP block + comment changed in `index.html`):

- `connect-src 'self'` — the Fitbit host removed.
- Exception comment replaced with a local-first rationale documenting why `blob:`/`data:` remain (verified genuinely needed: `worker-src 'self' blob:` for Vite/PWA worker bootstrap; `img-src 'self' data: blob:` and `font-src 'self' data:` for Plotly export/inline assets; `style-src 'unsafe-inline'` for Plotly runtime styling — all pre-existing, in scope only to confirm, left intact).
- Verified the built `dist/index.html` emits `connect-src 'self'` and contains no `api.fitbit.com`.

**CI guard added:** `scripts/check-no-egress.mjs` — scans `src/**` + `index.html` (excluding tests/mocks/the guard itself) and fails the build on `fetch(`, `XMLHttpRequest`, `sendBeacon`, `new WebSocket`, `new EventSource`, `importScripts(`, `api.fitbit.com`, or any `connect-src` with a non-self host. Wired into `package.json` as `check:egress` and prepended to `build`. Verified: passes clean (exit 0) on current tree; a reintroduced `fetch('https://api.fitbit.com/...')` is caught (exit 1, prints offending file:line). Lints clean.

> Note: ADR-0005 §5 suggested `readiness-reviewer` own this gate. It is currently wired into `build` so it runs in CI/local builds; the orchestrator may additionally surface it in the readiness checklist.

### 2. Allowlist / denylist enforcement — **PASS** (coverage gap closed)

`src/utils/wearable/exportAllowlist.js` + `ingestEngine.enumerateExport` are correct and match ADR-0005 §3:

- **Denylist-first, default-deny.** `classify()` checks menstrual gate → `DENY_DIR_PREFIXES` → `DENY_FILE_PATTERNS` → allowlist; non-`allowed` is never read.
- **Pruned before descent.** `enumerateExport.walk` calls `isDeniedDir(rel + '/')` and `continue`s (never descends, never `getFile()`, never lists) for denied subtrees. Denied file patterns (`gps_location_`, `live_pace_`, `UserDemographicData`, `UserProfileData`, `UserLocationCountry`, `MedicalRecords`, `UserJournalEntries`, `UserFoodFrequencyEntries`, `UserConversations`) are denied even nested under allowed parents.
- **38 MB `daily_heart_rate_zones.csv` excluded** two ways: explicit `DENY_FILE_PATTERNS` entry `/(^|\/)daily_heart_rate_zones\.csv$/` **and** no allowlist pattern matches it. Verified both.
- **Exact-anchored matching.** Every allowlist entry uses `^…$`; no loose `*heart_rate*` glob exists.
- **Menstrual health opt-in.** Denied unless `menstrualOptIn === true`; threaded from UI checkbox → hook → worker → `classify`/`isDeniedDir`.

**Gap closed:** ADR-0005 §3 calls for the classifier to be exercised with `..` traversal, case variants, and denied-dirs-nested-under-allowed-parents. The existing test file covered the zones file, denylist, leading-slash normalization, and menstrual gate, but **not** `..` traversal or case variants explicitly. Added a `classify — adversarial hardening` describe block to `exportAllowlist.test.js` asserting: traversal paths never classify ALLOWED; backslash-normalized denied dirs stay DENIED; denied files under allowed parents stay DENIED; case-variant denied paths never classify ALLOWED (worst case = under-read, never PII leak); GoogleData GPS subdir pruned; zones file denied anywhere. All pass (allowlist file: 63 tests green).

### 3. No PHI in logs/errors — **FIX-APPLIED**

- Worker→main error payloads use `sanitizeErrorMessage()` (generic strings, never raw `Error`) — correct.
- `ingestEngine.js` throws only generic messages (`'Ingestion cancelled'`); parsers never throw and never log; no `console.*` in the engine/parsers/aggregators.
- **Must-fix found & fixed:** `wearableIngest.worker.js` had a DEV-only `console.error('… worker error:', err?.name, err?.message)`. Per ADR-0005 §7 and the `sanitizeErrorMessage` convention, a raw `err.message` from a parser/FS error can embed a **file path or cell value** — exactly what the sanitizer exists to strip. Rewrote the dev log to emit only `err?.name` (a constructor label like `TypeError`/`SyntaxError`, never PHI) plus the already-sanitized message. No raw `message`/`stack` is logged anywhere now.
- Grep across `src/utils/wearable`, the worker, `src/components/wearable`, `src/features/wearable-correlation`: the worker dev-log was the **only** `console.*`; now PHI-safe.

### 4. At-rest persistence — **PASS**

- Derived rollups persist to IndexedDB stores `wearable_nights` / `wearable_intraday` via `putBatch`; manifest in `wearable_meta`. Plaintext, consistent with the CPAP baseline (ADR-0005 §6). **No passphrase scheme reintroduced** — `appDb.js` drops the legacy `fitbit_tokens`/`fitbit_data`/`sync_metadata` stores at schema v4 and there is no `encryptionEnabled` dual-write.
- **Dir-handle persistence is off-by-default opt-in.** `useWearableImport.startIngest({ rememberFolder })` persists the handle to `wearable_meta.dirHandle` only when the user ticks "Remember this folder" (default `false` in `WearableImportCard`). On return, `reconnect()` runs `handle.queryPermission({mode:'read'})` and only calls `handle.requestPermission({mode:'read'})` behind the explicit "Reconnect" button gesture; never auto-reads on load. `forgetFolder()` calls `clearWearableData(db)` and resets in-memory handle state.
- Picker always uses `showDirectoryPicker({ mode: 'read' })` (explicit read-only). Non-Chromium → unsupported empty-state, no `webkitdirectory` fallback.

**Observation (not a blocker):** persistence of the `dirHandle` is gated by the `rememberFolder` opt-in but is **not** additionally gated by the CPAP-style storage-consent dialog — it writes to IndexedDB on the same "Ingest" action. This is consistent with ADR-0005's model (the opt-in checkbox _is_ the consent for the handle, distinct from the data-persistence consent) and is off-by-default, so it is acceptable. Recommend the orchestrator have `ux-designer`/`frontend-developer` confirm the "Remember this folder" label adequately conveys that a re-grantable folder capability is being stored, and that derived-rollup persistence itself is covered by the existing storage-consent copy (ADR-0005 §6 asks `StorageConsentDialog.jsx` copy to mention wearable nightly summaries — verify that copy update landed).

### 5. No network egress during ingestion — **PASS**

Grep of `src/**` (non-test) for `fetch(`, `XMLHttpRequest`, `sendBeacon`, `new WebSocket`, `navigator.sendBeacon`: **none**. The entire ingest path (hook → worker → `ingestEngine` → parsers → `appDb`) is local-only: File System Access reads + Web Worker compute + IndexedDB writes. Now enforced by `connect-src 'self'` **and** the CI egress guard.

### 6. Removed attack surface (OAuth) — **PASS**

No orphan OAuth/PKCE/redirect/token code remains. Grep for `fitbit_tokens|pkce|code_verifier|redirect_uri|oauth|access_token|refresh_token` outside tests/wearable: the only hits are intentional **cleanup** in `appDb.js` (a v4 migration that _drops_ the legacy `fitbit_tokens`/`fitbit_data`/`sync_metadata` stores). All Fitbit OAuth components/hooks/utils/contexts are deleted (visible as `D` in `git status`). No `fitbit_tokens` _reads_ remain. `index.html` was the last `api.fitbit.com` reference and is now removed.

### 7. DoS resilience — **PASS**

- Parsers (`parsers.js`) are documented and built to **never throw**: `safeJsonParse` wraps `JSON.parse` in try/catch → `null`; `parseCsvRows` wraps PapaParse and returns an empty shape on error; bad rows/cells are skipped and counted in `malformedRows`, so one malformed file/cell never aborts the run. Handles the catalog §4 hazards (pseudo-JSON, epoch-1970 via datetime parsers, array-in-cell, empty/header-only, string-number casts).
- The parse-hostile 38 MB `daily_heart_rate_zones.csv` is **never opened** (denied), removing the largest OOM/parse-throw risk entirely.
- Engine bounds memory: per-night intraday eviction at `MAX_RESIDENT_INTRADAY_NIGHTS`, batched `putBatch` at `MAX_PUTS_PER_TX`, downsampling to fixed-cadence `Int16Array`. Cancellation via `AbortSignal` (`throwIfAborted`) at every loop boundary. Errors are bounded to sanitized strings.

---

## Files changed by this audit

- `index.html` — CSP `connect-src` set to `'self'`; Fitbit host + exception comment removed (CSP block + comment only).
- `scripts/check-no-egress.mjs` — **new** CI egress guard.
- `package.json` — added `check:egress` script; `build` now runs the guard first.
- `src/workers/wearableIngest.worker.js` — DEV-only error log no longer echoes raw `err.message`; logs `err.name` + sanitized message.
- `src/utils/wearable/exportAllowlist.test.js` — added adversarial-hardening describe block (traversal / case / nested-denied).

## Out of scope (flag for orchestrator)

- **Pre-existing test failure:** `src/components/wearable/WearableDashboard.test.jsx` fails on `getByTitle(/Spearman rank correlation/i)` finding multiple identical `title` elements (needs `getAllByTitle`/scoped query). Untouched by this audit, no dependency on any file changed here. Recommend the orchestrator delegate the fix to `testing-expert`/`frontend-developer`.
- **Consent-copy verification (item 4 observation):** confirm `StorageConsentDialog.jsx` copy mentions wearable nightly summaries (ADR-0005 §6) and that the "Remember this folder" label communicates the stored re-grantable capability — `ux-designer`.
