import React from 'react';
import FitbitDashboard from '../../components/fitbit/FitbitDashboard';
import { useFitbitOAuthContext } from '../../context/FitbitOAuthContext';
import { useFitbitConnection } from '../../hooks/useFitbitConnection';
import { useFitbitAnalysis } from '../../hooks/useFitbitAnalysis';
import { useData } from '../../context/DataContext';

/**
 * Fitbit correlation analysis section for the main OSCAR app.
 *
 * Provides Fitbit OAuth connection management, data synchronization,
 * and correlation analysis between CPAP and Fitbit data.
 *
 * When both OSCAR CSV data and Fitbit heart rate data are available,
 * automatically runs the full correlation analysis pipeline and
 * populates the dashboard with insights.
 *
 * @returns {JSX.Element} Fitbit correlation analysis section
 */
export function FitbitCorrelationSection() {
  const { filteredSummary } = useData();

  const {
    status: connectionStatus,
    initiateAuth,
    disconnect,
    error: oauthError,
    clearError,
    passphrase,
  } = useFitbitOAuthContext();

  const {
    fitbitData: rawFitbitData,
    syncState,
    syncFitbitData,
    clearFitbitData,
  } = useFitbitConnection({ passphrase });

  // Run correlation analysis when both OSCAR and Fitbit data are available
  const { analysisData } = useFitbitAnalysis({
    oscarData: filteredSummary,
    fitbitSyncedData: rawFitbitData,
  });

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
          therapy data and biometric measurements. Syncs heart rate, SpO2, and
          sleep stage data for correlation with AHI and other CPAP metrics.
        </p>
      </div>

      <FitbitDashboard
        fitbitData={analysisData}
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
