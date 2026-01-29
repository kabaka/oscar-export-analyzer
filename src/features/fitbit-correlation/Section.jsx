import React, { useEffect } from 'react';
import FitbitDashboard from '../../components/fitbit/FitbitDashboard';
import { useFitbitOAuthContext } from '../../context/FitbitOAuthContext';
import { useFitbitConnection } from '../../hooks/useFitbitConnection';

/**
 * Fitbit correlation analysis section for the main OSCAR app.
 *
 * Provides Fitbit OAuth connection management, data synchronization,
 * and correlation analysis between CPAP and Fitbit data.
 *
 * Only rendered when OSCAR data is available for correlation.
 *
 * @returns {JSX.Element} Fitbit correlation analysis section
 */
export function FitbitCorrelationSection() {
  const {
    status: connectionStatus,
    initiateAuth,
    disconnect,
    error: oauthError,
    clearError,
  } = useFitbitOAuthContext();

  // Auto-connect if passphrase is present in sessionStorage and not already connected
  useEffect(() => {
    if (connectionStatus !== 'connected' && typeof window !== 'undefined') {
      const passphrase = sessionStorage.getItem('fitbit_session_passphrase');
      if (passphrase) {
        // Optionally, trigger a silent connection or data load here
        // This could be improved by exposing a connectWithPassphrase method
        // For now, just reload the page section or trigger a sync if needed
        // (Implementation may vary based on actual connection logic)
      }
    }
  }, [connectionStatus]);

  const { fitbitData, syncState, syncFitbitData, clearFitbitData } =
    useFitbitConnection();

  const handleConnect = async () => {
    try {
      clearError();
      await initiateAuth();
    } catch (error) {
      console.error('Failed to initiate Fitbit connection:', error);
    }
  };

  const handleDisconnect = async () => {
    try {
      clearError();
      await disconnect();
      clearFitbitData();
      // Remove passphrase from sessionStorage on disconnect for security
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('fitbit_session_passphrase');
      }
    } catch (error) {
      console.error('Failed to disconnect Fitbit:', error);
    }
  };

  const handleSync = async () => {
    try {
      await syncFitbitData();
    } catch (error) {
      console.error('Failed to sync Fitbit data:', error);
    }
  };

  return (
    <section
      id="fitbit-correlation"
      className="chart-section"
      role="region"
      aria-labelledby="fitbit-section-title"
    >
      <div className="section-header">
        <h2 id="fitbit-section-title" className="section-title">
          <span className="section-icon">📱</span>
          Fitbit Correlation Analysis
        </h2>
        <p className="section-description">
          Connect your Fitbit account to analyze correlations between sleep
          therapy data and biometric measurements. Compare AHI events with heart
          rate variability, sleep stages, and SpO2 readings.
        </p>
      </div>

      <FitbitDashboard
        fitbitData={fitbitData}
        connectionStatus={connectionStatus}
        syncState={syncState}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        onSync={handleSync}
        className="fitbit-dashboard-container"
      />

      {oauthError && (
        <div className="error-message" role="alert">
          <strong>Connection Error:</strong> {oauthError.message}
          {oauthError.details && (
            <details>
              <summary>Technical Details</summary>
              <pre>{oauthError.details}</pre>
            </details>
          )}
          <button onClick={clearError} className="error-dismiss">
            Dismiss
          </button>
        </div>
      )}
    </section>
  );
}

export default FitbitCorrelationSection;
