# PWA Browser Sync Security Evaluation for OSCAR Export Analyzer

**Date**: 2026-01-24  
**Agent**: @security-auditor  
**Status**: Security Assessment for PWA Implementation Planning

---

## Executive Summary

**RECOMMENDATION: DO NOT enable automatic browser sync for OSCAR CPAP health data.**

Browser sync mechanisms introduce significant privacy and security risks that are **fundamentally incompatible** with OSCAR Export Analyzer's local-first privacy architecture and the sensitive nature of Protected Health Information (PHI).

**Key Findings**:

- ❌ Browser sync transmits data to vendor cloud services (Google, Mozilla, Apple)
- ❌ Violates "no network uploads" privacy guarantee
- ❌ Introduces third-party data custody and potential compliance issues
- ❌ Creates new attack vectors (account compromise, vendor breaches)
- ✅ Alternative: Explicit, user-controlled export/import workflow maintains privacy

---

## 1. Browser Sync Mechanisms: How They Work

### 1.1 Chrome Sync (Google Chrome/Edge)

**Architecture**:

- Syncs via Google Sync servers (or Microsoft for Edge)
- Data encrypted in transit (TLS) and at rest on servers
- Encryption key derived from user's Google account password
- Optional passphrase for end-to-end encryption (not default)

**What Gets Synced for PWAs**:

- **IndexedDB**: NOT synced by default (as of 2026)
- **localStorage**: NOT synced directly
- **Service Worker cache**: NOT synced
- **PWA install state**: Synced (app shortcuts, permissions)
- **Credentials**: Passwords/payment methods synced if enabled

**Encryption Model**:

- Without custom passphrase: Google can decrypt data (uses password-derived key)
- With custom passphrase: End-to-end encrypted, Google cannot decrypt
- Default mode: Google has technical access to decrypted data

**Data Location**: Google Cloud servers (various jurisdictions)

### 1.2 Firefox Sync (Mozilla)

**Architecture**:

- Syncs via Mozilla Sync servers
- End-to-end encryption by default (key derived from Firefox account password)
- Mozilla claims they cannot decrypt synced data

**What Gets Synced for PWAs**:

- **IndexedDB**: NOT synced by default
- **localStorage**: NOT synced directly
- **Service Worker data**: NOT synced
- **Add-ons/extensions**: Synced
- **Open tabs**: Synced (including PWA tabs)

**Encryption Model**:

- Always end-to-end encrypted (E2EE)
- Key derived from user's Firefox account password
- Mozilla cannot decrypt data in theory (but holds encryption infrastructure)

**Data Location**: Mozilla servers (AWS, various regions)

### 1.3 Safari iCloud Sync (Apple)

**Architecture**:

- Syncs via iCloud servers
- End-to-end encryption for some data types (as of iOS 16.2+)
- Encryption model depends on "Advanced Data Protection" setting

**What Gets Synced for PWAs**:

- **IndexedDB**: NOT synced automatically
- **Safari data**: Tabs, history, reading list synced
- **Keychain**: Credentials synced (E2EE with Advanced Data Protection)
- **Website data**: Some website preferences synced

**Encryption Model**:

- Without Advanced Data Protection: Apple can decrypt most data
- With Advanced Data Protection: E2EE for most categories
- Default mode: Apple has technical access

**Data Location**: iCloud servers (global, various data centers)

### 1.4 Critical Finding: IndexedDB NOT Synced by Default

**As of 2026, none of the major browsers sync IndexedDB data automatically for PWAs.** This is by design:

- IndexedDB can contain large amounts of data
- Privacy/bandwidth concerns
- App-specific data better managed by app developers

This means OSCAR's CPAP data in IndexedDB **would not sync** via built-in browser sync without additional implementation.

---

## 2. Privacy Risk Analysis

### 2.1 Violation of Local-First Privacy Model

**Current Privacy Guarantee**: "All data stays in browser, no network uploads, no cloud storage"

**Browser Sync Impact**:

- ❌ **Breaks core promise**: Data would upload to vendor cloud services
- ❌ **Third-party custody**: Google/Mozilla/Apple would hold PHI data
- ❌ **Network transmission**: Direct violation of "no network uploads" claim
- ❌ **Opaque processing**: Users may not understand vendor access level

