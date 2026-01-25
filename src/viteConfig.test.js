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

  it('uses tightened GitHub Pages runtime caching pattern', async () => {
    delete process.env.BASE_URL;
    vi.resetModules();
    const { default: config, GH_PAGES_RUNTIME_PATTERN } = await import(
      '../vite.config.js'
    );
    const plugins = (config.plugins || []).flat(Infinity);
    const runtimeCachingRule = plugins.reduce((found, plugin) => {
      if (found) return found;
      const fromApi = plugin?.api?.options?.workbox?.runtimeCaching?.[0];
      const fromOptions = plugin?.options?.workbox?.runtimeCaching?.[0];
      return fromApi || fromOptions || null;
    }, null);

    const expectedPattern =
      /^https:\/\/[a-z0-9-]+\.github\.io\/oscar-export-analyzer\/.*$/i;

    expect(GH_PAGES_RUNTIME_PATTERN).toEqual(expectedPattern);
    if (runtimeCachingRule) {
      expect(runtimeCachingRule.urlPattern).toEqual(GH_PAGES_RUNTIME_PATTERN);
    }
  });
});
