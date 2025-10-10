import React from 'react';

/**
 * Card component displaying a key performance indicator (KPI) with optional sparkline.
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
