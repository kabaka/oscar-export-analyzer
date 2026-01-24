# Fitbit Integration: Security & Privacy Assessment

**Date**: January 24, 2026  
**Status**: Security Planning Document  
**Audience**: Development team, security review, compliance planning

---

## Executive Summary

This document provides a comprehensive security and privacy assessment for integrating Fitbit biometric data with OSCAR Export Analyzer. The integration introduces significant new considerations beyond the current CPAP-only analysis, particularly around third-party authentication, additional health data classification, and cross-platform data handling.

**Key Findings**:

- Fitbit integration is **feasible** with current local-first privacy model, but requires careful OAuth token management and expanded consent flows
- CPAP + Fitbit combined data reveals **higher health sensitivity** than either dataset alone; regulatory implications increase
- Encryption implementation is **cryptographically sound** (AES-256-GCM with PBKDF2); passphrase entropy is adequate for typical user scenarios
- **Critical requirements**: explicit user consent for each data source, secure token storage with lifetime limits, and comprehensive documentation of privacy implications
- Compliance landscape is **complex** (HIPAA, GDPR, CCPA); application should NOT position itself as medical device without formal regulatory pathway

**Risk Level**: **Medium** (manageable with proper implementation and governance)

---

## 1. Data Classification and Health Sensitivity

### 1.1 Protected Health Information (PHI) Definition

**Current OSCAR Data (PHI)**:

- CPAP therapy events (central apnea, obstructive apnea, hypopnea, etc.)
- Apnea-Hypopnea Index (AHI): events per hour, primary diagnostic marker
- Pressure settings (EPAP/IPAP): therapy parameters
- Leak rates, humidity settings, temperature
- Session timestamps, duration, quality metrics
- Derived: therapy adherence patterns, equipment effectiveness

**Fitbit Data (PHI)**:

- **Heart rate (HR)**: baseline, patterns, variability (HRV)
- **SpO₂ (blood oxygen)**: absolute readings, trends, dips
- **Sleep stages**: REM, light, deep sleep duration and cycles
- **Sleep respiration rate**: breathing pattern
- **Skin temperature**: baseline and variation
- **Steps, activity intensity**: daily patterns, exercise correlation

### 1.2 Combined Data Risk: Synergistic Sensitivity

**Standalone risk**:

- CPAP data alone: reveals sleep disorder diagnosis, therapy compliance
- Fitbit data alone: reveals fitness/health trends, sleep quality, cardiovascular baseline

**Combined risk (Fitbit + CPAP)**:

- **Detailed sleep apnea phenotyping**: SpO₂ dips + AHI events provide diagnostic confirmation
- **Therapy efficacy assessment**: CPAP pressure settings + subsequent HR/SpO₂ recovery indicates treatment success
- **Cardiovascular correlation**: HRV patterns + apnea frequency reveal autonomic stress
- **Comorbidity inference**: SpO₂ drops + HR variability may indicate cardiac arrhythmia risk
- **De-identification challenge**: combined dataset is harder to anonymize (low population prevalence of specific therapy patterns)

**Risk Assessment**: Combined data is **higher sensitivity** than either alone. Disclosure could enable:

- Denial of insurance coverage (based on untreated vs. treated sleep apnea)
- Workplace discrimination (sleep disorder diagnosis)
- Loan/mortgage denials (health risk assessment)
- Family/social stigma (public disclosure of sleep disorder)

### 1.3 Regulatory Classification

#### HIPAA (US)

- **CPAP data**: Clearly PHI under HIPAA (created in treatment context)
- **Fitbit data**: Potentially PHI if collected via physician or integrated with treatment records
- **Application scope**: If OSCAR Analyzer is used in clinical setting or to support treatment decisions, application may fall under HIPAA requirements
  - **Business Associate Agreement (BAA)** may be required if healthcare provider uses it
  - Individual users: HIPAA applies only if data is covered entity's responsibility
  - Recommendation: **DO NOT claim HIPAA compliance** without formal legal review; instead, offer privacy protections that EXCEED HIPAA minimums

#### GDPR (EU)

- **Data classification**: Both CPAP and Fitbit data are "special categories" (health data under Article 9)
- **Legal basis**: Explicit user consent required (Article 9(2)(a))
- **Data processing**: User controls processing; data must stay in-browser to satisfy "data minimization"
- **User rights**: Right to access, rectify, erase ("right to be forgotten"), data portability, object
- **Recommendation**: Provide explicit privacy notice and clear consent mechanism; support data export for portability compliance

#### CCPA (California)

- **Consumer rights**: Disclosure of data collection, right to know what's collected, right to delete
- **Fitbit connection**: Collection of health information for commercial purposes
- **Recommendation**: Disclose Fitbit integration prominently; support data deletion flows; don't sell or share data

#### HIPAA-Adjacent (Medical Device Software)

- **Classification risk**: If marketed as "sleep analysis" or diagnostic tool, may be subject to FDA oversight
- **Critical distinction**:
  - ✅ **Allowed**: "Visualization tool for personal data analysis"
  - ✅ **Allowed**: "Educational platform for understanding sleep metrics"
  - ❌ **Not allowed**: "Diagnoses sleep apnea severity" or "Medical-grade analysis"
- **Recommendation**: Explicit disclaimer that app is NOT a medical device; results should not replace clinical evaluation

### 1.4 De-identification and Privacy Preservation

**Can combined CPAP+Fitbit data be de-identified?**

**Answer: Difficult, especially for correlation analysis.**

- **Naive de-identification** (removing name, date of birth): **Ineffective** for health data
- **Linked anonymization** (removing all dates): **Breaks analysis** (longitudinal patterns are key value)
- **Time-shifted anonymization** (randomize timestamps): **Possible** but reduces utility for therapy evaluation
- **Aggregation** (rolling averages, weekly summaries): **Feasible** but loses diagnostic detail

**Recommendation for privacy-preserving analysis**:

1. **Local-only processing** (current model): Data never leaves user's device; no de-identification needed for transmission
2. **User-controlled export**: Users can share de-identified summaries (weekly averages, not event-level data) if needed for clinical discussion
3. **Optional anonymization export**: Generate CSV with date-shifted or aggregated data for research use

---

## 2. OAuth and Authentication Security

### 2.1 Fitbit OAuth Flow Overview

**Fitbit OAuth 2.0 (implicit vs. authorization code flow)**:

```
┌─────────────┐
│ User Browser│
└──────┬──────┘
       │ 1. "Connect Fitbit Account"
       ├──────────────────────────────────────┐
       │ Redirect to:                          │
       │ https://www.fitbit.com/oauth2/        │
       │ authorize?client_id=XXX               │
       │ &redirect_uri=app.com/callback        │
       │ &response_type=code                   │
       │                                        │
   ┌───┴──────────┐                            │
   │ Fitbit Login │                            │
   │ (user enters │                            │
   │ credentials) │                            │
   └───┬──────────┘                            │
       │                                        │
       │ 2. User approves scopes                │
       │ ("See heart rate, SpO₂, sleep data")   │
       │                                        │
       │ Fitbit redirects back to:              │
       │ app.com/callback?code=AUTH_CODE       │
       └──────────────────────────────────────┘
       │
       ├──────────────────────────────────┐
       │ 3. Backend or Worker exchanges    │
       │    auth code for tokens:          │
       │    POST /oauth2/token             │
       │    code=AUTH_CODE                 │
       │    client_id=XXX                  │
       │    client_secret=YYY              │
       │    grant_type=authorization_code  │
       └──────────────────────────────────┘
       │
       ├── Response: ────────────────────────┐
       │  {                                   │
       │    "access_token": "abc123xyz...",   │
       │    "token_type": "Bearer",           │
       │    "expires_in": 3600,               │
       │    "refresh_token": "def456uvw...",  │
       │    "scope": "..."                    │
       │  }                                   │
       └────────────────────────────────────┘
       │
       ├── Store locally (IndexedDB) ────────┐
       │ - access_token (short-lived)         │
       │ - refresh_token (long-lived)         │
       │ - expiration timestamp               │
       └────────────────────────────────────┘
```

