import React from 'react';
import {
  summarizeUsage,
  computeAHITrends,
  computeEPAPTrends,
} from '../../utils/stats';
import { GuideLink, KPICard } from '../../components/ui';
import { DECIMAL_PLACES_2 } from '../../constants';
import MetricGrid from './MetricGrid';
import { useData } from '../../context/DataContext';

/**
 * Sparkline chart for a series of numeric data points.
 */
/**
 * Mini sparkline chart for visualizing data trends in KPI cards.
 *
 * Renders a simple SVG line plot with auto-scaled Y-axis, useful for
 * showing trends at a glance. Returns null if insufficient data.
 *
 * @param {Object} props - Component props
 * @param {Array<number>} props.data - Numeric data to plot
 * @param {number} [props.width=100] - SVG viewBox width
 * @param {number} [props.height=30] - SVG viewBox height
 * @returns {JSX.Element | null} SVG sparkline or null if < 2 data points
 */
function Sparkline({ data, width = 100, height = 30 }) {
  // eslint-disable-next-line no-magic-numbers -- minimum 2 points needed to draw a line chart
  if (!data || data.length < 2) {
    return null;
  }
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((d - min) / range) * height;
    return [x, y];
  });
  const pathD = points
    .map(([x, y], idx) => `${idx === 0 ? 'M' : 'L'}${x},${y}`)
    .join(' ');
  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      <path d={pathD} />
    </svg>
  );
}

/**
 * High-level overview dashboard with KPIs and sparklines.
 *
 * Displays summary statistics and mini trend visualizations for:
 * - Average usage hours with sparkline
 * - Median AHI with sparkline
 * - Median EPAP with sparkline
 * - Total nights and cluster counts
 *
 * Provides a quick snapshot of therapy effectiveness without detailed interaction.
 *
 * @param {Object} props - Component props
 * @param {Array<Object>} [props.clusters] - Detected apnea clusters
 * @param {Array<Object>} [props.falseNegatives] - Detected false negatives
 * @returns {JSX.Element} Dashboard grid with KPI cards and sparklines
 *
 * @see MetricGrid - Layout wrapper
 * @see KPICard - Individual metric card
 */
export default function Overview({ clusters, falseNegatives }) {
  const { filteredSummary: summaryData } = useData();
  const usage = summarizeUsage(summaryData || []);
  const ahi = computeAHITrends(summaryData || []);
  const epap = computeEPAPTrends(summaryData || []);

  return (
    <div className="overview-dashboard">
      <h2 id="overview">
        Overview Dashboard{' '}
        <GuideLink anchor="overview-dashboard" label="Guide" />
      </h2>
      <MetricGrid>
        <KPICard
          title="Avg Usage (hrs)"
          value={usage.avgHours.toFixed(DECIMAL_PLACES_2)}
        >
          <Sparkline data={usage.usageHours} />
        </KPICard>
        <KPICard
          title="Median AHI"
          value={ahi.medianAHI.toFixed(DECIMAL_PLACES_2)}
        >
          <Sparkline data={ahi.ahis} />
        </KPICard>
        <KPICard
          title="Median EPAP"
          value={epap.medianEPAP.toFixed(DECIMAL_PLACES_2)}
        >
          <Sparkline data={epap.epaps} />
        </KPICard>
        <KPICard title="# Clusters" value={clusters.length.toString()} />
        <KPICard
          title="# False Negatives"
          value={falseNegatives.length.toString()}
        />
      </MetricGrid>
    </div>
  );
}
