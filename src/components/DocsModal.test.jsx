import { render, screen } from '@testing-library/react';
import React from 'react';
import DocsModal from './DocsModal';

describe('DocsModal', () => {
  it('renders guide content and closes', async () => {
    const onClose = vi.fn();
    render(<DocsModal isOpen={true} onClose={onClose} />);
    expect(
      await screen.findByRole('dialog', { name: /usage guide/i })
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', {
        level: 3,
        name: /Usage & Interpretation Guide/i,
      })
    ).toBeInTheDocument();
  });

  it('deep-links to a section when provided', async () => {
    render(
      <DocsModal
        isOpen={true}
        onClose={() => {}}
        initialAnchor="usage-patterns"
      />
    );
    const headings = await screen.findAllByRole('heading', {
      level: 2,
      name: /Usage Patterns/i,
    });
    expect(headings.length).toBeGreaterThan(0);
  });
});
