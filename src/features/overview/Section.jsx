import React from 'react';
import Overview from './Overview';
import { useAppContext } from '../../app/AppProviders';

/**
 * Feature section wrapper for overview dashboard.
 *
 * Renders high-level KPIs and sparklines. Only shows if Summary CSV
 * data is available.
 *
 * @returns {JSX.Element | null} Overview dashboard or null if no data
 *
 * @see Overview - Dashboard component
 */
export default function OverviewSection() {
  const { filteredSummary, apneaClusters, falseNegatives } = useAppContext();

  if (!filteredSummary?.length) {
    return null;
  }

  return (
    <div className="section">
      <Overview clusters={apneaClusters} falseNegatives={falseNegatives} />
    </div>
  );
}
