import React, { useState } from 'react';
import PropTypes from 'prop-types';

/**
 * Mobile navigation drawer with hamburger menu toggle.
 * Displays TOC sections as vertical list; closes on section click.
 * Replaces desktop horizontal TOC on mobile viewports (<768px).
 *
 * @param {Object} props - Component props
 * @param {Array<{id: string, label: string}>} props.sections - TOC sections
 * @param {string} props.activeSectionId - Currently active section ID
 * @param {Function} props.onNavigate - Navigation handler, called with section ID
 * @returns {JSX.Element} Mobile nav toggle button and drawer
 *
 * @example
 * <MobileNav
 *   sections={[{ id: 'overview', label: 'Overview' }, ...]}
 *   activeSectionId="overview"
 *   onNavigate={(id) => scrollToSection(id)}
 * />
 */
export function MobileNav({ sections, activeSectionId, onNavigate }) {
  const [isOpen, setIsOpen] = useState(false);

  const handleNavClick = (sectionId) => {
    onNavigate(sectionId);
    setIsOpen(false); // Close drawer after navigation
  };

  return (
    <>
      {/* Hamburger button */}
      <button
        className="mobile-nav-toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle navigation menu"
        aria-expanded={isOpen}
        aria-controls="mobile-nav-menu"
      >
        <span className="hamburger-icon">
          <span></span>
          <span></span>
          <span></span>
        </span>
      </button>

      {/* Mobile navigation drawer */}
      {isOpen && (
        <>
          {/* Backdrop (dismisses menu on tap) */}
          <div
            className="mobile-nav-backdrop"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer */}
          <nav
            id="mobile-nav-menu"
            className="mobile-nav-drawer"
            role="navigation"
            aria-label="Table of Contents"
          >
            <ul className="mobile-nav-list">
              {sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className={activeSectionId === section.id ? 'active' : ''}
                    onClick={(e) => {
                      e.preventDefault();
                      handleNavClick(section.id);
                    }}
                  >
                    {section.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </>
      )}
    </>
  );
}

MobileNav.propTypes = {
  sections: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    }),
  ).isRequired,
  activeSectionId: PropTypes.string,
  onNavigate: PropTypes.func.isRequired,
};
