import React from 'react';

export default function GuideLink({ anchor, label = 'Guide' }) {
  const onClick = (e) => {
    e.preventDefault?.();
    const evt = new CustomEvent('open-guide', { detail: { anchor } });
    window.dispatchEvent(evt);
  };
  return (
    <button type="button" className="btn-ghost guide-inline" onClick={onClick} aria-label={`Open guide for ${label}`}>{label}</button>
  );
}
