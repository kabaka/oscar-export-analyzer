import React from 'react';
import { ErrorBoundary } from '../../components/ui';
import RawDataExplorer from '../../components/RawDataExplorer';
import { useAppContext } from '../../app/AppProviders';

/**
 * Feature section wrapper for raw data explorer.
 *
 * Provides searchable, sortable table view of Details CSV data with
 * ability to apply date filters. Only renders if Details CSV is available.
 *
 * @returns {JSX.Element | null} Data explorer table or null if no data
 *
 * @see RawDataExplorer - Table explorer component
 */
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
