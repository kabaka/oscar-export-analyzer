/**
 * Playwright E2E: Fitbit OAuth full user flow.
 *
 * Flow:
 * 1) Load app and restore a saved OSCAR session to reveal Fitbit section.
 * 2) Enter passphrase, click "Connect to Fitbit".
 * 3) Intercept Fitbit authorize + token exchange.
 * 4) Simulate GitHub Pages /oauth-callback 404 redirect.
 * 5) Ensure OAuth completes and no "Invalid OAuth state" errors appear.
 */

import { test, expect } from '@playwright/test';
import crypto from 'crypto';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_BASE_URL = 'http://127.0.0.1:4173/oscar-export-analyzer/';

const FOUR_OH_FOUR_HTML = fs
  .readFileSync(path.resolve(process.cwd(), 'public', '404.html'), 'utf8')
  .replace(' upgrade-insecure-requests', '');

const MOCK_TOKEN_RESPONSE = {
  access_token: `mock-access-${crypto.randomBytes(8).toString('hex')}`,
  refresh_token: `mock-refresh-${crypto.randomBytes(8).toString('hex')}`,
  expires_in: 28800,
  scope: 'heartrate oxygen_saturation sleep',
  token_type: 'Bearer',
  user_id: 'mock-user',
};

async function seedSessionData(page) {
  // Seed with synthetic CPAP summary and synthetic Fitbit data in the structure expected by the app
  const session = {
    version: 1,
    savedAt: new Date().toISOString(),
    clusterParams: {},
    dateFilter: { start: null, end: null },
    rangeA: { start: null, end: null },
    rangeB: { start: null, end: null },
    fnPreset: 'balanced',
    summaryData: [
      {
        Date: '2021-01-01',
        AHI: '2',
        'Median EPAP': '6',
        'Total Time': '08:00:00',
      },
    ],
    detailsData: [],
    fitbitData: {
      nightlyData: [
        {
          date: '2021-01-01',
          avgHeartRate: 65,
          ahi: 2,
          minSpO2: 95,
          heartRate: [65, 66, 64, 65],
          spO2: [95, 96, 95, 94],
          ahiEvents: [
            {
              time: '2021-01-01T23:00:00Z',
              type: 'Obstructive',
              severity: 8,
              duration: 15,
            },
          ],
          timestamps: [
            '2021-01-01T22:00:00Z',
            '2021-01-01T23:00:00Z',
            '2021-01-01T23:30:00Z',
            '2021-01-01T23:59:00Z',
          ],
          sleepStages: ['LIGHT', 'DEEP', 'REM', 'WAKE'],
          sleepStart: '2021-01-01T22:00:00Z',
          sleepEnd: '2021-01-01T23:59:00Z',
        },
      ],
      correlationData: {
        metrics: ['Heart Rate', 'AHI'],
        correlations: [
          [1, 0.7],
          [0.7, 1],
        ],
        pValues: [
          [0, 0.01],
          [0.01, 0],
        ],
        sampleSize: 1,
      },
      summary: { totalNights: 1, strongCorrelations: 1 },
      scatterData: {
        xValues: [65],
        yValues: [2],
        dateLabels: ['2021-01-01'],
        statistics: {
          correlation: 0.7,
          pValue: 0.01,
          rSquared: 0.49,
          slope: 0.2,
          intercept: 0,
        },
        regressionLine: { x: [65], y: [2] },
        outliers: [],
      },
    },
  };

  await page.addInitScript((seed) => {
    const DB_NAME = 'oscar_app';
    const DB_VERSION = 2;
    const STORE = 'sessions';
    const FITBIT_STORE = 'fitbit_data';

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
      if (!db.objectStoreNames.contains('fitbit_tokens')) {
        db.createObjectStore('fitbit_tokens', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(FITBIT_STORE)) {
        db.createObjectStore(FITBIT_STORE, {
          keyPath: 'id',
          autoIncrement: true,
        });
      }
      if (!db.objectStoreNames.contains('sync_metadata')) {
        db.createObjectStore('sync_metadata', { keyPath: 'key' });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      // Seed session
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(seed, 'last');
      tx.oncomplete = () => {
        // Also seed fitbit_data store with nightlyData if present
        if (seed.fitbitData && seed.fitbitData.nightlyData) {
          const fitbitTx = db.transaction(FITBIT_STORE, 'readwrite');
          seed.fitbitData.nightlyData.forEach((night, idx) => {
            fitbitTx.objectStore(FITBIT_STORE).put({ ...night, id: idx + 1 });
          });
          fitbitTx.oncomplete = () => {
            localStorage.setItem('oscar_storage_consent', 'allow');
            localStorage.setItem('oscar_seed_ready', 'true');
          };
          fitbitTx.onerror = () => {
            localStorage.setItem('oscar_seed_ready', 'error');
          };
        } else {
          localStorage.setItem('oscar_storage_consent', 'allow');
          localStorage.setItem('oscar_seed_ready', 'true');
        }
      };
      tx.onerror = () => {
        localStorage.setItem('oscar_seed_ready', 'error');
      };
    };
  }, session);
}

async function waitForSeedResult(page) {
  await page.waitForFunction(() => {
    const value = localStorage.getItem('oscar_seed_ready');
    return value === 'true' || value === 'error';
  });
  const status = await page.evaluate(() =>
    localStorage.getItem('oscar_seed_ready'),
  );
  expect(status).toBe('true');
}

async function loadSavedSession(page) {
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('menuitem', { name: 'Load Data' }).click();
  const loadButton = page.getByRole('button', {
    name: /load previous session/i,
  });
  await expect(loadButton).toBeVisible({ timeout: 5000 });
  await loadButton.click();
  await expect(page.locator('#fitbit-correlation')).toBeVisible({
    timeout: 10000,
  });
}

async function interceptAuthorizeRedirect(
  page,
  authCode,
  baseUrl,
  options = {},
) {
  await page.route('**/oauth2/authorize**', async (route) => {
    const url = new URL(route.request().url());
    const state = url.searchParams.get('state');
    const redirectUrl = `${baseUrl}oauth-callback?code=${authCode}&state=${state}`;
    if (options.useHtmlRedirect) {
      const body = `<!doctype html><html><head><meta http-equiv="refresh" content="0;url=${redirectUrl}"></head><body>Redirecting...</body></html>`;
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body,
      });
      return;
    }
    await route.fulfill({
      status: 302,
      headers: { Location: redirectUrl },
    });
  });
}

