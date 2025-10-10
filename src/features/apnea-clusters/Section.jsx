import React, { Suspense, lazy } from 'react';
import { ErrorBoundary } from '../../components/ui';
import { useAppContext } from '../../app/AppProviders';

const ApneaEventStats = lazy(() => import('./ApneaEventStats'));
const ApneaClusterAnalysis = lazy(() => import('./ApneaClusterAnalysis'));

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
