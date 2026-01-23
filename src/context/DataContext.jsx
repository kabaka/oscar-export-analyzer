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

/**
 * Provides parsed session data, filtered subsets, and theme selection to the app.
 * Wraps children with a single shared context for summary/details data and theme state.
 *
 * @param {Object} props - Provider props
 * @param {React.ReactNode} props.children - Descendant components that need data/theme
 * @param {Array|null} props.summaryData - Parsed summary CSV rows
 * @param {Function} props.setSummaryData - Setter for summary data
 * @param {Array|null} props.detailsData - Parsed detailed CSV rows
 * @param {Function} props.setDetailsData - Setter for details data
 * @param {Array|null} props.filteredSummary - Date-filtered summary rows
 * @param {Array|null} props.filteredDetails - Date-filtered detail rows
 * @returns {JSX.Element} Context provider with shared data and theme state
 */
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

/**
 * Accessor hook for the shared data context.
 * Must be used within a DataProvider; throws otherwise.
 *
 * @returns {Object} Data context containing parsed data, filters, and theme controls
 */
export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within a DataProvider');
  return ctx;
}

/**
 * Convenience hook exposing only theme state from the data context.
 *
 * @returns {{ theme: string, setTheme: Function }} Current theme and setter
 */
export function useTheme() {
  const { theme, setTheme } = useData();
  return { theme, setTheme };
}

export default DataContext;
