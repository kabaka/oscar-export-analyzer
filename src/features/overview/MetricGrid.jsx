import React from 'react';
import PropTypes from 'prop-types';

/**
 * Grid container layout for key performance indicator (KPI) cards.
 *
 * Provides consistent responsive grid styling for metric cards displayed
 * in the overview dashboard.
 *
 * @param {Object} props - Component props
 * @param {ReactNode} props.children - KPICard components to display in grid
 * @returns {JSX.Element} A div with metric-grid CSS class
 *
 * @example
 * <MetricGrid>
 *   <KPICard title="Avg Usage" value="5.2 hrs" />
 *   <KPICard title="Median AHI" value="12.3" />
 * </MetricGrid>
 */
export default function MetricGrid({ children }) {
  return <div className="metric-grid">{children}</div>;
}

MetricGrid.propTypes = {
  children: PropTypes.node.isRequired,
};