**User Expectation Violation**:

- Users choose OSCAR analyzer specifically for local-only processing
- Browser sync happens passively/automatically if enabled
- Users may not realize health data is syncing to cloud
- No explicit consent flow for PHI cloud upload

### 2.2 Data Exposure Scenarios

**Scenario 1: Cloud Storage Breach**

- Vendor server compromise exposes synced PHI data
- Even with encryption, breaches happen (key management failures)
- CPAP data is highly personal: therapy effectiveness, compliance, sleep patterns

**Scenario 2: Account Compromise**

- User's browser account hacked (password reuse, phishing)
- Attacker gains access to all synced data including CPAP metrics
- Chrome sync without custom passphrase: Attacker can decrypt data

**Scenario 3: Vendor Access**

- Google/Apple could technically access data (non-E2EE modes)
- Government/legal requests could compel vendor to provide data
- Vendor policy changes could expand data usage

**Scenario 4: Syncing to Compromised Device**

- User logs into browser account on public/shared computer
- CPAP data syncs to untrusted device
- Data persists after logout unless explicitly cleared

**Scenario 5: Unintended Sharing**

- User shares browser profile with family member
- CPAP data syncs to shared profile
- Privacy violation within household

### 2.3 Encryption is Not Enough

**Even with E2EE**:

- ✅ Protects data in transit and at rest on servers
- ❌ Does NOT prevent vendor server breaches of encrypted data
- ❌ Does NOT prevent account compromise (key derived from password)
- ❌ Does NOT prevent data syncing to untrusted devices
- ❌ Does NOT provide user control over when/where data travels

**Key Management Risks**:

- Password-derived keys: Weak if user has weak password
- Account recovery mechanisms often bypass E2EE
- Vendor holds encryption infrastructure (trust required)

---

## 3. Security Implications

### 3.1 New Attack Vectors

**Attack Surface Expansion**:

1. **Vendor Infrastructure**: New target for attackers (Google/Mozilla/Apple servers)
2. **Account Credentials**: Browser account becomes high-value target
3. **Sync Protocol**: Potential vulnerabilities in sync implementation
4. **Man-in-the-Middle**: Additional network traffic to intercept
5. **Device Enumeration**: Attacker who compromises one device can discover others

**Specific Threats**:

- **Credential Stuffing**: Reused passwords make accounts vulnerable
- **Social Engineering**: Attackers target browser account recovery
- **Vendor Insider Threat**: Rogue employees with server access
- **Government Surveillance**: Legal requests to vendors for synced data
- **Cross-Device Tracking**: Sync activity reveals device usage patterns

### 3.2 Trust Model Changes

**Current Model**: User trusts only their local device

- Data never leaves device
- No third parties involved
- User has complete control

**Browser Sync Model**: User must trust:

1. Browser vendor (Google/Mozilla/Apple)
2. Vendor's encryption implementation
3. Vendor's server security
4. Vendor's data handling policies
5. Vendor's jurisdiction and legal obligations
6. All devices syncing to their account

**This is a fundamental shift in trust architecture.**

### 3.3 Data Retention and Deletion

**Current Model**: User deletes data in browser, it's gone immediately

**Browser Sync Model**:

- Data may persist on vendor servers after deletion
- Unclear retention policies for synced health data
- Deletion from one device may not delete from cloud immediately
- Vendor backups may retain data longer
- Forensic recovery may be possible from vendor infrastructure

---

## 4. Compliance Considerations

### 4.1 HIPAA/PHI Framework (U.S. Context)

**Current Status**: OSCAR Export Analyzer is not HIPAA-covered

- No healthcare provider relationship
- No electronic health record system
- User controls their own data locally
- No business associate agreements needed

**With Browser Sync**: Potentially introduces complications

- User uploads PHI to third-party vendor (Google/Mozilla/Apple)
- Vendors are not HIPAA business associates for this use case
- Unclear if user consent for sync = consent for PHI cloud storage
- Vendors' terms of service may disclaim health data usage

