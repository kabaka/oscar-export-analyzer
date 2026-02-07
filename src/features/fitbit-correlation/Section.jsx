import React from 'react';
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
    passphrase,
  } = useFitbitOAuthContext();

  const { fitbitData, syncState, syncFitbitData, clearFitbitData } =
    useFitbitConnection({ passphrase });

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
          therapy data and biometric measurements. Currently syncs resting heart
          rate data for correlation with AHI and other CPAP metrics.
        </p>
        <p
          className="section-description"
          style={{ fontSize: '0.85em', color: 'var(--text-muted, #666)' }}
        >
          <strong>Note:</strong> SpO2 and sleep data sync is currently
          unavailable due to{' '}
          <a
            href="https://community.fitbit.com/t5/Web-API-Development/Known-Issue-HRV-and-BR-Intraday-data-endpoint-returns-403-for-personal/td-p/5806264"
            target="_blank"
            rel="noopener noreferrer"
          >
            Fitbit API CORS limitations
          </a>{' '}
          that prevent browser-based apps from accessing these endpoints. Heart
          rate correlation is fully functional.
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
