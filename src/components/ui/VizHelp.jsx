import React, { useId } from 'react';
import PropTypes from 'prop-types';

/**
 * Small inline help tooltip icon with popover text for chart visualizations.
 *
 * Renders as an info icon (i) that displays a tooltip on hover/focus.
 * Supports both inline (row-level) and overlay (positioned) layouts.
 * Uses react's useId for deterministic, unique tooltip IDs.
 *
 * @param {Object} props - Component props
 * @param {string} props.text - Tooltip text content (plain text or simple HTML)
 * @param {string} [props.id] - Custom tooltip ID. If not provided, generated from useId
 * @param {Object} [props.style] - Additional CSS styles (used for overlay mode)
 * @param {boolean} [props.inline=true] - If true, renders inline with row styling;
 *   if false, positions absolutely with bottom-left corner styling
 * @returns {JSX.Element} A span with tooltip styling and ARIA attributes
 *
 * @example
 * <div style={{ position: 'relative' }}>
 *   <Chart />
 *   <VizHelp inline={false} text="Hover points to see exact values" />
 * </div>
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

VizHelp.propTypes = {
  text: PropTypes.string.isRequired,
  id: PropTypes.string,
  style: PropTypes.object,
  inline: PropTypes.bool,
};
