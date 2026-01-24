import React, { useState, useEffect } from 'react';

/**
 * Offline status indicator for PWA mode.
 *
 * Shows network connectivity status with icon and tooltip. Changes from
 * subtle online state (📡 gray) to prominent offline state (✈️ amber).
 * Only visible in installed PWA mode (not web browser).
 *
 * Uses ARIA live region to announce offline status to screen readers.
 * Respects WCAG AA contrast requirements and supports both light/dark themes.
 *
 * @returns {JSX.Element|null} Offline indicator or null if not in PWA mode
 *
 * @example
 * // In App header:
 * <div className="app-header">
 *   <ThemeToggle />
 *   <OfflineIndicator />
 * </div>
 */
export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [isStandalone] = useState(
    window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true,
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Only show in PWA mode
  if (!isStandalone) {
    return null;
  }

  const icon = isOnline ? '📡' : '✈️';
  const title = isOnline
    ? 'App ready — works offline'
    : 'Offline mode — analysis still works';
  const ariaLabel = isOnline ? 'Online' : 'Offline';

  return (
    <div
      className={`offline-indicator ${!isOnline ? 'offline' : ''}`}
      role="status"
      aria-live="polite"
      title={title}
    >
      <span aria-label={ariaLabel}>{icon}</span>

      {/* Hidden screen reader announcement (only when offline) */}
      {!isOnline && (
        <span className="sr-only">
          Network unavailable. Analysis continues normally.
        </span>
      )}
    </div>
  );
}
