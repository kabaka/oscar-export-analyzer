import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

/**
 * Modal dialog warning users about printing considerations before print.
 *
 * Informs users that:
 * - PDF generation may take 1-2 minutes for large datasets
 * - Page breaks can be configured in settings
 * - Charts are included in export
 *
 * Provides proper focus management and keyboard accessibility (Escape to close,
 * Tab trapping within dialog).
 *
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether modal is visible
 * @param {Function} props.onClose - Callback to cancel print
 * @param {Function} props.onConfirm - Callback to proceed with print
 * @returns {JSX.Element | null} Modal dialog or null if not open
 *
 * @example
 * const [showWarning, setShowWarning] = useState(false);
 * return (
 *   <>
 *     <button onClick={() => setShowWarning(true)}>Print</button>
 *     <PrintWarningDialog
 *       isOpen={showWarning}
 *       onClose={() => setShowWarning(false)}
 *       onConfirm={() => { window.print(); setShowWarning(false); }}
 *     />
 *   </>
 * );
 */
export default function PrintWarningDialog({ isOpen, onClose, onConfirm }) {
  const cancelButtonRef = useRef(null);
  const dialogRef = useRef(null);

  // Focus management: focus cancel button when opened, restore focus on close
  useEffect(() => {
    if (!isOpen) return;

    const previousFocus = document.activeElement;

    // Focus the cancel button (default action)
    requestAnimationFrame(() => {
      cancelButtonRef.current?.focus();
    });

    // Restore focus when dialog closes
    return () => {
      if (previousFocus && typeof previousFocus.focus === 'function') {
        previousFocus.focus();
      }
    };
  }, [isOpen]);

  // Keyboard handling: Escape to close, Tab trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      // Escape key closes dialog
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      // Tab key trap: keep focus within dialog
      if (e.key === 'Tab') {
        const focusableElements = dialogRef.current?.querySelectorAll(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusableElements || focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        // Shift+Tab on first element: wrap to last
        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
        // Tab on last element: wrap to first
        else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="print-warning-title"
      aria-describedby="print-warning-description"
      onClick={(e) => {
        // Click on backdrop (not modal content) closes dialog
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        className="modal"
        style={{
          padding: 24,
          width: 'min(520px, 96vw)',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        <h3
          id="print-warning-title"
          style={{
            margin: 0,
            fontSize: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span role="img" aria-label="Warning">
            ⚠️
          </span>
          Print Sensitive Health Data?
        </h3>

        <div
          id="print-warning-description"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            fontSize: '0.95rem',
            lineHeight: 1.5,
          }}
        >
          <p style={{ margin: 0 }}>
            You are about to print a document containing Protected Health
            Information (PHI):
          </p>

          <ul style={{ margin: 0, paddingLeft: 24 }}>
            <li>AHI (Apnea-Hypopnea Index) scores and trends</li>
            <li>SpO2 (oxygen saturation) measurements</li>
            <li>Leak rates and pressure settings</li>
            <li>Session dates, times, and usage patterns</li>
            <li>Statistical analyses and personal health metrics</li>
          </ul>

          <div
            style={{
              background: 'var(--color-elevated)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              padding: 12,
            }}
          >
            <p style={{ margin: '0 0 8px 0', fontWeight: 600 }}>
              Before printing, ensure:
            </p>
            <ul style={{ margin: 0, paddingLeft: 24 }}>
              <li>You are in a private location</li>
              <li>The printer is secure and not shared</li>
              <li>You will handle printed pages appropriately</li>
              <li>Physical documents will be stored securely</li>
            </ul>
          </div>

          <p style={{ margin: 0, fontSize: '0.9rem', fontStyle: 'italic' }}>
            This data is processed locally in your browser for your privacy.
            Printing creates a physical copy outside of this secure environment.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 12,
            justifyContent: 'flex-end',
            marginTop: 4,
          }}
        >
          <button
            ref={cancelButtonRef}
            className="btn-primary"
            onClick={onClose}
            aria-label="Cancel printing"
          >
            Cancel
          </button>
          <button
            className="btn-warning"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            aria-label="Confirm and print sensitive health data"
            style={{
              background:
                'color-mix(in oklab, #d97706 20%, var(--color-surface))',
              borderColor:
                'color-mix(in oklab, #d97706 40%, var(--color-border))',
              color: 'var(--color-text)',
            }}
          >
            Print Anyway
          </button>
        </div>
      </div>
    </div>
  );
}

PrintWarningDialog.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
};
