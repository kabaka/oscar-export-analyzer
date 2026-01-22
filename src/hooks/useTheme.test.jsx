import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { DataProvider, THEMES } from '../context/DataContext';
import { useTheme } from './useTheme';

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
});
