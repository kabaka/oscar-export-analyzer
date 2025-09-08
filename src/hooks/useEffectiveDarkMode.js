import { useEffect, useState } from 'react';

function computeIsDark() {
  if (typeof document === 'undefined') return false;
  const root = document.documentElement;
  const attr = root.getAttribute('data-theme');
  if (attr === 'dark') return true;
  if (attr === 'light') return false;
  // System preference
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
}

export function useEffectiveDarkMode() {
  const [isDark, setIsDark] = useState(computeIsDark());

  useEffect(() => {
    const root = document.documentElement;
    const mql = window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;

    const update = () => setIsDark(computeIsDark());

    // Observe data-theme attribute changes
    const observer = new MutationObserver(update);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    // React to system theme changes when in system mode
    if (mql && mql.addEventListener) {
      mql.addEventListener('change', update);
    } else if (mql && mql.addListener) {
      mql.addListener(update);
    }

    // Initial sync
    update();

    return () => {
      observer.disconnect();
      if (mql && mql.removeEventListener)
        mql.removeEventListener('change', update);
      else if (mql && mql.removeListener) mql.removeListener(update);
    };
  }, []);

  return isDark;
}
