# ADR-0002: Progressive Web App (PWA) Implementation

**Date**: January 24, 2026  
**Status**: Accepted

---

## Context

OSCAR Export Analyzer is a web-based CPAP therapy data analysis tool running entirely in the browser. Users requested the ability to:

1. **Use the app offline** — Analyze data during travel or in locations without internet access
2. **Install as a native-like app** — Eliminate browser chrome distractions during medical data review
3. **Transfer analyses between devices** — Start analysis on desktop, continue on tablet/mobile

The application handles sensitive Protected Health Information (PHI) including:

- Apnea event timestamps and severity
- Pressure settings (EPAP/IPAP) indicating diagnosis
- Usage patterns revealing sleep schedules
- SpO2 and leak data from therapy sessions

**Current State**:

- Deployed to GitHub Pages (static hosting, no backend)
- Requires internet to load initial app bundle
- Runs entirely in browser (local-first architecture)
- Data stored in IndexedDB (browser-local only)
- Session export/import exists but unencrypted

**Requirements**:

- Maintain 100% local-first privacy model (no automatic cloud sync)
- Support offline analysis after initial load
- Enable installation on desktop and mobile platforms
- Provide secure cross-device data portability
- Non-disruptive user experience (no forced updates during analysis)
- WCAG AA accessibility compliance
- Minimal bundle size impact (≤5% increase)

---

## Decision

We implement Progressive Web App (PWA) capabilities using the following approach:

### 1. Service Worker for Offline Capability

**Technology**: `vite-plugin-pwa` with Workbox

- **Strategy**: Cache-First for app assets (HTML, JS, CSS, fonts, icons)
- **Scope**: Cache only static app shell, **never cache user data (CSV files, sessions)**
- **Update model**: `registerType: 'prompt'` — user confirms updates (no auto-reload)
- **Configuration**: GitHub Pages base path `/oscar-export-analyzer/` in manifest and service worker scope

**Rationale**:

- Workbox provides battle-tested caching strategies and lifecycle management
- Cache-First strategy ensures offline reliability while minimizing network requests
- Excluding user data from cache prevents accidental PHI storage outside IndexedDB
- User-controlled updates prevent interruptions during medical data analysis

### 2. Web App Manifest for Installability

**Display Mode**: `standalone` — Full-screen app without browser UI

**Icons**: PWA icons at 192×192, 512×512 (standard), and 512×512-maskable (adaptive Android)

**Theme**: Dark theme (`#121212`) matching application default for medical professional context

**Metadata**:

- Name: "OSCAR Sleep Data Analyzer"
- Short name: "OSCAR Analyzer"
- Categories: `["health", "medical", "utilities"]`
- Orientation: `"any"` (responsive design supports all orientations)

**Rationale**:

- Standalone mode eliminates browser distractions (tabs, address bar) during professional analysis
- Maskable icons ensure proper appearance on Android adaptive icon systems
- Health/medical categorization aids app store discovery (if extended to store distribution)

### 3. Custom Install Experience

**Implementation**: Custom install prompt in Header Menu + educational modal

**Flow**:

1. Detect `beforeinstallprompt` event (Chrome/Edge)
2. Show "Install App" option in header menu (not browser default banner)
3. User clicks → Educational modal explains PWA benefits
4. User confirms → Trigger native install prompt
5. Post-install onboarding explains local-only storage model

**Rationale**:

- Custom prompt provides medical context and privacy reassurance before install
- Educational modal addresses user concerns about data privacy
- Post-install onboarding prevents confusion about data sync (none exists)
- Non-intrusive: install option in menu, not blocking banner

### 4. Encrypted Cross-Device Export/Import

**Encryption**: AES-256-GCM with PBKDF2 key derivation (100,000 iterations)

**Workflow**:

1. User exports session with user-provided passphrase
2. Web Crypto API encrypts data (client-side only)
3. Encrypted file downloaded (`.json.enc` extension)
4. User transfers file manually (AirDrop, email, USB, cloud)
5. User imports on another device with same passphrase
6. Data decrypted client-side, loaded into IndexedDB

**Privacy Model**: **No automatic browser sync** — User controls all data transfers

**Rationale**:

- Encryption protects PHI during manual transfer (email, cloud storage)
- User-provided passphrase ensures only authorized access
- Web Crypto API provides cryptographically strong encryption without dependencies
- Manual transfer workflow maintains full user control (no automatic sync)
- `.json.enc` extension signals encrypted content to user

### 5. Non-Disruptive Update Notifications

**Strategy**: Show update notification on app launch (not during active session)

**User Control**: "Update Now" (reload) or "Not Now" (dismiss, reappears next launch)

**Timing**: Check for updates on app load, apply on user confirmation

**Rationale**:

- Medical analysis sessions should never be interrupted by forced updates
- User chooses when to apply updates (e.g., after exporting current work)
- Non-blocking notification (bottom-right corner) doesn't obscure data
- Respects `prefers-reduced-motion` for accessibility

### 6. Offline Status Indicators

**Implementation**: Offline indicator (top-right header) shows network status

**States**:

