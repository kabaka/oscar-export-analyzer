import React from 'react';
import PropTypes from 'prop-types';

/**
 * Main layout wrapper component for the OSCAR analyzer application.
 *
 * Renders a structured page layout with:
 * - Optional beforeHeader slot (e.g., modals, skip-to-content links)
 * - Header section (title, menu)
 * - Progress bar (optional, for CSV loading progress)
 * - Sidebar navigation (table of contents)
 * - Main content area
 *
 * Uses CSS Grid for responsive layout with fixed header and scrollable content.
 *
 * @param {Object} props - Component props
 * @param {ReactNode} [props.beforeHeader] - Element to render before header (typically modals)
 * @param {ReactNode} props.header - Header content (typically HeaderMenu and title)
 * @param {ReactNode} [props.progress] - Optional progress bar or status indicator
 * @param {ReactNode} [props.toc] - Table of contents/navigation sidebar content
 * @param {ReactNode} props.children - Main page content
 * @returns {JSX.Element} A semantic HTML structure with header, nav, and main content areas
 *
 * @example
 * <AppLayout
 *   beforeHeader={<DataImportModal isOpen={...} />}
 *   header={<HeaderMenu />}
 *   progress={<ProgressBar value={50} />}
 *   toc={<TableOfContents />}
 * >
 *   <SummaryAnalysis />
 * </AppLayout>
 */
export default function AppLayout({
  beforeHeader,
  header,
  progress,
  toc,
  children,
}) {
  return (
    <>
      {beforeHeader}
      <header className="app-header">
        {header}
        {progress}
      </header>
      <div className="container">
        <nav className="toc">{toc}</nav>
        {children}
      </div>
    </>
  );
}

AppLayout.propTypes = {
  beforeHeader: PropTypes.node,
  header: PropTypes.node,
  progress: PropTypes.node,
  toc: PropTypes.node,
  children: PropTypes.node,
};
