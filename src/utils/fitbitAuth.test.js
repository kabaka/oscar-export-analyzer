/**
 * Tests for Fitbit OAuth authentication utilities.
 * Covers CSRF protection via state parameters, timeout validation, and PKCE flow.
 *
 * @module utils/fitbitAuth.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OAuthState } from './fitbitAuth.js';

describe('OAuthState', () => {
  beforeEach(() => {
    // Clear sessionStorage before each test
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up after each test
    sessionStorage.clear();
  });

  describe('generateState', () => {
    it('generates a state with cryptographic randomness', async () => {
      const oauthState = new OAuthState();
      const { state, codeChallenge } = await oauthState.generateState();

      expect(state).toBeTruthy();
      expect(codeChallenge).toBeTruthy();
      expect(typeof state).toBe('string');
      expect(typeof codeChallenge).toBe('string');
      expect(state.length).toBeGreaterThan(20);
    });

    it('stores state and verifier in sessionStorage', async () => {
      const oauthState = new OAuthState();
      await oauthState.generateState();

      const stored = sessionStorage.getItem('fitbit_oauth_state');
      const verifier = sessionStorage.getItem('fitbit_pkce_verifier');

      expect(stored).toBeTruthy();
      expect(verifier).toBeTruthy();
    });

    it('stores state with timestamp for timeout validation', async () => {
      const oauthState = new OAuthState();
      const before = Date.now();
      await oauthState.generateState();
      const after = Date.now();

      const stored = sessionStorage.getItem('fitbit_oauth_state');
      const stateData = JSON.parse(stored);

      expect(stateData).toHaveProperty('value');
      expect(stateData).toHaveProperty('createdAt');
      expect(stateData.createdAt).toBeGreaterThanOrEqual(before);
      expect(stateData.createdAt).toBeLessThanOrEqual(after);
    });

    it('generates unique states on each call', async () => {
      const oauthState = new OAuthState();
      const { state: state1 } = await oauthState.generateState();

      sessionStorage.clear();

      const { state: state2 } = await oauthState.generateState();

      expect(state1).not.toBe(state2);
    });
  });

  describe('validateCallback', () => {
    it('validates matching state and returns verifier', async () => {
      const oauthState = new OAuthState();
      const { state } = await oauthState.generateState();

      const verifier = oauthState.validateCallback(state);

      expect(verifier).toBeTruthy();
      expect(typeof verifier).toBe('string');
    });

    it('returns null for mismatched state', async () => {
      const oauthState = new OAuthState();
      await oauthState.generateState();

      const verifier = oauthState.validateCallback('wrong_state');

      expect(verifier).toBeNull();
    });

    it('returns null for missing state', () => {
      const oauthState = new OAuthState();

      const verifier = oauthState.validateCallback('any_state');

      expect(verifier).toBeNull();
    });

    it('clears state from sessionStorage after validation', async () => {
      const oauthState = new OAuthState();
      const { state } = await oauthState.generateState();

      expect(sessionStorage.getItem('fitbit_oauth_state')).toBeTruthy();

      oauthState.validateCallback(state);

      expect(sessionStorage.getItem('fitbit_oauth_state')).toBeNull();
    });

    it('prevents state replay after first validation', async () => {
      const oauthState = new OAuthState();
      const { state } = await oauthState.generateState();

      // First validation succeeds
      const verifier1 = oauthState.validateCallback(state);
      expect(verifier1).toBeTruthy();

      // Trying to validate same state again fails
      const verifier2 = oauthState.validateCallback(state);
      expect(verifier2).toBeNull();
    });

    it('rejects state older than 5 minutes', async () => {
      const oauthState = new OAuthState();
      const { state } = await oauthState.generateState();

      // Manually set state to be older than 5 minutes
      const stateData = JSON.parse(
        sessionStorage.getItem('fitbit_oauth_state'),
      );
      stateData.createdAt = Date.now() - 6 * 60 * 1000; // 6 minutes ago
      sessionStorage.setItem('fitbit_oauth_state', JSON.stringify(stateData));

      const verifier = oauthState.validateCallback(state);

      expect(verifier).toBeNull();
    });

    it('accepts state exactly at 5 minutes (boundary test)', async () => {
      const oauthState = new OAuthState();
      const { state } = await oauthState.generateState();

      // Manually set state to be exactly 5 minutes old
      const stateData = JSON.parse(
        sessionStorage.getItem('fitbit_oauth_state'),
      );
      stateData.createdAt = Date.now() - 5 * 60 * 1000; // Exactly 5 minutes ago
      sessionStorage.setItem('fitbit_oauth_state', JSON.stringify(stateData));

      const verifier = oauthState.validateCallback(state);

      // Should be accepted (boundary case: exactly 5 minutes is still valid)
      expect(verifier).toBeTruthy();
    });

    it('accepts state just under 5 minutes', async () => {
      const oauthState = new OAuthState();
      const { state } = await oauthState.generateState();

      // Manually set state to be 4:59 old
      const stateData = JSON.parse(
        sessionStorage.getItem('fitbit_oauth_state'),
      );
      stateData.createdAt = Date.now() - (4 * 60 * 1000 + 59 * 1000);
      sessionStorage.setItem('fitbit_oauth_state', JSON.stringify(stateData));

      const verifier = oauthState.validateCallback(state);

      expect(verifier).toBeTruthy();
    });

    it('rejects state just over 5 minutes', async () => {
      const oauthState = new OAuthState();
      const { state } = await oauthState.generateState();

      // Manually set state to be 5:01 old
      const stateData = JSON.parse(
        sessionStorage.getItem('fitbit_oauth_state'),
      );
      stateData.createdAt = Date.now() - (5 * 60 * 1000 + 1 * 1000);
      sessionStorage.setItem('fitbit_oauth_state', JSON.stringify(stateData));

      const verifier = oauthState.validateCallback(state);

      expect(verifier).toBeNull();
    });

    it('handles corrupted state JSON gracefully', () => {
      const oauthState = new OAuthState();

      // Store corrupted JSON
      sessionStorage.setItem('fitbit_oauth_state', '{invalid json}');

      const verifier = oauthState.validateCallback('any_state');

      expect(verifier).toBeNull();
      // Corrupted state should be cleared
      expect(sessionStorage.getItem('fitbit_oauth_state')).toBeNull();
    });

    it('returns null if state data has no value property', async () => {
      const oauthState = new OAuthState();

      // Store state without value property
      sessionStorage.setItem(
        'fitbit_oauth_state',
        JSON.stringify({ createdAt: Date.now() }),
      );

      const verifier = oauthState.validateCallback('test_state');

      expect(verifier).toBeNull();
    });
  });

  describe('security properties', () => {
    it('uses sessionStorage not localStorage', async () => {
      const oauthState = new OAuthState();
      await oauthState.generateState();

      expect(sessionStorage.getItem('fitbit_oauth_state')).toBeTruthy();
      expect(localStorage.getItem('fitbit_oauth_state')).toBeNull();
    });

    it('enforces exact state matching (not substring)', async () => {
      const oauthState = new OAuthState();
      const { state } = await oauthState.generateState();

      // Try to validate with state that contains the correct state but has extra chars
      const verifier = oauthState.validateCallback(state + 'extra');

      expect(verifier).toBeNull();
    });

    it('clears both state and verifier on successful validation', async () => {
      const oauthState = new OAuthState();
      const { state } = await oauthState.generateState();

      expect(sessionStorage.getItem('fitbit_oauth_state')).toBeTruthy();
      expect(sessionStorage.getItem('fitbit_pkce_verifier')).toBeTruthy();

      oauthState.validateCallback(state);

      expect(sessionStorage.getItem('fitbit_oauth_state')).toBeNull();
      expect(sessionStorage.getItem('fitbit_pkce_verifier')).toBeNull();
    });

    it('clears both state and verifier on validation failure', () => {
      const oauthState = new OAuthState();

      sessionStorage.setItem(
        'fitbit_oauth_state',
        JSON.stringify({
          value: 'stored_state',
          createdAt: Date.now(),
        }),
      );
      sessionStorage.setItem('fitbit_pkce_verifier', 'test_verifier');

      oauthState.validateCallback('wrong_state');

      expect(sessionStorage.getItem('fitbit_oauth_state')).toBeNull();
      expect(sessionStorage.getItem('fitbit_pkce_verifier')).toBeNull();
    });
  });
});

// Export OAuthState for testing if not already exported from fitbitAuth.js
// Note: Update the import above if OAuthState needs to be explicitly exported
