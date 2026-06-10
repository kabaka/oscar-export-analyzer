import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { CorrelationMatrix } from './correlation';
import NightDetailView from './NightDetailView';

/** Format a number for display, or an em dash when not finite. */
const fmt = (v, digits = 2) =>
  Number.isFinite(v) ? Number(v).toFixed(digits) : '—';

/** Build the CorrelationMatrix `correlationData` from engine pair results. */
function buildMatrix(pairs, nAlignedNights) {
  if (!Array.isArray(pairs) || pairs.length === 0) return null;
  // Collect the distinct x/y axes used across pairs.
  const axes = [];
  const seen = new Set();
  for (const p of pairs) {
    for (const axis of [p.x, p.y]) {
      if (axis && !seen.has(axis)) {
        seen.add(axis);
        axes.push(axis);
      }
    }
  }
  const n = axes.length;
  if (n === 0) return null;
  const idx = new Map(axes.map((a, i) => [a, i]));
  const corr = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : null)),
  );
  const pvals = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 0 : null)),
  );
  for (const p of pairs) {
    const i = idx.get(p.x);
    const j = idx.get(p.y);
    if (i == null || j == null) continue;
    const rho = Number.isFinite(p.rho) ? p.rho : null;
    const pv = Number.isFinite(p.pValueAdj) ? p.pValueAdj : null;
    corr[i][j] = rho;
    corr[j][i] = rho;
    pvals[i][j] = pv;
    pvals[j][i] = pv;
  }
  return {
    metrics: axes,
    correlations: corr,
    pValues: pvals,
    sampleSize: nAlignedNights,
  };
}

/**
 * Wearable correlation dashboard (integration §2.3). Replaces the OAuth
 * `FitbitDashboard`. Data-agnostic: it consumes the engine output (from
 * `runCorrelationEngine`) and the nightly rollups (from `useWearableData`) and
 * renders:
 *   - the reused `CorrelationMatrix` chart over the engine's pair results,
 *   - a pre-registered pair table with effect size, n, FDR survival, and flags,
 *   - MNAR / coverage + offset-provenance diagnostics surfaced from warnings,
 *   - a nights list with a single-night drill-down (`NightDetailView`).
 *
 * It owns no connection/sync state (that lives in the import card).
 *
 * @param {object} props
 * @param {object[]} props.nights - Wearable nightly rollups (date-ascending).
 * @param {object|null} props.correlation - `runCorrelationEngine` output.
 * @param {Function} props.getNightDetail - Lazy intraday loader for the drill-down.
 * @param {string} [props.className] - Container CSS class.
 * @returns {JSX.Element} The dashboard.
 */
