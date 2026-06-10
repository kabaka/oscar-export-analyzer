# Privacy & Security Architecture — Google Health (Fitbit) Export Ingestion

**Status:** Design (feeds an ADR + a later security review)
**Scope:** Replacing the Fitbit OAuth/API integration with **local directory ingestion** of a
Google Health (formerly Fitbit) Takeout export (~10 GB, 32k+ files, 12 years), parsed and
aggregated entirely in-browser.
**Author:** security-auditor (subagent)
**Date:** 2026-06-10

> **Required reading:** `../data-catalog.md` (especially §1.12 PII inventory and §5 ingestion
> scope). This document is prescriptive — every numbered recommendation is meant to be directly
> actionable by `frontend-developer`, `performance-optimizer`, and `adr-specialist`.

---

## Revision log (adversarial review)

**rev2 — 2026-06-10 (adversarial review; aligned to ADR-0005 rev2 + the other rev2 design docs).**
The maintainer settled **Chromium-only for v1**: the **File System Access API**
(`showDirectoryPicker`) is the **sole** ingest path, and `<input webkitdirectory>` is **NOT a v1
fallback**. What changed in this doc relative to rev1:

1. **D1 / §1.4 — `<input webkitdirectory>` dropped as a v1 ingest path.** rev1 described it as the
   non-Chromium fallback for the full export; that is rejected for v1 because a 10 GB / 32,738-file
   selection eagerly materializes all 32,738 `File` objects on the main thread at selection time
   (OOM/freeze before any JS runs — perf design rev2 §1.6). Capability detection
   (`'showDirectoryPicker' in window`) gates the feature; **non-Chromium browsers (Firefox/Safari)
   get a clear unsupported empty-state**, not a fallback. `webkitdirectory` survives only as a
   _possible future small-import affordance_, retained **with** its security/OOM caveat (§1.4).
2. **Handle persistence unchanged.** The off-by-default, opt-in "Remember this folder" handle
   persistence (D2) is retained, at **full scope** (the user-picked directory), exactly as the
   maintainer confirmed.
3. **Allowlist matching tightened (empirical nit).** The read-allowlist must use **exact dir/prefix
   matching, never a loose glob.** A `*heart_rate*`-style glob would wrongly match the **38 MB
   out-of-scope `daily_heart_rate_zones.csv`** (the single largest CSV in the export, with
   pseudo-JSON cells that throw on `JSON.parse`). The allowlist MUST NOT match that file (§2.1).
4. **Confirmed aligned with ADR-0005:** denylist-checked-at-enumeration (D3/§2), CSP
   `connect-src 'self'` (D6/§4.2), derived-PHI-unencrypted-with-consent matching the CPAP baseline
   (D5/§3), and no-PHI-in-logs (D7/§5.3) all remain consistent with the ADR; wording that implied a
   non-Chromium full-export path has been corrected.

See ADR-0005 (`docs/developer/architecture/adr/0005-wearable-export-file-access-and-privacy-boundary.md`)
for the binding decision and its changelog.

---

## 0. Summary of recommendations (the decisions)

