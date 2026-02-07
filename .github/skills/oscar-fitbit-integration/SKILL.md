---
name: oscar-fitbit-integration
description: Fitbit OAuth integration patterns including PKCE flow, encrypted token storage, API worker communication, and correlation analytics. Use when working on Fitbit features or debugging OAuth issues.
---

# OSCAR Fitbit Integration

OSCAR Export Analyzer integrates with Fitbit Web API to correlate CPAP therapy data with heart rate, SpO2, and sleep stage data. This skill documents the OAuth flow, encryption, API communication, and correlation analytics.

## OAuth 2.0 with PKCE Flow

### Overview

Fitbit integration uses OAuth 2.0 Authorization Code flow with PKCE (Proof Key for Code Exchange) for enhanced security.

**Flow steps:**

1. User clicks "Connect Fitbit"
2. App generates code verifier and challenge (PKCE)
3. User redirected to Fitbit authorization page
4. User approves, Fitbit redirects back with authorization code
5. App exchanges code for access/refresh tokens using PKCE verifier
6. Tokens encrypted and stored locally

### PKCE Implementation

```javascript
// Generate PKCE challenge
class FitbitOAuth {
  generateCodeVerifier() {
    // 128-character random string
    const array = new Uint8Array(96);
    crypto.getRandomValues(array);
    return this.base64URLEncode(array);
  }

  async generateCodeChallenge(verifier) {
    // SHA-256 hash of verifier
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return this.base64URLEncode(new Uint8Array(hash));
  }

  base64URLEncode(buffer) {
    return btoa(String.fromCharCode(...buffer))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  async initiateAuth() {
    // Generate PKCE parameters
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);

    // Store verifier for later token exchange
    localStorage.setItem('fitbit_pkce_verifier', codeVerifier);

    // Build authorization URL
    const authUrl = new URL('https://www.fitbit.com/oauth2/authorize');
    authUrl.searchParams.set('client_id', FITBIT_CLIENT_ID);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.set('scope', 'heartrate oxygen_saturation sleep');

    // Redirect to Fitbit
    window.location.href = authUrl.toString();
  }
}
```

### Token Exchange

```javascript
async exchangeCodeForTokens(authorizationCode) {
  // Retrieve PKCE verifier
  const codeVerifier = localStorage.getItem('fitbit_pkce_verifier');
  
  if (!codeVerifier) {
    throw new Error('PKCE verifier not found');
  }

  // Exchange code for tokens
  const response = await fetch('https://api.fitbit.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: FITBIT_CLIENT_ID,
      code: authorizationCode,
      code_verifier: codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
    }),
  });

  const tokens = await response.json();

  // Clean up verifier
  localStorage.removeItem('fitbit_pkce_verifier');

  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_in: tokens.expires_in,
  };
}
```

## Passphrase Security Model

### Storage Strategy

**User passphrase** encrypts Fitbit tokens and is stored temporarily:

- **Primary storage:** `sessionStorage` (cleared when tab closes)
- **Backup storage:** `localStorage` (short-lived, for OAuth redirect only)
- **Never persisted:** Not written to disk, cookies, or IndexedDB without encryption

```javascript
class PassphraseManager {
  storePassphrase(passphrase) {
    // Primary: session storage (cleared on tab close)
    sessionStorage.setItem('fitbitPassphrase', passphrase);

    // Backup: local storage (for OAuth redirect recovery)
    localStorage.setItem('fitbitPassphraseBak', passphrase);

    // Clear backup after 5 minutes
    setTimeout(() => {
      localStorage.removeItem('fitbitPassphraseBak');
    }, 5 * 60 * 1000);
  }

  retrievePassphrase() {
    // Try session storage first
    let passphrase = sessionStorage.getItem('fitbitPassphrase');

    // Fall back to local storage if session cleared
    if (!passphrase) {
      passphrase = localStorage.getItem('fitbitPassphraseBak');

      if (passphrase) {
        // Restore to session storage
        sessionStorage.setItem('fitbitPassphrase', passphrase);
        // Clear backup
        localStorage.removeItem('fitbitPassphraseBak');
      }
    }

    return passphrase;
  }

  clearPassphrase() {
    sessionStorage.removeItem('fitbitPassphrase');
    localStorage.removeItem('fitbitPassphraseBak');
  }
}
```

