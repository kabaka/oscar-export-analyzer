/**
 * Provides interactive date range filtering controls with quick-select presets.
 *
 * Features:
 * - Dropdown for quick date range selections (Last 7 days, Last year, etc.)
 * - Custom date input fields for specifying exact start and end dates
 * - Reset button to clear custom filters and return to "All" data
 * - Parse/format hooks for converting between Date objects and input strings
 * - Callback on each change to sync with parent component state
 *
 * The component displays both quick-select dropdown and date inputs simultaneously,
 * allowing users to either pick a preset or manually enter custom dates.
 *
 * @param {Object} props - Component props
 * @param {string} props.quickRange - Current quick-range selection value (e.g., 'all', '7', 'custom', '30')
 * @param {Function} props.onQuickRangeChange - Callback when quick-range dropdown changes:
 *   (value: string) => void (value is 'all', number as string, or 'custom')
 * @param {Object} props.dateFilter - Current date filter state: { start: Date | null, end: Date | null }
 * @param {Function} props.onDateFilterChange - Callback when date inputs change:
 *   (updater: (prev: Object) => Object) => void
 * @param {Function} props.parseDate - Parse date string to Date object: (str: string) => Date | null
 * @param {Function} props.formatDate - Format Date object to input string: (date: Date | null) => string
 * @param {Function} [props.onCustomRange] - Callback when entering custom date mode
 * @param {Function} [props.onReset] - Callback when reset button is clicked
 * @returns {JSX.Element} A div containing date filter dropdown and date input fields
 *
 * @example
 * const { dateFilter, quickRange, handleQuickRangeChange, formatDate, parseDate } = useDateRangeFilter(data);
 * return (
 *   <DateRangeControls
 *     quickRange={quickRange}
 *     onQuickRangeChange={handleQuickRangeChange}
 *     dateFilter={dateFilter}
 *     onDateFilterChange={(df) => setDateFilter(df)}
 *     parseDate={parseDate}
 *     formatDate={formatDate}
 *     onReset={() => setDateFilter({ start: null, end: null })}
 *   />
 * );
 */
import React from 'react';
import PropTypes from 'prop-types';
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
 * optionally shows date input fields for custom date range selection. Syncs the selected
 * range with parent component via callback functions.
 *
 * @param {Object} props - Component props
 * @param {string} props.quickRange - Current quick-range selection (e.g., 'all', '7', 'custom')
 * @param {Function} props.onQuickRangeChange - Callback when quick-range dropdown changes.
 *   Called with string value (e.g., 'all', '30', 'custom')
 * @param {Object} props.dateFilter - Current date filter: { start: Date | null, end: Date | null }
 * @param {Function} props.onDateFilterChange - Callback when date inputs change.
 *   Called with { start: Date | null, end: Date | null }
 * @param {Function} [props.onCustomRange] - Callback when entering custom range mode
 * @param {Function} [props.onReset] - Callback to reset date filter to 'all'
 * @param {Function} props.parseDate - Function to parse date string to Date object
 * @param {Function} props.formatDate - Function to format Date object to input-compatible string
 * @returns {JSX.Element} A div containing date filter dropdown and conditional date inputs
 *
 * @example
 * const { dateFilter, quickRange, handleQuickRangeChange, formatDate, parseDate } = useDateRangeFilter(data);
 * return (
 *   <DateRangeControls
 *     quickRange={quickRange}
 *     onQuickRangeChange={handleQuickRangeChange}
 *     dateFilter={dateFilter}
 *     onDateFilterChange={(df) => setDateFilter(df)}
 *     parseDate={parseDate}
 *     formatDate={formatDate}
 *   />
 * );
 */
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

DateRangeControls.propTypes = {
  quickRange: PropTypes.string.isRequired,
  onQuickRangeChange: PropTypes.func.isRequired,
  dateFilter: PropTypes.shape({
    start: PropTypes.instanceOf(Date),
    end: PropTypes.instanceOf(Date),
  }).isRequired,
  onDateFilterChange: PropTypes.func.isRequired,
  parseDate: PropTypes.func.isRequired,
  formatDate: PropTypes.func.isRequired,
  onCustomRange: PropTypes.func,
  onReset: PropTypes.func,
};

export default DateRangeControls;
