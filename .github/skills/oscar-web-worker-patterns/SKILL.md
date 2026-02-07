---
name: oscar-web-worker-patterns
description: Patterns for Web Worker integration in OSCAR analyzer including CSV parsing, analytics computation, and Fitbit API communication. Use when implementing or debugging worker-based features.
---

# OSCAR Web Worker Patterns

OSCAR Export Analyzer offloads heavy computation to Web Workers to keep the UI responsive. This skill documents patterns for CSV parsing, analytics computation, and Fitbit API workers.

## Why Web Workers

**Problem:** Parsing large CSV files (30+ MB) or running statistical analysis blocks the main thread, freezing the UI.

**Solution:** Offload computation to dedicated workers that run in parallel threads.

**Use cases:**

- CSV parsing with PapaParse (thousands of rows)
- Statistical analysis (clustering, change-point detection)
- Fitbit API calls (encryption/decryption, network requests)
- Large dataset transformations

## Worker Creation (Vite)

Vite recognizes `*.worker.js` files and bundles them automatically:

```javascript
// src/components/CSVUpload.jsx
const worker = new Worker(new URL('../workers/csvParser.worker.js', import.meta.url), {
  type: 'module',
});
```

**Key points:**

- Use `new URL(..., import.meta.url)` for Vite compatibility
- Set `type: 'module'` for ES module support in worker
- Worker file must end with `.worker.js` for Vite recognition

## Basic Message Passing Pattern

### Main Thread (Component)

```javascript
import { useState, useEffect } from 'react';

function CSVUpload() {
  const [worker, setWorker] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Initialize worker
    const csvWorker = new Worker(
      new URL('../workers/csvParser.worker.js', import.meta.url),
      { type: 'module' }
    );

    // Handle messages from worker
    csvWorker.onmessage = (event) => {
      const { type, data, error } = event.data;

      if (type === 'success') {
        setResult(data);
      } else if (type === 'error') {
        setError(error);
      } else if (type === 'progress') {
        console.log(`Progress: ${data.percent}%`);
      }
    };

    // Handle worker errors
    csvWorker.onerror = (event) => {
      setError(`Worker error: ${event.message}`);
    };

    setWorker(csvWorker);

    // Cleanup on unmount
    return () => {
      csvWorker.terminate();
    };
  }, []);

  const handleUpload = (csvText) => {
    if (worker) {
      worker.postMessage({ type: 'parse', data: csvText });
    }
  };

  return (
    <>
      <button onClick={() => handleUpload(csvText)}>Parse CSV</button>
      {error && <div>Error: {error}</div>}
      {result && <div>Parsed {result.length} rows</div>}
    </>
  );
}
```

### Worker Thread

```javascript
// src/workers/csvParser.worker.js
import Papa from 'papaparse';

self.onmessage = (event) => {
  const { type, data } = event.data;

  if (type === 'parse') {
    try {
      // Parse CSV
      const result = Papa.parse(data, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
      });

      // Send progress updates
      self.postMessage({
        type: 'progress',
        data: { percent: 50 },
      });

      // Process and validate data
      const processed = result.data.map((row) => ({
        date: new Date(row.Date),
        ahi: parseFloat(row.AHI),
        epap: parseFloat(row.EPAP),
      }));

      // Send final result
      self.postMessage({
        type: 'success',
        data: processed,
      });
    } catch (error) {
      // Send error (sanitize message, no CSV content)
      self.postMessage({
        type: 'error',
        error: error.message,
      });
    }
  }
};
```

## Progressive Streaming Pattern

For large datasets, stream results in chunks:

```javascript
// Worker: Send chunks as they're processed
Papa.parse(csvText, {
  header: true,
  chunk: (results, parser) => {
    // Send chunk to main thread
    self.postMessage({
      type: 'chunk',
      data: results.data,
    });
  },
  complete: () => {
    // All chunks sent
    self.postMessage({ type: 'complete' });
  },
});

// Main thread: Accumulate chunks
worker.onmessage = (event) => {
  const { type, data } = event.data;

  if (type === 'chunk') {
    setRows((prev) => [...prev, ...data]);
  } else if (type === 'complete') {
    console.log('Parsing complete');
  }
};
```

## Promise-Based Worker Wrapper

Wrap worker communication in promises for cleaner async handling:

```javascript
// src/hooks/useWorker.js
export function useCSVWorker() {
  const workerRef = useRef(null);

  useEffect(() => {
    workerRef.current = new Worker(
      new URL('../workers/csvParser.worker.js', import.meta.url),
      { type: 'module' }
    );

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const parseCSV = useCallback((csvText) => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        reject(new Error('Worker not initialized'));
        return;
      }

      const handler = (event) => {
        const { type, data, error } = event.data;

        if (type === 'success') {
          workerRef.current.removeEventListener('message', handler);
          resolve(data);
        } else if (type === 'error') {
          workerRef.current.removeEventListener('message', handler);
          reject(new Error(error));
        }
      };

      workerRef.current.addEventListener('message', handler);
      workerRef.current.postMessage({ type: 'parse', data: csvText });
    });
  }, []);

  return { parseCSV };
}
```

**Usage:**

```javascript
const { parseCSV } = useCSVWorker();

const handleUpload = async (csvText) => {
  try {
    const result = await parseCSV(csvText);
    console.log(`Parsed ${result.length} rows`);
  } catch (error) {
    console.error('Parse failed:', error);
  }
};
```

