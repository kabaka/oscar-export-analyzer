import React, { Suspense, lazy } from 'react';
import ErrorBoundary from '../../components/ErrorBoundary';
import { useAppContext } from '../../app/AppProviders';

const SummaryAnalysis = lazy(() => import('../../components/SummaryAnalysis'));

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
