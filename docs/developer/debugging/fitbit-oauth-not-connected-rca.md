# RCA: Fitbit OAuth 'Not Connected' After Successful OAuth Flow

## Symptom

After completing Fitbit OAuth (tokens present in IndexedDB, console logs 'OAuth connection successful'), the Fitbit section of the app still shows 'Not connected', prompts for passphrase, and does not display Fitbit data or charts.

## Timeline

- User completes OAuth flow, redirected back to app
- Console logs indicate OAuth success
- IndexedDB contains tokens
- UI remains in 'Not connected' state, passphrase prompt shown, no Fitbit data visible

## Investigation

### 1. Token Storage & OAuth Success

- `fitbitAuth.js` and `fitbitDb.js` confirm tokens are securely stored in IndexedDB (`fitbit_tokens` store, key 'current') after OAuth.
- `useFitbitOAuth` and `useFitbitConnection` both rely on a passphrase to decrypt tokens and check connection status.

### 2. Connection State Logic

- `useFitbitConnection` (see [src/hooks/useFitbitConnection.js](../../src/hooks/useFitbitConnection.js))
  - On mount or passphrase change, runs `checkIfTokens()`
  - If `autoCheck` is true and passphrase is present, calls `checkConnection()`
  - If passphrase is missing, attempts to check if tokens exist in IndexedDB, but only calls `checkConnection()` if tokens are found
  - `checkConnection()` requires a passphrase to decrypt tokens; if missing, sets status to DISCONNECTED

### 3. UI State & Passphrase Prompt

- `FitbitConnectionCard` (see [src/components/FitbitConnectionCard.jsx](../../src/components/FitbitConnectionCard.jsx))
  - If not connected, renders passphrase input
  - Only attempts connection if passphrase is provided and at least 8 chars
  - After OAuth, tries to restore passphrase from `sessionStorage`, but if not found, user must re-enter

### 4. Root Cause

The app requires the user's encryption passphrase to decrypt and use the stored Fitbit tokens. After OAuth, if the passphrase is not present in memory or sessionStorage, the app cannot auto-connect, even if tokens are present in IndexedDB. The UI remains in 'Not connected' state and prompts for the passphrase, because the connection logic cannot proceed without it. This is a security design: tokens are encrypted with the passphrase, which is never persisted beyond sessionStorage for security.

### 5. Evidence

- `useFitbitConnection.js`: passphrase is set from prop or sessionStorage, but if missing, connection cannot be established
- `useFitbitConnection.js`: auto-check only works if passphrase is present or user enters it
- `FitbitConnectionCard.jsx`: passphrase input shown if not connected

## Recommendation

- User must re-enter their passphrase after OAuth redirect to unlock tokens and connect.
- If a better UX is desired, consider a secure mechanism to persist the passphrase for the session (e.g., sessionStorage) and ensure it is restored after OAuth redirect.
- Alternatively, prompt the user to re-enter the passphrase immediately after OAuth, with clear messaging.
- Do NOT persist the passphrase long-term for security reasons.

## Preventive Suggestions

- Add a clear message after OAuth redirect: "Please re-enter your passphrase to complete Fitbit connection."
- Optionally, improve sessionStorage handling to restore the passphrase if possible.
- Document this flow in user-facing help and onboarding.

---

**RCA by @debugger-rca-analyst, 2026-01-28**
