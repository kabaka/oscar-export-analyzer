import React, { createContext, useContext } from 'react';
import PropTypes from 'prop-types';
import { DataProvider } from '../context/DataContext';
import { useAppState } from './useAppState';
import { useGuide } from '../hooks/useGuide';

const AppStateContext = createContext(null);

/**
 * Root context provider component wrapping the entire application.
 *
 * Establishes two nested contexts:
 * 1. DataProvider: Manages parsed CSV data and filtered session subsets
 * 2. AppStateContext: Manages UI state (active section, modals, filters)
 *
 * All analytics hooks and data-dependent components must be descendants of this provider.
 *
 * @param {Object} props - Component props
 * @param {ReactNode} props.children - Application component tree
 * @returns {JSX.Element} Provider tree wrapping children
 *
 * @example
 * <AppProviders>
 *   <AppLayout />
 * </AppProviders>
 *
 * @see useAppContext - Hook to access app state from any child component
 * @see useData - Hook to access CSV data and filtering state
 */
export function AppProviders({ children }) {
  const state = useAppState();
  const guide = useGuide(state.activeSectionId);
  const contextValue = { ...state, ...guide };

  return (
    <AppStateContext.Provider value={contextValue}>
      <DataProvider
        summaryData={state.summaryData}
        setSummaryData={state.setSummaryData}
        detailsData={state.detailsData}
        setDetailsData={state.setDetailsData}
        filteredSummary={state.filteredSummary}
        filteredDetails={state.filteredDetails}
      >
        {children}
      </DataProvider>
    </AppStateContext.Provider>
  );
}

AppProviders.propTypes = {
  children: PropTypes.node,
};

/**
 * Hook to access application state and context anywhere in the app.
 *
 * Must be called from within an AppProviders tree. Throws if not within provider.
 *
 * @returns {Object} App state object with properties from useAppState and useGuide:
 *   - summaryData, detailsData: Parsed CSV data
 *   - clustersAnalytics, falseNegatives: Analytics results
 *   - activeSectionId, guideOpen, guideAnchor: UI state
 *   - All state setters (setSummaryData, setDetailsData, etc.)
 * @throws {Error} If called outside AppProviders
 *
 * @example
 * function MyComponent() {
 *   const { summaryData, setSummaryData } = useAppContext();
 *   return <div>{summaryData?.length} sessions</div>;
 * }
 */
export function useAppContext() {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error('useAppContext must be used within AppProviders');
  }
  return ctx;
}
