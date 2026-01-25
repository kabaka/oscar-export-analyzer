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
});