### 2.2 Token Storage Security

**CRITICAL DECISION: Where to store Fitbit OAuth tokens?**

| Storage Option              | Pros                                         | Cons                                               | Recommendation                              |
| --------------------------- | -------------------------------------------- | -------------------------------------------------- | ------------------------------------------- |
| **localStorage**            | Simple API, persistent across sessions       | Vulnerable to XSS attacks; plain text              | ❌ **Not recommended** for sensitive tokens |
| **sessionStorage**          | Auto-cleared on tab close; XSS vulnerable    | Limited to single tab; lost on navigation          | ⚠️ **Temporary only**                       |
| **IndexedDB (encrypted)**   | Persistent, can encrypt with user passphrase | Complex to implement; needs careful key management | ✅ **Recommended** for long-term storage    |
| **Memory only**             | No persistent storage; safest                | Lost on page reload; poor UX for long-term         | ⚠️ **For read-only sessions**               |
| **Secure HTTP-only Cookie** | Browser-managed; immune to XSS               | Not accessible to JavaScript; requires backend     | ❌ **Incompatible with local-first SPA**    |

**Recommended Approach: Hybrid Storage with Encryption**

```javascript
// 1. User authenticates with Fitbit (OAuth flow)
// 2. Receive access_token, refresh_token, expiration

// 3. Encrypt tokens before storage (using user's session passphrase or device passphrase)
const encryptedTokens = await encryptData(
  {
    access_token: '...',
    refresh_token: '...',
    expires_at: Date.now() + 3600000,
  },
  userPassphrase, // Same passphrase used for CPAP export
);

// 4. Store encrypted bundle in IndexedDB
await db.fitbitTokens.put({
  encrypted: encryptedTokens.encrypted,
  salt: encryptedTokens.salt,
  iv: encryptedTokens.iv,
  created_at: Date.now(),
});

// 5. Use access_token from memory during active session
// 6. On token expiration, decrypt and refresh using refresh_token
// 7. On logout, delete encrypted tokens and clear memory
```

### 2.3 Token Lifetime and Refresh Strategy

**Fitbit API Token Lifetimes** (as of 2026):

- **Access token**: 1 hour (3600 seconds)
- **Refresh token**: 10 years (or until revoked)

**Risk**: Long-lived refresh tokens are high-value targets for attackers.

**Mitigations**:

1. **Short token cache window**: Keep access_token in memory; refresh before expiration

   ```javascript
   // Check before each API call
   if (Date.now() >= accessToken.expiresAt - 5_000) {
     // Refresh 5 seconds before expiration
     await refreshAccessToken();
   }
   ```

2. **Automatic refresh on expiration error**: Catch 401 Unauthorized and refresh

   ```javascript
   try {
     const response = await fetch(
       'https://api.fitbit.com/1/user/-/profile.json',
       {
         headers: { Authorization: `Bearer ${accessToken}` },
       },
     );
   } catch (error) {
     if (error.status === 401) {
       await refreshAccessToken();
       // Retry request with new token
     }
   }
   ```

3. **Revoke refresh token on logout**: Call Fitbit revoke endpoint

   ```javascript
   // On user logout
   POST https://api.fitbit.com/oauth2/revoke
   {
     client_id: "...",
     client_secret: "...",
     token: refreshToken
   }
   ```

4. **Automatic logout after inactivity**: Clear tokens if user inactive for 30 days
   ```javascript
   const lastActiveTime = localStorage.getItem('lastActive');
   if (Date.now() - lastActiveTime > 30 * 24 * 60 * 60 * 1000) {
     await logoutAndRevokeFitbit();
   }
   ```

### 2.4 XSS Attack Surface and Mitigation

**Vulnerability**: If app is compromised by XSS, attacker could steal tokens from IndexedDB/localStorage.

**Mitigations** (defense in depth):

| Mitigation                      | Effectiveness | Cost                  |
| ------------------------------- | ------------- | --------------------- |
| Content Security Policy (CSP)   | 🟢 High       | Low (config)          |
| Subresource Integrity (SRI)     | 🟢 High       | Low (links)           |
| Input validation & sanitization | 🟡 Medium     | Medium (review)       |
| Regular dependency audits       | 🟡 Medium     | Low (automated)       |
| Minimal token lifetime          | 🟢 High       | Low (already planned) |
| Token encryption at rest        | 🟢 High       | Medium (crypto)       |

**CSP Configuration** (add to HTTP headers or meta tag):

```html
<meta
  http-equiv="Content-Security-Policy"
  content="
        default-src 'self';
        script-src 'self' 'nonce-XXXXX';
        connect-src 'self' https://api.fitbit.com;
        style-src 'self' 'unsafe-inline';
        img-src 'self' data:;
      "
/>
```

### 2.5 Token Theft Scenarios and Response

**Scenario 1: Attacker steals access_token via XSS**

- **Impact**: Can read 1 hour of Fitbit data using stolen token
- **Detection**: User reviews API access logs in Fitbit account settings
- **Mitigation**: Token expires in 1 hour; attacker can't refresh (refresh_token not exposed)
- **Response**: Educate user to revoke all tokens if suspicious activity detected

**Scenario 2: Attacker steals refresh_token**

- **Impact**: Can impersonate user indefinitely (10-year validity)
- **Detection**: Difficult; attacker reads Fitbit data silently
- **Mitigation**:
  - Encryption at rest (attacker needs both encrypted data + passphrase)
  - Token rotation: revoke old refresh_token and issue new one periodically
  - Device fingerprinting: detect if refresh_token used from different device/browser
- **Response**: Provide user education; recommend revoking Fitbit connection if concerned

**Scenario 3: Fitbit API breach exposes tokens**

- **Impact**: Out of user's control; depends on Fitbit's security posture
- **Mitigation**: Fitbit is responsible; users should enable 2FA on Fitbit account
- **Response**: Document Fitbit's responsibility in privacy policy

### 2.6 User Education and Account Recovery

**What happens if user's Fitbit account is compromised?**

**User guidance** (to include in help documentation):

1. **Change Fitbit password** immediately
2. **Enable 2-factor authentication** on Fitbit account (if not already enabled)
3. **Review API access** in Fitbit account settings: https://www.fitbit.com/user/settings/apps
4. **Revoke OSCAR Analyzer access** if suspicious
5. **Check OSCAR Analyzer**: Disable Fitbit integration locally if concerned

---

## 3. Data Persistence Security

### 3.1 IndexedDB Encryption Requirements

**Current implementation**: CPAP data is stored unencrypted in IndexedDB (optional, user-opt-in).

**Risk change with Fitbit**: Additional health data (HR, SpO₂, respiratory rate) increases value to attackers; encryption becomes more important.

**Recommendation**: Implement optional encryption for IndexedDB persistence.

**Architecture**:

```javascript
// Proposed IndexedDB schema with encryption

const dbSchema = {
  // Original (unencrypted option)
  cpapSessions: {
    keyPath: 'sessionId',
    encrypted: false, // legacy support
  },

  // New (encrypted option)
  fitbitAuthTokens: {
    keyPath: 'tokenId',
    encrypted: true, // always encrypted
    encryptionKey: derivedFromUserPassphrase,
  },

  fitbitData: {
    keyPath: 'dataId',
    encrypted: true, // optionally encrypted
    encryptionKey: derivedFromUserPassphrase,
  },
};

// Store encrypted data
async function storeFitbitData(data, passphrase) {
  const encrypted = await encryptData(data, passphrase);

  await db.fitbitData.add({
    dataId: generateId(),
    encrypted: encrypted.encrypted,
    salt: encrypted.salt,
    iv: encrypted.iv,
    metadata: {
      createdAt: Date.now(),
      type: 'fitbit_daily_summary',
    },
  });
}

// Retrieve and decrypt
async function getFitbitData(passphrase) {
  const record = await db.fitbitData.getAll();

  return Promise.all(
    record.map(async (r) => {
      const decrypted = await decryptData(
        r.encrypted,
        r.salt,
        r.iv,
        passphrase,
      );
      return { ...r, data: decrypted };
    }),
  );
}
```

**Encryption key derivation**:

