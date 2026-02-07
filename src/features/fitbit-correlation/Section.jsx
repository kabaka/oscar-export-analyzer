import React, { useMemo } from 'react';
import FitbitDashboard from '../../components/fitbit/FitbitDashboard';
import { useFitbitOAuthContext } from '../../context/FitbitOAuthContext';
import { useFitbitConnection } from '../../hooks/useFitbitConnection';
import { useFitbitAnalysis } from '../../hooks/useFitbitAnalysis';
import { useData } from '../../context/DataContext';
import { useDateFilter } from '../../hooks/useDateFilter';

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
 * Aligns Fitbit sync date range with OSCAR data:
 * - If a date filter is active, uses filter start/end
 * - Otherwise derives range from the min/max Date in filteredSummary
 *
 * @returns {JSX.Element} Fitbit correlation analysis section
 */
export function FitbitCorrelationSection() {
  const { filteredSummary } = useData();
  const { dateFilter } = useDateFilter();

  // Compute OSCAR date range for Fitbit sync alignment
  const oscarDateRange = useMemo(() => {
    // If date filter is active (has start and end), use it
    if (dateFilter?.start && dateFilter?.end) {
      const fmt = (d) =>
        d instanceof Date ? d.toISOString().split('T')[0] : String(d);
      return { start: fmt(dateFilter.start), end: fmt(dateFilter.end) };
    }

    // Otherwise derive range from filteredSummary min/max Date
    if (Array.isArray(filteredSummary) && filteredSummary.length > 0) {
      const dates = filteredSummary
        .map((r) => r.Date)
        .filter(Boolean)
        .sort();
      if (dates.length > 0) {
        return { start: dates[0], end: dates[dates.length - 1] };
      }
    }

    return null;
  }, [dateFilter, filteredSummary]);

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
  } = useFitbitConnection({ passphrase, oscarDateRange });

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
          therapy data and biometric measurements. Syncs heart rate and SpO2
          data for correlation with AHI and other CPAP metrics.
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
