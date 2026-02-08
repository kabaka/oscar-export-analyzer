import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { useFitbitOAuth } from '../hooks/useFitbitOAuth.jsx';
import { FITBIT_OAUTH_STORAGE_KEYS } from '../constants/fitbit.js';
import { fitbitOAuth } from '../utils/fitbitAuth.js';

const FitbitOAuthContext = createContext(null);

/**
 * Provides Fitbit OAuth authentication state and methods to the app.
 * Wraps children with a single shared context for OAuth flow management.
 *
 * This context provides a centralized way to manage Fitbit OAuth state across
 * the component tree, including authentication status, error handling, and
 * connection management.
 *
 * @param {Object} props - Provider props
 * @param {React.ReactNode} props.children - Descendant components that need OAuth state
 * @param {Function} props.onSuccess - Optional success callback for OAuth completion
 * @param {Function} props.onError - Optional error callback for OAuth failures
 * @returns {JSX.Element} Context provider with shared OAuth state and methods
 *
 * @example
 * <FitbitOAuthProvider onSuccess={handleAuthSuccess} onError={handleAuthError}>
 *   <FitbitDashboard />
 * </FitbitOAuthProvider>
 */
export function FitbitOAuthProvider({ children, onSuccess, onError }) {
  // Passphrase state — recovered from sessionStorage on mount for OAuth redirect recovery
  const [passphrase, setPassphrase] = useState(() => {
    if (typeof window !== 'undefined') {
      return (
        sessionStorage.getItem(FITBIT_OAUTH_STORAGE_KEYS.PASSPHRASE) || null
      );
    }
    return null;
  });

  // Use the existing OAuth hook to get all authentication functionality
  const oauthState = useFitbitOAuth({ onSuccess, onError });

  /**
   * Recover a Fitbit connection by re-entering the encryption passphrase.
   * Stores the passphrase in state and sessionStorage, then verifies it
   * can decrypt the stored tokens.
   *
   * @param {string} passphraseValue - The user's encryption passphrase
   * @returns {Promise<boolean>} True if passphrase decrypts tokens successfully
   */
  const recoverWithPassphrase = useCallback(
    async (passphraseValue) => {
      try {
        // Store passphrase for the session
        setPassphrase(passphraseValue);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(
            FITBIT_OAUTH_STORAGE_KEYS.PASSPHRASE,
            passphraseValue,
          );
        }

        // Verify the passphrase can decrypt stored tokens
        const isAuth = await fitbitOAuth.isAuthenticated(passphraseValue);
        if (!isAuth) {
          // Clear invalid passphrase
          setPassphrase(null);
          sessionStorage.removeItem(FITBIT_OAUTH_STORAGE_KEYS.PASSPHRASE);
        }
        return isAuth;
      } catch {
        setPassphrase(null);
        sessionStorage.removeItem(FITBIT_OAUTH_STORAGE_KEYS.PASSPHRASE);
        return false;
      }
    },
    [setPassphrase],
  );

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(
    () => ({
      // Authentication state
      status: oauthState.status,
      error: oauthState.error,
      isLoading: oauthState.isLoading,
      connectionInfo: oauthState.connectionInfo,

      // Authentication methods
      initiateAuth: oauthState.initiateAuth,
      handleCallback: oauthState.handleCallback,
      disconnect: oauthState.disconnect,
      clearError: oauthState.clearError,

      // Token management
      refreshToken: oauthState.refreshToken,
      getValidToken: oauthState.getValidToken,

      // Error handling
      handleOAuthError: oauthState.handleOAuthError,

      // Connection utilities
      isConnected: oauthState.status === 'connected',
      isConnecting: oauthState.status === 'connecting',
      hasError: !!oauthState.error,

      // Passphrase management
      passphrase,
      setPassphrase,
      recoverWithPassphrase,
    }),
    [oauthState, passphrase, recoverWithPassphrase],
  );

  return (
    <FitbitOAuthContext.Provider value={value}>
      {children}
    </FitbitOAuthContext.Provider>
  );
}

/**
 * Accessor hook for the Fitbit OAuth context.
 * Must be used within a FitbitOAuthProvider; throws otherwise.
 *
 * @returns {Object} OAuth context containing authentication state and methods
 * @throws {Error} If used outside of FitbitOAuthProvider
 *
 * @example
 * function ConnectButton() {
 *   const { initiateAuth, isConnected, error } = useFitbitOAuthContext();
 *
 *   if (error) {
 *     return <div>Error: {error.message}</div>;
 *   }
 *
 *   return (
 *     <button onClick={initiateAuth} disabled={isConnected}>
 *       {isConnected ? 'Connected' : 'Connect to Fitbit'}
 *     </button>
 *   );
 * }
 */
export function useFitbitOAuthContext() {
  const context = useContext(FitbitOAuthContext);
  if (!context) {
    throw new Error(
      'useFitbitOAuthContext must be used within a FitbitOAuthProvider',
    );
  }
  return context;
}

export default FitbitOAuthContext;
