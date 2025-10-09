import React, { Suspense, lazy } from 'react';
import ErrorBoundary from '../../components/ErrorBoundary';
import { useAppContext } from '../../app/AppProviders';

const FalseNegativesAnalysis = lazy(
  () => import('../../components/FalseNegativesAnalysis'),
);

export default function FalseNegativesSection() {
  const { filteredDetails, falseNegatives, fnPreset, setFnPreset } =
    useAppContext();

  if (!filteredDetails?.length) {
    return null;
  }

  return (
    <div className="section">
      <ErrorBoundary>
        <Suspense fallback={<div>Loading...</div>}>
          <FalseNegativesAnalysis
            list={falseNegatives}
            preset={fnPreset}
            onPresetChange={setFnPreset}
          />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
