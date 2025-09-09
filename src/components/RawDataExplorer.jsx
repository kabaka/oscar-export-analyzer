import React, { useMemo, useRef, useState, useEffect } from 'react';
import GuideLink from './GuideLink';

// Lightweight CSV export util for selected rows
function rowsToCsv(rows, columns) {
  if (!rows || rows.length === 0) return '';
  const cols = columns && columns.length ? columns : Object.keys(rows[0] || {});
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };
  const header = cols.join(',');
  const body = rows.map((r) => cols.map((c) => esc(r[c])).join(',')).join('\n');
  return header + '\n' + body;
}

// Basic virtualized rows renderer for large datasets (no external deps)
function VirtualTable({ rows, rowHeight = 28, height = 360, renderRow }) {
  const containerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const total = rows.length;
  const onScroll = (e) => setScrollTop(e.currentTarget.scrollTop);
  const visibleCount = Math.ceil(height / rowHeight) + 6; // overscan
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - 3);
  const end = Math.min(total, start + visibleCount);
  const offsetY = start * rowHeight;
  const slice = rows.slice(start, end);

  return (
    <div
      ref={containerRef}
      onScroll={onScroll}
      style={{
        position: 'relative',
        overflow: 'auto',
        height: `${height}px`,
        border: '1px solid #ddd',
      }}
    >
      <div style={{ height: `${total * rowHeight}px`, position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            top: `${offsetY}px`,
            left: 0,
            right: 0,
          }}
        >
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

export default function RawDataExplorer({
  summaryRows = [],
  detailRows = [],
  onApplyDateFilter, // optional: ({start, end}) => void
}) {
  const [tab, setTab] = useState('summary');
  const rows = tab === 'summary' ? summaryRows : detailRows;
  const allColumns = useMemo(() => uniqueCols(rows), [rows]);
  const [visibleCols, setVisibleCols] = useState(allColumns);
  useEffect(() => setVisibleCols(allColumns), [allColumns]);

  const [sortBy, setSortBy] = useState({ key: null, dir: 'asc' });
  const [query, setQuery] = useState('');
  const [pivotBy, setPivotBy] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const toggleCol = (c) => {
    setVisibleCols((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  };

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

  const toggleSelect = (idx) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());
  const exportSelection = () => {
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
  };

  const doApplyDateFilter = () => {
    if (!onApplyDateFilter) return;
    const sd = startDate ? new Date(startDate) : null;
    const ed = endDate ? new Date(endDate) : null;
    onApplyDateFilter({ start: sd, end: ed });
  };

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
      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <div
          role="tablist"
          aria-label="Raw data tabs"
          style={{ display: 'inline-flex', gap: 4 }}
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
          style={{ flex: '1 1 200px' }}
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

      <details style={{ marginTop: 8 }}>
        <summary>Columns</summary>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {allColumns.map((c) => (
            <label key={c} style={{ minWidth: 160 }}>
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

      <div style={{ overflowX: 'auto', marginTop: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th
                className="table-sticky-left"
                style={{ position: 'sticky', left: 0 }}
              >
                Sel
              </th>
              {(visibleCols.length ? visibleCols : allColumns).map((c) => (
                <th
                  key={c}
                  onClick={() =>
                    setSortBy((s) => ({
                      key: c,
                      dir: s.key === c && s.dir === 'asc' ? 'desc' : 'asc',
                    }))
                  }
                  style={{ cursor: 'pointer' }}
                >
                  {c}
                  {sortBy.key === c ? (sortBy.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr style={{ height: 0 }}>
              <td
                colSpan={
                  (visibleCols.length ? visibleCols : allColumns).length + 1
                }
                style={{ padding: 0 }}
              >
                <VirtualTable
                  rows={sorted}
                  rowHeight={28}
                  height={360}
                  renderRow={(row, idx) => (
                    <div
                      role="row"
                      key={row.id ?? row.DateTime ?? row.Date ?? idx}
                      style={{
                        display: 'table',
                        tableLayout: 'fixed',
                        width: '100%',
                      }}
                    >
                      <div
                        role="cell"
                        className="table-sticky-left"
                        style={{
                          display: 'table-cell',
                          padding: '4px 6px',
                          borderBottom: '1px solid #eee',
                        }}
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
                          <div
                            role="cell"
                            key={c}
                            style={{
                              display: 'table-cell',
                              padding: '4px 6px',
                              borderBottom: '1px solid #eee',
                            }}
                          >
                            {String(row?.[c] ?? '')}
                          </div>
                        )
                      )}
                    </div>
                  )}
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        style={{
          marginTop: 10,
          display: 'flex',
          gap: 12,
          alignItems: 'center',
        }}
      >
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
        <div style={{ overflowX: 'auto', marginTop: 8 }}>
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
                        ? r[c].toFixed(2)
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

export { rowsToCsv };