| #   | Decision                                                                                                                                                                                                                                                     | Rationale                                                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Use the **File System Access API** (`showDirectoryPicker({ mode: 'read' })`) as the **sole v1 ingest path** (Chromium-only). **No `<input webkitdirectory>` fallback** — capability-detect and render an unsupported empty-state on non-Chromium browsers.   | Read-only, no upload, user-scoped, lazy enumeration. `webkitdirectory` would eagerly materialize all 32,738 `File` objects → OOM/freeze (§1.4).                                                                                                               |
| D2  | **Do NOT persist the `FileSystemDirectoryHandle` by default.** Re-pick each session. Offer "remember this folder" as an explicit, off-by-default opt-in (full scope of the user-picked directory).                                                           | A retained handle is a standing read grant over a user-chosen (possibly broad) directory.                                                                                                                                                                     |
| D3  | Enforce a hard-coded **allowlist** (catalog §5 MUST-HAVE paths, **exact dir/prefix match, no loose globs**) and a **denylist** of PII/location/social dirs. Denylisted files are **never opened** — filtered at directory-enumeration time, before any read. | Data minimization; the strongest privacy control is to never read the bytes.                                                                                                                                                                                  |
| D4  | Persist **only derived nightly/per-minute rollups** (megabytes), never raw HR/SpO2 streams.                                                                                                                                                                  | Catalog §3 — raw HR is 6.1 GB / 67 M rows; aggregate-on-ingest.                                                                                                                                                                                               |
| D5  | **Match the existing CPAP baseline: store derived rollups unencrypted in IndexedDB, gated by explicit consent.** Do **not** revive passphrase-based at-rest encryption for the wearable store.                                                               | CPAP sessions are already stored unencrypted (`src/utils/db.js`). The prior Fitbit passphrase/encryption path was noted broken/insecure. A coherent, single consent model beats a fragile half-encrypted one. (See §3 for the trade-off and the alternative.) |
| D6  | Tighten CSP: `connect-src 'self'` only. **Remove `https://api.fitbit.com`.**                                                                                                                                                                                 | No external API calls remain; makes the local-first guarantee CSP-enforced and auditable.                                                                                                                                                                     |
| D7  | Ingestion worker must be **resilient to hostile/malformed files**, bounded in memory, and must **never log PHI** — reuse the existing `sanitizeErrorMessage` "Safe message" convention from `csv.worker.js`.                                                 | Catalog §4 documents invalid pseudo-JSON, epoch-1970 junk, array-in-cell, giant files.                                                                                                                                                                        |
| D8  | Record the **removed OAuth attack surface** (tokens, refresh tokens, PKCE state, redirect handling, the insecure passphrase backup) as a security benefit in the ADR, and **delete** the dead Fitbit auth/API/token code and its IndexedDB stores.           | Eliminating credentials is the single biggest security win of this rework.                                                                                                                                                                                    |

---

## 1. File System Access API security model

### 1.1 Permission semantics

`window.showDirectoryPicker()` returns a `FileSystemDirectoryHandle` representing a user-chosen
directory. Key properties relevant to us:

- **Explicit user gesture + OS picker.** The handle is only obtained through a user-initiated
  picker; the page cannot enumerate the filesystem or pick a path programmatically.
- **Read-only request.** Call `showDirectoryPicker({ mode: 'read' })`. We never need write access;
  requesting `'read'` means the browser's permission prompt says _"view files"_, not _"edit"_, and
  no write grant is ever held. **Do this even though `'read'` is the default** — be explicit so the
  intent is auditable.
- **Recursive read within the chosen root.** A granted directory handle allows reading **every file
  and subdirectory beneath it**. This is the core risk: scope is whatever the user picked, not what
  we intend to read. Mitigation is the allowlist (§2) — we choose which descendants to open.
- **Session-scoped permission by default.** Without persistence, the grant lasts for the page
  session; closing the tab drops it.
- **Chromium-only; capability-gated.** `showDirectoryPicker` is Chromium-only as of this writing.
  v1 detects `'showDirectoryPicker' in window` and gates the entire wearable-ingest feature on it;
  there is no fallback ingest path (§1.4). Re-verify Baseline support only to keep the
  unsupported-empty-state copy accurate.

### 1.2 Persisting a handle (and why we default to NOT doing it)

A `FileSystemDirectoryHandle` is structured-cloneable and **can be stored in IndexedDB**. On a
return visit you can re-acquire access via:

```js
const perm = await handle.queryPermission({ mode: 'read' }); // 'granted' | 'prompt' | 'denied'
if (perm !== 'granted') {
  const req = await handle.requestPermission({ mode: 'read' }); // requires a user gesture
}
```

**Risk of persisting:** a stored handle is a **durable, re-grantable pointer into the user's
filesystem**. Even though the browser re-prompts (`requestPermission` needs a user gesture and the
prompt is non-suppressible), the convenience normalizes "click yes" and a stored handle to, say, the
user's whole `Downloads` or home directory is a standing capability. The export itself is PHI-
adjacent; the _handle_ is metadata that says "this user keeps their health export here."

**Recommendation (D2):**

1. **Default: do not persist the handle.** Re-pick the directory each session. This is a few
   seconds of friction for a strong reduction in standing filesystem access.
2. **Optional opt-in:** a clearly-labeled, **off-by-default** "Remember this folder so I don't have
   to re-select it" checkbox. If checked, store the handle in a dedicated IndexedDB store
   (`export_handle` / `wearable_meta` key `dirHandle`), and on return visit run `queryPermission` →
   `requestPermission`. The retained handle covers the **full scope** of the user-picked directory
   (the maintainer accepted this trade-off). Never auto-read on load; always require a user gesture
   ("Reconnect folder") before re-enumeration.
3. **One-click forget:** a "Forget folder" control that deletes the stored handle and calls nothing
   that would silently re-grant. Tie this into the existing data-clear flow (§3.4).

