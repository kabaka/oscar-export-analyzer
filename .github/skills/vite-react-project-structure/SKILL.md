---
name: vite-react-project-structure
description: File organization and naming conventions for Vite + React projects. Use when creating new components, hooks, utilities, or organizing feature modules.
---

# Vite + React Project Structure

This skill documents the file organization and naming conventions for the OSCAR Export Analyzer codebase, which follows Vite + React best practices.

## Directory Structure

```
src/
├── components/          # All React components (.jsx)
│   ├── charts/         # Chart components grouped by feature
│   ├── fitbit/         # Fitbit-related components grouped
│   ├── ComponentName.jsx
│   └── ComponentName.test.jsx
├── hooks/              # All custom React hooks (.js)
│   ├── hookName.js
│   └── hookName.test.js
├── utils/              # Utility functions (.js)
│   ├── utilName.js
│   └── utilName.test.js
├── workers/            # Web Worker files (.js)
│   └── workerName.js
├── context/            # React Context providers (.js)
│   └── ContextName.jsx
├── constants/          # Constant definitions (.js)
│   └── constantsName.js
├── features/           # Feature modules (complex features)
│   └── featureName/
│       ├── components/
│       ├── hooks/
│       └── utils/
├── test-utils/         # Shared test utilities
│   ├── builders.js
│   ├── mockHooks.js
│   └── fixtures/
├── app/                # App-level components
│   ├── AppProviders.jsx
│   └── AppShell.jsx
├── App.jsx             # Main application component
├── main.jsx            # Entry point
└── setupTests.js       # Test configuration
```

## Naming Conventions

### Components

**Files:**

- PascalCase: `UsagePatternsCharts.jsx`
- Test files: `UsagePatternsCharts.test.jsx`
- Use `.jsx` extension for files containing JSX

**Examples:**

```
src/components/
├── DateRangeControls.jsx
├── DateRangeControls.test.jsx
├── ExportDataModal.jsx
├── ExportDataModal.test.jsx
├── charts/
│   ├── UsagePatternsCharts.jsx
│   ├── UsagePatternsCharts.test.jsx
│   ├── AhiTrendsCharts.jsx
│   └── AhiTrendsCharts.test.jsx
└── fitbit/
    ├── FitbitConnection.jsx
    ├── FitbitConnection.test.jsx
    ├── FitbitCharts.jsx
    └── FitbitCharts.test.jsx
```

### Hooks

**Files:**

