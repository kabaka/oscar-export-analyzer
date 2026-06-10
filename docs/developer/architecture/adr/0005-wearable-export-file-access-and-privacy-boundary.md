# ADR-0005: Wearable Export File Access, Directory-Handle Persistence & Privacy Boundary

**Date**: June 10, 2026
**Status**: Proposed

---

## Context

ADR-0003 replaces the Fitbit OAuth/API integration with local ingestion of a ~10 GB /
32,738-file Google Health export; ADR-0004 fixes the aggregate-to-IndexedDB data model.
This ADR resolves the **file-access mechanism, the directory-handle persistence question,
and the privacy boundary** — the area where the design docs are in explicit tension.

The tension, stated plainly:

- The **performance design** ([`perf-storage-architecture.md`] §0.1, §3.4) wants to
  **persist the `FileSystemDirectoryHandle` in IndexedDB** so the app can re-read files for
  on-demand drill-down, resume a cancelled ingest, and do cheap incremental re-import.
- The **security design** ([`privacy-security.md`] D2, §1.2) wants the handle **NOT
  persisted by default**, because a retained handle is a **standing, re-grantable read
  capability over a user-chosen (possibly broad) directory** — metadata that effectively
  says "this user keeps their health export here."

Both cannot be the default simultaneously. Additional facts:

- **File access is Chromium-only for v1 (maintainer decision).** The **File System Access
  API** (`showDirectoryPicker`, Chromium-only) yields a persistable, re-readable handle and
  lazy enumeration and is the **sole** ingest path. `<input webkitdirectory>` is **not a v1
  fallback**: for a 10 GB / 32,738-file selection it eagerly materializes all 32,738 `File`
  objects on the main thread at selection time (OOM/freeze risk before any JS runs — perf
  design rev2 §1.6), so it is rejected for v1 and survives only as a possible future
  small-import affordance. Non-Chromium browsers get a clear unsupported empty-state.
- The export contains **PII/location/social directories** (catalog §1.12): `Your Profile`,
  demographics, `gps_location`/`live_pace`, social graph, account/security, commerce,
  medical records/journals/conversations, menstrual health.
- The current CSP (`index.html`) includes `connect-src 'self' https://api.fitbit.com`.

This ADR decides the default posture and the privacy controls. Storage internals are in
ADR-0004; correlation methodology in ADR-0006.

---

## Decision

### 1. File access: File System Access API only (Chromium v1), read-only

Use `window.showDirectoryPicker({ mode: 'read' })` as the **sole** ingest path. Capability
detection (`'showDirectoryPicker' in window`) gates the feature: non-Chromium browsers
(Firefox/Safari) get a clear unsupported empty-state, **not** a `webkitdirectory` fallback
(dropped for v1 — see Context and ADR-0003). **Always request `mode: 'read'` explicitly**
(even though it is the default) so the browser prompt says "view files," no write grant is
ever held, and the intent is auditable. The invariant is unchanged: **enumerate, filter by
allow/deny list, then read only allowlisted files.**

### 2. Resolve the tension: handle persistence is OFF by default, opt-in only

**Do NOT persist the `FileSystemDirectoryHandle` by default. Re-pick the folder each
session.** Offer a clearly-labeled, **off-by-default** "Remember this folder" opt-in.

Rationale — and why this does **not** cost us the perf benefits the perf design wanted the
handle for:

- The perf design's primary justification for persisting the handle was **on-demand
  drill-down re-reads**. ADR-0004 already decides drill-down is served from
  **pre-persisted `wearable_intraday` typed arrays**, not handle re-reads. So **the default
  drill-down path needs no retained handle at all.** The tension largely dissolves: the
  handle is only an _optional accelerator_ for resume/incremental-import and an _optional
  escape hatch_ for raw-resolution ("Load full resolution") drill-down — not a requirement
  of the common path.
- A persisted handle is a durable read capability over whatever the user picked (possibly
  `~/Downloads` or a home directory). Even with the browser's non-suppressible re-prompt,
  normalizing "click yes" to a stored whole-directory handle is a privacy regression the
  default should not take.

**Opt-in mechanics** (when the user checks "Remember this folder"):

- Store the handle in the `wearable_meta` store (key `dirHandle`); it is structured-cloneable.
- On return visit, **never auto-read on load.** Run `handle.queryPermission({ mode: 'read' })`;
  if not `'granted'`, surface a **"Reconnect folder"** button that calls
  `handle.requestPermission({ mode: 'read' })` behind an explicit user gesture. If `denied`
  or the handle is stale (folder moved/deleted), fall back to the "Select folder" idle state
  with an explanatory note.