### 1.3 Over-broad directory selection

The user might point the picker at `~/Downloads`, their home directory, or `Takeout/` (which
contains far more than Google Health). Two defenses:

1. **Validate the chosen root is an export root.** After picking, enumerate top-level entries and
   confirm the expected Google Health structure (e.g. presence of known directories like
   `Global Export Data/`, `Sleep Score/`, `Oxygen Saturation (SpO2)/`). If the structure isn't
   recognized, show a non-fatal warning: _"This doesn't look like a Google Health export — we read
   only recognized health categories and ignore everything else."_ Do **not** crash; do **not**
   recurse blindly (§5.2).
2. **UI scope guidance.** Tell the user exactly which folder to select (the `Google Health/`
   directory inside Takeout), with a screenshot/path example, so they pick the narrowest correct
   scope rather than the whole Takeout or Downloads.

### 1.4 Non-Chromium browsers: unsupported empty-state (NOT a `webkitdirectory` fallback)

**v1 is Chromium-only.** The File System Access API is the **sole** ingest path. Browsers without it
(Firefox, Safari as of this writing) **do not** get an `<input webkitdirectory>` fallback for the
full export; they get a **clear unsupported empty-state** that explains the wearable feature
requires a Chromium-based browser and points to the CPAP analysis (which is unaffected). Gate the
feature on `'showDirectoryPicker' in window`.

**Why `webkitdirectory` is rejected for the full export (security/OOM caveat):**

- **Eager whole-subtree materialization.** `<input webkitdirectory>` produces a `FileList` snapshot
  that exposes **every** file under the chosen directory at selection time. For a 10 GB /
  32,738-file export the browser materializes all 32,738 `File` objects on the main thread **before
  any of our JS runs** — an OOM/tab-freeze risk we cannot guard against (perf design rev2 §1.6).
  The FSA path, by contrast, enumerates lazily, so the allow/deny filter runs _before_ most handles
  ever exist.
- **No durable handle / no incremental re-read.** It produces a one-shot snapshot with nothing to
  persist — which is _more_ privacy-preserving but loses resume/incremental-import, and is moot
  given the OOM blocker above.

**Future small-import affordance only.** `webkitdirectory` may later be reintroduced for a
**bounded, small** manual import (e.g. a handful of user-selected CSVs), **provided** the same
guards apply: the allowlist (§2) is still enforced, files are streamed not `.text()`-ed (§5.1), and
a hard file-count/total-size cap prevents the eager-materialization OOM. It is **not** a v1 ingest
path and **not** a way to ingest the full export.

Whichever path is used, the invariant is the same: **we enumerate, filter by allow/deny list, and
only then read the bytes of allowlisted files.**

---

## 2. PII / sensitive-data minimization (allowlist + denylist)

The strongest privacy control here is **never opening denylisted files**. Enforcement happens at
**enumeration time**: as we walk the directory tree, each entry's relative path is matched against
the allowlist; non-matches are skipped and **never read, never passed to the parser, never logged**.

### 2.1 ALLOWLIST (the only paths the ingestion worker may open)

Derived from catalog §5 MUST-HAVE. **Match on relative-path prefix + exact filename anchoring — not
loose substring globs.** Suggested canonical patterns (case-sensitive, anchored at the export root):

| Category                 | Allowed path / glob                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Sleep sessions/stages    | `Global Export Data/sleep-*.json`                                                                                   |
| Sleep TZ anchor          | `Health Fitness Data_GoogleData/UserSleeps_*.csv`, `.../UserSleepStages_*.csv`                                      |
| Sleep score              | `Sleep Score/sleep_score.csv`                                                                                       |
| SpO2                     | `Oxygen Saturation (SpO2)/Minute SpO2 - *.csv`, `.../Daily SpO2 - *.csv`                                            |
| Resting HR               | `Global Export Data/resting_heart_rate-*.json`                                                                      |
| HR (aggregate-on-ingest) | `Global Export Data/heart_rate-*.json`                                                                              |
| HRV                      | `Heart Rate Variability/Heart Rate Variability Details - *.csv`, `.../Daily Heart Rate Variability Summary - *.csv` |
| Respiratory rate         | `Heart Rate Variability/Daily Respiratory Rate Summary - *.csv`, `.../Respiratory Rate Summary - *.csv`             |
| Readiness                | `Daily Readiness/Daily Readiness Score - *.csv`                                                                     |
| Stress                   | `Stress Score/Stress Score.csv`                                                                                     |
| Snore/noise              | `Snore and Noise Detect/Snore Details - *.csv`                                                                      |
| Activity/AZM             | `Global Export Data/steps-*.json`, `.../*_active_minutes-*.json`, `Active Zone Minutes (AZM)/*.csv`                 |
| Temperature              | `Temperature/Computed Temperature - *.csv`, `Physical Activity_GoogleData/body_temperature_*.csv`                   |

