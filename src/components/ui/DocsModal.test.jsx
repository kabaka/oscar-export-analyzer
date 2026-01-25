import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import DocsModal from './DocsModal';
import { fireEvent } from '@testing-library/react';

// Use minimal markdown fixtures to speed up tests
const MINIMAL_MARKDOWN = `# Guide
## Section
Content here.`;

const MINIMAL_WITH_MATH = '# Title\n$$x=1$$';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DocsModal', () => {
  it('renders guide content and closes', async () => {
    const onClose = vi.fn();
    render(
      <DocsModal
        isOpen={true}
        onClose={onClose}
        markdownSource={MINIMAL_MARKDOWN}
      />,
    );
    expect(
      await screen.findByRole('dialog', { name: /usage guide/i }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: /guide/i,
      }),
    ).toBeInTheDocument();
  });

  it('deep-links to a section when provided', async () => {
    const markdown = `# Main\n## Target\nContent.`;
    render(
      <DocsModal
        isOpen={true}
        onClose={() => {}}
        markdownSource={markdown}
        initialAnchor="target"
      />,
    );
    const heading = await screen.findByRole('heading', {
      level: 2,
      name: /target/i,
    });
    expect(heading).toBeInTheDocument();
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

  it('renders display math', () => {
    render(
      <DocsModal
        isOpen={true}
        onClose={() => {}}
        markdownSource={MINIMAL_WITH_MATH}
      />,
    );
    // KaTeX renders to .katex elements
    const mathElement = document.querySelector('.katex');
    expect(mathElement).not.toBeNull();
  });

  it('renders tables', () => {
    const md = '|a|b|\n|-|-|\n|1|2|';
    render(<DocsModal isOpen={true} onClose={() => {}} markdownSource={md} />);
    expect(document.querySelector('.doc-content table')).not.toBeNull();
  });

  it('includes privacy and terms headings in the table of contents', async () => {
    const md = '# Privacy Policy\n## Terms of Service';
    render(<DocsModal isOpen={true} onClose={() => {}} markdownSource={md} />);

    const privacyLink = await screen.findByRole('link', {
      name: /privacy policy/i,
    });
    const termsLink = await screen.findByRole('link', {
      name: /terms of service/i,
    });

    expect(privacyLink).toHaveAttribute('href', '#privacy-policy');
    expect(termsLink).toHaveAttribute('href', '#terms-of-service');
    expect(document.getElementById('privacy-policy')).not.toBeNull();
    expect(document.getElementById('terms-of-service')).not.toBeNull();
  });

  it('converts internal links to anchors', async () => {
    const md = `[Next](#section)`;
    render(<DocsModal isOpen={true} onClose={() => {}} markdownSource={md} />);
    const link = await screen.findByRole('link', { name: /next/i });
    expect(link).toHaveAttribute('href', '#section');
    fireEvent.click(link);
  });

  it('nests table of contents items', async () => {
    const md = '# Level1\n## Level2\n### Level3';
    render(<DocsModal isOpen={true} onClose={() => {}} markdownSource={md} />);
    await screen.findByRole('link', { name: /level1/i });
    const level2 = document.querySelector('.doc-toc .level-2');
    expect(level2).not.toBeNull();
  });
});
