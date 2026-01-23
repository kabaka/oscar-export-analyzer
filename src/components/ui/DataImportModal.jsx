import React, { useCallback, useEffect, useState } from 'react';
import { getLastSession } from '../../utils/db';

/**
 * Modal dialog for uploading CPAP CSV exports or importing saved sessions.
 *
 * Features:
 * - Drag-and-drop file upload area for CSV and JSON files
 * - Auto-classification of files as Summary, Details, or Session based on content/type
 * - Progress bars for Summary and Details CSV parsing in Web Worker
 * - "Load previous session" button if a saved session exists in browser storage
 * - Error and warning message display with proper accessibility semantics
 * - Multi-file support: can accept Summary + Details CSVs together or individual files
 *
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether modal is visible
 * @param {Function} props.onClose - Callback to close modal
 * @param {Function} props.onSummaryFile - Callback when Summary CSV is selected.
 *   Called with { target: { files: [File] } } object
 * @param {Function} props.onDetailsFile - Callback when Details CSV is selected.
 *   Called with { target: { files: [File] } } object
 * @param {Function} props.onLoadSaved - Callback to load previously saved session from IndexedDB
 * @param {Function} props.onSessionFile - Callback to import session from JSON file.
 *   Called with File object; should throw Error on invalid JSON
 * @param {boolean} props.loadingSummary - Whether Summary CSV is currently parsing
 * @param {boolean} props.loadingDetails - Whether Details CSV is currently parsing
 * @param {number} props.summaryProgress - Current byte count parsed in Summary CSV
 * @param {number} props.summaryProgressMax - Total bytes in Summary CSV
 * @param {number} props.detailsProgress - Current byte count parsed in Details CSV
 * @param {number} props.detailsProgressMax - Total bytes in Details CSV
 * @param {Error | null} props.error - Error object if import failed, null if no error
 * @param {string | null} props.warning - Warning message (e.g., "Some rows had missing values")
 * @returns {JSX.Element | null} Modal dialog or null if not open
 *
 * @example
 * const [isOpen, setIsOpen] = useState(false);
 * return (
 *   <>
 *     <button onClick={() => setIsOpen(true)}>Import</button>
 *     <DataImportModal
 *       isOpen={isOpen}
 *       onClose={() => setIsOpen(false)}
 *       onSummaryFile={handleSummary}
 *       onDetailsFile={handleDetails}
 *       onSessionFile={handleSession}
 *       loadingSummary={false}
 *       loadingDetails={false}
 *     />
 *   </>
 * );
 *
 * @see useCsvFiles - Hook managing file upload and parsing state
 */
export default function DataImportModal({
  isOpen,
  onClose,
  onSummaryFile,
  onDetailsFile,
  onLoadSaved,
  onSessionFile,
  loadingSummary,
  loadingDetails,
  summaryProgress,
  summaryProgressMax,
  detailsProgress,
  detailsProgressMax,
  error,
  warning,
}) {
  const [hasSaved, setHasSaved] = useState(false);
  const [localError, setLocalError] = useState('');
  useEffect(() => {
    if (!isOpen) return;
    getLastSession()
      .then((sess) => setHasSaved(!!sess))
      .catch(() => setHasSaved(false));
  }, [isOpen]);

  const classifyFile = async (file) => {
    if (/json/i.test(file.type) || /\.json$/i.test(file.name)) return 'session';
    const text = await new Response(file).text();
    const header = text.split(/\r?\n/)[0];
    return /event/i.test(header) ? 'details' : 'summary';
  };

  const handleFiles = useCallback(
    async (fileList) => {
      const files = Array.from(fileList || []);
      if (!files.length) return;
      const classified = await Promise.all(
        files.map(async (f) => ({ type: await classifyFile(f), file: f })),
      );
      const session = classified.find((c) => c.type === 'session')?.file;
      const summary = classified.find((c) => c.type === 'summary')?.file;
      const details = classified.find((c) => c.type === 'details')?.file;
      if (session) {
        try {
          await onSessionFile(session);
          setLocalError('');
          onClose();
        } catch (err) {
          setLocalError(
            err instanceof Error
              ? err.message
              : 'Could not import session file',
          );
        }
        return;
      }
      if (summary) {
        onSummaryFile({ target: { files: [summary] } });
      }
      if (details) {
        onDetailsFile({ target: { files: [details] } });
      }
      setLocalError('');
      if (summary || details) onClose();
    },
    [onSummaryFile, onDetailsFile, onSessionFile, onClose],
  );

  const onInputChange = (e) => handleFiles(e.target.files);
  const onDrop = (e) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };
  const onDragOver = (e) => e.preventDefault();

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Import Data"
    >
      <div
        className="modal"
        style={{
          padding: 24,
          width: 'min(480px, 96vw)',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          alignItems: 'center',
        }}
      >
        <h3 style={{ margin: 0, textAlign: 'center' }}>Load OSCAR CSVs</h3>
        {hasSaved && (
          <button
            className="btn-primary"
            onClick={() => {
              onLoadSaved();
              onClose();
            }}
            style={{ alignSelf: 'center' }}
          >
            Load previous session
          </button>
        )}
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          style={{
            width: '100%',
            flex: 1,
            border: '2px dashed var(--color-border)',
            padding: 20,
            borderRadius: 8,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            gap: 12,
          }}
        >
          <p style={{ margin: 0 }}>
            Drag and drop Summary & Details CSVs or a session JSON here or
            choose files
          </p>
          <input
            type="file"
            accept=".csv,application/json"
            multiple
            onChange={onInputChange}
            aria-label="CSV or session files"
          />
          {loadingSummary && (
            <progress
              value={summaryProgress}
              max={summaryProgressMax}
              style={{ width: '100%' }}
            />
          )}
          {loadingDetails && (
            <progress
              value={detailsProgress}
              max={detailsProgressMax}
              style={{ width: '100%' }}
            />
          )}
          {(error || localError) && (
            <div role="alert" style={{ color: 'red' }}>
              {error || localError}
            </div>
          )}
          {warning && !error && !localError && (
            <div role="status" style={{ color: 'orange' }}>
              {warning}
            </div>
          )}
        </div>
        <button
          className="btn-ghost"
          onClick={onClose}
          aria-label="Close"
          style={{ alignSelf: 'center' }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