### OAuth Redirect Flow

```javascript
// Before OAuth redirect
function initiateOAuth() {
  // Store passphrase for post-redirect recovery
  passphraseManager.storePassphrase(userPassphrase);

  // Store CPAP data state (encrypted)
  const encryptedState = await encryptData(cpapSessions, userPassphrase);
  sessionStorage.setItem('cpapState', JSON.stringify(encryptedState));

  // Redirect to Fitbit OAuth
  oauth.initiateAuth();
}

// After OAuth callback
function handleOAuthCallback(code) {
  // Retrieve passphrase
  const passphrase = passphraseManager.retrievePassphrase();

  if (!passphrase) {
    // Passphrase lost, prompt user to re-enter
    promptForPassphrase();
    return;
  }

  // Restore CPAP data state
  const encryptedState = sessionStorage.getItem('cpapState');
  const cpapSessions = await decryptData(encryptedState, passphrase);

  // Exchange code for tokens
  const tokens = await oauth.exchangeCodeForTokens(code);

  // Encrypt and store tokens
  const encryptedTokens = await encryptData(tokens, passphrase);
  await db.fitbitTokens.put(encryptedTokens);
}
```

## Encryption Patterns

### AES-GCM with PBKDF2 Key Derivation

```javascript
async function encryptData(data, passphrase) {
  // Derive key from passphrase
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  // Encrypt data
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    new TextEncoder().encode(JSON.stringify(data))
  );

  // Return encrypted data with salt and IV
  return {
    encrypted: Array.from(new Uint8Array(encrypted)),
    salt: Array.from(salt),
    iv: Array.from(iv),
  };
}

async function decryptData(encryptedData, passphrase) {
  // Derive same key from passphrase
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new Uint8Array(encryptedData.salt),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  // Decrypt data
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(encryptedData.iv) },
    key,
    new Uint8Array(encryptedData.encrypted)
  );

  return JSON.parse(new TextDecoder().decode(decrypted));
}
```

## Fitbit API Worker

### Worker Architecture

Heavy Fitbit API operations run in a dedicated worker to avoid blocking UI:

```javascript
// src/workers/fitbitApi.worker.js
self.onmessage = async (event) => {
  const { type, data } = event.data;

  try {
    switch (type) {
      case 'fetchHeartRate':
        const hrData = await fetchHeartRateData(data.accessToken, data.date);
        self.postMessage({ type: 'success', data: hrData });
        break;

      case 'fetchSleepStages':
        const sleepData = await fetchSleepData(data.accessToken, data.date);
        self.postMessage({ type: 'success', data: sleepData });
        break;

      case 'refreshToken':
        const newTokens = await refreshAccessToken(data.refreshToken);
        self.postMessage({ type: 'tokenRefreshed', data: newTokens });
        break;

      default:
        throw new Error(`Unknown action: ${type}`);
    }
  } catch (error) {
    self.postMessage({ type: 'error', error: error.message });
  }
};

async function fetchHeartRateData(accessToken, date) {
  const response = await fetch(
    `https://api.fitbit.com/1/user/-/activities/heart/date/${date}/1d/1min.json`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Fitbit API error: ${response.status}`);
  }

  return response.json();
}
```

### Token Refresh

```javascript
async function refreshAccessToken(refreshToken) {
  const response = await fetch('https://api.fitbit.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: FITBIT_CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  const tokens = await response.json();

  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_in: tokens.expires_in,
  };
}
```

## Correlation Analytics

### CPAP + Fitbit Data Alignment

```javascript
function correlateCpapFitbit(cpapSessions, fitbitData) {
  // Align by date
  const aligned = cpapSessions.map((session) => {
    const sessionDate = session.date;

    // Find matching Fitbit data
    const hrData = fitbitData.heartRate.filter((hr) => hr.date === sessionDate);
    const sleepData = fitbitData.sleep.find((s) => s.date === sessionDate);

    return {
      date: sessionDate,
      cpap: {
        ahi: session.ahi,
        epap: session.epap,
        usage: session.usage,
      },
      fitbit: {
        avgHeartRate: hrData.length > 0 ? mean(hrData.map((h) => h.bpm)) : null,
        sleepScore: sleepData?.score || null,
        deepSleepMinutes: sleepData?.stages?.deep || null,
      },
    };
  });

  return aligned;
}
```

### Statistical Correlation

```javascript
function calculateCorrelations(alignedData) {
  // Filter valid pairs
  const pairs = alignedData
    .filter((d) => d.cpap.ahi !== null && d.fitbit.avgHeartRate !== null)
    .map((d) => [d.cpap.ahi, d.fitbit.avgHeartRate]);

  // Pearson correlation
  const correlation = pearsonCorrelation(pairs);

  return {
    ahiVsHeartRate: {
      r: correlation,
      rSquared: correlation ** 2,
      pValue: calculatePValue(correlation, pairs.length),
      interpretation: interpretCorrelation(correlation),
    },
  };
}
```

## Error Handling

### API Rate Limits

```javascript
class FitbitAPIClient {
  constructor() {
    this.requestQueue = [];
    this.isRateLimited = false;
  }

