import React, { useState, useRef, useEffect } from 'react';

/**
 * Top-level menu component providing access to data import, export, and session management.
 *
 * Renders a hamburger-style dropdown menu with options for:
 * - Loading CSV data (Summary and/or Details exports from OSCAR)
 * - Exporting analysis results (JSON session or CSV aggregates)
 * - Clearing current session and starting fresh
 * - Printing analysis (with page break settings)
 * - Opening user guide documentation
 *
 * The menu auto-closes when clicking outside. Menu items are conditionally disabled based
 * on data availability (e.g., export/clear are disabled if no data loaded).
 *
 * @param {Object} props - Component props
 * @param {Function} props.onOpenImport - Callback to open CSV import modal
 * @param {Function} props.onExportJson - Callback to export session as JSON
 * @param {Function} props.onExportCsv - Callback to export aggregates as CSV
 * @param {Function} props.onClearSession - Callback to clear session and data
 * @param {Function} props.onPrint - Callback to print analysis
 * @param {Function} props.onOpenGuide - Callback to open guide modal
 * @param {boolean} props.hasAnyData - Whether any CSV data has been loaded
 * @param {boolean} props.summaryAvailable - Whether Summary CSV is available for export
 * @returns {JSX.Element} A menu container with button and conditional dropdown list
 *
 * @example
 * const [open, setOpen] = useState(false);
 * return (
 *   <HeaderMenu
 *     onOpenImport={() => setOpen(true)}
 *     onExportJson={handleExportJson}
 *     onExportCsv={handleExportCsv}
 *     onClearSession={handleClear}
 *     onPrint={handlePrint}
 *     onOpenGuide={handleGuide}
 *     hasAnyData={data !== null}
 *     summaryAvailable={true}
 *   />
 * );
 */
export default function HeaderMenu({
  onOpenImport,
  onExportJson,
  onExportCsv,
  onClearSession,
  onPrint,
  onOpenGuide,
  hasAnyData,
  summaryAvailable,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="app-menu" ref={ref}>
      <button
        className="btn-ghost"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Menu
      </button>
      {open && (
        <div className="menu-list" role="menu">
          <div className="menu-section" role="group">
            <button
              role="menuitem"
              onClick={() => {
                onOpenImport();
                close();
              }}
            >
              Load Data
            </button>
            <button
              role="menuitem"
              onClick={() => {
                onExportJson();
                close();
              }}
              disabled={!hasAnyData}
            >
              Export JSON
            </button>
            <button
              role="menuitem"
              onClick={() => {
                onExportCsv();
                close();
              }}
              disabled={!summaryAvailable}
            >
              Export Aggregates CSV
            </button>
            <button
              role="menuitem"
              onClick={() => {
                onPrint();
                close();
              }}
              disabled={!summaryAvailable}
            >
              Print Page
            </button>
          </div>
          <div className="menu-section" role="group">
            <button
              role="menuitem"
              onClick={() => {
                onClearSession();
                close();
              }}
            >
              Delete saved session
            </button>
          </div>
          <div className="menu-section" role="group">
            <button
              role="menuitem"
              onClick={() => {
                onOpenGuide();
                close();
              }}
            >
              Guide
            </button>
            <a
              role="menuitem"
              href="https://github.com/kabaka/oscar-export-analyzer"
              target="_blank"
              rel="noopener noreferrer"
              onClick={close}
            >
              GitHub Project
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
