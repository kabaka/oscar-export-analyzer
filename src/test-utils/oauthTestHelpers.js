/**
 * OAuth test helper utilities for Fitbit integration tests.
 *
 * Provides mocking, state management, and helper functions for testing
 * OAuth 2.0 flows without actual redirects or API calls.
 *
 * @module test-utils/oauthTestHelpers
 */

import { vi } from 'vitest';

/**
 * Generate mock OAuth state and PKCE data for testing.
 *
 * @param {Object} options - Generation options
 * @param {boolean} options.valid - Generate valid format (default true)
 * @returns {Object} Mock OAuth state data
 */
export function generateMockOAuthState({ valid = true } = {}) {
  if (!valid) {
    return {
      state: 'invalid_state',
      codeVerifier: 'short', // Too short for PKCE spec
      codeChallenge: 'invalid',
    };
  }

  return {
    state: 'mock_state_' + Math.random().toString(36).substr(2, 24),
    codeVerifier: 'mock_verifier_' + Math.random().toString(36).substr(2, 100),
    codeChallenge: 'mock_challenge_' + Math.random().toString(36).substr(2, 40),
  };
}

/**
 * Mock successful token response from Fitbit API.
 *
 * @param {Object} options - Response options
 * @param {number} options.expiresIn - Token lifetime in seconds (default 3600)
 * @returns {Object} Mock token data
 */
export function mockTokenResponse({ expiresIn = 3600 } = {}) {
  const timestamp = Date.now();
  return {
    access_token: 'mock_access_' + timestamp,
    refresh_token: 'mock_refresh_' + timestamp,
    expires_in: expiresIn,
    token_type: 'Bearer',
    scope: 'heartrate oxygen_saturation sleep',
    user_id: 'TEST' + timestamp.toString().slice(-6),
  };
}

/**
 * Mock error response from Fitbit OAuth endpoint.
 *
 * @param {string} errorType - Error type ('invalid_grant', 'access_denied', etc.)
 * @param {string} description - Error description
 * @returns {Object} Mock error response
 */
export function mockOAuthErrorResponse(errorType, description) {
  return {
    error: errorType,
    error_description: description,
  };
}

/**
 * Setup sessionStorage with OAuth state for callback tests.
 * Creates state object with timestamp for timeout validation.
 *
 * @param {string} state - OAuth state parameter
 * @param {string} verifier - PKCE code verifier
 * @param {number} ageMs - Optional age in milliseconds (default: 0, current time)
 */
export function setupOAuthState(state, verifier, ageMs = 0) {
  const stateData = {
    value: state,
    createdAt: Date.now() - ageMs,
  };
  sessionStorage.setItem('fitbit_oauth_state', JSON.stringify(stateData));
  sessionStorage.setItem('fitbit_pkce_verifier', verifier);
}

/**
 * Clear OAuth state from sessionStorage.
 */
export function clearOAuthState() {
  sessionStorage.removeItem('fitbit_oauth_state');
  sessionStorage.removeItem('fitbit_pkce_verifier');
}

/**
 * Simulate OAuth callback URL with code and state parameters.
 *
 * @param {string} code - Authorization code
 * @param {string} state - OAuth state
 * @returns {URLSearchParams} Parsed query parameters
 */
export function simulateOAuthCallback(code, state) {
  window.location.search = `?code=${code}&state=${state}`;
  return new URLSearchParams(window.location.search);
}

/**
 * Simulate OAuth error callback.
 *
 * @param {string} error - Error code ('access_denied', 'server_error', etc.)
 * @param {string} description - Human-readable error description
 * @returns {URLSearchParams} Parsed query parameters
 */
export function simulateOAuthError(error, description) {
  const encodedDescription = encodeURIComponent(description);
  window.location.search = `?error=${error}&error_description=${encodedDescription}`;
  return new URLSearchParams(window.location.search);
}

/**
 * Verify authorization URL is correctly formatted.
 *
 * @param {string} url - Authorization URL to validate
 * @returns {Object} Parsed URL components
 * @throws {Error} If URL is invalid
 */