- Use same passphrase mechanism as CPAP export/import (PBKDF2-SHA256, 100,000 iterations)
- Alternatively: Derive from device fingerprint + user passphrase
- Challenge: User must enter passphrase to unlock data on each session (UX cost)

**Options for user experience**:

1. **Encrypted at rest, unencrypted in memory**: Store encrypted in IndexedDB; decrypt on load with optional passphrase
2. **Session-based encryption**: Decrypt once per session (prompt user for passphrase on first data access)
3. **No encryption option**: Allow users to opt-out of persistence if privacy concern

**Recommendation**: Offer **both encrypted and unencrypted options**:

- Encrypted: For users prioritizing privacy (health data sensitivity)
- Unencrypted: For users prioritizing convenience (personal device, low theft risk)
- Default: Ask user at setup time which they prefer

### 3.2 Device Security Assumptions

**CRITICAL ASSUMPTION**: User's device is not compromised.

If device has malware, all protections (encryption, browser security) can be bypassed by attacker running with user privileges.

**Mitigation strategies**:

| Protection                                 | Effectiveness | User Action           |
| ------------------------------------------ | ------------- | --------------------- |
| OS-level encryption (FileVault, BitLocker) | 🟢 High       | Enable at OS setup    |
| Strong device password/PIN                 | 🟢 High       | Use 12+ characters    |
| Regular OS updates                         | 🟢 High       | Auto-enable or manual |
| Antivirus/malware scanner                  | 🟡 Medium     | Run regularly         |
| Avoid public WiFi                          | 🟡 Medium     | Use VPN if necessary  |
| Browser security updates                   | 🟡 Medium     | Auto-enable           |

**Recommendation in documentation**: Add section "Securing Your Device" with these recommendations.

### 3.3 Safe Data Deletion

**Challenge**: How to safely delete Fitbit+CPAP data if user uninstalls app or revokes permissions?

**Current CPAP deletion**: User can clear IndexedDB via browser settings or app UI.

**Fitbit-specific deletion requirements**:

1. Delete access_token and refresh_token
2. Delete all cached Fitbit data (heart rate, SpO₂, sleep metrics)
3. Revoke Fitbit API connection (so user can revoke if needed)
4. Optionally: Sync deletion state with Fitbit account

**Proposed deletion flow**:

```javascript
async function deleteAllFitbitData() {
  // 1. Revoke Fitbit API tokens
  if (refreshToken) {
    await fetch('https://api.fitbit.com/oauth2/revoke', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: FITBIT_CLIENT_ID,
        client_secret: FITBIT_CLIENT_SECRET,
        token: refreshToken,
      }),
    });
  }

  // 2. Clear tokens from IndexedDB
  await db.fitbitAuthTokens.clear();

  // 3. Clear cached Fitbit data
  await db.fitbitData.clear();

  // 4. Clear memory
  setFitbitAccessToken(null);
  setFitbitData(null);

  // 5. Update UI
  showNotification('Fitbit connection revoked and data deleted');
}
```

**Uninstall scenario**: If user uninstalls app without explicitly revoking Fitbit connection, tokens remain valid in Fitbit's system (not deleted from their device).

**Mitigation**: Add warning in documentation: "Uninstalling app does not revoke Fitbit connection. Manually revoke at https://www.fitbit.com/user/settings/apps if desired."

### 3.4 Automatic Data Expiration

**Question**: Should Fitbit data auto-delete after X days?

**Tradeoffs**:

