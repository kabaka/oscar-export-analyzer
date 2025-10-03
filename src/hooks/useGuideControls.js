import { useCallback, useEffect, useState } from 'react';

const GUIDE_MAP = {
  overview: 'overview-dashboard',
  'usage-patterns': 'usage-patterns',
  'ahi-trends': 'ahi-trends',
  'pressure-settings': 'pressure-correlation-epap',
  'apnea-characteristics': 'apnea-event-characteristics-details-csv',
  'clustered-apnea': 'clustered-apnea-events-details-csv',
  'false-negatives': 'potential-false-negatives-details-csv',
  'raw-data-explorer': 'raw-data-explorer',
  'range-compare': 'range-comparisons-a-vs-b',
};

export function useGuideControls(activeId) {
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideAnchor, setGuideAnchor] = useState('');

  const openGuide = useCallback((anchor = '') => {
    setGuideAnchor(anchor);
    setGuideOpen(true);
  }, []);

  const openGuideForActive = useCallback(() => {
    const anchor = GUIDE_MAP[activeId] || '';
    openGuide(anchor);
  }, [activeId, openGuide]);

  const closeGuide = useCallback(() => setGuideOpen(false), []);

  useEffect(() => {
    const handler = (e) => {
      const anchor = e?.detail?.anchor || '';
      openGuide(anchor);
    };
    window.addEventListener('open-guide', handler);
    return () => window.removeEventListener('open-guide', handler);
  }, [openGuide]);

  return { guideOpen, guideAnchor, openGuideForActive, openGuide, closeGuide };
}
