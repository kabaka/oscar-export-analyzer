import React from 'react';

/**
 * Card component displaying a key performance indicator (KPI) with optional sparkline visualization.
 *
 * Used in the overview dashboard to display metrics with their values and mini trend charts.
 * Provides consistent styling for metric cards with title, value, and optional embedded chart.
 *
 * @param {Object} props - Component props
 * @param {string} props.title - Card title/metric name (e.g., "Avg Usage (hrs)")
 * @param {string | number} props.value - The metric value to display prominently
 * @param {ReactNode} [props.children] - Optional sparkline chart component (e.g., Sparkline SVG)
 * @returns {JSX.Element} A card div with title, value, and optional children
 *
 * @example
 * <KPICard title="Avg Usage" value="5.2 hrs">
 *   <Sparkline data={usageData} />
 * </KPICard>
 */
export default function KPICard({ title, value, children }) {
  return (
    <div className="kpi-card">
      <div className="title">{title}</div>
      <div className="value">{value}</div>
      {children}
    </div>
  );
}