| Duration      | Privacy                                   | Utility                                      |
| ------------- | ----------------------------------------- | -------------------------------------------- |
| No expiration | Low (data kept indefinitely)              | High (full history available)                |
| 90 days       | Medium (data older than 3 months deleted) | Medium (can't analyze year-over-year trends) |
| 1 year        | Medium-high (yearly refresh)              | Medium-high (annual trends possible)         |
| Configurable  | High (user control)                       | High (user choice)                           |

**Recommendation**: **Configurable retention** with defaults:

- Default: Keep indefinitely (or until user deletes)
- Option 1: Auto-delete after 90 days
- Option 2: Auto-delete after 1 year
- Option 3: Manual deletion only

**Implementation**:

```javascript
// Auto-expire old Fitbit data
async function deleteExpiredFitbitData(retentionDays = 365) {
  const cutoffDate = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

  const expiredRecords = await db.fitbitData
    .where('metadata.createdAt')
    .below(cutoffDate)
    .toArray();

  await Promise.all(expiredRecords.map((r) => db.fitbitData.delete(r.dataId)));
}

// Run weekly
setInterval(() => deleteExpiredFitbitData(365), 7 * 24 * 60 * 60 * 1000);
```

### 3.5 OS-Level Backup and Cloud Sync Risks

**Risk**: If user's OS backs up app data to cloud (iCloud, OneDrive, Google Drive), encrypted health data could leak if cloud account is compromised.

**Current mitigations**:

- IndexedDB data is browser-specific; most browsers don't auto-backup IndexedDB to cloud
- Exception: iOS Safari may sync IndexedDB in some cases

**Recommendations for documentation**:

1. **Advise users**: Disable cloud backup for browser app data if privacy is critical
2. **Clarify storage**: "OSCAR Analyzer data stays on your device; does not sync to cloud by default"
3. **Encryption at rest**: If cloud sync occurs, data is encrypted (assuming encryption enabled)
4. **Fitbit tokens**: Especially sensitive; should never be backed up to cloud

---

## 4. Cross-Device Transfer Security

### 4.1 Current AES-256-GCM Implementation Review

**Current encryption for CPAP data export**:

```javascript
// From src/utils/encryption.js
- Algorithm: AES-256-GCM
- Key derivation: PBKDF2-SHA256, 100,000 iterations
- Salt: 16 bytes (128 bits), cryptographically random
- IV/Nonce: 12 bytes (96 bits), cryptographically random
```

**Security assessment**: ✅ **Cryptographically sound**

- AES-256-GCM is NIST-approved authenticated encryption
- PBKDF2 with 100,000 iterations meets OWASP 2023 minimum recommendation
- Salt and IV are properly randomized

### 4.2 Passphrase Entropy Validation

**Current requirement**: Minimum 8 characters, encouraged 12+.

**Entropy calculation**:

- Alphabet size (assuming lowercase + uppercase + digits + symbols): ~94 characters
- 8-character passphrase: ~94^8 ≈ 6 × 10^15 possible values (50 bits entropy)
- 12-character passphrase: ~94^12 ≈ 4.75 × 10^23 (79 bits entropy)
- 16-character passphrase: ~94^16 ≈ 3.7 × 10^31 (105 bits entropy)

**Strength assessment**:

| Length   | Entropy   | Strength | Brute-force time\* |
| -------- | --------- | -------- | ------------------ |
| 8 chars  | ~50 bits  | Weak     | Minutes (GPU)      |
| 12 chars | ~79 bits  | Moderate | Centuries (GPU)    |
| 16 chars | ~105 bits | Strong   | Impractical        |

\*Assuming modern GPU: 10^9 attempts/second. For encrypted health data (moderate value), GPU attack is realistic within hours if passphrase is weak.

**Recommendation**:

- Current 8-character minimum is **acceptable but weak**
- Change recommendation to **12+ characters** (update docs)
- Implement passphrase strength meter in UI (already done in ExportDataModal.jsx)
- Consider increasing minimum to 10-12 if UX permits

### 4.3 Fitbit+CPAP Combined Export

**Challenge**: How to export combined CPAP+Fitbit data securely?

**Proposed format**:

```javascript
{
  version: 1,
  exportDate: "2026-01-24T10:30:00Z",
  dataTypes: ["cpap", "fitbit"],

  // Encrypted bundle contains both datasets
  encrypted: [byte array],
  salt: [16 bytes],
  iv: [12 bytes],

  // Metadata (unencrypted, for UI display)
  metadata: {
    cpapRowCount: 1247,
    fitbitDayCount: 365,
    dateRange: {
      start: "2025-01-24",
      end: "2026-01-24"
    }
  }
}
```

**Single passphrase for both datasets**: ✅ Simpler UX, same encryption strength as CPAP-only export.

**Separate passphrases per dataset**: ❌ Complex UX; doesn't add meaningful security (both datasets reveal user identity anyway).

**Recommendation**: Use **single passphrase** for combined export.

### 4.4 Export/Import Attack Surface

**Attack scenario 1: Encrypted file on untrusted cloud (email, Google Drive)**

- **Risk**: File at rest is encrypted; useless without passphrase
- **Mitigation**: Encryption is sufficient; advise user to use strong passphrase
- **Residual risk**: Passphrase sent via email/chat unencrypted; user must protect separately

**Attack scenario 2: Man-in-the-middle (MITM) during download**

- **Risk**: Browser downloads encrypted file; attacker can't intercept plaintext
- **Mitigation**: Use HTTPS (browser enforces); no additional protection needed
- **Residual risk**: Low (HTTPS is standard)

**Attack scenario 3: Malware reads export file before encryption**

- **Risk**: Malware on device intercepts data before encryption
- **Mitigation**: No crypto protection against local malware; relies on device security
- **Residual risk**: If device is compromised, encryption doesn't help

**Attack scenario 4: User forgets passphrase**

- **Risk**: User can't import their own export file
- **Mitigation**: No recovery mechanism (by design; no master key to recover)
- **User education**: "Save your passphrase securely (password manager, written note)"

**Recommendations**:

1. **Document attack scenarios** in help documentation
2. **Emphasize passphrase security**: "Protect your passphrase like your Fitbit password"
3. **Recommend password manager**: "Store passphrase in 1Password, Bitwarden, or similar"
4. **No recovery mechanism**: "If you forget passphrase, encrypted file cannot be imported"

### 4.5 File Format Security

**Current implementation**: Export file is JSON with base64-encoded encrypted data.

**Risk: Prototype pollution or type confusion attacks**

```javascript
// Malicious export file
{
  "version": 1,
  "constructor": { "prototype": { "admin": true } },
  "salt": [...],
  "iv": [...],
  "data": [...]
}
```

**Current mitigation** (from `validateFileFormat()`): ✅ Strict validation of required fields and types.

```javascript
// Validates:
- Exact field types (not prototype pollution)
- Array sizes match crypto parameters
- All array elements are valid bytes
- Version matches expected format
```

**Recommendation**: Keep current validation; add unit tests for format validation.

---

## 5. Third-Party Risk Management

### 5.1 Fitbit API Dependency

**Single point of failure**: If Fitbit API becomes unavailable, users cannot fetch new data.

**Risk matrix**:

| Event                         | Likelihood | User Impact                               | Mitigation                      |
| ----------------------------- | ---------- | ----------------------------------------- | ------------------------------- |
| Fitbit API outage (1-2 hours) | Medium     | Can't refresh data; cached data available | Graceful error messages         |
| Fitbit API rate limit         | Medium     | Can't fetch data during busy period       | Implement backoff/retry         |
| Fitbit deprecates endpoint    | Low        | Feature breaks; requires code update      | Stay informed of API changes    |
| Fitbit discontinued           | Very low   | Feature becomes unavailable               | Document in help; no mitigation |
| Fitbit changes ToS/pricing    | Low        | May disable integration                   | Review ToS quarterly            |

**Mitigations**:

1. **Graceful error handling**:

   ```javascript
   async function fetchFitbitData() {
     try {
       const response = await fetch(
         'https://api.fitbit.com/1/user/-/activities/date/...',
       );
       if (!response.ok) {
         if (response.status === 429) {
           // Rate limited; schedule retry
           scheduleRetry(exponentialBackoff());
         } else if (response.status === 503) {
           // Service unavailable
           showNotification(
             'Fitbit API temporarily unavailable; using cached data',
           );
         }
       }
     } catch (error) {
       console.error('Fitbit API error:', error);
       showNotification(
         'Failed to fetch Fitbit data; offline or API unavailable',
       );
     }
   }
   ```

2. **Dependency monitoring**: Subscribe to Fitbit status page and API change notifications
3. **Offline fallback**: Display cached data if fresh fetch fails
4. **Clear communication**: Inform users that integration depends on Fitbit API availability

### 5.2 Fitbit API Security Practices

**Question**: Does Fitbit handle user data securely?

**Considerations**:

- Fitbit is owned by Google; benefits from Google's security infrastructure
- Fitbit API supports OAuth 2.0 (industry standard)
- Rate limiting prevents excessive data scraping
- No documentation of major Fitbit API breaches (as of 2026)

**User reliance**: Users already trust Fitbit with their biometric data; OSCAR integration doesn't increase Fitbit's access (Fitbit can already see all data).

**Recommendation**: Document Fitbit's privacy practices in help documentation; link to Fitbit's privacy policy.

### 5.3 Dependency Risks: OAuth Libraries and Crypto

**Libraries at risk**:

- `crypto` (Web Crypto API): Browser native; no external dependency
- OAuth libraries: If using `oauth.js` or similar, ensure it's maintained

**Recommendations**:

1. **Minimize dependencies**: Use Web Crypto API instead of external crypto libraries (already done)
2. **Regular audits**: `npm audit` for known vulnerabilities
3. **Vendor monitoring**: Check for security updates for OAuth libraries
4. **Version pinning**: Pin library versions to avoid surprise breaking changes

### 5.4 Vendor Lock-in and Exit Strategy

**Risk**: User data locked into OSCAR Analyzer; difficult to migrate if integration breaks.

**Mitigation**:

1. **Data export functionality**: Support export of Fitbit data in standard format (CSV with timestamps, metrics)
2. **Unlink option**: Allow user to disconnect Fitbit without losing CPAP data
3. **Documentation**: Explain how to export/import data for portability

---

## 6. Data Minimization and Purpose Limitation

### 6.1 OAuth Scopes (Minimal Permissions)

**Fitbit API scopes** (what permissions to request):

| Scope               | Data                   | Purpose                       | Necessary?    |
| ------------------- | ---------------------- | ----------------------------- | ------------- |
| `heartrate`         | Heart rate readings    | Correlate with therapy        | ✅ Yes        |
| `sleep`             | Sleep stages, duration | Validate Fitbit sleep quality | ✅ Yes        |
| `oxygen_saturation` | SpO₂ readings          | Correlate with AHI            | ✅ Yes        |
| `respiratory_rate`  | Breathing rate         | Physiological context         | ⚠️ Optional   |
| `temperature`       | Skin temperature       | Circadian rhythm              | ⚠️ Optional   |
| `activity`          | Steps, exercise        | Activity correlation          | ❌ Not needed |
| `profile`           | User profile info      | Account details               | ❌ Not needed |
| `weight`            | Weight measurements    | Health context                | ❌ Not needed |

**Recommendation**: Request **only necessary scopes**:

```javascript
const fitbitScopes = [
  'heartrate',
  'sleep',
  'oxygen_saturation',
  // Optional: 'respiratory_rate'
];

// OAuth redirect includes scopes
const authUrl =
  `https://www.fitbit.com/oauth2/authorize?` +
  `client_id=${FITBIT_CLIENT_ID}&` +
  `scope=${fitbitScopes.join(' ')}&` +
  `redirect_uri=${REDIRECT_URI}`;
```

### 6.2 Data Collection Interval

**Question**: How frequently to fetch Fitbit data?

**Options**:

- **Real-time**: Fetch every 5 minutes → High API cost, high data volume, high battery drain
- **Hourly**: Fetch every hour → Moderate API cost, reasonable latency
- **Daily**: Fetch once per day → Low API cost, delayed insights, user clicks "Refresh"
- **On-demand**: Fetch only when user clicks "Sync" → Minimal API cost, explicit user action

**Recommendation**: **On-demand + optional daily sync**

```javascript
// User clicks "Sync with Fitbit" button
async function syncFitbitData() {
  showSpinner('Fetching latest Fitbit data...');

  // Fetch heart rate for last 30 days
  const hrData = await fetchFitbitHeartRate({ days: 30 });

  // Fetch sleep data for last 30 days
  const sleepData = await fetchFitbitSleep({ days: 30 });

  // Store in IndexedDB
  await storeFitbitData({ hrData, sleepData });

  showNotification('Fitbit data updated successfully');
}

// Optional: Auto-sync once per day if enabled
if (userPreferences.autoSyncDaily) {
  const lastSync = localStorage.getItem('lastFitbitSync');
  if (Date.now() - lastSync > 24 * 60 * 60 * 1000) {
    await syncFitbitData();
  }
}
```

### 6.3 Data Retention Policy

**Question**: How long to keep Fitbit data cached locally?

**Tradeoffs**:

- Keep all data: Enables historical analysis (year-over-year trends)
- Delete old data: Reduces storage, minimizes exposure of historical data

**Recommendation**: **User-configurable retention** with default of 1 year:

```
Keep Fitbit data for: [ 30 days | 90 days | 1 year | Forever ]
```

---

## 7. Consent and Transparency

### 7.1 Explicit Consent Flows

**Current model**: CPAP data upload is implicitly consented (user uploads CSV).

**Fitbit integration**: Requires **explicit multi-stage consent**.

**Proposed consent flow**:

```
┌─────────────────────────────────────────────────────┐
│ Stage 1: Feature Explanation                          │
│                                                         │
│ 🔗 Connect Fitbit Account                            │
│                                                         │
│ "Import heart rate, SpO₂, and sleep data from your   │
│ Fitbit account. This data will be stored locally on  │
│ your device and analyzed alongside your CPAP data    │
│ to identify correlations."                             │
│                                                         │
│ [ Learn More ] [ Next ]                              │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│ Stage 2: Privacy & Data Handling                     │
│                                                         │
│ ✅ Your data stays on your device (never uploaded)   │
│ ✅ You can disconnect anytime                         │
│ ✅ Data is encrypted at rest (optional)              │
│ ⚠️ OSCAR Analyzer is NOT a medical device             │
│ ⚠️ Fitbit data is subject to Fitbit's privacy policy │
│                                                         │
│ [ Fitbit Privacy Policy ] [ Previous ] [ Agree ]     │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│ Stage 3: OAuth Authorization (Fitbit login)         │
│                                                         │
│ Redirects to Fitbit's login/approval screen          │
│ (User confirms permissions)                           │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│ Stage 4: Confirmation & Next Steps                  │
│                                                         │
│ ✅ Successfully connected to Fitbit!                  │
│                                                         │
│ Your Fitbit data is now synced locally. You can:     │
│ • View Fitbit data in the Dashboard                   │
│ • Analyze correlation with CPAP metrics              │
│ • Export combined analysis                            │
│ • Disconnect at any time                              │
│                                                         │
│ [ Go to Dashboard ]                                   │
└─────────────────────────────────────────────────────┘
```

### 7.2 Privacy Disclosure Document

**Content to include** (technical but accessible):

```markdown
## Fitbit Data Handling

### What Data We Access

- Heart rate (min/max/average per minute and per day)
- Blood oxygen (SpO₂) readings
- Sleep stages (deep, light, REM) and duration
- Respiratory rate (breathing rate during sleep)

### Where Data is Stored

- Your device only (local browser IndexedDB)
- No upload to OSCAR servers or third parties
- Data persists until you delete it or disconnect

### How We Use It

- Analyze correlation with CPAP therapy
- Visualize cardiovascular response to therapy
- Identify patterns in your sleep quality
- Generate reports for your healthcare provider

### How Long We Keep It

- Default: Keep indefinitely until you delete
- Optional: Auto-delete after 90 days or 1 year
- Disconnect: Removes all cached Fitbit data

### Your Rights

- **Disconnect**: Revoke access at any time
- **Export**: Download your combined analysis as CSV
- **Delete**: Manually or auto-delete all data
- **Device transfer**: Securely transfer to another device with passphrase

### Security

- Data at rest: Encrypted with AES-256-GCM (optional)
- Data in transit: HTTPS only (Fitbit API + your browser)
- Tokens: Encrypted locally; no storage on servers
- This app: NOT a medical device; for informational use only

### Third-Party (Fitbit)

- Fitbit collects similar data in their ecosystem
- Fitbit is owned by Google
- Subject to Fitbit's privacy policy: [link]
- OSCAR Analyzer does NOT share data with Fitbit

### Questions?

- See Privacy Policy: [link]
- Email support: [support email]
```

### 7.3 Right to Withdraw Consent

**User disconnects Fitbit connection** → What happens?

**Recommended flow**:

```javascript
async function disconnectFitbit() {
  // Show confirmation dialog
  const confirmed = await showDialog(
    'Disconnect Fitbit?',
    'Your Fitbit data will be deleted. This action cannot be undone. Continue?',
  );

  if (!confirmed) return;

  // 1. Revoke OAuth tokens with Fitbit
  await revokeFitbitAccess();

  // 2. Delete all cached Fitbit data
  await db.fitbitData.clear();
  await db.fitbitAuthTokens.clear();

  // 3. Clear memory
  setFitbitAccessToken(null);
  setFitbitMetrics(null);

  // 4. Update UI
  showNotification('Fitbit disconnected. All data deleted.');
}
```

---

## 8. Incident Response

### 8.1 Security Incident Classification

| Incident                                | Severity | Response                                                    |
| --------------------------------------- | -------- | ----------------------------------------------------------- |
| Access token compromised                | High     | Revoke token; advise user to check Fitbit account           |
| Refresh token compromised               | Critical | Revoke all tokens; may require user interaction with Fitbit |
| App data breach (GitHub leak)           | High     | Assess if secrets leaked; rotate credentials if needed      |
| User reports suspicious Fitbit activity | Medium   | Escalate to Fitbit; document for user                       |
| Fitbit API breach (Fitbit's incident)   | Critical | Not app's responsibility; document for transparency         |

### 8.2 User Suspicion Protocol

**User suspects their Fitbit data was accessed by unauthorized person.**

**Response steps**:

1. **Acknowledge concern**: "Thank you for reporting this. We take security seriously."
2. **Clarify app boundaries**:
   - "OSCAR Analyzer stores data only on your device; it doesn't receive or send data to servers."
   - "If Fitbit data is accessed, it would be through Fitbit's own security (not OSCAR)."
3. **Recommend user actions**:
   - Change Fitbit password
   - Enable 2FA on Fitbit account
   - Check "Authorized apps" in Fitbit settings
   - Revoke OSCAR Analyzer if suspicious
4. **Document incident**: Log report for audit trail
5. **Escalate to Fitbit**: If user suspects Fitbit account compromise, direct them to Fitbit support

### 8.3 Export File Injection

**Attack**: Malicious actor creates fake `.json.enc` file claiming to be a CPAP+Fitbit export, injects it with malicious data.

**Exploit mechanism**: If import validation is weak, malicious JSON could trigger XSS or other attacks.

**Mitigation**:

- Current validation (from `validateFileFormat()`) is strong; checks field types strictly
- Does NOT rely on user passphrase validation before file structure validation
- Protects against:
  - Prototype pollution attacks
  - Type confusion
  - Size-based DoS

**Testing**: Add security tests for malicious export files.

### 8.4 Device Compromise

**Scenario**: User's laptop is infected with malware; attacker can read IndexedDB and memory.

**Mitigation options**:

1. **Encryption at rest**: Makes data unreadable if decryption key is not in memory (doesn't help against active malware)
2. **Minimized lifetime**: Keep access_token in memory only; reduces exposure window
3. **User education**: "Keep your device secure; use antivirus and regular OS updates"

**Realistic risk assessment**: If device is actively compromised, all protections fail. Focus on preventing malware infection rather than hardening against active malware.

---

## 9. Compliance and Legal

### 9.1 HIPAA Compliance Considerations

**Is OSCAR Analyzer a HIPAA-covered entity?**

**Answer**: Likely NO for individual users; POSSIBLY YES for clinical deployments.

**HIPAA applicability**:

- ✅ **Covered**: If healthcare provider (hospital, clinic) uses it to create/store patient health records
- ✅ **Covered**: If app is used in research covered by HIPAA
- ❌ **Not covered**: Individual using personally-owned CPAP data for self-monitoring
- ❌ **Not covered**: De-identified/anonymized research data (safe harbor)

**If clinical deployment desired**:

1. **Formal risk assessment**: Conduct HIPAA Security Risk Analysis
2. **Business Associate Agreement (BAA)**: If healthcare provider uses app, BAA required
3. **Security safeguards**: Implement HIPAA-compliant encryption, access controls, audit logs
4. **Breach notification**: Plan for breach notification (60 days to notify patients)
5. **Documentation**: Maintain policies, risk assessments, training records

**Recommendation**: **Don't market as HIPAA-compliant**. Instead:

- Advertise "Privacy-focused" and "Local-first"
- Offer strong encryption and data minimization
- If healthcare provider inquires, explain current limitations (no audit logs, no BAA infrastructure)
- Clarify: "For personal use only; not suitable for patient care without additional compliance work"

### 9.2 GDPR Compliance

**Applicable if**:

- Users are EU residents
- Fitbit data collection is considered "processing" of personal data

**Key GDPR requirements**:

| Requirement                 | Implementation                                              |
| --------------------------- | ----------------------------------------------------------- |
| **Legal basis**             | Explicit consent (Article 9 for special categories)         |
| **Privacy notice**          | Comprehensive disclosure before data collection             |
| **Data minimization**       | Collect only what's necessary for stated purpose            |
| **Retention limits**        | Delete data after purpose is fulfilled                      |
| **User rights**             | Support data access, rectification, erasure, portability    |
| **Data protection officer** | Not required for small apps (≤10 employees)                 |
| **Privacy by design**       | Build privacy into architecture (already done: local-first) |

**Recommended GDPR checklist**:

- [ ] Privacy notice accessible before Fitbit connection
- [ ] Explicit consent checkbox: "I understand Fitbit data will be stored locally"
- [ ] Support data export (portability right)
- [ ] Support data deletion (right to erasure)
- [ ] Retention policy documented: "Data kept indefinitely unless user deletes"
- [ ] No third-party sharing: "Data never shared with Fitbit or other services"
- [ ] Response SLA for user rights requests: "14-day response time"

**Recommendation**: Add "Privacy" page to app with GDPR-compliant notice.

### 9.3 CCPA (California)

**Applicable if**: Users are California residents collecting health information.

**Key CCPA requirements**:

| Right                  | Implementation                                            |
| ---------------------- | --------------------------------------------------------- |
| **Right to know**      | Disclose what data is collected (Fitbit: HR, SpO₂, sleep) |
| **Right to delete**    | Support data deletion requests                            |
| **Right to opt-out**   | Allow users to disable Fitbit integration                 |
| **Non-discrimination** | Don't penalize users for exercising rights                |
| **Privacy notice**     | Disclose data practices                                   |

**Recommended CCPA notice**:

```
We collect the following information from Fitbit:
- Heart rate, blood oxygen, sleep stages, respiratory rate

We collect this for:
- Sleep therapy analysis and visualization

We do NOT:
- Sell or share your data
- Use data for marketing or profiling
- Share with third parties

You have the right to:
- Know what data we've collected: [Export Data button]
- Delete your data: [Delete Data button]
- Opt-out: [Disconnect Fitbit button]
```

### 9.4 Medical Device Classification

**Risk**: If app is marketed as diagnostic, may require FDA approval.

**Distinctions**:

| Category                      | FDA Status     | OK for OSCAR?                |
| ----------------------------- | -------------- | ---------------------------- |
| "Analyzes your sleep data"    | Not a device   | ✅ YES                       |
| "Educational platform"        | Not a device   | ✅ YES                       |
| "Visualizes therapy metrics"  | Not a device   | ✅ YES                       |
| "Diagnoses sleep apnea"       | Medical device | ❌ NO (requires FDA 510(k))  |
| "Predicts treatment response" | Medical device | ❌ NO                        |
| "Clinical decision support"   | Medical device | ⚠️ MAYBE (context-dependent) |

**Recommendation for OSCAR**:

- **Disclaimer**: "This app is for informational use. Not a medical device. Do not use for diagnosis or treatment decisions."
- **Positioning**: "Visualization and analysis tool for personal therapy data"
- **Disclaimers in app**:
  - "Results are educational only; consult your doctor"
  - "Not a substitute for professional medical advice"
  - "Not FDA-cleared or approved"

### 9.5 Intellectual Property & Fitbit ToS

**Risk**: Fitbit's ToS may restrict how their data can be used.

**Current Fitbit API ToS restrictions**:

- Data must be kept private (not shared publicly)
- Can't use data for competitive product without permission
- Can't reverse-engineer Fitbit algorithms

**OSCAR Analyzer context**:

- Data stays local; not shared publicly ✅
- Not competitive with Fitbit ✅
- Not reverse-engineering Fitbit algorithms ✅
- Personal analysis use case ✅

**Conclusion**: OSCAR integration likely complies with Fitbit ToS.

**Recommendation**: Review Fitbit ToS quarterly; document compliance.

---

## 10. Testing and Validation

### 10.1 Security Testing Plan

**OWASP Top 10 for Web Apps (2023)** - applicable to OSCAR:

| Vulnerability                 | Risk                               | Test                                            |
| ----------------------------- | ---------------------------------- | ----------------------------------------------- |
| **Injection**                 | Malicious export file injects code | Validate file format strictly ✅ (already done) |
| **Broken auth**               | Token mismanagement                | Test token refresh, expiration, revocation      |
| **Sensitive data exposure**   | Health data leaked in logs         | Audit logging; ensure no health metrics logged  |
| **XML external entity**       | Not applicable (JSON only)         | N/A                                             |
| **Broken access control**     | Unauthorized data access           | Test that user can only access own data         |
| **Security misconfiguration** | API secrets in code                | Scan for credentials in git                     |
| **XSS**                       | Attacker injects JavaScript        | Test CSP; audit DOM manipulation                |
| **Insecure deserialization**  | Malicious object deserialization   | Not applicable (JSON only)                      |
| **SSRF**                      | Server-side request forgery        | Not applicable (client-side only)               |
| **Cryptography failure**      | Weak encryption                    | Validate AES-256-GCM implementation             |

**Test cases**:

```javascript
// Test 1: Token security
describe('Fitbit token management', () => {
  it('should not log access tokens', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    refreshAccessToken();
    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('access_token'),
    );
  });

  it('should clear tokens on logout', async () => {
    await authenticateFitbit();
    await logoutFitbit();
    const stored = await db.fitbitAuthTokens.getAll();
    expect(stored).toEqual([]);
  });

  it('should refresh expired access token automatically', async () => {
    const originalToken = 'old_token_123';
    setFitbitAccessToken(originalToken);
    setAccessTokenExpiration(Date.now() - 1000); // Expired

    await fetchFitbitHeartRate();
    // Should have called refresh and gotten new token
    expect(getFitbitAccessToken()).not.toBe(originalToken);
  });
});

