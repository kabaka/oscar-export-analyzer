import React from 'react';
import Overview from '../../components/Overview';
import { useAppContext } from '../../app/AppProviders';

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
