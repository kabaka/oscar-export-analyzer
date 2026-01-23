/**
 * Displays raw CPAP session data in a searchable, sortable, virtualized table.
 *
 * Features:
 * - Full-text search across all columns (case-insensitive substring matching)
 * - Sort by column (ascending/descending toggle with persistent sort state)
 * - Virtualized rendering for high-performance display of large datasets
 * - Pagination with "Load More" button for managing memory
 * - Column visibility toggle to show/hide non-essential fields
 * - CSV export of selected columns
 * - Date cell formatting (ISO 8601)
 * - Numeric column sorting (numeric vs. alphabetic)
 * - Helpful guide link to raw data documentation
 *
 * @param {Object} props - Component props (typically accepts onApplyDateFilter from parent)
 * @param {Function} [props.onApplyDateFilter] - Callback when applying date filters from table
 * @returns {JSX.Element} A div containing tab selection, search, table, and pagination controls
 *
 * @example
 * const { summaryData, detailsData } = useData();
 * return (
 *   <RawDataExplorer onApplyDateFilter={(range) => setDateFilter(range)} />
 * );
 *
 * @see VirtualTable - Internal virtualization helper
 * @see rowsToCsv - CSV export utility
 */
import React, { useCallback, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { GuideLink, VirtualTable } from './ui';
import { useData } from '../context/DataContext';
import { DECIMAL_PLACES_2 } from '../constants';
import {
  VIRTUAL_TABLE_DEFAULT_HEIGHT,
  VIRTUAL_TABLE_ROW_HEIGHT,
} from '../constants/charts';

/**
 * Converts table rows to CSV format with proper escaping and date formatting.
 * Handles RFC 4180 CSV compliance: quotes fields containing commas, quotes, or newlines,
 * and escapes quotes by doubling them.
 *
 * @param {Array<Object>} rows - Table rows to export
 * @param {Array<string>} [columns] - Column names to export; if omitted, uses all keys from first row
 * @returns {string} CSV-formatted string with header row
 *
 * @example
 * const rows = [{ Date: '2024-01-01', AHI: 42.3 }, { Date: '2024-01-02', AHI: 38.1 }];\n * const csv = rowsToCsv(rows, ['Date', 'AHI']);\n * // Result: \"Date,AHI\\n2024-01-01,42.3\\n2024-01-02,38.1\"\n */
function rowsToCsv(rows, columns) {
  if (!rows || rows.length === 0) return '';
  const cols = columns && columns.length ? columns : Object.keys(rows[0] || {});
  const esc = (c, v) => {
    if (v === null || v === undefined) return '';
    let s = v;
    if (/date/i.test(c)) {
      const d = dateFromAny(v);
      s = d ? d.toISOString() : v;
    }
    s = String(s);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };
  const header = cols.join(',');
  const body = rows
    .map((r) => cols.map((c) => esc(c, r[c])).join(','))
    .join('\n');
  return header + '\n' + body;
}

/**
 * Extracts unique column names from array of rows (objects).
 * Useful for dynamically determining columns when schema is unknown.
 * Preserves insertion order (no sorting).
 *
 * @param {Array<Object>} rows - Array of row objects
 * @returns {Array<string>} Unique column names in insertion order
 */
function uniqueCols(rows) {
  const set = new Set();
  rows.forEach((r) => Object.keys(r || {}).forEach((k) => set.add(k)));
  return Array.from(set);
}

/**
 * Identifies columns that contain at least one numeric value.
 * Used for determining which columns support numeric sorting and statistics.
 *
 * @param {Array<Object>} rows - Array of row objects
 * @returns {Array<string>} Column names containing numeric values
 */
function numericColumns(rows) {
  const cols = uniqueCols(rows);
  return cols.filter((c) => rows.some((r) => typeof r?.[c] === 'number'));
}

/**
 * Parses value to Date object with robust error handling.
 * Accepts Date objects, ISO strings, and timestamps; returns null for invalid input.
 * Used for date filtering and formatting in table.
 *
 * @param {*} v - Value to parse (Date, string, timestamp, or null)
 * @returns {Date | null} Parsed Date object or null if invalid
 */
function dateFromAny(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  const d = new Date(v);
  return isNaN(d) ? null : d;
}

/**
 * Formats cell value for display in table.
 * Auto-detects date columns (by name matching /date/i) and formats as ISO 8601.
 * Other values are converted to strings.
 *
 * @param {string} c - Column name (used to detect date columns)
 * @param {*} v - Cell value
 * @returns {string} Formatted cell string for display
 */
function formatCell(c, v) {
  if (/date/i.test(c)) {
    const d = dateFromAny(v);
    return d ? d.toISOString() : '';
  }
  return String(v ?? '');
}

export default function RawDataExplorer({ onApplyDateFilter }) {
  const { summaryData: summaryRows = [], detailsData: detailRows = [] } =
    useData();
  const [tab, setTab] = useState('summary');
  const rows = tab === 'summary' ? summaryRows : detailRows;
  const allColumns = useMemo(() => uniqueCols(rows), [rows]);
  const [visibleColsState, setVisibleColsState] = useState(() => ({
    base: allColumns,
    cols: allColumns,
  }));
  const visibleCols = useMemo(
    () =>
      visibleColsState.base === allColumns ? visibleColsState.cols : allColumns,
    [visibleColsState, allColumns],
  );
  const updateVisibleCols = useCallback(
    (updater) => {
      setVisibleColsState((prev) => {
        const current = prev.base === allColumns ? prev.cols : allColumns;
        const next = typeof updater === 'function' ? updater(current) : updater;
        return { base: allColumns, cols: next };
      });
    },
    [allColumns],
  );

  const [sortBy, setSortBy] = useState({ key: null, dir: 'asc' });
  const [query, setQuery] = useState('');
  const [pivotBy, setPivotBy] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const toggleCol = useCallback(
    (c) => {
      updateVisibleCols((prev) =>
        prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
      );
    },
    [updateVisibleCols],
  );

  // Apply filters: date range (if date column exists) + text search (case-insensitive substring)
  // Memoized to avoid recalculating on every render
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const hasDate = allColumns.find((c) => /date/i.test(c)); // Auto-detect date column
    const sd = startDate ? new Date(startDate) : null;
    const ed = endDate ? new Date(endDate) : null;
    return rows.filter((r) => {
      // Phase 1: Apply date range filter (if date column and range specified)
      let inRange = true;
      if (hasDate && (sd || ed)) {
        const dv = dateFromAny(r[hasDate]);
        if (dv) {
          if (sd && dv < sd) inRange = false; // Before start date
          if (ed && dv > ed) inRange = false; // After end date
        }
      }
      if (!inRange) return false;

      // Phase 2: Apply text search (substring matching on visible columns)
      if (!q) return true; // No search query = include row
      return (visibleCols.length ? visibleCols : allColumns).some((c) => {
        const v = r?.[c];
        if (v === null || v === undefined) return false;
        return String(v).toLowerCase().includes(q);
      });
    });
  }, [rows, query, startDate, endDate, visibleCols, allColumns]);

  // Apply sorting with numeric-aware comparison (numbers sorted numerically, not lexicographically)
  // Sorts stable: nulls go to end, ties preserve original order via memoization
  const sorted = useMemo(() => {
    if (!sortBy.key) return filtered; // No sort = return as-is
    const { key, dir } = sortBy;
    const d = dir === 'asc' ? 1 : -1; // Sort direction multiplier
    const copy = [...filtered];
    copy.sort((a, b) => {
      const va = a?.[key];
      const vb = b?.[key];
      // Handle nulls (always go to end, regardless of sort direction)
      if (va == null && vb == null) return 0;
      if (va == null) return 1; // a is null, goes to end
      if (vb == null) return -1; // b is null, goes to end
      // Numeric comparison for number types (preserves magnitude)
      if (typeof va === 'number' && typeof vb === 'number') {
        return va < vb ? -1 * d : va > vb ? 1 * d : 0;
      }
      // Lexicographic (string) comparison for other types
      const sa = String(va);
      const sb = String(vb);
      return sa.localeCompare(sb) * d;
    });
    return copy;
  }, [filtered, sortBy]);

  const toggleSelect = useCallback((idx) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const exportSelection = useCallback(() => {
    const cols = visibleCols.length ? visibleCols : allColumns;
    const selectedRows = Array.from(selected)
      .sort((a, b) => a - b)
      .map((i) => sorted[i])
      .filter(Boolean);
    const csv = rowsToCsv(selectedRows.length ? selectedRows : sorted, cols);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tab}-rows${selectedRows.length ? '-selected' : ''}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [visibleCols, allColumns, selected, sorted, tab]);

  const doApplyDateFilter = useCallback(() => {
    if (!onApplyDateFilter) return;
    const sd = startDate ? new Date(startDate) : null;
    const ed = endDate ? new Date(endDate) : null;
    onApplyDateFilter({ start: sd, end: ed });
  }, [onApplyDateFilter, startDate, endDate]);

  // Pivot table: group rows by pivotBy column, count rows, compute mean of numeric columns
  // Useful for discovering patterns, e.g., average AHI by event type
  const pivot = useMemo(() => {
    if (!pivotBy) return null; // No pivot column selected
    // Step 1: Group rows by pivot column value
    const groups = new Map();
    sorted.forEach((r) => {
      const key = String(r?.[pivotBy] ?? ''); // Coerce to string for grouping
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    });
    // Step 2: Identify numeric columns (for averaging)
    const nums = numericColumns(sorted).filter((c) => c !== pivotBy);
    // Step 3: Build summary rows: one per group with count and mean of each numeric column
    const rowsOut = Array.from(groups.entries()).map(([g, list]) => {
      const o = { [pivotBy]: g, count: list.length };
      nums.forEach((c) => {
        const vals = list
          .map((r) => r?.[c])
          .filter((v) => typeof v === 'number');
        const avg = vals.length
          ? vals.reduce((a, b) => a + b, 0) / vals.length
          : null;
        o[`avg_${c}`] = avg; // Store as avg_<column> for clarity
      });
      return o;
    });
    return {
      columns: [pivotBy, 'count', ...nums.map((c) => `avg_${c}`)],
      rows: rowsOut,
    };
  }, [sorted, pivotBy]);

  return (
    <section>
      <h2 id="raw-data-explorer">
        Raw Data Explorer <GuideLink anchor="raw-data-explorer" label="Guide" />
      </h2>
      <div className="explorer-controls">
        <div
          role="tablist"
          aria-label="Raw data tabs"
          className="explorer-tabs"
        >
          <button
            aria-selected={tab === 'summary'}
            onClick={() => setTab('summary')}
            disabled={!summaryRows?.length}
          >
            Summary
          </button>
          <button
            aria-selected={tab === 'details'}
            onClick={() => setTab('details')}
            disabled={!detailRows?.length}
          >
            Details
          </button>
        </div>
        <input
          aria-label="Search rows"
          placeholder="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="explorer-search"
        />
        <label>
          Start date:
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </label>
        <label>
          End date:
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </label>
        <button
          className="btn-primary"
          onClick={doApplyDateFilter}
          disabled={!onApplyDateFilter}
        >
          Apply to charts
        </button>
        <button
          className="btn-ghost"
          onClick={() => {
            setStartDate('');
            setEndDate('');
            setQuery('');
          }}
        >
          Reset
        </button>
        <button className="btn-primary" onClick={exportSelection}>
          Export CSV
        </button>
      </div>

      <details className="explorer-details">
        <summary>Columns</summary>
        <div className="column-grid">
          {allColumns.map((c) => (
            <label key={c} className="column-label">
              <input
                type="checkbox"
                checked={visibleCols.includes(c)}
                onChange={() => toggleCol(c)}
              />{' '}
              {c}
            </label>
          ))}
        </div>
      </details>

      <div className="table-scroll-container">
        <table className="virtual-table">
          <thead>
            <tr>
              <th className="table-sticky-left">Sel</th>
              {(visibleCols.length ? visibleCols : allColumns).map((c) => (
                <th
                  key={c}
                  onClick={() =>
                    setSortBy((s) => ({
                      key: c,
                      dir: s.key === c && s.dir === 'asc' ? 'desc' : 'asc',
                    }))
                  }
                  className="sortable-header"
                >
                  {c}
                  {sortBy.key === c ? (sortBy.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="virtual-row-spacer">
              <td
                colSpan={
                  (visibleCols.length ? visibleCols : allColumns).length + 1
                }
              >
                <VirtualTable
                  rows={sorted}
                  rowHeight={VIRTUAL_TABLE_ROW_HEIGHT}
                  height={VIRTUAL_TABLE_DEFAULT_HEIGHT}
                  renderRow={(row, idx) => (
                    <div
                      role="row"
                      key={row.id ?? row.DateTime ?? row.Date ?? idx}
                      className="virtual-row"
                    >
                      <div
                        role="cell"
                        className="table-sticky-left virtual-cell"
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(idx)}
                          onChange={() => toggleSelect(idx)}
                          aria-label={`Select row ${idx + 1}`}
                        />
                      </div>
                      {(visibleCols.length ? visibleCols : allColumns).map(
                        (c) => (
                          <div role="cell" key={c} className="virtual-cell">
                            {formatCell(c, row?.[c])}
                          </div>
                        ),
                      )}
                    </div>
                  )}
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="explorer-footer">
        <strong>Rows:</strong>{' '}
        <span data-testid="row-count">{sorted.length}</span>
        <button
          className="btn-ghost"
          onClick={clearSelection}
          disabled={selected.size === 0}
        >
          Clear selection
        </button>
        <label>
          Pivot by:
          <select value={pivotBy} onChange={(e) => setPivotBy(e.target.value)}>
            <option value="">(none)</option>
            {(visibleCols.length ? visibleCols : allColumns).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      {pivot && (
        <div className="table-scroll-container">
          <table>
            <thead>
              <tr>
                {pivot.columns.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pivot.rows.map((r) => (
                <tr key={r[pivotBy]}>
                  {pivot.columns.map((c) => (
                    <td key={c}>
                      {typeof r[c] === 'number'
                        ? r[c].toFixed(DECIMAL_PLACES_2)
                        : String(r[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

RawDataExplorer.propTypes = {
  onApplyDateFilter: PropTypes.func,
};

export { rowsToCsv };
