import { useCallback, useMemo, useState } from 'react';
import { MILLISECONDS_PER_MINUTE } from '../constants';

/**
 * Manages date range filtering state and quick-range presets.
 *
 * Provides:
 * - Quick-range shortcuts ("Last 7 days", "Last year", etc.)
 * - Custom date range selection with date input parsing/formatting
 * - Utilities for converting between Date objects and ISO string format
 *
 * @param {Array<Object>} summaryData - Parsed Summary CSV data to derive latest date
 * @returns {Object} Date filtering state and handlers:
 *   - dateFilter (Object): Current date range { start: Date | null, end: Date | null }
 *   - setDateFilter (Function): Set custom date range: (range: Object) => void
 *   - quickRange (string): Current quick-range selection ('all', '7', '30', '365', 'custom')
 *   - handleQuickRangeChange (Function): Quick-range dropdown handler: (value: string) => void
 *   - parseDate (Function): Parse date string to Date object: (str: string) => Date | null
 *   - formatDate (Function): Format Date object to YYYY-MM-DD: (d: Date) => string
 *   - selectCustomRange (Function): Switch to custom range mode: () => void
 *   - resetDateFilter (Function): Reset to 'all' dates: () => void
 *
 * @example
 * const { dateFilter, quickRange, handleQuickRangeChange, formatDate, parseDate } =
 *   useDateRangeFilter(summaryData);
 * return (
 *   <DateRangeControls
 *     quickRange={quickRange}
 *     onQuickRangeChange={handleQuickRangeChange}
 *     dateFilter={dateFilter}
 *     formatDate={formatDate}
 *     parseDate={parseDate}
 *   />
 * );
 */
export function useDateRangeFilter(summaryData) {
  const [dateFilter, setDateFilter] = useState({ start: null, end: null });
  const [quickRange, setQuickRange] = useState('all');

  const latestDate = useMemo(() => {
    if (!summaryData || !summaryData.length) return new Date();
    const dateCol = Object.keys(summaryData[0] || {}).find((c) =>
      /date/i.test(c),
    );
    if (!dateCol) return new Date();
    return (
      summaryData.reduce((max, row) => {
        const d = new Date(row[dateCol]);
        return !max || d > max ? d : max;
      }, null) || new Date()
    );
  }, [summaryData]);

  const handleQuickRangeChange = useCallback(
    (val) => {
      setQuickRange(val);
      if (val === 'all') {
        setDateFilter({ start: null, end: null });
      } else if (val !== 'custom') {
        const days = parseInt(val, 10);
        if (!Number.isNaN(days)) {
          const end = latestDate;
          const start = new Date(end);
          start.setDate(start.getDate() - (days - 1));
          setDateFilter({ start, end });
        }
      }
    },
    [latestDate, setDateFilter, setQuickRange],
  );

  const parseDate = useCallback((val) => {
    if (!val) return null;
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? null : d;
  }, []);

  const formatDate = useCallback((d) => {
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
    const local = new Date(
      d.getTime() - d.getTimezoneOffset() * MILLISECONDS_PER_MINUTE,
    );
    // eslint-disable-next-line no-magic-numbers -- ISO 8601 date format: YYYY-MM-DD is first 10 characters
    return local.toISOString().slice(0, 10);
  }, []);

  const selectCustomRange = useCallback(() => {
    setQuickRange('custom');
  }, [setQuickRange]);

  const resetDateFilter = useCallback(() => {
    setQuickRange('all');
    setDateFilter({ start: null, end: null });
  }, [setDateFilter, setQuickRange]);

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
