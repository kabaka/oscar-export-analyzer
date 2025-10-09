import { useCallback, useMemo, useState } from 'react';

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
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
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