// Test 2: Encryption strength
describe('Encryption', () => {
  it('should use AES-256-GCM', async () => {
    const encrypted = await encryptData({ test: 'data' }, 'passphrase');
    // Check that algorithm is correct (via implementation detail)
    expect(encrypted.salt.length).toBe(16); // 128 bits
    expect(encrypted.iv.length).toBe(12); // 96 bits
  });

  it('should reject weak passphrases', () => {
    const validation = validatePassphrase('short');
    expect(validation.isValid).toBe(false);
  });

  it('should fail decryption with wrong passphrase', async () => {
    const data = { secret: 'value' };
    const encrypted = await encryptData(data, 'correct_passphrase');

    expect(() =>
      decryptData(
        encrypted.encrypted,
        encrypted.salt,
        encrypted.iv,
        'wrong_passphrase',
      ),
    ).rejects.toThrow('Incorrect passphrase');
  });
});

// Test 3: Export file validation
describe('Export file validation', () => {
  it('should reject malicious file with prototype pollution', () => {
    const malicious = {
      version: 1,
      constructor: { prototype: { admin: true } },
      salt: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      iv: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      data: [],
    };

    expect(() => validateFileFormat(malicious)).toThrow('Invalid file format');
  });

  it('should reject file with wrong salt size', () => {
    const badFile = {
      version: 1,
      salt: [0, 0], // Too short
      iv: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      data: [0, 0, 0, 0],
    };

    expect(() => validateFileFormat(badFile)).toThrow('incorrect salt size');
  });
});