- Hidden when online
- "Offline Mode" badge when disconnected
- "You're Offline" toast on transition to offline

**Rationale**:

- Clear feedback when offline prevents user confusion
- Toast notification ensures user notices offline transition
- Always-visible indicator reinforces offline capability

---

## Consequences

### Positive

- ✅ **Offline access**: Users can analyze data without internet (flights, remote locations)
- ✅ **Native-like experience**: Standalone mode eliminates browser distractions during professional analysis
- ✅ **Cross-device workflow**: Encrypted export enables desktop → mobile → tablet workflows
- ✅ **Privacy preserved**: No automatic sync, user controls all data transfers
- ✅ **Non-disruptive updates**: User chooses when to update (no interruptions during analysis)
- ✅ **Faster subsequent loads**: Service worker cache reduces load time after first visit
- ✅ **Professional appearance**: Installed PWA feels more legitimate for medical use
- ✅ **Minimal overhead**: ~20 KB bundle increase (4%), acceptable for benefits gained

### Negative

- ⚠️ **iOS Safari limitations**: Service workers evicted after ~2 weeks of inactivity (requires refresh)
- ⚠️ **Manual sync complexity**: Users must manually export/import to transfer data between devices
- ⚠️ **Passphrase management**: Users must remember encryption passphrase (no recovery mechanism)
- ⚠️ **Storage quota concerns**: PWA cache uses browser storage quota (mitigated by caching only app shell)
- ⚠️ **Platform install differences**: Install flow varies by browser (Chrome vs Safari vs Firefox)
- ⚠️ **Update timing**: Users may delay updates indefinitely, missing bug fixes

### Mitigations

- Document iOS Safari eviction behavior in user guide troubleshooting section
- Provide clear export/import instructions with transfer method recommendations
- Include passphrase strength meter and best practices guidance in export modal
- Exclude all user data from service worker cache (only cache static assets)
- Document browser-specific install instructions in user guide
- Show update notifications persistently (reappear on each launch until applied)

---

## Alternatives Considered

### Alternative A: Use Automatic Browser Sync (Rejected)

**Pros**:

- Seamless cross-device experience
- No manual export/import workflow
- No passphrase management for users

**Cons**:

- **CRITICAL PRIVACY VIOLATION**: PHI automatically uploaded to browser vendor servers (Google, Apple, Mozilla)
- Violates local-first architecture principle
- User has no control over data transmission
- Regulatory concerns (HIPAA-adjacent, varies by jurisdiction)
- Trust model completely incompatible with medical data

**Why rejected**: Automatic browser sync fundamentally violates the privacy model users expect when analyzing sensitive health data. Users must have full control over when and how their data leaves their device.

---

### Alternative B: Implement Cloud Backup Service (Rejected)

**Pros**:

- Professional cross-device sync
- Automatic backups
- Password recovery possible

**Cons**:

- Requires backend infrastructure (contradicts GitHub Pages static deployment)
- Ongoing hosting costs
- Privacy concerns storing PHI on third-party servers
- HIPAA compliance burden (if regulated)
- User trust issues (who controls the server?)
- Increases attack surface

**Why rejected**: Backend service contradicts project architecture (static GitHub Pages), introduces hosting costs, and creates privacy concerns that undermine user trust.

---

### Alternative C: Use Native Apps Instead of PWA (Rejected)

**Pros**:

- Best native integration (file system, notifications)
- App store distribution
- No service worker eviction issues

**Cons**:

- Requires maintaining separate codebases (iOS Swift, Android Kotlin, desktop Electron)
- 10x development effort for feature parity
- App store fees and review delays
- Loses web development velocity (React, Vite)
- Harder for open-source contributions (requires platform-specific expertise)

**Why rejected**: Native apps require massive engineering effort for marginal benefits. PWA provides 90% of native benefits with 10% of the maintenance burden.

---

### Alternative D: Use IndexedDB Sync API (Rejected)

**Pros**:

- Standard web API for background sync
- No custom encryption needed

**Cons**:

- Limited browser support (Chrome only as of 2026)
- Still requires backend service (see Alternative B objections)
- Automatic sync conflicts with privacy model
- Users can't control when sync occurs

**Why rejected**: Limited browser support and same privacy objections as Alternative A.

---

### Alternative E: Use WebRTC for Local Network Sync (Considered for Future)

**Pros**:

- Peer-to-peer sync (no cloud servers)
- Privacy-preserving (data never leaves local network)
- No backend required

**Cons**:

- Complex implementation (NAT traversal, signaling)
- Requires both devices online simultaneously
- Debugging challenges (network topology variations)
- Limited browser support for advanced features

**Why not chosen now**: Excellent long-term option but too complex for initial PWA implementation. Manual encrypted export/import provides simpler solution with same privacy guarantees.

---

## Implementation Details

### Bundle Size Impact

**Before PWA**: ~480 KB gzipped  
**After PWA**: ~500 KB gzipped (+20 KB, 4.2% increase)

**Breakdown**:

- `vite-plugin-pwa`: ~12 KB (build tool, not in bundle)
- `workbox-window`: ~8 KB (service worker registration)
- Web Crypto API: 0 KB (native browser API)

