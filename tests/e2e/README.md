# OSCAR Export Analyzer — E2E Tests with Playwright

## Overview

This directory contains **end-to-end browser automation tests** using Playwright that validate critical user flows in OSCAR Export Analyzer. These tests run in real browsers (Chrome, Firefox, Safari) and test features like CSV uploads, data filtering, chart rendering, OAuth flows, and PWA installation.

**Key principle**: E2E tests exercise **actual user flows**, not component-level bypasses. This prevents scenarios where tests pass but real users fail.

## Running Tests

### Prerequisites

- Node.js ≥ 20.19.0
- Dev dependencies installed: `npm install`
- Dev server running: `npm run dev` (separate terminal)

### Commands

```bash
# Run all E2E tests (headless, all browsers)
npm run test:e2e

# Run with interactive UI (recommended for development)
npm run test:e2e:ui

# Run with visible browser windows (headed mode)
npm run test:e2e:headed

# Run specific test file
npx playwright test fitbit-oauth-complete-flow.spec.js

# Debug a specific test
npx playwright test fitbit-oauth-complete-flow.spec.js --debug

# Run only Chromium browser
npx playwright test --project=chromium

# Generate test report (after running tests)
npx playwright show-report
```

## Test Structure

### File Organization

```
tests/e2e/
├── fitbit-oauth-complete-flow.spec.js    # Fitbit OAuth + UI passphrase entry
├── csv-upload-workflow.spec.js           # (future) CSV upload and parsing
├── charting-interactions.spec.js         # (future) Chart rendering and interactions
├── print-export.spec.js                  # (future) Print/PDF functionality
└── README.md                              # This file
```

### Writing Tests

Tests follow Playwright best practices:

```javascript
import { test, expect } from '@playwright/test';

test('descriptive test name', async ({ page }) => {
  // 1. Setup
  await page.goto(BASE_URL);

  // 2. User actions
  await page.fill('input[name="field"]', 'value');
  await page.click('button:has-text("Submit")');

  // 3. Assertions
  await expect(page.locator('[role="alert"]')).toContainText('Success');
});
```

## Critical Fitbit OAuth E2E Test

### What It Tests

The `fitbit-oauth-complete-flow.spec.js` test validates the **entire Fitbit OAuth flow as users experience it**:

1. **UI passphrase entry** — User types passphrase into a visible text input field (NOT component-level mock)
2. **OAuth state management** — State is generated, stored, and validated correctly
3. **OAuth redirect flow** — Browser navigates to Fitbit, then back with authorization code
4. **State validation** — No "Invalid OAuth state" or CSRF errors
5. **Data persistence** — IndexedDB retains OSCAR session data after OAuth completes
6. **Error handling** — State mismatches are detected; passphrase validation works

### Test Scenarios

#### Primary Flow: Complete OAuth with Passphrase Entry

```javascript
test('Complete Fitbit OAuth flow with UI passphrase entry', async ({
  page,
}) => {
  // User navigates to app
  // User types passphrase into UI field (real interaction)
  // User clicks "Connect to Fitbit" button
  // App initiates OAuth redirect to Fitbit
  // We simulate Fitbit redirect back with authorization code
  // OAuth callback processes code + state without errors
  // IndexedDB persists session data
  // ✅ Test passes: passphrase was entered via UI, state validated, data persisted
});
```

#### Error Case: OAuth State Mismatch

```javascript
test('OAuth state mismatch detection', async ({ page }) => {
  // App stores state X in localStorage
  // OAuth callback attempts to complete with state Y
  // App detects state mismatch and rejects
  // Error message appears in UI or console
  // ✅ Test passes: CSRF attack was prevented
});
```

#### Validation: Passphrase Required

```javascript
test('Passphrase required validation', async ({ page }) => {
  // User tries to click "Connect to Fitbit" WITHOUT entering passphrase
  // Button is disabled OR error message appears
  // ✅ Test passes: cannot connect without passphrase
});
```

### Why This Test Matters

**Previous issue**: Tests bypassed UI passphrase entry, testing the component in isolation:

```javascript
// ❌ WRONG: Component-level bypass
render(<OAuthCallbackHandler passphrase="test" />); // Passphrase injected directly
// This passes tests but real users must TYPE the passphrase in a field
```

**This test**: Exercises the actual flow users follow:

```javascript
// ✅ CORRECT: Real UI interaction
await page.fill('input[type="password"]', 'user-passphrase'); // User types it
await page.click('button:has-text("Connect")'); // User clicks button
```

This prevents "tests pass, users fail" scenarios.

## Mock Strategy

### Fitbit OAuth Redirect

We don't actually redirect to Fitbit's servers (which require real user authorization). Instead:

1. **Setup** — Generate valid OAuth state and PKCE code verifier in localStorage
2. **Intercept** — Route requests to `https://www.fitbit.com/**` to prevent external navigation
3. **Simulate callback** — Navigate app to callback URL with mock authorization code
4. **Verify** — Assert that OAuth processing succeeds with mocked code + state