// Test 4: XSS protection
describe('XSS protection', () => {
  it('should not expose health metrics in error messages', async () => {
    const maliciousData = 'SpO₂=85% AHI=45';
    expect(() => parseHealthData(maliciousData)).toThrow(
      expect.not.stringContaining('SpO₂'),
    );
  });
});
```

### 10.2 Encryption Implementation Validation

**Crypto test checklist**:

- [ ] PBKDF2 iterations = 100,000 (not lower)
- [ ] Salt length = 16 bytes (128 bits)
- [ ] IV length = 12 bytes (96 bits)
- [ ] Algorithm = AES-256-GCM
- [ ] Key derivation function = SHA-256
- [ ] Test vectors: Known plaintext → encrypted → decrypted matches plaintext
- [ ] Authentication failure: GCM rejects tampered ciphertext
- [ ] Key material cleared from memory after use

### 10.3 Integration Testing

**End-to-end scenarios**:

```javascript
describe('CPAP + Fitbit export/import', () => {
  it('should export and import combined data', async () => {
    // Load CPAP data
    const cpapData = await loadCSV(cpapFile);

    // Connect Fitbit (mock API)
    const fitbitData = await mockFitbitSync();

    // Export combined
    const exported = await exportEncryptedData(
      { cpapData, fitbitData },
      'testpassphrase123',
    );

    // Import on another "device"
    const imported = await importEncryptedData(exported, 'testpassphrase123');

    // Verify integrity
    expect(imported.cpapData).toEqual(cpapData);
    expect(imported.fitbitData).toEqual(fitbitData);
  });

  it('should fail import with wrong passphrase', async () => {
    const exported = await exportEncryptedData(data, 'correct');

    expect(() => importEncryptedData(exported, 'wrong')).rejects.toThrow(
      'Incorrect passphrase',
    );
  });
});
```

---

## 11. Documentation and User Education

### 11.1 Privacy Policy Update

**Sections to add**:

```markdown
## Data We Collect

