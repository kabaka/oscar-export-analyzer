# Fitbit Integration — Developer Guide

This guide covers the technical implementation of OSCAR's Fitbit integration, including OAuth flow, data processing pipeline, security architecture, and testing strategies.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [OAuth Implementation](#oauth-implementation)
- [API Integration](#api-integration)
- [Data Processing](#data-processing)
- [Security Implementation](#security-implementation)
- [Testing Patterns](#testing-patterns)
- [Performance Considerations](#performance-considerations)

## Architecture Overview

### Component Structure

```
src/features/fitbit/
├── components/
│   ├── FitbitCorrelationCharts.jsx    # Correlation visualizations
│   ├── FitbitDataSyncStatus.jsx       # Sync progress and status
│   └── FitbitSettingsPanel.jsx        # Configuration and disconnect
├── hooks/
│   ├── useFitbitAuth.js               # OAuth flow management
│   ├── useFitbitData.js               # Data fetching and caching
│   └── useFitbitCorrelations.js       # Statistical analysis
├── services/
│   ├── fitbitApi.js                   # API client and endpoints
│   ├── correlationEngine.js           # Statistical computations
│   └── encryption.js                  # Data security utilities
├── workers/
│   ├── fitbitApi.worker.js            # Background API requests
│   └── correlation.worker.js          # Heavy statistical processing
└── types/
    └── fitbit.d.ts                    # TypeScript definitions
```

### Data Flow

1. **OAuth Authorization** → Secure token exchange with PKCE
2. **API Data Fetch** → Background worker fetches heart rate, SpO2, sleep data
3. **Encryption** → All data encrypted before browser storage
4. **Temporal Alignment** → Match Fitbit timestamps with CPAP sessions
5. **Correlation Analysis** → Statistical computations in analytics worker
6. **Visualization** → Results rendered in Plotly charts

## OAuth Implementation

sessionStorage.setItem('fitbit_pkce_verifier', codeVerifier);
sessionStorage.removeItem('fitbit_pkce_verifier');

### OAuth State & Passphrase Restoration: sessionStorage with localStorage backup

**Critical Design Decision**: Both OAuth state and the user's encryption passphrase are stored in `sessionStorage` for security, with a short-lived `localStorage` backup to survive cross-origin redirects in browsers that clear sessionStorage. After OAuth, the passphrase is restored automatically from sessionStorage or the backup, so users do not need to re-enter it unless storage is cleared or blocked.

**Rationale**:

- **Security-first default**: `sessionStorage` auto-clears on tab close and reduces XSS exposure
- **Cross-redirect resilience**: Some browsers clear sessionStorage during OAuth redirects; a backup prevents "Invalid OAuth state" and lost passphrase
- **Automatic passphrase restoration**: After OAuth, the passphrase is restored automatically from sessionStorage (or localStorage backup if needed), so users do not need to re-enter it after redirect
- **Mitigation**: Backup keys are cleared immediately after validation (success or failure)
- **Alternative considered**: Backend state storage was rejected to maintain local-first architecture

sessionStorage.removeItem('fitbit_pkce_verifier');
sessionStorage.removeItem('oscar_passphrase');
localStorage.removeItem('fitbit_oauth_state_backup');
localStorage.removeItem('fitbit_pkce_verifier_backup');
localStorage.removeItem('oscar_passphrase_backup');

**Implementation:**

```javascript
// During auth initiation
sessionStorage.setItem('fitbit_oauth_state', JSON.stringify(stateData));
sessionStorage.setItem('fitbit_pkce_verifier', codeVerifier);
sessionStorage.setItem('oscar_passphrase', userPassphrase); // Store passphrase for restoration

// Backup for redirect resilience (cleared after callback)
localStorage.setItem('fitbit_oauth_state_backup', JSON.stringify(stateData));
localStorage.setItem('fitbit_pkce_verifier_backup', codeVerifier);
localStorage.setItem('oscar_passphrase_backup', userPassphrase);

// On callback (restore passphrase and state)
const sessionState = sessionStorage.getItem('fitbit_oauth_state');
const backupState = localStorage.getItem('fitbit_oauth_state_backup');
let stateData = sessionState ? JSON.parse(sessionState) : null;
if (!stateData?.value || stateData.value !== receivedState) {
  stateData = backupState ? JSON.parse(backupState) : null;
}
const passphrase =
  sessionStorage.getItem('oscar_passphrase') ||
  localStorage.getItem('oscar_passphrase_backup');
if (!stateData?.value || stateData.value !== receivedState) {
  throw new Error('OAuth state mismatch - possible CSRF attack');
}
if (!passphrase) {
  throw new Error(
    'Passphrase missing after OAuth redirect. Check sessionStorage/localStorage.',
  );
}

// Clean up immediately after validation
sessionStorage.removeItem('fitbit_oauth_state');
sessionStorage.removeItem('fitbit_pkce_verifier');
sessionStorage.removeItem('oscar_passphrase');
localStorage.removeItem('fitbit_oauth_state_backup');
localStorage.removeItem('fitbit_pkce_verifier_backup');
localStorage.removeItem('oscar_passphrase_backup');
```

**Testing Implications:**

- E2E tests should verify sessionStorage persistence, localStorage fallback, and automatic passphrase restoration after OAuth redirect.
- See [E2E Playwright Cross-Browser Patterns](testing-patterns.md#fitbit-oauth-e2e-cross-browser) for modal and redirect handling.

**Troubleshooting:**

- If users are unexpectedly prompted for their passphrase after OAuth, check that sessionStorage/localStorage are not being cleared or blocked by browser privacy settings or extensions.

## RCA: OAuth Passphrase Restoration (Permanent Record)

### Symptom

- After successful Fitbit OAuth, app remained 'Not connected' due to passphrase removal before connection check.

### Root Cause

- Passphrase was removed from sessionStorage before connection/data hooks could use it to decrypt tokens and update state.

### Resolution

- Passphrase is now restored automatically after OAuth, and connection/data hooks re-check state before cleanup.

### See also

- [User Guide: Troubleshooting](../user/11-fitbit-integration.md#troubleshooting)

## E2E Playwright Cross-Browser Patterns (Permanent Record)

### Modal Dismissal (WebKit)

- WebKit requires explicit CSS and timing for modal dismissal. See [fitbit-oauth-e2e-cross-browser.md] for workaround patterns.

### Async Navigation & OAuth Redirects

- Use `waitForRequest` and `waitForURL` to ensure navigation completes after OAuth.

### Console Error Capture

- Capture both `console.error` and `pageerror` to assert no "Invalid OAuth state" errors.

### Route Interception

- Intercept Fitbit endpoints and simulate 404 for `/oauth-callback` to match GitHub Pages behavior.

### Coordination

- Patterns promoted from temporary docs in `docs/work/testing/fitbit-oauth-e2e-cross-browser.md`.

### IndexedDB Schema Alignment (Sessions + Fitbit)

Fitbit tokens and OSCAR sessions share the same IndexedDB database (`oscar_app`). To avoid upgrade deadlocks and missing object stores, the session storage helper uses the Fitbit-aware initializer so schema upgrades happen once and all stores are created together.

- **Session storage**: uses the shared DB initializer to ensure version 2 schema and Fitbit stores are available.
- **Fitbit storage**: assumes `fitbit_tokens`, `fitbit_data`, and `sync_metadata` stores exist.
- **Testing**: when seeding IndexedDB in E2E tests, create all Fitbit stores alongside `sessions` to avoid `NotFoundError`.

### PKCE Security Pattern

The OAuth implementation uses PKCE (Proof Key for Code Exchange) to prevent authorization code interception:

```javascript
// src/features/fitbit/services/fitbitApi.js
class FitbitOAuth {
  constructor() {
    this.clientId = import.meta.env.VITE_FITBIT_CLIENT_ID;
    this.redirectUri = `${window.location.origin}/oauth/fitbit/callback`;
    this.scopes = ['heartrate', 'sleep', 'oxygen_saturation'];
  }

  async initiateAuth() {
    // Generate cryptographically secure PKCE parameters
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);

    // Store verifier securely in sessionStorage with a localStorage backup
    sessionStorage.setItem('fitbit_pkce_verifier', codeVerifier);
    localStorage.setItem('fitbit_pkce_verifier_backup', codeVerifier);

    const authUrl = new URL('https://www.fitbit.com/oauth2/authorize');
    authUrl.searchParams.set('client_id', this.clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('scope', this.scopes.join(' '));
    authUrl.searchParams.set('redirect_uri', this.redirectUri);

    // Redirect to Fitbit authorization server
    window.location.href = authUrl.toString();
  }

  generateCodeVerifier() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  async generateCodeChallenge(verifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }
}
```

### Token Management

```javascript
// Token exchange and secure storage
async handleAuthCallback(authorizationCode) {
  const codeVerifier =
    sessionStorage.getItem('fitbit_pkce_verifier') ||
    localStorage.getItem('fitbit_pkce_verifier_backup');
  if (!codeVerifier) {
    throw new Error('PKCE verification failed - potential security issue');
  }

  try {
    // Exchange authorization code for tokens
    const response = await fetch('https://api.fitbit.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(this.clientId + ':')}`
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        grant_type: 'authorization_code',
        code: authorizationCode,
        code_verifier: codeVerifier
      })
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.status}`);
    }

    const tokens = await response.json();

    // Encrypt and store tokens
    await this.secureTokenStorage.store(tokens);

    return tokens;
  } finally {
    // Always clean up PKCE verifier
    sessionStorage.removeItem('fitbit_pkce_verifier');
    localStorage.removeItem('fitbit_pkce_verifier_backup');
  }
}
```

## API Integration

### Background Worker Pattern

All Fitbit API calls run in a dedicated Web Worker to prevent main thread blocking:

```javascript
// src/features/fitbit/workers/fitbitApi.worker.js
class FitbitApiWorker {
  constructor() {
    this.baseUrl = 'https://api.fitbit.com/1/user/-';
  }

  async fetchHeartRateData(accessToken, startDate, endDate) {
    const dates = this.generateDateRange(startDate, endDate);
    const results = [];

    // Batch requests to respect rate limits
    for (const batch of this.chunk(dates, 5)) {
      const batchPromises = batch.map((date) =>
        this.fetchHeartRateForDate(accessToken, date),
      );

      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults);

      // Rate limiting: 150 requests/hour
      await this.sleep(250); // 250ms between batches

      // Post progress update
      self.postMessage({
        type: 'progress',
        completed: results.length,
        total: dates.length,
      });
    }

    return results;
  }

  async fetchHeartRateForDate(accessToken, date) {
    const response = await fetch(
      `${this.baseUrl}/activities/heart/date/${date}/1d/1min.json`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired - signal for refresh
        self.postMessage({ type: 'token-expired' });
        return null;
      }
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    return {
      date,
      data: data['activities-heart-intraday']?.dataset || [],
    };
  }
}

// Initialize worker
const worker = new FitbitApiWorker();

self.onmessage = async (e) => {
  try {
    switch (e.data.type) {
      case 'fetch-heartrate':
        const hrData = await worker.fetchHeartRateData(
          e.data.accessToken,
          e.data.startDate,
          e.data.endDate,
        );
        self.postMessage({ type: 'heartrate-data', data: hrData });
        break;

      // Additional API endpoints...
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error.message,
    });
  }
};
```

### API Rate Limiting

Fitbit API has strict rate limits:

- **Personal**: 150 requests/hour
- **Intraday data**: Additional restrictions
- **Batch optimization**: Group requests efficiently

```javascript
class RateLimiter {
  constructor(requestsPerHour = 150) {
    this.requestsPerHour = requestsPerHour;
    this.requests = [];
  }

  async throttle() {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    // Clean old requests
    this.requests = this.requests.filter((time) => time > oneHourAgo);

    if (this.requests.length >= this.requestsPerHour) {
      const oldestRequest = Math.min(...this.requests);
      const waitTime = oldestRequest + 60 * 60 * 1000 - now;
      await this.sleep(waitTime);
    }

    this.requests.push(now);
  }
}
```

## Data Processing

### Temporal Alignment

Matching Fitbit data with CPAP sessions requires careful timestamp handling:

```javascript
// src/features/fitbit/services/correlationEngine.js
class TemporalAligner {
  alignFitbitWithCpap(cpapSessions, fitbitData) {
    return cpapSessions.map((session) => {
      const sessionDate = session.date;
      const sessionStart = session.startTime;
      const sessionEnd = session.endTime;

      // Find overlapping Fitbit data
      const fitbitNight = fitbitData.find(
        (f) => f.date === sessionDate || this.isOverlappingNight(f, session),
      );

      if (!fitbitNight) return { ...session, fitbit: null };

      // Extract sleep period heart rate data
      const hrDuringSession = this.extractTimeRange(
        fitbitNight.heartRate,
        sessionStart,
        sessionEnd,
      );

      return {
        ...session,
        fitbit: {
          heartRate: hrDuringSession,
          hrv: this.calculateHRV(hrDuringSession),
          avgSpO2: fitbitNight.spO2?.average,
          sleepStages: fitbitNight.sleep?.stages,
        },
      };
    });
  }

  calculateHRV(heartRateData) {
    if (!heartRateData || heartRateData.length < 50) return null;

    // Calculate RMSSD (Root Mean Square of Successive Differences)
    const intervals = [];
    for (let i = 1; i < heartRateData.length; i++) {
      const diff = heartRateData[i].value - heartRateData[i - 1].value;
      intervals.push(diff * diff);
    }

    const meanSquaredDiff =
      intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    return Math.sqrt(meanSquaredDiff);
  }
}
```

### Statistical Analysis

Correlation computations run in dedicated analytics worker:

```javascript
// src/features/fitbit/workers/correlation.worker.js
class CorrelationAnalytics {
  calculateCorrelations(cpapFitbitData) {
    const metrics = this.extractMetrics(cpapFitbitData);
    const correlations = {};

    // Pearson correlations for linear relationships
    correlations.pearson = this.pearsonMatrix(metrics);

    // Spearman for monotonic (handles outliers better)
    correlations.spearman = this.spearmanMatrix(metrics);

    // Statistical significance tests
    correlations.pValues = this.significanceTests(metrics);

    // Effect sizes (clinical significance)
    correlations.effectSizes = this.cohensD(metrics);

    return correlations;
  }

  pearsonMatrix(metrics) {
    const keys = Object.keys(metrics);
    const matrix = {};

    for (const key1 of keys) {
      matrix[key1] = {};
      for (const key2 of keys) {
        matrix[key1][key2] = this.pearsonCorrelation(
          metrics[key1],
          metrics[key2],
        );
      }
    }

    return matrix;
  }

  pearsonCorrelation(x, y) {
    const n = Math.min(x.length, y.length);
    if (n < 3) return null; // Insufficient data

    const sumX = x.slice(0, n).reduce((a, b) => a + b, 0);
    const sumY = y.slice(0, n).reduce((a, b) => a + b, 0);
    const sumXY = x.slice(0, n).reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.slice(0, n).reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.slice(0, n).reduce((sum, yi) => sum + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt(
      (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY),
    );

    return denominator === 0 ? 0 : numerator / denominator;
  }
}
```

## Security Implementation

### Encryption Strategy

All Fitbit data uses the same AES-GCM encryption as CPAP data:

```javascript
// src/features/fitbit/services/encryption.js
import { encryptData, decryptData } from '../../../utils/encryption.js';

class FitbitDataSecurity {
  async encryptFitbitData(data, userPassphrase) {
    // Serialize complex objects for encryption
    const serialized = JSON.stringify(data, this.dateReplacer);

    // Use same encryption as CPAP data
    return await encryptData(serialized, userPassphrase);
  }

  async decryptFitbitData(encryptedPackage, userPassphrase) {
    const decrypted = await decryptData(encryptedPackage, userPassphrase);
    return JSON.parse(decrypted, this.dateReviver);
  }

  // Handle Date serialization/deserialization
  dateReplacer(key, value) {
    if (value instanceof Date) {
      return { __type: 'Date', __value: value.toISOString() };
    }
    return value;
  }

  dateReviver(key, value) {
    if (value && value.__type === 'Date') {
      return new Date(value.__value);
    }
    return value;
  }
}

// Token encryption with automatic expiration
class SecureTokenStorage {
  async storeTokens(tokens, passphrase) {
    const tokenData = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Date.now() + tokens.expires_in * 1000,
      scope: tokens.scope,
      user_id: tokens.user_id,
    };

    const encrypted = await encryptData(tokenData, passphrase);

    await this.db.fitbitTokens.put({
      id: 'current',
      ...encrypted,
      metadata: {
        created_at: Date.now(),
        expires_at: tokenData.expires_at,
      },
    });
  }

  async getValidAccessToken(passphrase) {
    const record = await this.db.fitbitTokens.get('current');
    if (!record) return null;

    const tokenData = await decryptData(record, passphrase);

    // Check expiration
    if (Date.now() >= tokenData.expires_at) {
      return this.refreshToken(tokenData.refresh_token, passphrase);
    }

    return tokenData.access_token;
  }
}
```

## Testing Patterns

### OAuth Flow Testing

```javascript
// src/features/fitbit/components/__tests__/FitbitAuth.test.jsx
import { vi, describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FitbitConnectionCard from '../FitbitConnectionCard.jsx';

describe('FitbitConnectionCard', () => {
  it('initiates OAuth flow with PKCE', async () => {
    const mockInitiateAuth = vi.fn();

    render(
      <FitbitConnectionCard
        connectionStatus="disconnected"
        onConnect={mockInitiateAuth}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /connect to fitbit/i }));

    expect(mockInitiateAuth).toHaveBeenCalledWith({
      pkce: true,
      scopes: ['heartrate', 'sleep', 'oxygen_saturation'],
    });
  });

  it('handles OAuth callback errors gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <FitbitConnectionCard
        connectionStatus="error"
        error="Authorization failed"
      />,
    );

    expect(screen.getByText(/authorization failed/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /try again/i }),
    ).toBeInTheDocument();
  });
});
```

### Worker Testing

```javascript
// src/features/fitbit/workers/__tests__/fitbitApi.worker.test.js
import { describe, it, expect, vi } from 'vitest';

describe('Fitbit API Worker', () => {
  it('handles rate limiting correctly', async () => {
    const worker = await import('../fitbitApi.worker.js');

    // Mock fetch to simulate rate limiting
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => ({ data: 'batch1' }) })
      .mockRejectedValueOnce({ status: 429 }) // Rate limited
      .mockResolvedValueOnce({ ok: true, json: () => ({ data: 'batch2' }) });

    const results = await worker.fetchWithRateLimit([
      '/endpoint1',
      '/endpoint2',
      '/endpoint3',
    ]);

    expect(results).toHaveLength(3);
    expect(results[1]).toBeNull(); // Rate limited request
  });
});
```

### Correlation Engine Testing

```javascript
// src/features/fitbit/services/__tests__/correlationEngine.test.js
import { describe, it, expect } from 'vitest';
import {
  buildCpapSession,
  buildFitbitData,
} from '../../../test-utils/builders.js';
import CorrelationEngine from '../correlationEngine.js';

describe('CorrelationEngine', () => {
  it('calculates Pearson correlation correctly', () => {
    const engine = new CorrelationEngine();

    // Perfect positive correlation
    const x = [1, 2, 3, 4, 5];
    const y = [2, 4, 6, 8, 10];

    const correlation = engine.pearsonCorrelation(x, y);
    expect(correlation).toBeCloseTo(1.0, 5);
  });

  it('handles missing data gracefully', () => {
    const engine = new CorrelationEngine();
    const sessions = [
      buildCpapSession({ ahi: 5.2, fitbitHrv: 24.1 }),
      buildCpapSession({ ahi: 8.7, fitbitHrv: null }), // Missing Fitbit
      buildCpapSession({ ahi: 3.1, fitbitHrv: 31.5 }),
    ];

    const correlations = engine.calculateCorrelations(sessions);

    // Should use only complete pairs
    expect(correlations.n).toBe(2);
    expect(correlations.ahiHrvCorrelation).toBeDefined();
  });
});
```

## Performance Considerations

### Memory Management

- **Large datasets**: 100+ nights of minute-level heart rate data can exceed 50MB
- **Streaming processing**: Process data in chunks to avoid memory spikes
- **Web Worker isolation**: Heavy computations don't block main thread
- **Cleanup**: Dispose of unused data when switching date ranges

### Optimization Strategies

```javascript
class FitbitDataOptimizer {
  // Downsample high-frequency data for overview visualizations
  downsampleHeartRate(data, targetPoints = 1000) {
    if (data.length <= targetPoints) return data;

    const step = Math.floor(data.length / targetPoints);
    const downsampled = [];

    for (let i = 0; i < data.length; i += step) {
      const chunk = data.slice(i, i + step);
      downsampled.push({
        time: chunk[0].time,
        value: chunk.reduce((sum, pt) => sum + pt.value, 0) / chunk.length,
      });
    }

    return downsampled;
  }

  // Cache expensive correlation computations
  async getCachedCorrelations(dataHash, computeFunc) {
    const cacheKey = `correlations_${dataHash}`;
    const cached = sessionStorage.getItem(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const results = await computeFunc();
    sessionStorage.setItem(cacheKey, JSON.stringify(results));
    return results;
  }
}
```

### API Efficiency

- **Batch requests**: Multiple dates in single API call where possible
- **Incremental sync**: Only fetch new data, not full re-sync
- **Background refresh**: Update data in background without blocking UI
- **Error recovery**: Graceful handling of network issues and rate limits

---

**Next Steps:**

- [Testing Patterns](testing-patterns.md) – General testing guidelines
- [Security Implementation](../architecture.md#security) – Encryption and data protection
- [API Documentation](fitbit-api-reference.md) – Complete API endpoint reference
