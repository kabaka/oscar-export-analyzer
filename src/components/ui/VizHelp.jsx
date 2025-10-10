import React, { useId } from 'react';

/**
 * Small inline help tooltip for visualizations.
 * Uses `useId` for a deterministic tooltip id; pass `id` to override.
 * Usage: place inside a relatively positioned container.
 */
export default function VizHelp({ text, id, style, inline = true }) {
  const generatedId = useId();
  const tipId = id || `viz-tip-${generatedId}`;
  const className = `viz-help ${inline ? 'viz-inline' : 'viz-overlay'}`;
  const posStyle = inline
    ? {}
    : { position: 'absolute', bottom: 6, left: 6, ...style };
  return (
    <div
      className={inline ? 'viz-help-row' : 'chart-with-help'}
      style={inline ? {} : { position: 'relative' }}
    >
      <span
        className={className}
        data-testid="viz-help"
        aria-describedby={tipId}
        tabIndex={0}
        style={posStyle}
      >
        <span aria-hidden="true" className="viz-help-icon">
          i
        </span>
        <span role="tooltip" id={tipId} className="viz-tooltip">
          {text}
        </span>
      </span>
    </div>
  );
}
