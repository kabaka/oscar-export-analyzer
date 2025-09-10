import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import ThemeToggle from './ThemeToggle';
import { DataProvider } from '../context/DataContext';

describe('ThemeToggle', () => {
  beforeEach(() => {
    // Reset theme state
    document.documentElement.removeAttribute('data-theme');
    window.localStorage.removeItem('theme');
  });

  it('defaults to system (no data-theme attribute)', () => {
    render(
      <DataProvider>
        <ThemeToggle />
      </DataProvider>,
    );
    expect(document.documentElement.getAttribute('data-theme')).toBe(null);
    const group = screen.getByRole('group', { name: /theme/i });
    const active = within(group)
      .getAllByRole('radio')
      .filter((r) => r.checked);
    expect(active).toHaveLength(1);
    expect(active[0]).toHaveAttribute('value', 'system');
  });

  it('switches to dark and persists', async () => {
    const user = userEvent.setup();
    render(
      <DataProvider>
        <ThemeToggle />
      </DataProvider>,
    );
    const dark = screen.getByRole('radio', { name: /dark/i });
    await user.click(dark);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(window.localStorage.getItem('theme')).toBe('dark');
  });

  it('switches to light and back to system', async () => {
    const user = userEvent.setup();
    render(
      <DataProvider>
        <ThemeToggle />
      </DataProvider>,
    );
    const light = screen.getByRole('radio', { name: /light/i });
    const system = screen.getByRole('radio', { name: /system/i });
    await user.click(light);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    await user.click(system);
    expect(document.documentElement.getAttribute('data-theme')).toBe(null);
    expect(window.localStorage.getItem('theme')).toBe(null);
  });
});