export function verifyAuthorizationUrl(url) {
  try {
    const urlObj = new URL(url);

    if (urlObj.hostname !== 'www.fitbit.com') {
      throw new Error(`Invalid hostname: ${urlObj.hostname}`);
    }

    if (urlObj.pathname !== '/oauth2/authorize') {
      throw new Error(`Invalid pathname: ${urlObj.pathname}`);
    }

    const params = urlObj.searchParams;

    const requiredParams = [
      'client_id',
      'response_type',
      'code_challenge_method',
      'code_challenge',
      'state',
      'scope',
      'redirect_uri',
    ];

    for (const param of requiredParams) {
      if (!params.has(param)) {
        throw new Error(`Missing required parameter: ${param}`);
      }
    }

    if (params.get('response_type') !== 'code') {
      throw new Error(`Invalid response_type: ${params.get('response_type')}`);
    }

    if (params.get('code_challenge_method') !== 'S256') {
      throw new Error(
        `Invalid code_challenge_method: ${params.get('code_challenge_method')}`,
      );
    }

    return {
      clientId: params.get('client_id'),
      state: params.get('state'),
      codeChallenge: params.get('code_challenge'),
      scope: params.get('scope'),
      redirectUri: params.get('redirect_uri'),
    };
  } catch (error) {
    throw new Error(`Invalid authorization URL: ${error.message}`);
  }
}

/**
 * Mock fetch for OAuth token exchange.
 *
 * @param {Object} options - Mock configuration
 * @param {boolean} options.success - Return success response (default true)
 * @param {Object} options.tokenData - Custom token data (optional)
 * @param {number} options.statusCode - HTTP status code (default 200 or 400)
 * @param {string} options.errorType - Error type for failed responses
 * @returns {Function} Mock fetch function
 */
export function mockTokenExchange({
  success = true,
  tokenData = null,
  statusCode = null,
  errorType = 'invalid_grant',
} = {}) {
  return vi.fn((url) => {
    if (url.includes('oauth2/token')) {
      if (success) {
        return Promise.resolve({
          ok: true,
          status: statusCode || 200,
          json: async () => tokenData || mockTokenResponse(),
        });
      } else {
        return Promise.resolve({
          ok: false,
          status: statusCode || 400,
          statusText: 'Bad Request',
          json: async () => mockOAuthErrorResponse(errorType, 'Token invalid'),
        });
      }
    }

    // Default mock for other endpoints
    return Promise.reject(new Error(`Unexpected fetch to: ${url}`));
  });
}

/**
 * Mock fetch for Fitbit API endpoints.
 *
 * @param {string} endpoint - API endpoint path
 * @param {Object} mockData - Mock response data
 * @returns {Function} Mock fetch function
 */
export function mockFitbitAPI(endpoint, mockData) {
  return vi.fn((url) => {
    if (url.includes(endpoint)) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => mockData,
      });
    }

    return Promise.reject(new Error(`Unexpected fetch to: ${url}`));
  });
}

/**
 * Simulate full OAuth redirect flow (clear sessionStorage as browser does).
 * This simulates the behavior when browser navigates away and back.
 */
export function simulateRedirect() {
  // For same-origin OAuth callback (redirect from Fitbit back to our app),
  // sessionStorage persists within the same tab. It only clears on tab close
  // or navigation to a different origin domain.
  //
  // Since OAuth callback returns to same origin, sessionStorage is preserved.
  // This matches real browser behavior for OAuth 2.0 flows.
  //
  // Note: window.location properties are preserved by our mock
}

/**
 * Setup complete OAuth mock environment.
 *
 * @param {Object} options - Setup options
 * @param {Function} options.onLocationChange - Callback when location changes
 * @returns {Object} Mock environment controls
 */
