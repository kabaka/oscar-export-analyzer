import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOMServer from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import DOMPurify from 'dompurify';

const DOCS = import.meta.glob('../../docs/user/*.md', {
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
          .map(([, loader]) => loader())
      );
      setMarkdown(files.join('\n'));
    }
    load();
  }, [markdownSource]);

  const parsed = useMemo(() => {
    if (!markdown) return { html: '', toc: [] };

    const headingComponents = {};
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
              `#${CSS.escape(target)}`
            );
            el?.scrollIntoView({ block: 'start' });
          }}
        >
          {children}
        </a>
      );
    };

    const rawHtml = ReactDOMServer.renderToStaticMarkup(
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{ ...headingComponents, a: linkComponent }}
      >
        {markdown}
      </ReactMarkdown>
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
                .filter((h) => h.level <= 2)
                .map((h) => (
                  <li key={h.id} className={`level-${h.level}`}>
                    <a
                      href={`#${h.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        const el = contentRef.current?.querySelector(
                          `#${CSS.escape(h.id)}`
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
            dangerouslySetInnerHTML={{ __html: parsed.html }}
          />
        </div>
      </div>
    </div>
  );
}
