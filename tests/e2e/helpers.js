/**
 * Shared E2E helpers for OSCAR Export Analyzer.
 *
 * Centralizes the small set of utilities every spec needs:
 *   - `getBaseUrl` — resolve the per-project baseURL.
 *   - `captureConsoleErrors` — collect console/page errors for assertions.
 *   - `dismissStorageConsent` — close the storage-consent `alertdialog` when it
 *     appears, with the WebKit animation/detach workaround ported from the
 *     (now-removed) Fitbit OAuth spec. The consent modal is only shown when the
 *     app tries to persist a session, so on a plain load it is usually absent;
 *     the helper is a no-op in that case and safe to call defensively.
 *   - `seedSavedSession` — install an `addInitScript` that writes a synthetic
 *     CPAP session into IndexedDB (`oscar_app` v4, `sessions` store, key
 *     `'last'`) before any app code runs, so "Load previous session" restores
 *     deterministic, synthetic-only data (NEVER real PHI).
 *   - `loadSeededSession` — open the import modal and click "Load previous
 *     session", revealing the gated feature sections (incl. wearable).
 */

export const DEFAULT_BASE_URL = 'http://127.0.0.1:4173/oscar-export-analyzer/';

/** WebKit settle delay (ms) for the storage-consent modal's exit animation. */
const WEBKIT_MODAL_SETTLE_MS = 150;

/** Resolve the active baseURL for a test (per-project override → env → default). */
export function getBaseUrl(testInfo) {
  return (
    testInfo?.project?.use?.baseURL || process.env.BASE_URL || DEFAULT_BASE_URL
  );
}

/**
 * Strip the `upgrade-insecure-requests` CSP directive from the served document.
 *
 * The app ships a hardening CSP in `index.html` that includes
 * `upgrade-insecure-requests` — correct in production (GitHub Pages is HTTPS),
 * but in the E2E harness the preview server runs plain HTTP on
 * `http://127.0.0.1:4173`. WebKit honors `upgrade-insecure-requests` for that
 * origin and force-upgrades every asset request to `https://127.0.0.1:4173`,
 * which has no TLS listener, so all JS/CSS fail to load and the app never
 * mounts (blank page). Chromium/Firefox treat the loopback origin as
 * potentially-trustworthy and do not upgrade, so they are unaffected.
 *
 * This rewrites only the top-level HTML document to drop that one directive. It
 * does not modify any app source, and the production CSP is unchanged. Call
 * before `page.goto`. Cheap and harmless on all browsers; we scope it to the
 * base path so app fetches/workers are untouched.
 */
export async function stripUpgradeInsecureRequests(page, baseUrl) {
  const { pathname } = new URL(baseUrl);
  // Match the SPA document (base path, with or without query/hash), not assets.
  await page.route(`**${pathname}`, async (route) => {
    const response = await route.fetch();
    const headers = response.headers();
    const contentType = headers['content-type'] || '';
    if (!contentType.includes('text/html')) {
      return route.fulfill({ response });
    }
    const body = (await response.text()).replace(
      /;?\s*upgrade-insecure-requests/g,
      '',
    );
    return route.fulfill({ response, body });
  });
}

/** Collect console errors and uncaught page errors for later assertions. */
export function captureConsoleErrors(page) {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

/**
 * Dismiss the storage-consent `alertdialog` if it is visible.
 *
 * No-op when the modal is absent (the common case on a fresh load). On WebKit we
 * force the click and wait for the modal to fully detach to avoid a hang/flake
 * observed historically with this modal's exit animation.
 */
export async function dismissStorageConsent(page, browserName) {
  const consentDialog = page.getByRole('alertdialog', {
    name: /save data to this browser/i,
  });
  if (!(await consentDialog.isVisible().catch(() => false))) return;

  const askLater = page.getByRole('button', { name: /ask me later/i });
  const force = browserName === 'webkit';
  if (await askLater.isVisible().catch(() => false)) {
    await askLater.click({ force });
  } else {
    await page.getByRole('button', { name: /don't save/i }).click({ force });
  }

  if (browserName === 'webkit') {
    // Allow the modal's exit animation/frame to settle before asserting hidden.
    await page.waitForTimeout(WEBKIT_MODAL_SETTLE_MS);
  }
  await consentDialog.waitFor({ state: 'hidden', timeout: 5000 });
}

/**
 * Build a minimal, deterministic synthetic CPAP session. Three nightly summary
 * rows are enough to satisfy the `filteredSummary.length > 0` gate that mounts
 * the Overview + Wearable sections. Synthetic values only — never real PHI.
 */
function buildSyntheticSession() {
  const summaryData = [
    { Date: '2024-01-01', AHI: '2.1', 'Total Time': '7:30:00' },
    { Date: '2024-01-02', AHI: '3.4', 'Total Time': '8:00:00' },
    { Date: '2024-01-03', AHI: '1.8', 'Total Time': '6:45:00' },
  ];
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    clusterParams: {},
    dateFilter: { start: null, end: null },
    rangeA: { start: null, end: null },
    rangeB: { start: null, end: null },
    fnPreset: 'balanced',
    summaryData,
    detailsData: [],
  };
}

/**
 * Seed a synthetic saved session into IndexedDB before the app boots.
 *
 * Must be called before `page.goto`. Writes to the same DB/store the app reads
 * (`oscar_app` v4, `sessions` store, key `'last'`) and sets a localStorage flag
 * so the test can await completion deterministically.
 */
export async function seedSavedSession(page) {
  await page.addInitScript((session) => {
    const DB_NAME = 'oscar_app';
    const DB_VERSION = 4;
    const SESSIONS_STORE = 'sessions';

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      // Mirror the app's schema so opening at the app's version doesn't block.
      if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
        db.createObjectStore(SESSIONS_STORE);
      }
      if (!db.objectStoreNames.contains('wearable_nights')) {
        db.createObjectStore('wearable_nights', { keyPath: 'nightDate' });
      }
      if (!db.objectStoreNames.contains('wearable_intraday')) {
        db.createObjectStore('wearable_intraday', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('wearable_meta')) {
        db.createObjectStore('wearable_meta', { keyPath: 'key' });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(SESSIONS_STORE, 'readwrite');
      tx.objectStore(SESSIONS_STORE).put(session, 'last');
      tx.oncomplete = () => {
        localStorage.setItem('e2e_seed_ready', 'true');
      };
      tx.onerror = () => {
        localStorage.setItem('e2e_seed_ready', 'error');
      };
    };
    request.onerror = () => {
      localStorage.setItem('e2e_seed_ready', 'error');
    };
  }, buildSyntheticSession());
}

/** Wait for the seed init-script to finish and assert it succeeded. */
export async function waitForSeed(page) {
  await page.waitForFunction(() => {
    const v = localStorage.getItem('e2e_seed_ready');
    return v === 'true' || v === 'error';
  });
  const status = await page.evaluate(() =>
    localStorage.getItem('e2e_seed_ready'),
  );
  if (status !== 'true') {
    throw new Error(`Session seed failed (status=${status})`);
  }
}

/**
 * Open the import modal and click "Load previous session" to restore the seeded
 * synthetic data, then wait for the gated wearable section to mount.
 */
export async function loadSeededSession(page) {
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('menuitem', { name: 'Load Data' }).click();
  const loadButton = page.getByRole('button', {
    name: /load previous session/i,
  });
  await loadButton.waitFor({ state: 'visible', timeout: 10000 });
  await loadButton.click();
  await page.locator('#wearable-correlation').waitFor({
    state: 'visible',
    timeout: 15000,
  });
}
