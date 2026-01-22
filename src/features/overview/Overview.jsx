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
 * Overview dashboard displaying high-level KPIs and sparklines.
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
