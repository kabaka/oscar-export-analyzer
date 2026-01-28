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
  };

  await page.addInitScript((seed) => {
    const DB_NAME = 'oscar_app';
    const DB_VERSION = 2;
    const STORE = 'sessions';

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
      if (!db.objectStoreNames.contains('fitbit_tokens')) {
        db.createObjectStore('fitbit_tokens', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('fitbit_data')) {
        db.createObjectStore('fitbit_data', {
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
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(seed, 'last');
      tx.oncomplete = () => {
        localStorage.setItem('oscar_seed_ready', 'true');
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

test('completes Fitbit OAuth flow with passphrase entry', async ({
  page,
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

  const consentDialog = page.getByRole('dialog', {
    name: /save data to this browser/i,
  });
  if (await consentDialog.isVisible().catch(() => false)) {
    const askLater = page.getByRole('button', { name: /ask me later/i });
    if (await askLater.isVisible().catch(() => false)) {
      await askLater.click();
    } else {
      await page.getByRole('button', { name: /don't save/i }).click();
    }
  }

  await loadSavedSession(page);
  await page.locator('#fitbit-correlation').scrollIntoViewIfNeeded();

  const passphraseInput = page.getByLabel('Encryption Passphrase');
  await expect(passphraseInput).toBeVisible({ timeout: 5000 });
  await passphraseInput.fill('Test-Passphrase-123!@#');

  const connectButton = page.getByRole('button', {
    name: /connect to fitbit/i,
  });
  await expect(connectButton).toBeEnabled({ timeout: 5000 });

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

  await page.waitForFunction(
    () => window.location.hash === '#fitbit-correlation',
    null,
    { timeout: 15000 },
  );

  const stateErrors = consoleErrors.filter((err) =>
    err.toLowerCase().includes('invalid oauth state'),
  );
  expect(stateErrors).toHaveLength(0);

  await page.unrouteAll({ behavior: 'ignoreErrors' });
});
