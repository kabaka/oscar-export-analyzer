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

  it('sanitizes malicious markdown', async () => {
    const malicious = `# Hello\n[link](javascript:alert(1))`;
    render(
      <DocsModal isOpen={true} onClose={() => {}} markdownSource={malicious} />
    );
    await screen.findByRole('heading', { level: 1, name: /hello/i });
    const link = document.querySelector('.doc-content a');
    expect(link.getAttribute('href')).toBe('');
    expect(document.querySelector('script')).toBeNull();
  });
});
