import React, { createContext, useContext } from 'react';
import PropTypes from 'prop-types';
import { DataProvider } from '../context/DataContext';
import { useAppState } from './useAppState';
import { useGuide } from '../hooks/useGuide';

const AppStateContext = createContext(null);

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

export function useAppContext() {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error('useAppContext must be used within AppProviders');
  }
  return ctx;
}
