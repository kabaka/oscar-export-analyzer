import React from 'react';

/**
 * Inline link button that opens the documentation modal with optional anchor.
 *
 * Dispatches a custom 'open-guide' event that bubbles to the app root, which
 * uses useGuide hook to open the docs modal and scroll to the specified anchor.
 *
 * @param {Object} props - Component props
 * @param {string} props.anchor - Documentation section anchor/slug to jump to (e.g., 'usage-patterns')
 * @param {string} [props.label='Guide'] - Link text to display
 * @returns {JSX.Element} A button with ghost styling
 *
 * @example
 * <GuideLink anchor="false-negatives" label="Learn more" />
 */
export default function GuideLink({ anchor, label = 'Guide' }) {
  const onClick = (e) => {
    e.preventDefault?.();
    const evt = new CustomEvent('open-guide', { detail: { anchor } });
    window.dispatchEvent(evt);
  };
  return (
    <button
      type="button"
      className="btn-ghost guide-inline"
      onClick={onClick}
      aria-label={`Open guide for ${label}`}
    >
      {label}
    </button>
  );
}
