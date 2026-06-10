import React, { useMemo } from 'react';
import {
  WearableImportCard,
  IngestStatusPanel,
  WearableDashboard,
} from '../../components/wearable';
import { useWearableImport } from '../../hooks/useWearableImport';
import { useWearableData } from '../../hooks/useWearableData';
import { useWearableCorrelation } from '../../hooks/useWearableCorrelation';
import { useData } from '../../context/DataContext';
import { useDateFilter } from '../../hooks/useDateFilter';

/**
 * Wearable correlation analysis section (integration §2.1). Replaces the OAuth
 * `FitbitCorrelationSection`.
 *
 * Thin orchestrator: it composes the directory-import card, the ingest status
 * panel, and the dashboard, and wires the new hooks. It keeps the existing
 * "gated on CPAP summary present, additive" mounting model and reuses
 * `useDateFilter` so the wearable and CPAP views stay in lockstep — the
 * dashboard only shows nights inside the active CPAP date filter.
 *
 * @returns {JSX.Element} The wearable correlation section.
 */
export function WearableCorrelationSection() {
  const { filteredSummary } = useData();
  const { dateFilter } = useDateFilter();

  // Derive the OSCAR date range to bound the wearable query (mirrors the old
  // FitbitCorrelationSection logic exactly).
  const oscarDateRange = useMemo(() => {
    if (dateFilter?.start && dateFilter?.end) {
      const fmt = (d) =>
        d instanceof Date ? d.toISOString().split('T')[0] : String(d);
      return { start: fmt(dateFilter.start), end: fmt(dateFilter.end) };
    }
    if (Array.isArray(filteredSummary) && filteredSummary.length > 0) {
      const dates = filteredSummary
        .map((r) => r.Date)
        .filter(Boolean)
        .sort();
      if (dates.length > 0) {
        return { start: dates[0], end: dates[dates.length - 1] };
      }
    }
    return null;
  }, [dateFilter, filteredSummary]);

  const imports = useWearableImport();
  // Reload persisted nights whenever an ingest completes (`lastImport` is set on
  // completion). Without this signal, a first import in the common "don't touch
  // the date filter" flow would leave `nights` empty and the dashboard hidden
  // until a refresh or filter change.
  const { nights, getNightDetail } = useWearableData({
    start: oscarDateRange?.start ?? null,
    end: oscarDateRange?.end ?? null,
    reloadKey: imports.lastImport?.at ?? null,
  });

  const { correlation } = useWearableCorrelation({
    oscarRows: filteredSummary,
    nights,
  });

  const hasNights = Array.isArray(nights) && nights.length > 0;

  return (
    <section
      id="wearable-correlation"
      className="chart-section"
      role="region"
      aria-labelledby="wearable-section-title"
    >
      <div className="section-header">
        <h2 id="wearable-section-title" className="section-title">
          <span className="section-icon" aria-hidden="true">
            ⌚
          </span>
          Wearable Correlation Analysis
        </h2>
        <p className="section-description">
          Import a local wearable data export (e.g. a Google Health / Fitbit
          Takeout folder) to analyze correlations between your sleep therapy and
          biometric measurements. Everything is parsed locally in your browser —
          nothing is uploaded.
        </p>
      </div>

      {imports.supported && (
        <IngestStatusPanel
          state={imports.state}
          progress={imports.progress}
          lastImport={imports.lastImport}
          onCancel={imports.cancelIngest}
          className="wearable-ingest-panel"
        />
      )}

      <WearableImportCard imports={imports} className="wearable-import-card" />

      {hasNights && (
        <WearableDashboard
          nights={nights}
          correlation={correlation}
          getNightDetail={getNightDetail}
          className="wearable-dashboard-container"
        />
      )}
    </section>
  );
}

export default WearableCorrelationSection;
