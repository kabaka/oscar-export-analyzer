import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import GuideLink from './GuideLink';

describe('GuideLink', () => {
  it('dispatches open-guide event with anchor', () => {
    const handler = vi.fn();
    window.addEventListener('open-guide', handler, { once: true });
    render(<GuideLink anchor="usage-patterns" />);
    fireEvent.click(screen.getByRole('button', { name: /guide/i }));
    expect(handler).toHaveBeenCalledOnce();
    const evt = handler.mock.calls[0][0];
    expect(evt.detail.anchor).toBe('usage-patterns');
  });
});
