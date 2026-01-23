/**
 * Provides interactive date range filtering controls with quick-select presets.
 *
 * Features:
 * - Dropdown for quick date range selections (Last 7 days, Last year, etc.)
 * - Custom date input fields for specifying exact start and end dates
 * - Reset button to clear custom filters and return to "All" data
 * - Parse/format hooks for converting between Date objects and input strings
 * - Direct context access via useDateFilter hook (no prop drilling)
 *
 * The component displays both quick-select dropdown and date inputs simultaneously,
 * allowing users to either pick a preset or manually enter custom dates.
 *
 * @returns {JSX.Element} A div containing date filter dropdown and date input fields
 *
 * @example
 * // No props needed - component accesses context directly
 * return <DateRangeControls />;
 */
import React from 'react';
import { useDateFilter } from '../hooks/useDateFilter';
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

/**
 * Provides controls for filtering data by date range with quick-select presets.
 *
 * Displays a dropdown for quick date ranges ("Last 7 days", "Last year", etc.) and
 * optionally shows date input fields for custom date range selection. Accesses date
 * filter state directly from context via useDateFilter hook.
 *
 * @returns {JSX.Element} A div containing date filter dropdown and conditional date inputs
 *
 * @example
 * // No props needed - component accesses context directly
 * return <DateRangeControls />;
 */
function DateRangeControls() {
  const {
    quickRange,
    handleQuickRangeChange,
    dateFilter,
    setDateFilter,
    selectCustomRange,
    resetDateFilter,
    parseDate,
    formatDate,
  } = useDateFilter();
  return (
    <div className="date-filter">
      <select
        value={quickRange}
        onChange={(e) => handleQuickRangeChange(e.target.value)}
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
          selectCustomRange();
          const value = parseDate(e.target.value);
          setDateFilter((prev) => ({ ...prev, start: value }));
        }}
        aria-label="Start date"
      />
      <span>-</span>
      <input
        type="date"
        value={formatDate(dateFilter.end)}
        onChange={(e) => {
          selectCustomRange();
          const value = parseDate(e.target.value);
          setDateFilter((prev) => ({ ...prev, end: value }));
        }}
        aria-label="End date"
      />
      {(dateFilter.start || dateFilter.end) && (
        <button
          className="btn-ghost"
          onClick={resetDateFilter}
          aria-label="Reset date filter"
        >
          ×
        </button>
      )}
    </div>
  );
}

export default DateRangeControls;
