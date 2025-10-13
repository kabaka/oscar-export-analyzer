import React from 'react';
import {
  DAYS_PER_FIVE_YEARS,
  DAYS_PER_FORTNIGHT,
  DAYS_PER_HALF_YEAR,
  DAYS_PER_MONTH_APPROX,
  DAYS_PER_QUARTER_APPROX,
  DAYS_PER_WEEK,
  DAYS_PER_YEAR,
} from '../constants';

const QUICK_RANGE_OPTIONS = Object.freeze([
  { value: 'all', label: 'All' },
  { value: String(DAYS_PER_WEEK), label: `Last ${DAYS_PER_WEEK} days` },
  {
    value: String(DAYS_PER_FORTNIGHT),
    label: `Last ${DAYS_PER_FORTNIGHT} days`,
  },
  {
    value: String(DAYS_PER_MONTH_APPROX),
    label: `Last ${DAYS_PER_MONTH_APPROX} days`,
  },
  {
    value: String(DAYS_PER_QUARTER_APPROX),
    label: `Last ${DAYS_PER_QUARTER_APPROX} days`,
  },
  {
    value: String(DAYS_PER_HALF_YEAR),
    label: `Last ${DAYS_PER_HALF_YEAR} days`,
  },
  { value: String(DAYS_PER_YEAR), label: 'Last year' },
  { value: String(DAYS_PER_FIVE_YEARS), label: 'Last 5 years' },
  { value: 'custom', label: 'Custom' },
]);

function DateRangeControls({
  quickRange,
  onQuickRangeChange,
  dateFilter,
  onDateFilterChange,
  onCustomRange,
  onReset,
  parseDate,
  formatDate,
}) {
  return (
    <div className="date-filter">
      <select
        value={quickRange}
        onChange={(e) => onQuickRangeChange(e.target.value)}
        aria-label="Quick range"
      >
        {QUICK_RANGE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <input
        type="date"
        value={formatDate(dateFilter.start)}
        onChange={(e) => {
          onCustomRange();
          const value = parseDate(e.target.value);
          onDateFilterChange((prev) => ({ ...prev, start: value }));
        }}
        aria-label="Start date"
      />
      <span>-</span>
      <input
        type="date"
        value={formatDate(dateFilter.end)}
        onChange={(e) => {
          onCustomRange();
          const value = parseDate(e.target.value);
          onDateFilterChange((prev) => ({ ...prev, end: value }));
        }}
        aria-label="End date"
      />
      {(dateFilter.start || dateFilter.end) && (
        <button
          className="btn-ghost"
          onClick={onReset}
          aria-label="Reset date filter"
        >
          ×
        </button>
      )}
    </div>
  );
}

export default DateRangeControls;
