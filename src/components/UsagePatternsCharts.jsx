import React, { useCallback } from 'react';
import {
  DAYS_PER_WEEK,
  DEFAULT_MAX_LAG,
  DEFAULT_ROLLING_WINDOWS,
  MAX_CALENDAR_WEEKS,
  ROLLING_WINDOW_LONG_DAYS,
  ROLLING_WINDOW_SHORT_DAYS,
  SECONDS_PER_HOUR,
  STL_SEASON_LENGTH,
  USAGE_CHANGEPOINT_PENALTY,
  USAGE_COMPLIANCE_THRESHOLD_HOURS,
  USAGE_STRICT_THRESHOLD_HOURS,
} from '../constants';
import { CALENDAR_HEATMAP_HEIGHT } from '../constants/charts';
import { parseDuration } from '../utils/stats';
import { useEffectiveDarkMode } from '../hooks/useEffectiveDarkMode';
import { useTimeSeriesProcessing } from '../hooks/useTimeSeriesProcessing';
import { useUsageStats } from '../hooks/useUsageStats';
import { useAutocorrelation } from '../hooks/useAutocorrelation';
import { adherenceMetrics } from '../utils/timeSeries';
import UsageKpiGrid from './usage/UsageKpiGrid';
import UsageTimelineChart from './usage/UsageTimelineChart';
import LagControl from './usage/LagControl';
import AutocorrelationChart from './usage/AutocorrelationChart';
import PartialAutocorrelationChart from './usage/PartialAutocorrelationChart';
import UsageDecompositionChart from './usage/UsageDecompositionChart';
import UsageHistogram from './usage/UsageHistogram';
import UsageBoxplot from './usage/UsageBoxplot';
import UsageCalendarHeatmap from './usage/UsageCalendarHeatmap';

const DOW_LABELS = Object.freeze([
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
  'Sun',
]);
const MONDAY_INDEX_OFFSET = 6;
const ISO_DATE_LENGTH = 10;
const HEATMAP_MARGIN_TOP_PX = 16;
export const USAGE_HELP_TOOLTIP_MIN_COUNT = 7;

function UsagePatternsCharts({ data, onRangeSelect }) {
  const {
    dates,
    values: usageHours,
    rolling,
    breakDates,
    cpDates,
    decomposition,
    heatmap,
  } = useTimeSeriesProcessing({
    data,
    mapPoint: (r) => ({
      date: new Date(r['Date']),
      value: parseDuration(r['Total Time']) / SECONDS_PER_HOUR,
    }),
    rollingWindows: DEFAULT_ROLLING_WINDOWS,
    changePointPenalty: USAGE_CHANGEPOINT_PENALTY,
    seasonLength: STL_SEASON_LENGTH,
    includeHeatmap: true,
    heatmapOptions: {
      labels: DOW_LABELS,
      daysPerWeek: DAYS_PER_WEEK,
      weekStartOffset: MONDAY_INDEX_OFFSET,
      maxWeeks: MAX_CALENDAR_WEEKS,
      isoDateLength: ISO_DATE_LENGTH,
    },
  });

  const rolling7 = rolling[`avg${ROLLING_WINDOW_SHORT_DAYS}`] || [];
  const rolling30 = rolling[`avg${ROLLING_WINDOW_LONG_DAYS}`] || [];
  const r7Low = rolling[`avg${ROLLING_WINDOW_SHORT_DAYS}_ci_low`] || [];
  const r7High = rolling[`avg${ROLLING_WINDOW_SHORT_DAYS}_ci_high`] || [];
  const r30Low = rolling[`avg${ROLLING_WINDOW_LONG_DAYS}_ci_low`] || [];
  const r30High = rolling[`avg${ROLLING_WINDOW_LONG_DAYS}_ci_high`] || [];

  const { complianceSeries, longestCompliance, longestStrict } =
    adherenceMetrics(usageHours, rolling, {
      complianceThreshold: USAGE_COMPLIANCE_THRESHOLD_HOURS,
      strictThreshold: USAGE_STRICT_THRESHOLD_HOURS,
      longWindowDays: ROLLING_WINDOW_LONG_DAYS,
    });

  const { median, mean, nbins } = useUsageStats(usageHours);

  const {
    maxLag,
    lagInputId,
    acfValues,
    pacfValues,
    acfConfidence,
    handleLagChange,
  } = useAutocorrelation(usageHours, {
    initialMaxLag: DEFAULT_MAX_LAG,
  });

  const shortWindowLabel = `${ROLLING_WINDOW_SHORT_DAYS}-night`;
  const longWindowLabel = `${ROLLING_WINDOW_LONG_DAYS}-night`;

  const handleRelayout = useCallback(
    (ev) => {
      const x0 = ev?.['xaxis.range[0]'];
      const x1 = ev?.['xaxis.range[1]'];
      if (x0 && x1 && onRangeSelect) {
        onRangeSelect({ start: new Date(x0), end: new Date(x1) });
      }
    },
    [onRangeSelect],
  );

  const isDark = useEffectiveDarkMode();

  return (
    <div className="usage-charts">
      <UsageKpiGrid
        usageHours={usageHours}
        complianceSeries={complianceSeries}
        longestCompliance={longestCompliance}
        longestStrict={longestStrict}
      />

      <UsageTimelineChart
        dates={dates}
        usageHours={usageHours}
        r7Low={r7Low}
        r7High={r7High}
        r30Low={r30Low}
        r30High={r30High}
        rolling7={rolling7}
        rolling30={rolling30}
        shortWindowLabel={shortWindowLabel}
        longWindowLabel={longWindowLabel}
        breakDates={breakDates}
        cpDates={cpDates}
        onRelayout={handleRelayout}
      />

      {usageHours.length > 1 ? (
        <LagControl
          maxLag={maxLag}
          lagInputId={lagInputId}
          onChange={handleLagChange}
        />
      ) : null}

      {acfValues.length ? (
        <AutocorrelationChart values={acfValues} confidence={acfConfidence} />
      ) : null}

      {pacfValues.length ? (
        <PartialAutocorrelationChart
          values={pacfValues}
          confidence={acfConfidence}
        />
      ) : null}

      {dates.length > 0 ? (
        <UsageDecompositionChart
          dates={dates}
          decomposition={decomposition}
          onRelayout={handleRelayout}
        />
      ) : null}

      <div className="usage-charts-grid">
        <div className="chart-item">
          <UsageHistogram
            usageHours={usageHours}
            median={median}
            mean={mean}
            nbins={nbins}
          />
        </div>
        <div className="chart-item">
          <UsageBoxplot usageHours={usageHours} />
        </div>
      </div>

      <div
        className="chart-item"
        style={{ marginTop: `${HEATMAP_MARGIN_TOP_PX}px` }}
      >
        <UsageCalendarHeatmap
          heatmap={heatmap}
          isDark={isDark}
          height={CALENDAR_HEATMAP_HEIGHT}
        />
      </div>
    </div>
  );
}

export { UsagePatternsCharts };
export default React.memo(UsagePatternsCharts);
