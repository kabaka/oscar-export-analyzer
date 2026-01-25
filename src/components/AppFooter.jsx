import React from 'react';
import PropTypes from 'prop-types';

const FOOTER_LINKS = [
  { label: 'Privacy', anchor: 'privacy-policy' },
  { label: 'Terms', anchor: 'terms-of-service' },
  { label: 'Accessibility', anchor: 'accessibility' },
];

/**
 * Lightweight footer with muted policy links that open the in-app documentation
 * at anchored sections. Links remain aligned with the main content width and
 * adapt responsively without fixed positioning.
 */
export default function AppFooter({ onOpenDocs }) {
  const handleClick = (event, anchor) => {
    event.preventDefault();
    if (onOpenDocs) {
      onOpenDocs(anchor);
    }
  };

  return (
    <footer className="app-footer" aria-label="Support and policy links">
      <div className="app-footer-inner">
        <span className="footer-note">
          Local-only analysis. Nothing is uploaded or tracked.
        </span>
        <nav aria-label="Policy links" className="app-footer-links">
          {FOOTER_LINKS.map((link) => (
            <a
              key={link.anchor}
              href={`#${link.anchor}`}
              onClick={(event) => handleClick(event, link.anchor)}
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}

AppFooter.propTypes = {
  onOpenDocs: PropTypes.func,
};
