import { useCallback, useEffect, useMemo, useState } from 'react';

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

  const openGuide = useCallback((anchor = '') => {
    setGuideAnchor(anchor);
    setGuideOpen(true);
  }, []);

  const openGuideForActive = useCallback(() => {
    const anchor = guideMap[activeId] || '';
    openGuide(anchor);
  }, [activeId, guideMap, openGuide]);

  const closeGuide = useCallback(() => setGuideOpen(false), []);

  useEffect(() => {
    const handler = (event) => {
      const anchor = event?.detail?.anchor || '';
      openGuide(anchor);
    };
    window.addEventListener('open-guide', handler);
    return () => window.removeEventListener('open-guide', handler);
  }, [openGuide]);

  return { guideOpen, guideAnchor, openGuideForActive, closeGuide };
}
