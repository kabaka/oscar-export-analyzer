import React from 'react';
import { ErrorBoundary } from '../../components/ui';
import { useAppContext } from '../../app/AppProviders';
import SummaryAnalysis from '../../components/SummaryAnalysis';

/**
 * Feature section wrapper for comprehensive CPAP analytics.
 *
 * Renders SummaryAnalysis component with error boundary.
 * Only renders if filtered summary data is available.
 *
 * @returns {JSX.Element | null} Analytics section or null if no data
 *
 * @see SummaryAnalysis - Main analytics component
 */
export default function AnalyticsSection() {
  const { filteredSummary, apneaClusters } = useAppContext();

  if (!filteredSummary?.length) {
    return null;
  }

  return (
    <div className="section">
      <ErrorBoundary>
        <SummaryAnalysis clusters={apneaClusters} />
      </ErrorBoundary>
    </div>
  );
}