> **Empirical nit (must-not-match) — `daily_heart_rate_zones.csv`.** A naive heart-rate glob such as
> `*heart_rate*` would wrongly match **`Global Export Data/daily_heart_rate_zones.csv`**, which is
> **out of scope** and is the **single largest file in the export (~38 MB)** with pseudo-JSON cells
> that throw on `JSON.parse` (catalog §4; perf design rev2 §1.3). The allowlist patterns above are
> deliberately **exact-anchored** (`resting_heart_rate-*.json`, `heart_rate-*.json`, the HRV/zone
> directories spelled out) so that `daily_heart_rate_zones.csv` does **not** match any entry.
> **Do not** broaden any allowlist pattern to a loose `*heart_rate*`/`*heart*` substring glob — that
> regression would pull a 38 MB out-of-scope, parse-hostile file into the worker. A classifier
> unit test MUST assert `classify('Global Export Data/daily_heart_rate_zones.csv') === 'ignored'`.

Everything not matching an allowlist entry is **ignored by default** — the allowlist is a
default-deny mechanism. The denylist below is therefore partly belt-and-suspenders, but it is worth
encoding explicitly so the intent is documented and so an accidental allowlist broadening can't
silently pull in a sensitive directory.

### 2.2 DENYLIST (never read, even if a future allowlist change would match)

Encode as an explicit `NEVER_READ` set checked _before_ the allowlist:

| Category                                 | Path / glob                                                                                                                                                                                                                                            | Why                                                        |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| Profile PII                              | `Your Profile/*`                                                                                                                                                                                                                                       | name, email, DOB, country (catalog §1.12)                  |
| Demographics                             | `**/UserDemographicData*`, `**/UserProfileData*`, `**/UserLocationCountry*`, `Global Export Data/demographic_vo2_max-*` (VO2max value is fine but the _demographic_ profile rows are PII — treat the `Demographic*`/`UserProfile*` entities as denied) | identity/demographics                                      |
| GPS / location                           | `Physical Activity_GoogleData/gps_location_*`, `.../live_pace_*`                                                                                                                                                                                       | precise location tracks                                    |
| Social graph                             | `Social/*`, `Fitbit Friends/*`, `Blocked Users/*`                                                                                                                                                                                                      | relationships                                              |
| Account / security                       | `Account/*`, `Security/*`, `Notifications/*`                                                                                                                                                                                                           | credentials-adjacent, identity                             |
| Commerce / discover                      | `Commerce/*`, `Discover/*`, `Surveys/*`, `Premium/*`, `Guided Programs/*`                                                                                                                                                                              | non-clinical, PII-bearing                                  |
| Menstrual health                         | `Menstrual Health/*`                                                                                                                                                                                                                                   | sensitive reproductive health — **opt-in only** (see §2.4) |
| Medical / journal / food / conversations | `**/MedicalRecords*`, `**/UserJournalEntries*`, `**/UserFoodFrequencyEntries*`, `**/UserConversations*`, `Stress Journal/*`                                                                                                                            | free-text, highly sensitive, out of scope                  |

> **Note on `gps_location`/`live_pace`:** these are the only location data in the export and have no
> sleep-correlation value (catalog §5). They are categorically denied — there is no legitimate
> reason for this app to read GPS tracks.

### 2.3 Enforcement in code

```js
// Pseudocode — enforced at enumeration time, before any read.
function classify(relPath) {
  if (NEVER_READ.some((rx) => rx.test(relPath))) return 'denied'; // hard stop
  if (relPath.startsWith('Menstrual Health/')) {
    return menstrualOptIn ? 'allowed' : 'denied'; // opt-in gate
  }
  // ALLOWLIST entries are exact-anchored prefix/filename patterns, NOT loose substring globs:
  // e.g. /^Global Export Data\/heart_rate-.*\.json$/, NOT /heart_rate/ —
  // the latter would match the 38 MB out-of-scope daily_heart_rate_zones.csv.
  if (ALLOWLIST.some((rx) => rx.test(relPath))) return 'allowed';
  return 'ignored'; // default-deny
}

async function* walk(dirHandle, prefix = '') {
  for await (const [name, handle] of dirHandle.entries()) {
    const rel = prefix + name;
    if (handle.kind === 'directory') {
      // Prune denied directories WITHOUT descending into them.
      if (NEVER_READ.some((rx) => rx.test(rel + '/'))) continue; // never even list children
      yield* walk(handle, rel + '/');
    } else if (classify(rel) === 'allowed') {
      yield handle; // only allowed files reach the parser
    }
  }
}
```

