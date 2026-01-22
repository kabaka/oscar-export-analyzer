import React, { useEffect, useRef } from 'react';

export default function StorageConsentDialog({
  isOpen,
  onAllow,
  onDeny,
  onDismiss,
}) {
  const denyButtonRef = useRef(null);
  const dialogRef = useRef(null);

  // Focus management: focus deny button (privacy-safe default) when opened, restore focus on close
  useEffect(() => {
    if (!isOpen) return;

    const previousFocus = document.activeElement;

    // Focus the deny button (privacy-safe default)
    requestAnimationFrame(() => {
      denyButtonRef.current?.focus();
    });

    // Restore focus when dialog closes
    return () => {
      if (previousFocus && typeof previousFocus.focus === 'function') {
        previousFocus.focus();
      }
    };
  }, [isOpen]);

  // Keyboard handling: Escape to dismiss, Tab trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      // Escape key dismisses dialog (same as "ask later")
      if (e.key === 'Escape') {
        e.preventDefault();
        onDismiss();
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
  }, [isOpen, onDismiss]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="storage-consent-title"
      aria-describedby="storage-consent-description"
      onClick={(e) => {
        // Click on backdrop (not modal content) dismisses dialog
        if (e.target === e.currentTarget) {
          onDismiss();
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
          id="storage-consent-title"
          style={{
            margin: 0,
            fontSize: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span role="img" aria-label="Lock">
            🔒
          </span>
          Save Data to This Browser?
        </h3>

        <div
          id="storage-consent-description"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            fontSize: '0.95rem',
            lineHeight: 1.5,
          }}
        >
          <p style={{ margin: 0 }}>
            To remember your uploaded data between visits, OSCAR Analyzer can
            save your session to this browser&apos;s local storage (IndexedDB).
          </p>

          <div>
            <p style={{ margin: '0 0 8px 0', fontWeight: 600 }}>
              This includes:
            </p>
            <ul style={{ margin: 0, paddingLeft: 24 }}>
              <li>All imported OSCAR CSV data (AHI, SpO2, pressure, dates)</li>
              <li>Chart filters and settings</li>
              <li>Analysis parameters</li>
            </ul>
          </div>

          <div
            style={{
              background: 'var(--color-elevated)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              padding: 12,
            }}
          >
            <p style={{ margin: '0 0 8px 0', fontWeight: 600 }}>Your data:</p>
            <ul style={{ margin: 0, paddingLeft: 24 }}>
              <li>✓ Stays on your device (private)</li>
              <li>✓ Is never sent to any server</li>
              <li>✓ Can be deleted anytime</li>
            </ul>
          </div>

          <p style={{ margin: 0, fontSize: '0.9rem', fontStyle: 'italic' }}>
            You can change this preference at any time from the Import menu.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            marginTop: 4,
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: 12,
              justifyContent: 'flex-end',
            }}
          >
            <button
              ref={denyButtonRef}
              className="btn-secondary"
              onClick={onDeny}
              aria-label="Don't save data to browser"
              style={{
                minWidth: 120,
                minHeight: 44,
              }}
            >
              Don&apos;t Save
            </button>
            <button
              className="btn-primary"
              onClick={onAllow}
              aria-label="Save data to browser"
              style={{
                minWidth: 120,
                minHeight: 44,
              }}
            >
              Save to Browser
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              className="btn-link"
              onClick={onDismiss}
              aria-label="Ask me later"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-text-secondary)',
                textDecoration: 'underline',
                cursor: 'pointer',
                fontSize: '0.9rem',
                padding: 8,
                minHeight: 44,
              }}
            >
              Ask me later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
