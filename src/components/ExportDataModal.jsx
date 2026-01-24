import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { validatePassphrase } from '../utils/exportImport';

/**
 * Modal for exporting encrypted session data for cross-device transfer.
 *
 * Features:
 * - Passphrase input with show/hide toggle
 * - Real-time passphrase strength meter (weak/moderate/strong)
 * - Passphrase confirmation to prevent typos
 * - Privacy warnings about cloud storage and data security
 * - Transfer method guidance (AirDrop, USB, email, cloud)
 * - Accessible keyboard navigation and ARIA labels
 *
 * Security notes:
 * - Passphrase is cleared from memory after export
 * - No passphrase storage (user must remember it)
 * - Minimum 8 characters enforced, 12+ recommended
 *
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether modal is visible
 * @param {Function} props.onClose - Callback to close modal
 * @param {Function} props.onExport - Callback to export data with passphrase.
 *   Called with passphrase string when user clicks export button.
 * @param {boolean} props.isExporting - Whether export is in progress
 * @param {Error | null} props.error - Error object if export failed
 * @returns {JSX.Element | null} Modal dialog or null if not open
 */
export default function ExportDataModal({
  isOpen,
  onClose,
  onExport,
  isExporting = false,
  error = null,
}) {
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [validation, setValidation] = useState(null);
  const [touched, setTouched] = useState(false);

  // Validate passphrase on change
  useEffect(() => {
    if (passphrase) {
      const result = validatePassphrase(passphrase);
      setTimeout(() => setValidation(result), 0);
    } else {
      setTimeout(() => setValidation(null), 0);
    }
  }, [passphrase]);

  // Clear form on close
  useEffect(() => {
    if (!isOpen) {
      // Clear sensitive data from memory
      setTimeout(() => {
        setPassphrase('');
        setConfirmPassphrase('');
        setShowPassphrase(false);
        setShowConfirm(false);
        setValidation(null);
        setTouched(false);
      }, 0);
    }
  }, [isOpen]);

  const handleExport = async () => {
    setTouched(true);

    // Validate passphrases match
    if (passphrase !== confirmPassphrase) {
      return; // Error shown in UI
    }

    // Validate passphrase strength
    if (!validation || !validation.isValid) {
      return; // Error shown in UI
    }

    // Call export callback
    await onExport(passphrase);

    // Clear passphrase from memory after export
    setPassphrase('');
    setConfirmPassphrase('');
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const canExport =
    validation?.isValid &&
    passphrase === confirmPassphrase &&
    passphrase.length >= 8 &&
    !isExporting;

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
    >
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 id="export-modal-title">Export for Another Device</h2>
          <button
            onClick={onClose}
            aria-label="Close export modal"
            className="btn-ghost"
            disabled={isExporting}
          >
            ×
          </button>
        </div>

        <div className="modal-body">
          <p>
            Download your analysis session as an <strong>encrypted file</strong>
            . Transfer this file to another device to continue your analysis
            there.
          </p>

          {/* Privacy Warning */}
          <div className="alert alert-warning" role="alert">
            <strong>⚠️ Privacy Notice:</strong> The exported file contains your
            CPAP health data. Keep it secure and avoid uploading to untrusted
            cloud services.
          </div>

          {/* Passphrase Input */}
          <div className="form-group">
            <label htmlFor="export-passphrase">
              Encryption Passphrase <span className="text-danger">*</span>
            </label>
            <div className="input-group">
              <input
                id="export-passphrase"
                type={showPassphrase ? 'text' : 'password'}
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Enter passphrase (min 8 characters)"
                className="form-control"
                disabled={isExporting}
                autoComplete="new-password"
                aria-describedby="passphrase-help"
              />
              <button
                type="button"
                onClick={() => setShowPassphrase(!showPassphrase)}
                className="btn-ghost"
                aria-label={
                  showPassphrase ? 'Hide passphrase' : 'Show passphrase'
                }
                disabled={isExporting}
              >
                {showPassphrase ? '🙈' : '👁️'}
              </button>
            </div>
            <small id="passphrase-help" className="form-text">
              You&apos;ll need this passphrase to decrypt the file. Store it
              securely (password manager recommended).
            </small>
          </div>

          {/* Passphrase Strength Meter */}
          {validation && (
            <div className="form-group">
              <div className="strength-meter">
                <div className="strength-meter-label">
                  Strength:{' '}
                  <strong className={`strength-${validation.strength}`}>
                    {validation.strength}
                  </strong>
                </div>
                <div className="strength-meter-bar">
                  <div
                    className={`strength-meter-fill strength-${validation.strength}`}
                    style={{
                      width:
                        validation.strength === 'strong'
                          ? '100%'
                          : validation.strength === 'moderate'
                            ? '60%'
                            : '30%',
                    }}
                  />
                </div>
              </div>
              {validation.suggestions.length > 0 && (
                <ul className="strength-suggestions">
                  {validation.suggestions.map((suggestion, i) => (
                    <li key={i}>{suggestion}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Confirm Passphrase Input */}
          <div className="form-group">
            <label htmlFor="confirm-passphrase">
              Confirm Passphrase <span className="text-danger">*</span>
            </label>
            <div className="input-group">
              <input
                id="confirm-passphrase"
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassphrase}
                onChange={(e) => setConfirmPassphrase(e.target.value)}
                placeholder="Re-enter passphrase"
                className={`form-control ${
                  touched &&
                  confirmPassphrase &&
                  passphrase !== confirmPassphrase
                    ? 'is-invalid'
                    : ''
                }`}
                disabled={isExporting}
                autoComplete="new-password"
                aria-describedby="confirm-help"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="btn-ghost"
                aria-label={
                  showConfirm ? 'Hide confirmation' : 'Show confirmation'
                }
                disabled={isExporting}
              >
                {showConfirm ? '🙈' : '👁️'}
              </button>
            </div>
            {touched &&
              confirmPassphrase &&
              passphrase !== confirmPassphrase && (
                <div className="invalid-feedback" role="alert">
                  Passphrases do not match
                </div>
              )}
          </div>

          {/* Transfer Methods */}
          <details className="transfer-methods">
            <summary>How to transfer the file safely</summary>
            <ul>
              <li>
                <strong>🍎 AirDrop (Mac/iPhone):</strong> Fast and secure for
                Apple devices
              </li>
              <li>
                <strong>💾 USB Drive:</strong> Physical transfer, no internet
                required
              </li>
              <li>
                <strong>📧 Email:</strong> Send to yourself (file is encrypted)
              </li>
              <li>
                <strong>☁️ Cloud Storage:</strong> Use only if you trust the
                provider (Dropbox, Google Drive, iCloud)
              </li>
              <li>
                <strong>🔗 Secure Messaging:</strong> Signal, WhatsApp, or
                Telegram (encrypted channels)
              </li>
            </ul>
          </details>

          {/* Error Display */}
          {error && (
            <div className="alert alert-danger" role="alert">
              <strong>Export failed:</strong> {error.message}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            onClick={onClose}
            className="btn-secondary"
            disabled={isExporting}
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            className="btn-primary"
            disabled={!canExport}
            aria-describedby={!canExport ? 'export-disabled-reason' : undefined}
          >
            {isExporting ? 'Encrypting...' : 'Download Encrypted File'}
          </button>
          {!canExport && !isExporting && (
            <span id="export-disabled-reason" className="sr-only">
              {!validation?.isValid
                ? 'Passphrase is too weak or invalid'
                : passphrase !== confirmPassphrase
                  ? 'Passphrases do not match'
                  : 'Complete all fields to export'}
            </span>
          )}
        </div>
      </div>

      <style>{`
        .strength-meter {
          margin-top: 0.5rem;
        }

        .strength-meter-label {
          font-size: 0.875rem;
          margin-bottom: 0.25rem;
        }

        .strength-weak {
          color: #dc3545;
        }

        .strength-moderate {
          color: #ffc107;
        }

        .strength-strong {
          color: #28a745;
        }

        .strength-meter-bar {
          height: 6px;
          background-color: #e9ecef;
          border-radius: 3px;
          overflow: hidden;
        }

        .strength-meter-fill {
          height: 100%;
          transition: width 0.3s ease;
        }

        .strength-meter-fill.strength-weak {
          background-color: #dc3545;
        }

        .strength-meter-fill.strength-moderate {
          background-color: #ffc107;
        }

        .strength-meter-fill.strength-strong {
          background-color: #28a745;
        }

        .strength-suggestions {
          margin-top: 0.5rem;
          font-size: 0.875rem;
          color: #6c757d;
          padding-left: 1.25rem;
        }

        .transfer-methods {
          margin-top: 1rem;
          padding: 0.75rem;
          background-color: #f8f9fa;
          border-radius: 4px;
        }

        .transfer-methods summary {
          cursor: pointer;
          font-weight: 500;
          user-select: none;
        }

        .transfer-methods ul {
          margin-top: 0.5rem;
          margin-bottom: 0;
        }

        .transfer-methods li {
          margin-bottom: 0.5rem;
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

        .form-control.is-invalid {
          border-color: #dc3545;
        }

        .invalid-feedback {
          display: block;
          color: #dc3545;
          font-size: 0.875rem;
          margin-top: 0.25rem;
        }

        .alert {
          padding: 0.75rem 1rem;
          margin-bottom: 1rem;
          border-radius: 4px;
        }

        .alert-warning {
          background-color: #fff3cd;
          border: 1px solid #ffc107;
          color: #856404;
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

ExportDataModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onExport: PropTypes.func.isRequired,
  isExporting: PropTypes.bool,
  error: PropTypes.instanceOf(Error),
};
