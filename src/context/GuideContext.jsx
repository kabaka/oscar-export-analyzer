import { createContext, useContext } from 'react';

/**
 * Context for guide/documentation modal state.
 * Separated from AppStateContext to prevent unnecessary re-renders.
 * Components that only need guide state can subscribe to this context alone.
 *
 * @type {React.Context<Object>}
 */
export const GuideContext = createContext(null);

/**
 * Hook to access guide/documentation modal state.
 *
 * Must be called from within an AppProviders tree. Throws if not within provider.
 *
 * @returns {Object} Guide state object from useGuide:
 *   - guideOpen (boolean): Whether docs modal is visible
 *   - guideAnchor (string): Current documentation anchor to scroll to
 *   - openGuideForActive (Function): Open guide for current section
 *   - closeGuide (Function): Close docs modal
 * @throws {Error} If called outside AppProviders
 *
 * @example
 * function MyComponent() {
 *   const { guideOpen, closeGuide } = useGuideContext();
 *   return <Modal isOpen={guideOpen} onClose={closeGuide} />;
 * }
 */
export function useGuideContext() {
  const ctx = useContext(GuideContext);
  if (!ctx) {
    throw new Error('useGuideContext must be used within AppProviders');
  }
  return ctx;
}
