import React from 'react';
import { useTheme, THEMES } from '../hooks/useTheme';

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
