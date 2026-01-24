# Progressive Web App (PWA) Features

OSCAR Export Analyzer can be installed as a Progressive Web App (PWA), giving you offline access, a native app-like experience, and the ability to transfer your analysis data between devices securely.

## Table of Contents

- [What is a PWA?](#what-is-a-pwa)
- [Benefits of Installing](#benefits-of-installing)
- [Installing the App](#installing-the-app)
  - [Chrome and Edge (Desktop)](#chrome-and-edge-desktop)
  - [Safari (iOS - iPhone/iPad)](#safari-ios---iphoneipad)
  - [Chrome (Android)](#chrome-android)
  - [Safari (macOS)](#safari-macos)
  - [Firefox (Desktop)](#firefox-desktop)
- [Using Offline Mode](#using-offline-mode)
- [Transferring Data Between Devices](#transferring-data-between-devices)
  - [When to Use Export/Import](#when-to-use-exportimport)
  - [Exporting Your Analysis](#exporting-your-analysis)
  - [Importing on Another Device](#importing-on-another-device)
  - [Security Best Practices](#security-best-practices)
- [App Updates](#app-updates)
- [Uninstalling the App](#uninstalling-the-app)
- [Privacy Guarantee](#privacy-guarantee)
- [Troubleshooting](#troubleshooting)

---

## What is a PWA?

A Progressive Web App (PWA) is a web application that works like a native app on your device. OSCAR Export Analyzer's PWA features allow you to:

- **Work offline** — Analyze data without an internet connection
- **Install like a native app** — Add to your home screen or dock
- **Get a distraction-free experience** — No browser tabs or address bar
- **Access quickly** — Launch from your app drawer or home screen

Your data remains **100% private and local** to your device. PWA features do not change the privacy model—no data is uploaded to servers or synced automatically.

---

## Benefits of Installing

Installing OSCAR Export Analyzer as a PWA provides several advantages:

✅ **Offline Access**: Work anywhere—flights, remote locations, or areas with unreliable internet  
✅ **Faster Loading**: App resources cached for instant startup  
✅ **Professional Experience**: Full-screen interface without browser distractions  
✅ **Easy Access**: Launch from home screen, dock, or Start menu like any native app  
✅ **Automatic Updates**: Receive updates when you reload the app (with your permission)  
✅ **Privacy Maintained**: All data still stored locally—no cloud sync

The app works the same whether installed or used in a browser—installation is optional and fully reversible.

---

## Installing the App

Installation steps vary by browser and operating system. Choose the instructions for your platform:

### Chrome and Edge (Desktop)

1. **Open the app** in Chrome or Edge browser
2. **Click the header menu** (☰ icon in top-right corner)
3. **Select "Install App"** from the menu
4. A modal will appear explaining PWA benefits—**click "Install"**
5. **Confirm installation** in the browser's native install dialog
6. The app will open in a new window (standalone mode)
7. **Post-install onboarding** will explain how your data is stored locally

**Alternative method** (Chrome):

- Look for the **install icon** (⊕ or computer icon) in the address bar
- Click it and select **"Install"**

The app will be added to:

- **Windows**: Start Menu and Desktop shortcut (optional)
- **macOS**: Applications folder and Dock
- **Linux**: Application menu

### Safari (iOS - iPhone/iPad)

Safari on iOS uses a different installation process called "Add to Home Screen":

1. **Open the app** in Safari browser (must be Safari, not Chrome)
2. **Tap the Share button** (square with arrow pointing up) at the bottom of the screen
3. **Scroll down** and select **"Add to Home Screen"**
4. **Edit the name** if desired (default: "OSCAR Analyzer")
5. **Tap "Add"** in the top-right corner
6. The app icon will appear on your home screen

**To launch**: Tap the icon on your home screen—the app opens in full-screen mode.

**Note**: Safari iOS may clear the app cache after 2+ weeks of inactivity. If the app fails to load offline, simply reconnect to the internet and open the app once to refresh.

### Chrome (Android)

1. **Open the app** in Chrome browser
2. Look for the **"Add to Home Screen"** banner at the bottom of the screen
3. **Tap "Add"** or **"Install"**
4. **Confirm installation** in the dialog
5. The app icon will appear on your home screen and in your app drawer

**Alternative method**:

- Open the **Chrome menu** (three dots in top-right)
- Select **"Add to Home Screen"** or **"Install App"**

The app will be added to your app drawer and home screen like any native app.

### Safari (macOS)

Safari on macOS supports PWA installation in recent versions (Safari 17.0+, macOS Sonoma+):

1. **Open the app** in Safari browser
2. Go to **File menu → Add to Dock**
3. **Confirm** the app name and icon
4. The app will be added to your Dock and Applications folder

**Note**: If "Add to Dock" is not available, your Safari version may not support PWA installation. Use Chrome or Edge instead.

### Firefox (Desktop)

Firefox has limited PWA support compared to Chrome/Edge, but installation is possible:

1. **Open the app** in Firefox
2. Look for the **install icon** in the address bar (if available)
3. Click and select **"Install"**

**Alternative method**:

- Open the **Firefox menu** (three lines)
- Select **"Install site as app"** (if available)

**Note**: If Firefox doesn't offer installation, use Chrome or Edge for better PWA support.

---

## Using Offline Mode

Once installed, OSCAR Export Analyzer works offline after your first online visit.

### How Offline Mode Works

1. **First Visit (Online)**: The app downloads and caches all necessary files (HTML, JavaScript, CSS, fonts, icons)
2. **Subsequent Visits (Offline)**: The app loads instantly from the cache—no internet required
3. **Data Remains Local**: Your CSV data and analysis sessions are stored in your browser's IndexedDB (always local, never uploaded)

### What Works Offline

✅ **Full app functionality**: All visualizations, analysis, and features work offline  
✅ **Load saved sessions**: Access previously imported CPAP data  
✅ **Export data**: Create JSON exports for backup or cross-device transfer  
✅ **Import new CSV files**: Load OSCAR exports even without internet

### What Requires Internet

❌ **First-time app load**: Initial download requires internet (one-time)  
❌ **App updates**: Receiving new features/bug fixes requires internet  
❌ **Documentation links**: External links in guides may not load offline  
❌ **Web fonts fallback**: Some fonts may fall back to system fonts

### Offline Indicator

When offline, you'll see:

- **"Offline Mode" badge** in the top-right corner of the header
- **Toast notification** when you go offline: "You're Offline — App will continue working"

The indicator disappears automatically when you reconnect to the internet.

### Testing Offline Mode

To test offline capability:

1. **Open the app** while online (ensure it loads fully)
2. **Disconnect from the internet** (turn off WiFi, enable Airplane Mode, or use browser DevTools → Network → Offline)
3. **Reload the app** or **close and reopen**
4. The app should load normally with the offline indicator visible

If the app fails to load offline, see the [Troubleshooting](#troubleshooting) section.

---

## Transferring Data Between Devices

OSCAR Export Analyzer provides encrypted export/import for transferring your analysis sessions between devices (e.g., desktop → mobile → tablet).

### When to Use Export/Import

Use encrypted export/import when you want to:

- Start analysis on desktop, continue on tablet or mobile
- Share analysis with a healthcare provider securely
- Back up your analysis sessions outside the browser
- Move data to a new device or reinstall your browser

**Important**: This is **not automatic sync**—you control when and how data is transferred.

### Exporting Your Analysis

To export your current session for use on another device:

1. **Open the header menu** (☰ icon in top-right)
2. **Select "Export for Another Device"**
3. A modal will appear explaining the export process
4. **Enter a passphrase** (minimum 8 characters)
   - Choose a strong passphrase you'll remember
   - Use a mix of letters, numbers, and symbols
   - **Do not reuse passwords from other accounts**
5. **Confirm your passphrase** (re-enter it)
6. **Click "Download Encrypted File"**
7. The encrypted file will download with `.json.enc` extension (e.g., `oscar-session-2026-01-24.json.enc`)

**Passphrase Tips**:

- Use a passphrase strength meter (green = strong)
- Longer passphrases are more secure (15+ characters recommended)
- Use a password manager if available
- Write down the passphrase if you'll forget it—**there is no recovery mechanism**

### Transfer Methods

Once exported, transfer the encrypted file to your other device using any of these methods:

**Recommended methods**:

- **AirDrop** (Mac/iPhone/iPad): Secure local transfer, no internet required
- **USB Drive/Cable**: Copy file directly between devices
- **Email to yourself**: Send encrypted file via email (data is encrypted)
- **Secure messaging**: Send via Signal, WhatsApp, or other encrypted messaging

**Use with caution**:

- ⚠️ **Cloud storage** (Dropbox, Google Drive, iCloud): File is encrypted, but avoid storing long-term
- ⚠️ **Public file sharing**: Never use public links (WeTransfer, etc.) for health data

### Importing on Another Device

To import your analysis on another device:

1. **Transfer the encrypted `.json.enc` file** to the new device (see methods above)
2. **Open OSCAR Export Analyzer** on the new device (install as PWA if desired)
3. **Open the header menu** (☰) and select **"Import Data"**
4. **Select the encrypted file** from your downloads or file browser
5. **Enter the passphrase** you used during export
6. **Click "Import"**
7. The app will decrypt and load your session—all charts and analysis will appear

**Success indicator**: Toast notification: "Session imported from another device. All data transferred successfully!"

**If import fails**:

- ❌ **Incorrect passphrase**: Double-check your passphrase (case-sensitive)
- ❌ **Corrupted file**: Re-export from the original device
- ❌ **Wrong file format**: Ensure you're importing an encrypted `.json.enc` file, not a regular session export

### Security Best Practices

**Do**:

✅ Use strong, unique passphrases (not reused passwords)  
✅ Delete encrypted files after successful import  
✅ Use direct transfer methods (AirDrop, USB) when possible  
✅ Verify the file size matches the export (~1-10 MB for typical sessions)

**Don't**:

❌ Share passphrases via the same channel as the file (e.g., don't email both)  
❌ Use weak passphrases like "password123" or "12345678"  
❌ Store encrypted files in publicly accessible locations  
❌ Keep old encrypted exports indefinitely—delete after use

**Privacy Reminder**: The exported file contains your CPAP health data:

- Apnea events and timestamps
- Pressure settings (EPAP/IPAP)
- Usage patterns and session durations
- SpO2 and leak data

Treat exported files with the same care as you would paper medical records.

---

## App Updates

OSCAR Export Analyzer receives updates automatically, but **you control when to apply them**.

### How Updates Work

1. **Update detected**: When you launch the app, it checks for updates in the background
2. **Non-disruptive notification**: If an update is available, a notification appears in the bottom-right corner
3. **Your choice**:
   - **"Update Now"**: Reload the app immediately to get the latest version
   - **"Not Now"**: Dismiss the notification and continue using the current version (update will be offered again on next launch)

### Update Best Practices

- **Save your work before updating**: Export your session or ensure IndexedDB persistence is enabled
- **Update when convenient**: Updates never interrupt active analysis—you decide when to apply them
- **Stay current for bug fixes**: Updates often include important bug fixes and security improvements
- **Check the changelog**: See what's new in [CHANGELOG.md](../../CHANGELOG.md)

### Force Update (if needed)

If the app isn't offering an update you know exists:

1. **Hard refresh**: Press **Ctrl+Shift+R** (Windows/Linux) or **Cmd+Shift+R** (Mac)
2. **Clear cache**: Browser Settings → Privacy → Clear browsing data → Cached images and files
3. **Reinstall**: Uninstall the PWA and reinstall from the web

---

## Uninstalling the App

If you no longer want the installed PWA:

**Chrome/Edge (Desktop)**:

1. Open the installed app
2. Click the **menu** (three dots) in the app window's title bar
3. Select **"Uninstall [App Name]"**
4. Confirm removal

**Safari (iOS)**:

1. Long-press the app icon on your home screen
2. Select **"Remove App"**
3. Choose **"Delete App"**

**Chrome (Android)**:

1. Long-press the app icon
2. Select **"App info"**
3. Tap **"Uninstall"**

**Safari (macOS)**:

1. Find the app in your Dock or Applications folder
2. Drag to Trash or right-click → **"Move to Trash"**

**Note**: Uninstalling the PWA does **not delete your data**—IndexedDB data remains until you clear browser storage separately.

---

## Privacy Guarantee

PWA features **do not change** OSCAR Export Analyzer's privacy model:

✅ **All data stays local**: Your CPAP data never leaves your device  
✅ **No automatic sync**: Data transfers only when you explicitly export/import  
✅ **No server uploads**: The app has no backend—everything runs in your browser  
✅ **Encrypted transfers**: Export/import uses AES-256-GCM encryption  
✅ **No tracking**: No analytics, no cookies, no user tracking

**What the service worker caches**:

- ✅ App code (HTML, JavaScript, CSS)
- ✅ Fonts and icons
- ✅ Static assets

**What is NEVER cached**:

- ❌ Your CSV files
- ❌ Your analysis sessions
- ❌ Any personal health data

For more details, see [Privacy Disclaimers](08-disclaimers.md).

---

## Troubleshooting

### App Won't Install

**Chrome/Edge**: "Install" button not appearing in menu

- Ensure you're using HTTPS (required for PWA)
- Try visiting the app 2-3 times (some browsers delay install prompt)
- Check browser console for errors (F12 → Console)

**Safari iOS**: "Add to Home Screen" not working

- Ensure you're using Safari, not Chrome (iOS Chrome doesn't support PWA install)
- Confirm you tapped the Share button (square with arrow up)

### App Won't Load Offline

**First-time offline load failing**:

- Connect to the internet and open the app once (caches resources)
- Wait for full page load before going offline
- Check browser storage isn't full (Settings → Storage)

**Safari iOS after 2+ weeks inactive**:

- iOS evicts service workers after ~2 weeks of inactivity
- Solution: Reconnect to internet, open app once to refresh cache

### Service Worker Not Updating

**App stuck on old version**:

1. Open browser DevTools (F12)
2. Go to **Application** → **Service Workers**
3. Check **"Update on reload"**
4. Refresh the page (Ctrl+R or Cmd+R)

**Nuclear option** (if still stuck):

1. DevTools → Application → Service Workers → **"Unregister"**
2. Clear cache (Application → Cache Storage → Delete all)
3. Reload the page—service worker will re-register

### Export/Import Issues

**"Incorrect passphrase or corrupted file"**:

- Passphrases are case-sensitive—check Caps Lock
- Try copy-pasting passphrase to avoid typos
- Re-export from original device if file corrupted

**Import succeeds but no data appears**:

- Check browser console (F12 → Console) for errors
- Ensure you imported the encrypted file (`.json.enc`), not a regular session export
- Try exporting again with a fresh session

### Storage Quota Exceeded

**"QuotaExceededError" when loading large files**:

- Browser storage is nearly full
- Clear old browser data (Settings → Privacy → Clear browsing data)
- Use a browser with larger storage limits (Chrome > Firefox > Safari)
- Split OSCAR exports into smaller date ranges

**PWA cache consuming storage**:

- PWA cache is small (~5 MB)—likely not the issue
- Check IndexedDB storage (DevTools → Application → Storage)

### Still Having Issues?

If you encounter PWA-specific issues not covered here:

1. **Check the main [Troubleshooting Guide](06-troubleshooting.md)** for general issues
2. **Report a bug** on GitHub with:
   - Browser and version
   - Operating system
   - Steps to reproduce
   - Console errors (F12 → Console)

---

**Next Steps**:

- Learn about [Printing and Exporting](09-printing-and-exporting.md) for generating reports
- Review [Privacy Disclaimers](08-disclaimers.md) for legal and medical disclaimers
- Explore [Practical Tips](07-practical-tips.md) for advanced workflows