**Key Concern**: Vendors are NOT designed for PHI storage

- No HIPAA business associate agreements
- Terms of service exclude healthcare use cases
- No guarantees about data handling for medical data

### 4.2 GDPR/Privacy Regulations (EU/UK Context)

**Data Processor Requirements**:

- Browser vendors become data processors if syncing PHI
- Users may not understand this relationship
- GDPR requires explicit consent for health data processing
- Unclear if browser sync consent = health data consent

**Right to be Forgotten**:

- Users must be able to delete data completely
- Browser sync retention policies may not comply
- Vendor data retention may exceed user expectations

**Cross-Border Transfers**:

- Syncing data to vendor servers may cross jurisdictions
- EU-US data transfers have specific requirements
- Users may not control where data is stored

### 4.3 Recommendation: Compliance Perspective

**Safest Approach**: Do not enable browser sync for PHI data

- Avoids third-party data processor complications
- Maintains user control and consent clarity
- Eliminates cross-border transfer concerns
- Keeps OSCAR analyzer outside HIPAA/GDPR risk zones

---

## 5. Alternative Approaches for Cross-Device Portability

OSCAR Export Analyzer can provide cross-device data portability **without browser sync** while maintaining privacy guarantees.

### 5.1 Explicit Export/Import Workflow (RECOMMENDED)

**Design**:

- User explicitly exports data from device A (encrypted or plain JSON)
- User transfers file via their chosen method (USB, email, cloud storage)
- User imports data into device B

**Privacy Benefits**:

- ✅ User controls when/where data travels
- ✅ User chooses transfer method (can use offline methods)
- ✅ No automatic third-party involvement
- ✅ Maintains local-first guarantee

**Implementation**:

- "Export Data" button → downloads encrypted JSON file
- "Import Data" button → loads file into IndexedDB
- Optional encryption with user-provided passphrase
- Clear labeling: "This file contains your CPAP health data"

**User Experience**:

- Slightly more manual than auto-sync
- But provides transparency and control
- Familiar pattern (like backing up data)

### 5.2 File System Access API (Future Enhancement)

**Design**:

- Use File System Access API to let user designate sync folder
- App reads/writes to user-chosen location (e.g., Dropbox folder)
- User controls sync via their file sync service

**Privacy Benefits**:

- ✅ User chooses sync provider explicitly
- ✅ User controls encryption via chosen service
- ✅ App doesn't implement sync, just file I/O
- ✅ Transparent to user

**Limitations**:

- Requires browser support (not Safari as of 2026)
- User must manage conflicts manually
- Still introduces third-party custody

### 5.3 P2P Sync (WebRTC/Local Network)

**Design**:

- Direct device-to-device sync over local network or WebRTC
- No cloud intermediary
- User initiates sync explicitly

**Privacy Benefits**:

- ✅ No third-party servers
- ✅ Data never leaves user's devices
- ✅ True local-first sync
- ✅ E2EE by default (WebRTC)

**Limitations**:

- Complex to implement
- Requires both devices online simultaneously
- May require signaling server (but not data server)
- Firewall/NAT traversal challenges

### 5.4 QR Code Transfer (Small Datasets)

**Design**:

- Export summary data as encrypted QR code
- Scan QR code on second device to import

**Privacy Benefits**:

- ✅ No network transmission
- ✅ Air-gapped transfer
- ✅ Highly transparent to user

**Limitations**:

- Limited data size (few KB max)
- Awkward UX for large datasets
- Better for configuration than full data sync

---

## 6. Recommendations: PWA Sync Strategy

### 6.1 For Initial PWA Implementation

**DO**:

1. ✅ **Do NOT enable automatic browser sync** for IndexedDB data
2. ✅ **Implement explicit export/import workflow** as primary cross-device mechanism
3. ✅ **Document privacy model clearly** in PWA install prompts and settings
4. ✅ **Add encryption option** for exported data files (user-provided passphrase)
5. ✅ **Label exported files clearly**: "OSCAR_Export_CPAP_Data_2026-01-24.json.enc"
6. ✅ **Add data deletion audit trail** to confirm local deletion

**DO NOT**:

