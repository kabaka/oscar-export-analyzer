import React from 'react';
import {
  HEADER_SCROLL_MARGIN_PX,
  PERCENT_SCALE,
  ROLLING_WINDOW_LONG_DAYS,
  USAGE_COMPLIANCE_THRESHOLD_HOURS,
  USAGE_STRICT_THRESHOLD_HOURS,
} from '../../constants';

const KPI_GRID_COLUMN_COUNT = 4;
const KPI_CARD_MIN_WIDTH_PX = 120;
const KPI_GRID_GAP_PX = 12;
const KPI_GRID_MARGIN_BOTTOM_PX = HEADER_SCROLL_MARGIN_PX;
const KPI_GRID_TEMPLATE = `repeat(${KPI_GRID_COLUMN_COUNT}, minmax(${KPI_CARD_MIN_WIDTH_PX}px, 1fr))`;

function UsageKpiGrid({
  usageHours,
  complianceSeries,
  longestCompliance,
  longestStrict,
}) {
  const compliancePct =
    usageHours.length > 0
      ? (usageHours.filter((h) => h >= USAGE_COMPLIANCE_THRESHOLD_HOURS)
          .length /
          usageHours.length) *
        PERCENT_SCALE
      : 0;
  const strictPct =
    usageHours.length > 0
      ? (usageHours.filter((h) => h >= USAGE_STRICT_THRESHOLD_HOURS).length /
          usageHours.length) *
        PERCENT_SCALE
      : 0;
  const latestCompliance = complianceSeries?.length
    ? complianceSeries[complianceSeries.length - 1].toFixed(0)
    : '—';

  return (
    <div
      className="kpi-row"
      style={{
        display: 'grid',
        gridTemplateColumns: KPI_GRID_TEMPLATE,
        gap: `${KPI_GRID_GAP_PX}px`,
        marginBottom: `${KPI_GRID_MARGIN_BOTTOM_PX}px`,
      }}
    >
      <div>
        <strong>% nights ≥ {USAGE_COMPLIANCE_THRESHOLD_HOURS}h:</strong>{' '}
        {compliancePct.toFixed(0)}%
      </div>
      <div>
        <strong>% nights ≥ {USAGE_STRICT_THRESHOLD_HOURS}h:</strong>{' '}
        {strictPct.toFixed(0)}%
      </div>
      <div>
        <strong>
          Current {ROLLING_WINDOW_LONG_DAYS}-night ≥
          {USAGE_COMPLIANCE_THRESHOLD_HOURS}h:
        </strong>{' '}
        {latestCompliance}%
      </div>
      <div>
        <strong>
          Longest streak ≥{USAGE_COMPLIANCE_THRESHOLD_HOURS}h/≥
          {USAGE_STRICT_THRESHOLD_HOURS}h:
        </strong>{' '}
        {longestCompliance} / {longestStrict} nights
      </div>
    </div>
  );
}

export default UsageKpiGrid;
