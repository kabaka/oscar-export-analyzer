/* @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const importBuilders = () => import('./fitbitBuilders.js');

describe('fitbitBuilders secure token generation', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('uses crypto randomness for token generation and keeps expected format', async () => {
    const { buildMockOAuthTokens } = await importBuilders();
    const randomSpy = vi.spyOn(Math, 'random');

    const tokens = buildMockOAuthTokens();

    expect(tokens.access_token).toMatch(/^mock_access_token_[a-f0-9]{24}$/i);
    expect(tokens.refresh_token).toMatch(/^mock_refresh_token_[a-f0-9]{24}$/i);
    expect(tokens.user_id).toMatch(/^mock_user_[a-f0-9]{12}$/i);
    expect(tokens.expires_in).toBeGreaterThan(0);
    expect(randomSpy).not.toHaveBeenCalled();
  });

  it('falls back to crypto.getRandomValues when randomUUID is unavailable', async () => {
    const getRandomValues = vi.fn((array) => {
      for (let i = 0; i < array.length; i += 1) {
        array[i] = (i + 1) * 3; // Deterministic fill for test predictability
      }
      return array;
    });

    vi.stubGlobal('crypto', { getRandomValues });
    const { buildMockOAuthTokens } = await importBuilders();

    const tokens = buildMockOAuthTokens();

    expect(getRandomValues).toHaveBeenCalled();
    expect(tokens.access_token).toMatch(/^mock_access_token_[a-f0-9]{24}$/i);
    expect(tokens.refresh_token).toMatch(/^mock_refresh_token_[a-f0-9]{24}$/i);
    expect(tokens.user_id).toMatch(/^mock_user_[a-f0-9]{12}$/i);
  });
});
