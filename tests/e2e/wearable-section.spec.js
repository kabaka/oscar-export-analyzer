/**
 * Playwright E2E: wearable-correlation section pre-import states.
 *
 * The wearable section is gated on CPAP summary data being present, so each test
 * seeds a synthetic CPAP session into IndexedDB and restores it via "Load
 * previous session" before asserting. No real PHI is used.
 *
 * IMPORTANT — File System Access API is NOT automatable. The wearable import is
 * driven by `window.showDirectoryPicker`, which opens a native OS folder picker
 * that Playwright cannot interact with. These tests therefore exercise only the
 * surrounding, automatable UI: the capability gate and the pre-import CTA. They
 * never click through to a real picker or ingest an export.
 *
 *   - Capability present  → assert the "Select export folder" CTA renders.
 *     We stub `window.showDirectoryPicker` to a no-op function (via
 *     `addInitScript`) so the supported branch renders deterministically across
 *     all browser projects without ever invoking the native picker.
 *   - Capability absent    → stub `window.showDirectoryPicker = undefined` to
 *     force the Chromium-required unsupported empty-state and assert its copy.
 */

import { test, expect } from '@playwright/test';
import {
  getBaseUrl,
  dismissStorageConsent,
  seedSavedSession,
  waitForSeed,
  loadSeededSession,
  stripUpgradeInsecureRequests,
} from './helpers.js';

/** Install a no-op `showDirectoryPicker` so the supported branch renders. */
async function stubDirectoryPickerSupported(page) {
  await page.addInitScript(() => {
    // A function value is all `useWearableImport` checks for capability. It is
    // never invoked in these tests (we don't click the CTA), so a stub that
    // would otherwise open a picker stays dormant.
    window.showDirectoryPicker = function stubbedShowDirectoryPicker() {
      return Promise.reject(new Error('e2e: directory picker not invoked'));
    };
  });
}

/** Remove `showDirectoryPicker` so the unsupported empty-state renders. */
async function stubDirectoryPickerUnsupported(page) {
  await page.addInitScript(() => {
    // Deleting is not enough if the runtime defines it on the prototype, so
    // explicitly set it undefined; the capability check is `typeof === function`.
    window.showDirectoryPicker = undefined;
  });
}

test.describe('Wearable section (pre-import)', () => {
  test('renders the "Select export folder" CTA when the File System Access API is available', async ({
    page,
    browserName,
  }, testInfo) => {
    const baseUrl = getBaseUrl(testInfo);

    await stubDirectoryPickerSupported(page);
    await seedSavedSession(page);
    await stripUpgradeInsecureRequests(page, baseUrl);
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await waitForSeed(page);
    await dismissStorageConsent(page, browserName);

    await loadSeededSession(page);

    const section = page.locator('#wearable-correlation');
    await expect(
      section.getByRole('heading', { name: /Wearable Correlation Analysis/i }),
    ).toBeVisible();

    // Supported branch: the import card (not the unsupported empty-state) and the
    // pick-folder CTA are shown. We intentionally do NOT click it (FSA picker is
    // not automatable).
    const card = page.getByTestId('wearable-import-card');
    await expect(card).toBeVisible();
    await expect(
      card.getByRole('button', { name: /Select export folder/i }),
    ).toBeVisible();
    await expect(page.getByTestId('wearable-import-unsupported')).toHaveCount(
      0,
    );
  });

  test('renders the Chromium-required empty-state when the File System Access API is absent', async ({
    page,
    browserName,
  }, testInfo) => {
    const baseUrl = getBaseUrl(testInfo);

    await stubDirectoryPickerUnsupported(page);
    await seedSavedSession(page);
    await stripUpgradeInsecureRequests(page, baseUrl);
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await waitForSeed(page);
    await dismissStorageConsent(page, browserName);

    await loadSeededSession(page);

    const unsupported = page.getByTestId('wearable-import-unsupported');
    await expect(unsupported).toBeVisible();
    await expect(
      unsupported.getByRole('heading', {
        name: /needs a Chromium-based browser/i,
      }),
    ).toBeVisible();
    await expect(unsupported).toContainText(/File System Access API/i);

    // The supported card / CTA must be absent in this state.
    await expect(page.getByTestId('wearable-import-card')).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: /Select export folder/i }),
    ).toHaveCount(0);
  });
});
