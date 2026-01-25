import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Manages documentation modal state and navigation.
 *
 * Provides:
 * - Global event listener for 'open-guide' custom events from GuideLink buttons
 * - Mapping of analysis section IDs to documentation anchors
 * - Guide modal open/close and anchor management
 *
 * @param {string} [activeId] - Current active section ID (from app state).
 *   Used to jump to relevant documentation section
 * @returns {Object} Guide state and methods:
 *   - guideOpen (boolean): Whether docs modal is visible
 *   - guideAnchor (string): Current documentation anchor to scroll to
 *   - openGuideForActive (Function): Open guide for current section: () => void
 *   - openGuideWithAnchor (Function): Open guide at a specific anchor: (anchor?: string) => void
 *   - closeGuide (Function): Close docs modal: () => void
 *
 * @example
 * const { guideOpen, guideAnchor, openGuideForActive, closeGuide } = useGuide(activeId);
 * return (
 *   <>
 *     <button onClick={openGuideForActive}>Help</button>
 *     <DocsModal isOpen={guideOpen} onClose={closeGuide} initialAnchor={guideAnchor} />
 *   </>
 * );
 *
 * @see GuideLink - Component that triggers 'open-guide' event
 * @see DocsModal - Modal component for displaying documentation
 */
export function useGuide(activeId) {
  const guideMap = useMemo(
    () => ({
      overview: 'overview-dashboard',
      'usage-patterns': 'usage-patterns',
      'ahi-trends': 'ahi-trends',
      'pressure-settings': 'pressure-correlation-epap',
      'apnea-characteristics': 'apnea-event-characteristics-details-csv',
      'clustered-apnea': 'clustered-apnea-events-details-csv',
      'false-negatives': 'potential-false-negatives-details-csv',
      'raw-data-explorer': 'raw-data-explorer',
      'range-compare': 'range-comparisons-a-vs-b',
    }),
    [],
  );

  const [guideOpen, setGuideOpen] = useState(false);
  const [guideAnchor, setGuideAnchor] = useState('');

  const openGuideWithAnchor = useCallback((anchor = '') => {
    setGuideAnchor(anchor);
    setGuideOpen(true);
  }, []);

  const openGuideForActive = useCallback(() => {
    const anchor = guideMap[activeId] || '';
    openGuideWithAnchor(anchor);
  }, [activeId, guideMap, openGuideWithAnchor]);

  const closeGuide = useCallback(() => setGuideOpen(false), []);

  useEffect(() => {
    const handler = (event) => {
      const anchor = event?.detail?.anchor || '';
      openGuideWithAnchor(anchor);
    };
    window.addEventListener('open-guide', handler);
    return () => window.removeEventListener('open-guide', handler);
  }, [openGuideWithAnchor]);

  return {
    guideOpen,
    guideAnchor,
    openGuideForActive,
    openGuideWithAnchor,
    closeGuide,
  };
}