- camelCase with `use` prefix: `useDateRangeFilter.js`
- Test files: `useDateRangeFilter.test.js`
- Use `.js` extension (hooks typically don't have JSX)

**Examples:**

```
src/hooks/
├── useAppState.js
├── useAppState.test.js
├── useCSVUpload.js
├── useCSVUpload.test.js
├── useDateRangeFilter.js
└── useDateRangeFilter.test.js
```

### Utilities

**Files:**

- camelCase: `dateFilter.js`, `statsCalculations.js`
- Test files: `dateFilter.test.js`
- Group related utilities in single file

**Examples:**

```
src/utils/
├── dateFilter.js
├── dateFilter.test.js
├── statsCalculations.js
├── statsCalculations.test.js
├── csvParsing.js
└── csvParsing.test.js
```

### Constants

**Files:**

- camelCase: `thresholds.js`, `chartConfig.js`
- Constants inside: UPPER_SNAKE_CASE

**Example:**

```javascript
// src/constants/thresholds.js
export const AHI_NORMAL = 5;
export const AHI_MILD = 15;
export const AHI_MODERATE = 30;
export const EPAP_MIN = 4.0;
export const EPAP_MAX = 25.0;
```

### Workers

**Files:**

- camelCase with `.worker.js` suffix: `csvParser.worker.js`
- Vite recognizes `*.worker.js` pattern

**Examples:**

```
src/workers/
├── csvParser.worker.js
├── analytics.worker.js
└── fitbitApi.worker.js
```

## Test Collocation

**Key principle:** Tests live next to the code they test.

```
src/components/UsagePatternsCharts.jsx
src/components/UsagePatternsCharts.test.jsx  ← Same directory

src/hooks/useDateRangeFilter.js
src/hooks/useDateRangeFilter.test.js  ← Same directory

src/utils/dateFilter.js
src/utils/dateFilter.test.js  ← Same directory
```

**Exception:** App-level integration tests can live in `src/tests/` for clarity:

```
src/tests/
├── integration/
│   ├── csvUploadFlow.test.jsx
│   └── chartInteraction.test.jsx
└── e2e/
    ├── fullWorkflow.test.jsx
    └── fitbitIntegration.test.jsx
```

## Feature Modules

Complex features with multiple components can be grouped:

```
src/features/fitbit/
├── components/
│   ├── FitbitConnection.jsx
│   ├── FitbitConnection.test.jsx
│   ├── FitbitCharts.jsx
│   └── FitbitCharts.test.jsx
├── hooks/
│   ├── useFitbitAuth.js
│   ├── useFitbitAuth.test.js
│   ├── useFitbitData.js
│   └── useFitbitData.test.js
├── utils/
│   ├── fitbitEncryption.js
│   └── fitbitEncryption.test.js
└── workers/
    └── fitbitApi.worker.js
```

**When to use feature modules:**

- Feature has 3+ related components
- Feature has dedicated hooks/utilities
- Feature is logically independent
- Examples: Fitbit integration, chart system, clustering analysis

**When NOT to use:**

- Single component or simple utility
- Shared across multiple features
- Core app infrastructure

## Import Patterns

### Relative imports within feature

```javascript
// src/features/fitbit/components/FitbitCharts.jsx
import { useFitbitData } from '../hooks/useFitbitData';
import { encryptToken } from '../utils/fitbitEncryption';
```

### Absolute imports from src root

```javascript
// Any component
import { buildSession } from '@/test-utils/builders'; // if alias configured
import { AHI_NORMAL } from '@/constants/thresholds';

// Or use Vite's relative paths
import { buildSession } from '../../../test-utils/builders';
```

### Import ordering (ESLint rule)

```javascript
// 1. External dependencies
import React, { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';

// 2. Internal modules (absolute imports)
import { useData } from '@/context/DataContext';
import { AHI_NORMAL } from '@/constants/thresholds';

// 3. Relative imports
import { ChartWrapper } from './ChartWrapper';
import './styles.css';
```

## App-Level Organization

### Entry point (`main.jsx`)

```javascript
// Minimal - just bootstrap React
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

### App component (`App.jsx`)

```javascript
// Orchestrates top-level hooks and renders shell
import { AppProviders } from './app/AppProviders';
import { AppShell } from './app/AppShell';

function App() {
  return (
    <AppProviders>
      <AppShell />
    </AppProviders>
  );
}
```

### App providers (`app/AppProviders.jsx`)

```javascript
// Centralizes all context providers
export function AppProviders({ children }) {
  return (
    <DataProvider>
      <ThemeProvider>
        <UserPreferencesProvider>{children}</UserPreferencesProvider>
      </ThemeProvider>
    </DataProvider>
  );
}
```

## File Location Rules

**Components go in `src/components/`:**

- ✅ `src/components/DateRangeControls.jsx`
- ❌ `src/DateRangeControls.jsx` (not in root)
- ❌ `src/utils/DateRangeControls.jsx` (not a utility)

**Hooks go in `src/hooks/`:**

- ✅ `src/hooks/useDateRangeFilter.js`
- ❌ `src/components/useDateRangeFilter.js` (wrong directory)

**Tests colocated next to code:**

- ✅ `src/components/DateRangeControls.test.jsx`
- ❌ `src/tests/DateRangeControls.test.jsx` (unless integration test)

**Utilities centralized in `src/utils/`:**

- ✅ `src/utils/dateFilter.js`
- ❌ `src/components/dateFilter.js` (extract to utils)

## Common Violations

### Wrong: Component in src root

```
❌ src/MyComponent.jsx
✅ src/components/MyComponent.jsx
```

### Wrong: Non-colocated tests

```
❌ src/tests/MyComponent.test.jsx
❌ src/__tests__/MyComponent.test.jsx
✅ src/components/MyComponent.test.jsx
```

### Wrong: Inconsistent file extensions

```
❌ src/components/MyComponent.js  (should be .jsx if has JSX)
✅ src/components/MyComponent.jsx
```

### Wrong: Utilities in components

```
❌ src/components/dateFilterHelper.js
✅ src/utils/dateFilter.js
```

### Wrong: Hooks not prefixed with 'use'

```
❌ src/hooks/dateRangeFilter.js
✅ src/hooks/useDateRangeFilter.js
```

## Resources

- **Project structure**: Inspect `src/` directory tree
- **Vite config**: `vite.config.js` (import aliases, worker config)
- **ESLint config**: `eslint.config.js` (import rules)
