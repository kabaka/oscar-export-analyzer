# OSCAR Export Analyzer — E2E Tests with Playwright

## Overview

This directory contains **end-to-end browser automation tests** using Playwright
that validate critical user flows in OSCAR Export Analyzer. Tests run in real
browsers (Chromium, Firefox, WebKit) against a built preview of the app.

**Key principle**: E2E tests exercise **actual user flows**, not component-level
bypasses. This prevents scenarios where tests pass but real users fail.

## Running Tests

### Prerequisites

- Node.js ≥ 20.19.0
- Dependencies installed: `npm ci`
- Browsers installed: `npx playwright install` (CI uses `--with-deps`)

### Commands

```bash
npm run test:e2e            # all specs, headless, all browsers
npm run test:e2e:ui         # interactive UI (recommended for development)
npm run test:e2e:headed     # visible browser windows
npx playwright test app-smoke.spec.js          # one spec
npx playwright test --project=chromium         # one browser
npx playwright show-report                     # open the HTML report
```

## Test Structure

```
tests/e2e/
├── helpers.js               # shared utilities (see below)
├── app-smoke.spec.js        # app boot, import controls, TOC navigation
├── wearable-section.spec.js # wearable section supported/unsupported states
└── README.md                # this file
```

### `helpers.js`

- `dismissStorageConsent(page)` — dismisses the IndexedDB storage-consent
  `alertdialog` if present (force-click on WebKit + settle + wait-for-detach).
  A no-op when the modal is absent, which is the common case — the consent
  dialog only appears when the app first tries to persist.
- `stripUpgradeInsecureRequests(page)` — test-only route that rewrites the
  served HTML document to drop the `upgrade-insecure-requests` CSP directive
  before navigation. See the WebKit gotcha below.
- `seedSession(page, summary)` — seeds a tiny synthetic CPAP session directly
  into IndexedDB (`oscar_app`, `sessions` store) so the wearable section, which
  is gated on CPAP summary data, can be reached deterministically without
  relying on CSV-worker parsing timing. Never uses real PHI.

## What the specs cover

**`app-smoke.spec.js`**

1. App loads at `baseURL` with no unexpected console/page errors; the header
   title renders, the **Menu → Load Data** import dialog opens (file input
   present) and closes cleanly.
2. The table-of-contents navigation renders; **Overview** and **Wearable
   Analysis** links are visible and the wearable link points at
   `#wearable-correlation`.

**`wearable-section.spec.js`** (seeds a synthetic session first to reach the
gated section)

3. **Capability present** — stubs `window.showDirectoryPicker` to a dormant
   function (rejects if ever called) so the supported branch renders in every
   browser; asserts the `wearable-import-card` and the "Select export folder"
   CTA are visible. The CTA is never clicked.
4. **Capability absent** — stubs `window.showDirectoryPicker = undefined`;
   asserts the Chromium-required empty-state copy renders and the supported card
   is absent.

## Important constraints

### The File System Access API is not automatable

Wearable import uses `window.showDirectoryPicker` (File System Access API), which
opens a native OS picker Playwright cannot drive. **Do not** attempt to automate
the directory picker or ingest a real export in E2E. Instead, gate the rendered
branch by stubbing `window.showDirectoryPicker` via `page.addInitScript(...)`
(a dormant function for "supported", `undefined` for "unsupported") and assert on
the surrounding pre-import UI. The directory-ingest pipeline itself is covered by
fast unit/integration tests (`src/utils/wearable/*.test.js`,
`src/utils/wearable/ingestEngine.regression.test.js`).

### WebKit + `upgrade-insecure-requests`

`index.html` ships a hardened CSP `<meta>` that includes
`upgrade-insecure-requests` — correct for production (GitHub Pages is HTTPS).
Under the E2E preview server (plain HTTP on a loopback origin) WebKit honors that
directive and force-upgrades asset requests to `https://`, which has no TLS
listener, so the app never mounts (blank page). Chromium/Firefox treat the
loopback origin as potentially-trustworthy and are unaffected. The
`stripUpgradeInsecureRequests` helper removes only that one directive from the
served HTML in tests — **do not** change the app's CSP to work around this.

## Test configuration

See `playwright.config.js`:

- **baseURL** — `http://127.0.0.1:4173/oscar-export-analyzer/` (override with
  `BASE_URL`)
- **timeout** — 60s per test
- **retries** — 2 in CI, 0 locally
- **webServer** — builds and previews the app automatically (`VITE_DISABLE_SW=true`)
- **projects** — Chromium, Firefox, WebKit
- **reporter** — HTML report under `test-results/playwright/`

## CI/CD integration

The `e2e` job in `.github/workflows/ci.yml` runs `npx playwright install
--with-deps` then `npm run test:e2e`. Playwright exits non-zero if **no tests are
found**, so this directory must always contain at least one spec.

## Best practices

1. Prefer `role` / label / visible-text selectors over brittle CSS.
2. Wait for state (`waitFor`, `expect(...).toBeVisible()`), not fixed timeouts.
3. Keep each test independent; seed state explicitly (see `seedSession`).
4. Capture console/page errors and assert there are none on the happy path.
5. Never use real PHI — synthetic fixtures only.
6. A few rock-solid tests beat many flaky ones; verify a spec passes repeatedly
   and fails when you break the thing it checks.

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Test Reporters](https://playwright.dev/docs/test-reporters)
- [Debugging Guide](https://playwright.dev/docs/debug)
- [Best Practices](https://playwright.dev/docs/best-practices)

---

**Status**: Active — `app-smoke` + `wearable-section` baseline specs (Fitbit OAuth
E2E removed with the OAuth integration, ADR-0003).
