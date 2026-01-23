import React, { Suspense, lazy } from 'react';
import { ErrorBoundary } from '../../components/ui';
import { useAppContext } from '../../app/AppProviders';

const ApneaEventStats = lazy(() => import('./ApneaEventStats'));
const ApneaClusterAnalysis = lazy(() => import('./ApneaClusterAnalysis'));

/**
 * Feature section wrapper for apnea cluster analysis.
 *
 * Lazy-loads both ApneaEventStats and ApneaClusterAnalysis components
 * with error boundaries. Only renders if Details CSV data is available.
 *
 * @returns {JSX.Element | null} Section with cluster analysis components or null
 *
 * @see ApneaEventStats - Event-level statistics
 * @see ApneaClusterAnalysis - Cluster-level analysis
 */
export default function ApneaClustersSection() {
  const {
    filteredDetails,
    apneaClusters,
    clusterParams,
    onClusterParamChange,
  } = useAppContext();

  if (!filteredDetails?.length) {
    return null;
  }

  return (
    <>
      <div className="section">
        <ErrorBoundary>
          <Suspense fallback={<div>Loading...</div>}>
            <ApneaEventStats />
          </Suspense>
        </ErrorBoundary>
      </div>
      <div className="section">
        <ErrorBoundary>
          <Suspense fallback={<div>Loading...</div>}>
            <ApneaClusterAnalysis
              clusters={apneaClusters}
              params={clusterParams}
              onParamChange={onClusterParamChange}
              details={filteredDetails}
            />
          </Suspense>
        </ErrorBoundary>
      </div>
    </>
  );
}
