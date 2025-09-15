import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('menu styles', () => {
  const css = fs.readFileSync(path.join(process.cwd(), 'styles.css'), 'utf8');

  it('sets menu width to fit items', () => {
    expect(css).toMatch(
      /\.app-menu\s+\.menu-list\s*{[\s\S]*width:\s*max-content/,
    );
  });

  it('prevents menu items from wrapping', () => {
    expect(css).toMatch(
      /\.app-menu\s+\.menu-list\s+\[role='menuitem'\]\s*{[\s\S]*white-space:\s*nowrap/,
    );
  });

  it('stacks menu items vertically within sections', () => {
    expect(css).toMatch(
      /\.app-menu\s+\.menu-list\s+\.menu-section\s*{[\s\S]*flex-direction:\s*column/,
    );
  });
});
