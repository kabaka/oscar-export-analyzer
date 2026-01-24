# PWA Implementation Plan for OSCAR Export Analyzer

**Date**: 2026-01-24  
**Status**: Ready for Implementation  
**Planning Team**: @orchestrator-manager, @security-auditor, @frontend-developer, @ux-designer  
**Implementation Agents**: All development agents

---

## Executive Summary

This document synthesizes findings from three specialized evaluations into a comprehensive, actionable implementation plan for converting OSCAR Export Analyzer into a Progressive Web App (PWA). The implementation will provide offline capability, installability, and app-like experience while maintaining strict local-first privacy guarantees.

### Key Findings Summary

✅ **Security Assessment** ([pwa-security-evaluation.md](pwa-security-evaluation.md)):

- **CRITICAL**: NO automatic browser sync for health data (violates privacy model)
- Recommended approach: Explicit user-controlled export/import workflow
- Export encryption mandatory with user-provided passphrase
- Clear privacy disclosures in all PWA touchpoints

✅ **Technical Feasibility** ([pwa-technical-implementation.md](pwa-technical-implementation.md)):

- Use `vite-plugin-pwa` with Workbox for service worker management
- Estimated 20 KB bundle size increase (4% overhead - acceptable)
- Service workers compatible with existing Web Workers (csv/analytics)
- GitHub Pages deployment fully supported (HTTPS, base path configuration)

✅ **UX Design** ([pwa-ux-evaluation.md](pwa-ux-evaluation.md)):

- Custom install prompt integrated into Header Menu (not browser default)
- Standalone display mode for distraction-free medical analysis
- Post-install onboarding to educate about local-only storage
- Non-disruptive update prompts (no auto-reload during analysis)

### Core Constraints

1. **Privacy-First Architecture**: All data stays on device, no automatic cloud sync
2. **Medical Context**: Professional tone, clear privacy reassurances, accessibility
3. **GitHub Pages Deployment**: Base path `/oscar-export-analyzer/`, HTTPS, no backend
4. **Cross-Device Portability**: Explicit export/import only (manual sync)

### Implementation Phases

| Phase     | Focus                                                | Effort          | Agents                                 |
| --------- | ---------------------------------------------------- | --------------- | -------------------------------------- |
| **1**     | Core PWA (service worker, manifest, icons)           | 6-8 hours       | @frontend-developer                    |
| **2**     | Install & Offline UX (custom prompts, indicators)    | 4-6 hours       | @frontend-developer, @ux-designer      |
| **3**     | Update Experience (non-disruptive notifications)     | 2-3 hours       | @frontend-developer, @ux-designer      |
| **4**     | Export/Import Enhancement (cross-device workflow)    | 4-5 hours       | @frontend-developer, @security-auditor |
| **5**     | Testing & Validation (cross-browser, a11y, security) | 6-8 hours       | @testing-expert, @security-auditor     |
| **6**     | Documentation & Deployment                           | 3-4 hours       | @documentation-specialist              |
| **Total** | End-to-End PWA Implementation                        | **25-34 hours** | Coordinated by @orchestrator-manager   |

---

## Phase 1: Core PWA Infrastructure

**Goal**: Implement service worker, web app manifest, and basic offline capability.

**Owner**: @frontend-developer  
**Duration**: 6-8 hours  
**Dependencies**: None (foundational work)

### Tasks

#### 1.1 Install Dependencies

```bash
npm install vite-plugin-pwa workbox-window -D
```

**Acceptance Criteria**:

- ✅ Dependencies installed in `package.json` (devDependencies)
- ✅ `vite-plugin-pwa` version ≥0.19.0 (current stable as of 2026)
- ✅ `workbox-window` version compatible with plugin

#### 1.2 Configure Vite PWA Plugin

**File**: `vite.config.js`

**Implementation Details** (see [pwa-technical-implementation.md](pwa-technical-implementation.md) section 1.2):

```javascript
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: process.env.BASE_URL || '/oscar-export-analyzer/',
  plugins: [
    react(),
    visualizer({
      /* existing config */
    }),
    VitePWA({
      registerType: 'prompt', // User confirms updates
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'OSCAR Sleep Data Analyzer',
        short_name: 'OSCAR Analyzer',
        description:
          'Analyze CPAP therapy data from OSCAR exports with advanced visualizations and statistical insights',
        theme_color: '#121212',
        background_color: '#f5f5f5',
        display: 'standalone',
        scope: '/oscar-export-analyzer/',
        start_url: '/oscar-export-analyzer/',
        icons: [
          {
            src: '/oscar-export-analyzer/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/oscar-export-analyzer/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/oscar-export-analyzer/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
        categories: ['health', 'medical', 'utilities'],
        orientation: 'any',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        globIgnores: ['**/*.map'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.github\.io\/oscar-export-analyzer\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'oscar-app-shell',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 90, // 90 days
              },
            },
          },
          {
            urlPattern: /\/oscar-export-analyzer\/$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'oscar-html',
              networkTimeoutSeconds: 3,
            },
          },
        ],
      },
      devOptions: {
        enabled: true, // Enable in dev for testing
        type: 'module',
      },
    }),
  ],
  // ... rest of config
});
```

**Acceptance Criteria**:

- ✅ `vite-plugin-pwa` configuration added to Vite config
- ✅ `registerType: 'prompt'` (no auto-reload)
- ✅ Manifest scope and start_url match GitHub Pages base path
- ✅ Workbox caching strategies configured (CacheFirst for assets, NetworkFirst for HTML)
- ✅ Dev mode enabled for testing
- ✅ Build succeeds: `npm run build` generates `dist/manifest.webmanifest` and `dist/sw.js`

#### 1.3 Generate PWA Icons

**Requirements** (see [pwa-technical-implementation.md](pwa-technical-implementation.md) section 2.2):

- 192×192 PNG (minimum for Android home screen)
- 512×512 PNG (high-res for splash screen, app stores)
- 512×512 PNG with `purpose: any maskable` (Android adaptive icon)
- 180×180 PNG (iOS `apple-touch-icon`)

**Tool Recommendations**:

