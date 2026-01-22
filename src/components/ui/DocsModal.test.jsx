import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import React from 'react';
import DocsModal from './DocsModal';
import { fireEvent } from '@testing-library/react';

describe('DocsModal', () => {
  it('renders guide content and closes', async () => {
    const onClose = vi.fn();
    const guideMarkdown = `# Usage & Interpretation Guide
## Introduction
Welcome to the OSCAR Sleep Data Analysis guide.
`;
    render(
      <DocsModal
        isOpen={true}
        onClose={onClose}
        markdownSource={guideMarkdown}
      />,
    );
    expect(
      await screen.findByRole('dialog', { name: /usage guide/i }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: /Usage & Interpretation Guide/i,
      }),
    ).toBeInTheDocument();
  });

  it('deep-links to a section when provided', async () => {
    const markdown = `# Main Content
## Usage Patterns
Some detailed content about usage patterns.
## Other Section
More content.
`;
    render(
      <DocsModal
        isOpen={true}
        onClose={() => {}}
        markdownSource={markdown}
        initialAnchor="usage-patterns"
      />,
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
      <DocsModal isOpen={true} onClose={() => {}} markdownSource={malicious} />,
    );
    await screen.findByRole('heading', { level: 1, name: /hello/i });
    const link = document.querySelector('.doc-content a');
    expect(link).toHaveAttribute('href', '');
    expect(document.querySelector('script')).toBeNull();
  });

  it('renders display math delimited by dollars', () => {
    const md = '$$\\text{Severity}=1$$';
    render(<DocsModal isOpen={true} onClose={() => {}} markdownSource={md} />);
    expect(document.querySelector('.katex')).not.toBeNull();
  });

  it('renders tables', () => {
    const md = '|a|b|\n|-|-|\n|1|2|';
    render(<DocsModal isOpen={true} onClose={() => {}} markdownSource={md} />);
    expect(document.querySelector('.doc-content table')).not.toBeNull();
  });

  it('converts internal links to anchors', async () => {
    const md = `[Next](02-visualizations.md#rolling-windows)`;
    render(<DocsModal isOpen={true} onClose={() => {}} markdownSource={md} />);
    const link = await screen.findByRole('link', { name: /next/i });
    expect(link).toHaveAttribute('href', '#rolling-windows');
    fireEvent.click(link);
  });

  it('nests table of contents items', async () => {
    const md = '# A\n\n## B\n\n# C';
    render(<DocsModal isOpen={true} onClose={() => {}} markdownSource={md} />);
    await screen.findByRole('link', { name: 'A' });
    const level2 = document.querySelector('.doc-toc .level-2');
    expect(level2).not.toBeNull();
  });
});