export function setupOAuthMockEnvironment({ onLocationChange = null } = {}) {
  // Mock localStorage (already done in setupTests, but ensure clean)
  const localStorageData = {};
  global.localStorage = {
    getItem: (key) => localStorageData[key] || null,
    setItem: (key, value) => {
      localStorageData[key] = value;
    },
    removeItem: (key) => {
      delete localStorageData[key];
    },
    clear: () => {
      Object.keys(localStorageData).forEach(
        (key) => delete localStorageData[key],
      );
    },
  };

  // Mock sessionStorage (separate from localStorage)
  const sessionStorageData = {};
  global.sessionStorage = {
    getItem: (key) => sessionStorageData[key] || null,
    setItem: (key, value) => {
      sessionStorageData[key] = value;
    },
    removeItem: (key) => {
      delete sessionStorageData[key];
    },
    clear: () => {
      Object.keys(sessionStorageData).forEach(
        (key) => delete sessionStorageData[key],
      );
    },
    get length() {
      return Object.keys(sessionStorageData).length;
    },
  };

  // Mock window.location with change tracking
  const mockLocation = {
    origin: 'http://localhost:5173',
    pathname: '/',
    search: '',
    hash: '',
    href: 'http://localhost:5173/',
  };

  Object.defineProperty(window, 'location', {
    value: new Proxy(mockLocation, {
      set: (target, prop, value) => {
        target[prop] = value;
        if (prop === 'href' && onLocationChange) {
          onLocationChange(value);
        }
        return true;
      },
    }),
    writable: true,
    configurable: true,
  });

  // Mock window.history
  const mockHistory = {
    replaceState: vi.fn(),
    pushState: vi.fn(),
  };
  Object.defineProperty(window, 'history', {
    value: mockHistory,
    writable: true,
    configurable: true,
  });

  return {
    location: mockLocation,
    history: mockHistory,
    clearStorage: () => {
      localStorage.clear();
      sessionStorage.clear();
    },
  };
}

/**
 * Wait for async state updates in tests.
 *
 * @param {Function} condition - Condition to check
 * @param {number} timeout - Max wait time in ms (default 3000)
 * @param {number} interval - Check interval in ms (default 50)
 * @returns {Promise<void>}
 */
export async function waitForCondition(
  condition,
  timeout = 3000,
  interval = 50,
) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error('Condition not met within timeout');
}

/**
 * Mock crypto.subtle for PKCE testing and encryption.
 *
 * @param {Object} options - Mock options
 * @param {boolean} options.deterministic - Use deterministic hashing (default true)
 * @returns {Object} Mock crypto object
 */
export function mockCryptoSubtle({ deterministic = true } = {}) {
  return {
    getRandomValues: vi.fn((buffer) => {
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] = deterministic ? i % 256 : Math.floor(Math.random() * 256);
      }
      return buffer;
    }),
    subtle: {
      digest: vi.fn(async (algorithm, data) => {
        // Return deterministic hash for testing
        if (deterministic) {
          const mockHash = new Uint8Array(32);
          mockHash.fill(42); // Deterministic value
          return mockHash.buffer;
        }

        // Simple non-cryptographic hash for testing
        const array = new Uint8Array(data);
        const hash = new Uint8Array(32);
        for (let i = 0; i < array.length; i++) {
          hash[i % 32] ^= array[i];
        }
        return hash.buffer;
      }),

      // Mock importKey for PBKDF2 key material
      importKey: vi.fn(
        async (format, keyData, algorithm, extractable, usages) => {
          return {
            type: 'secret',
            extractable,
            algorithm: { name: algorithm },
            usages,
          };
        },
      ),

      // Mock deriveKey for PBKDF2 → AES-GCM key derivation
      deriveKey: vi.fn(
        async (
          algorithm,
          baseKey,
          derivedKeyAlgorithm,
          extractable,
          usages,
        ) => {
          return {
            type: 'secret',
            extractable,
            algorithm: derivedKeyAlgorithm,
            usages,
          };
        },
      ),

      // Mock encrypt for AES-GCM encryption
      encrypt: vi.fn(async (algorithm, key, data) => {
        // Simple mock: just return the data with a prefix
        // This isn't real encryption, just enough for testing
        const mockCiphertext = new Uint8Array(data.byteLength + 16);
        mockCiphertext.set([0x01, 0x02, 0x03, 0x04]); // Mock tag
        mockCiphertext.set(new Uint8Array(data), 16);
        return mockCiphertext.buffer;
      }),

      // Mock decrypt for AES-GCM decryption
      decrypt: vi.fn(async (algorithm, key, data) => {
        // Simple mock: remove the prefix added by encrypt
        const mockPlaintext = new Uint8Array(data).slice(16);
        return mockPlaintext.buffer;
      }),
    },
  };
}