## Worker Error Handling

### Worker-Side Error Handling

```javascript
// src/workers/csvParser.worker.js
self.onmessage = (event) => {
  try {
    const { type, data } = event.data;

    if (type === 'parse') {
      // Validate input
      if (!data || typeof data !== 'string') {
        throw new Error('Invalid CSV input');
      }

      // Parse
      const result = parseCSV(data);

      // Validate output
      if (!result || result.length === 0) {
        throw new Error('No data parsed from CSV');
      }

      self.postMessage({ type: 'success', data: result });
    }
  } catch (error) {
    // Log error in worker (appears in DevTools)
    console.error('Worker error:', error);

    // Send sanitized error to main thread
    self.postMessage({
      type: 'error',
      error: error.message,
      stack: error.stack, // Optional: helpful for debugging
    });
  }
};

// Handle uncaught errors
self.onerror = (event) => {
  console.error('Uncaught worker error:', event);
  self.postMessage({
    type: 'error',
    error: 'Unexpected worker error',
  });
};
```

### Main Thread Error Handling

```javascript
worker.onmessage = (event) => {
  if (event.data.type === 'error') {
    // Handle worker-reported errors
    showError(`Parsing failed: ${event.data.error}`);
  }
};

worker.onerror = (event) => {
  // Handle worker crashes
  console.error('Worker crashed:', event);
  showError('Worker terminated unexpectedly');

  // Optionally restart worker
  restartWorker();
};
```

## Fallback Pattern

When Web Workers unavailable (rare), fall back to main thread:

```javascript
function parseCSVWithWorker(csvText) {
  if (typeof Worker !== 'undefined') {
    // Use worker
    return parseWithWorker(csvText);
  } else {
    // Fallback to main thread
    console.warn('Web Workers not available, parsing on main thread');
    return parseOnMainThread(csvText);
  }
}
```

## Worker Lifecycle Management

```javascript
export function useWorkerLifecycle(workerPath) {
  const [worker, setWorker] = useState(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Create worker
    const newWorker = new Worker(new URL(workerPath, import.meta.url), {
      type: 'module',
    });

    // Wait for worker ready signal
    newWorker.onmessage = (event) => {
      if (event.data.type === 'ready') {
        setIsReady(true);
      }
    };

    setWorker(newWorker);

    // Cleanup
    return () => {
      newWorker.terminate();
      setIsReady(false);
    };
  }, [workerPath]);

  return { worker, isReady };
}
```

**Worker signals readiness:**

```javascript
// Worker initialization
self.postMessage({ type: 'ready' });

self.onmessage = (event) => {
  // Handle messages
};
```

## Debugging Web Workers

### DevTools

- Open Chrome DevTools → Sources → Workers
- See worker threads, set breakpoints, inspect variables
- Console logs from workers appear in main console (with worker label)

### Logging Pattern

```javascript
// Worker: Prefix logs for clarity
self.console.log('[CSVWorker] Starting parse');
self.console.log('[CSVWorker] Processed', rows.length, 'rows');

// Error logging
self.console.error('[CSVWorker] Parse failed:', error.message);
```

### Testing Workers

```javascript
// Test worker communication
describe('CSV Worker', () => {
  let worker;

  beforeEach(() => {
    worker = new Worker(new URL('../workers/csvParser.worker.js', import.meta.url), {
      type: 'module',
    });
  });

  afterEach(() => {
    worker.terminate();
  });

  it('parses valid CSV', async () => {
    const csvText = 'Date,AHI\n2024-01-01,5.2';

    const result = await new Promise((resolve) => {
      worker.onmessage = (event) => {
        if (event.data.type === 'success') {
          resolve(event.data.data);
        }
      };

      worker.postMessage({ type: 'parse', data: csvText });
    });

    expect(result).toHaveLength(1);
    expect(result[0].ahi).toBe(5.2);
  });
});
```

## Common Pitfalls

**❌ Forgetting to terminate workers:**

```javascript
// Memory leak - worker keeps running
const worker = new Worker(...);
// ... component unmounts, worker still running
```

**✅ Always cleanup:**

```javascript
useEffect(() => {
  const worker = new Worker(...);
  return () => worker.terminate();
}, []);
```

**❌ Passing non-serializable data:**

```javascript
// Can't transfer functions or DOM nodes
worker.postMessage({
  callback: () => {}, // ❌ Functions not serializable
  element: document.getElementById('foo'), // ❌ DOM nodes not serializable
});
```

**✅ Use structured cloneable types:**

```javascript
worker.postMessage({
  text: 'hello', // ✅ Strings
  numbers: [1, 2, 3], // ✅ Arrays
  data: { key: 'value' }, // ✅ Objects
  date: new Date(), // ✅ Dates
});
```

**❌ Not handling worker errors:**

```javascript
worker.postMessage(data);
// No error handler - errors silently ignored
```

**✅ Handle both message and error events:**

```javascript
worker.onmessage = handleMessage;
worker.onerror = handleError;
```

## Resources

- **Worker examples**: `src/workers/csvParser.worker.js`, `src/workers/analytics.worker.js`
- **Hook patterns**: `src/hooks/useWorker.js`
- **Vite worker docs**: https://vitejs.dev/guide/features.html#web-workers
- **MDN Web Workers**: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API