  async makeRequest(url, options) {
    if (this.isRateLimited) {
      // Wait for rate limit to clear
      await this.waitForRateLimit();
    }

    try {
      const response = await fetch(url, options);

      if (response.status === 429) {
        // Rate limited
        const retryAfter = response.headers.get('Retry-After');
        this.isRateLimited = true;
        setTimeout(() => {
          this.isRateLimited = false;
        }, parseInt(retryAfter) * 1000);

        throw new Error('Rate limited');
      }

      return response;
    } catch (error) {
      throw error;
    }
  }
}
```

### Token Expiration

```javascript
async function makeAuthenticatedRequest(url, accessToken, refreshToken) {
  try {
    // Attempt request
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (response.status === 401) {
      // Token expired, refresh
      const newTokens = await refreshAccessToken(refreshToken);

      // Retry with new token
      return fetch(url, {
        headers: { Authorization: `Bearer ${newTokens.access_token}` },
      });
    }

    return response;
  } catch (error) {
    console.error('Fitbit API error:', error);
    throw error;
  }
}
```

## Testing Patterns

### Mock OAuth Flow

```javascript
// Test OAuth without actual Fitbit redirect
const mockOAuthFlow = {
  initiateAuth: vi.fn(() => {
    return Promise.resolve({ code: 'mock_auth_code' });
  }),

  exchangeTokens: vi.fn(() => {
    return Promise.resolve({
      access_token: 'mock_access_token',
      refresh_token: 'mock_refresh_token',
      expires_in: 3600,
    });
  }),
};
```

### Test Data Builders

```javascript
import { buildFitbitHeartRate, buildFitbitSleepStage } from '../test-utils/fitbitBuilders';

const mockFitbitData = {
  heartRate: [
    buildFitbitHeartRate({ date: '2024-01-15', bpm: 65 }),
    buildFitbitHeartRate({ date: '2024-01-16', bpm: 68 }),
  ],
  sleep: [
    buildFitbitSleepStage({ date: '2024-01-15', level: 'deep', seconds: 3600 }),
  ],
};
```

## Resources

- **Developer docs**: `docs/developer/fitbit-integration.md`
- **Architecture**: `docs/developer/architecture.md` (Fitbit section)
- **Security model**: oscar-privacy-boundaries skill
- **Encryption patterns**: `src/utils/encryption.js`
- **Test builders**: `src/test-utils/fitbitBuilders.js`
- **Fitbit API docs**: https://dev.fitbit.com/build/reference/web-api/
