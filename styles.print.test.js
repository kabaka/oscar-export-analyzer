import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('print styles', () => {
  const css = fs.readFileSync(path.join(process.cwd(), 'styles.css'), 'utf8');
  it('includes print media query', () => {
    expect(css).toMatch(/@media print/);
  });
  it('hides header and interactive elements', () => {
    expect(css).toMatch(
      /@media print[\s\S]*\.app-header[\s\S]*display:\s*none/,
    );
    expect(css).toMatch(
      /@media print[\s\S]*\.btn-primary[\s\S]*display:\s*none/,
    );
    expect(css).toMatch(
      /@media print[\s\S]*(\.guide-link|\.guide-inline)[\s\S]*display:\s*none/,
    );
  });
});
