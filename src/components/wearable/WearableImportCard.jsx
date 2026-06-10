import React, { useState } from 'react';
import PropTypes from 'prop-types';

/**
 * Directory-import card for the wearable correlation feature (integration §1).
 *
 * Replaces the OAuth `FitbitConnectionCard`. Drives the file-access state
 * machine exposed by `useWearableImport`:
 *
 *   - `unsupported` → a non-interactive Chromium-required empty-state (§1.6).
 *     NO `webkitdirectory` fallback is offered in v1.
 *   - `idle` → "Select export folder" CTA + privacy note.
 *   - `picking`/`scanning` → transient status chip.
 *   - `detected` → a detection preview + consent (with opt-in "remember folder"
 *     and "include menstrual data") + "Ingest" CTA.
 *   - `needs-permission` → "Reconnect folder access" re-grant CTA.
 *   - `error` → sanitized message + Retry/Reset.
 *
 * The directory pick and reconnect MUST be user-gesture initiated, so those
 * handlers are wired to button clicks.
 *
 * @param {object} props
 * @param {object} props.imports - The `useWearableImport()` return value.
 * @param {string} [props.className] - Container CSS class.
 * @returns {JSX.Element} The import card.
 */
function WearableImportCard({ imports, className = '' }) {
  const {
    supported,
    state,
    detection,
    error,
    lastImport,
    pickDirectory,
    scan,
    startIngest,
    reconnect,
    forgetFolder,
  } = imports;

  const [rememberFolder, setRememberFolder] = useState(false);
  const [menstrualOptIn, setMenstrualOptIn] = useState(false);

  // --- Non-Chromium empty-state (§1.6) -------------------------------------
  if (!supported) {
    return (
      <div
        className={`wearable-import-card wearable-import-unsupported ${className}`}
        role="region"
        aria-labelledby="wearable-import-unsupported-title"
        data-testid="wearable-import-unsupported"
      >
        <h3 id="wearable-import-unsupported-title">
          Wearable correlation needs a Chromium-based browser
        </h3>
        <p>
          This feature reads your exported wearable data <strong>folder</strong>{' '}
          directly on your device using the File System Access API, which is
          only available in Chromium browsers (Chrome, Edge, Brave, or Opera).
          Your data still never leaves your device — files are read locally and
          nothing is uploaded.
        </p>
        <p>Open OSCAR Analyzer in Chrome, Edge, Brave, or Opera to use it.</p>
        <details className="wearable-import-why">
          <summary>Why does this need Chromium?</summary>
          <p>
            Folder access uses the File System Access API (
            <code>showDirectoryPicker</code>), which is unavailable in Firefox
            and Safari as of 2026. CPAP analysis above is unaffected and remains
            fully usable.
          </p>
        </details>
      </div>
    );
  }

  const handlePick = async () => {
    const handle = await pickDirectory();
    if (handle) await scan(handle);
  };

  const statusChip = (() => {
    const map = {
      idle: 'Not connected',
      picking: 'Opening folder picker…',
      scanning: 'Scanning folder…',
      detected: 'Folder selected',
      ingesting: 'Importing…',
      partial: 'Import cancelled',
      ready: 'Imported',
      error: 'Error',
      'needs-permission': 'Permission needed',
      unsupported: 'Unsupported',
    };
    return map[state] ?? state;
  })();

  return (
    <div
      className={`wearable-import-card ${className}`}
      role="region"
      aria-labelledby="wearable-import-title"
      data-testid="wearable-import-card"
    >
      <div className="wearable-import-header">
        <h3 id="wearable-import-title">Wearable export folder</h3>
        <span
          className={`wearable-status-chip wearable-status-${state}`}
          data-testid="wearable-status-chip"
        >
          {statusChip}
        </span>
      </div>

      {/* idle / needs-permission CTAs */}
      {(state === 'idle' || state === 'picking') && (
        <>
          <p className="wearable-import-note">
            Select your exported wearable data folder (e.g. a Google Health /
            Fitbit Takeout export). Files are parsed locally in your browser and
            never uploaded.
          </p>
          <button
            type="button"
            className="wearable-import-cta"
            onClick={handlePick}
            disabled={state === 'picking'}
          >
            Select export folder
          </button>
        </>
      )}

      {state === 'needs-permission' && (
        <>
          <p className="wearable-import-note">
            Folder access needs to be re-granted to check for new data.
          </p>
          <button
            type="button"
            className="wearable-import-cta"
            onClick={reconnect}
          >
            Reconnect folder access
          </button>
        </>
      )}

      {/* Detection preview + consent (§1.3/§1.4) */}
      {state === 'detected' && (
        <div className="wearable-detection" data-testid="wearable-detection">
          <h4>Detected export</h4>
          {detection ? (
            <ul className="wearable-detection-summary">
              {detection.dateRange && (
                <li>
                  <span className="wearable-detection-label">Date range</span>
                  <span>
                    {detection.dateRange.start} → {detection.dateRange.end}
                  </span>
                </li>
              )}
              {Array.isArray(detection.metrics) && (
                <li>
                  <span className="wearable-detection-label">Metrics</span>
                  <span>{detection.metrics.join(', ') || 'none detected'}</span>
                </li>
              )}
              {typeof detection.fileCount === 'number' && (
                <li>
                  <span className="wearable-detection-label">Files</span>
                  <span>{detection.fileCount.toLocaleString()}</span>
                </li>
              )}
            </ul>
          ) : (
            <p className="wearable-import-note">
              Folder selected. Review and start the import below.
            </p>
          )}

          <p className="wearable-import-note">
            We will aggregate sleep, SpO2, HRV, snore, heart-rate and related
            metrics into nightly summaries. We will <strong>not</strong> read
            your profile, GPS, social, or commerce data. Aggregating large
            heart-rate histories may take a few minutes.
          </p>

          <fieldset className="wearable-consent-options">
            <legend>Import options</legend>
            <div className="wearable-consent-option">
              <label>
                <input
                  type="checkbox"
                  checked={rememberFolder}
                  onChange={(e) => setRememberFolder(e.target.checked)}
                  aria-describedby="wearable-consent-remember-hint"
                />
                Remember this folder
              </label>
              <p
                id="wearable-consent-remember-hint"
                className="wearable-consent-hint"
              >
                Stores only a local handle in your browser so the app can check
                for new data later. No files are copied or uploaded; you can
                forget the folder at any time.
              </p>
            </div>
            <div className="wearable-consent-option">
              <label>
                <input
                  type="checkbox"
                  checked={menstrualOptIn}
                  onChange={(e) => setMenstrualOptIn(e.target.checked)}
                  aria-describedby="wearable-consent-menstrual-hint"
                />
                Include menstrual-cycle data (optional)
              </label>
              <p
                id="wearable-consent-menstrual-hint"
                className="wearable-consent-hint"
              >
                Off by default. When on, cycle data is aggregated locally
                alongside your other metrics and never leaves your device.
              </p>
            </div>
          </fieldset>

          <button
            type="button"
            className="wearable-import-cta"
            onClick={() => startIngest({ rememberFolder, menstrualOptIn })}
            data-testid="wearable-ingest-button"
          >
            Ingest
          </button>
        </div>
      )}

      {/* ready summary */}
      {state === 'ready' && (
        <div
          className="wearable-import-ready"
          data-testid="wearable-import-ready"
        >
          <p className="wearable-import-note">
            Import complete
            {lastImport?.nights ? ` — ${lastImport.nights} nights` : ''}.
          </p>
          <div className="wearable-import-actions">
            <button
              type="button"
              className="wearable-import-secondary"
              onClick={() => scan()}
            >
              Re-scan for new data
            </button>
            <button
              type="button"
              className="wearable-import-secondary"
              onClick={forgetFolder}
            >
              Forget folder
            </button>
          </div>
        </div>
      )}

      {/* error */}
      {state === 'error' && (
        <div className="wearable-import-error" role="alert">
          <p>{error || 'Something went wrong reading the folder.'}</p>
          <button
            type="button"
            className="wearable-import-cta"
            onClick={handlePick}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

WearableImportCard.propTypes = {
  imports: PropTypes.shape({
    supported: PropTypes.bool.isRequired,
    state: PropTypes.string.isRequired,
    detection: PropTypes.object,
    error: PropTypes.string,
    lastImport: PropTypes.object,
    pickDirectory: PropTypes.func.isRequired,
    scan: PropTypes.func.isRequired,
    startIngest: PropTypes.func.isRequired,
    reconnect: PropTypes.func.isRequired,
    forgetFolder: PropTypes.func.isRequired,
  }).isRequired,
  className: PropTypes.string,
};

export default WearableImportCard;
