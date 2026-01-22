import { describe, it } from 'vitest';

// NOTE: These tests are skipped due to a Vite/Vitest incompatibility issue.
// The hook creates Workers using `new Worker(new URL(..., import.meta.url))`,
// which causes Vite to attempt bundling the worker module during tests.
// This triggers an infinite loop or unbounded memory accumulation, causing OOM
// even with 8GB+ heap size.
//
// Root cause analysis: docs/work/debugging/RCA_hook_tests_oom.md
//
// The analytics logic is tested through:
// 1. Integration tests in App.worker.integration.test.jsx
// 2. Direct utility tests in utils/clustering.test.js (if added)
// 3. Manual testing in development
//
// TODO: Consider refactoring worker creation pattern to enable unit testing

describe.skip('useAnalyticsProcessing', () => {
  it.skip('tests skipped - see comment above for details', () => {
    // Tests would go here, but are skipped to prevent OOM
  });
});