Invariants the security review will check:

- Denied **directories are pruned, not descended** — we never enumerate, never `getFile()`, never
  `.text()` their contents.
- A file handle reaches the parser **only** via the `'allowed'` branch.
- The classifier is pure and unit-tested with adversarial paths (path traversal-style `..`,
  case variants, nested denied dirs under allowed parents, **and the `daily_heart_rate_zones.csv`
  must-not-match case from §2.1**).

### 2.4 Transparency to the user

- **Pre-ingest disclosure:** before reading, show a concise, scrollable list: _"We will read only
  these categories: Sleep, SpO2, Heart rate, HRV, Respiratory rate, Readiness, Stress, Snore,
  Activity, Temperature. We will NOT read: your profile, GPS/location, social, account, commerce,
  medical records, journals."_ This is the consent surface for **what** is read (distinct from the
  **persistence** consent in §3).
- **Post-ingest receipt:** show counts of files read per category and files skipped, so the user can
  verify the app honored its allowlist (e.g. "Skipped 90 GPS files, 2 profile files").
- **Menstrual health opt-in:** off by default, behind its own checkbox with its own sensitivity
  notice. Even though it's clinically adjacent, it is reproductive-health data the user must
  affirmatively choose to include.

---

## 3. At-rest persistence & encryption

### 3.1 What persists

Per catalog §3/§4: **only derived data** persists — nightly rollups (per-night stage minutes,
efficiency, sleep score, nightly SpO2 mean/min/%-below-90, nightly HR min/avg/max + zones, nightly
HRV/RR, readiness, stress, snore-minute counts, daily activity, nightly temp deviation) plus
optional per-minute-within-night arrays for drill-down. **Raw HR/SpO2/HRV streams are never
persisted** (D4). After aggregation the whole correlation store is **megabytes, not gigabytes**.

These rollups are still **PHI** (sleep architecture, oxygenation, heart-rate health signals).

### 3.2 The existing baseline (decisive context)

`src/utils/db.js#putLastSession` stores the CPAP session object **unencrypted** in IndexedDB,
gated only by the consent flag from `src/utils/storageConsent.js` + `StorageConsentDialog.jsx`.
There is **no at-rest encryption of CPAP PHI today.** Meanwhile the prior Fitbit path
(`fitbitDb.js`) carried AES-GCM encryption _and_ a passphrase backup that was flagged broken/insecure
(removed in commit `e65e3c0`), plus an `encryptionEnabled=false` "actually unencrypted in this case"
dev fallback (`fitbitDb.js` lines 170–177) — i.e. the encryption was inconsistently applied and
fragile.

### 3.3 Recommendation (D5): match the CPAP baseline — consented, unencrypted, single model

**Store wearable nightly rollups unencrypted in IndexedDB, gated by the same explicit consent
mechanism already used for CPAP data. Do not reintroduce passphrase-derived at-rest encryption for
this store.**

Reasoning:

1. **Consistency beats partial protection.** Having CPAP PHI in plaintext while Fitbit-derived PHI
   is encrypted is incoherent: an attacker with IndexedDB access already has the CPAP data, and the
   two are explicitly correlated by this app. A passphrase only on half the PHI is theater.
2. **The prior encrypted path was the fragile thing.** The passphrase backup was the documented
   security defect. Browser-side passphrase encryption has a fundamental key-storage problem: the
   key must be derived from a user passphrase on every load (UX friction, lost-passphrase = lost
   data, no recovery without storing the key — which defeats it). The earlier attempt to "back up"
   the passphrase is exactly the anti-pattern to avoid repeating.
3. **At-rest encryption in a browser SPA protects against a narrow threat** (another local user /
   forensic disk read of the IndexedDB files) and not against the realistic threats (malicious
   extension, XSS — both run in-origin and would have the passphrase/derived key anyway). For those
   realistic threats, CSP + code hygiene (§4, §5) are the effective controls.

