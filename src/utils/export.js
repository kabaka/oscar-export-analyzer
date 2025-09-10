// Build CSV exports for aggregates without external deps
import { summarizeUsage, computeAHITrends, computeEPAPTrends } from './stats';

export function buildSummaryAggregatesCSV(summaryData = []) {
  if (!summaryData || !summaryData.length) return 'metric,value\n';
  const usage = summarizeUsage(summaryData);
  const ahi = computeAHITrends(summaryData);
  const epap = computeEPAPTrends(summaryData);
  const rows = [
    ['total_nights', usage.totalNights],
    ['avg_usage_hours', round(usage.avgHours, 3)],
    ['median_usage_hours', round(usage.medianHours, 3)],
    ['p25_usage_hours', round(usage.p25Hours, 3)],
    ['p75_usage_hours', round(usage.p75Hours, 3)],
    ['min_usage_hours', round(usage.minHours, 3)],
    ['max_usage_hours', round(usage.maxHours, 3)],
    [
      'pct_nights_ge_4h',
      round((usage.nightsLong / usage.totalNights) * 100, 1),
    ],
    ['avg_AHI', round(ahi.avgAHI, 3)],
    ['median_AHI', round(ahi.medianAHI, 3)],
    ['p25_AHI', round(ahi.p25AHI, 3)],
    ['p75_AHI', round(ahi.p75AHI, 3)],
    ['min_AHI', round(ahi.minAHI, 3)],
    ['max_AHI', round(ahi.maxAHI, 3)],
    ['median_EPAP', round(epap.medianEPAP, 3)],
    ['p25_EPAP', round(epap.p25EPAP, 3)],
    ['p75_EPAP', round(epap.p75EPAP, 3)],
  ];
  const header = 'metric,value';
  return [header, ...rows.map((r) => r.join(','))].join('\n');
}

export function downloadTextFile(name, content, type = 'text/plain') {
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function round(v, d) {
  return Number.isFinite(v) ? Number(v).toFixed(d) : '—';
}
