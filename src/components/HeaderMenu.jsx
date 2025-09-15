import React, { useState, useRef, useEffect } from 'react';

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
              onClearSession();
              close();
            }}
          >
            Delete saved session
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
      )}
    </div>
  );
}
