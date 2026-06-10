/**
 * Wearable-export ingestion worker (perf-storage design rev2 §2, integration §5).
 *
 * Receives a `FileSystemDirectoryHandle` (structured-cloneable / transferable to
 * a worker), enumerates + parses + aggregates the export entirely off the main
 * thread, persists nightly rollups + intraday to IndexedDB via `putBatch`, and
 * reports progress through the `{ workerId, type, ... }` envelope used by
 * `csv.worker.js`. All heavy logic lives in `utils/wearable/ingestEngine.js`
 * (a plain module) so it is unit-testable without a real Worker.
 *
 * Protocol:
 *   Main → worker:
 *     { workerId, action: 'scan',   payload: { dirHandle, menstrualOptIn? } }
 *     { workerId, action: 'ingest', payload: { dirHandle, menstrualOptIn?,
 *                                              sinceDate?, knownFiles? } }
 *     { workerId, action: 'cancel' }
 *   Worker → main:
 *     { workerId, type: 'scan-result', detection }
 *     { workerId, type: 'progress', phase, filesDone, filesTotal, nights }
 *     { workerId, type: 'complete', stats }
 *     { workerId, type: 'error', error }   // sanitized — never leaks PHI/paths
 *
 * No PHI in any message: error strings are sanitized to generic "Safe message"
 * text (privacy §5.3); progress carries only counts and a metric-phase label.
 *
 * @module workers/wearableIngest.worker
 */

import { runIngest, enumerateExport } from '../utils/wearable/ingestEngine.js';
import { openAppDb } from '../utils/appDb.js';
import { INGEST_PROGRESS_THROTTLE_MS } from '../constants/ui.js';

/** Current run's AbortController (cancellation). */
let currentController = null;

/**
 * Sanitize any error to a generic, PHI-free message (mirrors `csv.worker.js`).
 * Never includes file paths, cell values, or sample data.
 *
 * @param {Error|string} err
 * @returns {string}
 */
function sanitizeErrorMessage(err) {
  const name = err?.name || '';
  if (name === 'AbortError') return 'Wearable import was cancelled.';
  const msg = (err?.message || String(err)).toLowerCase();
  if (msg.includes('abort') || msg.includes('cancel')) {
    return 'Wearable import was cancelled.';
  }
  if (msg.includes('quota') || msg.includes('storage')) {
    return 'Storage quota exceeded while saving wearable data.';
  }
  if (msg.includes('permission') || msg.includes('denied')) {
    return 'Permission to read the export folder was lost. Please reconnect.';
  }
  // Default generic message; never echo the raw error (may embed a path/value).
  return 'Failed to import the wearable export. Please verify the folder.';
}

self.onmessage = async (e) => {
  const { workerId, action, payload } = e.data || {};

  if (action === 'cancel') {
    if (currentController) currentController.abort();
    return;
  }

  if (!payload?.dirHandle) {
    self.postMessage({
      workerId,
      type: 'error',
      error: 'No export folder provided.',
    });
    return;
  }

  currentController = new AbortController();
  const { signal } = currentController;

  try {
    if (action === 'scan') {
      const files = await enumerateExport(payload.dirHandle, {
        menstrualOptIn: payload.menstrualOptIn === true,
        signal,
      });
      self.postMessage({
        workerId,
        type: 'scan-result',
        detection: summarizeScan(files),
      });
      return;
    }

    if (action === 'ingest') {
      const db = await openAppDb();
      if (!db) {
        self.postMessage({
          workerId,
          type: 'error',
          error: 'Local storage is unavailable in this browser.',
        });
        return;
      }

      // Throttle progress to ~10/s regardless of engine emit rate (perf §2.4).
      let lastEmit = 0;
      let pending = null;
      const onProgress = (p) => {
        pending = p;
        const now = Date.now();
        if (now - lastEmit >= INGEST_PROGRESS_THROTTLE_MS) {
          lastEmit = now;
          self.postMessage({ workerId, type: 'progress', ...pending });
          pending = null;
        }
      };

      const result = await runIngest({
        dirHandle: payload.dirHandle,
        db,
        opts: {
          menstrualOptIn: payload.menstrualOptIn === true,
          sinceDate: payload.sinceDate ?? null,
          knownFiles: payload.knownFiles ?? null,
        },
        onProgress,
        signal,
      });

      // Flush the last coalesced progress, then complete.
      if (pending) self.postMessage({ workerId, type: 'progress', ...pending });
      self.postMessage({
        workerId,
        type: 'complete',
        stats: result.stats,
        lastIngestedDate: result.lastIngestedDate,
        nights: result.nights,
      });
      return;
    }

    self.postMessage({
      workerId,
      type: 'error',
      error: 'Unknown ingest action.',
    });
  } catch (err) {
    if (import.meta.env?.DEV) {
      // Dev-only diagnostics. Log ONLY the error *name* (a constructor label such
      // as "TypeError"/"SyntaxError" — never PHI) and the already-sanitized,
      // PHI-free message. NEVER log `err.message`/`err.stack`: a parser/FS error
      // can embed a file path or cell value (ADR-0005 §7, privacy §5.3).
      console.error(
        'wearableIngest worker error:',
        err?.name || 'Error',
        '-',
        sanitizeErrorMessage(err),
      );
    }
    self.postMessage({
      workerId,
      type: 'error',
      error: sanitizeErrorMessage(err),
    });
  } finally {
    currentController = null;
  }
};

/**
 * Summarize an enumerated file list into a pre-consent detection object (counts
 * + metrics present). No file contents are read here.
 *
 * @param {Array<{ relPath: string, metric: string, phase: string }>} files
 * @returns {{ fileCount: number, metrics: string[], perMetricCounts: object }}
 */
function summarizeScan(files) {
  const perMetricCounts = {};
  for (const f of files) {
    perMetricCounts[f.metric] = (perMetricCounts[f.metric] || 0) + 1;
  }
  return {
    fileCount: files.length,
    metrics: Object.keys(perMetricCounts),
    perMetricCounts,
  };
}