async function interceptTokenExchange(page) {
  await page.route('https://api.fitbit.com/oauth2/token', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
      },
      body: JSON.stringify(MOCK_TOKEN_RESPONSE),
    });
  });
}

async function interceptOAuthCallback404(page, callbackPath) {
  await page.route(`**${callbackPath}**`, async (route) => {
    await route.fulfill({
      status: 404,
      contentType: 'text/html',
      body: FOUR_OH_FOUR_HTML,
    });
  });
}

async function blockExternalRequests(page, baseUrl) {
  await page.route('https://**/*', async (route) => {
    const url = route.request().url();
    const baseOrigin = new URL(baseUrl).origin;
    const secureBaseOrigin = baseOrigin.replace('http://', 'https://');
    if (url.startsWith(secureBaseOrigin)) {
      const httpUrl = url.replace(secureBaseOrigin, baseOrigin);
      const response = await route.fetch({ url: httpUrl });
      return route.fulfill({ response });
    }
    if (url.startsWith(baseOrigin)) {
      return route.fallback();
    }
    if (
      url.startsWith('https://www.fitbit.com/oauth2/authorize') ||
      url.startsWith('https://api.fitbit.com/oauth2/token')
    ) {
      return route.fallback();
    }
    return route.abort();
  });
}

function captureConsoleErrors(page) {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => {
    errors.push(err.message);
  });
  return errors;
}