function WearableDashboard({
  nights,
  correlation,
  getNightDetail,
  className = '',
}) {
  const [selectedNight, setSelectedNight] = useState(null);

  const matrix = useMemo(
    () => buildMatrix(correlation?.pairs, correlation?.nAlignedNights),
    [correlation],
  );

  const primaryPairs = useMemo(
    () => (correlation?.pairs || []).filter((p) => p.family === 'primary'),
    [correlation],
  );
  const exploratoryPairs = useMemo(
    () => (correlation?.pairs || []).filter((p) => p.family === 'exploratory'),
    [correlation],
  );

  const hasNights = Array.isArray(nights) && nights.length > 0;

  return (
    <div
      className={`wearable-dashboard-container ${className}`}
      data-testid="wearable-dashboard-container"
    >
      {/* Coverage / diagnostics */}
      <section className="wearable-dashboard-section">
        <h3>Overview</h3>
        <dl className="wearable-overview-grid">
          <div className="wearable-metric-card">
            <span className="wearable-metric-label">Nights with data</span>
            <span className="wearable-metric-value">
              {hasNights ? nights.length : 0}
            </span>
          </div>
          <div className="wearable-metric-card">
            <span className="wearable-metric-label">Aligned nights</span>
            <span className="wearable-metric-value">
              {correlation?.nAlignedNights ?? 0}
            </span>
          </div>
          <div className="wearable-metric-card">
            <span className="wearable-metric-label">Tests run</span>
            <span className="wearable-metric-value">
              {correlation?.testsRun ?? 0}
            </span>
          </div>
        </dl>
        {correlation?.singleSubjectCaveat && (
          <p className="wearable-import-note" role="note">
            Single-subject analysis. These are exploratory associations from one
            person&rsquo;s nights — they show how metrics moved together, not
            cause and effect, and are not a substitute for clinical advice.
            Correlations can be driven by confounders (illness, alcohol,
            missing-data patterns) and need replication.
          </p>
        )}
        {Array.isArray(correlation?.warnings) &&
          correlation.warnings.length > 0 && (
            <div
              className="wearable-diagnostics"
              role="region"
              aria-labelledby="wearable-diagnostics-title"
              data-testid="wearable-diagnostics"
            >
              <h4 id="wearable-diagnostics-title">Diagnostics</h4>
              <p className="wearable-import-note">
                Quality flags raised during analysis (e.g. missing-data bias,
                low coverage, or attenuation that can shrink an association
                toward zero). Treat flagged pairs with extra caution.
              </p>
              <ul className="wearable-diagnostics-list">
                {correlation.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}
      </section>

      {/* Correlation matrix */}
      {matrix && (
        <section className="wearable-dashboard-section">
          <h3>Correlation matrix</h3>
          <CorrelationMatrix
            correlationData={matrix}
            className="wearable-correlation-matrix"
          />
        </section>
      )}

      {/* Pre-registered pair results */}
      {(primaryPairs.length > 0 || exploratoryPairs.length > 0) && (
        <section className="wearable-dashboard-section wearable-correlation-analysis">
          <h3>Pre-registered correlations</h3>
          <p className="wearable-import-note">
            Hypotheses were specified in advance. The <strong>primary</strong>{' '}
            family is the small confirmatory set; the{' '}
            <strong>exploratory</strong> family is hypothesis-generating only.
            Multiple comparisons are controlled with false-discovery-rate (FDR)
            correction — a pair that does not survive FDR should be read as
            &ldquo;not supported&rdquo; rather than &ldquo;no
            relationship&rdquo;.
          </p>
          {[
            ['Primary family', primaryPairs],
            ['Exploratory family', exploratoryPairs],
          ].map(([heading, list]) =>
            list.length > 0 ? (
              <div key={heading}>
                <h4>{heading}</h4>
                <table className="wearable-correlation-table">
                  <caption className="sr-only">
                    {heading} correlation results: each row is a metric pair
                    with its Spearman correlation, effect size, number of paired
                    nights, FDR-adjusted q-value, whether it survived
                    false-discovery-rate correction, and any quality flags.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Pair</th>
                      <th scope="col">
                        <abbr title="Spearman rank correlation, from -1 to +1">
                          ρ
                        </abbr>
                      </th>
                      <th scope="col">Effect</th>
                      <th scope="col">
                        <abbr title="Number of paired nights">n</abbr>
                      </th>
                      <th scope="col">
                        <abbr title="False-discovery-rate adjusted p-value (q-value)">
                          q
                        </abbr>
                      </th>
                      <th scope="col">
                        <abbr title="Survives false-discovery-rate correction at the chosen threshold">
                          Survives FDR
                        </abbr>
                      </th>
                      <th scope="col">Flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((p) => (
                      <tr key={p.id ?? `${p.x}-${p.y}`}>
                        <th scope="row">
                          {p.x} ↔ {p.y}
                        </th>
                        <td>{fmt(p.rho)}</td>
                        <td>{p.effectSize ?? '—'}</td>
                        <td>{Number.isFinite(p.n) ? p.n : '—'}</td>
                        <td>{fmt(p.qValue, 3)}</td>
                        <td>{p.survivesFDR ? 'Yes' : 'No'}</td>
                        <td>{(p.flags || []).join(', ') || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null,
          )}
        </section>
      )}

      {/* Nights list + drill-down */}
      <section className="wearable-dashboard-section">
        <h3>Nights</h3>
        {hasNights ? (
          <ul className="wearable-nights-list">
            {nights.map((night) => {
              const date = night.nightDate || night.nightKey;
              return (
                <li key={date}>
                  <button
                    type="button"
                    className="wearable-night-button"
                    onClick={() =>
                      setSelectedNight((prev) =>
                        prev && (prev.nightDate || prev.nightKey) === date
                          ? null
                          : night,
                      )
                    }
                    aria-expanded={
                      !!selectedNight &&
                      (selectedNight.nightDate || selectedNight.nightKey) ===
                        date
                    }
                  >
                    {date}
                    {Number.isFinite(night.sleep?.efficiencyPct)
                      ? ` — ${Math.round(night.sleep.efficiencyPct)}% efficiency`
                      : ''}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="wearable-import-note">
            No wearable nights in the current date range.
          </p>
        )}
      </section>

      {selectedNight && (
        <section className="wearable-dashboard-section">
          <NightDetailView
            night={selectedNight}
            getNightDetail={getNightDetail}
            onClose={() => setSelectedNight(null)}
          />
        </section>
      )}
    </div>
  );
}

WearableDashboard.propTypes = {
  nights: PropTypes.arrayOf(PropTypes.object),
  correlation: PropTypes.shape({
    pairs: PropTypes.array,
    groupTests: PropTypes.array,
    warnings: PropTypes.arrayOf(PropTypes.string),
    nAlignedNights: PropTypes.number,
    testsRun: PropTypes.number,
    singleSubjectCaveat: PropTypes.bool,
  }),
  getNightDetail: PropTypes.func.isRequired,
  className: PropTypes.string,
};

export default WearableDashboard;
