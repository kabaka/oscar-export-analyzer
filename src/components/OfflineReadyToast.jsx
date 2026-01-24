import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

/**
 * Toast notification confirming PWA offline capability is ready.
 *
 * Shows once when service worker activates for first time. Auto-dismisses
 * after 8 seconds or can be manually dismissed. Never shows again after
 * first viewing (localStorage flag persists).
 *
 * @param {Object} props - Component props
 * @param {boolean} props.show - Whether to show toast
 * @param {Function} props.onDismiss - Callback when toast is dismissed
 * @returns {JSX.Element|null} Toast notification or null if not showing
 *
 * @example
 * const [showToast, setShowToast] = useState(false);
 *
 * registerSW({
 *   onOfflineReady() {
 *     const hasSeenToast = localStorage.getItem('offline-toast-shown');
 *     if (!hasSeenToast) {
 *       setShowToast(true);
 *       localStorage.setItem('offline-toast-shown', 'true');
 *     }
 *   }
 * });
 *
 * return <OfflineReadyToast show={showToast} onDismiss={() => setShowToast(false)} />;
 */
export function OfflineReadyToast({ show, onDismiss }) {
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!show || isPaused) {
      // Clear timer if paused or not showing
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // Start/restart timer when showing and not paused
    timerRef.current = setTimeout(() => {
      onDismiss();
    }, 8000);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [show, isPaused, onDismiss]);

  if (!show) {
    return null;
  }

  return (
    <div
      className="toast toast-success"
      role="status"
      aria-live="polite"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <button
        className="toast-close"
        onClick={onDismiss}
        aria-label="Dismiss notification"
      >
        ×
      </button>

      <div className="toast-content">
        <span className="toast-icon" aria-hidden="true">
          ✓
        </span>
        <div className="toast-message">
          <strong>App installed successfully</strong>
          <p>You can now analyze OSCAR data offline — no internet required.</p>
        </div>
      </div>

      <div className="toast-action">
        <button onClick={onDismiss} className="btn-toast">
          Got it
        </button>
      </div>
    </div>
  );
}

OfflineReadyToast.propTypes = {
  show: PropTypes.bool.isRequired,
  onDismiss: PropTypes.func.isRequired,
};
