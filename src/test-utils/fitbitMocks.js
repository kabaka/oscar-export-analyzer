/**
 * Test utilities for Fitbit integration tests.
 */

// Mock Vite environment for tests
global.import = {
  meta: {
    env: {
      VITE_FITBIT_CLIENT_ID: 'test-client-id',
    },
  },
};

// Mock window.location for OAuth tests
global.window = global.window || {};
global.window.location = {
  search: '',
  pathname: '/oauth-callback',
  origin: 'http://localhost:5173',
};

// Mock history API
global.window.history = {
  replaceState: vi.fn(),
};

export const mockFitbitOAuth = {
  initiateAuth: vi.fn(),
  handleCallback: vi.fn(),
  handleOAuthError: vi.fn(),
  status: 'disconnected',
  error: null,
  isLoading: false,
  clearError: vi.fn(),
};

export const mockFitbitConnection = {
  status: 'disconnected',
  error: null,
  connectionInfo: null,
  dataStats: null,
  lastSync: null,
  isRefreshing: false,
  checkConnection: vi.fn(),
  refreshToken: vi.fn(),
  disconnect: vi.fn(),
  clearError: vi.fn(),
};
