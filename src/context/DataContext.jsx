import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export const THEMES = {
  SYSTEM: 'system',
  LIGHT: 'light',
  DARK: 'dark',
};

const DataContext = createContext(null);

export function DataProvider({
  children,
  summaryData = null,
  setSummaryData = () => {},
  detailsData = null,
  setDetailsData = () => {},
  filteredSummary = null,
  filteredDetails = null,
}) {
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return THEMES.SYSTEM;
    const stored = window.localStorage.getItem('theme');
    return stored === THEMES.LIGHT || stored === THEMES.DARK
      ? stored
      : THEMES.SYSTEM;
  });

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (theme === THEMES.SYSTEM) {
      root.removeAttribute('data-theme');
      window.localStorage.removeItem('theme');
    } else {
      root.setAttribute('data-theme', theme);
      window.localStorage.setItem('theme', theme);
    }
  }, [theme]);

  const value = useMemo(
    () => ({
      summaryData,
      setSummaryData,
      detailsData,
      setDetailsData,
      filteredSummary,
      filteredDetails,
      theme,
      setTheme,
    }),
    [
      summaryData,
      setSummaryData,
      detailsData,
      setDetailsData,
      filteredSummary,
      filteredDetails,
      theme,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within a DataProvider');
  return ctx;
}

export function useTheme() {
  const { theme, setTheme } = useData();
  return { theme, setTheme };
}

export default DataContext;
