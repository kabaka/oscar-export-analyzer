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
import React, { useCallback, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { GuideLink } from './ui';
import { useData } from '../context/DataContext';
import { DECIMAL_PLACES_2 } from '../constants';
import {
  VIRTUAL_TABLE_BUFFER_ROWS,
  VIRTUAL_TABLE_DEFAULT_HEIGHT,
  VIRTUAL_TABLE_OVERSCAN_ROWS,
  VIRTUAL_TABLE_ROW_HEIGHT,
} from '../constants/charts';

// Lightweight CSV export util for selected rows
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

// Basic virtualized rows renderer for large datasets (no external deps)
function VirtualTable({
  rows,
  rowHeight = VIRTUAL_TABLE_ROW_HEIGHT,
  height = VIRTUAL_TABLE_DEFAULT_HEIGHT,
  renderRow,
}) {
  const containerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const total = rows.length;
  const onScroll = (e) => setScrollTop(e.currentTarget.scrollTop);
  const visibleCount =
    Math.ceil(height / rowHeight) + VIRTUAL_TABLE_OVERSCAN_ROWS;
  const start = Math.max(
    0,
    Math.floor(scrollTop / rowHeight) - VIRTUAL_TABLE_BUFFER_ROWS,
  );
  const end = Math.min(total, start + visibleCount);
  const offsetY = start * rowHeight;
  const slice = rows.slice(start, end);

  return (
    <div
      ref={containerRef}
      onScroll={onScroll}
      className="virtual-table-container"
      style={{ height: `${height}px` }}
    >
      <div
        className="virtual-table-spacer"
        style={{ height: `${total * rowHeight}px` }}
      >
        <div className="virtual-table-viewport" style={{ top: `${offsetY}px` }}>
          {slice.map((row, i) => renderRow(row, start + i))}
        </div>
      </div>
    </div>
  );
}

function uniqueCols(rows) {
  const set = new Set();
  rows.forEach((r) => Object.keys(r || {}).forEach((k) => set.add(k)));
  return Array.from(set);
}

function numericColumns(rows) {
  const cols = uniqueCols(rows);
  return cols.filter((c) => rows.some((r) => typeof r?.[c] === 'number'));
}

function dateFromAny(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  const d = new Date(v);
  return isNaN(d) ? null : d;
}

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const hasDate = allColumns.find((c) => /date/i.test(c));
    const sd = startDate ? new Date(startDate) : null;
    const ed = endDate ? new Date(endDate) : null;
    return rows.filter((r) => {
      // date range filter if date-like column exists
      let inRange = true;
      if (hasDate && (sd || ed)) {
        const dv = dateFromAny(r[hasDate]);
        if (dv) {
          if (sd && dv < sd) inRange = false;
          if (ed && dv > ed) inRange = false;
        }
      }
      if (!inRange) return false;
      if (!q) return true;
      return (visibleCols.length ? visibleCols : allColumns).some((c) => {
        const v = r?.[c];
        if (v === null || v === undefined) return false;
        return String(v).toLowerCase().includes(q);
      });
    });
  }, [rows, query, startDate, endDate, visibleCols, allColumns]);

  const sorted = useMemo(() => {
    if (!sortBy.key) return filtered;
    const { key, dir } = sortBy;
    const d = dir === 'asc' ? 1 : -1;
    const copy = [...filtered];
    copy.sort((a, b) => {
      const va = a?.[key];
      const vb = b?.[key];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') {
        return va < vb ? -1 * d : va > vb ? 1 * d : 0;
      }
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

  // Pivot summary by a chosen column; show counts and mean of numeric columns
  const pivot = useMemo(() => {
    if (!pivotBy) return null;
    const groups = new Map();
    sorted.forEach((r) => {
      const key = String(r?.[pivotBy] ?? '');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    });
    const nums = numericColumns(sorted).filter((c) => c !== pivotBy);
    const rowsOut = Array.from(groups.entries()).map(([g, list]) => {
      const o = { [pivotBy]: g, count: list.length };
      nums.forEach((c) => {
        const vals = list
          .map((r) => r?.[c])
          .filter((v) => typeof v === 'number');
        const avg = vals.length
          ? vals.reduce((a, b) => a + b, 0) / vals.length
          : null;
        o[`avg_${c}`] = avg;
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
