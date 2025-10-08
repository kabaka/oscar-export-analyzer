import React, { useCallback } from 'react';
import ErrorBoundary from '../../components/ErrorBoundary';
import RangeComparisons from '../../components/RangeComparisons';
import GuideLink from '../../components/GuideLink';
import { useAppContext } from '../../app/AppProviders';

export default function RangeComparisonsSection() {
  const { filteredSummary, rangeA, setRangeA, rangeB, setRangeB, dateFilter } =
    useAppContext();

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

  const useCurrentFilter = useCallback(
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
        Range Comparisons <GuideLink anchor="range-comparisons-a-vs-b" label="Guide" />
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
        <button onClick={() => useCurrentFilter(setRangeA)}>
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
        <button onClick={() => useCurrentFilter(setRangeB)}>
          Use current filter as B
        </button>
      </div>
      <ErrorBoundary>
        <RangeComparisons rangeA={rangeA} rangeB={rangeB} />
      </ErrorBoundary>
    </div>
  );
}
