import React from 'react';
import { useTheme, THEMES } from '../../hooks/useTheme';

/**
 * Toggle button group for switching between light, dark, and system themes.
 *
 * Radio buttons with emoji icons (☀️ 🌙 🖥️) for visual clarity.
 * Screen readers see descriptive text via sr-only class.
 * Syncs with useTheme hook and updates global theme context.
 *
 * @returns {JSX.Element} A radio button group for theme selection
 *
 * @example
 * <ThemeToggle />
 *
 * @see useTheme - Hook managing theme state
 * @see THEMES - Theme constant values (LIGHT, DARK, SYSTEM)
 */
export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="theme-toggle" role="group" aria-label="Theme">
      <label className={theme === THEMES.LIGHT ? 'active' : ''}>
        <input
          type="radio"
          name="theme"
          value={THEMES.LIGHT}
          checked={theme === THEMES.LIGHT}
          onChange={() => setTheme(THEMES.LIGHT)}
        />
        <span aria-hidden>☀️</span>
        <span className="sr-only">Light</span>
      </label>
      <label className={theme === THEMES.DARK ? 'active' : ''}>
        <input
          type="radio"
          name="theme"
          value={THEMES.DARK}
          checked={theme === THEMES.DARK}
          onChange={() => setTheme(THEMES.DARK)}
        />
        <span aria-hidden>🌙</span>
        <span className="sr-only">Dark</span>
      </label>
      <label className={theme === THEMES.SYSTEM ? 'active' : ''}>
        <input
          type="radio"
          name="theme"
          value={THEMES.SYSTEM}
          checked={theme === THEMES.SYSTEM}
          onChange={() => setTheme(THEMES.SYSTEM)}
        />
        <span aria-hidden>🖥️</span>
        <span className="sr-only">System</span>
      </label>
    </div>
  );
}
