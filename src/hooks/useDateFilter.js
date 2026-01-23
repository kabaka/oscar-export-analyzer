import { useAppContext } from '../app/AppProviders';

/**
 * Granular hook providing direct access to date filtering state and operations.
 *
 * Reduces prop drilling by allowing components to directly access date filter
 * state from context instead of receiving props from App.jsx.
 *
 * @returns {Object} Date filter state and operations:
 *   - dateFilter: { start: Date | null, end: Date | null } - Current date range
 *   - setDateFilter: (filter) => void - Set date filter
 *   - quickRange: string - Current quick range selection ('all', '7', 'custom', etc.)
 *   - handleQuickRangeChange: (value: string) => void - Handle quick range selection
 *   - parseDate: (str: string) => Date | null - Parse date string to Date
 *   - formatDate: (date: Date | null) => string - Format Date to input string
 *   - selectCustomRange: () => void - Switch to custom range mode
 *   - resetDateFilter: () => void - Reset filter to 'all'
 *
 * @example
 * function DateRangeControls() {
 *   const {
 *     dateFilter,
 *     setDateFilter,
 *     quickRange,
 *     handleQuickRangeChange,
 *     parseDate,
 *     formatDate,
 *     selectCustomRange,
 *     resetDateFilter
 *   } = useDateFilter();
 *
 *   return (
 *     <div>
 *       <select value={quickRange} onChange={(e) => handleQuickRangeChange(e.target.value)}>
 *         <option value="all">All</option>
 *         <option value="7">Last 7 days</option>
 *       </select>
 *       <input
 *         type="date"
 *         value={formatDate(dateFilter.start)}
 *         onChange={(e) => {
 *           selectCustomRange();
 *           setDateFilter(prev => ({ ...prev, start: parseDate(e.target.value) }));
 *         }}
 *       />
 *     </div>
 *   );
 * }
 */
export function useDateFilter() {
  const {
    dateFilter,
    setDateFilter,
    quickRange,
    handleQuickRangeChange,
    parseDate,
    formatDate,
    selectCustomRange,
    resetDateFilter,
  } = useAppContext();

  return {
    dateFilter,
    setDateFilter,
    quickRange,
    handleQuickRangeChange,
    parseDate,
    formatDate,
    selectCustomRange,
    resetDateFilter,
  };
}
