import React from 'react';
import ErrorBoundary from '../../components/ErrorBoundary';
import RawDataExplorer from '../../components/RawDataExplorer';
import { useAppContext } from '../../app/AppProviders';

export default function RawExplorerSection() {
  const { filteredDetails, setDateFilter } = useAppContext();

  if (!filteredDetails?.length) {
    return null;
  }

  return (
    <div className="section">
      <ErrorBoundary>
        <RawDataExplorer
          onApplyDateFilter={({ start, end }) => setDateFilter({ start, end })}
        />
      </ErrorBoundary>
    </div>
  );
}
