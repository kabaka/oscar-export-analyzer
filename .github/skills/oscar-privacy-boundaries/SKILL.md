---
name: oscar-privacy-boundaries
description: Privacy and security patterns for handling sensitive OSCAR sleep therapy data. Use when implementing features that process, store, or display patient health information.
---

# OSCAR Privacy Boundaries

OSCAR Export Analyzer processes sensitive Protected Health Information (PHI)—sleep therapy data including AHI values, pressure settings, usage patterns, and medical device data. This skill documents the privacy architecture and security requirements.

## Core Privacy Principle

**Local-First, No Server Uploads**

All data processing happens entirely in the browser. No patient data is ever sent to external servers (except Fitbit OAuth when user explicitly connects).

## Data Handling Rules

### What Never to Log or Commit

**NEVER log to console:**

```javascript
// ❌ NEVER do this
console.log('Parsed sessions:', sessions);
console.log(`AHI value: ${ahi}`);
console.log('CSV content:', csvData);

// ✅ Safe: log metadata only
console.log(`Parsed ${sessions.length} sessions`);
console.log('AHI calculation complete');
console.log('CSV parsing succeeded');
```

**NEVER commit to git:**

- Real OSCAR CSV exports (even in test files)
- Screenshots containing real patient data
- Example data excerpts from actual exports
- Hardcoded AHI/EPAP/leak values from real sessions
- Any dates/timestamps that could identify patients

**Safe to log/commit:**

- Row counts, column names, parsing metadata
- Synthetic test data (using builders)
- Algorithm descriptions without specific values
- Statistical method names (Mann-Whitney U, etc.)
- Chart type selections, UI interactions

### Data Storage Rules

**IndexedDB Persistence:**

```javascript
// User must explicitly opt-in to data persistence
if (userConsentToStore) {
  // Encrypt data before storing
  const encrypted = await encryptData(sessions, userPassphrase);
  await db.sessions.put(encrypted);
} else {
  // Data lives only in memory, cleared on refresh
  sessionStorage.setItem('tempData', JSON.stringify(sessions));
}
```

**Default behavior:**

- CSV upload → parse → render → **data not persisted**
- User can choose "Save data" → consent dialog → encrypted IndexedDB
- On page refresh: data lost unless user saved it

**Consent Requirements:**

```javascript
// Show clear warning before enabling persistence
if (!hasShownDataWarning) {
  showModal({
    title: 'Save Data Locally?',
    message:
      'Your sleep therapy data will be encrypted and stored in your browser. ' +
      'This data never leaves your device. You can delete it anytime.',
    actions: ['Save and Remember', 'Use Without Saving'],
  });
}
```

### Web Worker Security

**Worker message sanitization:**

```javascript
// CSV parser worker
self.onmessage = (event) => {
  try {
    const { csvText } = event.data;
    const parsed = parseCSV(csvText);

    // ✅ Send back parsed data (necessary for functionality)
    self.postMessage({ type: 'success', data: parsed });
  } catch (error) {
    // ❌ Don't include CSV excerpts in error messages
    // self.postMessage({ type: 'error', message: error.message, csvExcerpt: csvText });

    // ✅ Sanitize error messages
    self.postMessage({
      type: 'error',
      message: 'Failed to parse CSV',
      details: error.name,
    });
  }
};
```

**Worker data cleanup:**

- Clear worker messages after processing
- Don't keep CSV text in worker memory
- Terminate workers when not in use

### Export and Print Security

**PDF/Print includes only user-selected data:**

```javascript
// User can select date range for export
const exportData = filterByDateRange(sessions, startDate, endDate);

// ✅ Export warning
showExportDialog({
  message: `This will export ${exportData.length} nights of data. ` +
    'Ensure you keep exported files secure.',
});
```

**Print stylesheet considerations:**

- Redact sensitive info in print preview if needed
- Allow user to preview before printing
- Warn about physical security of printed reports

### Error Messages

**Sanitize errors before displaying:**

```javascript
// ❌ Exposes data
throw new Error(`Invalid AHI value: ${ahi} on date ${date}`);

// ✅ Generic with no PHI
throw new Error('Invalid AHI value detected');

// ✅ Safe metadata
throw new Error(`Invalid data format at row ${rowNumber}`);
```

### Test Data Requirements

**Use synthetic data exclusively:**

```javascript
// ✅ Use builders
import { buildSession } from '../test-utils/builders';

const testData = [
  buildSession({ ahi: 8.5, date: '2024-01-15' }),
  buildSession({ ahi: 12.3, date: '2024-01-16' }),
];

// ❌ NEVER hardcode real examples
const testData = [
  { date: '2023-07-15', ahi: 42.3 }, // This might be real data!
];
```

## Fitbit Integration Privacy

**OAuth token security:**

```javascript
// Tokens encrypted before storage
const encryptedTokens = await encryptWithPassphrase(tokens, userPassphrase);
await db.fitbitTokens.put(encryptedTokens);

// Passphrase stored in sessionStorage only (cleared on tab close)
sessionStorage.setItem('fitbitPassphrase', passphrase);

// Short-lived backup in localStorage for OAuth redirect
localStorage.setItem('fitbitPassphraseBak', passphrase);
// Cleared immediately after OAuth callback
```

**API call limitations:**

- Read-only scopes (heart rate, sleep, SpO2)
- No write permissions
- Minimal data retention (rolling 30-day window)
- User can disconnect anytime

**Network requests:**

- Only to Fitbit API (explicit user action)
- No analytics, tracking, or telemetry
- No CDN dependencies with user data

## Security Checklist for Features

When implementing new features, verify:

- [ ] No PHI logged to console (only metadata)
- [ ] No hardcoded real patient data in examples
- [ ] CSV upload doesn't auto-persist (user opt-in)
- [ ] Export/print shows only user-selected data
- [ ] Error messages don't include sensitive values
- [ ] Web Worker errors sanitized
- [ ] Test data uses builders, not real examples
- [ ] IndexedDB writes encrypted if storing PHI
- [ ] No network requests to non-Fitbit endpoints

## Data Lifecycle

```
[CSV Upload]
    ↓
[Parse in Worker] ← No logging of content
    ↓
[Memory (not persisted)] ← Default
    ↓
[User chooses: Save or Discard]
    ↓
[If Save: Encrypt → IndexedDB]
[If Discard: cleared on refresh]
    ↓
[User can delete anytime]
```

## Threat Models

**Primary threats:**

1. **Accidental console logging** during development
2. **Test data committed** that contains real values
3. **CSV export left on disk** in insecure location
4. **Worker error messages** exposing CSV excerpts
5. **Print preview** visible to others

**Mitigations:**

- Code review checks for console.log(PHI)
- Test data always synthetic
- Export warnings before generating files
- Error message sanitization
- Print confirmation dialogs

## Resources

- **Encryption utilities**: `src/utils/encryption.js`
- **Data context**: `src/context/DataContext.jsx`
- **Test builders**: `src/test-utils/builders.js`
- **Fitbit security model**: `docs/developer/fitbit-integration.md`
