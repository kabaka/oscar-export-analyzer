import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import AppFooter from './AppFooter';

describe('AppFooter', () => {
  it('invokes docs handler with privacy anchor and keeps links focusable', async () => {
    const onOpenDocs = vi.fn();
    render(<AppFooter onOpenDocs={onOpenDocs} />);

    const nav = screen.getByRole('navigation', { name: /policy links/i });
    expect(nav).toBeInTheDocument();

    const privacyLink = screen.getByRole('link', { name: /privacy/i });
    expect(privacyLink).toHaveAttribute('href', '#privacy-policy');

    await userEvent.click(privacyLink);
    expect(onOpenDocs).toHaveBeenCalledWith('privacy-policy');

    privacyLink.focus();
    expect(privacyLink).toHaveFocus();
  });
});
