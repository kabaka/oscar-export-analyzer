import { useState, useEffect } from 'react';

/**
 * Hook to track if the user prefers a dark color scheme.
 * @returns {boolean} true if the system is in dark mode.
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
