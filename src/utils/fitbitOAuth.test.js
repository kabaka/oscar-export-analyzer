/**
 * Tests for fitbitOAuth.js utility (state/token logic)
 */
import { describe, it, expect } from 'vitest';
import {
  generateRandomString,
  generateCodeChallenge,
  getStoredOAuthState,
  clearOAuthState,
} from './fitbitOAuth';

describe('fitbitOAuth utility', () => {
  it('generates a random string of correct length', () => {
    const str = generateRandomString(43);
    expect(typeof str).toBe('string');
    expect(str.length).toBe(43);
  });

  it('generates a valid PKCE code challenge', async () => {
    const verifier = generateRandomString(64);
    const challenge = await generateCodeChallenge(verifier);
    expect(typeof challenge).toBe('string');
    expect(challenge.length).toBeGreaterThan(0);
  });

  it('stores and retrieves OAuth state from session/localStorage', () => {
    sessionStorage.setItem(
      'fitbit_oauth_state',
      JSON.stringify({ value: 'abc', createdAt: Date.now() }),
    );
    sessionStorage.setItem('fitbit_pkce_verifier', 'verifier');
    const { state, codeVerifier } = getStoredOAuthState();
    expect(state).toBe('abc');
    expect(codeVerifier).toBe('verifier');
    clearOAuthState();
    expect(getStoredOAuthState().state).toBeNull();
  });
});
