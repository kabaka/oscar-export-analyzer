import Papa from 'papaparse';
import { FLG_BRIDGE_THRESHOLD } from '../utils/clustering.js';
import { CSV_CHUNK_SIZE_BYTES } from '../constants/ui.js';
import {
  validateSummaryHeaders,
  validateDetailsHeaders,
} from '../utils/csvValidation.js';

/**
 * Sanitizes CSV parsing error messages to prevent information disclosure.
 * Returns generic, user-friendly messages in production while preserving
 * detailed error information in development mode console logs.
 *
 * @param {Error|string} err - The error from PapaParse or other source
 * @returns {string} - Safe, generic error message for display to users
 */
function sanitizeErrorMessage(err) {
  const errMsg = err?.message || String(err);
  const lowerMsg = errMsg.toLowerCase();

  // Map specific error patterns to generic messages
  if (lowerMsg.includes('unexpected') || lowerMsg.includes('token')) {
    return 'Failed to parse CSV file. Please check the file format.';
  }
  if (lowerMsg.includes('too many') || lowerMsg.includes('fields')) {
    return 'CSV file structure is invalid.';
  }
  if (
    lowerMsg.includes('missing') ||
    lowerMsg.includes('header') ||
    lowerMsg.includes('column')
  ) {
    return 'CSV file is missing required columns.';
  }

  // Default generic message for any other parsing errors
  return "Failed to parse CSV file. Please verify it's a valid OSCAR export.";
}

// Parses CSV files off the main thread and streams filtered rows
self.onmessage = (e) => {
  try {
    const { workerId, file, filterEvents } = e.data || {};

    // Validate required fields
    if (!file) {
      self.postMessage({
        workerId,
        type: 'error',
        error: 'No file provided for parsing',
      });
      return;
    }

    let headersValidated = false;

    Papa.parse(file, {
      worker: false,
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      chunkSize: CSV_CHUNK_SIZE_BYTES,
      // Runs in a worker: update progress and filter events per chunk to keep the UI responsive
      chunk(results) {
        // Validate headers on first chunk before processing any rows
        if (!headersValidated) {
          headersValidated = true;
          const headers = results.meta.fields || [];

          // Determine file type and validate appropriate schema
          let validationResult;
          if (filterEvents) {
            // Details file (has Event column and needs filtering)
            validationResult = validateDetailsHeaders(headers);
          } else {
            // Summary file (has Date, AHI, etc.)
            validationResult = validateSummaryHeaders(headers);
          }

          if (!validationResult.valid) {
            // Log detailed validation failure in development
            if (import.meta.env.DEV) {
              console.error('CSV validation failed:', validationResult);
            }

            // Send sanitized error message
            const safeMessage = sanitizeErrorMessage(validationResult.error);
            self.postMessage({
              workerId,
              type: 'error',
              error: safeMessage,
            });

            // Abort parsing
            return;
          }
        }

        self.postMessage({
          workerId,
          type: 'progress',
          cursor: results.meta.cursor,
        });
        let rows = results.data;
        if (filterEvents) {
          rows = rows.filter((r) => {
            const e = r['Event'];
            if (e === 'FLG') return r['Data/Duration'] >= FLG_BRIDGE_THRESHOLD;
            return ['ClearAirway', 'Obstructive', 'Mixed'].includes(e);
          });
        }
        if (rows.length) {
          /**
           * Convert DateTime to milliseconds for worker-to-main-thread serialization.
           *
           * The structured clone algorithm used by postMessage cannot serialize Date objects
           * or Luxon DateTime instances. Converting to milliseconds (primitive number) ensures
           * reliable serialization. Main thread receives milliseconds and can reconstruct
           * Date/DateTime objects as needed.
           *
           * Alternative considered: ISO 8601 strings would serialize but require parsing overhead
           * on every receive. Milliseconds are more efficient and directly compatible with
           * new Date(ms) and DateTime.fromMillis(ms).
           *
           * **IMPORTANT**: When refactoring worker message passing, preserve this DateTime-to-
           * milliseconds conversion pattern. Do not send Date or DateTime objects directly.
           *
           * @see https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm
           */
          const processed = rows.map((r) => {
            if (r['DateTime']) {
              const ms = new Date(r['DateTime']).getTime();
              return { ...r, DateTime: ms };
            }
            return r;
          });
          self.postMessage({ workerId, type: 'rows', rows: processed });
        }
      },
      complete() {
        self.postMessage({ workerId, type: 'complete' });
      },
      error(err) {
        // Log detailed error in development mode only
        if (import.meta.env.DEV) {
          console.error('CSV parsing error:', err);
        }

        // Always send sanitized error message to main thread
        const safeMessage = sanitizeErrorMessage(err);
        self.postMessage({
          workerId,
          type: 'error',
          error: safeMessage,
        });
      },
    });
  } catch (err) {
    // Catch any unexpected errors in message handler or worker initialization
    if (import.meta.env.DEV) {
      console.error('CSV worker message handler error:', err);
    }

    const { workerId } = e.data || {};
    const safeMessage = sanitizeErrorMessage(err);
    self.postMessage({
      workerId,
      type: 'error',
      error: safeMessage,
    });
  }
};
