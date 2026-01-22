import { computeAdherenceStreaks } from './stats';

/**
 * Build a calendar-style heatmap grid for a time series.
 * @param {Date[]} dates - sorted dates for each value
 * @param {number[]} values - numeric values matching dates
 * @param {Object} options - heatmap options
 * @param {string[]} options.labels - y-axis labels for day-of-week rows
 * @param {number} options.daysPerWeek - number of days per week (default 7)
 * @param {number} options.weekStartOffset - offset to treat Monday as 0
 * @param {number} options.maxWeeks - cap on number of weeks to include
 * @param {number} options.isoDateLength - length of ISO date string to slice
 * @returns {{x: Date[], y: string[], z: Array<Array<number|null>>}}
 */
export function timeSeriesHeatmap(
  dates = [],
  values = [],
  {
    labels = [],
    daysPerWeek = 7,
    weekStartOffset = 0,
    maxWeeks = 52,
    isoDateLength = 10,
  } = {},
) {
  if (!dates.length || !values.length) {
    return { x: [], y: labels, z: [] };
  }

  const yLabels = labels.length
    ? labels
    : Array.from({ length: daysPerWeek }, (_, i) => `${i}`);
  const toISODate = (d) =>
    new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const getWeekStart = (d) => {
    const nd = new Date(d);
    const day = (nd.getDay() + weekStartOffset) % daysPerWeek;
    nd.setDate(nd.getDate() - day);
    return toISODate(nd);
  };
  const dateToStr = (d) => d.toISOString().slice(0, isoDateLength);
  const byDate = new Map();
  dates.forEach((d, i) => byDate.set(dateToStr(toISODate(d)), values[i]));
  const start = dates.length ? getWeekStart(dates[0]) : null;
  const end = dates.length ? getWeekStart(dates[dates.length - 1]) : null;
  const weekStarts = [];
  if (start && end && start <= end) {
    let iter = 0;
    for (
      let w = new Date(start);
      w <= end && iter < maxWeeks;
      w.setDate(w.getDate() + daysPerWeek), iter++
    ) {
      weekStarts.push(new Date(w));
    }
  }
  const z = weekStarts.length
    ? yLabels.map((_, dowIdx) =>
        weekStarts.map((ws) => {
          const d = new Date(ws);
          d.setDate(d.getDate() + dowIdx);
          const key = dateToStr(toISODate(d));
          return byDate.has(key) ? byDate.get(key) : null;
        }),
      )
    : yLabels.map(() => []);

  return { x: weekStarts, y: yLabels, z };
}

export function adherenceMetrics(
  values = [],
  rolling = {},
  { complianceThreshold, strictThreshold, longWindowDays },
) {
  const adherence = computeAdherenceStreaks(values);
  const longestCompliance =
    adherence[`longest_${complianceThreshold}`] ?? 0;
  const longestStrict = adherence[`longest_${strictThreshold}`] ?? 0;
  const complianceKey = `compliance${complianceThreshold}_${longWindowDays}`;
  return {
    longestCompliance,
    longestStrict,
    complianceSeries: rolling?.[complianceKey],
  };
}
