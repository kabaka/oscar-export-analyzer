import React, { useRef, useEffect } from 'react';
import PropTypes from 'prop-types';

/**
 * Modal explaining PWA installation benefits before triggering browser install prompt.
 *
 * Educates users about what "installing" means, reinforces privacy model
 * (local-only storage), and provides balanced CTAs. Designed for medical context
 * with professional tone and WCAG AA accessibility.
 *
 * @param {Object} props - Component props
 * @param {Function} props.onInstall - Callback when user clicks "Install App"
 * @param {Function} props.onDismiss - Callback when user dismisses modal
 * @returns {JSX.Element} Modal dialog with install explanation
 *
 * @example
 * <InstallExplanationModal
 *   onInstall={async () => {
 *     await promptInstall();
 *     setShowModal(false);
 *   }}
 *   onDismiss={() => setShowModal(false)}
 * />
 */
export function InstallExplanationModal({ onInstall, onDismiss }) {
  const modalRef = useRef(null);
  const notNowButtonRef = useRef(null);

  // Auto-focus "Not Now" button (safe default - prevents accidental installs)
  useEffect(() => {
    notNowButtonRef.current?.focus();
  }, []);

  // Handle Escape key
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onDismiss();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onDismiss]);

  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div className="modal-backdrop" onClick={onDismiss} role="presentation">
      <div
        ref={modalRef}
        className="modal install-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-modal-title"
        aria-describedby="install-modal-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="install-modal-title">Install OSCAR Analyzer</h2>
          <button
            onClick={onDismiss}
            className="btn-ghost"
            aria-label="Close dialog"
            style={{ fontSize: '1.5rem', padding: '4px 8px' }}
          >
            ×
          </button>
        </div>

        <div className="modal-body install-modal-body">
          <div id="install-modal-desc">
            <section className="install-section">
              <h3 className="install-section-title">
                <span className="install-icon" aria-hidden="true">
                  📱
                </span>
                What is &quot;Installing&quot;?
              </h3>
              <p>
                Installing lets you use OSCAR Analyzer like a regular desktop or
                mobile app:
              </p>
              <ul className="install-benefits">
                <li>
                  <span className="install-check" aria-hidden="true">
                    ✓
                  </span>
                  Works fully offline — analyze data without internet
                </li>
                <li>
                  <span className="install-check" aria-hidden="true">
                    ✓
                  </span>
                  Opens in own window — fewer distractions, no browser tabs
                </li>
                <li>
                  <span className="install-check" aria-hidden="true">
                    ✓
                  </span>
                  Access from desktop/home screen — no bookmarks needed
                </li>
                <li>
                  <span className="install-check" aria-hidden="true">
                    ✓
                  </span>
                  Faster startup — app assets cached locally
                </li>
              </ul>
            </section>

            <div className="install-divider" role="separator" />

            <section className="install-section">
              <h3 className="install-section-title">
                <span className="install-icon" aria-hidden="true">
                  🔒
                </span>
                Privacy: All your data stays on this device
              </h3>
              <p>
                Your CPAP data is stored locally in your browser (never uploaded
                to servers). Installing doesn&apos;t change this — your data
                remains private and local-only.
              </p>
            </section>

            <div className="install-divider" role="separator" />

            <section className="install-section">
              <h3 className="install-section-title">
                <span className="install-icon" aria-hidden="true">
                  💡
                </span>
                Recommended for frequent users
              </h3>
              <p>
                If you analyze your OSCAR exports regularly (weekly, monthly),
                installing makes access easier. Casual users can continue using
                the web version — it works the same!
              </p>
            </section>
          </div>
        </div>

        <div className="modal-footer install-modal-footer">
          <button
            ref={notNowButtonRef}
            onClick={onDismiss}
            className="btn-secondary"
          >
            Not Now
          </button>
          <button onClick={onInstall} className="btn-primary">
            Install App
          </button>
        </div>
      </div>
    </div>
  );
}

InstallExplanationModal.propTypes = {
  onInstall: PropTypes.func.isRequired,
  onDismiss: PropTypes.func.isRequired,
};
