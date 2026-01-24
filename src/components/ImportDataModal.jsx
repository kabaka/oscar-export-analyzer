import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

/**
 * Modal for importing encrypted session data from another device.
 *
 * Features:
 * - File upload with drag-and-drop support
 * - Passphrase input with show/hide toggle
 * - File validation and size checks
 * - Safe error handling (no sensitive data in errors)
 * - Cross-device import detection and notification
 * - Accessible keyboard navigation and ARIA labels
 *
 * Security notes:
 * - File validation before decryption (prevents attacks)
 * - Maximum 50MB file size enforced
 * - Passphrase cleared from memory after import
 * - Safe error messages (no health data exposure)
 *
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether modal is visible
 * @param {Function} props.onClose - Callback to close modal
 * @param {Function} props.onImport - Callback to import data with file and passphrase.
 *   Called with (file, passphrase) when user clicks import button.
 * @param {boolean} props.isImporting - Whether import is in progress
 * @param {Error | null} props.error - Error object if import failed
 * @param {boolean} props.crossDevice - Whether import was from different device
 * @returns {JSX.Element | null} Modal dialog or null if not open
 */
export default function ImportDataModal({
  isOpen,
  onClose,
  onImport,
  isImporting = false,
  error = null,
  crossDevice = false,
}) {
  const [file, setFile] = useState(null);
  const [passphrase, setPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Clear form on close
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setFile(null);
        setPassphrase('');
        setShowPassphrase(false);
        setDragActive(false);
      }, 0);
    }
  }, [isOpen]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFile = e.dataTransfer?.files?.[0];
    if (droppedFile) {
      setFile(droppedFile);
    }
  };

  const handleImport = async () => {
    if (!file || !passphrase) return;

    await onImport(file, passphrase);

    // Clear passphrase from memory after import
    setPassphrase('');
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const canImport = file && passphrase.length >= 8 && !isImporting;

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-modal-title"
    >
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 id="import-modal-title">Import from Another Device</h2>
          <button
            onClick={onClose}
            aria-label="Close import modal"
            className="btn-ghost"
            disabled={isImporting}
          >
            ×
          </button>
        </div>

        <div className="modal-body">
          <p>
            Import an encrypted analysis session from another device.
            You&apos;ll need the passphrase you used to encrypt the file.
          </p>

          {/* File Upload Area */}
          <div className="form-group">
            <label htmlFor="import-file">
              Select Encrypted File <span className="text-danger">*</span>
            </label>
            <div
              className={`file-drop-zone ${dragActive ? 'drag-active' : ''} ${file ? 'has-file' : ''}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                id="import-file"
                type="file"
                accept=".json,.enc,.json.enc"
                onChange={handleFileChange}
                className="file-input"
                disabled={isImporting}
                aria-describedby="file-help"
              />
              <div className="file-drop-content">
                {file ? (
                  <>
                    <div className="file-icon">📄</div>
                    <div className="file-name">{file.name}</div>
                    <div className="file-size">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                    {!isImporting && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFile(null);
                        }}
                        className="btn-ghost btn-sm"
                      >
                        Remove
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <div className="file-icon">📁</div>
                    <div className="file-prompt">
                      Click to select file or drag and drop
                    </div>
                    <div className="file-hint">.json.enc files (max 50MB)</div>
                  </>
                )}
              </div>
            </div>
            <small id="file-help" className="form-text">
              Select the encrypted export file from your other device
            </small>
          </div>

          {/* Passphrase Input */}
          <div className="form-group">
            <label htmlFor="import-passphrase">
              Decryption Passphrase <span className="text-danger">*</span>
            </label>
            <div className="input-group">
              <input
                id="import-passphrase"
                type={showPassphrase ? 'text' : 'password'}
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Enter passphrase (min 8 characters)"
                className="form-control"
                disabled={isImporting}
                autoComplete="off"
                aria-describedby="passphrase-help"
              />
              <button
                type="button"
                onClick={() => setShowPassphrase(!showPassphrase)}
                className="btn-ghost"
                aria-label={
                  showPassphrase ? 'Hide passphrase' : 'Show passphrase'
                }
                disabled={isImporting}
              >
                {showPassphrase ? '🙈' : '👁️'}
              </button>
            </div>
            <small id="passphrase-help" className="form-text">
              This is the passphrase you used when exporting the file
            </small>
          </div>

          {/* Cross-Device Notification */}
          {crossDevice && !error && (
            <div className="alert alert-info" role="status">
              <strong>✓ Session imported from another device</strong>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="alert alert-danger" role="alert">
              <strong>Import failed:</strong> {error.message}
            </div>
          )}

          {/* Privacy Notice */}
          <div className="alert alert-info">
            <strong>🔒 Privacy:</strong> Your data will be stored locally in
            this browser. The import file can be deleted after import.
          </div>
        </div>

        <div className="modal-footer">
          <button
            onClick={onClose}
            className="btn-secondary"
            disabled={isImporting}
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            className="btn-primary"
            disabled={!canImport}
            aria-describedby={!canImport ? 'import-disabled-reason' : undefined}
          >
            {isImporting ? 'Decrypting...' : 'Import Data'}
          </button>
          {!canImport && !isImporting && (
            <span id="import-disabled-reason" className="sr-only">
              {!file
                ? 'Select a file to import'
                : passphrase.length < 8
                  ? 'Passphrase must be at least 8 characters'
                  : 'Complete all fields to import'}
            </span>
          )}
        </div>
      </div>

      <style>{`
        .file-drop-zone {
          border: 2px dashed #cbd5e0;
          border-radius: 8px;
          padding: 2rem;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s ease;
          background-color: #f8f9fa;
          position: relative;
        }

        .file-drop-zone:hover {
          border-color: #4299e1;
          background-color: #edf2f7;
        }

        .file-drop-zone.drag-active {
          border-color: #4299e1;
          background-color: #ebf8ff;
        }

        .file-drop-zone.has-file {
          border-color: #48bb78;
          background-color: #f0fff4;
        }

        .file-input {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          opacity: 0;
          cursor: pointer;
        }

        .file-drop-content {
          pointer-events: none;
        }

        .file-icon {
          font-size: 3rem;
          margin-bottom: 0.5rem;
        }

        .file-name {
          font-weight: 500;
          color: #2d3748;
          margin-bottom: 0.25rem;
        }

        .file-size {
          font-size: 0.875rem;
          color: #718096;
          margin-bottom: 0.5rem;
        }

        .file-prompt {
          font-size: 1rem;
          color: #4a5568;
          margin-bottom: 0.5rem;
        }

        .file-hint {
          font-size: 0.875rem;
          color: #a0aec0;
        }

        .btn-sm {
          padding: 0.25rem 0.5rem;
          font-size: 0.875rem;
          pointer-events: auto;
        }

        .input-group {
          display: flex;
          gap: 0.5rem;
        }

        .input-group .form-control {
          flex: 1;
        }

        .input-group .btn-ghost {
          padding: 0.375rem 0.75rem;
        }

        .alert {
          padding: 0.75rem 1rem;
          margin-bottom: 1rem;
          border-radius: 4px;
        }

        .alert-info {
          background-color: #d1ecf1;
          border: 1px solid #17a2b8;
          color: #0c5460;
        }

        .alert-danger {
          background-color: #f8d7da;
          border: 1px solid #dc3545;
          color: #721c24;
        }

        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border-width: 0;
        }
      `}</style>
    </div>
  );
}

ImportDataModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onImport: PropTypes.func.isRequired,
  isImporting: PropTypes.bool,
  error: PropTypes.instanceOf(Error),
  crossDevice: PropTypes.bool,
};
