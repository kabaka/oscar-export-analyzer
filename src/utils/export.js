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
    ['pct_nights_ge_4h', round((usage.nightsLong / usage.totalNights) * 100, 1)],
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
  return [header, ...rows.map(r => r.join(','))].join('\n');
}

export function downloadTextFile(name, content, type = 'text/plain') {
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}

export function openPrintReportHTML(summaryData = [], clusters = [], falseNegatives = []) {
  const usage = summarizeUsage(summaryData || []);
  const ahi = computeAHITrends(summaryData || []);
  const epap = computeEPAPTrends(summaryData || []);
  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>OSCAR Report</title>
    <style>
      body{font-family:system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding: 16px; color:#111}
      h1,h2{margin: 0 0 8px}
      table{width:100%;border-collapse:collapse;margin:12px 0}
      th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}
      .muted{opacity:.8}
    </style>
  </head><body>
    <h1>OSCAR Sleep Data Report</h1>
    <p class="muted">Generated ${new Date().toLocaleString()}</p>
    <h2>Usage</h2>
    <table><tbody>
      <tr><td>Total nights</td><td>${usage.totalNights}</td></tr>
      <tr><td>Avg hours</td><td>${round(usage.avgHours,2)}</td></tr>
      <tr><td>Median hours</td><td>${round(usage.medianHours,2)}</td></tr>
      <tr><td>% nights ≥4h</td><td>${round((usage.nightsLong/usage.totalNights)*100,1)}%</td></tr>
    </tbody></table>
    <h2>AHI</h2>
    <table><tbody>
      <tr><td>Average</td><td>${round(ahi.avgAHI,2)}</td></tr>
      <tr><td>Median</td><td>${round(ahi.medianAHI,2)}</td></tr>
      <tr><td>Min / Max</td><td>${round(ahi.minAHI,2)} / ${round(ahi.maxAHI,2)}</td></tr>
    </tbody></table>
    <h2>EPAP</h2>
    <table><tbody>
      <tr><td>Median</td><td>${round(epap.medianEPAP,2)}</td></tr>
      <tr><td>IQR</td><td>${round(epap.p25EPAP,2)}–${round(epap.p75EPAP,2)}</td></tr>
    </tbody></table>
    <h2>Clusters & False Negatives</h2>
    <p>Clusters: ${clusters.length}; False negatives: ${falseNegatives.length}</p>
    <script>window.print&&setTimeout(()=>window.print(),300)</script>
  </body></html>`;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

function round(v, d) { return Number.isFinite(v) ? Number(v).toFixed(d) : '—'; }

