import React, { createContext, useContext } from 'react';
import PropTypes from 'prop-types';
import { DataProvider } from '../context/DataContext';
import { GuideContext } from '../context/GuideContext';
import { FitbitOAuthProvider } from '../context/FitbitOAuthContext';
import { useAppState } from './useAppState';
import { useGuide } from '../hooks/useGuide';

const AppStateContext = createContext(null);

/**
 * Root context provider component wrapping the entire application.
 *
 * Establishes three nested contexts:
 * 1. GuideContext: Manages guide/documentation modal state (separated to prevent unnecessary re-renders)
 * 2. DataProvider: Manages parsed CSV data and filtered session subsets
 * 3. AppStateContext: Manages UI state (active section, modals, filters)
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
 * @see useGuideContext - Hook to access guide state from any child component
 * @see useData - Hook to access CSV data and filtering state
 */
export function AppProviders({ children }) {
  const state = useAppState();
  const guide = useGuide(state.activeSectionId);

  return (
    <AppStateContext.Provider value={state}>
      <GuideContext.Provider value={guide}>
        <FitbitOAuthProvider>
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
        </FitbitOAuthProvider>
      </GuideContext.Provider>
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
 * Note: If you only need guide state (guideOpen, guideAnchor, openGuideForActive, closeGuide),
 * use useGuideContext instead to avoid unnecessary re-renders.
 *
 * @returns {Object} App state object with properties from useAppState:
 *   - summaryData, detailsData: Parsed CSV data
 *   - clustersAnalytics, falseNegatives: Analytics results
 *   - activeSectionId, showStorageConsent, pendingSave: UI state
 *   - dateFilter, setDateFilter, selectCustomRange, resetDateFilter: Date filtering
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
