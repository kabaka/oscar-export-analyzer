import React from 'react';

/**
 * Small inline help tooltip for visualizations.
 * Usage: place inside a relatively positioned container.
 */
export default function VizHelp({ text, id, style }) {
  const tipId = id || `viz-tip-${Math.random().toString(36).slice(2)}`;
  return (
    <span
      className="viz-help"
      data-testid="viz-help"
      aria-describedby={tipId}
      tabIndex={0}
      style={{ position: 'absolute', top: 6, right: 6, ...style }}
    >
      <span aria-hidden="true" className="viz-help-icon">i</span>
      <span role="tooltip" id={tipId} className="viz-tooltip">{text}</span>
    </span>
  );
}

