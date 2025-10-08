import React from 'react';
import PropTypes from 'prop-types';

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