### Browser Support

| Feature                  | Chrome/Edge | Safari | Firefox | Safari iOS | Chrome Android |
| ------------------------ | ----------- | ------ | ------- | ---------- | -------------- |
| Service Worker           | ✅          | ✅     | ✅      | ✅         | ✅             |
| Install Prompt           | ✅          | ✅     | ✅      | ✅         | ✅             |
| Standalone Display       | ✅          | ✅     | ✅      | ✅         | ✅             |
| Push Notifications       | ❌          | ❌     | ❌      | ❌         | ❌             |
| Background Sync          | ❌          | ❌     | ❌      | ❌         | ❌             |
| Web Crypto API           | ✅          | ✅     | ✅      | ✅         | ✅             |
| IndexedDB                | ✅          | ✅     | ✅      | ✅         | ✅             |
| `beforeinstallprompt`    | ✅          | ❌     | ❌      | ❌         | ✅             |
| Add to Home Screen (iOS) | ❌          | ✅     | ❌      | ✅         | ❌             |

**Notes**:

- Push notifications intentionally not implemented (no notification use case)
- Background sync not used (violates privacy model)
- Safari iOS uses Share → "Add to Home Screen" instead of `beforeinstallprompt`
- All browsers support core PWA features (offline, install, encryption)

### Testing Requirements

**Cross-Browser Testing**:

- Chrome/Edge (desktop & Android): Install prompt, offline mode, updates
- Safari (macOS & iOS): Add to Home Screen, service worker persistence
- Firefox (desktop & Android): Install flow, offline capability

**Accessibility Testing**:

- Lighthouse PWA audit score 100%
- Lighthouse Accessibility audit ≥95%
- Screen reader testing (NVDA, VoiceOver)
- Keyboard navigation (all PWA features accessible)
- Color contrast WCAG AA (4.5:1)
- Touch targets ≥44×44px (mobile)

**Security Testing**:

- Encryption validation (AES-256-GCM correct)
- Key derivation secure (PBKDF2 ≥100k iterations)
- No passphrase leakage (console, logs, error messages)
- File format validation (corrupted files handled gracefully)

**Performance Testing**:

- Bundle size ≤5% increase (target met: 4.2%)
- First Contentful Paint (FCP) <1.5s
- Largest Contentful Paint (LCP) <2.5s
- Time to Interactive (TTI) <3.5s
- No memory leaks (10-minute analysis session)

---

## Deployment Verification

**GitHub Pages Configuration**:

- ✅ HTTPS enabled (required for service workers)
- ✅ Base path `/oscar-export-analyzer/` matches Vite config
- ✅ Service worker scope correct (`/oscar-export-analyzer/`)
- ✅ Manifest accessible at `/oscar-export-analyzer/manifest.webmanifest`
- ✅ Icons accessible (no 404s)

**Lighthouse Audits** (required before deployment):

- PWA audit: 100%
- Accessibility audit: ≥95%
- Performance audit: ≥90%

---

## Future Enhancements

**Potential additions if user demand warrants**:

1. **QR Code Export**: Generate QR code for small datasets (phone → tablet without files)
2. **WebRTC Local Sync**: Peer-to-peer sync over local network (no cloud)
3. **Partial Export**: Export specific date ranges (reduce file size)
4. **App Shortcuts**: Quick actions on PWA icon (e.g., "Load Data", "Export")
5. **Web Share API**: Share exported files via native share dialog (mobile)
6. **Storage Quota Indicator**: Show available browser storage

**Not planned** (violates privacy model or adds complexity without proportional benefit):

- ❌ Cloud backup/sync
- ❌ Push notifications (no notification use case)
- ❌ Background data processing (analysis requires user attention)
- ❌ Geolocation (no location-based features)

---

## References

**Planning Documents**:

- [PWA Implementation Plan](../../reports/2026-01-pwa-planning/implementation-plan.md)
- [PWA Security Evaluation](../../reports/2026-01-pwa-planning/pwa-security-evaluation.md)
- [PWA Technical Implementation](../../reports/2026-01-pwa-planning/pwa-technical-implementation.md)
- [PWA UX Evaluation](../../reports/2026-01-pwa-planning/pwa-ux-evaluation.md)

**Standards & Best Practices**:

- [MDN: Progressive Web Apps](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [Web App Manifest Specification](https://www.w3.org/TR/appmanifest/)
- [Service Worker Specification](https://www.w3.org/TR/service-workers/)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

**Related ADRs**:

- [ADR-0001: Working Directory Policy](0001-working-directory-policy.md) — Temporary file management during PWA development

---

## Approval

**Decision Maker**: Project maintainer  
**Reviewed By**: @security-auditor, @frontend-developer, @ux-designer  
**Approved Date**: 2026-01-24

---

## Changelog

| Date       | Change                        | Author                    |
| ---------- | ----------------------------- | ------------------------- |
| 2026-01-24 | Initial ADR created           | @documentation-specialist |
| 2026-01-24 | Accepted after Phase 5 review | Project maintainer        |
