import { useEffect, useState } from 'react';

/**
 * Hook to detect responsive breakpoints using window.matchMedia.
 * Returns boolean indicating if the media query matches.
 *
 * @param {string} query - CSS media query string (e.g., '(max-width: 767px)')
 * @returns {boolean} True if media query matches, false otherwise
 *
 * @example
 * const isMobile = useMediaQuery('(max-width: 767px)');
 * const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
 * const isDesktop = useMediaQuery('(min-width: 1024px)');
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const handler = (event) => setMatches(event.matches);

    // Listen for changes
    mediaQuery.addEventListener('change', handler);

    return () => {
      mediaQuery.removeEventListener('change', handler);
    };
  }, [query]);

  return matches;
}

/**
 * Convenience hook for common responsive breakpoints.
 * Returns object with isMobile, isTablet, isDesktop booleans.
 *
 * Breakpoints:
 * - Mobile: <768px
 * - Tablet: 768px-1023px
 * - Desktop: ≥1024px
 *
 * @returns {{ isMobile: boolean, isTablet: boolean, isDesktop: boolean }}
 *
 * @example
 * const { isMobile, isTablet, isDesktop } = useResponsive();
 * if (isMobile) {
 *   return <MobileNav />;
 * }
 */
export function useResponsive() {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  return { isMobile, isTablet, isDesktop };
}
