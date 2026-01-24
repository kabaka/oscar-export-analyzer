import React, { useRef, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';

/**
 * Post-installation onboarding modal explaining local-only storage model.
 *
 * Shows once after first PWA installation to set expectations about
 * local storage, cross-device workflow, and privacy guarantees.
 * Dismissal is persisted in IndexedDB (never shows again).
 *
 * @param {Object} props - Component props
 * @param {Function} props.onDismiss - Callback when user dismisses modal
 * @param {Function} props.onComplete - Callback to persist onboarding completion flag
 * @returns {JSX.Element} Modal dialog with onboarding content
 *
 * @example
 * <PostInstallOnboarding
 *   onDismiss={() => setShowModal(false)}
 *   onComplete={async () => {
 *     await db.put('app-preferences', {
 *       key: 'onboarding-completed',
 *       value: true,
 *       timestamp: Date.now()
 *     });
 *   }}
 * />
 */
export function PostInstallOnboarding({ onDismiss, onComplete }) {
  const gotItButtonRef = useRef(null);

  // Auto-focus "Got It" button
  useEffect(() => {
    gotItButtonRef.current?.focus();
  }, []);

  const handleDismiss = useCallback(() => {
    if (onComplete) {
      onComplete();
    }
    onDismiss();
  }, [onComplete, onDismiss]);

  // Handle Escape key
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        handleDismiss();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [handleDismiss]);

  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div className="modal-backdrop" onClick={handleDismiss} role="presentation">
      <div
        className="modal onboarding-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        aria-describedby="onboarding-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="onboarding-title">
            <span aria-hidden="true">🎉 </span>
            Welcome to OSCAR Analyzer
          </h2>
          <button
            onClick={handleDismiss}
            className="btn-ghost"
            aria-label="Close"
            style={{ fontSize: '1.5rem', padding: '4px 8px' }}
          >
            ×
          </button>
        </div>

        <div className="modal-body onboarding-modal-body">
          <div id="onboarding-desc">
            <section className="onboarding-section">
              <h3 className="onboarding-section-title">
                Your CPAP data stays on this device
              </h3>
              <p>
                For your privacy, this app stores data locally in your browser —
                it&apos;s never uploaded to servers or synced to cloud services.
              </p>
            </section>

            <div className="onboarding-divider" role="separator" />

            <section className="onboarding-section">
              <h3 className="onboarding-section-title">
                <span className="onboarding-icon" aria-hidden="true">
                  📱
                </span>
                Using multiple devices?
              </h3>
              <p>
                If you want to analyze data on another device (phone, tablet,
                other computer):
              </p>
              <ol className="onboarding-steps">
                <li>Export your session (Menu → Export JSON)</li>
                <li>Transfer JSON file (email, USB drive, AirDrop)</li>
                <li>Import on other device (Load Data → drop JSON)</li>
              </ol>
            </section>

            <div className="onboarding-divider" role="separator" />

            <section className="onboarding-section">
              <h3 className="onboarding-section-title">
                <span className="onboarding-icon" aria-hidden="true">
                  💡
                </span>
                Each device is independent — no automatic sync
              </h3>
              <p>
                This is by design to protect your health data. You have full
                control over when and where your data moves.
              </p>
            </section>
          </div>
        </div>

        <div className="modal-footer onboarding-modal-footer">
          <button
            ref={gotItButtonRef}
            onClick={handleDismiss}
            className="btn-primary"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}

PostInstallOnboarding.propTypes = {
  onDismiss: PropTypes.func.isRequired,
  onComplete: PropTypes.func,
};

PostInstallOnboarding.defaultProps = {
  onComplete: null,
};
