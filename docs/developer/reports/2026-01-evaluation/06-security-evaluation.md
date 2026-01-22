# Security & Privacy Evaluation — OSCAR Export Analyzer

**Date**: January 22, 2026  
**Evaluator**: Security Auditor Agent  
**Status**: Evaluation Only — No Code Changes

---

## Executive Summary

OSCAR Export Analyzer demonstrates a **strong local-first privacy architecture** with several security hardening measures already in place. The application successfully maintains a critical design constraint: **all sensitive health data remains on the user's device and never leaves the browser**. This is a significant strength for a tool handling Protected Health Information (PHI) like sleep therapy metrics.

However, the evaluation identifies several **medium and low-severity gaps** in input validation, error message information disclosure, and documentation of privacy guarantees. The application would benefit from explicit file size validation, hardened CSV parsing error handling, and more comprehensive security documentation for users. Overall, the security posture is **solid for a browser-based SPA** with room for incremental improvements in defensive programming practices.

---

## Threat Model for Local-First Medical Data Analyzer

### Key Assumptions

- Users understand that CSV exports contain sensitive personal health information (PHI)
- Application runs in a single browser context; no multi-user or shared-session scenarios
- Users operate on personal devices with typical browser security (CSP, sandbox, CORS)
- Local storage (IndexedDB, localStorage) is readable by scripts running in the same origin
- No network communication is intended or acceptable

### Primary Threat Vectors

1. **Unintended Data Disclosure via Console/Logs**: Sensitive metrics logged to console during debugging
2. **CSV Data Persistence**: Sensitive CSV files persisted to IndexedDB without explicit user consent or encryption
3. **Export/Print Data Leakage**: Exported files containing more data than user intended
4. **Malicious CSV Injection**: Specially crafted CSV files exploiting parsing logic or Web Worker
5. **Web Worker Message Interception**: Health data in postMessage() calls visible to browser dev tools
6. **Error Message Information Disclosure**: Stack traces or error details revealing internal structure or data samples
7. **Session Hijacking via Shared Browser**: Session JSON files accessible to other users on shared devices
8. **XSS via Markdown Documentation**: User guide markdown containing scripts or event handlers
9. **Dependency Vulnerabilities**: Transitive dependencies with unpatched security issues
10. **IndexedDB Access by Malicious Extensions**: Browser extensions accessing IndexedDB data

---

## Detailed Findings

### 1. PHI/PII Handling — CSV Data Storage & Persistence

#### Finding 1.1: CSV Data Automatically Persisted to IndexedDB

**Severity**: **Medium**  
**Location**: [src/hooks/useSessionManager.js](../../src/hooks/useSessionManager.js), [src/utils/db.js](../../src/utils/db.js), [src/utils/session.js](../../src/utils/session.js)  
**Vulnerability**: Raw CSV data (both `summaryData` and `detailsData` arrays) containing complete health metrics are automatically serialized and stored to IndexedDB every 500ms when data changes.

```javascript
// From src/utils/session.js
buildSession() returns {
  summaryData,   // Raw CSV rows with AHI, EPAP, usage hours, etc.
  detailsData,   // Raw CSV rows with Event timestamps, durations
  // ...
}
```

**Potential Impact**:

- Health data persists across browser sessions unless user explicitly clears storage
- IndexedDB is not encrypted by default in any browser; data is readable in plaintext
- User may not realize data is being saved to disk
- If device is stolen or accessed by another user, sensitive metrics are exposed
- Browser devtools can directly inspect IndexedDB contents

**Recommendation**:

1. **Explicit Opt-In**: Require users to explicitly consent to persistent storage before auto-saving sessions
2. **Encryption at Rest**: Consider encrypting IndexedDB data with a user-controlled passphrase (e.g., using TweetNaCl.js or libsodium.js)
3. **Warning Banner**: Display a persistent warning when data is saved to IndexedDB
4. **Clear Data Guidance**: Document how to clear browser storage and provide an in-app button with confirmation
5. **Session-Only Mode**: Offer a "temporary analysis" mode that doesn't persist to storage