- Provide a **one-click "Forget folder"** that deletes the stored handle, wired into the
  existing data-clear flow.

Because v1 is Chromium-only, there is **no `webkitdirectory` fallback** to reason about: the
default (no persisted handle) re-visit re-picks the folder, after which the incremental skip
predicate (`lastIngestedDate` high-water mark + `{relativePath,size}` — ADR-0004 §4a, **not**
mtime) still skips unchanged nights, and drill-down is served from persisted intraday (the
default anyway). The off-by-default "Remember this folder" opt-in (full scope per the
maintainer decision) accelerates resume/incremental for users who enable it.

### 3. PII minimization: hard-coded allowlist + denylist, enforced at enumeration

The strongest privacy control is **never opening denylisted bytes**. Enforce at
**enumeration time**, before any read:

- **Denylist (`NEVER_READ`), checked first:** profile PII (`Your Profile/*`), demographics
  (`UserDemographicData*`, `UserProfileData*`, `UserLocationCountry*`), **GPS/location**
  (`gps_location_*`, `live_pace_*` — categorically denied, no sleep value), social graph,
  account/security, commerce/discover/surveys/premium, medical records / journals / food /
  conversations. **Denied directories are pruned, never descended** — never enumerated,
  never `getFile()`, never `.text()`.
- **Menstrual health (`Menstrual Health/*`): denied unless an explicit, off-by-default
  opt-in** is checked (its own sensitivity notice).
- **Allowlist (default-deny):** only the catalog §5 MUST-HAVE paths (sleep, SpO2,
  resting+sleeping HR, HRV, respiratory rate, readiness, stress, snore, activity/AZM,
  temperature, plus `UserSleeps_*` for UTC offsets only). Anything not matching is
  **ignored**. **Match by exact prefix/dir, never a loose glob:** a `*heart_rate*` glob
  would wrongly match the **38 MB out-of-scope `daily_heart_rate_zones.csv`** (the single
  largest file in the export, pseudo-JSON cells that throw on `JSON.parse`) — the allowlist
  must **not** match it (empirical-redteam; perf design rev2 §1.3).
- The classifier (`classify(relPath)`: `denied` | `allowed` | `ignored`) is a **pure,
  unit-tested function** exercised with adversarial paths (`..` traversal, case variants,
  denied dirs nested under allowed parents).

### 4. Transparency surfaces

- **Pre-ingest disclosure:** "We will read only these categories … We will NOT read your
  profile, GPS/location, social, account, commerce, medical records, journals." (Distinct
  from the persistence consent.)
- **Root validation:** after picking, confirm the chosen root looks like a Google Health
  export (presence of known dirs); if not, warn non-fatally and ingest only recognized
  files (likely zero) — never recurse arbitrary user folders.
