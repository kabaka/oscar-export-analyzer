import React, { useCallback } from 'react';
import { ErrorBoundary, GuideLink } from '../../components/ui';
import RangeComparisons from './RangeComparisons';
import { useData } from '../../context/DataContext';
import { useDateFilter } from '../../hooks/useDateFilter';
import { useRangeComparisons } from '../../hooks/useRangeComparisons';

/**
 * Feature section wrapper for range comparison analysis.
 *
 * Provides UI for selecting two date ranges and displays comparative
 * statistics. Only renders if Summary CSV data is available.
 * Uses granular hooks to access range and filter state directly from context.
 *
 * @returns {JSX.Element | null} Section with range controls and comparison, or null if no data
 *
 * @see RangeComparisons - Comparison component
 */
export default function RangeComparisonsSection() {
  const { filteredSummary } = useData();
  const { dateFilter } = useDateFilter();
  const { rangeA, setRangeA, rangeB, setRangeB } = useRangeComparisons();

  const hasSummary = !!filteredSummary?.length;

  const handleRangeChange = useCallback(
    (setter, key) => (event) => {
      const { value } = event.target;
      setter((prev) => ({
        ...prev,
        [key]: value ? new Date(value) : null,
      }));
    },
    [],
  );

  const applyCurrentFilter = useCallback(
    (setter) => {
      setter(dateFilter ? { ...dateFilter } : { start: null, end: null });
    },
    [dateFilter],
  );

  if (!hasSummary) {
    return null;
  }

  return (
    <div className="section">
      <h2 id="range-compare">
        Range Comparisons{' '}
        <GuideLink anchor="range-comparisons-a-vs-b" label="Guide" />
      </h2>
      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          alignItems: 'end',
        }}
      >
        <div>
          <label>
            Range A start{' '}
            <input
              type="date"
              onChange={handleRangeChange(setRangeA, 'start')}
            />
          </label>
        </div>
        <div>
          <label>
            Range A end{' '}
            <input type="date" onChange={handleRangeChange(setRangeA, 'end')} />
          </label>
        </div>
        <button onClick={() => applyCurrentFilter(setRangeA)}>
          Use current filter as A
        </button>
        <div style={{ width: 12 }} />
        <div>
          <label>
            Range B start{' '}
            <input
              type="date"
              onChange={handleRangeChange(setRangeB, 'start')}
            />
          </label>
        </div>
        <div>
          <label>
            Range B end{' '}
            <input type="date" onChange={handleRangeChange(setRangeB, 'end')} />
          </label>
        </div>
        <button onClick={() => applyCurrentFilter(setRangeB)}>
          Use current filter as B
        </button>
      </div>
      <ErrorBoundary>
        <RangeComparisons rangeA={rangeA} rangeB={rangeB} />
      </ErrorBoundary>
    </div>
  );
}