- [PWA Asset Generator](https://www.pwabuilder.com/imageGenerator) — Upload source, download all sizes
- Manual with design tools (Figma, Sketch, Photoshop)

**Icon Design Guidelines** (see [pwa-ux-evaluation.md](pwa-ux-evaluation.md) section 3.3):

- Use OSCAR logo or derivative (medical device context)
- High contrast for visibility on various backgrounds
- Maskable icon: keep content in center 80% (safe zone)
- Test at https://maskable.app/

**File Placement**:

```
public/
  ├─ pwa-192x192.png
  ├─ pwa-512x512.png
  └─ apple-touch-icon.png (180×180)
```

**Acceptance Criteria**:

- ✅ All required icon sizes generated and placed in `public/`
- ✅ Icons follow design guidelines (recognizable, high contrast)
- ✅ Maskable icon tested (safe zone verified)
- ✅ Build copies icons to `dist/` with correct paths

#### 1.4 Add iOS Meta Tags

**File**: `index.html`

**Implementation** (see [pwa-technical-implementation.md](pwa-technical-implementation.md) section 2.3):

```html
<head>
  <!-- Existing meta tags -->

  <!-- PWA iOS support -->
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta
    name="apple-mobile-web-app-status-bar-style"
    content="black-translucent"
  />
  <meta name="apple-mobile-web-app-title" content="OSCAR Analyzer" />
  <link
    rel="apple-touch-icon"
    href="/oscar-export-analyzer/apple-touch-icon.png"
  />
</head>
```

**Acceptance Criteria**:

- ✅ iOS meta tags added to `index.html`
- ✅ `apple-touch-icon` path includes base path
- ✅ Tested on iOS Safari: "Add to Home Screen" shows correct icon and name

#### 1.5 Register Service Worker

**File**: `src/main.jsx`

**Implementation** (see [pwa-technical-implementation.md](pwa-technical-implementation.md) section 1.4):

```javascript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './guide.css';
import { registerSW } from 'virtual:pwa-register';

// Register service worker with update prompt
const updateSW = registerSW({
  onNeedRefresh() {
    // Will be handled by App component in Phase 3
    console.log('Update available');
  },
  onOfflineReady() {
    console.log('App ready to work offline');
  },
  onRegisterError(error) {
    console.error('Service worker registration failed:', error);
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

**Acceptance Criteria**:

- ✅ Service worker registration code added to `main.jsx`
- ✅ Error handling logs registration failures
- ✅ No breaking changes to existing app initialization
- ✅ Service worker registers successfully in dev mode: `npm run dev`

#### 1.6 Test Core Offline Functionality

**Test Scenarios** (see [pwa-technical-implementation.md](pwa-technical-implementation.md) section 5.3):

1. **Dev Server Test**:
   - Run `npm run dev`
   - Open DevTools → Application → Service Workers
   - Verify service worker status: "activated and is running"

2. **Production Build Test**:
   - Run `npm run build && npm run preview`
   - Load app in browser
   - DevTools → Network → Check "Offline"
   - Reload page → Should load from service worker cache
   - Upload CSV → Should parse successfully (Web Worker, IndexedDB work offline)

3. **Cache Verification**:
   - DevTools → Application → Cache Storage
   - Verify `oscar-app-shell` cache exists with JS/CSS bundles
   - Verify `oscar-html` cache exists with `index.html`

**Acceptance Criteria**:

- ✅ Service worker activates in dev and production
- ✅ App loads offline after first online visit
- ✅ CSV upload and analysis work offline
- ✅ Cache sizes reasonable (~500 KB for app shell)
- ✅ Lighthouse PWA audit score ≥90% (run locally)

### Phase 1 Deliverables

- ✅ `vite.config.js` updated with PWA plugin configuration
- ✅ `index.html` updated with iOS meta tags
- ✅ `src/main.jsx` updated with service worker registration
- ✅ PWA icons generated and placed in `public/`
- ✅ Build generates `dist/manifest.webmanifest` and `dist/sw.js`
- ✅ App works offline after first load
- ✅ Tests pass: `npm test` (no regressions)
- ✅ Build succeeds: `npm run build` (no errors, warnings acceptable)

### Phase 1 Testing Checklist

- [ ] Service worker registers in dev mode (`npm run dev`)
- [ ] Service worker registers in production (`npm run build && npm run preview`)
- [ ] Offline mode works (Network tab → Offline, reload page)
- [ ] CSV upload works offline
- [ ] Charts render offline
- [ ] IndexedDB operations work offline
- [ ] Lighthouse PWA audit ≥90% score
- [ ] No console errors in dev or production

---

## Phase 2: Install & Offline UX

**Goal**: Implement custom install prompt, offline indicator, and onboarding modals.

**Owners**: @frontend-developer (implementation), @ux-designer (visual design, copy)  
**Duration**: 4-6 hours  
**Dependencies**: Phase 1 complete (service worker active)

### Tasks

#### 2.1 Custom Install Prompt Hook

**File**: `src/hooks/useInstallPrompt.js` (new file)

**Implementation** (see [pwa-technical-implementation.md](pwa-technical-implementation.md) section 6.1):

```javascript
import { useState, useEffect } from 'react';

export const useInstallPrompt = () => {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Check if installed (user clicked install)
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const promptInstall = async () => {
    if (!installPrompt) return { outcome: 'no-prompt' };
    installPrompt.prompt();
    const result = await installPrompt.userChoice;
    setInstallPrompt(null);
    return result;
  };

  return { installPrompt, promptInstall, isInstalled };
};
```

**Acceptance Criteria**:

- ✅ Hook detects `beforeinstallprompt` event (Chrome/Edge)
- ✅ Hook detects standalone mode (app already installed)
- ✅ `promptInstall()` triggers browser install dialog
- ✅ Returns user choice (accepted/dismissed)

#### 2.2 Install Option in Header Menu

**File**: `src/components/HeaderMenu.jsx`

**Implementation** (see [pwa-ux-evaluation.md](pwa-ux-evaluation.md) section 1.2):

Add "Install App" menu item:

```jsx
import { useInstallPrompt } from '../hooks/useInstallPrompt';

function HeaderMenu() {
  const { installPrompt, promptInstall, isInstalled } = useInstallPrompt();
  const [showInstallModal, setShowInstallModal] = useState(false);

  const handleInstallClick = () => {
    setShowInstallModal(true); // Show explanation modal first
  };

  return (
    <nav role="navigation" aria-label="Main menu">
      {/* Existing menu items */}
      <button onClick={handleLoadData}>Load Data...</button>
      <button onClick={handleExportSession}>Export Session (JSON)</button>
      {/* ... other items ... */}

      {/* Install option (only show if installable and not installed) */}
      {installPrompt && !isInstalled && (
        <>
          <div className="menu-divider" role="separator" />
          <button
            onClick={handleInstallClick}
            className="menu-item menu-item-highlight"
            aria-label="Install OSCAR Analyzer as standalone app"
          >
            <span className="menu-icon" aria-hidden="true">
              ✨
            </span>
            <span>Install App</span>
            <span className="menu-badge">New</span>
          </button>
        </>
      )}

      {showInstallModal && (
        <InstallExplanationModal
          onInstall={async () => {
            const result = await promptInstall();
            setShowInstallModal(false);
            if (result.outcome === 'accepted') {
              // Show onboarding after install (Phase 2.4)
            }
          }}
          onDismiss={() => setShowInstallModal(false)}
        />
      )}
    </nav>
  );
}
```

**Acceptance Criteria**:

- ✅ "Install App" option appears in menu when installable
- ✅ Option hidden if already installed or not installable (Firefox/Safari)
- ✅ Clicking opens explanation modal (not immediate install)
- ✅ Keyboard accessible (Tab to focus, Enter to activate)
- ✅ ARIA label clear and descriptive

#### 2.3 Install Explanation Modal

**File**: `src/components/InstallExplanationModal.jsx` (new file)

**Implementation** (see [pwa-ux-evaluation.md](pwa-ux-evaluation.md) section 1.3):

```jsx
function InstallExplanationModal({ onInstall, onDismiss }) {
  const modalRef = useRef(null);

  useEffect(() => {
    // Focus "Not Now" button (safe default)
    modalRef.current?.querySelector('.btn-secondary')?.focus();
  }, []);

  return (
    <div className="modal-backdrop" onClick={onDismiss}>
      <div
        ref={modalRef}
        className="modal"
        role="dialog"
        aria-labelledby="install-modal-title"
        aria-describedby="install-modal-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="install-modal-title">Install OSCAR Analyzer</h2>
          <button onClick={onDismiss} aria-label="Close">
            ×
          </button>
        </div>

        <div className="modal-body">
          <div id="install-modal-desc">
            <h3>📱 What is "Installing"?</h3>
            <p>
              Installing lets you use OSCAR Analyzer like a regular desktop or
              mobile app:
            </p>
            <ul>
              <li>✓ Works fully offline — analyze data without internet</li>
              <li>
                ✓ Opens in own window — fewer distractions, no browser tabs
              </li>
              <li>✓ Access from desktop/home screen — no bookmarks needed</li>
              <li>✓ Faster startup — app assets cached locally</li>
            </ul>

            <h3>🔒 Privacy: All your data stays on this device</h3>
            <p>
              Your CPAP data is stored locally in your browser (never uploaded
              to servers). Installing doesn't change this — your data remains
              private and local-only.
            </p>

            <h3>💡 Recommended for frequent users</h3>
            <p>
              If you analyze your OSCAR exports regularly (weekly, monthly),
              installing makes access easier. Casual users can continue using
              the web version — it works the same!
            </p>
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onDismiss} className="btn-secondary">
            Not Now
          </button>
          <button onClick={onInstall} className="btn-primary">
            Install App
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Acceptance Criteria**:

- ✅ Modal explains what installing means (plain language)
- ✅ Clarifies privacy model (local-only storage)
- ✅ Focus moves to "Not Now" button on open
- ✅ Escape key closes modal
- ✅ ARIA attributes correct (`role="dialog"`, `aria-labelledby`, `aria-describedby`)
- ✅ Clicking "Install App" triggers browser install prompt

#### 2.4 Post-Install Onboarding Modal

**File**: `src/components/PostInstallOnboarding.jsx` (new file)

**Implementation** (see [pwa-ux-evaluation.md](pwa-ux-evaluation.md) section 4.1):

Show once after first PWA installation, explaining local-only storage and cross-device workflow.

```jsx
function PostInstallOnboarding({ onDismiss }) {
  return (
    <div className="modal-backdrop" onClick={onDismiss}>
      <div
        className="modal"
        role="dialog"
        aria-labelledby="onboarding-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="onboarding-title">🎉 Welcome to OSCAR Analyzer</h2>
        </div>

        <div className="modal-body">
          <h3>Your CPAP data stays on this device</h3>
          <p>
            For your privacy, this app stores data locally in your browser —
            it's never uploaded to servers or synced to cloud services.
          </p>

          <h3>📱 Using multiple devices?</h3>
          <p>
            If you want to analyze data on another device (phone, tablet, other
            computer):
          </p>
          <ol>
            <li>Export your session (Menu → Export Session)</li>
            <li>Transfer JSON file (email, USB drive, AirDrop)</li>
            <li>Import on other device (Load Data → drop JSON)</li>
          </ol>

          <h3>💡 Each device is independent — no automatic sync</h3>
          <p>
            This is by design to protect your health data. You have full control
            over when and where your data moves.
          </p>
        </div>

        <div className="modal-footer">
          <button onClick={onDismiss} className="btn-primary">
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Trigger Logic**:

- Show once after `appinstalled` event fires
- Set flag in IndexedDB: `onboarding-completed: true`
- Never show again unless user explicitly opens from Help menu

**Acceptance Criteria**:

- ✅ Modal shows once after first install
- ✅ Explains local-only storage and cross-device workflow
- ✅ Dismissible with "Got It" button
- ✅ Flag persists in IndexedDB (never shows again)
- ✅ Re-accessible from Help menu ("About Data Privacy")

#### 2.5 Offline Status Indicator

**File**: `src/components/OfflineIndicator.jsx` (new file)

**Implementation** (see [pwa-ux-evaluation.md](pwa-ux-evaluation.md) section 2.2):

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
      {/* Hidden screen reader announcement */}
      <span className="sr-only">
        {!isOnline && 'Network unavailable. Analysis continues normally.'}
      </span>
    </div>
  );
}
```

**Placement**: Add to `App.jsx` header, near theme toggle (top-right region)

**CSS** (add to `guide.css` or component CSS):

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

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

**Acceptance Criteria**:

- ✅ Indicator only shows in installed PWA (not web browser mode)
- ✅ Changes from 📡 (online) to ✈️ (offline) when network disconnects
- ✅ ARIA live region announces offline state to screen readers
- ✅ Color contrast meets WCAG AA (test in both light/dark themes)
- ✅ Tooltip provides clear explanation

#### 2.6 Offline Confirmation Toast

**File**: `src/components/OfflineReadyToast.jsx` (new file)

**Implementation** (see [pwa-ux-evaluation.md](pwa-ux-evaluation.md) section 2.3):

Show once when service worker activates for the first time (after install).

```jsx
function OfflineReadyToast({ onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 8000); // Auto-dismiss after 8 seconds
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="toast toast-success" role="status" aria-live="polite">
      <div className="toast-content">
        <span className="toast-icon">✓</span>
        <div className="toast-message">
          <strong>App installed successfully</strong>
          <p>You can now analyze OSCAR data offline — no internet required.</p>
        </div>
        <button
          onClick={onDismiss}
          className="toast-close"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}
```

**Trigger**: In `main.jsx`, call `onOfflineReady()` callback:

```javascript
const updateSW = registerSW({
  onOfflineReady() {
    console.log('App ready to work offline');
    const hasSeenToast = localStorage.getItem('offline-toast-shown');
    if (!hasSeenToast) {
      // Show toast component (implement in App.jsx state)
      window.dispatchEvent(new Event('show-offline-toast'));
      localStorage.setItem('offline-toast-shown', 'true');
    }
  },
  // ... other callbacks
});
```

**Acceptance Criteria**:

- ✅ Toast shows once after first service worker activation
- ✅ Auto-dismisses after 8 seconds
- ✅ Dismissible via "×" button
- ✅ Never shows again (localStorage flag)
- ✅ ARIA live region announces message to screen readers

### Phase 2 Deliverables

- ✅ `useInstallPrompt` hook created and tested
- ✅ "Install App" option added to Header Menu
- ✅ Install explanation modal implemented (accessible, clear copy)
- ✅ Post-install onboarding modal implemented (shown once)
- ✅ Offline indicator added to header (PWA mode only)
- ✅ Offline ready toast implemented (shown once after install)
- ✅ All new UI components accessible (WCAG AA, keyboard nav, screen reader tested)
- ✅ Tests pass (Vitest tests for new components)

### Phase 2 Testing Checklist

- [ ] Install prompt appears in Chrome/Edge (after 2-3 visits)
- [ ] Install explanation modal shows when "Install App" clicked
- [ ] Browser install dialog appears when "Install App" in modal clicked
- [ ] Post-install onboarding shows after install (once)
- [ ] Offline indicator shows in installed PWA (not web browser)
- [ ] Offline indicator changes to airplane icon when network disconnected
- [ ] Offline ready toast shows once after first install
- [ ] All modals keyboard navigable (Tab, Escape)
- [ ] All modals screen reader accessible (VoiceOver/NVDA)
- [ ] Color contrast meets WCAG AA (Lighthouse accessibility audit)

---

## Phase 3: Update Experience

**Goal**: Implement non-disruptive update notifications with user control.

**Owners**: @frontend-developer (implementation), @ux-designer (visual design)  
**Duration**: 2-3 hours  
**Dependencies**: Phase 1 complete (service worker active)

### Tasks

#### 3.1 Update Notification Component

**File**: `src/components/UpdateNotification.jsx` (new file)

**Implementation** (see [pwa-ux-evaluation.md](pwa-ux-evaluation.md) section 6.2):

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
      className="update-notification"
      role="alertdialog"
      aria-labelledby="update-title"
      aria-describedby="update-desc"
      tabIndex={-1}
    >
      <div className="update-content">
        <span className="update-icon" aria-hidden="true">
          ↻
        </span>
        <div className="update-message">
          <h3 id="update-title">New Version Available</h3>
          <p id="update-desc">
            OSCAR Analyzer has been updated. Reload to get the latest features?
          </p>
        </div>
      </div>
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

**CSS** (add to `guide.css`):

```css
.update-notification {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: var(--color-surface);
  border: 2px solid var(--color-primary);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  padding: 16px;
  max-width: 400px;
  z-index: 9999;
  animation: slide-in 0.3s ease-out;
}

@keyframes slide-in {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .update-notification {
    animation: none;
  }
}

.update-content {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.update-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.update-message h3 {
  margin: 0 0 4px;
  font-size: 1rem;
  font-weight: 600;
}

.update-message p {
  margin: 0;
  font-size: 0.9rem;
  color: var(--color-text-secondary);
}

.update-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
```

**Acceptance Criteria**:

- ✅ Notification appears in bottom-right corner (non-blocking)
- ✅ Auto-focus for keyboard navigation
- ✅ "Update Now" reloads page to apply update
- ✅ "Not Now" dismisses notification (keeps old version)
- ✅ Respects `prefers-reduced-motion` (no animation)
- ✅ ARIA alertdialog role (announced by screen readers)

#### 3.2 Integrate Update Notification with Service Worker

**File**: `src/App.jsx`

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

**Acceptance Criteria**:

- ✅ Update notification shows when `needRefresh` is true (new version available)
- ✅ Clicking "Update Now" reloads page and applies new version
- ✅ Clicking "Not Now" dismisses notification (old version continues running)
- ✅ Notification reappears on next app launch if update still pending
- ✅ No interruption during active analysis session (only shows on launch)

#### 3.3 Test Update Flow

**Test Scenarios**:

1. **Trigger Update**:
   - Make code change (e.g., change app title)
   - Build: `npm run build`
   - Deploy to GitHub Pages
   - Revisit site → Update notification should appear

2. **Accept Update**:
   - Click "Update Now"
   - Page reloads
   - Verify new version loads (check title change)
   - Verify service worker updated (DevTools → Application → Service Workers)

3. **Dismiss Update**:
   - Click "Not Now"
   - Notification dismisses
   - Old version continues running
   - Close and reopen app → Notification reappears

4. **Failed Update**:
   - Simulate network failure during update (DevTools → Network → Offline)
   - Attempt update
   - Verify graceful failure (show error message, old version continues)

**Acceptance Criteria**:

- ✅ Update flow works end-to-end (code change → deploy → update prompt → reload)
- ✅ Dismissing update doesn't break app
- ✅ Failed updates handled gracefully (no white screen)

### Phase 3 Deliverables

- ✅ `UpdateNotification` component created and styled
- ✅ Update notification integrated with `useRegisterSW` hook
- ✅ Update flow tested (accept, dismiss, failed update)
- ✅ Accessibility verified (keyboard nav, screen reader)
- ✅ Tests pass (Vitest tests for update component)

### Phase 3 Testing Checklist

- [ ] Update notification appears when new version deployed
- [ ] "Update Now" reloads page and applies new version
- [ ] "Not Now" dismisses notification without breaking app
- [ ] Notification reappears on next launch if update pending
- [ ] Failed update shows error message (not white screen)
- [ ] Keyboard navigation works (Tab to buttons, Enter to activate)
- [ ] Screen reader announces update availability (ARIA alertdialog)

---

## Phase 4: Export/Import Enhancement

**Goal**: Implement encrypted export/import workflow for cross-device portability.

**Owners**: @frontend-developer (implementation), @security-auditor (encryption review)  
**Duration**: 4-5 hours  
**Dependencies**: None (independent feature)

### Tasks

#### 4.1 Encrypted Export Implementation

**File**: `src/utils/export-import.js` (new file or extend existing export logic)

**Implementation** (see [pwa-security-evaluation.md](pwa-security-evaluation.md) section 7.1-7.2):

**Encryption Requirements**:

- Algorithm: AES-256-GCM (Web Crypto API)
- Key derivation: PBKDF2 (100k+ iterations)
- Include salt and IV in exported file
- User-provided passphrase (mandatory by default)

```javascript
// Example encryption function
async function encryptData(data, passphrase) {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Derive key from passphrase
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey'],
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  );

  // Encrypt data
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(JSON.stringify(data)),
  );

  // Combine salt + iv + encrypted data
  return {
    version: 1,
    salt: Array.from(salt),
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(encrypted)),
  };
}

async function decryptData(encryptedPayload, passphrase) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const { salt, iv, data } = encryptedPayload;

  // Derive key (same process as encryption)
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey'],
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new Uint8Array(salt),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );

  // Decrypt data
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(iv) },
    key,
    new Uint8Array(data),
  );

  return JSON.parse(decoder.decode(decrypted));
}
```

**Export Flow**:

```javascript
async function exportSession(sessionData, passphrase) {
  // Add device metadata for cross-device detection
  const exportData = {
    ...sessionData,
    metadata: {
      exportDate: new Date().toISOString(),
      appVersion: import.meta.env.VITE_APP_VERSION || 'dev',
      deviceInfo: {
        platform: navigator.platform,
        // Hash user agent for privacy (don't store full UA)
        userAgentHash: await hashString(navigator.userAgent.slice(0, 100)),
      },
    },
  };

  // Encrypt
  const encrypted = await encryptData(exportData, passphrase);

  // Download as file
  const blob = new Blob([JSON.stringify(encrypted)], {
    type: 'application/json',
  });
  const filename = `OSCAR_Export_${new Date().toISOString().split('T')[0]}.json.enc`;
  downloadFile(blob, filename);

  return { success: true, filename };
}
```

**Acceptance Criteria**:

- ✅ Encryption uses AES-256-GCM (Web Crypto API)
- ✅ Key derivation uses PBKDF2 with 100k+ iterations
- ✅ Salt and IV generated randomly for each export
- ✅ Passphrase mandatory (user must provide)
- ✅ File format includes version, salt, IV, encrypted data
- ✅ Device metadata included for cross-device detection
- ✅ Security audit pass (@security-auditor review)

#### 4.2 "Export for Another Device" Modal

**File**: `src/components/ExportForDeviceModal.jsx` (new file)

**Implementation** (see [pwa-ux-evaluation.md](pwa-ux-evaluation.md) section 4.2):

```jsx
function ExportForDeviceModal({ onExport, onClose }) {
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [error, setError] = useState('');

  const handleExport = async () => {
    if (passphrase !== confirmPassphrase) {
      setError('Passphrases do not match');
      return;
    }
    if (passphrase.length < 8) {
      setError('Passphrase must be at least 8 characters');
      return;
    }

    await onExport(passphrase);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-labelledby="export-device-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="export-device-title">Export for Another Device</h2>
          <button onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="modal-body">
          <p>
            This will download your current analysis session as an encrypted
            file. Transfer this file to your other device to continue your
            analysis there.
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

          <h3>Encryption Passphrase:</h3>
          <p className="help-text">
            Choose a passphrase to encrypt your data. You'll need this to import
            on your other device.
          </p>

          <label htmlFor="passphrase">Passphrase:</label>
          <input
            id="passphrase"
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="At least 8 characters"
            minLength={8}
            required
          />

          <label htmlFor="confirm-passphrase">Confirm Passphrase:</label>
          <input
            id="confirm-passphrase"
            type="password"
            value={confirmPassphrase}
            onChange={(e) => setConfirmPassphrase(e.target.value)}
            placeholder="Re-enter passphrase"
            required
          />

          {error && <p className="error-text">{error}</p>}

          <p className="warning-text">
            ⚠️ <strong>Privacy Note:</strong> The exported file contains your
            CPAP health data. Avoid uploading to cloud services unless you trust
            their security.
          </p>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleExport}
            className="btn-primary"
            disabled={!passphrase || !confirmPassphrase}
          >
            Download Encrypted File
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Integration**: Add to Header Menu:

```jsx
<button onClick={() => setShowExportModal(true)}>
  <span className="menu-icon" aria-hidden="true">
    📱
  </span>
  Export for Mobile/Tablet
</button>
```

**Acceptance Criteria**:

- ✅ Modal explains transfer methods and encryption
- ✅ User must enter passphrase (minimum 8 characters)
- ✅ Passphrase confirmation required (must match)
- ✅ Privacy warning about cloud storage
- ✅ Export triggers encrypted file download
- ✅ Filename clearly indicates encrypted health data

#### 4.3 Decryption and Import

**File**: `src/utils/export-import.js` (extend)

**Implementation**:

```javascript
async function importSession(file, passphrase) {
  try {
    // Read file
    const fileText = await file.text();
    const encryptedPayload = JSON.parse(fileText);

    // Validate format
    if (
      !encryptedPayload.version ||
      !encryptedPayload.salt ||
      !encryptedPayload.iv ||
      !encryptedPayload.data
    ) {
      throw new Error('Invalid file format');
    }

    // Decrypt
    const sessionData = await decryptData(encryptedPayload, passphrase);

    // Validate decrypted data
    if (!sessionData.sessions || !Array.isArray(sessionData.sessions)) {
      throw new Error('Invalid session data');
    }

    // Detect cross-device import
    const exportedDevice = sessionData.metadata?.deviceInfo;
    const currentDevice = {
      platform: navigator.platform,
      userAgentHash: await hashString(navigator.userAgent.slice(0, 100)),
    };

    const isCrossDevice =
      exportedDevice &&
      (exportedDevice.platform !== currentDevice.platform ||
        exportedDevice.userAgentHash !== currentDevice.userAgentHash);

    return {
      success: true,
      sessionData,
      isCrossDevice,
    };
  } catch (error) {
    if (error.name === 'OperationError') {
      throw new Error('Incorrect passphrase or corrupted file');
    }
    throw error;
  }
}
```

**Import UI**: Update existing "Load Data" modal to handle encrypted files:

```jsx
function LoadDataModal({ onImport, onClose }) {
  const [file, setFile] = useState(null);
  const [passphrase, setPassphrase] = useState('');
  const [needsPassphrase, setNeedsPassphrase] = useState(false);

  const handleFileSelect = async (selectedFile) => {
    setFile(selectedFile);

    // Check if encrypted (filename ends with .enc or contains encryption metadata)
    const text = await selectedFile.text();
    const data = JSON.parse(text);
    setNeedsPassphrase(!!data.salt); // Has salt = encrypted
  };

  const handleImport = async () => {
    try {
      const result = await importSession(file, passphrase);

      if (result.isCrossDevice) {
        // Show toast: "Session imported from another device"
        showToast({
          message:
            'Session imported from another device. All data transferred successfully!',
          icon: '✓',
          duration: 5000,
        });
      }

      await onImport(result.sessionData);
      onClose();
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>Load Data</h2>

        <input
          type="file"
          accept=".json,.json.enc"
          onChange={handleFileSelect}
        />

        {needsPassphrase && (
          <>
            <label>Passphrase:</label>
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Enter passphrase to decrypt"
            />
          </>
        )}

        <button
          onClick={handleImport}
          disabled={needsPassphrase && !passphrase}
        >
          Import
        </button>
      </div>
    </div>
  );
}
```

**Acceptance Criteria**:

- ✅ Import detects encrypted files (checks for salt/iv)
- ✅ Prompts for passphrase if encrypted
- ✅ Decryption fails gracefully (shows error message)
- ✅ Cross-device import detected (shows confirmation toast)
- ✅ Imported data validated before saving to IndexedDB
- ✅ Error handling for incorrect passphrase, corrupted file, invalid format

#### 4.4 Security Audit

**Owner**: @security-auditor

**Audit Checklist**:

- [ ] Encryption algorithm correct (AES-256-GCM)
- [ ] Key derivation secure (PBKDF2, 100k+ iterations)
- [ ] Salt and IV generated randomly (not hardcoded)
- [ ] Passphrase never logged or stored
- [ ] Passphrase cleared from memory after use
- [ ] File format includes version (for future upgrades)
- [ ] Decryption errors handled gracefully (no info leakage)
- [ ] No timing attacks (constant-time comparison for passphrase)

**Acceptance Criteria**:

- ✅ Security audit pass (@security-auditor approval)
- ✅ No critical vulnerabilities identified
- ✅ Recommendations implemented or documented

### Phase 4 Deliverables

- ✅ Encryption/decryption functions implemented (Web Crypto API)
- ✅ "Export for Another Device" modal created
- ✅ Export menu option added to Header Menu
- ✅ Import logic updated to handle encrypted files
- ✅ Cross-device detection and confirmation toast
- ✅ Security audit complete (@security-auditor approval)
- ✅ Tests pass (Vitest tests for encryption/decryption)

### Phase 4 Testing Checklist

- [ ] Export with passphrase creates encrypted file
- [ ] Import with correct passphrase decrypts successfully
- [ ] Import with incorrect passphrase shows error message
- [ ] Cross-device import detected and confirmed (toast message)
- [ ] Exported file format includes version, salt, IV
- [ ] Passphrase validation works (minimum 8 characters)
- [ ] Passphrase confirmation works (must match)
- [ ] Security audit pass (no vulnerabilities)

---

## Phase 5: Testing & Validation

**Goal**: Comprehensive testing across browsers, devices, and accessibility standards.

**Owners**: @testing-expert (test strategy, automation), @security-auditor (security validation)  
**Duration**: 6-8 hours  
**Dependencies**: Phases 1-4 complete

### Tasks

#### 5.1 Cross-Browser Testing

**Browsers to Test** (see [pwa-ux-evaluation.md](pwa-ux-evaluation.md) section 9.3):

| Browser     | Platform         | PWA Support | Install Method                        |
| ----------- | ---------------- | ----------- | ------------------------------------- |
| Chrome 89+  | Desktop, Android | Full        | Custom prompt                         |
| Edge 89+    | Desktop          | Full        | Custom prompt                         |
| Safari 15+  | iOS, macOS       | Partial     | Manual ("Add to Home Screen")         |
| Firefox 80+ | Desktop          | Partial     | Manual (Menu → "Install site as app") |

**Test Scenarios**:

1. **Chrome/Edge (Desktop + Android)**:
   - [ ] Install prompt appears after 2-3 visits
   - [ ] Custom install prompt works (explanation modal → browser dialog)
   - [ ] Install succeeds (app appears on desktop/home screen)
   - [ ] Standalone mode works (no browser chrome)
   - [ ] Offline mode works (disconnect network, app still loads)
   - [ ] Update notification appears when new version deployed
   - [ ] Service worker updates correctly

2. **Safari iOS**:
   - [ ] Manual install via "Add to Home Screen" works
   - [ ] Icon and app name correct on home screen
   - [ ] Standalone mode works
   - [ ] Offline mode works
   - [ ] Service worker persists (not killed immediately)
   - [ ] IndexedDB data persists

3. **Safari macOS**:
   - [ ] No install UI (expected - Safari desktop doesn't support)
   - [ ] Service worker still works (offline capability)
   - [ ] App works in browser tab (web mode)

4. **Firefox**:
   - [ ] Manual install via "Menu → Install site as app" works
   - [ ] Standalone mode works
   - [ ] Offline mode works
   - [ ] Service worker works
   - [ ] No custom install prompt (expected - Firefox doesn't fire `beforeinstallprompt`)

**Acceptance Criteria**:

- ✅ App works in all major browsers (Chrome, Edge, Safari, Firefox)
- ✅ Install flow works on browsers that support it
- ✅ Offline capability works in all browsers
- ✅ Graceful degradation (web mode works if PWA features not supported)

#### 5.2 Accessibility Testing

**Tools**:

- Lighthouse (Chrome DevTools) — PWA audit, accessibility audit
- axe DevTools — Automated a11y testing
- Screen readers — VoiceOver (Mac), NVDA (Windows)
- Keyboard only — Unplug mouse, test all interactions

**Test Checklist** (see [pwa-ux-evaluation.md](pwa-ux-evaluation.md) section 9.2):

1. **Keyboard Navigation**:
   - [ ] All install/update UI keyboard operable (Tab, Enter, Escape)
   - [ ] Focus visible (high contrast outline)
   - [ ] Focus order logical (top to bottom, left to right)
   - [ ] No keyboard traps (can Tab out of all modals)

2. **Screen Reader**:
   - [ ] Install option announced correctly ("Install OSCAR Analyzer as standalone app")
   - [ ] Modals announced as dialogs (`role="dialog"`)
   - [ ] Update notification announced as alert (`role="alertdialog"`)
   - [ ] Offline status changes announced (ARIA live region)

3. **Color Contrast**:
   - [ ] All text meets WCAG AA (4.5:1 for normal text, 3:1 for large text)
   - [ ] UI components meet WCAG AA (3:1 minimum)
   - [ ] Offline indicator contrast sufficient in light/dark themes

4. **Touch Targets**:
   - [ ] All buttons ≥44×44px (mobile)
   - [ ] Adequate spacing between touch targets (8px minimum)

5. **ARIA Attributes**:
   - [ ] `role="dialog"` on modals
   - [ ] `aria-labelledby` / `aria-describedby` correct
   - [ ] `aria-live="polite"` on offline indicator
   - [ ] `role="alertdialog"` on update notification

**Acceptance Criteria**:

- ✅ Lighthouse accessibility score ≥95%
- ✅ axe DevTools reports 0 critical issues
- ✅ Keyboard-only navigation works for all PWA features
- ✅ Screen reader announces all important state changes
- ✅ Color contrast meets WCAG AA
- ✅ Touch targets meet minimum size (44×44px)

#### 5.3 Performance Testing

**Metrics** (see [pwa-ux-evaluation.md](pwa-ux-evaluation.md) section 9.4):

- First Contentful Paint (FCP): <1.5s (PWA should be faster with cache)
- Largest Contentful Paint (LCP): <2.5s
- Time to Interactive (TTI): <3.5s
- Service Worker Install Time: <2s

**Test Scenarios**:

1. **Cold Start** (first load, no cache):
   - [ ] Load app in incognito mode
   - [ ] Measure FCP, LCP, TTI (Lighthouse)
   - [ ] Verify service worker installs within 2s

2. **Warm Start** (subsequent loads, cached):
   - [ ] Reload app (service worker active)
   - [ ] Measure load time (should be faster)
   - [ ] Verify assets loaded from cache (Network tab: "from ServiceWorker")

3. **Offline Load**:
   - [ ] Disconnect network
   - [ ] Reload app
   - [ ] Measure load time (should be fast)
   - [ ] Verify app fully functional

4. **Bundle Size Impact**:
   - [ ] Compare bundle size before/after PWA implementation
   - [ ] Verify increase <5% (current ~500 KB + ~20 KB PWA = ~520 KB)

**Acceptance Criteria**:

- ✅ Lighthouse Performance score ≥90%
- ✅ FCP <1.5s (cold start)
- ✅ LCP <2.5s (cold start)
- ✅ Warm start significantly faster than cold start
- ✅ Offline load time <1s (cached assets)
- ✅ Bundle size increase <5% (acceptable overhead)

#### 5.4 Security Validation

**Owner**: @security-auditor

**Test Checklist**:

1. **Encryption/Decryption**:
   - [ ] Export with passphrase creates encrypted file
   - [ ] Decryption with correct passphrase succeeds
   - [ ] Decryption with incorrect passphrase fails gracefully
   - [ ] No plaintext data in encrypted file (hexdump check)
   - [ ] Salt and IV different for each export (not hardcoded)

2. **Privacy Model**:
   - [ ] No network requests for user data (IndexedDB only)
   - [ ] Service worker doesn't cache user CSV uploads (only app assets)
   - [ ] No automatic browser sync (confirmed via DevTools)
   - [ ] Exported files clearly labeled as health data

3. **Service Worker Security**:
   - [ ] Service worker served over HTTPS
   - [ ] Service worker scope correct (no over-privileged access)
   - [ ] No XSS vulnerabilities in service worker code
   - [ ] Cache poisoning not possible (verified cache keys)

4. **CSP Compliance**:
   - [ ] Service worker doesn't violate existing Content Security Policy
   - [ ] No inline scripts in PWA code
   - [ ] All assets loaded from same origin

**Acceptance Criteria**:

- ✅ Security audit pass (@security-auditor approval)
- ✅ No critical vulnerabilities
- ✅ Privacy model maintained (local-first, no automatic sync)
- ✅ Encryption validated (correct algorithm, secure implementation)

#### 5.5 End-to-End User Flows

**Test Scenarios**:

1. **New User Install Flow**:
   - [ ] First visit → Install option appears in menu
   - [ ] Click "Install App" → Explanation modal shows
   - [ ] Click "Install App" in modal → Browser install dialog
   - [ ] Install → Post-install onboarding shows
   - [ ] Dismiss onboarding → App ready to use

2. **Offline Analysis Flow**:
   - [ ] Install app
   - [ ] Load CSV data
   - [ ] Disconnect network
   - [ ] Close and reopen app → App loads from cache
   - [ ] Analyze data → Charts render, statistics compute
   - [ ] Verify offline indicator shows airplane icon

3. **Cross-Device Export/Import Flow**:
   - [ ] Device A: Load CSV data, analyze
   - [ ] Device A: Export for another device (with passphrase)
   - [ ] Transfer file to Device B (email, USB, etc.)
   - [ ] Device B: Import file (enter passphrase)
   - [ ] Device B: Verify data appears correctly
   - [ ] Toast confirms cross-device import

4. **Update Flow**:
   - [ ] Deploy new version to GitHub Pages
   - [ ] User visits site → Update notification appears
   - [ ] User clicks "Not Now" → Notification dismisses
   - [ ] Close and reopen app → Notification reappears
   - [ ] User clicks "Update Now" → Page reloads, new version loads

**Acceptance Criteria**:

- ✅ All user flows complete successfully
- ✅ No errors in console
- ✅ No data loss during update or import
- ✅ User experience smooth (no confusing states)

### Phase 5 Deliverables

- ✅ Cross-browser testing complete (Chrome, Edge, Safari, Firefox)
- ✅ Accessibility testing complete (Lighthouse, axe, screen readers, keyboard)
- ✅ Performance testing complete (Lighthouse, load times, bundle size)
- ✅ Security validation complete (@security-auditor approval)
- ✅ End-to-end user flows tested (install, offline, export/import, update)
- ✅ Test report documenting findings and any issues
- ✅ All critical issues resolved before deployment

### Phase 5 Testing Checklist

- [ ] All browsers tested (Chrome, Edge, Safari iOS, Firefox)
- [ ] Lighthouse PWA score 100%
- [ ] Lighthouse Accessibility score ≥95%
- [ ] Lighthouse Performance score ≥90%
- [ ] Keyboard navigation works for all PWA features
- [ ] Screen reader announces all important state changes
- [ ] Color contrast meets WCAG AA
- [ ] Touch targets ≥44×44px
- [ ] Security audit pass (encryption, privacy model)
- [ ] All end-to-end user flows complete successfully
- [ ] No critical bugs or regressions

---

## Phase 6: Documentation & Deployment

**Goal**: Update documentation, deploy to GitHub Pages, and announce PWA features to users.

**Owner**: @documentation-specialist  
**Duration**: 3-4 hours  
**Dependencies**: Phases 1-5 complete, all tests passing

### Tasks

#### 6.1 Update User Documentation

**Files to Update**:

1. **`README.md`** (root):
   - Add PWA badge/mention in header
   - Update "Features" section to mention offline capability
   - Add "Installation" section explaining PWA install
   - Link to user guide for detailed instructions

2. **`docs/user/01-getting-started.md`**:
   - Add section: "Installing as an App (PWA)"
   - Explain install process for each browser (Chrome, Safari, Firefox)
   - Include screenshots/GIFs of install flow
   - Clarify that installation is optional

3. **`docs/user/06-troubleshooting.md`**:
   - Add section: "PWA Installation Issues"
   - Add section: "Offline Mode Not Working"
   - Add section: "Update Failed"
   - Add section: "Data Not Syncing Between Devices" (explain local-only model)

4. **`docs/user/08-disclaimers.md`**:
   - Update privacy policy to mention service workers
   - Clarify no automatic browser sync
   - Explain encrypted export/import workflow

5. **New file**: `docs/user/10-cross-device-workflow.md` (new):
   - Guide for using OSCAR Analyzer on multiple devices
   - Step-by-step export/import instructions
   - Passphrase best practices
   - Transfer method recommendations (AirDrop, email, USB)
   - Privacy warnings about cloud storage

**Acceptance Criteria**:

- ✅ All user docs updated with PWA information
- ✅ Screenshots/GIFs added for install flow
- ✅ Troubleshooting section covers common PWA issues
- ✅ Cross-device workflow documented clearly
- ✅ Privacy disclosures updated

#### 6.2 Update Developer Documentation

**Files to Update**:

1. **`docs/developer/architecture.md`**:
   - Add section: "PWA Architecture"
   - Explain service worker role and caching strategies
   - Document manifest configuration
   - Explain update mechanism

2. **`docs/developer/adding-features.md`**:
   - Add guidance for adding PWA-aware features
   - Explain how to test with service worker
   - Document cache invalidation strategies

3. **`docs/developer/testing-patterns.md`**:
   - Add section: "Testing PWA Features"
   - Document service worker testing patterns
   - Explain offline testing in Vitest

4. **`docs/developer/dependencies.md`**:
   - Add `vite-plugin-pwa` entry (why used, version, configuration)
   - Add `workbox-window` entry

5. **Archive this planning document**:
   - Move this file to `docs/developer/reports/2026-01-pwa-planning/` (already done)
   - Keep as reference for future PWA enhancements

**Acceptance Criteria**:

- ✅ Developer docs updated with PWA architecture
- ✅ Testing patterns documented
- ✅ Dependencies documented
- ✅ Planning documents archived for reference

#### 6.3 Update CHANGELOG

**File**: `CHANGELOG.md`

**Entry** (add to current date section):

```markdown
## [2026-01-24]

### Added

- **Progressive Web App (PWA) support**: Install OSCAR Analyzer as a standalone app on desktop and mobile ([#XXX](link-to-issue))
  - Works fully offline after first visit
  - Install via Header Menu → "Install App" (Chrome/Edge) or browser's "Add to Home Screen" (Safari/Firefox)
  - Automatic updates with user confirmation (no interruption during analysis)
  - Offline indicator shows network status in installed app mode
- **Cross-device data transfer**: Export encrypted sessions for use on multiple devices ([#XXX](link-to-issue))
  - New "Export for Mobile/Tablet" option in menu
  - AES-256-GCM encryption with user-provided passphrase
  - Transfer via AirDrop, email, USB drive, or cloud storage (with privacy warning)
  - Import detects cross-device transfer and confirms successful import
- **Enhanced privacy disclosures**: Clear explanations of local-only storage in PWA onboarding and export/import flows

### Changed

- Service worker caches app assets for faster load times and offline capability
- Install experience now includes explanation modal (not immediate browser prompt)
- Update notifications appear as non-blocking toast (bottom-right corner) instead of interrupting analysis

### Technical

- Added `vite-plugin-pwa` for service worker management
- Implemented Workbox caching strategies (CacheFirst for assets, NetworkFirst for HTML)
- Added Web Crypto API encryption for cross-device exports
- Bundle size increase: ~20 KB (4% overhead for PWA features)
```

**Acceptance Criteria**:

- ✅ CHANGELOG updated with user-facing PWA features
- ✅ Links to relevant issues/PRs included
- ✅ Technical changes summarized for developers

#### 6.4 Deploy to GitHub Pages

**Pre-Deployment Checklist**:

- [ ] All tests pass: `npm test -- --run`
- [ ] Lint passes: `npm run lint`
- [ ] Build succeeds: `npm run build` (no errors, warnings acceptable)
- [ ] `docs/work/` is empty (no temporary files committed)
- [ ] `temp/` is empty (no temporary files committed)
- [ ] Lighthouse PWA audit score 100% (run on preview: `npm run preview`)

**Deployment Steps**:

1. Commit all PWA changes to `main` branch
2. GitHub Actions CI runs automatically (build, test, deploy)
3. Verify deployment:
   - Visit `https://<user>.github.io/oscar-export-analyzer/`
   - DevTools → Application → Manifest (should load without errors)
   - DevTools → Application → Service Workers (should show "activated and is running")
   - Test install flow (Chrome: Install prompt after 2-3 visits)
   - Test offline mode (Network → Offline, reload page)

**Verification Checklist**:

- [ ] Manifest accessible: `https://<user>.github.io/oscar-export-analyzer/manifest.webmanifest`
- [ ] Service worker accessible: `https://<user>.github.io/oscar-export-analyzer/sw.js`
- [ ] Icons load without 404s
- [ ] Lighthouse PWA audit score 100% (run on deployed site)
- [ ] Install flow works (Chrome/Edge)
- [ ] Offline mode works (disconnect network, app still loads)

**Acceptance Criteria**:

- ✅ PWA features deployed to GitHub Pages
- ✅ All PWA assets accessible (manifest, service worker, icons)
- ✅ Install flow works on deployed site
- ✅ Offline mode works on deployed site
- ✅ Lighthouse PWA audit score 100%

#### 6.5 Announce PWA Features

**Channels**:

1. **GitHub README**: Already updated with PWA features (Phase 6.1)
2. **GitHub Releases**: Create release notes for PWA milestone
3. **User Onboarding**: Post-install onboarding modal explains features (already implemented)
4. **Optional**: Project website, social media, CPAP forums (if applicable)

**Release Notes Template**:

```markdown
# OSCAR Export Analyzer v2.0 — PWA Release

We're excited to announce Progressive Web App (PWA) support for OSCAR Export Analyzer! 🎉

## What's New

### Install as a Standalone App

- Install OSCAR Analyzer on your desktop or mobile device
- Works like a native app (no browser tabs, faster startup)
- Fully offline capable — analyze data without internet

### Cross-Device Workflow

- Export encrypted sessions to analyze on multiple devices
- Transfer via AirDrop, email, USB drive, or cloud storage
- Your data stays private with user-controlled encryption

### Improved Update Experience

- Automatic updates with user confirmation (no interruptions)
- Non-blocking update notifications (bottom-right corner)

## How to Install

**Chrome/Edge**: Open the app, click Menu → "Install App"  
**Safari iOS**: Open in Safari, tap Share → "Add to Home Screen"  
**Firefox**: Open the app, click Menu → "Install site as app"

Full installation guide: [docs/user/01-getting-started.md](docs/user/01-getting-started.md)

## Privacy Guarantee

Your CPAP data remains 100% local. PWA features do not change our privacy model:

- No automatic browser sync
- No data uploaded to servers
- You control all data transfers via encrypted export/import

Read more: [docs/user/08-disclaimers.md](docs/user/08-disclaimers.md)

## Feedback Welcome

Try the new PWA features and let us know what you think! Report issues or suggest improvements via [GitHub Issues](link-to-issues).
```

**Acceptance Criteria**:

- ✅ Release notes created and published on GitHub
- ✅ README updated with PWA announcement
- ✅ User onboarding explains PWA features (already implemented)
- ✅ Community informed (if applicable)

### Phase 6 Deliverables

- ✅ All user documentation updated (README, user guides, troubleshooting)
- ✅ All developer documentation updated (architecture, testing, dependencies)
- ✅ CHANGELOG updated with PWA features
- ✅ PWA deployed to GitHub Pages
- ✅ Deployment verified (Lighthouse 100%, install works, offline works)
- ✅ Release notes published
- ✅ Community informed

### Phase 6 Testing Checklist

- [ ] Deployed site loads correctly
- [ ] Manifest accessible and valid
- [ ] Service worker registers and activates
- [ ] Install flow works on deployed site (Chrome/Edge)
- [ ] Offline mode works on deployed site
- [ ] Lighthouse PWA audit score 100%
- [ ] All documentation links work (no 404s)
- [ ] README renders correctly on GitHub

---

## Implementation Timeline

**Estimated Total Effort**: 25-34 hours

**Recommended Schedule** (assuming 1-2 agents working in parallel):

- **Week 1**: Phases 1-2 (Core PWA + Install/Offline UX)
- **Week 2**: Phases 3-4 (Update Experience + Export/Import)
- **Week 3**: Phase 5 (Testing & Validation)
- **Week 4**: Phase 6 (Documentation & Deployment)

**Parallelization Opportunities**:

- Phase 1 (service worker) and Phase 2 (UI) can partially overlap
- Phase 4 (export/import) can be developed independently while Phases 1-3 in progress
- Phase 5 (testing) can start as soon as Phases 1-3 complete (Phase 4 can follow)

**Critical Path**:

1. Phase 1 (foundation) → Phase 2 (UI) → Phase 3 (updates)
2. Phase 5 (testing) depends on Phases 1-4 complete
3. Phase 6 (deployment) depends on Phase 5 passing

---

## Success Criteria

**Technical**:

- ✅ Service worker registered and active
- ✅ Lighthouse PWA audit score 100%
- ✅ Lighthouse Accessibility score ≥95%
- ✅ Lighthouse Performance score ≥90%
- ✅ All tests pass (Vitest, linting, build)
- ✅ No regressions (existing features still work)

**User Experience**:

- ✅ Install flow clear and accessible (no confusion)
- ✅ Offline mode works seamlessly (no errors)
- ✅ Update experience non-disruptive (no interruptions)
- ✅ Cross-device workflow understandable (clear instructions)
- ✅ Privacy model reinforced (onboarding, warnings, documentation)

**Security & Privacy**:

- ✅ No automatic browser sync (privacy guarantee maintained)
- ✅ Encryption validated (AES-256-GCM, secure implementation)
- ✅ Security audit pass (@security-auditor approval)
- ✅ No sensitive data in service worker cache (only app assets)

**Documentation**:

- ✅ User docs updated (install instructions, troubleshooting)
- ✅ Developer docs updated (architecture, testing patterns)
- ✅ CHANGELOG updated (user-facing changes)
- ✅ Release notes published

**Deployment**:

- ✅ PWA deployed to GitHub Pages
- ✅ Install flow works on deployed site
- ✅ Offline mode works on deployed site
- ✅ Community informed (README, release notes)

---

## Risk Mitigation

### Risk 1: Service Worker Conflicts with Existing Web Workers

**Likelihood**: Low  
**Impact**: High (app breaks if workers conflict)  
**Mitigation**:

- Service worker and Web Workers operate independently (different contexts)
- Thorough testing in Phase 1.6 (verify CSV parsing and analytics work offline)
- No code changes needed to existing Web Workers

**Contingency**: If conflicts arise, debug using DevTools → Application → Service Workers → "Skip waiting" to force update

### Risk 2: iOS Safari Service Worker Eviction

**Likelihood**: Medium  
**Impact**: Medium (users need to refresh after long gap)  
**Mitigation**:

- Document in user guide: "iOS may require occasional refresh if app unused for 2+ weeks"
- No technical solution (iOS limitation)

**Contingency**: Consider adding warning in app: "Last used 2 weeks ago, refresh recommended"

### Risk 3: User Confusion About Local-Only Storage

**Likelihood**: Medium  
**Impact**: Medium (users expect cloud sync, get confused)  
**Mitigation**:

- Post-install onboarding explicitly explains local-only model (Phase 2.4)
- "Export for Another Device" feature provides clear alternative (Phase 4)
- Privacy disclosures reinforced throughout app

**Contingency**: Add FAQ entry: "Why doesn't my data sync automatically?" with explanation

### Risk 4: Bundle Size Increase

**Likelihood**: Low  
**Impact**: Low (performance degradation)  
**Mitigation**:

- PWA adds ~20 KB (4% increase - acceptable)
- Performance testing in Phase 5.3 verifies no regression

**Contingency**: If bundle size exceeds 5%, optimize (code splitting, tree shaking)

### Risk 5: GitHub Pages Deployment Issues

**Likelihood**: Low  
**Impact**: High (PWA doesn't work in production)  
**Mitigation**:

- Test production build locally: `npm run build && npm run preview` (Phase 1.6)
- Verify base path configuration matches GitHub Pages (Phase 1.2)
- Deployment verification checklist in Phase 6.4

**Contingency**: Debug using GitHub Pages deployment logs, check service worker scope in DevTools

### Risk 6: Cross-Browser Compatibility Issues

**Likelihood**: Medium  
**Impact**: Medium (some browsers don't support PWA features)  
**Mitigation**:

- Graceful degradation: app works in web mode if PWA features not supported
- Feature detection: hide install option if not supported (Phase 2.2)
- Comprehensive cross-browser testing in Phase 5.1

**Contingency**: Document browser-specific limitations in user guide (Phase 6.1)

---

## Open Questions & Future Enhancements

### Open Questions

1. **Icon Design**: Final PWA icon design? (Coordinate with designer)
2. **Changelog Visibility**: Show "What's New" modal on update? (Optional, see Phase 3)
3. **Storage Quota Management**: Add storage usage indicator? (Optional future enhancement)

### Future Enhancements (Out of Scope for Initial Release)

1. **QR Code Export**: Generate QR code for small datasets (phone → tablet transfer)
2. **P2P Local Sync**: WebRTC-based sync over local network (no cloud)
3. **Partial Export**: Export specific date ranges (reduce file size)
4. **Background Sync**: Queue exports for when network returns (optional)
5. **App Shortcuts**: Add quick actions to PWA icon (e.g., "Load Data", "Export")
6. **Web Share API**: Share exported files via native share dialog (mobile)

---

## References

This implementation plan synthesizes findings from:

- **[pwa-security-evaluation.md](pwa-security-evaluation.md)**: Security constraints, encryption requirements, privacy model
- **[pwa-technical-implementation.md](pwa-technical-implementation.md)**: Technical architecture, service worker configuration, GitHub Pages deployment
- **[pwa-ux-evaluation.md](pwa-ux-evaluation.md)**: User experience design, install flows, accessibility requirements

**Additional Resources**:

- [MDN: Progressive Web Apps](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [vite-plugin-pwa Documentation](https://vite-pwa-org.netlify.app/)
- [Workbox Documentation](https://developer.chrome.com/docs/workbox/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

---

## Conclusion

This implementation plan provides a comprehensive roadmap for converting OSCAR Export Analyzer into a Progressive Web App while maintaining strict privacy guarantees and medical-appropriate UX. The plan is structured for AI agent execution, with clear phases, tasks, acceptance criteria, and testing checklists.

**Key Takeaways**:

- PWA implementation is **low-risk, high-value** for medical data analysis workflow
- **Privacy-first architecture maintained**: No automatic browser sync, encrypted export/import only
- **Comprehensive testing** ensures cross-browser compatibility and accessibility
- **Estimated 25-34 hours** of coordinated development work
- **Ready for immediate implementation** by development agents

**Next Steps**:

1. @orchestrator-manager: Assign phases to appropriate agents
2. @frontend-developer: Begin Phase 1 (Core PWA Infrastructure)
3. All agents: Follow implementation plan, update progress in tracking documents

**Status**: ✅ Planning Complete — Ready for Implementation