### Fitbit Integration

If you connect your Fitbit account, we access:

- Heart rate (minute-level and daily averages)
- Blood oxygen (SpO₂) readings
- Sleep stages and duration
- Respiratory rate (if available on your Fitbit device)

### CPAP Data (existing)

- [existing CPAP data collection description]

## How We Use Your Data

### Fitbit + CPAP Analysis

We analyze Fitbit and CPAP data together to:

- Identify correlation between therapy settings and physiological response
- Visualize sleep stage transitions during therapy
- Assess therapy effectiveness over time

## Data Storage & Security

### Location

- All data stays on your device
- No synchronization to servers
- No backup to cloud services (unless you enable OS-level backup)

### Encryption

- Optional: Encrypt data at rest with AES-256-GCM
- All exports protected with user-provided passphrase
- OAuth tokens encrypted before IndexedDB storage

## Your Rights

### Data Access

- Click "Export Data" to download all collected information

### Data Deletion

- Delete individual data sources from Settings
- Or disconnect Fitbit to remove all Fitbit data
- Or clear all data from app

### Right to Withdraw

- Disconnect Fitbit anytime without losing CPAP analysis
- App continues to function with CPAP data alone

## Third Parties

### Fitbit

- Your Fitbit data is also subject to [Fitbit Privacy Policy](https://www.fitbit.com/en/legal/privacy-policy)
- OSCAR does NOT share data with Fitbit
- Fitbit data collection is controlled by Fitbit account settings

### No other third parties

- We don't share data with advertisers, researchers, or other services

## Important Disclaimers

- **Not a medical device**: This app is for informational use only
- **Not medical advice**: Do not use results for diagnosis or treatment decisions
- **Consult healthcare provider**: Always consult your doctor about therapy changes
```

### 11.2 User Guide: Fitbit Connection

**"How to Safely Connect Your Fitbit Account"**

```markdown
## Connecting Your Fitbit Account

### Step 1: Open Fitbit Connection Menu

In OSCAR Analyzer, click **Settings > Fitbit Integration**.

### Step 2: Understand What We'll Access

We'll request permission to read:

- ✅ Heart rate data
- ✅ Blood oxygen (SpO₂) readings
- ✅ Sleep stages and duration
- ❌ We won't access your Fitbit location, payments, or social data

### Step 3: Click "Connect Fitbit Account"

You'll be taken to Fitbit's secure login page.
**Important**: Make sure the URL shows `www.fitbit.com` (not a phishing site).

### Step 4: Log Into Fitbit

Enter your Fitbit username and password.

### Step 5: Approve Data Access

Fitbit will ask: "OSCAR Analyzer wants to access your Fitbit data."
Review permissions and click "Approve" or "Allow".

### Step 6: Sync Your Data

You'll be returned to OSCAR Analyzer.
Click **"Sync Now"** to import your latest Fitbit data.

## Securing Your Fitbit Account

### Enable Two-Factor Authentication (2FA)

1. Go to [https://www.fitbit.com/user/settings/security](https://www.fitbit.com/user/settings/security)
2. Click "Enable 2-Step Verification"
3. Choose SMS or authenticator app
4. Complete setup

### Review Connected Apps

1. Go to [https://www.fitbit.com/user/settings/apps](https://www.fitbit.com/user/settings/apps)
2. Check which apps have access to your data
3. Remove any unfamiliar apps

### Change Your Fitbit Password

1. Go to [https://www.fitbit.com/user/settings/security](https://www.fitbit.com/user/settings/security)
2. Click "Change Password"
3. Use a strong, unique password (15+ characters)

## If You Suspect Unauthorized Access

### What to do:

1. **Change your Fitbit password** immediately
2. **Check connected apps** (Settings > Apps) and remove suspicious entries
3. **In OSCAR Analyzer**: Go to Settings > Fitbit Integration > "Disconnect"
4. **Contact Fitbit support** if activity seems unusual

### What OSCAR will do:

- We will not attempt to detect or monitor for unauthorized access
- Fitbit is responsible for securing their accounts
- If your Fitbit account is compromised, OSCAR can't help (all data goes through Fitbit's servers)

## Disconnecting Your Fitbit Account

### To disconnect:

1. In OSCAR Analyzer, go Settings > Fitbit Integration
2. Click "Disconnect from Fitbit"
3. Confirm when prompted
4. All Fitbit data on your device will be **permanently deleted**

### What happens:

- ✅ Your Fitbit account remains active
- ✅ You can reconnect OSCAR later
- ✅ Fitbit data is removed from your device
- ✅ CPAP analysis continues as normal

## Storage and Backup

### Local Storage

Your Fitbit data is stored in your browser's local storage (IndexedDB).

- 📱 **Mobile**: Stored on your phone's browser
- 💻 **Desktop**: Stored on your computer's browser
- 🔄 **Not synced**: Data doesn't sync between devices by default

### Cloud Backups

If your device backs up browser data to cloud (iCloud, OneDrive, Google Drive):

- Your encrypted Fitbit data may be included
- This is controlled by your OS backup settings
- OSCAR can't prevent this (it's your device's responsibility)

### If You Reinstall Your Browser

Your Fitbit data will be lost unless:

- You exported it before reinstalling
- Your device restored from backup

**Recommendation**: Export your data regularly for safekeeping.

## Exporting Fitbit Data

### Export combined CPAP + Fitbit analysis:

1. Click **"Export Analysis"** in the header
2. Create a passphrase (12+ characters recommended)
3. Download the encrypted file
4. Store it securely (password manager, encrypted USB, etc.)

### Export Fitbit-only data as CSV:

1. Go to **Settings > Data Export**
2. Select "Fitbit Metrics"
3. Choose date range
4. Click "Download CSV"

---

## Frequently Asked Questions

### Q: Does OSCAR share my Fitbit data with anyone?

**A**: No. Your Fitbit data is stored only on your device. We don't send it to servers, share with advertisers, or use it for any purpose other than analysis within the app.

### Q: What if I delete Fitbit data from the app?

**A**: It's deleted from your device permanently. Your actual Fitbit account and Fitbit's servers are unaffected.

### Q: Can I export Fitbit+CPAP analysis together?

**A**: Yes! Use the "Export Analysis" button to download an encrypted file containing both datasets.

### Q: Can I move my Fitbit connection to another device?

**A**: You'll need to:

1. Export your analysis on Device A
2. Download the encrypted file
3. On Device B, import the file with the same passphrase
4. Reconnect your Fitbit account on Device B

### Q: Is this app approved by the FDA?

**A**: No. This is an informational analysis tool, not a medical device. Always consult your doctor before making therapy changes.

### Q: Can OSCAR detect if my Fitbit account is hacked?

**A**: No. OSCAR only reads data; we can't monitor your Fitbit account security. Fitbit is responsible for account security. Enable 2FA on your Fitbit account for better protection.

### Q: How much Fitbit data can I store?

**A**: As much as your device's storage allows. Most modern devices have 64GB+ storage, which can hold 10+ years of Fitbit data.
```

### 11.3 Security Best Practices Guide

**"Keeping Your Health Data Secure"**

```markdown
## Your Device Security

### Lock Your Device

- 🔐 Use a strong password (12+ characters, mix of letters/numbers/symbols)
- 📱 Enable fingerprint or face unlock if available
- 🚨 Never leave device unattended while logged into OSCAR

### Keep Software Updated

- 🔄 Enable automatic OS updates
- 📦 Update your browser regularly
- 🛡️ Update antivirus/malware scanner

### Avoid Public WiFi

- ⚠️ Don't connect to unsecured WiFi when using health data
- 🔐 If necessary, use VPN (NordVPN, ExpressVPN, Proton VPN)

## Password & Passphrase Security

### Create Strong Passphrases

For OSCAR export passphrases, use:

- 12+ characters (longer is better)
- Mix of uppercase, lowercase, numbers, symbols
- No dictionary words or personal information
- Example: `Th3r@py!2026#Sync`

### Use a Password Manager

- Store passphrases securely (1Password, Bitwarden, KeePass)
- Generate strong random passphrases
- Only you can access (with your master password)

### Never Share Passphrases

- Don't email passphrases
- Don't write on sticky notes
- Don't store unencrypted on shared devices

## File Security

### Encrypted Export Files

- Store in secure location (encrypted USB, password-protected folder)
- Don't email unless using encrypted email
- Don't upload to untrusted cloud services
- Keep backups in case device fails

### Avoid Screenshots

- Don't take screenshots of health metrics
- Don't share charts with identifiable information
- If sharing with doctor, use de-identified summary

## Account Security

### OSCAR Analyzer App

- No account needed (no login)
- No recovery system if you forget data
- No "master password" to bypass your passphrases
- **Your passphrases = your security guarantee**

### Fitbit Account

- Use unique password (different from other accounts)
- Enable 2-factor authentication (2FA)
- Review connected apps regularly
- Log out of Fitbit on shared devices

## What to Do If You Suspect a Problem

### If your device might be compromised:

1. **Stop using OSCAR on that device**
2. **Run antivirus scan** on your device
3. **Consider full device reset** (factory reset)
4. **Export your data** from a trusted device before reset
5. **Update your passphrase** if used on compromised device

### If your Fitbit account might be compromised:

1. **Change your Fitbit password immediately**
2. **Enable 2FA** if not already enabled
3. **Check connected apps** and remove suspicious ones
4. **In OSCAR**: Disconnect Fitbit and delete all cached data
5. **Contact Fitbit support** if activity seems unusual

### If your export file is lost/stolen:

1. **The file is useless without your passphrase** (encrypted)
2. **Change your passphrase** if concerned
3. **Export new analysis** with the updated passphrase
```

---

## 12. Continuous Improvement

### 12.1 Security Advisory Process

**Commitment**: Monitor security threats and update app accordingly.

**Process**:

1. **Subscribe to security mailing lists**:
   - Fitbit API security updates
   - Web Crypto API vulnerabilities
   - OWASP Top 10 updates
   - Node.js/npm security advisories

2. **Quarterly security review**:
   - Review GitHub security alerts
   - Check npm dependencies for vulnerabilities
   - Audit code for new threat patterns
   - Update threat model if needed

3. **Incident reporting**:
   - Email: `security@oscar-analyzer.com` (if established)
   - Or: GitHub security advisory
   - Response time: 48 hours acknowledgment, 30 days fix

### 12.2 Dependency Management

**Critical dependencies** (security-relevant):

- Web Crypto API (browser native; no external dependency)
- IndexedDB API (browser native; no external dependency)
- Fitbit API client (if any; prefer native fetch)

**Recommended approach**:

- Minimize external crypto libraries (use Web Crypto)
- Use native APIs where possible
- Pin versions to prevent breaking changes
- Use `npm audit` in CI/CD pipeline

### 12.3 User Feedback Loop

**Mechanisms for users to report security concerns**:

1. **GitHub Issues**: Labeled `[security]` (private if needed)
2. **Email**: For private disclosure (if policy established)
3. **Help/Support**: In-app channel for concerns

**Example**:

```markdown
## Report a Security Issue

Found a privacy concern? We want to know.

**Please don't post security issues publicly** (to give us time to fix).

### Private Reporting

Email: `kyle@oscar-analyzer.local` with:

- Description of the issue
- Steps to reproduce (if applicable)
- Potential impact
- Suggested fix (optional)

**Response time**: We aim to respond within 48 hours.

### Public Issues (non-security)

Use GitHub Issues for feature requests or bugs: https://github.com/kabaka/oscar-export-analyzer/issues
```

### 12.4 Periodic Security Audits

**Recommended cadence**: Annual third-party security audit (if resources permit).

**Audit scope**:

- Code review of encryption implementation
- OAuth token management
- Data handling in workers
- Export/import validation
- XSS and injection prevention
- Cryptographic parameter review

---

## Summary of Recommendations

### Critical Actions (Before Fitbit Release)

1. **Implement encrypted token storage** (IndexedDB with PBKDF2 derivation)
2. **Add comprehensive consent flow** (multi-stage modal with privacy disclosure)
3. **Implement token lifecycle management** (refresh, expiration, revocation)
4. **Add security-focused unit tests** (encryption, token handling, file validation)
5. **Update privacy documentation** (policy, user guides, disclaimers)
6. **Add CSP headers** (defense against XSS)
7. **Implement safe error handling** (no health metrics in error messages)

### Important (Before or Shortly After Release)

8. **Automated security testing** in CI/CD (dependency audits, linting)
9. **User education materials** (how to connect Fitbit securely, best practices)
10. **Incident response protocol** (document escalation process)
11. **Fitbit API monitoring** (status page subscription)
12. **GDPR/CCPA compliance review** (legal consultation if possible)

### Nice-to-Have (Future Improvements)

13. **End-to-end encryption for export** (beyond AES-256-GCM)
14. **Device fingerprinting** for token validation
15. **Automatic data retention policy** (user-configurable)
16. **Third-party security audit** (annual)
17. **Transparency report** (publish on privacy practices)

---

## Conclusion

Fitbit integration is **feasible with strong privacy protections** equivalent to the current CPAP-only architecture. The combination of Fitbit+CPAP data is **higher sensitivity** than either dataset alone, warranting careful attention to consent, encryption, and user education.

**Risk level**: **Medium** (manageable with recommended mitigations)

**Key success factors**:

1. Explicit multi-stage consent
2. Strong token lifecycle management
3. Secure encryption at rest (optional but recommended)
4. Comprehensive user education
5. Clear compliance boundaries (not a medical device)

The recommended approach maintains the **local-first privacy model** while adding thoughtful security practices for the additional complexity of OAuth tokens and third-party authentication.

---

**Document prepared**: January 24, 2026  
**Security auditor**: [@security-auditor agent mode]  
**Status**: Ready for development team review and implementation planning
