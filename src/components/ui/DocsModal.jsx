import React, { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import DOMPurify from 'dompurify';

const DOCS = import.meta.glob('../../../docs/user/*.md', {
  query: '?raw',
  import: 'default',
});

function slugify(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function buildToc(md) {
  return md
    .split(/\r?\n/)
    .map((line) => line.match(/^(#{1,6})\s+(.+)$/))
    .filter(Boolean)
    .map(([, hashes, title]) => {
      const level = hashes.length;
      const text = title.trim();
      return { level, text, id: slugify(text) };
    });
}

function fileToSlug(filename) {
  return slugify(filename.replace(/^[0-9]+-/, '').replace(/\.md$/, ''));
}

/**
 * Modal dialog displaying markdown documentation with table of contents, KaTeX math,
 * and GitHub-flavored Markdown support.
 *
 * Features:
 * - Lazy-loads markdown files from docs/user/ directory
 * - Auto-generates table of contents from markdown headings
 * - Syntax highlighting for code blocks
 * - Renders inline math ($...$) and display math ($$...$$) with KaTeX
 * - Support for GitHub Markdown features (tables, strikethrough, task lists)
 * - Anchor jumping to specific sections
 * - HTML sanitization to prevent XSS attacks
 *
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether modal is visible
 * @param {Function} props.onClose - Callback to close modal
 * @param {string} [props.initialAnchor] - Optional anchor ID (heading slug) to scroll to on open
 * @param {string} [props.markdownSource] - Optional pre-loaded markdown content.
 *   If not provided, content is loaded from docs/user/*.md files
 * @returns {JSX.Element | null} Modal dialog or null if not open
 *
 * @example
 * const [isOpen, setIsOpen] = useState(false);
 * return (
 *   <>
 *     <button onClick={() => setIsOpen(true)}>Guide</button>
 *     <DocsModal
 *       isOpen={isOpen}
 *       onClose={() => setIsOpen(false)}
 *       initialAnchor="usage-patterns"
 *     />
 *   </>
 * );
 */
export default function DocsModal({
  isOpen,
  onClose,
  initialAnchor,
  markdownSource,
}) {
  const contentRef = useRef(null);
  const [markdown, setMarkdown] = useState(markdownSource ?? '');

  useEffect(() => {
    if (markdownSource !== undefined) return;
    async function load() {
      const files = await Promise.all(
        Object.entries(DOCS)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([, loader]) => loader()),
      );
      setMarkdown(files.join('\n'));
    }
    load();
  }, [markdownSource]);

  const parsed = useMemo(() => {
    if (!markdown) return { html: '', toc: [] };

    const headingComponents = {};
    // eslint-disable-next-line no-magic-numbers -- HTML supports heading levels h1–h6 (canonical limit)
    for (let level = 1; level <= 6; level++) {
      const Tag = `h${level}`;
      // eslint-disable-next-line react/display-name
      headingComponents[Tag] = (props) => {
        const text = React.Children.toArray(props.children).join('');
        const id = slugify(text);
        return React.createElement(Tag, { id, ...props });
      };
    }

    const linkComponent = ({ href = '', children }) => {
      const isDoc = href.includes('.md');
      if (!isDoc) return <a href={href}>{children}</a>;

      const [file, hash] = href.split('#');
      const target = hash || fileToSlug(file);
      return (
        <a
          href={`#${target}`}
          onClick={(e) => {
            e.preventDefault();
            const el = contentRef.current?.querySelector(
              `#${CSS.escape(target)}`,
            );
            el?.scrollIntoView({ block: 'start' });
          }}
        >
          {children}
        </a>
      );
    };

    const rawHtml = renderToStaticMarkup(
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeKatex]}
        components={{ ...headingComponents, a: linkComponent }}
      >
        {markdown}
      </ReactMarkdown>,
    );
    const html = DOMPurify.sanitize(rawHtml);
    const toc = buildToc(markdown);
    return { html, toc };
  }, [markdown]);

  useEffect(() => {
    if (!isOpen) return;
    const id = initialAnchor;
    if (id) {
      requestAnimationFrame(() => {
        const el = contentRef.current?.querySelector(`#${CSS.escape(id)}`);
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ block: 'start' });
        }
      });
    }
  }, [isOpen, initialAnchor, parsed.html]);

  if (!isOpen) return null;
  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Usage Guide"
    >
      <div className="modal">
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>Usage & Interpretation Guide</h3>
          <button
            className="btn-ghost"
            onClick={onClose}
            aria-label="Close guide"
          >
            Close
          </button>
        </div>
        <div className="modal-body">
          <aside className="doc-toc" aria-label="Guide sections">
            <ul>
              {parsed.toc
                // eslint-disable-next-line no-magic-numbers -- filter to main heading levels (h1–h2) for ToC readability
                .filter((h) => h.level <= 2)
                .map((h) => (
                  <li key={h.id} className={`level-${h.level}`}>
                    <a
                      href={`#${h.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        const el = contentRef.current?.querySelector(
                          `#${CSS.escape(h.id)}`,
                        );
                        el?.scrollIntoView({ block: 'start' });
                      }}
                    >
                      {h.text}
                    </a>
                  </li>
                ))}
            </ul>
          </aside>
          <article
            className="doc-content"
            ref={contentRef}
            // sanitized HTML; DOMPurify removes unsafe markup
            dangerouslySetInnerHTML={{ __html: parsed.html }}
          />
        </div>
      </div>
    </div>
  );
}

DocsModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  initialAnchor: PropTypes.string,
  markdownSource: PropTypes.string,
};