```javascript
// Generate state and code verifier
const state = crypto.randomBytes(32).toString('hex');
const codeVerifier = crypto.randomBytes(64).toString('base64url');

// Store in localStorage (what initiateAuth does)
await page.evaluate(
  (s, v) => {
    localStorage.setItem('fitbit_oauth_state', s);
    localStorage.setItem('fitbit_pkce_verifier', v);
  },
  state,
  codeVerifier,
);

// Intercept Fitbit redirect
await page.route('https://www.fitbit.com/**', (route) => route.abort());

// Simulate callback
await page.goto(`${BASE_URL}#?code=mock-code&state=${state}`);
```

## Debugging Tests

### Interactive UI Mode (Recommended)

```bash
npm run test:e2e:ui
```

- Opens Playwright Inspector
- Step through test line by line
- View network requests and console logs
- Change selectors and assertions in real-time

### Debug Mode

```bash
npx playwright test fitbit-oauth-complete-flow.spec.js --debug
```

- Opens browser with debugger
- Pauses at breakpoints
- Inspect DOM and console

### Headed Mode with Logging

```bash
npx playwright test --headed 2>&1 | grep -i "e2e test"
```

- See browser window during test execution
- View detailed console logs

### Common Issues

**"Timeout waiting for locator"**

- Selector doesn't exist or is not visible
- Element is behind a modal or disabled
- Page didn't load (check network in Network tab)

**"Navigation to X timed out"**

- Dev server isn't running (`npm run dev`)
- URL is wrong (check BASE_URL in test)
- Network request is slow

**"State mismatch" error**

- localStorage was cleared between steps
- State wasn't stored before OAuth redirect
- Callback used different state parameter

## Test Configuration

See `playwright.config.js` for:

- **baseURL** — Defaults to `http://localhost:5173/oscar-export-analyzer/`
- **timeout** — 60 seconds per test; 15 seconds for assertions
- **retries** — 2 retries in CI; 0 locally
- **webServer** — Automatically starts `npm run dev` before tests
- **projects** — Tests run in Chromium, Firefox, and WebKit
- **reporter** — HTML report in `test-results/playwright/`

### Environment Variables

```bash
# Use custom base URL
BASE_URL="http://localhost:3000/" npm run test:e2e

# Run in CI (enforces retries, no preview server reuse)
CI=true npm run test:e2e
```

## Visual Regression Testing (Future)

E2E tests can capture visual baselines for charts and layouts:

```javascript
// Capture baseline (run with --update-snapshots)
await expect(page).toHaveScreenshot('chart-view.png');

// Compare on subsequent runs (fails if visual change detected)
await expect(page).toHaveScreenshot('chart-view.png');
```

Baselines are committed to git and reviewed before updates.

## Performance Considerations

- Tests run **sequentially** (not in parallel) to prevent state pollution
- Web server is reused across tests locally (speeds up startup)
- Large file uploads use realistic test data without creating huge payloads
- Timeouts are generous (60s per test) to handle slow CI environments

## CI/CD Integration

In GitHub Actions (`.github/workflows/ci.yml`):

```yaml
- name: Run E2E tests
  run: npm run test:e2e

- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: test-results/playwright/
```

Tests are **not blocking** initially (allowed to fail without blocking merge). Once stable, can be promoted to blocking status.

## Best Practices

1. **Use `page.fill()` for text input** — Simulates real user typing
2. **Wait for state, not timing** — Use `waitForNavigation()`, `waitForLoadState()`, selectors
3. **Isolate tests** — Each test should be independent; no shared state
4. **Descriptive locators** — Prefer `role`, `label`, visible text over brittle CSS
5. **Capture console errors** — Monitor console for OAuth state errors, CORS issues
6. **Keep tests fast** — Use mock redirects instead of real Fitbit servers
7. **Verify realistic scenarios** — Test what users actually do, not internal implementation

## Adding New Tests

### Template

```javascript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test('specific user scenario', async ({ page }) => {
    // Setup
    const BASE_URL =
      process.env.BASE_URL || 'http://localhost:5173/oscar-export-analyzer/';
    await page.goto(BASE_URL);

    // User actions
    await page.fill('input[placeholder="Search"]', 'test');
    await page.click('button:has-text("Search")');

    // Assertions
    await expect(page.locator('[role="listitem"]')).toContainText('Result');
  });
});
```

### Checklist for New Tests

- [ ] Test name describes what users do
- [ ] Test uses actual UI interactions (fill, click, press)
- [ ] No component-level bypasses or direct prop injection
- [ ] Console errors are captured and verified
- [ ] Test passes reliably (run 5+ times)
- [ ] Test fails predictably (break something, verify test catches it)
- [ ] Timeout values are reasonable
- [ ] Selectors are resilient to UI changes

## Troubleshooting

### Tests Pass Locally but Fail in CI

- **Timing issue**: CI is slower; increase timeouts
- **Environment differences**: Check BASE_URL, PORT, browser versions
- **Flaky tests**: Use `waitFor()` instead of fixed timeouts

### Selector Not Found

```javascript
// Debug: log available elements
console.log(await page.locator('*').all().length); // Count elements

// Try alternative selectors
await page.locator('[role="button"]').first();
await page.locator('button').filter({ hasText: 'Connect' });
await page.locator('input[type="password"]').first();
```

### State Not Persisting

```javascript
// Verify localStorage/sessionStorage is set
const state = await page.evaluate(() =>
  localStorage.getItem('fitbit_oauth_state'),
);
console.log('OAuth state:', state);

// Check IndexedDB
await page.evaluate(() => {
  const req = indexedDB.open('oscarDB');
  req.onsuccess = () => console.log('DB opened', req.result.objectStoreNames);
});
```

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Test Reporter](https://playwright.dev/docs/test-reporters)
- [Debugging Guide](https://playwright.dev/docs/debug)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [API Reference](https://playwright.dev/docs/api/class-test)

---

**Last Updated**: 2026-01-27  
**Maintained by**: @testing-expert agent  
**Status**: Active — Fitbit OAuth E2E test implemented
