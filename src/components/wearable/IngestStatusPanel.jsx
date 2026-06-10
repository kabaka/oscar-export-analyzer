import React from 'react';
import PropTypes from 'prop-types';

/** Human-readable labels for the worker's coarse ingest phases (§1.4). */
const PHASE_LABELS = {
  discovering: 'Discovering files',
  'parsing-sleep': 'Parsing sleep',
  'parsing-spo2': 'Parsing SpO₂',
  'parsing-hr': 'Aggregating heart rate',
  'parsing-hrv': 'Parsing HRV',
  'parsing-snore': 'Parsing snore',
  'rolling-up': 'Rolling up nights',
  persisting: 'Saving',
};

/**
 * Ingest status / progress panel for the wearable import (integration §1.4).
 *
 * Replaces the OAuth `SyncStatusPanel`. Surfaces the two-level progress model
 * the ingest worker emits — a coarse phase plus within-phase
 * `filesDone / filesTotal` — and the running nights count, with an
 * `aria-live="polite"` region and a prominent Cancel button.
 *
 * @param {object} props
 * @param {string} props.state - The import state machine value.
 * @param {object|null} props.progress - `{ phase, filesDone, filesTotal, nights }`.
 * @param {object|null} [props.lastImport] - `{ at, nights, dateRange }`.
 * @param {Function} [props.onCancel] - Cancel an in-flight ingest.
 * @param {string} [props.className] - Container CSS class.
 * @returns {JSX.Element|null} The panel, or null when idle with no history.
 */
function IngestStatusPanel({
  state,
  progress,
  lastImport = null,
  onCancel,
  className = '',
}) {
  const isIngesting = state === 'ingesting';

  if (!isIngesting && !lastImport && state !== 'partial') return null;

  const phaseLabel =
    (progress && (PHASE_LABELS[progress.phase] || progress.phase)) || 'Working';
  const filesDone = progress?.filesDone ?? 0;
  const filesTotal = progress?.filesTotal ?? 0;
  const nights = progress?.nights ?? 0;

  const liveText = isIngesting
    ? `${phaseLabel} — ${filesDone.toLocaleString()} of ${filesTotal.toLocaleString()} files, ${nights.toLocaleString()} nights so far`
    : '';

  return (
    <div
      className={`wearable-ingest-panel ${className}`}
      role="region"
      aria-labelledby="wearable-ingest-title"
      data-testid="wearable-ingest-panel"
    >
      <div className="wearable-ingest-header">
        <h3 id="wearable-ingest-title">Import status</h3>
        {isIngesting && onCancel && (
          <button
            type="button"
            className="wearable-ingest-cancel"
            onClick={onCancel}
            data-testid="wearable-ingest-cancel"
          >
            Cancel
          </button>
        )}
      </div>

      {isIngesting && (
        <div className="wearable-ingest-progress">
          <div className="wearable-ingest-phase">{phaseLabel}</div>
          <progress
            value={filesTotal ? filesDone : undefined}
            max={filesTotal || undefined}
            aria-label={`${phaseLabel} progress`}
          />
          <p aria-live="polite" className="wearable-ingest-live">
            {liveText}
          </p>
        </div>
      )}

      {state === 'partial' && !isIngesting && (
        <p className="wearable-ingest-live" role="status">
          Import cancelled. Any nights imported so far are kept.
        </p>
      )}

      {!isIngesting && lastImport && (
        <dl className="wearable-ingest-summary">
          <div>
            <dt>Nights imported</dt>
            <dd>{(lastImport.nights ?? 0).toLocaleString()}</dd>
          </div>
          {lastImport.dateRange && (
            <div>
              <dt>Source range</dt>
              <dd>
                {lastImport.dateRange.start} → {lastImport.dateRange.end}
              </dd>
            </div>
          )}
          {lastImport.at && (
            <div>
              <dt>Last import</dt>
              <dd>{new Date(lastImport.at).toLocaleString()}</dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}

IngestStatusPanel.propTypes = {
  state: PropTypes.string.isRequired,
  progress: PropTypes.shape({
    phase: PropTypes.string,
    filesDone: PropTypes.number,
    filesTotal: PropTypes.number,
    nights: PropTypes.number,
  }),
  lastImport: PropTypes.shape({
    at: PropTypes.number,
    nights: PropTypes.number,
    dateRange: PropTypes.shape({
      start: PropTypes.string,
      end: PropTypes.string,
    }),
  }),
  onCancel: PropTypes.func,
  className: PropTypes.string,
};

export default IngestStatusPanel;
