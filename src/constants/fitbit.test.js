/**
 * Tests for Fitbit constants.
 */

import { describe, it, expect } from 'vitest';
import {
  FITBIT_CONFIG,
  FITBIT_SCOPES,
  MVP_SCOPES,
  CONNECTION_STATUS,
} from '../constants/fitbit.js';

describe('Fitbit Constants', () => {
  it('exports required configuration constants', () => {
    expect(FITBIT_CONFIG).toBeDefined();
    // FIXME: reenable this after fixing it for GitHub Actions CI/CD.
    // expect(FITBIT_CONFIG.clientId).toBe('dev-client-id');
    expect(FITBIT_CONFIG.authUrl).toBe(
      'https://www.fitbit.com/oauth2/authorize',
    );
    expect(FITBIT_CONFIG.tokenUrl).toBe('https://api.fitbit.com/oauth2/token');
  });

  it('exports OAuth scopes', () => {
    expect(FITBIT_SCOPES.HEARTRATE).toBe('heartrate');
    expect(FITBIT_SCOPES.SPO2).toBe('oxygen_saturation');
    expect(FITBIT_SCOPES.SLEEP).toBe('sleep');
  });

  it('exports MVP scopes array', () => {
    expect(MVP_SCOPES).toEqual(['heartrate', 'oxygen_saturation', 'sleep']);
  });

  it('exports connection status constants', () => {
    expect(CONNECTION_STATUS.DISCONNECTED).toBe('disconnected');
    expect(CONNECTION_STATUS.CONNECTING).toBe('connecting');
    expect(CONNECTION_STATUS.CONNECTED).toBe('connected');
    expect(CONNECTION_STATUS.ERROR).toBe('error');
  });

  describe('redirectUri construction', () => {
    it('includes BASE_URL in redirect_uri for GitHub Pages deployment', () => {
      // In tests, import.meta.env.BASE_URL is set by Vite config
      // For production GitHub Pages, this would be '/oscar-export-analyzer/'
      const redirectUri = FITBIT_CONFIG.redirectUri;

      expect(redirectUri).toBeDefined();
      expect(redirectUri).toContain('oauth-callback');

      // Should start with origin
      expect(redirectUri).toMatch(/^https?:\/\//);
    });

    it('constructs redirect_uri with location origin when available', () => {
      const redirectUri = FITBIT_CONFIG.redirectUri;

      // In jsdom test environment, globalThis.location.origin should be available
      if (globalThis.location?.origin) {
        expect(redirectUri).toContain(globalThis.location.origin);
      }
    });

    it('redirect_uri format matches expected OAuth callback pattern', () => {
      const redirectUri = FITBIT_CONFIG.redirectUri;

      // Should be a valid URL
      expect(() => new URL(redirectUri)).not.toThrow();

      // Should end with oauth-callback
      expect(redirectUri).toMatch(/oauth-callback$/);
    });

    it('handles BASE_URL without trailing slash in redirect_uri', () => {
      const redirectUri = FITBIT_CONFIG.redirectUri;

      // Verify no double slashes before oauth-callback (except after protocol)
      const urlObj = new URL(redirectUri);
      expect(urlObj.pathname).not.toMatch(/\/\//);
    });

    it('redirect_uri includes subdirectory path from BASE_URL', () => {
      const redirectUri = FITBIT_CONFIG.redirectUri;

      // import.meta.env.BASE_URL in tests should be '/' or a path like '/oscar-export-analyzer/'
      // The redirect_uri should include this base path
      const baseUrl = import.meta.env.BASE_URL || '/';

      // Parse the redirect_uri to check pathname structure
      const urlObj = new URL(redirectUri);

      // If BASE_URL is not just '/', it should be in the pathname
      if (baseUrl !== '/') {
        expect(urlObj.pathname).toContain(baseUrl.replace(/\/$/, ''));
      }

      // Should always end with oauth-callback
      expect(urlObj.pathname).toMatch(/oauth-callback$/);
    });
  });
});
