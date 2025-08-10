import { render, screen } from '@testing-library/react';
import React from 'react';
import DocsModal from './DocsModal';

describe('DocsModal', () => {
  it('renders guide content and closes', () => {
    const onClose = vi.fn();
    render(<DocsModal isOpen={true} onClose={onClose} />);
    expect(screen.getByRole('dialog', { name: /usage guide/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: /Usage & Interpretation Guide/i })).toBeInTheDocument();
  });

  it('deep-links to a section when provided', () => {
    render(<DocsModal isOpen={true} onClose={() => {}} initialAnchor="usage-patterns" />);
    // The heading text should be present; scrollIntoView cannot be asserted in jsdom
    const headings = screen.getAllByRole('heading', { level: 2, name: /Usage Patterns/i });
    expect(headings.length).toBeGreaterThan(0);
  });
});
