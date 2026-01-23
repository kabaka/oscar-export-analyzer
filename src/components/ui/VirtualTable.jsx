/**
 * VirtualTable - High-performance virtualized table component
 *
 * Renders only visible rows in a scrollable container to efficiently handle
 * large datasets. Uses windowing technique with buffer rows and overscan
 * to provide smooth scrolling experience.
 *
 * @component
 * @param {Object} props
 * @param {Array} props.rows - Array of data rows to render
 * @param {number} [props.rowHeight] - Height of each row in pixels (default from constants)
 * @param {number} [props.height] - Container height in pixels (default from constants)
 * @param {Function} props.renderRow - Function to render a single row: (row, index) => JSX
 * @returns {JSX.Element} Virtualized scrollable table container
 *
 * @example
 * <VirtualTable
 *   rows={data}
 *   rowHeight={40}
 *   height={600}
 *   renderRow={(row, idx) => (
 *     <div key={idx} className="virtual-row">
 *       <div className="virtual-cell">{row.name}</div>
 *     </div>
 *   )}
 * />
 */
import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  VIRTUAL_TABLE_BUFFER_ROWS,
  VIRTUAL_TABLE_DEFAULT_HEIGHT,
  VIRTUAL_TABLE_OVERSCAN_ROWS,
  VIRTUAL_TABLE_ROW_HEIGHT,
} from '../../constants/charts';

export default function VirtualTable({
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
      data-testid="virtual-table-container"
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

VirtualTable.propTypes = {
  /** Array of data rows to render */
  rows: PropTypes.array.isRequired,
  /** Height of each row in pixels */
  rowHeight: PropTypes.number,
  /** Container height in pixels */
  height: PropTypes.number,
  /** Function to render a single row: (row, index) => JSX */
  renderRow: PropTypes.func.isRequired,
};