**Keep `encryption.js` in the codebase** — it remains the right tool for its actual purpose:
**user-initiated encrypted export/import** of a session bundle to move data between devices
(`exportImport.js`). That is a deliberate, user-driven act with a passphrase the user holds for the
duration of the transfer, and a wrong/lost passphrase only costs that one export, not the whole
local store. Do **not** wire it into the IndexedDB write path.

### 3.4 Consent dialog & lifecycle updates

- **Reuse `StorageConsentDialog.jsx`**, updated copy: it currently says _"All imported OSCAR CSV
  data (AHI, SpO2, pressure, dates)."_ Extend the "This includes" list to: _"Wearable-derived
  nightly summaries (sleep stages, SpO2, heart rate, HRV, readiness, stress, snore, activity,
  temperature)."_ Keep the privacy-safe default (focus on "Don't Save").
- **Default = do not persist.** As today, nothing is written until the user explicitly chooses
  "Save to Browser." A user can analyze their export in a fully ephemeral session.
- **Deletion:** extend the existing clear-data flow to also clear the wearable rollup store **and**
  the optional `export_handle` / `wearable_meta` `dirHandle` store (§1.2). One "Delete all my data"
  action must remove CPAP sessions, wearable rollups, the directory handle, and consent flags.
- **No silent dev-mode unencrypted writes.** Remove the `fitbitDb.js` `encryptionEnabled` dual path;
  the new store has a single, documented persistence model.

### 3.5 Alternative (if the project later decides PHI-at-rest must be encrypted)

If a future ADR mandates at-rest encryption, do it **uniformly across CPAP and wearable stores**
with a **non-extractable key** strategy, not a user passphrase: generate a `CryptoKey` via
`crypto.subtle.generateKey` with `extractable: false` and store the `CryptoKey` object itself in
IndexedDB (it is structured-cloneable and the raw bits never leave the browser). This removes the
passphrase-UX/lost-data problem entirely while still encrypting the at-rest blobs. This is a
larger, cross-cutting change and is **out of scope for v1** — flagged here so it isn't reinvented
ad hoc.

---

## 4. Local-first / network guarantees

### 4.1 No network egress of health data

The ingestion pipeline performs **zero network requests**. Confirm by construction:

- Parsing is `FileSystemFileHandle.getFile()` → `File.stream()`/`.text()` → Web Worker. No `fetch`,
  no `XMLHttpRequest`, no `navigator.sendBeacon`, no WebSocket in the ingestion or correlation code
  paths.
- With OAuth removed (§6), **there are no longer any legitimate external endpoints** in the app.

### 4.2 CSP hardening (D6)

Current `index.html` CSP includes `connect-src 'self' https://api.fitbit.com`. **Remove the Fitbit
endpoint.** Target directive:

```
connect-src 'self';
```

Full recommended policy (rest is already good — keep it):

```
default-src 'self';
script-src 'self';
worker-src 'self' blob:;
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
font-src 'self' data:;
connect-src 'self';
object-src 'none';
base-uri 'self';
form-action 'none';
frame-ancestors 'none';
upgrade-insecure-requests
```

- Also **delete the Fitbit-API exception comment block** in `index.html` (it documents a permission
  that no longer exists).
- `connect-src 'self'` makes the local-first guarantee **CSP-enforced and auditable**: any
  accidental attempt to POST health data to an external host is blocked by the browser, not merely
  by code review. This is the single most valuable enforcement the rework enables.
- `worker-src 'self' blob:` stays (Vite/worker bundles). `style-src 'unsafe-inline'` is a pre-
  existing Plotly/inline-style allowance — out of scope to change here, but note it for the security
  review as the one remaining CSP relaxation.
- Consider adding a build/CI check that greps the built bundle for `api.fitbit.com`, `fetch(`,
  `XMLHttpRequest`, `sendBeacon` outside of test files, to keep the no-egress property from
  regressing. (Recommend `readiness-reviewer` add this to the merge gate.)

### 4.3 Remove Fitbit endpoints from any allowlist/config

Grep and remove `api.fitbit.com` and any OAuth redirect/authorize/token URLs from CSP, constants,
and env/config. There should be **no** `https://*.fitbit.com` reference left in shipped code.

---

## 5. Threat model & resilience

### 5.1 Malformed / hostile files (DoS + crashes)

The catalog (§4) documents real hazards in this very export. The ingestion worker must treat
**every file as untrusted input**:

| Hazard (catalog §4)                                                                           | Required handling                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Invalid pseudo-JSON in CSV cells (unquoted enum tokens), comma-joined objects w/o `[]`        | Never `JSON.parse` blindly on cell contents; for `daily_heart_rate_zones.csv` and array-in-cell fields use tolerant custom parsing or **skip**. (Note: `daily_heart_rate_zones.csv` is also out of scope and must not match the allowlist — §2.1.) A parse failure on one cell must not abort the file. |
| Epoch-1970 placeholder timestamps                                                             | Treat as sentinel/invalid; never as real dates. Validate date ranges.                                                                                                                                                                                                                                   |
| Array-in-cell (HRV histogram, ECG samples)                                                    | Parse as bounded array; cap element count; don't allocate unbounded.                                                                                                                                                                                                                                    |
| Giant files (HR 6.1 GB)                                                                       | **Stream + chunk** (`File.stream()` / PapaParse streaming), aggregate incrementally, never `.text()` a multi-GB file. Bound peak memory. **Coordinate with `performance-optimizer`** on chunk size, backpressure, and a per-file/total size cap to prevent OOM/DoS.                                     |
| String-typed numeric `value` fields                                                           | Cast with NaN/empty guards; never trust types.                                                                                                                                                                                                                                                          |
| Empty/header-only files (Glucose "no data")                                                   | Detect and skip; never crash on zero rows.                                                                                                                                                                                                                                                              |
| Filename/schema drift (`- 2020-11-(15).csv`, classic vs stages, README-ahead-of-file columns) | Tolerant matching; degrade gracefully (missing feature ≠ error).                                                                                                                                                                                                                                        |

**Bounded-resource rules:**

- Per-file soft cap and aggregate cap (configurable); files over cap are streamed-and-aggregated,
  never fully buffered. Surface a friendly message if a single file is absurdly large (possible
  hostile/corrupt input) rather than freezing the tab.
- No unbounded recursion: cap directory walk depth and total file count; a pathological deeply-
  nested tree must not hang enumeration.

### 5.2 Untrusted directory (user points at a non-export folder)

Covered in §1.3: validate the root looks like a Google Health export; if not, warn and ingest only
recognized allowlisted files (likely zero) rather than recursing arbitrary user folders. **Never
read files outside the allowlist even if the directory is unexpected.**

### 5.3 Logging — no PHI in console or errors (D7)

Adopt the existing **"Safe message" convention** (`sanitizeErrorMessage` in `csv.worker.js`) across
the new ingestion worker:

- **Never log raw cell values, health metrics, file contents, or sample data** to console or in
  thrown error messages. The earlier code's habit of generic, sanitized messages
  (`exportImport.js`, `ImportDataModal.jsx`, `csv.worker.js`) is the standard to enforce.
- **Allowed to log (metadata only):** file/category being processed (path is borderline — prefer
  category name + a counter over full path, since a path can embed identity in some exports; for
  this Google export the paths are category names so path-logging is acceptable but values are
  not), row counts, parse-failure _counts_, schema-drift flags, timing.
- Worker `postMessage` error payloads back to the main thread must be sanitized strings, not raw
  `Error` objects that may stringify a sensitive excerpt. Mirror `csv.worker.js` lines 87–169.
- **Dev-only verbose logging** may include more detail behind `import.meta.env.DEV`, but still must
  not dump raw PHI values; gate any value-level logging out of production builds.

### 5.4 Web Worker data hygiene

- Pass file handles / streams to the worker; have the worker aggregate and return **only rollups**.
- After producing rollups, drop references to raw chunks so GC can reclaim them; do not retain the
  full parsed dataset on the main thread.
- Ensure no leakage of one file's buffers into another's processing (per-file scoped state). The
  worker handles one export ingestion; verify no cross-file residue in shared module state.

---

## 6. Security wins from the rework (for the ADR)

Deleting the OAuth/API integration **removes attack surface** — enumerate this explicitly in the
ADR as a benefit:

1. **No OAuth tokens at rest.** The `fitbit_tokens` IndexedDB store (access + refresh tokens,
   `fitbitDb.js`) is **deleted**. No long-lived refresh token to steal.
2. **No refresh-token lifecycle.** No silent token refresh, no token-rotation bugs, no expiry
   handling that can leak credentials in logs/errors.
3. **No PKCE / OAuth state handling.** No `code_verifier`/`state` to generate, store, or validate;
   no CSRF-on-callback surface, no redirect-URI validation burden.
