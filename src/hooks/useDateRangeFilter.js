import { useCallback, useMemo, useState } from 'react';

const DEFAULT_FILTER = { start: null, end: null };

export function useDateRangeFilter(summaryData) {
  const [dateFilter, setDateFilter] = useState(DEFAULT_FILTER);
  const [quickRange, setQuickRange] = useState('all');

  const latestDate = useMemo(() => {
    if (!summaryData || !summaryData.length) return new Date();
    const dateCol = Object.keys(summaryData[0]).find((c) => /date/i.test(c));
    if (!dateCol) return new Date();
    return (
      summaryData.reduce((max, r) => {
        const d = new Date(r[dateCol]);
        return !max || d > max ? d : max;
      }, null) || new Date()
    );
  }, [summaryData]);

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

  const applyDateFilter = useCallback((value) => {
    if (!value || (!value.start && !value.end)) {
      setQuickRange('all');
      setDateFilter({ ...DEFAULT_FILTER });
      return;
    }
    setQuickRange('custom');
    setDateFilter({
      start: value.start ?? null,
      end: value.end ?? null,
    });
  }, []);

  const handleQuickRangeChange = useCallback(
    (val) => {
      setQuickRange(val);
      if (val === 'all') {
        setDateFilter({ ...DEFAULT_FILTER });
        return;
      }
      if (val === 'custom') return;
      const days = parseInt(val, 10);
      if (!Number.isNaN(days)) {
        const end = latestDate;
        const start = new Date(end);
        start.setDate(start.getDate() - (days - 1));
        setDateFilter({ start, end });
      }
    },
    [latestDate],
  );

  const handleStartChange = useCallback(
    (val) => {
      setQuickRange('custom');
      setDateFilter((prev) => ({
        ...prev,
        start: parseDate(val),
      }));
    },
    [parseDate],
  );

  const handleEndChange = useCallback(
    (val) => {
      setQuickRange('custom');
      setDateFilter((prev) => ({
        ...prev,
        end: parseDate(val),
      }));
    },
    [parseDate],
  );

  const resetDateFilter = useCallback(() => {
    setQuickRange('all');
    setDateFilter({ ...DEFAULT_FILTER });
  }, []);

  return {
    dateFilter,
    quickRange,
    latestDate,
    handleQuickRangeChange,
    handleStartChange,
    handleEndChange,
    resetDateFilter,
    formatDate,
    setDateFilter: applyDateFilter,
  };
}
