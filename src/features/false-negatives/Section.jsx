import React, { Suspense, lazy } from 'react';
import { ErrorBoundary } from '../../components/ui';
import { useData } from '../../context/DataContext';
import { useFalseNegatives } from '../../hooks/useFalseNegatives';

const FalseNegativesAnalysis = lazy(
  () => import('../../components/FalseNegativesAnalysis'),
);

/**
 * Feature section wrapper for false negative cluster analysis.
 *
 * Lazy-loads FalseNegativesAnalysis component with error boundary.
 * Allows users to switch between detection presets (strict, balanced, lenient).
 * Only renders if Details CSV data is available.
 * Uses granular hooks to access false negative state directly from context.
 *
 * @returns {JSX.Element | null} Section with false negative analysis or null if no data
 *
 * @see FalseNegativesAnalysis - Detection analysis component
 * @see detectFalseNegatives - Detection algorithm
 */
export default function FalseNegativesSection() {
  const { filteredDetails } = useData();
  const { falseNegatives, fnPreset, setFnPreset } = useFalseNegatives();

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
