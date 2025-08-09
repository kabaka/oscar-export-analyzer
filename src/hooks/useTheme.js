import { useEffect, useState } from 'react';

// Supported themes
export const THEMES = {
  SYSTEM: 'system',
  LIGHT: 'light',
  DARK: 'dark',
};

/**
 * useTheme manages app theme: 'light' | 'dark' | 'system'.
 * Sets `data-theme` on <html> and persists preference.
 */
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return THEMES.SYSTEM;
    const stored = window.localStorage.getItem('theme');
    return stored === THEMES.LIGHT || stored === THEMES.DARK ? stored : THEMES.SYSTEM;
  });

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (theme === THEMES.SYSTEM) {
      root.removeAttribute('data-theme');
      window.localStorage.removeItem('theme');
    } else {
      root.setAttribute('data-theme', theme);
      window.localStorage.setItem('theme', theme);
    }
  }, [theme]);

  return { theme, setTheme };
}

