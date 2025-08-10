import React, { useEffect, useMemo, useRef } from 'react';
import GUIDE_MD from '../../docs/USAGE_GUIDE.md?raw';

function slugify(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderMarkdown(md) {
  const lines = md.split(/\r?\n/);
  const parts = [];
  const toc = [];
  let i = 0;
  let inCode = false;
  let codeLang = '';
  let listType = null; // 'ul' | 'ol'
  function closeList() {
    if (listType) { parts.push(`</${listType}>`); listType = null; }
  }
  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.replace(/\t/g, '  ');
    // fenced code
    const fence = line.match(/^```(.*)$/);
    if (fence) {
      if (inCode) {
        parts.push('</code></pre>');
        inCode = false; codeLang = '';
      } else {
        closeList();
        codeLang = fence[1]?.trim() || '';
        parts.push(`<pre class="doc-code"><code${codeLang ? ` data-lang="${escapeHtml(codeLang)}"` : ''}>`);
        inCode = true;
      }
      i++; continue;
    }
    if (inCode) {
      parts.push(escapeHtml(raw) + '\n');
      i++; continue;
    }
    // headings
    const h = line.match(/^(#{1,6})\s+(.+)$/);
    if (h) {
      closeList();
      const level = h[1].length;
      const text = h[2].trim();
      const id = slugify(text);
      toc.push({ level, id, text });
      parts.push(`<h${level} id="${id}">${escapeHtml(text)}</h${level}>`);
      i++; continue;
    }
    // lists
    const ul = line.match(/^\s*[-*]\s+(.+)$/);
    if (ul) {
      if (listType !== 'ul') { closeList(); parts.push('<ul>'); listType = 'ul'; }
      parts.push(`<li>${inline(ul[1])}</li>`);
      i++; continue;
    }
    const ol = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ol) {
      if (listType !== 'ol') { closeList(); parts.push('<ol>'); listType = 'ol'; }
      parts.push(`<li>${inline(ol[1])}</li>`);
      i++; continue;
    }
    // blank
    if (/^\s*$/.test(line)) { closeList(); parts.push(''); i++; continue; }
    // paragraph
    closeList();
    parts.push(`<p>${inline(line)}</p>`);
    i++;
  }
  closeList();
  return { html: parts.join('\n'), toc };

  function inline(txt) {
    // code spans
    let s = escapeHtml(txt);
    s = s.replace(/`([^`]+)`/g, (_m, g1) => `<code>${escapeHtml(g1)}</code>`);
    // links [text](url)
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, t, url) => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(t)}</a>`);
    return s;
  }
}

export default function DocsModal({ isOpen, onClose, initialAnchor }) {
  const contentRef = useRef(null);
  const parsed = useMemo(() => renderMarkdown(GUIDE_MD), []);

  useEffect(() => {
    if (!isOpen) return;
    // after open, optionally scroll to anchor
    const id = initialAnchor;
    if (id) {
      // wait a tick for innerHTML to render
      requestAnimationFrame(() => {
        const el = contentRef.current?.querySelector(`#${CSS.escape(id)}`);
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ block: 'start' });
        }
      });
    }
  }, [isOpen, initialAnchor]);

  if (!isOpen) return null;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Usage Guide">
      <div className="modal">
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>Usage & Interpretation Guide</h3>
          <button className="btn-ghost" onClick={onClose} aria-label="Close guide">Close</button>
        </div>
        <div className="modal-body">
          <aside className="doc-toc" aria-label="Guide sections">
            {parsed.toc.filter(h => h.level <= 2).map(h => (
              <a key={h.id} href={`#${h.id}`} onClick={(e) => { e.preventDefault(); const el = contentRef.current?.querySelector(`#${CSS.escape(h.id)}`); el?.scrollIntoView({ block: 'start' }); }}>
                {h.text}
              </a>
            ))}
          </aside>
          <article className="doc-content" ref={contentRef} dangerouslySetInnerHTML={{ __html: parsed.html }} />
        </div>
      </div>
    </div>
  );
}

