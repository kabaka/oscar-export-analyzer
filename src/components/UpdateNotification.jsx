import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

/**
 * UpdateNotification component displays a non-blocking update prompt
 * when a new version of the app is available. Appears in bottom-right
 * corner with professional styling and full accessibility support.
 *
 * @component
 * @param {Object} props
 * @param {Function} props.onUpdate - Callback when user clicks "Update Now"
 * @param {Function} props.onDismiss - Callback when user clicks "Not Now"
 * @returns {JSX.Element} Update notification alert dialog
 *
 * @example
 * <UpdateNotification
 *   onUpdate={handleUpdateClick}
 *   onDismiss={handleDismiss}
 * />
 */
export function UpdateNotification({ onUpdate, onDismiss }) {
  const updateRef = useRef(null);

  useEffect(() => {
    // Auto-focus notification for keyboard users
    updateRef.current?.focus();
  }, []);

  const handleKeyDown = (e) => {
    // Allow Escape key to dismiss notification
    if (e.key === 'Escape') {
      onDismiss();
    }
  };

  return (
    <div
      ref={updateRef}
      className="update-notification"
      role="alertdialog"
      aria-labelledby="update-title"
      aria-describedby="update-desc"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      <div className="update-content">
        <span className="update-icon" aria-hidden="true">
          ↻
        </span>
        <div className="update-message">
          <h3 id="update-title">New Version Available</h3>
          <p id="update-desc">
            OSCAR Analyzer has been updated. Reload to get the latest features
            and improvements?
          </p>
        </div>
      </div>
      <div className="update-actions">
        <button
          onClick={onDismiss}
          className="btn-secondary"
          aria-label="Dismiss update notification and continue with current version"
        >
          Not Now
        </button>
        <button
          onClick={onUpdate}
          className="btn-primary"
          aria-label="Update now and reload the application"
        >
          Update Now
        </button>
      </div>
    </div>
  );
}

UpdateNotification.propTypes = {
  onUpdate: PropTypes.func.isRequired,
  onDismiss: PropTypes.func.isRequired,
};

export default UpdateNotification;
