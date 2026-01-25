import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { DataProvider, THEMES, useTheme } from '../context/DataContext';

describe('useTheme', () => {
  const wrapper = ({ children }) => <DataProvider>{children}</DataProvider>;

  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    window.localStorage.clear();
  });

  it('returns and updates theme through DataProvider', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.theme).toBe(THEMES.SYSTEM);

    act(() => result.current.setTheme(THEMES.DARK));

    expect(result.current.theme).toBe(THEMES.DARK);
    expect(document.documentElement).toHaveAttribute('data-theme', THEMES.DARK);
    expect(window.localStorage.getItem('theme')).toBe(THEMES.DARK);
  });

  it('persists light theme and clears when resetting to system', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => result.current.setTheme(THEMES.LIGHT));

    expect(result.current.theme).toBe(THEMES.LIGHT);
    expect(document.documentElement).toHaveAttribute(
      'data-theme',
      THEMES.LIGHT,
    );
    expect(window.localStorage.getItem('theme')).toBe(THEMES.LIGHT);

    act(() => result.current.setTheme(THEMES.SYSTEM));

    expect(result.current.theme).toBe(THEMES.SYSTEM);
    expect(document.documentElement).not.toHaveAttribute('data-theme');
    expect(window.localStorage.getItem('theme')).toBeNull();
  });

  it('throws when used outside a DataProvider', () => {
    const renderOutsideProvider = () => renderHook(() => useTheme());
    expect(renderOutsideProvider).toThrow(
      /useData must be used within a DataProvider/,
    );
  });

  it('loads persisted theme from localStorage on mount', () => {
    window.localStorage.setItem('theme', THEMES.DARK);
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe(THEMES.DARK);
  });

  it('ignores invalid theme in localStorage and defaults to system', () => {
    window.localStorage.setItem('theme', 'invalid-theme');
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe(THEMES.SYSTEM);
  });

  it('toggles between dark and light themes', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => result.current.setTheme(THEMES.DARK));
    expect(result.current.theme).toBe(THEMES.DARK);

    act(() => result.current.setTheme(THEMES.LIGHT));
    expect(result.current.theme).toBe(THEMES.LIGHT);

    act(() => result.current.setTheme(THEMES.DARK));
    expect(result.current.theme).toBe(THEMES.DARK);
  });
});
