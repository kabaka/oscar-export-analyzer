import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import HeaderMenu from './HeaderMenu';

describe('HeaderMenu', () => {
  it('triggers menu actions', async () => {
    const onOpenImport = vi.fn();
    const onPrint = vi.fn();
    render(
      <HeaderMenu
        onOpenImport={onOpenImport}
        onExportJson={() => {}}
        onExportCsv={() => {}}
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
});
