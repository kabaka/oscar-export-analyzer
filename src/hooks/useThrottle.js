import { useRef, useCallback } from 'react';

/**
 * Hook that throttles a callback function.
 * The callback will only execute at most once every `delay` milliseconds.
 *
 * @param {Function} callback - The function to throttle
 * @param {number} delay - Throttle delay in milliseconds (default: 100)
 * @returns {Function} Throttled callback
 */
export function useThrottle(callback, delay = 100) {
  const lastCallRef = useRef(null);
  const timeoutRef = useRef(null);

  const throttledCallback = useCallback(
    (...args) => {
      const now = Date.now();
      const timeSinceLastCall = now - (lastCallRef.current || 0);

      if (timeSinceLastCall >= delay) {
        // Enough time has passed, execute immediately
        lastCallRef.current = now;
        callback(...args);

        // Clear any pending timeout since we just executed
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      } else {
        // Not enough time has passed, schedule for later
        if (!timeoutRef.current) {
          const remainingDelay = delay - timeSinceLastCall;
          timeoutRef.current = setTimeout(() => {
            lastCallRef.current = Date.now();
            callback(...args);
            timeoutRef.current = null;
          }, remainingDelay);
        }
      }
    },
    [callback, delay],
  );

  return throttledCallback;
}
