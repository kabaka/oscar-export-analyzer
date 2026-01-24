# PWA Technical Implementation Guide for OSCAR Export Analyzer

**Date**: 2026-01-24  
**Author**: @frontend-developer  
**Status**: Technical Research & Implementation Planning

---

## Executive Summary

This document provides detailed technical requirements and implementation steps for converting OSCAR Export Analyzer into a Progressive Web App (PWA). The implementation will provide offline capability, installability, and an app-like experience while maintaining the project's strict local-first privacy guarantees.

**Key Goals**:

- ✅ Offline functionality (analyze data without internet)
- ✅ Install as standalone app on desktop and mobile
- ✅ Automatic updates when new versions are deployed
- ✅ Fast, app-like user experience
- ❌ NO browser sync (privacy requirement - see `pwa-security-evaluation.md`)

**Recommended Approach**: Use [`vite-plugin-pwa`](https://vite-pwa-org.netlify.app/) with Workbox for service worker management.

---

## 1. Service Worker Implementation

### 1.1 Recommended Plugin: `vite-plugin-pwa`

**Why `vite-plugin-pwa`?**

- Official Vite ecosystem plugin, maintained by Vite team contributors
- Integrates seamlessly with Vite build pipeline
- Uses Workbox under the hood (Google's service worker library)
- Automatic manifest generation
- Dev server support for testing service workers
- Zero-config option with sensible defaults
- Handles all PWA requirements (manifest, icons, service worker, registration)

**Installation**:

```bash
npm install vite-plugin-pwa workbox-window -D
```

**Dependencies**:

- `vite-plugin-pwa`: Build-time plugin for Vite
- `workbox-window`: Runtime library for service worker registration (in app code)

### 1.2 Vite Configuration

Add to `vite.config.js`:

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';
import process from 'node:process';
import path from 'node:path';

export default defineConfig({
  base: process.env.BASE_URL || '/oscar-export-analyzer/',
  plugins: [
    react(),
    visualizer({ filename: 'stats.html', template: 'treemap', open: false }),
    VitePWA({
      registerType: 'prompt', // Ask user before updating (don't disrupt analysis)
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
        // Workbox configuration for caching strategy
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // Exclude source maps from cache
        globIgnores: ['**/*.map'],
        runtimeCaching: [
          {
            // Cache app shell: HTML, JS, CSS
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
            // Network-first for index.html to get updates quickly
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

**Key Configuration Decisions**:

1. **`registerType: 'prompt'`**: Ask user before reloading to apply updates
   - **Why**: OSCAR users may have long analysis sessions; don't want to interrupt with automatic reload
   - **Alternative**: `'autoUpdate'` (reload immediately) - NOT recommended for this use case

2. **`scope` and `start_url`**: Must match GitHub Pages base path `/oscar-export-analyzer/`
   - **Critical**: Without correct scope, service worker won't intercept requests properly

3. **Workbox `CacheFirst` strategy**: Cache static assets aggressively
   - **Why**: App shell (JS/CSS) changes infrequently, prioritize offline capability
   - **Trade-off**: Slightly slower to receive updates, but user can still analyze data offline

4. **Workbox `NetworkFirst` for HTML**: Try network first, fall back to cache
   - **Why**: HTML may contain version metadata, prefer fresh but work offline
   - **Timeout**: 3 seconds to avoid long waits

### 1.3 Caching Strategies Explained

**For OSCAR Analyzer, we need two types of caching**:

#### App Shell (CacheFirst)

- **Assets**: JS bundles, CSS, fonts, static images
- **Strategy**: Cache first, update in background
- **Rationale**: These assets are versioned (hashed filenames), so cached versions are safe
- **Benefits**: Instant load times, full offline capability

#### Index HTML (NetworkFirst)

- **Assets**: `index.html`
- **Strategy**: Try network first (3s timeout), fall back to cache
- **Rationale**: HTML may contain version info or update prompts
- **Benefits**: Get updates quickly when online, but still work offline

#### What NOT to Cache

- **User data**: CSV files, analysis results (already in IndexedDB - no service worker needed)
- **Source maps**: `*.map` files (development only, excluded)
- **External resources**: None (app is fully self-contained per CSP)

### 1.4 Service Worker Registration

Add to `src/main.jsx`:

```javascript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './guide.css';
import { registerSW } from 'virtual:pwa-register';

// Register service worker with update prompt
const updateSW = registerSW({
  onNeedRefresh() {
    // Prompt user to reload when new version is available
    if (confirm('New version available! Reload to update?')) {
      updateSW(true); // Force reload
    }
  },
  onOfflineReady() {
    console.log('App ready to work offline');
    // Optional: Show toast notification "App installed! Works offline."
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

**User Experience Flow**:

1. User visits site → Service worker installs silently in background
2. User closes tab/browser
3. Next visit: App loads from cache (instant), then checks for updates
4. If update available: Prompt appears asking to reload
5. User accepts → New version loads, service worker updates cache

### 1.5 Integration with Existing Web Workers

**Current Setup**:

- `src/workers/csv.worker.js`: CSV parsing with PapaParse
- `src/workers/analytics.worker.js`: Statistical calculations

**Service Worker vs Web Workers**:

- **Service Worker**: Handles HTTP requests, caching, offline capability (runs in background)
- **Web Workers**: Handle heavy computation (CSV parsing, analytics) - no change needed!

**No conflicts**: Service worker and web workers operate independently.

- Service worker intercepts network requests for app assets (JS, CSS, HTML)
- Web workers handle CPU-intensive tasks (CSV parsing, statistics)
- Both use `postMessage` but in different contexts

**Integration checklist**:

- ✅ No changes needed to `csv.worker.js` or `analytics.worker.js`
- ✅ Service worker will cache the worker scripts themselves (e.g., `csv.worker.js` file)
- ✅ Web workers run normally whether online or offline
- ✅ IndexedDB (used by app) works normally in both online/offline modes

---

## 2. Web App Manifest

The manifest is generated by `vite-plugin-pwa` based on configuration above, but here's what each field means:

### 2.1 Required Manifest Fields

```json
{
  "name": "OSCAR Sleep Data Analyzer",
  "short_name": "OSCAR Analyzer",
  "description": "Analyze CPAP therapy data from OSCAR exports with advanced visualizations and statistical insights",
  "theme_color": "#121212",
  "background_color": "#f5f5f5",
  "display": "standalone",
  "scope": "/oscar-export-analyzer/",
  "start_url": "/oscar-export-analyzer/",
  "icons": [
    {
      "src": "/oscar-export-analyzer/pwa-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/oscar-export-analyzer/pwa-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    },
    {
      "src": "/oscar-export-analyzer/pwa-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "categories": ["health", "medical", "utilities"],
  "orientation": "any"
}
```

**Field Explanations**:

- **`name`**: Full app name (shown on install, splash screen)
- **`short_name`**: Abbreviated name (shown under icon on home screen) - max 12 chars recommended
- **`description`**: App description (shown in install dialog, app stores)
- **`theme_color`**: Browser UI color (address bar on mobile) - `#121212` matches dark mode theme
- **`background_color`**: Splash screen background - `#f5f5f5` matches light mode
- **`display: standalone`**: App runs in its own window (no browser UI)
  - Alternatives: `fullscreen`, `minimal-ui`, `browser`
  - `standalone` is best for app-like experience without losing navigation
- **`scope`**: URL scope where service worker is active - MUST match GitHub Pages path
- **`start_url`**: URL to load when app launches - MUST match GitHub Pages path
- **`icons`**: App icons for different contexts (see below)
- **`categories`**: App Store categories for discoverability
- **`orientation`**: `any` allows portrait and landscape (medical data often viewed both ways)

### 2.2 Icon Requirements

**Required Sizes**:

- **192x192**: Minimum for PWA install (Android home screen)
- **512x512**: High-res icon (splash screen, app stores, Android adaptive icons)
- **512x512 with `purpose: any maskable`**: Adaptive icon (Android) - safe area in center

**Where to Generate Icons**:

1. **PWA Asset Generator** (recommended): https://www.pwabuilder.com/imageGenerator
   - Upload source image (at least 1024x1024 PNG)
   - Downloads all required sizes + maskable variants
2. **Manual with design tools**: Export from Figma/Sketch/Photoshop at required sizes
3. **ImageMagick CLI** (if you have source SVG):
   ```bash
   convert icon.svg -resize 192x192 pwa-192x192.png
   convert icon.svg -resize 512x512 pwa-512x512.png
   ```

**Icon Placement**: Put in `public/` directory:

- `public/pwa-192x192.png`
- `public/pwa-512x512.png`
- `public/apple-touch-icon.png` (180x180 for iOS)
- `public/favicon.ico` (already exists)

**Maskable Icon Guidelines** (Android):

- Keep important content in center "safe zone" (80% of icon)
- Android may crop edges for shaped icons (circle, squircle, etc.)
- Test at https://maskable.app/

### 2.3 iOS-Specific Meta Tags

Add to `index.html` (iOS doesn't fully support web app manifest):

```html
<head>
  <!-- Existing tags -->
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

**Why iOS needs special tags**:

- Safari doesn't read `manifest.json` for all properties
- `apple-mobile-web-app-*` tags control iOS "Add to Home Screen" behavior
- `apple-touch-icon` provides iOS home screen icon

---

## 3. GitHub Pages Deployment Considerations

### 3.1 Base Path Configuration

**Current base path**: `/oscar-export-analyzer/` (configured in `vite.config.js`)

**Critical for PWA**:

- Service worker scope MUST match base path
- Manifest `scope` and `start_url` MUST include base path
- All icon URLs MUST include base path

**Already handled by `vite-plugin-pwa`**:

- Plugin reads `base` from Vite config
- Automatically prefixes all manifest URLs
- Generates service worker with correct scope

**Verification checklist**:

1. Build app: `npm run build`
2. Check `dist/manifest.webmanifest`:
   - `scope`: `/oscar-export-analyzer/`
   - `start_url`: `/oscar-export-analyzer/`
   - `icons[].src`: `/oscar-export-analyzer/pwa-*.png`
3. Check `dist/sw.js`:
   - Precache list includes correct paths

### 3.2 HTTPS Requirement

**Status**: ✅ Already met by GitHub Pages

- All `*.github.io` sites are HTTPS by default
- Service workers require HTTPS (except `localhost` for dev)
- No action needed

### 3.3 Update Mechanism

**How updates work with GitHub Pages**:

1. **Developer pushes to `main`** → GitHub Actions builds and deploys to `gh-pages` branch
2. **User visits site** → Service worker checks if `sw.js` has changed (byte-diff)
3. **If changed** → New service worker downloads in background, enters "waiting" state
4. **User sees update prompt** (from `onNeedRefresh()` callback) → User accepts
5. **Page reloads** → New service worker activates, new app version loads

**Update detection is automatic** - service worker spec requires browser to check for updates:

- On navigation (user visits site)
- Every 24 hours (if page is open)
- When calling `registration.update()` manually

**Edge case handling**:

**Problem**: User has app open for days → misses update → old cached version
**Solution**: Service worker periodically checks for updates (Workbox handles this)

**Problem**: User accepts update but analysis in progress → loses work
**Solution**: Use `registerType: 'prompt'` - only update when user confirms

**Problem**: Service worker fails to install on GitHub Pages
**Solution**: Ensure `sw.js` is in root of `dist/` (vite-plugin-pwa does this automatically)

### 3.4 GitHub Actions CI Configuration

**Current CI** (`.github/workflows/ci.yml`): Runs `npm run build` and deploys to GitHub Pages

**Changes needed**: None! `vite-plugin-pwa` runs during `vite build`

- Plugin generates `manifest.webmanifest` and `sw.js` during build
- Files are included in `dist/` output
- GitHub Actions already deploys entire `dist/` folder

**Verification**: After implementing PWA, check GitHub Pages deployment includes:

- `dist/manifest.webmanifest`
- `dist/sw.js`
- `dist/workbox-*.js` (Workbox runtime)
- `dist/pwa-192x192.png`
- `dist/pwa-512x512.png`

---

## 4. Offline Capability

### 4.1 Assets to Cache

**Automatically cached by Workbox** (configured in `vite.config.js`):

- ✅ All JS bundles (Vite code-splits automatically)
- ✅ All CSS files
- ✅ Fonts (if any - currently none)
- ✅ Images in `public/` (icons, etc.)
- ✅ `index.html`

**NOT cached (by design)**:

- ❌ User CSV uploads (stored in IndexedDB, not files)
- ❌ Analysis results (computed in memory, persisted to IndexedDB)
- ❌ External resources (none - app is fully self-contained per CSP)

**Verification**: Use Chrome DevTools → Application → Cache Storage

- Should see `oscar-app-shell` cache with all JS/CSS/images
- Should see `oscar-html` cache with `index.html`

### 4.2 IndexedDB in Offline Mode

**Current IndexedDB usage** (from `src/utils/db.js`):

- Store parsed CSV data
- Store analysis session (timestamps, metadata)
- Store user preferences (date range, chart visibility)

**Offline behavior**:

- ✅ IndexedDB works 100% offline (it's a local browser database)
- ✅ No changes needed to existing `db.js` code
- ✅ User can load saved session offline, analyze data, etc.

**Edge cases**:

- **Storage quota**: Browsers limit IndexedDB size (~50% of available disk space, min ~50MB)
  - OSCAR CSV files are typically 1-10 MB
  - Not a concern unless user has 100+ sessions saved
- **Quota exceeded error**: Already handled by `db.js` (errors return `false`)

### 4.3 Error Handling When Offline

**Scenarios to handle**:

1. **User tries to open app offline (first visit, never cached)**:
   - **Current**: Browser shows "No internet connection" error
   - **After PWA**: Browser shows cached offline page (dinosaur game, etc.)
   - **Solution**: Can't prevent this - user must visit site online at least once

2. **User opens PWA offline after installing**:
   - **Current**: Service worker serves cached app shell
   - **Expected**: App loads normally from cache, works fully offline
   - **No error handling needed** - service worker handles this automatically

3. **User tries to upload CSV offline**:
   - **Current behavior**: File picker works offline (local file system)
   - **CSV parsing**: Works offline (web worker, in-browser, no network)
   - **Analysis**: Works offline (all calculations local)
   - **No error handling needed** - app is already fully local

4. **User clicks external link (e.g., GitHub repo) offline**:
   - **Current**: Link fails to load
   - **Solution**: Not in scope - external links naturally require network

**Recommendation**: Add optional offline indicator in UI

```jsx
// Example hook
const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

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

  return isOnline;
};

// Usage in App.jsx
const isOnline = useOnlineStatus();
{
  !isOnline && (
    <div className="offline-banner">
      ⚠️ You're offline. App still works, but can't check for updates.
    </div>
  );
}
```

---

## 5. Build and Development

### 5.1 Changes to `vite.config.js`

**Required changes**: Add `VitePWA` plugin (see section 1.2 above)

**Build output changes**:

- `dist/manifest.webmanifest`: Auto-generated from config
- `dist/sw.js`: Service worker script
- `dist/workbox-*.js`: Workbox runtime library
- `dist/registerSW.js`: Registration helper (virtual module)

**Build size impact**:

- Service worker: ~5 KB (gzipped)
- Workbox runtime: ~15 KB (gzipped)
- Total overhead: ~20 KB

**Current bundle size**: ~500 KB (from Vite stats.html)
**After PWA**: ~520 KB (4% increase - acceptable)

### 5.2 Development Mode

**`vite-plugin-pwa` dev mode** (enabled in config):

```javascript
devOptions: {
  enabled: true, // Enable service worker in dev
  type: 'module', // Use ES modules
}
```

**Development workflow**:

1. Run `npm run dev` → Dev server starts with service worker
2. Open browser → Service worker registers automatically
3. Make code changes → Vite HMR updates (hot module reload)
4. Service worker updates automatically in background

**Important**: Service workers cache aggressively. During development:

- **Clear cache between major changes**: DevTools → Application → Clear Storage
- **Use "Update on reload"**: DevTools → Application → Service Workers → Check "Update on reload"
- **Bypass service worker**: DevTools → Network → Check "Disable cache"

**When to disable dev service worker**:

- Debugging network requests (service worker intercepts fetch)
- Testing first-time load behavior
- Investigating cache issues

To disable temporarily:

```javascript
// In vite.config.js
devOptions: {
  enabled: false, // Disable service worker in dev
}
```

### 5.3 Testing Service Workers Locally

**Testing strategies**:

#### 1. Dev Server (Quick Iteration)

```bash
npm run dev
# Open http://localhost:5173
# Service worker active with "Update on reload" enabled
```

**Pros**: Fast, HMR works
**Cons**: Not exactly like production build

#### 2. Preview Production Build (Most Accurate)

```bash
npm run build
npm run preview
# Open http://localhost:4173
```

**Pros**: Exact production behavior, tests minified bundles
**Cons**: Slower (must rebuild for changes)

#### 3. Chrome DevTools Testing Checklist

**Application Tab → Manifest**:

- ✅ Manifest loads without errors
- ✅ All icon URLs resolve (no 404s)
- ✅ `start_url` matches current origin + base path

**Application Tab → Service Workers**:

- ✅ Service worker status: "activated and is running"
- ✅ "Update on reload" checked (dev only)
- ✅ No registration errors

**Application Tab → Cache Storage**:

- ✅ `oscar-app-shell` cache exists
- ✅ Contains all JS/CSS bundles
- ✅ `oscar-html` cache exists with `index.html`

**Lighthouse → Progressive Web App**:

- ✅ Installable (score 100%)
- ✅ Fast and reliable (offline works)
- ✅ PWA optimized (meets all criteria)

#### 4. Network Tab Testing

```
1. Load app with DevTools Network tab open
2. Check "Offline" to simulate no network
3. Reload page
4. Should load from service worker cache (200 OK, "from ServiceWorker")
```

#### 5. Mobile Device Testing

```bash
# Expose dev server to local network
npm run dev -- --host
# Access from mobile: http://<your-ip>:5173
```

**iOS Safari**: "Add to Home Screen" → Test installability
**Android Chrome**: "Install app" banner → Test installability

### 5.4 Common Development Issues

**Issue**: Service worker not updating after code changes
**Solution**:

- DevTools → Application → Service Workers → "Update"
- Or: "Skip waiting" to force activation
- Or: Clear all caches and hard reload

**Issue**: Infinite service worker registration loops
**Solution**:

- Check service worker code for errors (console)
- Verify `scope` matches `base` path
- Unregister old service worker: `navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(reg => reg.unregister()))`

**Issue**: Icons not loading (404)
**Solution**:

- Verify icons exist in `public/` directory
- Check manifest URLs include base path: `/oscar-export-analyzer/pwa-*.png`
- Rebuild app after adding icons

**Issue**: Service worker not working on GitHub Pages
**Solution**:

- Verify HTTPS (should be automatic for `*.github.io`)
- Check `scope` in manifest matches deployed base path
- Inspect `sw.js` on deployed site - should be accessible at `https://<user>.github.io/oscar-export-analyzer/sw.js`

---

## 6. Install Prompts and Browser Support

### 6.1 Install Prompt UX

**How install prompts work**:

1. **Browser checks PWA criteria**:
   - ✅ Valid manifest with icons, name, start_url
   - ✅ Service worker registered and active
   - ✅ Site visited at least once (engagement heuristic)
   - ✅ HTTPS (or localhost)

2. **Browser fires `beforeinstallprompt` event**:
   - **Chrome/Edge**: Immediately when criteria met
   - **Firefox**: No install prompt (must manually "Add to Home Screen")
   - **Safari**: No install prompt (must manually "Add to Home Screen")

3. **App can capture event and show custom prompt**:

   ```javascript
   let deferredPrompt;

   window.addEventListener('beforeinstallprompt', (e) => {
     // Prevent default mini-infobar
     e.preventDefault();
     // Store event for later
     deferredPrompt = e;
     // Show custom install button
     showInstallButton();
   });

   const handleInstallClick = async () => {
     if (!deferredPrompt) return;
     // Show browser install dialog
     deferredPrompt.prompt();
     // Wait for user choice
     const { outcome } = await deferredPrompt.userChoice;
     console.log(
       `User ${outcome === 'accepted' ? 'accepted' : 'dismissed'} install`,
     );
     deferredPrompt = null;
     hideInstallButton();
   };
   ```

4. **User installs**:
   - App icon appears on home screen / app list
   - App opens in standalone window (no browser chrome)

**Recommendation for OSCAR Analyzer**:

- **Option 1 (simple)**: Let browser show default install prompt (no code needed)
- **Option 2 (better UX)**: Show custom install button in header menu after `beforeinstallprompt` fires
  - "📱 Install App" button
  - Only show on browsers that support install (Chrome/Edge)
  - Dismiss button sets flag in localStorage to not show again

**Example implementation** (optional):

```jsx
// hooks/useInstallPrompt.js
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

// In HeaderMenu.jsx
const { installPrompt, promptInstall, isInstalled } = useInstallPrompt();

{
  installPrompt && !isInstalled && (
    <button onClick={promptInstall} className="install-button">
      📱 Install App
    </button>
  );
}
```

### 6.2 Cross-Browser Support

**Chrome/Chromium (Desktop + Android)**:

- ✅ Full PWA support
- ✅ Install prompt (`beforeinstallprompt`)
- ✅ Service workers
- ✅ App shortcuts, badges, protocol handlers (advanced)
- **Version**: Chrome 89+ (2021+)

**Edge (Desktop + Mobile)**:

- ✅ Full PWA support (Chromium-based)
- ✅ Identical to Chrome
- ✅ Better Windows integration (pinned to taskbar, Start menu)
- **Version**: Edge 89+ (2021+)

**Firefox (Desktop + Android)**:

- ✅ Service workers
- ✅ Web app manifest
- ⚠️ NO `beforeinstallprompt` event
- ⚠️ Manual install only: Menu → "Install site as app" (desktop) or "Add to Home Screen" (mobile)
- ✅ Works fully offline once installed
- **Version**: Firefox 80+ (2020+)

**Safari (iOS + macOS)**:

- ⚠️ Limited PWA support
- ✅ Service workers (iOS 11.3+, 2018)
- ⚠️ Web app manifest partially supported (must use `<meta>` tags)
- ⚠️ NO `beforeinstallprompt` event
- ⚠️ Manual install only: Share → "Add to Home Screen"
- ⚠️ iOS restrictions:
  - Max 50 MB cache per origin
  - Service worker may be killed if app not used for weeks
  - Push notifications NOT supported
- **Version**: Safari 15+ (iOS 15+, macOS 12+) for best support

**Safari-specific considerations**:

- Must add `<meta name="apple-mobile-web-app-*">` tags (see section 2.3)
- Must provide `apple-touch-icon.png` (180x180)
- Service worker persists as long as app is used regularly
- Test on real iOS device (Safari on macOS doesn't fully match iOS behavior)

### 6.3 Feature Detection

**Check if PWA features are supported**:

```javascript
// Service worker support
if ('serviceWorker' in navigator) {
  // Can register service worker
}

// Install prompt support (Chrome/Edge only)
if ('BeforeInstallPromptEvent' in window) {
  // Can show custom install prompt
}

// Check if running as installed PWA
if (window.matchMedia('(display-mode: standalone)').matches) {
  // App is installed and running standalone
}

// IndexedDB support (already in use)
if ('indexedDB' in window) {
  // Can use IndexedDB
}
```

**Graceful degradation**:

- If service worker not supported → App still works, just no offline capability
- If install prompt not supported → User can manually install (Firefox/Safari)
- If IndexedDB not supported → App shows error (already handled in `db.js`)

**Browser compatibility matrix**:

| Feature              | Chrome 89+ | Edge 89+ | Firefox 80+ | Safari 15+ |
| -------------------- | ---------- | -------- | ----------- | ---------- |
| Service Workers      | ✅         | ✅       | ✅          | ✅         |
| Web App Manifest     | ✅         | ✅       | ✅          | ⚠️         |
| Install Prompt       | ✅         | ✅       | ❌          | ❌         |
| Standalone Mode      | ✅         | ✅       | ✅          | ✅         |
| Offline Capability   | ✅         | ✅       | ✅          | ✅         |
| Cache API            | ✅         | ✅       | ✅          | ✅         |
| IndexedDB            | ✅         | ✅       | ✅          | ✅         |
| Push Notifications\* | ✅         | ✅       | ✅          | ❌         |

\*Push notifications not planned for OSCAR Analyzer (privacy requirement)

---

## 7. Implementation Checklist

### Phase 1: Foundation (Core PWA)

- [ ] Install dependencies: `npm install vite-plugin-pwa workbox-window -D`
- [ ] Update `vite.config.js` with PWA plugin configuration
- [ ] Generate icons (192x192, 512x512, apple-touch-icon 180x180)
- [ ] Place icons in `public/` directory
- [ ] Update `index.html` with iOS meta tags
- [ ] Update `src/main.jsx` to register service worker
- [ ] Test dev server: `npm run dev` → verify service worker active
- [ ] Test production build: `npm run build && npm run preview`
- [ ] Run Lighthouse PWA audit → verify 100% score

### Phase 2: Testing & Refinement

- [ ] Test offline functionality:
  - Load app online
  - DevTools → Network → Offline
  - Reload page → should work
- [ ] Test install prompt (Chrome):
  - Visit site 2-3 times (engagement heuristic)
  - Verify `beforeinstallprompt` fires
  - Install app → verify opens in standalone mode
- [ ] Test on mobile devices:
  - Android Chrome: Install via prompt
  - iOS Safari: "Add to Home Screen" → verify icon and name
  - Firefox: Manual install via menu
- [ ] Verify update mechanism:
  - Make code change, rebuild, deploy
  - Revisit site → verify update prompt appears
  - Accept update → verify new version loads
- [ ] Check cache sizes:
  - DevTools → Application → Cache Storage
  - Verify reasonable sizes (~500 KB for app shell)

### Phase 3: Deployment & Monitoring

- [ ] Commit PWA changes to `main` branch
- [ ] Verify GitHub Actions CI includes manifest and service worker in `dist/`
- [ ] Check deployed site: `https://<user>.github.io/oscar-export-analyzer/`
  - `/manifest.webmanifest` accessible
  - `/sw.js` accessible
  - Icons load without 404s
- [ ] Run Lighthouse on deployed site → verify PWA score 100%
- [ ] Test install from deployed site (Chrome, Edge, Firefox, Safari)
- [ ] Monitor for issues:
  - Check GitHub Issues for install/offline problems
  - Review browser console errors from users

### Phase 4: Enhancements (Optional)

- [ ] Implement custom install button (see section 6.1)
- [ ] Add offline status indicator banner (see section 4.3)
- [ ] Add "What's New" dialog on update (detect version change in localStorage)
- [ ] Add app shortcuts to manifest (quick actions from icon)
- [ ] Improve splash screen appearance (custom splash with logo)
- [ ] Add service worker analytics (track install/uninstall rates)

---

## 8. Known Gotchas and Edge Cases

### 8.1 Service Worker Scope

**Problem**: Service worker only controls requests within its scope
**Impact**: If `scope` doesn't match app base path, service worker won't intercept requests
**Solution**: Ensure `scope` in manifest = `base` in Vite config = GitHub Pages path
**Example**:

```javascript
// vite.config.js
base: '/oscar-export-analyzer/', // ✅ Must match
manifest: {
  scope: '/oscar-export-analyzer/', // ✅ Must match
  start_url: '/oscar-export-analyzer/', // ✅ Must match
}
```

### 8.2 Service Worker Updates

**Problem**: Service worker caches aggressively → users may not get updates
**Impact**: Bug fixes and new features not visible until user manually refreshes
**Solution**: Use `registerType: 'prompt'` to ask user before updating
**Caveat**: User may ignore prompt → stuck on old version
**Mitigation**:

- Add "Check for updates" button in settings
- Force reload after 30 days (extreme case)

### 8.3 iOS Safari Service Worker Eviction

**Problem**: iOS kills service workers for apps not used recently (~2-3 weeks)
**Impact**: User opens app after gap → may need to reload to reinstall service worker
**Solution**: Warn users in docs that iOS may require occasional refresh
**Workaround**: Keep app in recently used list (don't close app window)

### 8.4 IndexedDB Storage Quota

**Problem**: Browsers limit IndexedDB size (~50% of available storage, min 50 MB)
**Impact**: Users with many saved sessions may hit quota
**Solution**: Already handled in `db.js` (errors return `false`)
**Enhancement**: Add storage usage indicator (show MB used / available)

**Check quota**:

```javascript
if (navigator.storage && navigator.storage.estimate) {
  const { usage, quota } = await navigator.storage.estimate();
  console.log(`Using ${usage / 1024 / 1024} MB of ${quota / 1024 / 1024} MB`);
}
```

### 8.5 Cache Versioning

**Problem**: Old cached assets may break app if new JS expects new HTML structure
**Impact**: White screen, console errors after update
**Solution**: Workbox handles this automatically (cache names include hash)
**Verification**: Check `sw.js` - should have versioned cache names like `oscar-app-shell-v1`

### 8.6 Service Worker Registration Failure

**Problem**: Service worker fails to register (syntax error, network error, scope mismatch)
**Impact**: App works but not offline
**Solution**: Add error handling in registration:

```javascript
registerSW({
  onRegisterError(error) {
    console.error('Service worker registration failed:', error);
    // Optional: Show toast notification to user
  },
});
```

### 8.7 Cross-Origin Resources

**Problem**: Service worker can't cache cross-origin resources without CORS headers
**Impact**: External fonts, images, scripts won't cache
**OSCAR Analyzer**: ✅ Not a problem - app is fully self-contained (no external resources per CSP)

### 8.8 Dev vs Production Behavior Differences

**Problem**: Service worker behaves differently in dev vs production
**Examples**:

- Dev: `Update on reload` forces fresh service worker every time
- Production: Service worker persists across reloads
- Dev: Vite HMR bypasses service worker
- Production: All requests go through service worker

**Solution**: Always test production build (`npm run build && npm run preview`) before deploying

---

## 9. Testing Strategy

### 9.1 Manual Testing Checklist

**Install Flow**:

- [ ] Visit site on Chrome → Install prompt appears
- [ ] Click "Install" → App opens in standalone window
- [ ] Close and reopen → App still standalone
- [ ] Verify icon on desktop/start menu

**Offline Flow**:

- [ ] Load app online
- [ ] Disconnect network (airplane mode or DevTools offline)
- [ ] Reload app → Loads from cache
- [ ] Upload CSV → Parses successfully
- [ ] Analyze data → Charts render
- [ ] Reconnect network → No errors

**Update Flow**:

- [ ] Make code change (e.g., change app title)
- [ ] Rebuild and deploy
- [ ] Revisit site → Update prompt appears
- [ ] Accept update → New version loads
- [ ] Verify title changed

**Browser Compatibility**:

- [ ] Chrome (desktop + Android): Full install flow
- [ ] Edge (desktop): Full install flow
- [ ] Firefox (desktop): Manual install via menu
- [ ] Safari (iOS): "Add to Home Screen" → Verify standalone mode

### 9.2 Automated Testing

**Lighthouse CI** (add to GitHub Actions):

```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse PWA Audit
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - uses: treosh/lighthouse-ci-action@v11
        with:
          uploadArtifacts: true
          temporaryPublicStorage: true
          runs: 3
          configPath: './.lighthouserc.json'
```

**Lighthouse config** (`.lighthouserc.json`):

```json
{
  "ci": {
    "collect": {
      "staticDistDir": "./dist",
      "url": ["/oscar-export-analyzer/"]
    },
    "assert": {
      "preset": "lighthouse:recommended",
      "assertions": {
        "categories:pwa": ["error", { "minScore": 0.9 }],
        "service-worker": "error",
        "installable-manifest": "error",
        "splash-screen": "error",
        "themed-omnibox": "error",
        "content-width": "error",
        "viewport": "error"
      }
    }
  }
}
```

### 9.3 Vitest Tests for Service Worker Registration

**Test service worker registration logic**:

```javascript
// src/main.test.jsx
import { describe, it, expect, vi } from 'vitest';

describe('Service Worker Registration', () => {
  it('registers service worker when supported', async () => {
    const mockRegister = vi.fn().mockResolvedValue({});
    global.navigator.serviceWorker = { register: mockRegister };

    // Import main.jsx (triggers registration)
    await import('./main.jsx');

    expect(mockRegister).toHaveBeenCalledWith(
      expect.stringContaining('sw.js'),
      expect.any(Object),
    );
  });

  it('handles registration failure gracefully', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation();
    const mockRegister = vi
      .fn()
      .mockRejectedValue(new Error('Registration failed'));
    global.navigator.serviceWorker = { register: mockRegister };

    await import('./main.jsx');

    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('Service worker registration failed'),
      expect.any(Error),
    );
  });
});
```

---

## 10. Resources and Documentation

**Official Documentation**:

- [MDN: Progressive Web Apps](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/)
- [Workbox (Google)](https://developer.chrome.com/docs/workbox/)
- [Web App Manifest (MDN)](https://developer.mozilla.org/en-US/docs/Web/Manifest)

**Tools**:

- [PWA Builder](https://www.pwabuilder.com/) - Generate icons, manifest, test PWA
- [Maskable.app](https://maskable.app/) - Test maskable icons
- [Lighthouse](https://developer.chrome.com/docs/lighthouse/) - PWA auditing

**Testing**:

- Chrome DevTools → Application tab
- [PWA Compat](https://github.com/GoogleChromeLabs/pwa-compat) - iOS compatibility shim (optional)

**Security**:

- [Service Worker Security](https://developer.chrome.com/docs/workbox/service-worker-overview/)
- Current privacy evaluation: `docs/work/pwa-security-evaluation.md`

---

## 11. Next Steps

**Recommended implementation order**:

1. **Start**: Install `vite-plugin-pwa` and configure (Phase 1)
2. **Icons**: Generate PWA icons and place in `public/`
3. **Test locally**: Verify service worker works in dev and production preview
4. **Deploy**: Push to GitHub Pages and test live
5. **Refine**: Add optional enhancements (custom install button, offline indicator)

**Estimated effort**:

- Phase 1 (core PWA): 2-4 hours
- Phase 2 (testing): 1-2 hours
- Phase 3 (deployment): 30 minutes
- Phase 4 (enhancements): 2-3 hours

**Total**: ~6-10 hours for full PWA implementation

**Delegate to**:

- `@frontend-developer`: Implement service worker registration, hooks (this agent)
- `@ux-designer`: Design install prompt UI, offline indicator styling
- `@testing-expert`: Write service worker tests, Lighthouse CI setup
- `@documentation-specialist`: Update user docs with install instructions
- `@security-auditor`: Review service worker code for security issues

---

## Conclusion

Converting OSCAR Export Analyzer to a PWA is straightforward with `vite-plugin-pwa`. The plugin handles most complexity automatically, requiring minimal configuration. The app's local-first architecture is ideal for offline functionality - all data processing happens in-browser with IndexedDB, so offline mode requires no code changes.

**Key benefits**:

- ✅ Install as native-like app
- ✅ Works fully offline after first visit
- ✅ Automatic updates with user confirmation
- ✅ Fast load times (cached assets)
- ✅ No privacy trade-offs (no browser sync)

**Key risks**:

- ⚠️ iOS Safari limited support (but still works)
- ⚠️ Service worker complexity (debugging harder than regular app)
- ⚠️ Cache invalidation edge cases (handled by Workbox)

**Overall**: Low risk, high value. Recommend proceeding with implementation.
