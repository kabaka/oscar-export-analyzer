import React, { useCallback, useEffect, useState } from 'react';
import { getLastSession } from '../utils/db';

export default function DataImportModal({
  isOpen,
  onClose,
  onSummaryFile,
  onDetailsFile,
  onLoadSaved,
  summaryData,
  detailsData,
  loadingSummary,
  loadingDetails,
  summaryProgress,
  summaryProgressMax,
  detailsProgress,
  detailsProgressMax,
  error,
}) {
  const [hasSaved, setHasSaved] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    getLastSession()
      .then((sess) => setHasSaved(!!sess))
      .catch(() => setHasSaved(false));
  }, [isOpen]);

  useEffect(() => {
    if (
      summaryData &&
      detailsData &&
      !loadingSummary &&
      !loadingDetails &&
      isOpen
    ) {
      onClose();
    }
  }, [
    summaryData,
    detailsData,
    loadingSummary,
    loadingDetails,
    isOpen,
    onClose,
  ]);

  const classifyFile = async (file) => {
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
      const summary = classified.find((c) => c.type === 'summary')?.file;
      const details = classified.find((c) => c.type === 'details')?.file;
      if (summary) {
        onSummaryFile({ target: { files: [summary] } });
      }
      if (details) {
        onDetailsFile({ target: { files: [details] } });
      }
    },
    [onSummaryFile, onDetailsFile],
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
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <h3 style={{ margin: 0 }}>Load OSCAR CSVs</h3>
        {hasSaved && (
          <button className="btn-primary" onClick={onLoadSaved}>
            Load previous session
          </button>
        )}
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          style={{
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
            Drag and drop Summary and Details CSVs here or choose files
          </p>
          <input
            type="file"
            accept=".csv"
            multiple
            onChange={onInputChange}
            aria-label="CSV files"
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
          {error && (
            <div role="alert" style={{ color: 'red' }}>
              {error}
            </div>
          )}
        </div>
        <button className="btn-ghost" onClick={onClose} aria-label="Close">
          Close
        </button>
      </div>
    </div>
  );
}