1. ❌ **Do NOT implement custom sync service** (violates local-first model)
2. ❌ **Do NOT use browser sync APIs** even if they become available
3. ❌ **Do NOT auto-upload data** to any cloud service
4. ❌ **Do NOT suggest users store unencrypted exports** in cloud storage

### 6.2 Privacy Disclosure for PWA

**Recommended Disclosure** (in PWA install prompt and README):

> **Privacy Notice**: OSCAR Export Analyzer processes your CPAP therapy data entirely on your device. Your health data never leaves your browser and is not uploaded to any servers.
>
> **Cross-Device Sync**: We do not use automatic browser sync. To transfer data between devices, use the "Export Data" feature to save an encrypted file, then import it on your other device. You control where and how this file is transferred.
>
> **Data Storage**: Your data is stored in your browser's IndexedDB. To delete your data, use the "Delete All Data" button in settings, then clear your browser's site data.

### 6.3 Future Considerations

**If user demand for sync is high**:

1. **Option A**: Implement File System Access API (user-controlled sync folder)
   - Clear disclosure that user is choosing to use third-party sync
   - Encryption mandatory, user provides passphrase
   - Documented as "Advanced: Use Your Own Cloud Storage"

2. **Option B**: P2P local network sync
   - Direct device-to-device over local Wi-Fi
   - No cloud intermediary
   - Preserves local-first model

3. **Option C**: Partner with privacy-focused sync providers
   - Explicit user opt-in
   - E2EE mandatory
   - Clear disclosure of third-party involvement
   - Still violates pure local-first model

**Never**: Enable automatic browser vendor sync for PHI data.

---

## 7. Implementation Guidance for PWA

### 7.1 Export/Import Feature Design

**Export**:

```javascript
// Example export flow
function exportData() {
  const data = await getAllDataFromIndexedDB();
  const encrypted = await encryptData(data, userPassphrase);
  const blob = new Blob([JSON.stringify(encrypted)], { type: 'application/json' });
  const filename = `OSCAR_Export_${new Date().toISOString().split('T')[0]}.json.enc`;

  // Trigger download with clear security warning
  downloadFile(blob, filename);

  alert('Your CPAP data has been exported to an encrypted file. Keep this file secure—it contains your health data.');
}
```

**Import**:

```javascript
// Example import flow
function importData(file) {
  // Validate file
  if (!file.name.includes('OSCAR_Export')) {
    throw new Error('Invalid file format');
  }

  const encrypted = await file.text();
  const data = await decryptData(JSON.parse(encrypted), userPassphrase);

  // Ask user for confirmation before overwriting
  if (await confirmImport()) {
    await saveToIndexedDB(data);
  }
}
```

### 7.2 Security Checklist for Export/Import

- [ ] Encrypt exported data with user-provided passphrase (AES-256-GCM)
- [ ] Use strong key derivation (PBKDF2 or Argon2, 100k+ iterations)
- [ ] Include salt and IV in exported file format
- [ ] Validate file format strictly on import
- [ ] Sanitize/validate all imported data before saving to IndexedDB
- [ ] Clear passphrase from memory after use
- [ ] Warn user if exporting unencrypted data (optional mode)
- [ ] Add checksum/HMAC to detect file tampering
- [ ] Test export/import with large datasets (10k+ records)
- [ ] Document file format in case user needs manual recovery

### 7.3 User Education

**In-App Messaging**:

- "Your data stays on this device" banner in PWA
- "No automatic sync" disclosure in settings
- "Export to transfer to other devices" tooltip
- "Keep encrypted files secure" warning on export

**Documentation**:

- Dedicated FAQ: "How do I sync data between devices?"
- Clear explanation of why we don't use browser sync
- Step-by-step guide for export/import workflow
- Security best practices for storing exported files

---

## 8. Risk Assessment Summary

### 8.1 Risk Matrix: Browser Sync vs. Export/Import

