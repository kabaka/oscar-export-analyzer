# PWA UX Evaluation for OSCAR Export Analyzer

**Date**: 2026-01-24  
**Agent**: @ux-designer  
**Status**: UX Design Guidance for PWA Implementation  
**Context**: Converting medical data analysis tool into Progressive Web App

---

## Executive Summary

Progressive Web App features can **significantly enhance** OSCAR Export Analyzer's usability by providing offline reliability, app-like focus, and reduced friction for repeat analysis sessions. However, PWA features must be designed carefully to avoid confusing non-technical medical device users and to reinforce (not undermine) the app's privacy-first architecture.

**Key UX Principles**:

- ✅ **Clarity over cleverness** — Explain what PWA features do in plain language
- ✅ **Privacy reinforcement** — Use PWA onboarding to emphasize local-only storage
- ✅ **Progressive disclosure** — Don't overwhelm users with install prompts immediately
- ✅ **Respect analysis flow** — Never interrupt active data analysis with updates or prompts
- ✅ **Medical context appropriateness** — Frame benefits around therapy tracking, not "app coolness"

**Recommended Approach**: Implement PWA features with **opt-in discoverability** rather than aggressive promotion. Users who benefit most (frequent analyzers) will discover and adopt install; casual users can continue using web version without friction.

---

## 1. Install Prompts: Discovery Without Intrusion

### 1.1 Recommendation: Custom Install Prompt (Not Browser Default)

**Decision**: Create custom install prompt UI integrated into Header Menu, NOT browser's automatic prompt.

**Rationale**:

- Browser's default prompt appears unpredictably and can confuse users mid-workflow
- Custom UI allows control over timing, messaging, and accessibility
- Medical users need context: "Why should I install?" not just "Add to home screen"
- Custom prompt can include privacy reassurance (important for health data tool)

**Implementation Pattern**:

```jsx
// Detect PWA installability
const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null);
const [showInstallOption, setShowInstallOption] = useState(false);

useEffect(() => {
  const handleBeforeInstallPrompt = (e) => {
    e.preventDefault(); // Prevent automatic browser prompt
    setDeferredInstallPrompt(e);
    setShowInstallOption(true); // Show custom UI option
  };

  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  return () =>
    window.removeEventListener(
      'beforeinstallprompt',
      handleBeforeInstallPrompt,
    );
}, []);

const handleInstallClick = async () => {
  if (!deferredInstallPrompt) return;

  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;

  if (outcome === 'accepted') {
    // User installed — hide option
    setShowInstallOption(false);
  }
  setDeferredInstallPrompt(null);
};
```

### 1.2 Install Option Placement: Header Menu Integration

**Location**: Add "Install App" option to existing Header Menu (hamburger menu)

**Menu Structure** (updated):

```
☰ Menu
  ├─ Load Data...
  ├─ Export Session (JSON)
  ├─ Export Aggregates (CSV)
  ├─ Clear Session
  ├─ Print Page...
  ├─ User Guide
  ├─ [DIVIDER]
  └─ ✨ Install App (NEW)
```

**Visual Treatment**:

- Use subtle icon (✨ sparkle or 📥 download box) to differentiate from data actions
- Highlight with light background color on first appearance (dismiss after first view)
- Remove option once installed (detect with `window.matchMedia('(display-mode: standalone)')`)

**Accessibility**:

```jsx
<button
  role="menuitem"
  onClick={handleInstallClick}
  aria-label="Install OSCAR Analyzer as standalone app"
  className="menu-item menu-item-highlight"
>
  <span className="menu-icon" aria-hidden="true">
    ✨
  </span>
  <span>Install App</span>
  <span className="menu-badge">New</span>
</button>
```

**Copy for Menu Item**:

- Primary: "Install App"
- Hover tooltip: "Install for offline access and app-like experience"
- Screen reader: "Install OSCAR Analyzer as standalone app"

### 1.3 Install Explanation Modal

**Trigger**: Clicking "Install App" opens explanatory modal BEFORE triggering browser install prompt

**Modal Purpose**:

1. Explain what "installing" means to non-technical users
2. Clarify benefits for CPAP data analysis workflow
3. Reinforce privacy model (local-only storage)
4. Set expectations (offline capability, faster access)

**Modal Content** (wireframe):

```
┌─────────────────────────────────────────────────────────────┐
│  Install OSCAR Analyzer                                   × │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📱 What is "Installing"?                                   │
│                                                             │
│  Installing lets you use OSCAR Analyzer like a regular     │
│  desktop or mobile app:                                    │
│                                                             │
│  ✓ Works fully offline — analyze data without internet     │
│  ✓ Opens in own window — fewer distractions, no browser    │
│    tabs                                                     │
│  ✓ Access from desktop/home screen — no bookmarks needed   │
│  ✓ Faster startup — app assets cached locally              │
│                                                             │
│  🔒 Privacy: All your data stays on this device            │
│                                                             │
│  Your CPAP data is stored locally in your browser (never   │
│  uploaded to servers). Installing doesn't change this —    │
│  your data remains private and local-only.                 │
│                                                             │
│  💡 Recommended for frequent users                         │
│                                                             │
│  If you analyze your OSCAR exports regularly (weekly,      │
│  monthly), installing makes access easier. Casual users    │
│  can continue using the web version — it works the same!   │
│                                                             │
│                                                             │
│     [ Not Now ]                [ Install App ]             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Copy Principles**:

- Use **plain language**, avoid jargon ("service worker", "PWA", "manifest")
- Frame benefits around **therapy tracking workflow**, not technology
- **Reassure privacy** explicitly (counteract cloud storage assumptions)
- Make "Not Now" equally prominent (no dark patterns)

**Accessibility**:

- Modal auto-focus on "Not Now" (safe default)
- Keyboard: Tab between buttons, Escape to close
- ARIA: `role="dialog"`, `aria-labelledby="install-modal-title"`
- Screen reader announcement: "Install App dialog opened. Explains offline capability and privacy."

### 1.4 Timing and Frequency

**NEVER show install prompt**:

- ❌ On first visit (user hasn't used app yet, can't evaluate value)
- ❌ While CSV upload is in progress
- ❌ While charts are rendering (interrupts analysis)
- ❌ On mobile during scrolling or chart interaction
- ❌ More than once per session (respect dismissal)

**Acceptable timing**:

- ✅ User completes first analysis session (has seen value)
- ✅ User returns for 2nd+ visit (demonstrates repeated use)
- ✅ User explicitly clicks "Install App" in menu (always available)

**Persistent Availability**:

- Install option remains in Header Menu for discoverable access
- Remove subtle highlight after first view, but keep option visible
- Once installed, replace with "Open as App" link (for users who installed elsewhere)

---

## 2. Offline Mode UX: Communicating Capability

### 2.1 Current Problem: Hidden Offline Capability

**Issue**: OSCAR Analyzer already works fully offline (IndexedDB, no network requests), but users don't know this. PWA implementation makes offline mode _official_ and more reliable (service worker caching), but **UX must make this visible**.

**User Research Insight**:

- Medical device users often analyze data in clinical settings (hospitals, sleep labs) with restricted WiFi
- Traveling CPAP users want to check data on planes, in hotels without internet
- Privacy-conscious users want confirmation that app isn't phoning home

**Design Goal**: Surface offline capability without cluttering UI or creating alarm ("Why is it offline?")

### 2.2 Offline Status Indicator: Subtle and Informative

**Location**: Header area, near theme toggle (top-right region)

**Visual Design**:

```
┌─────────────────────────────────────────────────────────────┐
│ OSCAR Sleep Data Analyzer        📅 [Date Filter]  ☀️ 🌙 📡 │
│                                                             │
│ Summary: 42 nights | Details: 84,319 events                │
└─────────────────────────────────────────────────────────────┘
      ↑ Status shown here when relevant
