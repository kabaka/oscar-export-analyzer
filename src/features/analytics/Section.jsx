import React, { Suspense, lazy } from 'react';
import { ErrorBoundary } from '../../components/ui';
import { useAppContext } from '../../app/AppProviders';

const SummaryAnalysis = lazy(() => import('../../components/SummaryAnalysis'));

/**
 * Feature section wrapper for comprehensive CPAP analytics.
 *
 * Lazy-loads SummaryAnalysis component with error boundary and loading fallback.
 * Only renders if filtered summary data is available.
 *
 * @returns {JSX.Element | null} Analytics section or null if no data
 *
 * @see SummaryAnalysis - Main analytics component (lazy-loaded)
 */
export default function AnalyticsSection() {
  const { filteredSummary, apneaClusters } = useAppContext();

  if (!filteredSummary?.length) {
    return null;
  }

  return (
    <div className="section">
      <ErrorBoundary>
        <Suspense fallback={<div>Loading...</div>}>
          <SummaryAnalysis clusters={apneaClusters} />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
