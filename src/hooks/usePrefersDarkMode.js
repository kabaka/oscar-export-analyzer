import { useState, useEffect } from 'react';

/**
 * Tracks the user's system dark mode preference via CSS media query.
 *
 * Responds to changes in system theme settings (e.g., when OS theme changes).
 * Returns true if the system is set to dark mode.
 *
 * @returns {boolean} Whether system dark mode is active
 *
 * @example
 * const prefersDark = usePrefersDarkMode();
 * // Use in conjunction with useTheme for theme selection logic
 */
export function usePrefersDarkMode() {
  const [isDark, setIsDark] = useState(
    typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches,
  );
  useEffect(() => {
    if (!window.matchMedia) return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (e) => setIsDark(e.matches);
    mql.addEventListener('change', listener);
    return () => mql.removeEventListener('change', listener);
  }, []);
  return isDark;
}
