/**
 * Playwright E2E: baseline application smoke tests.
 *
 * Replaces the removed Fitbit OAuth spec as the minimum viable coverage for the
 * current app so the E2E job has tests to run. Verifies the app boots cleanly,
 * the header/title and primary import controls render, and the table-of-contents
 * navigation (including the wearable-correlation anchor) is present.
 *
 * No real PHI is used. The storage-consent modal (an `alertdialog` only shown
 * when the app tries to persist data) is dismissed defensively up front to keep
 * WebKit from hanging on its exit animation.
 */

import { test, expect } from '@playwright/test';
import {
  getBaseUrl,
  captureConsoleErrors,
  dismissStorageConsent,
  stripUpgradeInsecureRequests,
} from './helpers.js';

test.describe('App smoke', () => {
  test('loads without console errors and renders header + import controls', async ({
    page,
    browserName,
  }, testInfo) => {
    const baseUrl = getBaseUrl(testInfo);
    const consoleErrors = captureConsoleErrors(page);

    await stripUpgradeInsecureRequests(page, baseUrl);
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await dismissStorageConsent(page, browserName);

    // Header / title.
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: /OSCAR Sleep Data Analysis/i,
      }),
    ).toBeVisible();

    // Primary import control: the header Menu opens the data-import flow.
    const menuButton = page.getByRole('button', { name: 'Menu' });
    await expect(menuButton).toBeVisible();

    await menuButton.click();
    await expect(
      page.getByRole('menuitem', { name: 'Load Data' }),
    ).toBeVisible();

    // Open the import modal and confirm the CPAP CSV upload affordance exists.
    await page.getByRole('menuitem', { name: 'Load Data' }).click();
    const importDialog = page.getByRole('dialog', { name: 'Import Data' });
    await expect(importDialog).toBeVisible();
    await expect(
      importDialog.getByRole('heading', { name: /Load OSCAR CSVs/i }),
    ).toBeVisible();
    await expect(
      importDialog.getByLabel('CSV or session files'),
    ).toBeAttached();

    await importDialog.getByRole('button', { name: 'Close' }).click();
    await expect(importDialog).toBeHidden();

    // No uncaught console/page errors during boot + basic interaction.
    // The `frame-ancestors`-in-<meta> CSP notice is a known, benign browser
    // warning (the directive is delivered via <meta>, which browsers ignore for
    // this directive); it reflects no app fault, so we filter it out and assert
    // nothing else logged an error.
    const unexpectedErrors = consoleErrors.filter(
      (msg) => !/frame-ancestors/i.test(msg),
    );
    expect(
      unexpectedErrors,
      `Unexpected console errors:\n${unexpectedErrors.join('\n')}`,
    ).toEqual([]);
  });

  test('renders table-of-contents navigation incl. the Wearable Analysis anchor', async ({
    page,
    browserName,
  }, testInfo) => {
    const baseUrl = getBaseUrl(testInfo);
    await stripUpgradeInsecureRequests(page, baseUrl);
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await dismissStorageConsent(page, browserName);

    // The TOC renders one anchor per section. Assert a representative spread and
    // that the wearable-correlation link points at the correct anchor/id.
    const overviewLink = page.getByRole('link', { name: 'Overview' }).first();
    await expect(overviewLink).toBeVisible();

    const wearableLink = page
      .getByRole('link', { name: 'Wearable Analysis' })
      .first();
    await expect(wearableLink).toBeVisible();
    await expect(wearableLink).toHaveAttribute('href', '#wearable-correlation');
  });
});
