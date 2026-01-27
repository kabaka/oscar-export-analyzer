import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration
 *
 * Configures browser automation for testing critical user flows:
 * - OAuth callbacks
 * - CSV uploads and data processing
 * - Chart rendering and interactions
 * - Print/PDF functionality
 * - PWA installation
 *
 * Run: npx playwright test
 * Run with UI: npx playwright test --ui
 * Run headed: npx playwright test --headed
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Run tests sequentially to avoid state pollution
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 1,
  reportSlowTests: null,
  reporter: [['html'], ['list']],
  use: {
    baseURL:
      process.env.BASE_URL || 'http://localhost:5173/oscar-export-analyzer/',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  timeout: 60000,
  expect: {
    timeout: 15000,
  },
});