async function dismissStorageConsent(page, browserName) {
  const consentDialog = page.getByRole('alertdialog', {
    name: /save data to this browser/i,
  });
  if (await consentDialog.isVisible().catch(() => false)) {
    const askLater = page.getByRole('button', { name: /ask me later/i });
    if (await askLater.isVisible().catch(() => false)) {
      await askLater.click({ force: browserName === 'webkit' });
    } else {
      await page
        .getByRole('button', { name: /don't save/i })
        .click({ force: browserName === 'webkit' });
    }
    // WebKit workaround: wait for animation/frame before asserting hidden
    if (browserName === 'webkit') {
      await page.waitForTimeout(150); // allow modal animation to finish
    }
    await expect(consentDialog).toBeHidden({ timeout: 5000 });
    // Extra: on WebKit, double-check with waitForSelector
    if (browserName === 'webkit') {
      await page.waitForSelector('[role="alertdialog"]', {
        state: 'detached',
        timeout: 5000,
      });
    }
  }
}

test('completes Fitbit OAuth flow with passphrase entry', async ({
  page,
  browserName,
}, testInfo) => {
  const baseUrl =
    testInfo?.project?.use?.baseURL || process.env.BASE_URL || DEFAULT_BASE_URL;
  const callbackPath = `${new URL(baseUrl).pathname}oauth-callback`;
  const authCode = `mock-auth-code-${crypto.randomBytes(12).toString('hex')}`;
  const consoleErrors = captureConsoleErrors(page);

  await interceptAuthorizeRedirect(page, authCode, baseUrl, {
    useHtmlRedirect: testInfo.project.name === 'webkit',
  });
  await interceptTokenExchange(page);
  await interceptOAuthCallback404(page, callbackPath);
  await blockExternalRequests(page, baseUrl);

  await seedSessionData(page);
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await waitForSeedResult(page);
  await dismissStorageConsent(page, browserName);

  await loadSavedSession(page);
  // Extra: ensure modal is dismissed before proceeding
  await dismissStorageConsent(page, browserName);

  const passphraseInput = page.getByLabel('Encryption Passphrase');
  await expect(passphraseInput).toBeVisible({ timeout: 5000 });
  await passphraseInput.fill('Test-Passphrase-123!@#');

  const connectButton = page.getByRole('button', {
    name: /connect to fitbit/i,
  });
  await expect(connectButton).toBeEnabled({ timeout: 5000 });

  // Dismiss any storage consent modal that may block the button
  await dismissStorageConsent(page, browserName);

  // Wait for Connect to Fitbit button to be enabled and visible
  await expect(connectButton).toBeEnabled({ timeout: 5000 });
  await expect(connectButton).toBeVisible({ timeout: 5000 });

  // Start OAuth flow
  const authorizeRequestPromise = page.waitForRequest('**/oauth2/authorize**');
  const tokenRequestPromise = page.waitForRequest('**/oauth2/token');
  await connectButton.click();

  const authorizeRequest = await authorizeRequestPromise;
  const authorizeState = new URL(authorizeRequest.url()).searchParams.get(
    'state',
  );
  expect(authorizeState).toBeTruthy();

  await page.waitForURL(/oauth-callback|p=oauth-callback/, { timeout: 15000 });
  await tokenRequestPromise;

  // After OAuth, the app renders without data loaded (session is not auto-restored).
  // The import dialog appears with "Load previous session" - click it to restore
  // the seeded session from IndexedDB so the Fitbit section renders.
  const postOAuthLoadButton = page.getByRole('button', {
    name: /load previous session/i,
  });
  await expect(postOAuthLoadButton).toBeVisible({ timeout: 15000 });
  await postOAuthLoadButton.click();

  // Wait for dashboard to be visible after session restore
  await page.waitForSelector('#fitbit-correlation', { timeout: 15000 });

  // Verify Fitbit dashboard container is rendered within the section
  const fitbitDashboard = page.getByTestId('fitbit-dashboard-container');
  await expect(fitbitDashboard).toBeVisible({ timeout: 5000 });

  const stateErrors = consoleErrors.filter((err) =>
    err.toLowerCase().includes('invalid oauth state'),
  );
  expect(stateErrors).toHaveLength(0);

  await page.unrouteAll({ behavior: 'ignoreErrors' });
});
