import React, { useCallback, useEffect, useState } from 'react';
import { getLastSession } from '../../utils/db';

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