- **Post-ingest receipt:** counts read per category and skipped (e.g. "Skipped 90 GPS
  files, 2 profile files") so the user can verify the allowlist was honored.

### 5. CSP boundary: `connect-src 'self'`

Remove `https://api.fitbit.com` from the `index.html` CSP (and delete its exception
comment); target `connect-src 'self';`. With OAuth gone there are **no legitimate external
endpoints**, so the local-first guarantee becomes **CSP-enforced and auditable** — any
accidental attempt to POST health data off-device is blocked by the browser, not just by
review. Add a CI grep guard that fails the build on `api.fitbit.com` / `fetch(` /
`XMLHttpRequest` / `sendBeacon` outside test files (recommend `readiness-reviewer` own this
gate). The pre-existing `style-src 'unsafe-inline'` (Plotly) is out of scope here but noted
for the security review.

### 6. At-rest persistence: consented, unencrypted — match the CPAP baseline

**Persist only derived nightly/intraday rollups (ADR-0004), unencrypted, gated by the same
explicit consent already used for CPAP data. Do NOT reintroduce passphrase-based at-rest
encryption for the wearable store.**

Rationale (the realistic-threat argument): CPAP PHI is **already stored unencrypted**
(`src/utils/db.js#putLastSession`, gated by `storageConsent.js`/`StorageConsentDialog.jsx`).
Encrypting only the wearable half — while the explicitly-correlated CPAP half is plaintext —
is security theater; an attacker with IndexedDB access already has the CPAP data. The prior
Fitbit encrypted path was itself the fragile thing: an **insecure passphrase backup**
(removed in `e65e3c0`) and an inconsistent `encryptionEnabled` dual-write
(`fitbitDb.js` ~170–177). Browser-side passphrase encryption has an unsolvable key-storage
problem (re-derive every load → UX friction + lost-passphrase = lost data, or store the key
→ defeats it). At-rest encryption in an SPA only defends a narrow threat (local forensic
read); the realistic threats (malicious extension, XSS) run in-origin and would hold the
derived key anyway — for those, **CSP + code hygiene are the effective controls.**

This **formalizes the project's de-facto, previously-undocumented posture**: consented,
unencrypted PHI at rest, applied uniformly to CPAP and wearable data.

- **Keep `encryption.js`** for its real purpose — user-initiated encrypted export/import of
  a session bundle (`exportImport.js`, ADR-0002), a deliberate user act with a transient
  passphrase. Do **not** wire it into the IndexedDB write path.
- **Default = do not persist.** Nothing is written until the user chooses "Save to Browser";
  a fully ephemeral analysis session is supported. Update `StorageConsentDialog.jsx` copy to
  include wearable-derived nightly summaries.
- **One-action delete** clears CPAP sessions, wearable rollups, the `dirHandle`, and consent
  flags. Remove the `fitbitDb.js` `encryptionEnabled` dual path.

### 7. Worker resilience & no-PHI logging

Treat every file as untrusted (catalog §4 hazards: invalid pseudo-JSON, epoch-1970 junk,
array-in-cell, giant files, empty files, schema drift). A parse failure on one cell/file must
not abort the run; bound per-file and total resource use; cap directory-walk depth/count.
**Never log raw cell values, health metrics, or file contents** to console or error messages;
reuse the `sanitizeErrorMessage` "Safe message" convention; worker→main error payloads are
sanitized strings, not raw `Error` objects.

---

## Consequences

### Positive

- **Minimal standing filesystem access by default.** No retained handle unless the user
  explicitly opts in; the common drill-down path needs no handle, so the secure default is
  also the fully-functional default.
- **Data minimization by construction.** Denied bytes are never read; the allowlist is
  default-deny; transparency surfaces let the user verify it.
- **Provable local-first.** `connect-src 'self'` + CI grep guard make no-egress enforceable,
  not aspirational — the headline security win of the rework.
- **Coherent, single persistence model.** One consent mechanism for all PHI; no fragile
  half-encrypted store; the dangerous passphrase-backup anti-pattern is retired.
- **Read-only, user-gesture-scoped access** with explicit `mode: 'read'`.

### Negative

- **Re-pick friction by default.** Without the opt-in, FSA users re-select the folder each
  session (a few seconds). Accepted as the price of minimal standing access.
- **PHI is plaintext at rest (with consent).** This is a deliberate, now-explicit trade-off;
  it does not defend against local forensic disk reads. Some users/regulators may expect
  encryption (see Alternative C and the §3.5 future path in the design doc).
- **No wearable feature on non-Chromium browsers (v1).** Firefox/Safari users get the
  unsupported empty-state; there is no `webkitdirectory` ingest in v1 (eager-FileList OOM —
  ADR-0003). CPAP analysis is unaffected.
- **Allow/deny maintenance.** The lists are hard-coded to the observed export structure;
  Google renaming directories could silently exclude data or (worse) require care to avoid
  including a newly-named sensitive dir. The denylist-first + default-deny ordering bounds
  the downside to under-reading, not over-reading.
- **Menstrual/raw-resolution opt-ins add UI surface** and consent complexity.

### Mitigations

- The opt-in "Remember folder" + "Reconnect"/"Forget" flow gives convenience to users who
  want it without making it the default.
- Document the unencrypted-at-rest posture plainly in privacy docs; offer "Don't Save"
  (ephemeral) prominently; keep the uniform-encryption-with-non-extractable-key path
  (design §3.5) on record as the future option if the project later mandates encryption.
- Root validation + post-ingest receipt catch a mis-pointed picker; denylist-first ordering
  ensures an allowlist mistake under-reads rather than leaking a sensitive dir.
- CI grep guard + pure unit-tested classifier with adversarial paths prevent regressions.

---

## Alternatives Considered

### Alternative A: Persist the directory handle by default (perf design's original preference)

- **Pros:** Frictionless re-visits; resume + incremental re-import "just work"; raw-resolution
  drill-down available without re-picking.
- **Cons:** A standing read capability over a possibly-broad user directory retained across
  sessions; normalizes re-granting; the export's _location_ is itself PHI-adjacent metadata.
- **Why not chosen:** ADR-0004 moves default drill-down to persisted intraday arrays, so the
  handle is no longer needed on the common path — removing the main reason to persist it.
  Off-by-default opt-in captures the convenience for users who want it without imposing the
  standing grant on everyone.

### Alternative B: Never offer handle persistence at all (strictest)

- **Pros:** Zero retained filesystem capability, ever; simplest privacy story.
- **Cons:** Loses cheap incremental re-import and resume-after-cancel for the many users who
  periodically re-export a fresh Takeout; forces a full re-pick + re-scan each time even on
  Chromium.
- **Why not chosen:** The opt-in (off by default, gesture-gated re-grant, one-click forget)
  is a reasonable middle: the strict default is preserved, but power users who understand the
  trade-off can enable convenience.

### Alternative C: Encrypt wearable PHI at rest with a user passphrase

- **Pros:** Defends a local forensic disk read; matches a naive "health data must be
  encrypted" expectation.
- **Cons:** Inconsistent with the plaintext CPAP baseline (theater while the correlated half
  is plaintext); reintroduces the exact passphrase key-storage/lost-data/backup anti-pattern
  that was the prior design's documented defect; ineffective against the realistic in-origin
  threats (extension/XSS).
- **Why not chosen:** A single coherent consent model beats a fragile half-encrypted one. If
  the project later mandates at-rest encryption, do it **uniformly** across CPAP and wearable
  with a **non-extractable `CryptoKey`** (design §3.5), not a passphrase — out of scope for v1.

---

## Settled by the Maintainer / Empirical Review

- **Chromium-only FSA is a confirmed product decision** (not an open assumption). The
  capability gate renders an unsupported empty-state on non-Chromium browsers; no
  `webkitdirectory` fallback. `showDirectoryPicker` remains Chromium-only as of this writing;
  re-verify Baseline only to keep the empty-state copy accurate.
- **The allowlist must not match the 38 MB out-of-scope `daily_heart_rate_zones.csv`** —
  confirmed by the empirical review; enforce via exact prefix/dir matching (§3).

## Assumptions to Verify

- **`queryPermission`/`requestPermission` semantics** (re-prompt requires a user gesture, is
  non-suppressible) hold across current Chromium versions — confirm before shipping the
  reconnect flow.
- **`FileSystemDirectoryHandle` is structured-cloneable/transferable to a Worker** (relied on
  for off-main-thread enumeration; no large `File[]` is cloned now that webkitdirectory is
  gone) — confirm for the target browsers.
- **The denylist covers all sensitive dirs in real exports.** The lists are derived from one
  export; `security-auditor` should re-derive against any new export structure and verify the
  classifier prunes denied dirs without descending.

---

## References

- [ADR-0003](0003-replace-fitbit-oauth-with-local-export-ingestion.md),
  [ADR-0004](0004-ingest-and-aggregate-wearable-data-to-indexeddb.md),
  [ADR-0006](0006-wearable-cpap-alignment-and-correlation-methodology.md)
- [ADR-0002: PWA Implementation](0002-progressive-web-app-implementation.md) — encrypted export/import; local-first posture.
- Design: [`design/privacy-security.md`](../../reports/2026-06-wearable-export-planning/design/privacy-security.md) (D1–D8, §1–7),
  [`design/perf-storage-architecture.md`](../../reports/2026-06-wearable-export-planning/design/perf-storage-architecture.md) (§1, §3.4, §4),
  [`data-catalog.md`](../../reports/2026-06-wearable-export-planning/data-catalog.md) (§1.12, §4, §5),
  all archived under `docs/developer/reports/2026-06-wearable-export-planning/`.
- Code: `index.html` (CSP), `src/utils/db.js`, `src/utils/storageConsent.js`,
  `src/components/StorageConsentDialog.jsx`, `src/utils/encryption.js`,
  `src/utils/exportImport.js`, `src/workers/csv.worker.js` (`sanitizeErrorMessage`).
- Skills: `oscar-privacy-boundaries`, `oscar-web-worker-patterns`.

---

## Approval

**Decision Maker**: Project maintainer
**Recommended Reviewers**: @security-auditor (primary), @frontend-developer, @ux-designer, @readiness-reviewer
**Status**: Proposed — awaiting review and acceptance.

---

## Changelog

| Date       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Author          |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| 2026-06-10 | Initial ADR drafted                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | @adr-specialist |
| 2026-06-10 | Revised after **adversarial review 2026-06-10**: (1) **Chromium-only FSA, no `webkitdirectory` fallback** in v1 (maintainer decision) — non-Chromium → unsupported empty-state. (2) Kept the off-by-default opt-in "remember folder" handle persistence (full scope). (3) Allowlist must use exact prefix/dir matching to exclude the 38 MB out-of-scope `daily_heart_rate_zones.csv`. (4) Incremental skip references `lastIngestedDate`+`{relativePath,size}`, not mtime (ADR-0004). | @adr-specialist |
