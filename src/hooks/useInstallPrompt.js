import { useState, useEffect } from 'react';

/**
 * Custom hook to detect PWA install capability and manage install prompt.
 *
 * Detects `beforeinstallprompt` event (Chrome/Edge) and standalone mode
 * (app already installed). Provides a function to trigger the browser's
 * native install dialog.
 *
 * @returns {Object} Install state and actions
 * @property {Event|null} installPrompt - Browser's beforeinstallprompt event (null if not installable)
 * @property {Function} promptInstall - Triggers browser install dialog
 * @property {boolean} isInstalled - Whether app is already installed (standalone mode)
 *
 * @example
 * const { installPrompt, promptInstall, isInstalled } = useInstallPrompt();
 *
 * if (installPrompt && !isInstalled) {
 *   return <button onClick={promptInstall}>Install App</button>;
 * }
 */
export function useInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(
    window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true, // iOS Safari
  );

  useEffect(() => {
    // Capture beforeinstallprompt event (Chrome/Edge)
    const handleBeforeInstallPrompt = (event) => {
      // Prevent default browser install prompt
      event.preventDefault();
      // Store event for later use
      setInstallPrompt(event);
    };

    // Listen for successful app installation
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt,
      );
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  /**
   * Triggers the browser's native install dialog.
   * Must be called in response to user interaction (e.g., button click).
   *
   * @returns {Promise<{outcome: string}>} Result of install prompt
   */
  const promptInstall = async () => {
    if (!installPrompt) {
      return { outcome: 'no-prompt' };
    }

    // Show browser's native install dialog
    installPrompt.prompt();

    // Wait for user to respond to the prompt
    const result = await installPrompt.userChoice;

    // Clear stored prompt (can only be used once)
    setInstallPrompt(null);

    return result;
  };

  return {
    installPrompt,
    promptInstall,
    isInstalled,
  };
}
