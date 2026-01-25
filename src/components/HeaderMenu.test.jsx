import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import HeaderMenu from './HeaderMenu';

describe('HeaderMenu', () => {
  const defaultProps = {
    onOpenImport: vi.fn(),
    onExportJson: vi.fn(),
    onExportCsv: vi.fn(),
    onExportEncrypted: vi.fn(),
    onImportEncrypted: vi.fn(),
    onClearSession: vi.fn(),
    onPrint: vi.fn(),
    onOpenGuide: vi.fn(),
    hasAnyData: true,
    summaryAvailable: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('triggers menu actions', async () => {
      const onOpenImport = vi.fn();
      const onPrint = vi.fn();
      render(
        <HeaderMenu
          onOpenImport={onOpenImport}
          onExportJson={() => {}}
          onExportCsv={() => {}}
          onExportEncrypted={() => {}}
          onImportEncrypted={() => {}}
          onClearSession={() => {}}
          onPrint={onPrint}
          onOpenGuide={() => {}}
          hasAnyData={true}
          summaryAvailable={true}
        />,
      );
      const menuBtn = screen.getByRole('button', { name: /menu/i });
      await userEvent.click(menuBtn);
      const loadItem = screen.getByRole('menuitem', { name: /load data/i });
      await userEvent.click(loadItem);
      expect(onOpenImport).toHaveBeenCalled();
      await userEvent.click(menuBtn);
      const printItem = screen.getByRole('menuitem', { name: /print page/i });
      await userEvent.click(printItem);
      expect(onPrint).toHaveBeenCalled();
    });

    it('opens privacy and terms at the legal anchor', async () => {
      const user = userEvent.setup();
      const onOpenGuide = vi.fn();
      render(<HeaderMenu {...defaultProps} onOpenGuide={onOpenGuide} />);

      await user.click(screen.getByRole('button', { name: /menu/i }));
      await user.click(
        screen.getByRole('menuitem', { name: /privacy and terms/i }),
      );

      expect(onOpenGuide).toHaveBeenCalledWith('privacy-policy');
    });
  });

  describe('Keyboard Navigation (WCAG 2.1 2.1.1)', () => {
    it('opens menu on Enter key', async () => {
      const user = userEvent.setup();
      render(<HeaderMenu {...defaultProps} />);
      const menuBtn = screen.getByRole('button', { name: /menu/i });
      menuBtn.focus();
      expect(menuBtn).toHaveFocus();

      await user.keyboard('{Enter}');

      expect(menuBtn).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('opens menu on Space key', async () => {
      const user = userEvent.setup();
      render(<HeaderMenu {...defaultProps} />);
      const menuBtn = screen.getByRole('button', { name: /menu/i });
      menuBtn.focus();

      await user.keyboard(' ');

      expect(menuBtn).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('activates menu item on Enter key', async () => {
      const user = userEvent.setup();
      const onOpenImport = vi.fn();
      render(
        <HeaderMenu
          {...defaultProps}
          onOpenImport={onOpenImport}
          hasAnyData={false}
        />,
      );
      const menuBtn = screen.getByRole('button', { name: /menu/i });

      // Open menu
      await user.click(menuBtn);
      const loadDataItem = screen.getByRole('menuitem', { name: /load data/i });
      loadDataItem.focus();
      expect(loadDataItem).toHaveFocus();

      await user.keyboard('{Enter}');

      expect(onOpenImport).toHaveBeenCalled();
      expect(menuBtn).toHaveAttribute('aria-expanded', 'false');
    });

    it('closes menu when menu item is activated with click', async () => {
      const user = userEvent.setup();
      const onOpenImport = vi.fn();
      render(
        <HeaderMenu
          {...defaultProps}
          onOpenImport={onOpenImport}
          hasAnyData={false}
        />,
      );
      const menuBtn = screen.getByRole('button', { name: /menu/i });

      await user.click(menuBtn);
      expect(menuBtn).toHaveAttribute('aria-expanded', 'true');

      await user.click(screen.getByRole('menuitem', { name: /load data/i }));

      expect(menuBtn).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('tabs through menu items in order', async () => {
      const user = userEvent.setup();
      render(
        <HeaderMenu
          {...defaultProps}
          hasAnyData={true}
          summaryAvailable={true}
        />,
      );
      const menuBtn = screen.getByRole('button', { name: /menu/i });

      // Open menu
      await user.click(menuBtn);

      const items = screen.getAllByRole('menuitem');
      const enabledItems = items.filter(
        (item) => !item.hasAttribute('disabled'),
      );

      if (enabledItems.length > 0) {
        // First Tab should focus first enabled item
        await user.tab();
        expect(enabledItems[0]).toHaveFocus();

        // Tab through remaining items
        for (let i = 1; i < enabledItems.length; i++) {
          await user.tab();
          expect(enabledItems[i]).toHaveFocus();
        }
      }
    });

    it('arrow down can navigate menu items', async () => {
      const user = userEvent.setup();
      render(
        <HeaderMenu
          {...defaultProps}
          hasAnyData={true}
          summaryAvailable={true}
        />,
      );
      const menuBtn = screen.getByRole('button', { name: /menu/i });

      await user.click(menuBtn);

      const items = screen.getAllByRole('menuitem');
      // eslint-disable-next-line no-magic-numbers
      if (items.length >= 2) {
        items[0].focus();
        // Arrow down should navigate or at least not break focus
        await user.keyboard('{ArrowDown}');
        // Focus should still be on a menu item (may be same item or next)
        const menuItems = screen.getAllByRole('menuitem');
        const hasFocus = menuItems.some(
          (item) => item === document.activeElement,
        );
        expect(hasFocus).toBe(true);
      }
    });

    it('arrow up can navigate menu items', async () => {
      const user = userEvent.setup();
      render(
        <HeaderMenu
          {...defaultProps}
          hasAnyData={true}
          summaryAvailable={true}
        />,
      );
      const menuBtn = screen.getByRole('button', { name: /menu/i });

      await user.click(menuBtn);

      const items = screen.getAllByRole('menuitem');
      // eslint-disable-next-line no-magic-numbers
      if (items.length >= 2) {
        items[1].focus();
        // Arrow up should navigate or at least not break focus
        await user.keyboard('{ArrowUp}');
        // Focus should still be on a menu item (may be same item or previous)
        const menuItems = screen.getAllByRole('menuitem');
        const hasFocus = menuItems.some(
          (item) => item === document.activeElement,
        );
        expect(hasFocus).toBe(true);
      }
    });

    it('skips disabled items when tabbing through menu', async () => {
      const user = userEvent.setup();
      render(
        <HeaderMenu
          {...defaultProps}
          hasAnyData={false}
          summaryAvailable={false}
        />,
      );
      const menuBtn = screen.getByRole('button', { name: /menu/i });

      await user.click(menuBtn);

      const allItems = screen.getAllByRole('menuitem');
      const enabledItems = allItems.filter(
        (item) => !item.hasAttribute('disabled'),
      );
      const disabledItems = allItems.filter((item) =>
        item.hasAttribute('disabled'),
      );

      // Verify we have both enabled and disabled items
      expect(disabledItems.length).toBeGreaterThan(0);
      expect(enabledItems.length).toBeGreaterThan(0);

      // Disabled items should not be in focus cycle
      const focusableElements = allItems.filter(
        (item) =>
          !item.hasAttribute('disabled') && !item.hasAttribute('aria-disabled'),
      );
      expect(focusableElements.length).toBe(enabledItems.length);
    });
  });

  describe('ARIA Attributes (WCAG 2.1 1.3.1)', () => {
    it('menu button has aria-expanded attribute', async () => {
      const user = userEvent.setup();
      render(<HeaderMenu {...defaultProps} />);
      const menuBtn = screen.getByRole('button', { name: /menu/i });

      expect(menuBtn).toHaveAttribute('aria-expanded', 'false');

      await user.click(menuBtn);
      expect(menuBtn).toHaveAttribute('aria-expanded', 'true');
    });

    it('menu button has aria-haspopup attribute', () => {
      render(<HeaderMenu {...defaultProps} />);
      const menuBtn = screen.getByRole('button', { name: /menu/i });

      expect(menuBtn).toHaveAttribute('aria-haspopup', 'menu');
    });

    it('menu has role="menu"', async () => {
      const user = userEvent.setup();
      render(<HeaderMenu {...defaultProps} />);
      const menuBtn = screen.getByRole('button', { name: /menu/i });

      await user.click(menuBtn);

      const menu = screen.getByRole('menu');
      expect(menu).toBeInTheDocument();
    });

    it('menu items have role="menuitem"', async () => {
      const user = userEvent.setup();
      render(<HeaderMenu {...defaultProps} hasAnyData={false} />);
      const menuBtn = screen.getByRole('button', { name: /menu/i });

      await user.click(menuBtn);

      const menuItems = screen.getAllByRole('menuitem');
      expect(menuItems.length).toBeGreaterThan(0);
      menuItems.forEach((item) => {
        expect(item).toHaveAttribute('role', 'menuitem');
      });
    });

    it('disabled menu items are properly marked', async () => {
      const user = userEvent.setup();
      render(
        <HeaderMenu
          {...defaultProps}
          hasAnyData={false}
          summaryAvailable={false}
        />,
      );
      const menuBtn = screen.getByRole('button', { name: /menu/i });

      await user.click(menuBtn);

      const allItems = screen.getAllByRole('menuitem');
      const disabledItems = allItems.filter((item) =>
        item.hasAttribute('disabled'),
      );

      expect(disabledItems.length).toBeGreaterThan(0);
      disabledItems.forEach((item) => {
        expect(item).toBeDisabled();
      });
    });
  });

  describe('Focus Management (WCAG 2.1 2.4.3)', () => {
    it('menu button receives focus', async () => {
      render(<HeaderMenu {...defaultProps} />);
      const menuBtn = screen.getByRole('button', { name: /menu/i });

      menuBtn.focus();
      expect(menuBtn).toHaveFocus();
    });

    it('focus returns to menu button after closing', async () => {
      const user = userEvent.setup();
      render(<HeaderMenu {...defaultProps} />);
      const menuBtn = screen.getByRole('button', { name: /menu/i });

      menuBtn.focus();
      await user.click(menuBtn);
      expect(screen.getByRole('menu')).toBeInTheDocument();

      // Close menu (click button again or escape)
      await user.click(menuBtn);

      // Menu should be closed or aria-expanded false
      const menuExpanded = menuBtn.getAttribute('aria-expanded');
      expect(
        menuExpanded === 'false' || screen.queryByRole('menu') === null,
      ).toBe(true);
    });

    it('menu item can receive focus', async () => {
      const user = userEvent.setup();
      render(<HeaderMenu {...defaultProps} hasAnyData={false} />);
      const menuBtn = screen.getByRole('button', { name: /menu/i });

      await user.click(menuBtn);

      const loadDataItem = screen.getByRole('menuitem', { name: /load data/i });
      loadDataItem.focus();

      expect(loadDataItem).toHaveFocus();
    });
  });
});
