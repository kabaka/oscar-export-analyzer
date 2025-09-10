/* @vitest-environment node */
import { describe, it, expect, vi } from 'vitest';

describe('vite config base path', () => {
  it('uses BASE_URL when provided', async () => {
    process.env.BASE_URL = '/custom/';
    vi.resetModules();
    const config = (await import('../vite.config.js')).default;
    expect(config.base).toBe('/custom/');
  });

  it('falls back to default base when BASE_URL is undefined', async () => {
    delete process.env.BASE_URL;
    vi.resetModules();
    const config = (await import('../vite.config.js')).default;
    expect(config.base).toBe('/oscar-export-analyzer/');
  });
});
