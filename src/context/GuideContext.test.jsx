import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { GuideContext, useGuideContext } from './GuideContext';

describe('GuideContext', () => {
  it('throws error when useGuideContext is called outside provider', () => {
    expect(() => {
      renderHook(() => useGuideContext());
    }).toThrow('useGuideContext must be used within AppProviders');
  });

  it('returns guide state when used within provider', () => {
    const mockGuideState = {
      guideOpen: true,
      guideAnchor: 'test-anchor',
      openGuideForActive: () => {},
      openGuideWithAnchor: () => {},
      closeGuide: () => {},
    };

    const wrapper = ({ children }) => (
      <GuideContext.Provider value={mockGuideState}>
        {children}
      </GuideContext.Provider>
    );

    const { result } = renderHook(() => useGuideContext(), { wrapper });

    expect(result.current).toEqual(mockGuideState);
    expect(result.current.guideOpen).toBe(true);
    expect(result.current.guideAnchor).toBe('test-anchor');
  });
});
