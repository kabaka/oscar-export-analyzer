import React, { createContext, useContext, useMemo } from 'react';
import { useFitbitOAuth } from '../hooks/useFitbitOAuth.js';

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
  // Use the existing OAuth hook to get all authentication functionality
  const oauthState = useFitbitOAuth({ onSuccess, onError });

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

      // Connection utilities
      isConnected: oauthState.status === 'connected',
      isConnecting: oauthState.status === 'connecting',
      hasError: !!oauthState.error,
    }),
    [oauthState],
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