#### Finding 1.2: Session JSON Contains Raw CSV Data

**Severity**: **Medium**  
**Location**: [src/utils/session.js](../../src/utils/session.js), [src/app/useAppState.js](../../src/app/useAppState.js)  
**Vulnerability**: When users export a session as JSON (`handleExportJson`), the file contains the raw CSV rows, including all therapy data.

```javascript
// From src/utils/session.js line 25-26
summaryData,  // Full array of summary rows
detailsData,  // Full array of event rows
```

**Potential Impact**:

- Exported JSON files contain complete health dataset
- Users may accidentally share these files via email, cloud storage, or messaging apps
- File naming (`oscar_session.json`) doesn't indicate sensitive content
- No watermark or warning in the file itself

**Recommendation**:

1. **File Naming**: Rename to something like `oscar_session_PHI.json` to signal sensitivity
2. **Export Warning**: Show a confirmation dialog warning that the file contains sensitive health data
3. **Optional Data Exclusion**: Add a checkbox to export analysis parameters without raw data
4. **Documentation**: Update user guide section 01-getting-started.md to explicitly warn about file sensitivity

#### Finding 1.3: Data Lifecycle Documentation Gap

**Severity**: **Low**  
**Location**: [README.md](../../../../README.md), [docs/user/01-getting-started.md](../../../../docs/user/01-getting-started.md)  
**Vulnerability**: Documentation does not explicitly explain when/how data is stored, how long it persists, or how to delete it.

**Potential Impact**:

- Users unaware data auto-saves to IndexedDB
- Misconception that closing tab deletes data (it doesn't)
- Confusion about what "session" means

**Recommendation**:

1. **Data Lifecycle Document**: Add a new section to docs/user/01-getting-started.md explaining:
   - When data is saved (on upload, on parameter change)
   - Where it's stored (browser IndexedDB only)
   - How long it persists (until cleared via menu or browser storage settings)
   - How to delete it (manual deletion, incognito/private mode)
2. **Update README**: Clarify IndexedDB persistence in the "Data Privacy" section

---

### 2. Local-First Privacy — Client-Side Processing

#### Finding 2.1: ✅ No Network Requests Detected

**Severity**: **Low (Not a Finding — Positive)**  
**Location**: All files  
**Status**: Confirmed no `fetch()`, `XMLHttpRequest`, or external API calls in codebase.

**Analysis**: The application correctly implements local-first processing:

- CSV parsing occurs in Web Worker ([src/workers/csv.worker.js](../../src/workers/csv.worker.js))
- Analytics processing occurs in Web Worker ([src/workers/analytics.worker.js](../../src/workers/analytics.worker.js))
- All calculations performed client-side
- No telemetry, crash reporting, or analytics services

**Positive Finding**:
This is a significant privacy strength. Health data never leaves the device. Users can operate in airplane mode or disable network entirely.

---

### 3. Data Storage Security — IndexedDB & localStorage

#### Finding 3.1: localStorage Used for Non-Sensitive Theme Preference

**Severity**: **Low**  
**Location**: [src/context/DataContext.jsx](../../src/context/DataContext.jsx#L25-L43)  
**Usage**: `window.localStorage.getItem('theme')` stores only the theme preference (`'system'`, `'light'`, or `'dark'`)

**Analysis**: Appropriate use of localStorage for non-sensitive UI state. No health data is stored here.

**Status**: ✅ No Finding

#### Finding 3.2: IndexedDB Encryption Gap

**Severity**: **Medium**  
**Location**: [src/utils/db.js](../../src/utils/db.js)  
**Vulnerability**: IndexedDB is used to store raw CSV data without encryption. Stored data is plaintext and visible to:

- Browser devtools
- Browser extensions with storage access
- Forensic analysis of device storage

**Potential Impact**:

- Confidentiality loss if device is stolen or examined
- Data exposure from malicious browser extensions

**Recommendation**:

1. **Short-term**: Add explicit warning in UI when data is saved to IndexedDB
2. **Medium-term**: Implement client-side encryption using a lightweight library (TweetNaCl.js, NaCl.js, or libsodium.js)
3. **Key Management**: If implementing encryption, use a user-derived key (password) or device key
4. **Documentation**: Clearly document that IndexedDB data is not encrypted by default

---

### 4. Input Validation — CSV Parsing & File Handling

#### Finding 4.1: No File Size Validation

**Severity**: **Medium**  
**Location**: [src/hooks/useCsvFiles.js](../../src/hooks/useCsvFiles.js), [src/workers/csv.worker.js](../../src/workers/csv.worker.js)  
**Vulnerability**: No maximum file size limit enforced before passing file to CSV parser.

```javascript
// From src/hooks/useCsvFiles.js line 72-76
const file = extractFirstFile(input);
if (!file) return;
// No size check here
worker.postMessage({ file, filterEvents });
```

**Potential Impact**:

- Extremely large CSV files (100+ MB) could cause memory exhaustion or browser crash
- Denial of service via malformed multi-gigabyte file
- Performance degradation for other browser tabs
- User unable to recover if app hangs

**Recommendation**:

1. **Size Validation**: Reject files larger than reasonable limit (e.g., 50–100 MB)
2. **User Feedback**: Show error message if file exceeds limit
3. **Suggested Approach**:
   ```javascript
   const MAX_FILE_SIZE_MB = 50;
   if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
     setError(`File exceeds ${MAX_FILE_SIZE_MB}MB limit`);
     return;
   }
   ```

#### Finding 4.2: CSV Parser Error Messages Not Sanitized

**Severity**: **Low**  
**Location**: [src/hooks/useCsvFiles.js](../../src/hooks/useCsvFiles.js#L95-L98), [src/workers/csv.worker.js](../../src/workers/csv.worker.js#L43-44)  
**Vulnerability**: Error messages from CSV parser are passed directly to UI without sanitization.

```javascript
// From src/workers/csv.worker.js
error(err) {
  self.postMessage({ type: 'error', error: err?.message || String(err) });
}
```

**Potential Impact**:

- If PapaParse encounters a malformed CSV with unusual characters, error message could contain data samples
- Unlikely to cause XSS (React auto-escapes), but could leak partial data in error messages
- Stack traces might expose internal file paths or function names

**Recommendation**:

1. **Generic Error Messages**: Replace detailed error messages with generic ones:
   ```javascript
   self.postMessage({
     type: 'error',
     error: 'Failed to parse CSV. Check file format and encoding.',
   });
   ```
2. **Detailed Logging**: Log full error details to browser console for debugging (behind a debug flag)

#### Finding 4.3: CSV Header Validation Not Enforced

**Severity**: **Low**  
**Location**: [src/workers/csv.worker.js](../../src/workers/csv.worker.js), [src/components/ui/DataImportModal.jsx](../../src/components/ui/DataImportModal.jsx#L32-36)  
**Vulnerability**: CSV files are classified as "summary" or "details" based on simple header keyword matching (`/event/i`), but no validation that required columns exist.

```javascript
// From src/components/ui/DataImportModal.jsx
const header = text.split(/\r?\n/)[0];
return /event/i.test(header) ? 'details' : 'summary';
```

**Potential Impact**:

- Malformed CSV with wrong headers could be accepted and cause parsing errors later
- No early warning to user that file is invalid

**Recommendation**:

1. **Header Validation**: Check that required columns are present
2. **Fail-Fast Approach**: Reject file if headers don't match expected schema
3. **Suggested Implementation**:

   ```javascript
   const SUMMARY_REQUIRED = ['Date', 'AHI'];
   const DETAILS_REQUIRED = ['Event', 'DateTime'];

   function validateHeaders(headers, type) {
     const required = type === 'summary' ? SUMMARY_REQUIRED : DETAILS_REQUIRED;
     return required.every((col) => headers.includes(col));
   }
   ```

---

### 5. XSS Vulnerabilities — User Input Sanitization

#### Finding 5.1: ✅ DOMPurify Used for Markdown Rendering

**Severity**: **Low (Not a Finding — Positive)**  
**Location**: [src/components/ui/DocsModal.jsx](../../src/components/ui/DocsModal.jsx#L106)  
**Status**: Confirmed DOMPurify sanitization is applied to rendered markdown HTML.

```javascript
const html = DOMPurify.sanitize(rawHtml);
```

**Analysis**: The application correctly prevents XSS in the documentation modal by sanitizing HTML rendered from markdown. ESLint rule `no-unsanitized/property` is configured to flag unsafe assignments.

**Test Coverage**: [src/components/ui/DocsModal.test.jsx](../../src/components/ui/DocsModal.test.jsx#L36-44) validates malicious markdown is sanitized.

**Status**: ✅ No Finding

#### Finding 5.2: No innerHTML Usage Detected

**Severity**: **Low (Not a Finding — Positive)**  
**Location**: All files  
**Status**: No instances of `innerHTML`, `dangerouslySetInnerHTML`, or `eval()` detected outside of intentional DOMPurify-sanitized context.

**Status**: ✅ No Finding

#### Finding 5.3: ESLint Security Plugin Configured

**Severity**: **Low (Not a Finding — Positive)**  
**Location**: [eslint.config.js](../../eslint.config.js#L44)  
**Status**: `eslint-plugin-no-unsanitized` is configured and enforced in linting.

```javascript
'no-unsanitized': noUnsanitizedPlugin,
```

**Status**: ✅ No Finding

---

### 6. Dependency Security — Supply Chain Risk

#### Finding 6.1: Security-Relevant Dependencies Identified

**Severity**: **Low**  
**Location**: [package.json](../../package.json)  
**Analysis**: Key security-relevant dependencies:

| Dependency       | Version | Purpose                     | Risk                                                  |
| ---------------- | ------- | --------------------------- | ----------------------------------------------------- |
| `dompurify`      | ^3.2.7  | XSS prevention for markdown | **Low** — well-maintained security library            |
| `papaparse`      | ^5.3.2  | CSV parsing                 | **Low** — established library, no recent vulns        |
| `react`          | ^19.1.1 | UI framework                | **Low** — React core has strong security track record |
| `react-markdown` | ^10.1.0 | Markdown rendering          | **Low** — uses remark plugins safely                  |

**Recommendation**:

1. **Regular Audits**: Run `npm audit` regularly (recommended monthly for health data apps)
2. **Automated Dependency Updates**: Enable Dependabot or similar for security patches
3. **Lock File**: Commit `package-lock.json` to ensure reproducible builds

#### Finding 6.2: No npm audit Findings Documented

**Severity**: **Low**  
**Location**: [package.json](../../package.json)  
**Vulnerability**: No evidence of recent `npm audit` run or vulnerability status in documentation.

**Recommendation**:

1. **CI/CD Integration**: Add `npm audit --audit-level=moderate` to CI pipeline
2. **Baseline**: Document current audit status in a `.npmaudit` file or CI log
3. **Pre-commit Hook**: Consider running `npm audit` in Husky pre-commit (already configured)

---

### 7. Browser Security — CSP, CORS, Framing

#### Finding 7.1: No Content Security Policy Configured

**Severity**: **Low**  
**Location**: [index.html](../../index.html), [vite.config.js](../../vite.config.js)  
**Vulnerability**: Application does not define a strict Content Security Policy (CSP).

**Potential Impact**:

- Browser allows inline scripts (default behavior)
- Easier for XSS payloads to execute if any unsanitized HTML is rendered
- External resources could be loaded if accidentally referenced

**Recommendation**:

1. **Define CSP**: Add meta tag to [index.html](../../index.html):
   ```html
   <meta
     http-equiv="Content-Security-Policy"
     content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; 
                  img-src 'self' data:; font-src 'self'; worker-src 'self';"
   />
   ```
2. **Rationale**: Restricts scripts to same-origin, allows Web Worker, blocks external resources
3. **Testing**: Verify CSP doesn't break Web Worker or Plotly charts

#### Finding 7.2: ✅ CORS Configuration Appropriate for SPA

**Severity**: **Low (Not a Finding — Positive)**  
**Location**: N/A — No server-side CORS configuration (app is static SPA)  
**Status**: No CORS vulnerabilities present.

---

### 8. Error Handling — Information Disclosure

#### Finding 8.1: Error Boundary Logs to Console

**Severity**: **Low**  
**Location**: [src/components/ui/ErrorBoundary.jsx](../../src/components/ui/ErrorBoundary.jsx#L11)  
**Vulnerability**: ErrorBoundary logs full error and error info to console.

```javascript
console.error('ErrorBoundary caught an error', error, info);
```

**Potential Impact**:

- Stack traces visible in browser console
- During debugging session, stack traces could reveal internal structure
- If debugging while screen is visible to others, stack traces could leak code organization

**Recommendation**:

1. **Environment Check**: Only log in development mode:
   ```javascript
   if (import.meta.env.DEV) {
     console.error('ErrorBoundary caught an error', error, info);
   }
   ```
2. **User-Facing Error**: Show generic message to user:
   ```javascript
   setError('An unexpected error occurred. Please refresh the page.');
   ```

#### Finding 8.2: Session Import Error Logging

**Severity**: **Low**  
**Location**: [src/hooks/useSessionManager.js](../../src/hooks/useSessionManager.js#L104)  
**Vulnerability**: Session import errors logged to console without filtering.

```javascript
console.error('Session import failed:', err);
```

**Potential Impact**:

- Errors could include serialized session data with health metrics
- Error stack traces visible to anyone viewing console

**Recommendation**:

1. **Generic Logging**: Replace with:
   ```javascript
   if (import.meta.env.DEV) {
     console.error('Session import failed:', err);
   }
   ```
2. **User Feedback**: Show safe error message:
   ```javascript
   setLocalError('Could not import session file. Check file format.');
   ```

#### Finding 8.3: CLI Tool Logs Sensitive Data

**Severity**: **Low**  
**Location**: [analysis.js](../../analysis.js#L37-78)  
**Vulnerability**: The optional Node.js CLI tool (`analysis.js`) logs cluster details including timestamps and durations.

```javascript
console.log(`Cluster ${i + 1}:`);
console.log(`  Start:    ${c.start.toISOString()}`);
console.log(`  Events:`);
c.events.forEach((e) =>
  console.log(`    ${e.type} @ ${e.date.toISOString()} dur=${e.durationSec}s`),
);
```

**Potential Impact**:

- If used on shared servers or with output logs stored centrally, health data could be exposed
- Log files containing sensitive therapy data

**Recommendation**:

1. **Documentation**: Add warning to [analysis.js](../../analysis.js) header:
   ```javascript
   // WARNING: This script outputs sensitive health data to console/stdout.
   // Ensure stdout is not stored in shared logs or version control.
   ```
2. **Optional Verbosity**: Add `--quiet` flag to suppress detailed output
3. **User Guide**: Update docs to warn about CLI privacy implications

---

### 9. Web Worker Security — Message Validation & Data Serialization

#### Finding 9.1: Web Worker Messages Not Validated

**Severity**: **Low**  
**Location**: [src/workers/csv.worker.js](../../src/workers/csv.worker.js#L8-10), [src/workers/analytics.worker.js](../../src/workers/analytics.worker.js#L12-16)  
**Vulnerability**: Web Worker `onmessage` handlers do not validate message structure before processing.

```javascript
// From csv.worker.js
self.onmessage = (e) => {
  const { file, filterEvents } = e.data || {};
  if (!file) return;
  // No validation of e.data.file type
};
```

**Potential Impact**:

- If poisoned message reaches worker, could cause errors or unexpected behavior
- No type checking on message payload
- Error handling could expose details

**Recommendation**:

1. **Message Schema Validation**: Add explicit type checking:
   ```javascript
   self.onmessage = (e) => {
     const { file, filterEvents } = e.data || {};
     if (!(file instanceof File || file instanceof Blob)) {
       self.postMessage({ type: 'error', error: 'Invalid file type' });
       return;
     }
     // proceed
   };
   ```
2. **Action Validation**: In analytics worker, validate action is known
3. **Error Isolation**: Catch all errors and send generic error messages

#### Finding 9.2: ✅ Web Worker Data Cleanup Appropriate

**Severity**: **Low (Not a Finding — Positive)**  
**Location**: [src/hooks/useCsvFiles.js](../../src/hooks/useCsvFiles.js#L31-35)  
**Status**: Worker is properly terminated after use, preventing data from lingering in worker thread.

```javascript
worker.terminate();
```

**Status**: ✅ No Finding

#### Finding 9.3: Analytics Worker Message Handling Defensive

**Severity**: **Low (Not a Finding — Positive)**  
**Location**: [src/workers/analytics.worker.js](../../src/workers/analytics.worker.js#L44-53)  
**Status**: Errors are caught and returned safely without exposing internal details excessively.

**Status**: ✅ No Finding

---

### 10. Export/Download Security — Data Leakage in Exports

#### Finding 10.1: Export Functions Generate Correct Data Sets

**Severity**: **Low**  
**Location**: [src/utils/export.js](../../src/utils/export.js)  
**Analysis**: Export functions correctly generate aggregated CSV without exposing raw data unnecessarily.

**Export Functions**:

- `buildSummaryAggregatesCSV()`: Generates computed metrics (averages, percentiles) from summary data
- `downloadTextFile()`: Creates blob and triggers download

**Positive Finding**: Aggregates CSV exports only computed statistics, not raw therapy details. This is appropriate.

**Status**: ✅ No Finding — Exports are properly scoped

#### Finding 10.2: Print Functionality Exposes All Visible Data

**Severity**: **Low**  
**Location**: [src/App.jsx](../../src/App.jsx#L195)  
**Vulnerability**: `window.print()` will print all visible page content, including raw data tables and charts.

```javascript
onPrint={() => window.print()}
```

**Potential Impact**:

- User might print page with Raw Data Explorer table containing full event details
- Printed pages contain sensitive therapy data if user is not careful
- No warning to user before printing

**Recommendation**:

1. **Print Warning**: Show confirmation dialog before printing:
   ```javascript
   const handlePrint = () => {
     if (
       window.confirm(
         'This will print all visible data including sensitive health information. Continue?',
       )
     ) {
       window.print();
     }
   };
   ```
2. **Print CSS**: Add `@media print` styles to hide sensitive raw data by default
3. **Documentation**: Add guidance in user guide about checking what's visible before printing

#### Finding 10.3: Session JSON File Extension Not Clear About Sensitivity

**Severity**: **Low**  
**Location**: [src/hooks/useSessionManager.js](../../src/hooks/useSessionManager.js#L66)  
**Vulnerability**: Downloaded file is named `oscar_session.json` without indicating it contains health data.

```javascript
a.download = 'oscar_session.json';
```

**Potential Impact**:

- User might casually share file without realizing content sensitivity
- Filename doesn't suggest "PHI" or "sensitive health data"

**Recommendation**:

1. **Better Naming**: Use `oscar_session_PHI.json` or add timestamp: `oscar_session_2026-01-22_PHI.json`
2. **Export Dialog**: Warn user before download that file contains health data
3. **Documentation**: Explain what's in the exported JSON

---

### 11. Print CSS & Sensitive Data Visibility

#### Finding 11.1: No Print-Specific Data Hiding

**Severity**: **Low**  
**Location**: [styles.css](../../styles.css), [guide.css](../../src/guide.css)  
**Vulnerability**: No `@media print` rules to hide sensitive raw data when user initiates print.

**Potential Impact**:

- Raw Data Explorer table (with all therapy details) would print
- User might accidentally print sensitive data

**Recommendation**:

1. **Print Media Query**: Add to main stylesheet:
   ```css
   @media print {
     /* Hide raw data explorer table by default */
     [id='raw-data-explorer'] {
       display: none !important;
     }
     /* Show warning */
     .print-warning {
       display: block;
     }
   }
   ```
2. **User Control**: Provide checkbox "Include raw data" in print dialog
3. **Preview**: Suggest using print preview before confirming

---

## Compliance Considerations

### HIPAA (Health Insurance Portability and Accountability Act)

**Applicability**: If used in clinical or healthcare provider context in the United States.

**Analysis**:

| Control                          | Status        | Note                                                                      |
| -------------------------------- | ------------- | ------------------------------------------------------------------------- |
| **Access Controls**              | ✅ Local-only | Data never transmitted; browser security isolates per-user                |
| **Encryption in Transit**        | ✅ N/A        | No network communication                                                  |
| **Encryption at Rest**           | ⚠️ Partial    | IndexedDB data not encrypted by default                                   |
| **Audit Logs**                   | ✅ N/A        | No backend logging; local only                                            |
| **Business Associate Agreement** | ✅ N/A        | Application is not a business associate; data never reaches third parties |
| **Data Minimization**            | ✅ Partial    | Application requires full CSV; could limit to necessary fields            |
| **User Consent**                 | ⚠️ Gap        | No explicit consent for IndexedDB persistence                             |
| **Data Retention Policy**        | ⚠️ Gap        | No documented retention or automatic deletion                             |

**Key Point**: OSCAR Export Analyzer is **not subject to HIPAA** as a consumer-facing tool (unless deployed by a covered entity as a business associate, which would require a Business Associate Agreement). However, adopting HIPAA-like practices (encryption, audit, consent) would strengthen privacy.

### GDPR (General Data Protection Regulation)

**Applicability**: If users are EU residents or processing EU personal data.

| Control                  | Status       | Note                                                                     |
| ------------------------ | ------------ | ------------------------------------------------------------------------ |
| **Lawful Basis**         | ⚠️ Gap       | Application should document lawful basis (e.g., user consent)            |
| **Data Minimization**    | ⚠️ Partial   | App processes and stores full CSV; could limit to necessary fields       |
| **Transparency**         | ⚠️ Gap       | Privacy policy should explain data storage, retention, deletion          |
| **Right to Access**      | ✅ Partial   | User can export session JSON; no API for structured data export          |
| **Right to Deletion**    | ✅ Partial   | Users can clear IndexedDB via menu; auto-deletion on close not available |
| **Purpose Limitation**   | ✅ Confirmed | Data used only for analysis; no secondary uses                           |
| **Data Subject Consent** | ⚠️ Gap       | No explicit consent flow for data persistence                            |

**Recommendation**: Add a simple Privacy Policy explaining:

- Data is stored locally in browser only
- Data is not shared with third parties
- User can delete data at any time via menu or browser settings
- Application uses no tracking or analytics

---

## Prioritized Security Improvements

### Priority 1 — High Impact, Low Effort

1. ✅ **Add File Size Validation** (CRITICAL) — **COMPLETED**
   - Implement 50–100 MB file size limit
   - **Effort**: 15 minutes
   - **Impact**: Prevent DoS via massive CSV files
   - **Implementation**: Added MAX_FILE_SIZE_MB check in [src/hooks/useCsvFiles.js](../../../src/hooks/useCsvFiles.js#L86-L91) with user-friendly error message

2. ✅ **Add Print Warning Dialog** — **COMPLETED**
   - Confirm before printing sensitive data
   - **Effort**: 30 minutes
   - **Impact**: Prevent accidental data exposure via printing
   - **Implementation**: Created [src/components/ui/PrintWarningDialog.jsx](../../../src/components/ui/PrintWarningDialog.jsx) with full accessibility (alertdialog role, focus trap, keyboard navigation). Integrated in [src/App.jsx](../../../src/App.jsx) with Ctrl+P/Cmd+P interception. Warns about PHI before printing.

3. ✅ **Rename Session Export File** — **COMPLETED**
   - Use `oscar_session_PHI.json` naming
   - **Effort**: 10 minutes
   - **Impact**: Signal data sensitivity to users
   - **Implementation**: Updated filename in [src/hooks/useSessionManager.js](../../../src/hooks/useSessionManager.js#L77) to `oscar_session_PHI.json`

4. ✅ **Document Data Lifecycle** — **COMPLETED**
   - Add clear section to user docs explaining when/where data is stored
   - **Effort**: 45 minutes
   - **Impact**: Set correct user expectations
   - **Implementation**: Added comprehensive "Data Storage and Privacy" section to [docs/user/01-getting-started.md](../../../docs/user/01-getting-started.md#5-data-storage-and-privacy) covering when/where/how long data is stored, deletion instructions, and privacy guarantees

### Priority 2 — Medium Impact, Medium Effort

1. **Disable Console Error Logging in Production**
   - Wrap error logs in `if (import.meta.env.DEV)`
   - **Effort**: 30 minutes
   - **Impact**: Prevent stack trace disclosure in production

2. **Add Explicit IndexedDB Opt-In**
   - Require user confirmation before saving to IndexedDB
   - **Effort**: 1–2 hours
   - **Impact**: Respect user privacy; align with consent principles

3. **Sanitize CSV Parser Error Messages**
   - Replace with generic error messages
   - **Effort**: 30 minutes
   - **Impact**: Prevent error message data leakage

4. **Add Header Validation for CSV Files**
   - Validate required columns exist before processing
   - **Effort**: 1 hour
   - **Impact**: Fail-fast on malformed files

### Priority 3 — Lower Impact or Higher Effort

1. **Implement Content Security Policy (CSP)**
   - Define strict CSP meta tag
   - **Effort**: 1 hour (plus testing)
   - **Impact**: Defense-in-depth for XSS

2. **Add Client-Side Encryption for IndexedDB**
   - Encrypt sensitive data at rest
   - **Effort**: 3–4 hours
   - **Impact**: Protect against device theft or malicious extensions

3. **Implement Automatic Data Deletion on Tab Close**
   - Clear sensitive data from memory when user closes tab
   - **Effort**: 2–3 hours
   - **Impact**: Session-like privacy mode

4. **Add npm Audit to CI Pipeline**
   - Fail builds on moderate/high severity vulnerabilities
   - **Effort**: 30 minutes
   - **Impact**: Continuous supply chain monitoring

---

## Summary of Findings

### Strengths

- ✅ **Local-first architecture** — No data transmission; all processing client-side
- ✅ **XSS protection** — DOMPurify sanitization + ESLint rules configured
- ✅ **No network requests** — Data never leaves device
- ✅ **Web Worker cleanup** — Workers terminated after use
- ✅ **Appropriate exports** — Aggregates CSV only exports computed statistics

### Gaps (Non-Critical)

- ⚠️ **No file size validation** — Large files could DoS browser
- ⚠️ **IndexedDB not encrypted** — Data plaintext in storage
- ⚠️ **No explicit opt-in** — Auto-saves without user consent
- ⚠️ **Error logging in production** — Stack traces visible
- ⚠️ **Print data exposure** — User can accidentally print sensitive data
- ⚠️ **No CSP header** — Defense-in-depth opportunity

### Compliance Notes

- **HIPAA**: Not subject as consumer tool; best practices would strengthen posture
- **GDPR**: Should add privacy policy; consent flow for data persistence recommended

---

## Conclusion

OSCAR Export Analyzer demonstrates **strong privacy fundamentals** for a browser-based health data analyzer. The local-first architecture is a critical success factor, and the application correctly avoids network transmission of sensitive data.

The identified gaps are primarily **defensive coding practices** (file validation, error handling) and **user consent mechanisms** (explicit opt-in for persistence) rather than fundamental architectural flaws. Implementing Priority 1 and Priority 2 improvements would bring the application to a **high security posture** suitable for clinical or research use.

The application is suitable for:

- **Personal health data analysis** ✅
- **Patient self-tracking** ✅
- **Clinical research** ✅ (with Priority 1 improvements)
- **HIPAA-covered entity deployment** ⚠️ (requires Priority 2 improvements + Business Associate Agreement)

**Overall Security Rating: B+ (Good)**

- Core privacy architecture: A
- Input validation: C
- Error handling: B
- Documentation: B
- Compliance: B (with minor gaps)