4. **No redirect / callback handling.** The OAuth redirect flow (`fitbitOAuth.js`, `fitbitAuth.js`)
   and its callback-parsing code — a classic injection/open-redirect surface — is gone.
5. **No external API egress.** `https://api.fitbit.com` is removed from CSP (§4.2). The app makes
   **zero** outbound health-data requests; local-first becomes provable, not aspirational.
6. **The insecure passphrase backup is eliminated.** The flagged-broken passphrase backup
   (removed in `e65e3c0`) and the inconsistent `encryptionEnabled` dual-write path
   (`fitbitDb.js` lines 170–177) are removed along with the store, ending that fragile design.
7. **Smaller dependency / code surface.** Auth, sync, and API-client modules
   (`fitbitAuth.js`, `fitbitApi.js`, `fitbitOAuth.js`, `fitbitSync.js`, parts of `fitbitDb.js`)
   are deletable, reducing maintenance and audit scope.

**Cleanup checklist (delegate to `frontend-developer`, verify with `readiness-reviewer`):**

- Delete `fitbitAuth.js`, `fitbitApi.js`, `fitbitOAuth.js`, `fitbitSync.js` and their tests.
- Remove the `fitbit_tokens` (and migrate/repurpose `fitbit_data`) object stores; bump `DB_VERSION`
  with a clean upgrade that drops the token store.
- Remove `https://api.fitbit.com` from `index.html` CSP and delete the exception comment.
- Grep the repo for residual `fitbit.com`, OAuth, `refresh_token`, `code_verifier` references.

---

## 7. What the later security review must verify (acceptance criteria)

1. `showDirectoryPicker({ mode: 'read' })`; no write grant ever requested. Feature gated on
   `'showDirectoryPicker' in window`; **non-Chromium → unsupported empty-state, no
   `webkitdirectory` full-export fallback**.
2. Handle **not** persisted by default; opt-in path uses `queryPermission`/`requestPermission`
   behind a user gesture; "Forget folder" works.
3. Allowlist/denylist classifier is pure, unit-tested with adversarial paths; **denied directories
   are pruned, never descended**; only `'allowed'` files reach the parser; **the allowlist uses
   exact dir/prefix matching and does NOT match the 38 MB out-of-scope
   `daily_heart_rate_zones.csv`** (explicit must-not-match test).
4. Transparency surfaces present (pre-ingest "we read only…", post-ingest skip receipt, menstrual
   opt-in off by default).
5. Only derived rollups persist; raw HR/SpO2/HRV never written to IndexedDB.
6. Persistence gated by explicit consent; default is no-persist; one-action full delete clears
   rollups + handle + consent.
7. CSP = `connect-src 'self'`; no `fitbit.com` anywhere in shipped bundle; CI grep guard in place.
8. Worker resilient to all §5.1 hazards; bounded memory; no PHI in console/errors;
   `sanitizeErrorMessage`-style sanitization on all worker error payloads.
9. All Fitbit auth/API/token code and stores deleted; ADR records the §6 removed attack surface.

---

## 8. Open items to coordinate (for the orchestrator)

- **`performance-optimizer`:** chunk/stream strategy and per-file/total size caps for the 6.1 GB HR
  data (DoS-via-giant-file + OOM bounds). Tightly coupled to §5.1. Also owns the rationale that
  `webkitdirectory` is rejected for v1 (eager 32,738-`File` materialization — perf design rev2 §1.6).
- **`adr-specialist`:** ADR-0005 records (a) the Chromium-only file-access decision and handle-
  persistence default, (b) the persistence decision D5 (consented-unencrypted, matching CPAP
  baseline; passphrase-encryption deliberately rejected) and (c) the §6 removed-attack-surface
  benefits. All are hard-to-reverse / high-impact. This design doc is now aligned to ADR-0005 rev2.
- **`testing-expert`:** adversarial-path tests for the classifier (including the
  `daily_heart_rate_zones.csv` must-not-match case); malformed-file fixtures (synthetic, per catalog
  §4 shapes — never real values); a "no network call during ingestion" test; a "denied directory
  never read" test; an "unsupported empty-state on non-Chromium" test.
- **`frontend-developer`:** picker + capability-gate/empty-state (no `webkitdirectory` fallback),
  classifier, worker, consent-dialog copy update, and the §6 deletion checklist.
- **`documentation-specialist`:** README/privacy docs update — new local-first ingestion story, the
  Chromium-only requirement, the "we read only these categories" guarantee, and removal of all
  Fitbit-OAuth references.
