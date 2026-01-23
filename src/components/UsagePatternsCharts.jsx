/**
 * Comprehensive CPAP usage analysis with multiple visualization perspectives.
 *
 * Features:
 * - KPI grid: % nights ≥4h, % nights ≥6h, longest compliance/strict usage streaks
 * - Usage timeline: Nightly usage hours with rolling averages (7-night, 30-night) and 95% confidence intervals
 * - Lag control: Interactive input to adjust max lag for ACF/PACF analysis
 * - Autocorrelation (ACF) chart: Shows how strongly usage one night predicts the next
 * - Partial autocorrelation (PACF) chart: Isolates direct usage memory effects at each lag
 * - STL decomposition: Separates usage trend, weekly seasonal pattern, and residual noise
 * - Histogram: Distribution of nightly usage hours with median/mean markers
 * - Boxplot: Quartile-based view of usage distribution and outlier detection
 * - Violin plot: Full density distribution with embedded box plot
 * - Calendar heatmap: Day-of-week and week-over-week usage patterns
 *
 * Allows interactive date range selection by clicking and dragging on the timeline chart.
 * Adapts to dark/light theme using Plotly theming.
 *
 * @param {Object} props - Component props
 * @param {Array<Object>} props.data - Array of parsed CPAP session objects.
 *   Expected columns: 'Date' (date string/Date), 'Total Time' (duration string like \"H:MM:SS\")
 * @param {Function} [props.onRangeSelect] - Callback when user selects a date range on timeline.
 *   Called with { start: Date, end: Date }
 * @returns {JSX.Element} A div containing KPI grid, multiple chart components, and help tooltips
 *
 * @example
 * const { filteredSummary: data } = useData();
 * const handleRangeSelect = (range) => {
 *   console.log('Selected usage range:', range.start, 'to', range.end);
 *   setDateFilter(range);
 * };
 * return <UsagePatternsCharts data={data} onRangeSelect={handleRangeSelect} />;
 *
 * @see useTimeSeriesProcessing - Provides time-series decomposition and rolling statistics
 * @see useUsageStats - Provides summary statistics (median, mean, bin count)
 * @see useAutocorrelation - Provides ACF/PACF calculations
 * @see adherenceMetrics - Calculates compliance metrics and streaks
 */
import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
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

/**
 * Displays comprehensive CPAP usage analysis with multiple visualization perspectives.
 *
 * Features:
 * - KPI grid: % nights ≥ 4h, % nights ≥ 6h, current rolling compliance streak
 * - Usage timeline: Nightly usage hours with rolling averages (7-night, 30-night) and confidence intervals
 * - Lag control: Interactive input to adjust max lag for ACF/PACF analysis
 * - Autocorrelation chart: Shows how strongly usage on one night predicts the next
 * - Partial autocorrelation chart: Isolates direct usage memory effects
 * - STL decomposition: Separates usage trend, weekly seasonal pattern, and residual noise
 * - Histogram: Distribution of nightly usage hours with median/mean markers
 * - Boxplot: Quartile-based view of usage distribution and outlier detection
 * - Calendar heatmap: Day-of-week and week-over-week usage patterns
 *
 * Allows interactive date range selection by clicking and dragging on the timeline chart.
 *
 * @param {Object} props - Component props
 * @param {Array<Object>} props.data - Array of parsed CPAP session objects with columns: Date, Total Time
 * @param {Function} [props.onRangeSelect] - Callback when user selects a date range on timeline.
 *   Called with { start: Date, end: Date }
 * @returns {JSX.Element} A div containing KPI grid, multiple chart components, and help tooltips
 *
 * @example
 * const { filteredSummary: data } = useData();
 * const handleRangeSelect = (range) => console.log('Selected:', range);
 * return <UsagePatternsCharts data={data} onRangeSelect={handleRangeSelect} />;
 *
 * @see useTimeSeriesProcessing - Provides time-series decomposition and rolling statistics
 * @see useUsageStats - Provides summary statistics (median, mean, bin count)
 * @see useAutocorrelation - Provides ACF/PACF calculations
 * @see adherenceMetrics - Calculates compliance metrics
 */
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

UsagePatternsCharts.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object).isRequired,
  onRangeSelect: PropTypes.func,
};

export { UsagePatternsCharts };
export default React.memo(UsagePatternsCharts);
