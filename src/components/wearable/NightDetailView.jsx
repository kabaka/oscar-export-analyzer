import React, { useEffect, useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { ThemedPlot } from '../ui';
import { useEffectiveDarkMode } from '../../hooks/useEffectiveDarkMode';

/**
 * Colorblind-safe sleep-stage palette (blue/orange/gray family per the
 * `medical-data-visualization` skill — never red/green). Awake is the warm
 * accent; deeper stages get progressively darker blues.
 */
const STAGE_COLORS = {
  awake: '#D55E00', // orange
  rem: '#56B4E9', // sky blue
  light: '#0072B2', // medium blue
  deep: '#012749', // dark navy
};

const STAGE_ORDER = ['awake', 'rem', 'light', 'deep'];
const STAGE_LABELS = {
  awake: 'Awake',
  rem: 'REM',
  light: 'Light',
  deep: 'Deep',
};
/**
 * Plotly bar pattern shapes so stages are distinguishable without relying on
 * color alone (WCAG 1.4.1, colorblind-safe + greyscale print).
 */
const STAGE_PATTERNS = {
  awake: '',
  rem: '/',
  light: '.',
  deep: 'x',
};

/** Per-minute overlay metric definitions (colorblind-safe). */
const OVERLAY_METRICS = [
  { key: 'spo2', label: 'SpO₂ (%)', color: '#0072B2', axis: 'y' },
  { key: 'hr', label: 'Heart rate (bpm)', color: '#D55E00', axis: 'y2' },
  { key: 'hrv', label: 'HRV (ms)', color: '#009E73', axis: 'y2' },
  { key: 'snore', label: 'Snore (dBA)', color: '#666666', axis: 'y2' },
];

/** Reconstruct timestamps for a downsampled `{ cadenceSec, t0Ms, values }`. */
function intradayToSeries(rec) {
  if (!rec || !rec.values || rec.values.length === 0) return null;
  const { cadenceSec, t0Ms, values } = rec;
  const x = [];
  const y = [];
  for (let i = 0; i < values.length; i += 1) {
    x.push(new Date(t0Ms + i * cadenceSec * 1000));
    // 0 is the downsample "no data" filler — render as a gap.
    y.push(values[i] === 0 ? null : values[i]);
  }
  return { x, y };
}

/**
 * Single-night drill-down (integration §2.3 ADD): a sleep-stage hypnogram (from
 * the nightly rollup's stage minutes) plus per-minute SpO₂/HR/HRV/snore
 * overlays (lazily fetched via `getNightDetail`) on a shared local-time axis.
 *
 * Stage colors are colorblind-safe and the chart carries an `aria-label` +
 * an off-screen text summary (`medical-data-visualization`, WCAG AA).
 *
 * @param {object} props
 * @param {object} props.night - The selected wearable nightly rollup record.
 * @param {Function} props.getNightDetail - `(date, metric) => Promise<intraday|null>`.
 * @param {Function} [props.onClose] - Close the drill-down.
 * @param {string} [props.className] - Container CSS class.
 * @returns {JSX.Element} The night detail view.
 */
function NightDetailView({ night, getNightDetail, onClose, className = '' }) {
  const nightDate = night?.nightDate || night?.nightKey || null;
  const [intraday, setIntraday] = useState({});
  const [loading, setLoading] = useState(false);
  const isDark = useEffectiveDarkMode();
  // applyChartTheme only themes the primary x/y axes, so the right-hand
  // (yaxis2) label/ticks need an explicit theme-aware color to stay readable
  // (WCAG AA) in dark mode.
  const secondaryAxisColor = isDark ? '#aab2bd' : '#5b6472';

  useEffect(() => {
    if (!nightDate) return undefined;
    let cancelled = false;
    const metrics = Array.isArray(night?.intradayMetrics)
      ? night.intradayMetrics
      : OVERLAY_METRICS.map((m) => m.key);
    // Defer the initial setState past a microtask so it is not called
    // synchronously within the effect body (avoids cascading-render rule).
    Promise.resolve().then(() => {
      if (cancelled) return;
      setLoading(true);
      setIntraday({});
    });
    Promise.all(
      metrics.map(async (metric) => {
        const rec = await getNightDetail(nightDate, metric);
        return [metric, rec];
      }),
    ).then((entries) => {
      if (cancelled) return;
      const next = {};
      for (const [metric, rec] of entries) {
        if (rec) next[metric] = rec;
      }
      setIntraday(next);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [nightDate, night, getNightDetail]);

  // Hypnogram: a horizontal stacked bar of stage minutes (rollup carries
  // totals, not a per-epoch sequence, so a duration profile is the honest view).
  // Stage minutes are kept alongside the traces so the off-screen text
  // alternative can describe the same data for screen-reader users.
  const { hypnogram, stageMinutes } = useMemo(() => {
    const sleep = night?.sleep || {};
    const minutes = {
      awake: sleep.wakeMin,
      rem: sleep.remMin,
      light: sleep.lightMin,
      deep: sleep.deepMin,
    };
    const present = STAGE_ORDER.filter(
      (stage) => Number.isFinite(minutes[stage]) && minutes[stage] > 0,
    );
    const totalMin = present.reduce((sum, s) => sum + minutes[s], 0);
    const traces = present.map((stage) => {
      const min = minutes[stage];
      const pct = totalMin > 0 ? Math.round((min / totalMin) * 100) : 0;
      return {
        type: 'bar',
        orientation: 'h',
        name: STAGE_LABELS[stage],
        x: [min],
        y: ['Sleep stages'],
        marker: {
          color: STAGE_COLORS[stage],
          // Pattern fill so stages are distinguishable without relying on
          // color alone (WCAG 1.4.1) and in greyscale print.
          pattern: { shape: STAGE_PATTERNS[stage], fgcolor: '#ffffff' },
        },
        text: [`${pct}%`],
        textposition: 'inside',
        insidetextanchor: 'middle',
        textfont: { color: '#ffffff' },
        hovertemplate: `${STAGE_LABELS[stage]}: %{x} min (${pct}%)<extra></extra>`,
      };
    });
    return { hypnogram: traces, stageMinutes: minutes };
  }, [night]);

  const overlay = useMemo(() => {
    const traces = [];
    for (const m of OVERLAY_METRICS) {
      const series = intradayToSeries(intraday[m.key]);
      if (!series) continue;
      traces.push({
        type: 'scatter',
        mode: 'lines',
        name: m.label,
        x: series.x,
        y: series.y,
        yaxis: m.axis,
        line: { color: m.color, width: 1.5 },
        connectgaps: false,
        hovertemplate: `%{x|%H:%M}<br>${m.label}: %{y}<extra></extra>`,
      });
    }
    return traces;
  }, [intraday]);

  if (!nightDate) return null;

  const sleep = night.sleep || {};
  const stageSummary = STAGE_ORDER.filter((s) =>
    Number.isFinite(stageMinutes[s]),
  )
    .map((s) => `${STAGE_LABELS[s]} ${Math.round(stageMinutes[s])} minutes`)
    .join(', ');
  const summaryText = `Night of ${nightDate}. ${
    Number.isFinite(sleep.asleepMin)
      ? `${Math.round(sleep.asleepMin)} minutes asleep. `
      : ''
  }${
    Number.isFinite(sleep.efficiencyPct)
      ? `Sleep efficiency ${Math.round(sleep.efficiencyPct)}%. `
      : ''
  }${stageSummary ? `Sleep stages: ${stageSummary}.` : ''}`;

  return (
    <div
      className={`wearable-night-detail ${className}`}
      role="region"
      aria-labelledby="wearable-night-detail-title"
      data-testid="wearable-night-detail"
    >
      <div className="wearable-night-detail-header">
        <h3 id="wearable-night-detail-title">Night detail — {nightDate}</h3>
        {onClose && (
          <button
            type="button"
            className="wearable-night-detail-close"
            onClick={onClose}
            aria-label="Close night detail"
          >
            Close
          </button>
        )}
      </div>

      <p id="wearable-night-detail-summary" className="sr-only">
        {summaryText}
      </p>

      {hypnogram.length > 0 ? (
        <div
          role="img"
          aria-label={`Sleep stage duration breakdown for ${nightDate}`}
          aria-describedby="wearable-night-detail-summary"
        >
          <ThemedPlot
            data={hypnogram}
            layout={{
              title: 'Sleep stages (time in each stage)',
              barmode: 'stack',
              height: 170,
              showlegend: true,
              legend: { orientation: 'h', y: -0.3 },
              xaxis: { title: 'Minutes' },
              yaxis: { showticklabels: false },
            }}
            style={{ width: '100%', height: '170px' }}
            config={{ displaylogo: false, responsive: true }}
          />
        </div>
      ) : (
        <p className="wearable-import-note">
          No sleep-stage breakdown available for this night.
        </p>
      )}

      {loading && <p className="wearable-import-note">Loading minute data…</p>}

      {!loading && overlay.length > 0 ? (
        <div
          role="img"
          aria-label={`Per-minute SpO2, heart rate, HRV and snore overlays for ${nightDate}`}
          aria-describedby="wearable-night-detail-overlay-summary"
        >
          <p id="wearable-night-detail-overlay-summary" className="sr-only">
            {`Overnight per-minute time series on a local-time axis showing ${overlay
              .map((t) => t.name)
              .join(
                ', ',
              )}. SpO₂ is on the left axis; heart rate, HRV and snore on the right axis.`}
          </p>
          <ThemedPlot
            data={overlay}
            layout={{
              title: 'Overnight metrics (per minute)',
              height: 360,
              hovermode: 'x unified',
              legend: { orientation: 'h', y: -0.2 },
              xaxis: {
                title: 'Local time (HH:MM)',
                type: 'date',
                tickformat: '%H:%M',
              },
              yaxis: { title: 'SpO₂ (%)', side: 'left' },
              yaxis2: {
                title: 'HR (bpm) / HRV (ms) / Snore (dBA)',
                overlaying: 'y',
                side: 'right',
                color: secondaryAxisColor,
              },
            }}
            style={{ width: '100%', height: '360px' }}
            config={{
              displaylogo: false,
              responsive: true,
              toImageButtonOptions: {
                format: 'png',
                filename: `oscar-wearable-night-${nightDate}`,
              },
            }}
          />
        </div>
      ) : (
        !loading && (
          <p className="wearable-import-note">
            No per-minute overlay data stored for this night.
          </p>
        )
      )}
    </div>
  );
}

NightDetailView.propTypes = {
  night: PropTypes.shape({
    nightDate: PropTypes.string,
    nightKey: PropTypes.string,
    sleep: PropTypes.object,
    intradayMetrics: PropTypes.arrayOf(PropTypes.string),
  }).isRequired,
  getNightDetail: PropTypes.func.isRequired,
  onClose: PropTypes.func,
  className: PropTypes.string,
};

export default NightDetailView;