| Risk Category                    | Browser Sync     | Export/Import                       |
| -------------------------------- | ---------------- | ----------------------------------- |
| **Third-party data custody**     | ❌ High          | ✅ None (user controls)             |
| **Network exposure**             | ❌ High          | ✅ None (offline transfer possible) |
| **Account compromise impact**    | ❌ High          | ✅ Low (file-level only)            |
| **Unintended data sharing**      | ❌ Medium        | ✅ Low (explicit transfer)          |
| **Compliance complexity**        | ❌ High          | ✅ Low                              |
| **Vendor dependency**            | ❌ High          | ✅ None                             |
| **User control**                 | ❌ Low (passive) | ✅ High (explicit)                  |
| **Privacy guarantee maintained** | ❌ No            | ✅ Yes                              |
| **Data deletion assurance**      | ❌ Low           | ✅ High                             |

### 8.2 Severity Assessment

**Using Browser Sync for CPAP Data**: 🔴 **HIGH RISK**

**Rationale**:

- Fundamentally violates privacy model
- Introduces third-party custody of PHI
- Expands attack surface significantly
- Creates compliance uncertainty
- Reduces user control and transparency

**Recommended Approach**: 🟢 **LOW RISK**

**Rationale**:

- Maintains local-first privacy guarantee
- User controls all data transfers
- No third-party involvement by default
- Clear, auditable data flow
- Preserves compliance simplicity

---

## 9. Conclusion

### 9.1 Final Recommendation

**DO NOT enable automatic browser sync for OSCAR CPAP health data.**

Instead, implement an **explicit, user-controlled export/import workflow** that:

1. Maintains the local-first privacy guarantee
2. Gives users full control over when/how data moves
3. Avoids third-party data custody and compliance issues
4. Provides transparency about data flows
5. Enables cross-device portability without privacy compromise

### 9.2 Trade-offs

**What we gain**:

- ✅ Preserve privacy guarantees and user trust
- ✅ Avoid security/compliance complexity
- ✅ Maintain control over data lifecycle
- ✅ Transparent, auditable data flows

**What we lose**:

- ❌ Automatic, seamless cross-device sync
- ❌ Real-time data availability across devices
- ❌ "It just works" convenience of browser sync

**The trade-off is worth it**: For PHI data, privacy and user control outweigh convenience. Users who choose OSCAR analyzer specifically value local-only processing. Violating this promise for sync convenience would be a mistake.

### 9.3 Next Steps for PWA Implementation

1. Design and implement export/import workflow with encryption
2. Add clear privacy disclosures to PWA install prompts
3. Document sync limitations and alternatives in user guide
4. Test export/import with realistic CPAP datasets
5. Consider P2P sync as future enhancement (maintains local-first)
6. Get user feedback on export/import UX before committing to sync approach

### 9.4 Open Questions for Discussion

1. **Encryption UX**: Should encryption be mandatory or optional for exports?
   - Recommendation: Mandatory by default, warn loudly if user disables

2. **File format**: JSON? Binary? Custom format?
   - Recommendation: JSON for transparency and recovery, encrypt with standard crypto

3. **Conflict resolution**: How to handle importing data that conflicts with local data?
   - Recommendation: Let user choose (merge, replace, cancel) with clear preview

4. **Partial sync**: Should users be able to export/import specific date ranges?
   - Recommendation: Yes, reduces file size and gives more control

---

## 10. References & Further Reading

**Browser Sync Documentation**:

- [Chrome Sync Encryption](https://www.google.com/chrome/privacy/whitepaper.html#sync)
- [Firefox Sync Technical Details](https://mozilla-services.readthedocs.io/en/latest/sync/)
- [Apple iCloud Security Overview](https://support.apple.com/guide/security/icloud-security-overview-sec1b8defe97/)

**Privacy & Security Standards**:

- [HIPAA Security Rule](https://www.hhs.gov/hipaa/for-professionals/security/)
- [GDPR Article 9 (Health Data)](https://gdpr-info.eu/art-9-gdpr/)
- [NIST SP 800-53 (Security Controls)](https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final)

**Web APIs**:

- [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)

---

**Document Status**: Ready for incorporation into PWA implementation plan.  
**Next Action**: Review with project owner, incorporate into architecture decision, implement export/import workflow.  
**Cleanup**: Delete this file after findings are integrated into permanent documentation.