```

**Indicator States**:

1. **Online (installed PWA)**:
   - Icon: 📡 (antenna) or ✓ (checkmark) in subtle gray
   - Tooltip: "App ready — works offline"
   - No color emphasis (normal state)

2. **Offline (network lost)**:
   - Icon: 📡 with slash (⚠️) or ✈️ (airplane)
   - Color: Amber/yellow (not red — offline is expected/okay)
   - Tooltip: "Offline mode — analysis still works"
   - ARIA live region: "Network unavailable. Analysis continues normally."

3. **Never show if**:
   - User hasn't installed PWA (web users don't need offline indicator)
   - App is online and no special status to report

**Implementation**:

```jsx
function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const isPWA = window.matchMedia('(display-mode: standalone)').matches;

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Only show in installed PWA mode
  if (!isPWA) return null;

  return (
    <div
      className={`offline-indicator ${!isOnline ? 'offline' : ''}`}
      role="status"
      aria-live="polite"
      title={
        isOnline
          ? 'App ready — works offline'
          : 'Offline mode — analysis still works'
      }
    >
      <span aria-label={isOnline ? 'Online' : 'Offline'}>
        {isOnline ? '📡' : '✈️'}
      </span>
    </div>
  );
}
```

**CSS**:

```css
.offline-indicator {
  display: flex;
  align-items: center;
  font-size: 1.2rem;
  color: var(--color-text-secondary);
  cursor: help;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.offline-indicator.offline {
  color: var(--color-warning); /* Amber, not red */
  opacity: 1;
}

.offline-indicator:hover {
  opacity: 1;
}
```

### 2.3 Offline Confirmation Toast (First Time Only)

**Trigger**: When PWA service worker activates for the first time (after install)

**Purpose**: Teach users that offline mode is available and normal

**Toast Message**:

```
┌───────────────────────────────────────────────┐
│ ✓ App installed successfully                  │
│                                               │
│ You can now analyze OSCAR data offline —     │
│ no internet required.                         │
│                                               │
│                              [ Got it ]       │
└───────────────────────────────────────────────┘
```

**Behavior**:

- Auto-dismiss after 8 seconds OR user clicks "Got it"
- Never show again (store `localStorage` flag: `offline-toast-shown`)
- Non-blocking: appears in corner, doesn't interrupt workflow
- Respects `prefers-reduced-motion` (no fancy animations)

**Accessibility**:

- ARIA live region: `role="status"`, `aria-live="polite"`
- Screen reader: "App installed successfully. You can now analyze OSCAR data offline."
- Focus management: Optional "Got it" button receives focus (keyboard dismissal)

### 2.4 Handling External Help Links (Offline)

**Problem**: User Guide button in Header Menu currently opens GitHub-hosted documentation. In offline mode, this fails silently or shows browser error.

**Solution**: Inline essential help content in PWA bundle

**Implementation Strategy**:

1. **Bundle core documentation** in `src/docs/` as JSON or Markdown
   - Include: Getting Started, Visualizations, Data Dictionary, FAQ
   - Exclude: Contribution guide, developer docs (not relevant to end users offline)

2. **Modify "User Guide" button behavior**:

   ```jsx
   const handleOpenGuide = () => {
     if (isPWA && !navigator.onLine) {
       // Open bundled offline docs
       openInlineGuide();
     } else {
       // Open GitHub docs (online)
       window.open('https://github.com/user/repo/docs', '_blank');
     }
   };
   ```

3. **Inline guide viewer** (similar to existing `DocsModal`):
   - Render Markdown from bundled content
   - Use existing modal UI (already WCAG AA compliant)
   - Add "View full docs online" link at bottom (disabled when offline)

**Offline Help UX**:

```
┌─────────────────────────────────────────────────────────────┐
│  User Guide (Offline Version)                            × │
├─────────────────────────────────────────────────────────────┤
│  Table of Contents          │  Getting Started             │
│  ─────────────────          │  ─────────────────           │
│  • Getting Started          │  This guide shows how to     │
│  • Visualizations           │  load OSCAR CSV exports...   │
│  • Data Dictionary          │                              │
│  • FAQ                      │  [Content rendered inline]   │
│                             │                              │
│  ℹ️ Offline mode: Showing   │                              │
│  essential docs only.       │                              │
│  Full docs available        │                              │
│  online at GitHub.          │                              │
└─────────────────────────────────────────────────────────────┘
```

**Alternative** (if inline docs too large):

- Show offline placeholder: "User Guide requires internet connection. Download the PDF guide at [link] for offline reference."
- Provide downloadable PDF in GitHub releases (users can save locally)

### 2.5 Error Messaging: Differentiating Offline from Bugs

**Problem**: Users may confuse offline limitations with app bugs ("Why doesn't this work?")

**Solution**: Clear error messages that explain cause and provide resolution

**Offline Error Pattern** (for any network-dependent feature):

```
┌───────────────────────────────────────────────┐
│ ⚠️ Network Required                           │
│                                               │
│ This feature requires an internet            │
│ connection. Your OSCAR data analysis         │
│ works fully offline, but [feature name]      │
│ needs network access.                        │
│                                               │
│ • Connect to WiFi or mobile data             │
│ • Or try again later                         │
│                                               │
│                              [ Dismiss ]      │
└───────────────────────────────────────────────┘
```

**Copy Principles**:

- Name the specific feature that needs network (don't say "app doesn't work offline")
- Reassure that core functionality (data analysis) still works
- Provide actionable steps (connect to network)
- Avoid technical jargon ("service worker failed", "fetch error")

---

## 3. App-Like Experience: Display Mode and Navigation

### 3.1 Recommended Display Mode: `standalone`

**Decision**: Use `"display": "standalone"` in web app manifest

**Alternatives Considered**:

- `fullscreen` — Too immersive, hides system UI (bad for medical users who may need clock, notifications)
- `minimal-ui` — Shows minimal browser chrome (back button, URL) — unnecessary clutter
- `browser` — Full browser UI (defeats purpose of PWA)
- `standalone` — **Best choice**: Looks like native app, no browser chrome, but keeps OS-level UI

**Manifest Configuration**:

```json
{
  "display": "standalone",
  "orientation": "any"
}
```

**Rationale for Medical Use Case**:

- **Focus**: Eliminates browser tabs, URL bar, bookmarks toolbar — reduces distractions during data analysis
- **Immersion**: Charts and data fill entire window (maximizes screen real estate)
- **OS Integration**: Appears in app switcher (Cmd+Tab on Mac, Alt+Tab on Windows) like native apps
- **Familiarity**: Medical professionals expect desktop apps for clinical tools (standalone matches this mental model)

### 3.2 Navigation Considerations: No Browser Chrome

**Challenge**: Standalone mode removes browser back/forward buttons. OSCAR Analyzer is single-page app (SPA) with no multi-page navigation, so this is **not a problem**, but design must ensure users don't feel trapped.

**Current Navigation Pattern**:

- Sidebar TOC for section navigation (desktop)
- Hamburger menu for mobile
- No "back" button needed (all views accessible from TOC)

**PWA Navigation Requirements**:

- ✅ **No changes needed** — current design already self-contained
- ✅ Sidebar TOC provides clear navigation structure
- ✅ Header always visible (scrolls with content or sticky)
- ✅ No external links requiring "back" navigation (except User Guide)

**Edge Case**: If user opens external link (GitHub docs) in standalone PWA:

- Link opens in system browser (default behavior)
- User returns to PWA via app switcher (not browser back button)
- **No UX issue** — this is expected PWA behavior

### 3.3 Splash Screen and Loading Experience

**Browser Behavior**: When launching installed PWA, browser shows splash screen with:

- App icon (from manifest)
- App name (from manifest)
- Background color (from manifest `background_color`)

**Manifest Configuration**:

```json
{
  "name": "OSCAR Sleep Data Analyzer",
  "short_name": "OSCAR Analyzer",
  "background_color": "#f5f5f5",
  "theme_color": "#121212",
  "icons": [
    {
      "src": "/oscar-export-analyzer/pwa-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/oscar-export-analyzer/pwa-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

**Design Recommendations**:

1. **Icon Design** (PWA app icon):
   - Use OSCAR logo or derivative (medical device context)
   - Ensure icon is recognizable at 192x192px (desktop) and 512x512px (mobile)
   - Test with maskable icon safe zone (center 80% of icon must be visible)
   - High contrast for visibility on various home screen backgrounds

2. **Background Color**:
   - Use `#f5f5f5` (light neutral) for splash screen background
   - Matches app's light theme default
   - Avoid pure white (harsh on launch) or dark colors (jarring if user uses light theme)

3. **Theme Color**:
   - Use `#121212` (dark) for browser UI theming (address bar, etc.)
   - Consistent with app's dark theme palette
   - Only visible on Android (colors browser chrome to match app)

**Post-Splash Loading State**:

- PWA splash screen disappears when app HTML loads
- Use existing loading patterns (import progress, chart rendering spinners)
- **No additional loading screen needed** — app is already optimized

### 3.4 Benefits of App-Like Experience for Medical Analysis

**Why standalone mode benefits CPAP data analysis**:

1. **Reduced Cognitive Load**:
   - No browser tabs competing for attention
   - No accidental navigation away from analysis
   - Full screen real estate for charts and data tables

2. **Clinical Workflow Integration**:
   - Medical professionals treat as clinical tool (like EHR software)
   - Appears in app switcher alongside other medical apps
   - Distinct from "browsing the web" mental mode

3. **Distraction-Free Analysis**:
   - No browser notifications (email, social media) interrupting review
   - No temptation to open other tabs during analysis session
   - Focused environment for interpreting medical data

4. **Perceived Trustworthiness**:
   - Installed apps feel more "official" than websites (mental model)
   - Important for medical tools where trust is critical
   - Reinforces local-first privacy (data in "my app", not "on website")

---

## 4. Cross-Device Experience: Data Portability Without Auto-Sync

### 4.1 Challenge: Educating Users About Local-Only Storage

**Problem**: Users expect apps to sync data across devices automatically (iCloud, Google Drive). OSCAR Analyzer's privacy model **prohibits this**, but users may not understand why or how to move data manually.

**Educational Moment**: PWA install is perfect opportunity to explain local-only storage

**Onboarding Message** (shown after PWA installation):

```
┌───────────────────────────────────────────────────────────────┐
│ 🎉 Welcome to OSCAR Analyzer                                  │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│ Your CPAP data stays on this device                          │
│                                                               │
│ For your privacy, this app stores data locally in your       │
│ browser — it's never uploaded to servers or synced to        │
│ cloud services.                                               │
│                                                               │
│ 📱 Using multiple devices?                                    │
│                                                               │
│ If you want to analyze data on another device (phone,        │
│ tablet, other computer):                                      │
│                                                               │
│ 1. Export your session (Menu → Export Session)               │
│ 2. Transfer JSON file (email, USB drive, AirDrop)            │
│ 3. Import on other device (Load Data → drop JSON)            │
│                                                               │
│ 💡 Each device is independent — no automatic sync            │
│                                                               │
│ This is by design to protect your health data. You have      │
│ full control over when and where your data moves.            │
│                                                               │
│                                            [ Got It ]         │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

**Behavior**:

- Show once after first PWA installation (set flag in IndexedDB)
- Dismissible with "Got It" button
- Re-accessible from Help menu ("About Data Privacy")

### 4.2 Enhanced Export UI: "Use on Another Device" Feature

**Current Export**: Menu → Export Session (JSON) → generic file download

**Enhanced Export for PWA**:

Add explicit "Export for Another Device" menu item with contextual help:

```
☰ Menu
  ├─ Load Data...
  ├─ Export Session (JSON)
  │   └─ 💡 Tip: Use this to transfer data to another device
  ├─ Export for Mobile/Tablet (NEW)
  ├─ Export Aggregates (CSV)
  ...
```

**"Export for Mobile/Tablet" Feature**:

- Same JSON export, but with additional UI guidance
- Modal explains: "This file contains your current analysis session. Transfer it via AirDrop, email, or USB to analyze on another device."
- Generates QR code for easy mobile transfer (optional enhancement)
- Includes instructions: "On your other device, open OSCAR Analyzer and import this file."

**Implementation**:

```jsx
function ExportForDeviceModal({ onExport, onClose }) {
  return (
    <div className="modal-backdrop">
      <div
        className="modal"
        role="dialog"
        aria-labelledby="export-device-title"
      >
        <div className="modal-header">
          <h2 id="export-device-title">Export for Another Device</h2>
          <button onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-body">
          <p>
            This will download your current analysis session as a JSON file.
            Transfer this file to your other device to continue your analysis
            there.
          </p>

          <h3>Transfer Methods:</h3>
          <ul>
            <li>
              <strong>AirDrop</strong> (Mac/iPhone): Share file directly
            </li>
            <li>
              <strong>Email</strong>: Send file to yourself
            </li>
            <li>
              <strong>USB Drive</strong>: Copy file to external storage
            </li>
            <li>
              <strong>Cloud Storage</strong>: Upload to Dropbox/Drive (⚠️
              sensitive data warning)
            </li>
          </ul>

          <p className="warning-text">
            ⚠️ <strong>Privacy Note:</strong> The exported file contains your
            CPAP health data. Avoid uploading to cloud services unless you trust
            their security.
          </p>

          <div className="modal-actions">
            <button onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button onClick={onExport} className="btn-primary">
              Download File
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 4.3 Import Experience: Detecting Device Type

**UX Enhancement**: When importing session JSON, detect if user is on different device and provide contextual help

**Detection Logic**:

```jsx
const exportedDevice = sessionData.metadata?.deviceInfo; // Store during export
const currentDevice = {
  platform: navigator.platform,
  userAgent: navigator.userAgent.slice(0, 100), // Hash for privacy
};

const isDifferentDevice =
  exportedDevice && exportedDevice.platform !== currentDevice.platform;

if (isDifferentDevice) {
  showToast({
    message:
      'Session imported from another device. All data transferred successfully!',
    icon: '✓',
    duration: 5000,
  });
}
```

**Import Flow**:

1. User drags JSON file into app (existing behavior)
2. App detects cross-device import
3. Toast confirmation: "Session imported from [Mac/Windows/Mobile]. All data transferred!"
4. Reinforces mental model: "I moved my data manually, it worked"

### 4.4 Cloud Storage Warning: Balancing Convenience and Privacy

**Dilemma**: Users may want to use cloud storage (Dropbox, Google Drive) to sync JSON exports. This is **technically possible but privacy-risky**.

**UX Approach**: Allow but warn

**Warning Modal** (when user chooses cloud storage export):

```
┌───────────────────────────────────────────────────────────────┐
│ ⚠️ Cloud Storage Privacy Warning                              │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│ You're about to upload your CPAP data to a cloud service.    │
│                                                               │
│ The exported file contains:                                  │
│ • Nightly AHI values (apnea severity)                        │
│ • Therapy pressure settings                                  │
│ • Usage hours and leak rates                                 │
│ • Session dates and timestamps                               │
│                                                               │
│ ⚠️ This is Protected Health Information (PHI)                │
│                                                               │
│ Cloud services may:                                          │
│ • Store data on their servers                               │
│ • Scan files for malware (= reading contents)               │
│ • Be subject to legal data requests                         │
│                                                               │
│ Safer alternatives:                                          │
│ • AirDrop / USB drive (direct transfer, no cloud)           │
│ • Password-protected email                                   │
│ • Encrypted cloud storage (Tresorit, Sync.com)              │
│                                                               │
│ Do you want to proceed with cloud upload?                    │
│                                                               │
│   [ Cancel ]    [ I Understand, Proceed ]                    │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

**When to Show**:

- Only if user explicitly chooses cloud storage (via browser "Save to..." picker)
- NOT shown for local file downloads
- Dismissible with "Don't show again" checkbox (after first acknowledgment)

**Copy Principles**:

- Be direct about PHI risks (medical users understand this)
- Provide specific alternatives (actionable guidance)
- Respect user autonomy ("I Understand, Proceed" option)
- No judgment ("unsafe", "bad choice") — educate and empower

---

## 5. Accessibility Considerations: PWA-Specific Features

### 5.1 Install Button Accessibility

**Requirements**:

- Keyboard operable (Enter/Space to activate)
- Screen reader announcement: "Install OSCAR Analyzer as standalone app"
- Focus visible (high contrast outline)
- Sufficient target size (44×44px minimum for touch)

**Implementation**:

```jsx
<button
  role="menuitem"
  onClick={handleInstallClick}
  aria-label="Install OSCAR Analyzer as standalone app. Enables offline access and app-like experience."
  className="menu-item menu-item-install"
  style={{ minHeight: '44px', minWidth: '44px' }}
>
  <span className="menu-icon" aria-hidden="true">
    ✨
  </span>
  <span>Install App</span>
</button>
```

**Focus Management**:

- When install modal opens, focus moves to "Not Now" button (safe default)
- Trap focus within modal (Tab cycles between "Not Now" and "Install App")
- On dismiss, return focus to menu trigger button
- Follow existing modal accessibility patterns (see `docs/developer/accessibility.md`)

### 5.2 Offline Status Accessibility

**Screen Reader Announcements**:

Use ARIA live regions to announce offline state changes:

```jsx
<div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
  {!isOnline && 'Network unavailable. Analysis continues normally.'}
  {isOnline && wasOffline && 'Network connection restored.'}
</div>
```

**Rationale**:

- `aria-live="polite"` — Announce when user is idle (don't interrupt active reading)
- `aria-atomic="true"` — Read entire message as single unit
- `.sr-only` class — Hidden visually, but read by screen readers

**Visual Indicator Accessibility**:

- High contrast icon (passes WCAG AA at normal size)
- Tooltip on hover (redundant information for keyboard users)
- Emoji icon + text label: "Offline" (not icon-only)

### 5.3 PWA Update Notification Accessibility

**Challenge**: Update prompts must be perceivable to screen reader users

**Implementation**:

```jsx
function UpdateNotification({ onUpdate, onDismiss }) {
  const updateRef = useRef(null);

  useEffect(() => {
    // Auto-focus notification for keyboard users
    updateRef.current?.focus();
  }, []);

  return (
    <div
      ref={updateRef}
      role="alertdialog"
      aria-labelledby="update-title"
      aria-describedby="update-desc"
      className="update-notification"
      tabIndex={-1}
    >
      <h2 id="update-title">New Version Available</h2>
      <p id="update-desc">
        A new version of OSCAR Analyzer is ready. Reload to update?
      </p>
      <div className="update-actions">
        <button onClick={onDismiss} className="btn-secondary">
          Not Now
        </button>
        <button onClick={onUpdate} className="btn-primary">
          Update Now
        </button>
      </div>
    </div>
  );
}
```

**ARIA Attributes**:

- `role="alertdialog"` — Announced immediately by screen readers
- `aria-labelledby` / `aria-describedby` — Provide context
- Auto-focus on dialog for keyboard navigation

**Keyboard Navigation**:

- Tab between "Not Now" and "Update Now"
- Enter/Space to activate
- Escape to dismiss (same as "Not Now")

### 5.4 Focus Management in Standalone Mode

**Challenge**: Standalone PWA mode may affect screen reader navigation if focus is lost on launch

**Solution**: Ensure focus is set to main content region on app load

```jsx
useEffect(() => {
  // Set focus to main content region when app loads
  const mainContent = document.querySelector('main');
  if (mainContent && !document.activeElement?.closest('main')) {
    mainContent.focus();
  }
}, []);
```

**ARIA Landmarks**:

- Ensure `<main>` region is properly labeled: `<main aria-label="OSCAR data analysis">`
- Use `role="banner"` for header
- Use `role="navigation"` for sidebar TOC
- Follow existing accessibility patterns (already WCAG AA compliant)

### 5.5 Color Contrast for PWA-Specific UI

**Requirements**: All new PWA UI elements must meet WCAG AA standards

**Contrast Ratios**:

- Normal text (body copy): **4.5:1 minimum**
- Large text (18pt+): **3:1 minimum**
- UI components (buttons, icons): **3:1 minimum**

**Testing**:

- Use browser DevTools (Lighthouse accessibility audit)
- Test in light and dark themes
- Verify offline indicator icon contrast
- Check install button focus outline

**PWA Icon Contrast**:

- Install icon (✨ sparkle): Use high contrast version in dark theme
- Offline icon (✈️ airplane): Ensure visible on both light/dark backgrounds

---

## 6. Update Experience: Non-Disruptive Version Management

### 6.1 Recommended Strategy: Prompt on Update (No Auto-Reload)

**Decision**: Use `registerType: 'prompt'` in PWA config (NOT `autoUpdate`)

**Rationale**:

- Medical analysis sessions may be long (reviewing 6 months of data)
- Auto-reload interrupts workflow and loses scroll position
- Users may have unsaved notes or filters applied
- Respectful UX: ask permission before disrupting work

**Alternative Rejected**: `autoUpdate` mode

- ❌ Reloads app immediately when new version is available
- ❌ No user control or warning
- ❌ Bad for any data-intensive app (especially medical)

### 6.2 Update Notification UI: Contextual and Dismissible

**Appearance**: Toast notification in bottom-right corner (non-blocking)

**Visual Design**:

```
┌─────────────────────────────────────────┐
│  ↻ New Version Available                │
│                                         │
│  OSCAR Analyzer has been updated.      │
│  Reload to get the latest features?    │
│                                         │
│  [ Not Now ]       [ Update Now ]      │
└─────────────────────────────────────────┘
```

**Positioning**:

- Bottom-right corner (avoids obscuring charts or data tables)
- Above fold (always visible, no need to scroll)
- Does NOT cover interactive elements (charts, buttons)
- Slides in with subtle animation (respects `prefers-reduced-motion`)

**Behavior**:

- Persists until user interacts (no auto-dismiss)
- "Not Now" dismisses notification (keeps old version running)
- "Update Now" reloads page to apply new version
- If dismissed, notification reappears on next app launch (update still pending)

**Implementation**:

```jsx
import { useRegisterSW } from 'virtual:pwa-register/react';

function App() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('Service worker registered:', r);
    },
    onRegisterError(error) {
      console.error('Service worker registration error:', error);
    },
  });

  const handleUpdateClick = () => {
    updateServiceWorker(true); // Force reload
  };

  const handleDismiss = () => {
    setNeedRefresh(false);
  };

  return (
    <>
      {needRefresh && (
        <UpdateNotification
          onUpdate={handleUpdateClick}
          onDismiss={handleDismiss}
        />
      )}
      {/* Rest of app */}
    </>
  );
}
```

### 6.3 Update Timing: When to Check for Updates

**Service Worker Behavior**:

- Checks for updates on app launch (automatic)
- Checks periodically while app is open (every hour by default)
- Does NOT interrupt active sessions with checks

**User-Facing Behavior**:

- Update notification appears on next launch if update is available
- Does NOT appear mid-session (unless user manually refreshes)
- Does NOT interrupt CSV upload, chart rendering, or data analysis

**Edge Case**: Update available during long analysis session

- User opens app, starts analyzing data (1+ hour session)
- New version deploys during session
- Service worker detects update but **does NOT prompt** (respects active session)
- Update notification appears on next app launch (after user closes and reopens)

### 6.4 Changelog Disclosure: Optional Transparency

**Question**: Should we show changelog when prompting for update?

**Recommendation**: **No** — keep update prompt simple

**Rationale**:

- Most users don't read changelogs (noise)
- Update prompt should be quick decision ("Update now or later?")
- Technical details distract from medical analysis workflow
- Changelog is available in GitHub releases (for interested users)

**Alternative** (if changelog is desired):

- Add "What's new?" link to update notification
- Opens modal with high-level changes (not technical commit log)
- Keep changelog user-facing: "New AHI outlier detection", "Improved mobile charts"

**Implementation** (optional):

```
┌─────────────────────────────────────────┐
│  ↻ New Version Available                │
│                                         │
│  OSCAR Analyzer has been updated.      │
│  Reload to get the latest features?    │
│                                         │
│  What's new?                            │
│                                         │
│  [ Not Now ]       [ Update Now ]      │
└─────────────────────────────────────────┘
       ↑ Link opens changelog modal
```

**Changelog Modal**:

- Title: "What's New in OSCAR Analyzer"
- Content: Brief bullets (3-5 items), user-facing language
- Example: "✓ Faster chart rendering", "✓ New pressure correlation insights"
- Link to full release notes on GitHub (for technical users)

### 6.5 Failed Update Handling: Error Recovery

**Scenario**: Service worker update fails (network error, corrupted cache)

**Error Message**:

```
┌───────────────────────────────────────────┐
│ ⚠️ Update Failed                          │
│                                           │
│ Could not update OSCAR Analyzer.         │
│                                           │
│ Possible causes:                          │
│ • Network interruption during update     │
│ • Browser cache issue                    │
│                                           │
│ The app will continue working with the   │
│ current version. Try updating again      │
│ later, or clear your browser cache.      │
│                                           │
│                        [ Dismiss ]        │
└───────────────────────────────────────────┘
```

**Recovery Steps** (included in Help docs):

1. Refresh page (Ctrl+R / Cmd+R)
2. Hard refresh to bypass cache (Ctrl+Shift+R / Cmd+Shift+R)
3. Clear browser cache for app domain
4. Reinstall PWA (uninstall, then reinstall from browser)

**No User Impact**: Failed update does NOT break app — old version continues working

---

## 7. Implementation Checklist: UX Design Tasks

### Phase 1: Core PWA Features

- [ ] **Custom install prompt**
  - [ ] Detect `beforeinstallprompt` event and suppress default
  - [ ] Add "Install App" to Header Menu (with sparkle icon)
  - [ ] Create install explanation modal (copy from wireframe)
  - [ ] Test keyboard navigation and screen reader flow
  - [ ] Remove install option once PWA is installed

- [ ] **Offline indicator**
  - [ ] Design icon set (online, offline states)
  - [ ] Add indicator to header (near theme toggle)
  - [ ] Implement ARIA live region for status changes
  - [ ] Test in light/dark themes for contrast
  - [ ] Only show in installed PWA mode (hide for web users)

- [ ] **Update notification**
  - [ ] Design toast UI (bottom-right, non-blocking)
  - [ ] Implement "Update Now" and "Not Now" actions
  - [ ] Add ARIA alertdialog role and keyboard navigation
  - [ ] Test update flow (dev mode with multiple service worker versions)
  - [ ] Verify no interruption during active analysis

### Phase 2: Onboarding and Education

- [ ] **Post-install onboarding**
  - [ ] Create welcome modal explaining local-only storage
  - [ ] Include cross-device export instructions
  - [ ] Show once after first install (set flag in IndexedDB)
  - [ ] Make re-accessible from Help menu ("About Data Privacy")

- [ ] **Offline capability toast**
  - [ ] Show on first service worker activation
  - [ ] Message: "App installed — works offline"
  - [ ] Auto-dismiss after 8 seconds
  - [ ] Never show again (localStorage flag)

- [ ] **Inline help documentation**
  - [ ] Bundle core user docs (Getting Started, FAQ, Data Dictionary)
  - [ ] Modify "User Guide" button to open inline viewer when offline
  - [ ] Show offline placeholder if full docs unavailable
  - [ ] Test offline doc rendering (Markdown to HTML)

### Phase 3: Cross-Device Experience

- [ ] **Enhanced export UI**
  - [ ] Add "Export for Mobile/Tablet" menu option
  - [ ] Create export modal with transfer instructions
  - [ ] Include privacy warning for cloud storage
  - [ ] Test file transfer flow (AirDrop, email, USB)

- [ ] **Cross-device import detection**
  - [ ] Store device metadata in exported JSON
  - [ ] Detect device mismatch on import
  - [ ] Show toast confirmation: "Imported from [device]"
  - [ ] Test on different platforms (Mac, Windows, iOS, Android)

- [ ] **Cloud storage privacy warning**
  - [ ] Detect cloud storage save intent (if possible)
  - [ ] Show warning modal before upload
  - [ ] List PHI contents and risks
  - [ ] Provide safer alternatives
  - [ ] Add "Don't show again" option

### Phase 4: Accessibility Polish

- [ ] **WCAG AA compliance audit**
  - [ ] Test all PWA UI with keyboard only
  - [ ] Test with screen reader (VoiceOver on Mac, NVDA on Windows)
  - [ ] Verify color contrast (DevTools, Lighthouse)
  - [ ] Check focus indicators (visible outlines)
  - [ ] Test touch target sizes (44×44px minimum)

- [ ] **Focus management**
  - [ ] Install modal: focus on "Not Now" on open
  - [ ] Update notification: focus on dialog on appear
  - [ ] Restore focus to trigger on modal close
  - [ ] Test Escape key dismissal for all modals

- [ ] **ARIA live regions**
  - [ ] Offline status changes
  - [ ] Update availability announcements
  - [ ] Install success confirmation
  - [ ] Service worker errors

### Phase 5: Edge Cases and Error Handling

- [ ] **Service worker registration failure**
  - [ ] Show error message (non-blocking)
  - [ ] Explain: "App will work without offline mode"
  - [ ] Provide troubleshooting steps
  - [ ] Test in browsers with service workers disabled

- [ ] **Failed update handling**
  - [ ] Show error toast with recovery steps
  - [ ] Ensure old version continues working
  - [ ] Add Help doc section: "Update Troubleshooting"

- [ ] **Offline help link handling**
  - [ ] Detect offline state when "User Guide" clicked
  - [ ] Show inline docs or placeholder
  - [ ] Provide "Download PDF guide" option

---

## 8. UX Pitfalls to Avoid

### 8.1 Don't Over-Promote Installation

**Anti-Pattern**: Aggressive install prompts ("Install now!", "Get the app!", full-screen takeovers)

**Why It's Bad**:

- Annoys casual users who just want to analyze one export
- Feels like aggressive marketing (undermines trust for medical tool)
- Interrupts workflow with unnecessary decision

**Correct Approach**:

- Discoverable install option in menu (passive)
- Show explanation modal only when user clicks "Install App"
- Never auto-show install prompt on first visit

### 8.2 Don't Assume Users Understand "Offline"

**Anti-Pattern**: Technical jargon ("Service worker installed", "Cache ready", "App shell cached")

**Why It's Bad**:

- Non-technical medical users don't know what "service worker" means
- "Offline" may sound like "broken" to some users
- Confusion erodes trust

**Correct Approach**:

- Plain language: "Works without internet"
- Explain benefit: "Analyze data on planes, in hospitals with no WiFi"
- Visual indicator with clear tooltip: "App ready — works offline"

### 8.3 Don't Interrupt Active Analysis with Updates

**Anti-Pattern**: Auto-reloading app when update is available

**Why It's Bad**:

- Loses scroll position, filter state, unsaved notes
- Disrupts medical professional reviewing patient data
- Feels like app is broken ("Why did it reload?")

**Correct Approach**:

- Prompt user: "New version available. Update now or later?"
- Respect "Not Now" choice (don't nag)
- Only show prompt on app launch, not mid-session

### 8.4 Don't Hide Local-Only Storage Policy

**Anti-Pattern**: Installing PWA without explaining data storage model

**Why It's Bad**:

- Users expect cloud sync (iCloud, Google Drive)
- Confusion when data doesn't appear on other devices
- Potential data loss if user uninstalls app without exporting

**Correct Approach**:

- Post-install onboarding explains local-only storage
- Provide explicit export instructions for cross-device use
- Warn before uninstall: "This will delete your local data"

### 8.5 Don't Use Cutesy Copy for Medical Tool

**Anti-Pattern**: "Yay! App installed! 🎉 You're all set!"

**Why It's Bad**:

- Tone doesn't match serious medical context (CPAP therapy tracking)
- May undermine perceived trustworthiness
- Feels unprofessional to clinicians

**Correct Approach**:

- Professional but friendly tone: "App installed successfully"
- Focus on capability: "You can now analyze data offline"
- Minimal emoji (1-2 for visual anchoring, not decoration)

### 8.6 Don't Make Offline Mode Scary

**Anti-Pattern**: Red warning icon with "Network disconnected! Limited functionality!"

**Why It's Bad**:

- Implies app is broken or degraded
- Creates anxiety during analysis session
- Offline is EXPECTED behavior for PWA (not error state)

**Correct Approach**:

- Neutral/positive framing: "Offline mode — analysis works normally"
- Use amber/yellow indicator (caution, not error)
- No alarm language ("disconnected", "failed", "unavailable")

### 8.7 Don't Forget About Web Users

**Anti-Pattern**: Designing UX exclusively for installed PWA, neglecting web browser users

**Why It's Bad**:

- Many users prefer web version (no install commitment)
- Web version is entry point (users evaluate before installing)
- Accessibility must work in both modes

**Correct Approach**:

- All core functionality works in web mode (no install required)
- PWA features are enhancements, not requirements
- Test both installed and web browser modes equally

---

## 9. Testing and Validation Plan

### 9.1 User Testing Scenarios

**Test with representative users**:

1. **Tech-Savvy Early Adopter**:
   - Installs immediately, expects offline mode
   - Test: Does install flow feel smooth? Is offline capability clear?

2. **Non-Technical Patient**:
   - Confused by "install" concept, worried about storage
   - Test: Is install explanation understandable? Does onboarding reassure?

3. **Clinical Professional**:
   - Uses app in hospital setting, needs reliability
   - Test: Does standalone mode feel professional? Is update prompt non-disruptive?

4. **Mobile-First User**:
   - Analyzes data on phone/tablet, limited screen space
   - Test: Is install option discoverable on mobile? Do charts work offline?

5. **Privacy-Conscious User**:
   - Suspicious of cloud storage, wants local-only guarantee
   - Test: Does PWA reinforce privacy model? Are warnings about cloud sync clear?

### 9.2 Accessibility Testing

**Tools**:

- **Lighthouse** (Chrome DevTools) — PWA audit, accessibility audit
- **axe DevTools** — Automated a11y testing
- **Screen readers** — VoiceOver (Mac), NVDA (Windows), TalkBack (Android)
- **Keyboard only** — Unplug mouse, test all interactions

**Test Checklist**:

- [ ] Install button keyboard operable (Tab, Enter)
- [ ] Install modal focus trap works (Tab cycles, Escape closes)
- [ ] Offline indicator announced by screen reader
- [ ] Update notification announced as alert dialog
- [ ] Color contrast meets WCAG AA (4.5:1 for text)
- [ ] Touch targets ≥44×44px (mobile)
- [ ] Focus indicators visible (high contrast outline)

### 9.3 Cross-Browser Testing

**Browsers to Test**:

- ✅ **Chrome** (Android, Desktop) — Full PWA support
- ✅ **Edge** (Desktop) — Chromium-based, full PWA support
- ✅ **Safari** (iOS, macOS) — Limited PWA support (no install prompt on macOS)
- ✅ **Firefox** (Desktop) — Partial PWA support (no install UI by default)

**Feature Parity**:
| Feature | Chrome | Edge | Safari | Firefox |
|---------|--------|------|--------|---------|
| Install prompt | ✅ Yes | ✅ Yes | ✅ iOS only | ❌ No UI |
| Standalone mode | ✅ Yes | ✅ Yes | ✅ Yes | ⚠️ Limited |
| Offline caching | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| Service worker | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| Background sync | ✅ Yes | ✅ Yes | ❌ No | ❌ No |

**Testing Strategy**:

- Primary: Chrome (most users, best PWA support)
- Secondary: Safari iOS (mobile users), Edge (Windows users)
- Fallback: Firefox (degrades gracefully, no install UI but works as web app)

### 9.4 Performance Testing

**Metrics**:

- **First Contentful Paint (FCP)**: <1.5s (PWA should load faster with cache)
- **Largest Contentful Paint (LCP)**: <2.5s
- **Time to Interactive (TTI)**: <3.5s
- **Service Worker Install Time**: <2s (initial install)

**Test Scenarios**:

- Cold start (first load, no cache)
- Warm start (subsequent loads, cached assets)
- Offline load (no network, cached assets only)
- Update flow (new version available, service worker update)

**Tools**:

- Lighthouse Performance audit
- Chrome DevTools Network tab (throttle to Slow 3G)
- WebPageTest (real-world performance)

---

## 10. Summary: UX Recommendations at a Glance

| PWA Feature           | UX Approach                                     | Rationale                                        |
| --------------------- | ----------------------------------------------- | ------------------------------------------------ |
| **Install Prompts**   | Custom UI in Header Menu, explanation modal     | Control timing, provide context, avoid confusion |
| **Install Timing**    | After first analysis session, never auto-prompt | Respect user attention, demonstrate value first  |
| **Offline Indicator** | Subtle icon in header (installed PWA only)      | Surface capability without clutter               |
| **Offline Help**      | Bundle core docs, fallback to placeholder       | Ensure help is available without network         |
| **Display Mode**      | `standalone` (no browser chrome)                | Focus, immersion, native app feel                |
| **Navigation**        | No changes (already self-contained SPA)         | Current design works in standalone mode          |
| **Splash Screen**     | Use manifest defaults (icon + app name)         | Simple, no custom loading screen needed          |
| **Data Portability**  | Explicit export UI, onboarding education        | Teach manual sync, reinforce privacy             |
| **Cross-Device**      | "Export for Mobile/Tablet" feature              | Clear instructions, no confusion                 |
| **Cloud Warning**     | Privacy warning before cloud upload             | Educate about PHI risks, empower choice          |
| **Update Strategy**   | Prompt, don't auto-reload                       | Respect analysis sessions, no disruption         |
| **Update UI**         | Toast notification, bottom-right corner         | Non-blocking, dismissible, polite                |
| **Changelog**         | Optional "What's new?" link (not required)      | Keep prompt simple, details for interested users |
| **Accessibility**     | WCAG AA for all PWA UI, ARIA live regions       | Keyboard nav, screen readers, focus management   |
| **Error Handling**    | Clear messages, recovery steps, plain language  | No jargon, actionable guidance                   |

---

## 11. Next Steps: Implementation Roadmap

### Immediate Actions (Pre-Implementation)

1. **Icon Design**: Create PWA app icons (192×192, 512×512, maskable safe zone)
2. **Copy Review**: Finalize all UI copy (install modal, onboarding, update notifications)
3. **Accessibility Audit**: Review current app for WCAG AA compliance (baseline)

### Development Phases

**Phase 1** (Frontend Developer + UX Designer):

- Install custom prompt UI and explanation modal
- Offline indicator in header
- Update notification toast
- Test keyboard navigation and screen reader flow

**Phase 2** (Frontend Developer):

- Service worker implementation (`vite-plugin-pwa`)
- Manifest configuration (icons, theme colors, display mode)
- Inline help documentation bundling
- Test offline mode (disable network in DevTools)

**Phase 3** (UX Designer + Frontend Developer):

- Post-install onboarding modal
- Enhanced export UI ("Export for Mobile/Tablet")
- Cross-device import detection
- Cloud storage privacy warning

**Phase 4** (Testing Expert + UX Designer):

- Comprehensive testing (cross-browser, accessibility, performance)
- User testing with representative personas
- Refinement based on feedback

**Phase 5** (Documentation Specialist):

- Update user docs (PWA installation instructions, offline mode)
- Update developer docs (service worker architecture)
- Add troubleshooting section (update failures, cache clearing)

### Success Metrics

**Adoption**:

- % of returning users who install PWA
- Time to install after first visit (measure discovery)

**Engagement**:

- % of sessions using offline mode
- Average session duration (standalone vs web)

**Usability**:

- % of users who dismiss install prompt (vs. accept)
- % of users who click "Update Now" (vs. defer)

**Support Requests**:

- Decrease in "data not syncing" confusion (education working)
- Decrease in "app broken offline" reports (offline capability clear)

---

## 12. Conclusion: Enhancing Medical Analysis with PWA

Progressive Web App features can **significantly improve** OSCAR Export Analyzer's usability for CPAP therapy tracking, provided they are designed with medical users in mind. The key is **progressive disclosure**: make advanced features discoverable without overwhelming casual users, and always reinforce the privacy-first architecture that medical device users expect.

**Core UX Principles Achieved**:

- ✅ **Clarity**: Plain language, no jargon
- ✅ **Privacy**: Local-only storage reinforced through onboarding and warnings
- ✅ **Respect**: Non-disruptive updates, dismissible prompts
- ✅ **Accessibility**: WCAG AA compliance, keyboard nav, screen readers
- ✅ **Context**: Medical-appropriate tone, therapy tracking benefits

**Expected Outcomes**:

- Frequent users discover and adopt PWA install (easier access)
- Casual users continue using web version without friction
- Offline capability becomes visible and trusted
- Cross-device workflow is understandable (manual export/import)
- Update experience is smooth and non-disruptive

**Ready for Implementation**: This evaluation provides specific UI patterns, copy recommendations, and accessibility requirements. Coordinate with @frontend-developer for technical implementation and @testing-expert for validation.

---

**Document Status**: Complete — ready for implementation planning  
**Next Agent**: @frontend-developer (implement PWA features per UX specs)  
**Coordination**: @testing-expert (accessibility and usability testing), @documentation-specialist (update user docs)
