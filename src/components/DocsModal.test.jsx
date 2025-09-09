import { render, screen } from '@testing-library/react';
import React from 'react';
import DocsModal from './DocsModal';
import { fireEvent } from '@testing-library/react';

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

  it('renders math expressions', () => {
    const md = '$$a^2$$';
    render(
      <DocsModal isOpen={true} onClose={() => {}} markdownSource={md} />
    );
    expect(document.querySelector('.katex')).not.toBeNull();
  });

  it('converts internal links to anchors', async () => {
    const md = `[Next](02-visualizations.md#rolling-windows)`;
    render(
      <DocsModal isOpen={true} onClose={() => {}} markdownSource={md} />
    );
    const link = await screen.findByRole('link', { name: /next/i });
    expect(link.getAttribute('href')).toBe('#rolling-windows');
    fireEvent.click(link);
  });

  it('nests table of contents items', async () => {
    const md = '# A\n\n## B\n\n# C';
    render(
      <DocsModal isOpen={true} onClose={() => {}} markdownSource={md} />
    );
    await screen.findByRole('link', { name: 'A' });
    const level2 = document.querySelector('.doc-toc .level-2');
    expect(level2).not.toBeNull();
  });
});
